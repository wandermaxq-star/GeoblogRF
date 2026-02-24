/**
 * ЕДИНЫЙ ФАСАД МОДЕРАЦИИ
 *
 * Центральная точка для ВСЕХ операций модерации:
 * 1. Получение контента / определение таблицы
 * 2. Одобрение / отклонение / revision / скрытие
 * 3. Начисление XP (единственное место)
 * 4. Статистика модерации
 *
 * Контроллеры и маршруты ТОЛЬКО вызывают фасад — без дублирования логики.
 */

import pool from '../../db.js';
import { autoAnalyzeContent } from '../middleware/autoModeration.js';
import { calculateLevelFromTotalXP } from '../utils/xpCalculator.js';
import { notifyContentApproved, notifyContentRejected, notifyContentRevision } from './notificationService.js';
import logger from '../../logger.js';

// ── Маппинги ────────────────────────────────────────────────────────

/** Имя таблицы, колонка id и колонка автора для каждого типа контента */
const CONTENT_TABLE_MAP = {
  events:   { table: 'events',        idCol: 'id', authorCol: 'creator_id' },
  posts:    { table: 'posts',         idCol: 'id', authorCol: 'author_id'  },
  routes:   { table: 'travel_routes', idCol: 'id', authorCol: 'creator_id' },
  markers:  { table: 'map_markers',   idCol: 'id', authorCol: 'creator_id' },
  comments: { table: 'comments',      idCol: 'id', authorCol: 'author_id'  },
};

/** XP-источник для каждого типа контента */
const CONTENT_XP_SOURCES = {
  events:   'event_created',
  posts:    'post_created',
  routes:   'route_created',
  markers:  'marker_created',
  comments: 'comment_created',
};

/** Базовый XP за создание контента */
const BASE_XP_VALUES = {
  events:   50,
  posts:    50,
  routes:   100,
  markers:  30,
  comments: 10,
};

/** Бонусы за качество контента */
const QUALITY_BONUSES = {
  hasPhoto:       25,
  hasDescription: 15,
  hasLocation:    20,
  hasTags:        10,
};

// ── Утилиты ─────────────────────────────────────────────────────────

/**
 * Синхронизировать admin_verdict в ai_moderation_decisions.
 * Вызывается при одобрении/отклонении/revision через обычные роуты,
 * чтобы данные ИИ-решений были в согласованном состоянии.
 */
async function syncAIVerdict(contentType, contentId, verdict, adminId, client) {
  const db = client || pool;
  try {
    await db.query(
      `UPDATE ai_moderation_decisions
       SET admin_verdict = $1,
           admin_id = $2,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE content_type = $3 AND content_id = $4`,
      [verdict, adminId, contentType, String(contentId)],
    );
  } catch (err) {
    // Не критично — запись в ai_moderation_decisions может не существовать
    logger.warn(`syncAIVerdict: не удалось обновить ${contentType}:${contentId}: ${err.message}`);
  }
}

/**
 * Получить маппинг таблицы для типа контента.
 * Бросает ошибку если тип неизвестен.
 */
export function getTableMapping(contentType) {
  const mapping = CONTENT_TABLE_MAP[contentType];
  if (!mapping) throw new Error(`Неизвестный тип контента: ${contentType}`);
  return mapping;
}

/**
 * Получить контент из БД по типу и id.
 */
export async function getContent(contentType, contentId, client) {
  const db = client || pool;
  const { table, idCol } = getTableMapping(contentType);
  const result = await db.query(
    `SELECT * FROM ${table} WHERE ${idCol}::text = $1`,
    [String(contentId)],
  );
  return result.rows[0] || null;
}

/**
 * Обновить статус контента.
 * Устойчив к отсутствующим колонкам (moderated_at/moderated_by/moderation_reason).
 */
