/**
 * Единый сервис модерации контента с интеграцией геймификации
 * 
 * При одобрении контента:
 * 1. Обновляет статус контента
 * 2. Начисляет XP автору
 * 3. Проверяет и выдает достижения
 * 4. Обновляет статистику пользователя
 */

import pool from '../../db.js';
import { calculateLevelFromTotalXP } from '../utils/xpCalculator.js';

/**
 * Типы контента и соответствующие источники XP
 */
const CONTENT_XP_SOURCES = {
  'events': 'event_created',
  'posts': 'post_created',
  'routes': 'route_created',
  'markers': 'marker_created',
  'comments': 'comment_created',
  'chats': 'chat_created'
};

/**
 * Базовые значения XP для разных типов контента
 */
const BASE_XP_VALUES = {
  'events': 50,
  'posts': 50,
  'routes': 100,
  'markers': 30,
  'comments': 10,
  'chats': 5
};

/**
 * Бонусы за качество контента
 */
const QUALITY_BONUSES = {
  hasPhoto: 25,
  hasDescription: 15,
  hasLocation: 20,
  hasTags: 10,
  isComplete: 30
};

/**
 * Одобрить контент и начислить награды
 */
export async function approveContent(contentType, contentId, adminId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Получаем информацию о контенте
    const content = await getContent(contentType, contentId, client);
    if (!content) {
      throw new Error(`Контент ${contentType}:${contentId} не найден`);
    }
    
    const authorId = content.creator_id || content.author_id;
    if (!authorId) {
      throw new Error('Не найден автор контента');
    }
    
    // 2. Обновляем статус контента на 'active'
    await updateContentStatus(contentType, contentId, 'active', adminId, null, client);
    
    // 3. Проверяем, не начисляли ли уже XP за этот контент
    const existingAction = await client.query(
      `SELECT id FROM gamification_actions 
       WHERE user_id = $1 AND source = $2 AND content_id = $3`,
      [authorId, CONTENT_XP_SOURCES[contentType], contentId]
    );
    
    if (existingAction.rows.length > 0) {
      // Уже начисляли, пропускаем
      await client.query('COMMIT');
      return {
        success: true,
        contentApproved: true,
        xpAwarded: false,
        reason: 'already_awarded'
      };
    }
    
    // 4. Рассчитываем XP на основе качества контента
    const xpAmount = calculateContentXP(contentType, content);
    
    // 5. Начисляем XP автору
    const xpResult = await awardXP(authorId, CONTENT_XP_SOURCES[contentType], xpAmount, contentId, contentType, content, client);
    
    // 6. Проверяем достижения
    const achievements = await checkAchievements(authorId, contentType, client);
    
    // 7. Обновляем статистику пользователя
    await updateUserStats(authorId, contentType, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      contentApproved: true,
      xpAwarded: true,
      xpAmount,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
      achievements: achievements.newAchievements,
      totalXP: xpResult.totalXP
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при одобрении контента:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Отклонить контент
 */
export async function rejectContent(contentType, contentId, adminId, reason) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Обновляем статус на 'rejected'
    await updateContentStatus(contentType, contentId, 'rejected', adminId, reason, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      contentRejected: true
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при отклонении контента:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получить контент из БД
 */
async function getContent(contentType, contentId, client) {
  let tableName, idColumn;
  
  switch (contentType) {
    case 'events':
      tableName = 'events';
      idColumn = 'id';
      break;
    case 'posts':
      tableName = 'posts';
      idColumn = 'id';
      break;
    case 'routes':
      tableName = 'travel_routes';
      idColumn = 'id';
      break;
    case 'markers':
      tableName = 'map_markers';
      idColumn = 'id';
      break;
    case 'blogs':
      tableName = 'blog_posts';
      idColumn = 'id';
      break;
    default:
      throw new Error(`Неизвестный тип контента: ${contentType}`);
  }
  
  const result = await client.query(
    `SELECT * FROM ${tableName} WHERE ${idColumn}::text = $1`,
    [contentId]
  );
  
  return result.rows[0] || null;
}

/**
 * Обновить статус контента
 */
async function updateContentStatus(contentType, contentId, status, adminId, reason, client) {
  let tableName, idColumn;
  
  switch (contentType) {
    case 'events':
      tableName = 'events';
      idColumn = 'id';
      break;
    case 'posts':
      tableName = 'posts';
      idColumn = 'id';
      break;
    case 'routes':
      tableName = 'travel_routes';
      idColumn = 'id';
      break;
    case 'markers':
      tableName = 'map_markers';
      idColumn = 'id';
      break;
    case 'blogs':
      tableName = 'blog_posts';
      idColumn = 'id';
      break;
    default:
      throw new Error(`Неизвестный тип контента: ${contentType}`);
  }
  
  // Проверяем наличие колонок
  const checkColumns = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 
      AND column_name IN ('status', 'moderation_reason', 'moderated_at', 'moderated_by')
  `, [tableName]);
  
  const hasStatus = checkColumns.rows.some(r => r.column_name === 'status');
  const hasReason = checkColumns.rows.some(r => r.column_name === 'moderation_reason');
  const hasModeratedAt = checkColumns.rows.some(r => r.column_name === 'moderated_at');
  const hasModeratedBy = checkColumns.rows.some(r => r.column_name === 'moderated_by');
  
  let query = `UPDATE ${tableName} SET `;
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  if (hasStatus) {
    updates.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  
  if (hasReason && reason) {
    updates.push(`moderation_reason = $${paramIndex++}`);
    values.push(reason);
  }
  
  if (hasModeratedAt) {
    updates.push(`moderated_at = NOW()`);
  }
  
  if (hasModeratedBy && adminId) {
    updates.push(`moderated_by = $${paramIndex++}`);
    values.push(adminId);
  }
  
  updates.push(`updated_at = NOW()`);
  
  query += updates.join(', ') + ` WHERE ${idColumn}::text = $${paramIndex}`;
  values.push(contentId);
  
  await client.query(query, values);
}

/**
 * Рассчитать XP на основе качества контента
 */
function calculateContentXP(contentType, content) {
  let baseXP = BASE_XP_VALUES[contentType] || 50;
  let bonusXP = 0;
  
  // Проверяем наличие фото
  if (content.photo_urls || content.cover_image_url || content.image_url) {
    bonusXP += QUALITY_BONUSES.hasPhoto;
  }
  
  // Проверяем наличие описания
  if (content.description || content.body || content.content) {
    const desc = content.description || content.body || content.content || '';
    if (desc.length > 50) {
      bonusXP += QUALITY_BONUSES.hasDescription;
    }
  }
  
  // Проверяем наличие локации
  if (content.location || content.address || (content.latitude && content.longitude)) {
    bonusXP += QUALITY_BONUSES.hasLocation;
  }
  
  // Проверяем наличие тегов
  if (content.hashtags || content.tags) {
    const tags = Array.isArray(content.hashtags || content.tags) 
      ? content.hashtags || content.tags 
      : (content.hashtags || content.tags || '').split(',').filter(Boolean);
    if (tags.length > 0) {
      bonusXP += QUALITY_BONUSES.hasTags;
    }
  }
  
  // Бонус за полноту (для событий и маршрутов)
  if (contentType === 'events' || contentType === 'routes') {
    const completeness = calculateCompleteness(contentType, content);
    if (completeness > 0.8) {
      bonusXP += QUALITY_BONUSES.isComplete;
    }
  }
  
  return baseXP + bonusXP;
}

/**
 * Рассчитать полноту контента (0-1)
 */
function calculateCompleteness(contentType, content) {
  let score = 0;
  let maxScore = 0;
  
  // Базовые поля
  maxScore += 2;
  if (content.title) score += 1;
  if (content.description || content.body) score += 1;
  
  // Фото
  maxScore += 1;
  if (content.photo_urls || content.cover_image_url) score += 1;
  
  // Локация
  maxScore += 1;
  if (content.location || (content.latitude && content.longitude)) score += 1;
  
  // Специфичные поля
  if (contentType === 'events') {
    maxScore += 1;
    if (content.start_datetime) score += 1;
  }
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Начислить XP пользователю
 */
async function awardXP(userId, source, amount, contentId, contentType, content, client) {
  // Получаем текущий уровень
  let levelResult = await client.query(
    'SELECT * FROM user_levels WHERE user_id = $1',
    [userId]
  );
  
  if (levelResult.rows.length === 0) {
    // Создаём начальный уровень
    await client.query(
      `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
       VALUES ($1, 0, 1, 0, 100, 'novice')`,
      [userId]
    );
    
    levelResult = await client.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );
  }
  
  const currentLevel = levelResult.rows[0];
  const newTotalXP = currentLevel.total_xp + amount;
  
  // Рассчитываем новый уровень
  const newLevelData = calculateLevelFromTotalXP(newTotalXP);
  
  // Обновляем уровень пользователя
  await client.query(
    `UPDATE user_levels 
     SET total_xp = $1, 
         current_level = $2, 
         current_level_xp = $3, 
         required_xp = $4,
         rank = $5,
         updated_at = NOW()
     WHERE user_id = $6`,
    [
      newTotalXP,
      newLevelData.level,
      newLevelData.currentLevelXP,
      newLevelData.requiredXP,
      newLevelData.rank,
      userId
    ]
  );
  
  // Записываем действие
  await client.query(
    `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      userId,
      source,
      amount,
      contentId,
      contentType,
      JSON.stringify({ 
        title: content.title,
        hasPhoto: !!(content.photo_urls || content.cover_image_url),
        completeness: calculateCompleteness(contentType, content)
      })
    ]
  );
  
  return {
    totalXP: newTotalXP,
    newLevel: newLevelData.level,
    levelUp: newLevelData.level > currentLevel.current_level,
    currentLevelXP: newLevelData.currentLevelXP,
    requiredXP: newLevelData.requiredXP
  };
}

/**
 * Проверить достижения
 */
async function checkAchievements(userId, contentType, client) {
  // TODO: Реализовать проверку достижений
  // Например: "Создал 10 постов", "Создал 5 событий" и т.д.
  return {
    newAchievements: []
  };
}

/**
 * Обновить статистику пользователя
 */
async function updateUserStats(userId, contentType, client) {
  // TODO: Обновить счетчики контента пользователя
  // Например: posts_count, events_count и т.д.
}

export default {
  approveContent,
  rejectContent
};