export async function updateContentStatus(contentType, contentId, status, adminId, reason, client) {
  const db = client || pool;
  const { table, idCol } = getTableMapping(contentType);

  // Сначала пробуем полный UPDATE (с полями модерации)
  try {
    const result = await db.query(
      `UPDATE ${table}
       SET status = $1,
           moderated_at   = NOW(),
           moderated_by   = $2,
           moderation_reason = $3,
           updated_at     = NOW()
       WHERE ${idCol}::text = $4
       RETURNING *`,
      [status, adminId, reason, String(contentId)],
    );
    return result.rows[0] || null;
  } catch (fullErr) {
    // Если колонки модерации не существуют — минимальный UPDATE
    if (fullErr.code === '42703') { // undefined_column
      logger.warn(`updateContentStatus: колонки модерации не найдены в ${table}, fallback`);
      const result = await db.query(
        `UPDATE ${table}
         SET status = $1, updated_at = NOW()
         WHERE ${idCol}::text = $2
         RETURNING *`,
        [status, String(contentId)],
      );
      return result.rows[0] || null;
    }
    // Если CHECK constraint не пускает 'revision' — ставим 'pending' + reason
    if (fullErr.code === '23514' && status === 'revision') { // check_violation
      logger.warn(`updateContentStatus: status='revision' не допускается constraint в ${table}, используем pending`);
      try {
        const result = await db.query(
          `UPDATE ${table}
           SET status = 'pending',
               moderation_reason = $1,
               updated_at = NOW()
           WHERE ${idCol}::text = $2
           RETURNING *`,
          [reason || 'Отправлено на доработку', String(contentId)],
        );
        return result.rows[0] || null;
      } catch {
        const result = await db.query(
          `UPDATE ${table}
           SET status = 'pending', updated_at = NOW()
           WHERE ${idCol}::text = $1
           RETURNING *`,
          [String(contentId)],
        );
        return result.rows[0] || null;
      }
    }
    throw fullErr;
  }
}

// ── Начисление XP (ЕДИНСТВЕННОЕ место) ──────────────────────────────

/**
 * Начислить XP автору за одобренный контент.
 * Идемпотентный: если XP уже начислено — вернёт `already_awarded`.
 */
export async function awardXPForContent(authorId, contentType, contentId, content, client) {
  const xpSource = CONTENT_XP_SOURCES[contentType];
  if (!xpSource) return { success: false, reason: 'unknown_content_type' };

  // Идемпотентность — используем ::text для сравнения (content_id может быть uuid или bigint)
  const existing = await client.query(
    `SELECT id FROM gamification_actions
     WHERE user_id = $1 AND source = $2 AND content_id::text = $3`,
    [authorId, xpSource, String(contentId)],
  );
  if (existing.rows.length > 0) {
    return { success: false, reason: 'already_awarded' };
  }

  // Рассчитываем XP
  const baseXP = BASE_XP_VALUES[contentType] || 50;
  let bonusXP = 0;

  const hasPhoto = !!(content.photo_urls || content.cover_image_url || content.image_url);
  const descText = content.description || content.body || content.content || '';
  const hasDescription = descText.length > 50;
  const hasLocation = !!(content.location || content.address || (content.latitude && content.longitude));
  const hasTags = !!(content.hashtags || content.tags);

  if (hasPhoto) bonusXP += QUALITY_BONUSES.hasPhoto;
  if (hasDescription) bonusXP += QUALITY_BONUSES.hasDescription;
  if (hasLocation) bonusXP += QUALITY_BONUSES.hasLocation;
  if (hasTags) bonusXP += QUALITY_BONUSES.hasTags;

  const totalXP = baseXP + bonusXP;

  // Получаем / создаём уровень пользователя
  let levelResult = await client.query('SELECT * FROM user_levels WHERE user_id = $1', [authorId]);
  if (levelResult.rows.length === 0) {
    await client.query(
      `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
       VALUES ($1, 0, 1, 0, 100, 'novice')`,
      [authorId],
    );
    levelResult = await client.query('SELECT * FROM user_levels WHERE user_id = $1', [authorId]);
  }

  const currentLevel = levelResult.rows[0];
  const newTotalXP = currentLevel.total_xp + totalXP;
  const newLevelData = calculateLevelFromTotalXP(newTotalXP);

  // Обновляем уровень
  await client.query(
    `UPDATE user_levels
     SET total_xp = $1, current_level = $2, current_level_xp = $3,
         required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $6`,
    [newTotalXP, newLevelData.level, newLevelData.currentLevelXP,
     newLevelData.requiredXP, newLevelData.rank, authorId],
  );

  // История XP
  await client.query(
    `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [authorId, xpSource, totalXP, String(contentId), contentType,
     JSON.stringify({ title: content.title, hasPhoto, hasDescription, hasLocation, hasTags, moderated: true, baseXP, bonusXP })],
  );

  // Действие для идемпотентности
  await client.query(
    `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, source, content_id) DO NOTHING`,
    [authorId, xpSource, totalXP, String(contentId), contentType,
     JSON.stringify({ title: content.title, hasPhoto, moderated: true })],
  );

  logger.info(`💰 XP +${totalXP} автору ${authorId} за ${contentType} ${contentId} (уровень ${newLevelData.level})`);

  return {
    success: true, xpAmount: totalXP, baseXP, bonusXP,
    newLevel: newLevelData.level, levelUp: newLevelData.level > currentLevel.current_level,
    totalXP: newTotalXP, currentLevelXP: newLevelData.currentLevelXP,
    requiredXP: newLevelData.requiredXP, rank: newLevelData.rank,
  };
}

// ── Операции модерации ──────────────────────────────────────────────

/**
 * Одобрить контент: статус → active, начислить XP автору.
 */
export async function approveContent(contentType, contentId, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const content = await getContent(contentType, contentId, client);
    if (!content) throw new Error(`Контент ${contentType}:${contentId} не найден`);

    const { authorCol } = getTableMapping(contentType);
    const authorId = content[authorCol];

    const updated = await updateContentStatus(contentType, contentId, 'active', adminId, null, client);

    // Синхронизируем admin_verdict в ai_moderation_decisions
    await syncAIVerdict(contentType, contentId, 'correct', adminId, client);

    let xpResult = null;
    if (authorId) {
      try {
        // SAVEPOINT изолирует ошибки XP от основной транзакции
        await client.query('SAVEPOINT xp_savepoint');
        xpResult = await awardXPForContent(authorId, contentType, contentId, content, client);
        await client.query('RELEASE SAVEPOINT xp_savepoint');
      } catch (xpErr) {
        // ROLLBACK TO SAVEPOINT восстанавливает транзакцию (одобрение контента сохранится)
        await client.query('ROLLBACK TO SAVEPOINT xp_savepoint');
        logger.error(`Ошибка XP при одобрении ${contentType} ${contentId}:`, xpErr);
        xpResult = { success: false, error: xpErr.message };
      }
    }

    await client.query('COMMIT');
    logger.info(`✅ ${contentType} ${contentId} одобрен админом ${adminId}`);

    // Уведомляем автора (вне транзакции, чтобы не блокировать одобрение)
    if (authorId) {
      try {
        await notifyContentApproved(authorId, contentType, contentId, content.title || content.description);
      } catch (notifErr) {
        logger.warn(`Не удалось уведомить автора ${authorId}: ${notifErr.message}`);
      }
    }

    return {
      success: true,
      content: updated,
      gamification: xpResult
        ? { xpAwarded: xpResult.success, ...xpResult }
        : { xpAwarded: false, reason: 'no_author' },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Отклонить контент: soft delete (status → rejected).
 * НЕ удаляется физически — можно восстановить.
 */
export async function rejectContent(contentType, contentId, adminId, reason) {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Необходимо указать причину отклонения');
  }

  const content = await getContent(contentType, contentId);
  if (!content) throw new Error(`Контент ${contentType}:${contentId} не найден`);

  const { authorCol } = getTableMapping(contentType);
  const authorId = content[authorCol];

  const updated = await updateContentStatus(contentType, contentId, 'rejected', adminId, reason);

  // Синхронизируем admin_verdict в ai_moderation_decisions
  await syncAIVerdict(contentType, contentId, 'incorrect', adminId);

  // Уведомляем автора
  if (authorId) {
    try {
      await notifyContentRejected(authorId, contentType, contentId, content.title || content.description, reason);
    } catch (notifErr) {
      logger.warn(`Не удалось уведомить автора ${authorId}: ${notifErr.message}`);
    }
  }

  logger.info(`❌ ${contentType} ${contentId} отклонён. Причина: ${reason}`);
  return { success: true, content: updated, reason };
}

/**
 * Отправить контент на доработку (status → revision).
 */
export async function revisionContent(contentType, contentId, adminId, reason) {
  const content = await getContent(contentType, contentId);
  if (!content) throw new Error(`Контент ${contentType}:${contentId} не найден`);

  const { authorCol } = getTableMapping(contentType);
  const authorId = content[authorCol];

  const updated = await updateContentStatus(
    contentType, contentId, 'revision', adminId,
    reason || 'Отправлено на доработку',
  );

  // Синхронизируем admin_verdict в ai_moderation_decisions
  await syncAIVerdict(contentType, contentId, 'incorrect', adminId);

  // Уведомляем автора
  if (authorId) {
    try {
      await notifyContentRevision(authorId, contentType, contentId, content.title || content.description, reason);
    } catch (notifErr) {
      logger.warn(`Не удалось уведомить автора ${authorId}: ${notifErr.message}`);
    }
  }

  logger.info(`🔄 ${contentType} ${contentId} отправлен на доработку`);
  return { success: true, content: updated };
}

/**
 * Скрыть контент (status → hidden).
 */
export async function hideContent(contentType, contentId, adminId) {
  const { table, idCol } = getTableMapping(contentType);
  const result = await pool.query(
    `UPDATE ${table}
     SET status = 'hidden', is_public = false,
         moderated_at = NOW(), moderated_by = $1, updated_at = NOW()
     WHERE ${idCol}::text = $2
     RETURNING *`,
    [adminId, String(contentId)],
  );
  if (result.rows.length === 0) throw new Error(`Контент ${contentType}:${contentId} не найден`);
  logger.info(`🙈 ${contentType} ${contentId} скрыт`);
  return { success: true, content: result.rows[0] };
}

/**
 * Создать локальный контент (из localStorage гостя) и сразу одобрить.
 */
export async function approveLocalContent(contentType, contentData, authorId, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let createdId;
    let tableName;

    switch (contentType) {
      case 'marker': {
        tableName = 'map_markers';
        const { title, description, latitude, longitude, category, hashtags, photoUrls, address } = contentData;
        const res = await client.query(
          `INSERT INTO map_markers
             (title, description, latitude, longitude, category, hashtags, photo_urls, address, creator_id, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',NOW(),NOW()) RETURNING id`,
          [title, description || null, latitude, longitude, category || 'other',
           Array.isArray(hashtags) ? hashtags : (hashtags ? hashtags.split(',').map(t => t.trim()) : []),
           Array.isArray(photoUrls) ? photoUrls : (photoUrls ? photoUrls.split(',').map(u => u.trim()) : []),
           address || null, authorId || adminId],
        );
        createdId = res.rows[0].id;
        break;
      }
      case 'post': {
        tableName = 'posts';
        const { title, body, route_id, marker_id, event_id, photo_urls } = contentData;
        const colsCheck = await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema='public' AND table_name='posts'
             AND column_name IN ('template','content_type','constructor_data','payload','photo_urls')`,
        );
        const availCols = new Set(colsCheck.rows.map(r => r.column_name));
        const columns = ['title','body','author_id','route_id','marker_id','event_id','status'];
        const values  = [title || null, body, authorId || adminId, route_id || null, marker_id || null, event_id || null, 'active'];
        if (availCols.has('photo_urls')) {
          columns.push('photo_urls');
          let photoStr = photo_urls
            ? (Array.isArray(photo_urls) ? photo_urls.filter(u => u?.trim()).join(',') : String(photo_urls).trim())
            : null;
          values.push(photoStr || null);
        }
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const res = await client.query(
          `INSERT INTO posts (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, NOW(), NOW()) RETURNING id`,
          values,
        );
        createdId = res.rows[0].id;
        break;
      }
      case 'event': {
        tableName = 'events';
        const d = contentData;
        const res = await client.query(
          `INSERT INTO events
             (title, description, start_datetime, end_datetime, location, category,
              photo_urls, cover_image_url, hashtags, is_public, organizer,
              latitude, longitude, creator_id, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',NOW(),NOW()) RETURNING id`,
          [d.title, d.description || null,
           d.start_datetime || new Date().toISOString(),
           d.end_datetime || new Date(Date.now() + 86400000).toISOString(),
           d.location || 'Место не указано', d.category || 'flights',
           Array.isArray(d.photo_urls) ? d.photo_urls : (d.photo_urls || []),
           d.cover_image_url || null,
           Array.isArray(d.hashtags) ? d.hashtags : (d.hashtags || []),
           d.is_public !== false, d.organizer || null,
           d.latitude || null, d.longitude || null, authorId || adminId],
        );
        createdId = res.rows[0].id;
        break;
      }
      default:
        throw new Error(`Неизвестный тип контента: ${contentType}`);
    }

    // Начисляем XP автору
    let xpResult = null;
    if (authorId) {
      const created = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [createdId]);
      if (created.rows[0]) {
        const xpType = contentType.endsWith('s') ? contentType : contentType + 's';
        try {
          xpResult = await awardXPForContent(authorId, xpType, String(createdId), created.rows[0], client);
        } catch (xpErr) {
          logger.error(`Ошибка XP при approve-local ${contentType}:`, xpErr);
        }
      }
    }

    await client.query('COMMIT');

    const final = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [createdId]);
    logger.info(`✅ Локальный ${contentType} создан и одобрён: id=${createdId}`);

    return { success: true, id: createdId, content: final.rows[0], xpResult };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Запустить ИИ-анализ для контента (асинхронно).
 */
export function triggerAIAnalysis(contentType, contentId, contentData) {
  autoAnalyzeContent(contentType, contentId, contentData)
    .then(() => logger.info(`✅ ИИ-анализ ${contentType} ${contentId} завершён`))
    .catch(err => logger.error(`❌ ИИ-анализ ${contentType} ${contentId} провалился:`, err));
}

/**
 * Получить статистику модерации по всем типам.
 */
export async function getModerationStats() {
  const stats = {
    events:   { pending: 0, active: 0, rejected: 0, hidden: 0 },
    posts:    { pending: 0, active: 0, rejected: 0, hidden: 0 },
    routes:   { pending: 0, active: 0, rejected: 0, hidden: 0 },
    markers:  { pending: 0, active: 0, rejected: 0, hidden: 0 },
    comments: { pending: 0, active: 0, rejected: 0, hidden: 0 },
    total:    { pending: 0, active: 0, rejected: 0, hidden: 0 },
  };

  const tables = {
    events: 'events', posts: 'posts', routes: 'travel_routes',
    markers: 'map_markers', comments: 'comments',
  };

  for (const [key, table] of Object.entries(tables)) {
    try {
      const res = await pool.query(`SELECT status, COUNT(*)::int as count FROM ${table} GROUP BY status`);
      for (const row of res.rows) {
        if (stats[key][row.status] !== undefined) {
          stats[key][row.status] = row.count;
          stats.total[row.status] += row.count;
        }
      }
    } catch { /* таблица может не существовать */ }
  }

  return stats;
}

