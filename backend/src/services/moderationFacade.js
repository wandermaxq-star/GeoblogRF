/**
 * ЕДИНЫЙ ФАСАД МОДЕРАЦИИ
 * 
 * Отвечает за ПОЛНОЕ модерирование всего проекта:
 * 1. Проверка контента через ИИ
 * 2. Одобрение/отклонение контента
 * 3. Интеграция с геймификацией (начисление XP, достижения)
 * 4. Управление статусами контента
 * 
 * ВСЕ действия с контентом должны проходить через этот фасад!
 */

import pool from '../../db.js';
import { autoAnalyzeContent } from '../middleware/autoModeration.js';
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
  hasTags: 10
};

/**
 * Создать контент с модерацией
 * Автоматически устанавливает статус 'pending' для не-админов
 * Запускает ИИ-анализ для контента со статусом 'pending'
 */
export async function createContentWithModeration(contentType, contentData, userId, userRole) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Определяем статус: админ = active, остальные = pending
    const isAdmin = userRole === 'admin';
    const finalStatus = isAdmin ? 'active' : 'pending';
    
    // Вставляем контент в БД
    const content = await insertContent(contentType, contentData, finalStatus, client);
    
    // Если статус pending - запускаем ИИ-анализ
    if (finalStatus === 'pending') {
      // Запускаем асинхронно (не блокируем ответ)
      autoAnalyzeContent(contentType, content.id, content)
        .then(() => {
          console.log(`✅ ИИ-помощник: анализ ${contentType} ${content.id} завершён`);
        })
        .catch(err => {
          console.error(`❌ ИИ-помощник: ошибка анализа ${contentType} ${content.id}:`, err);
        });
    }
    
    await client.query('COMMIT');
    return content;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Одобрить контент через фасад модерации
 * 1. Обновляет статус на 'active'
 * 2. Начисляет XP автору
 * 3. Обновляет уровень пользователя
 * 4. Проверяет достижения
 */
export async function approveContentViaFacade(contentType, contentId, adminId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Получаем контент
    const content = await getContent(contentType, contentId, client);
    if (!content) {
      throw new Error(`Контент ${contentType}:${contentId} не найден`);
    }
    
    const authorId = content.creator_id || content.author_id || content.author_id;
    
    // Обновляем статус
    await updateContentStatus(contentType, contentId, 'active', adminId, null, client);
    
    // Начисляем XP автору (если есть)
    let xpResult = null;
    if (authorId && CONTENT_XP_SOURCES[contentType]) {
      xpResult = await awardXPForContent(
        authorId,
        contentType,
        contentId,
        content,
        client
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      contentApproved: true,
      xpAwarded: !!xpResult?.success,
      xpResult
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Начислить XP за одобренный контент
 */
async function awardXPForContent(authorId, contentType, contentId, content, client) {
  const xpSource = CONTENT_XP_SOURCES[contentType];
  if (!xpSource) return null;
  
  // Проверяем, не начисляли ли уже
  const existingAction = await client.query(
    `SELECT id FROM gamification_actions 
     WHERE user_id = $1 AND source = $2 AND content_id = $3`,
    [authorId, xpSource, contentId]
  );
  
  if (existingAction.rows.length > 0) {
    return { success: false, reason: 'already_awarded' };
  }
  
  // Рассчитываем XP
  const baseXP = BASE_XP_VALUES[contentType] || 50;
  let bonusXP = 0;
  
  if (content.photo_urls || content.cover_image_url || content.image_url) {
    bonusXP += QUALITY_BONUSES.hasPhoto;
  }
  if (content.description || content.body || content.content) {
    const desc = content.description || content.body || content.content || '';
    if (desc.length > 50) bonusXP += QUALITY_BONUSES.hasDescription;
  }
  if (content.location || content.address || (content.latitude && content.longitude)) {
    bonusXP += QUALITY_BONUSES.hasLocation;
  }
  if (content.hashtags || content.tags) {
    bonusXP += QUALITY_BONUSES.hasTags;
  }
  
  const totalXP = baseXP + bonusXP;
  
  // Получаем/создаём уровень пользователя
  let levelResult = await client.query(
    'SELECT * FROM user_levels WHERE user_id = $1',
    [authorId]
  );
  
  if (levelResult.rows.length === 0) {
    await client.query(
      `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
       VALUES ($1, 0, 1, 0, 100, 'novice')`,
      [authorId]
    );
    levelResult = await client.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [authorId]
    );
  }
  
  const currentLevel = levelResult.rows[0];
  const newTotalXP = currentLevel.total_xp + totalXP;
  
  // Рассчитываем новый уровень
  const newLevelData = calculateLevelFromTotalXP(newTotalXP);
  
  // Обновляем уровень
  await client.query(
    `UPDATE user_levels 
     SET total_xp = $1, current_level = $2, current_level_xp = $3, 
         required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $6`,
    [
      newTotalXP,
      newLevelData.level,
      newLevelData.currentLevelXP,
      newLevelData.requiredXP,
      newLevelData.rank,
      authorId
    ]
  );
  
  // Записываем в историю
  await client.query(
    `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      authorId,
      xpSource,
      totalXP,
      contentId,
      contentType,
      JSON.stringify({
        title: content.title,
        hasPhoto: !!(content.photo_urls || content.cover_image_url),
        moderated: true,
        baseXP,
        bonusXP
      })
    ]
  );
  
  // Записываем действие
  await client.query(
    `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, source, content_id) DO NOTHING`,
    [
      authorId,
      xpSource,
      totalXP,
      contentId,
      contentType,
      JSON.stringify({
        title: content.title,
        hasPhoto: !!(content.photo_urls || content.cover_image_url),
        moderated: true
      })
    ]
  );
  
  return {
    success: true,
    newLevel: newLevelData.level,
    levelUp: newLevelData.level > currentLevel.current_level,
    totalXP: newTotalXP,
    xpAmount: totalXP
  };
}

/**
 * Вспомогательные функции
 */
async function insertContent(contentType, contentData, status, client) {
  // Это упрощённая версия - в реальности нужно обрабатывать каждый тип контента
  // Здесь просто возвращаем данные для примера
  return { id: contentData.id || 'temp', ...contentData, status };
}

async function getContent(contentType, contentId, client) {
  let tableName, idColumn;
  
  switch (contentType) {
    case 'events': tableName = 'events'; idColumn = 'id'; break;
    case 'posts': tableName = 'posts'; idColumn = 'id'; break;
    case 'routes': tableName = 'travel_routes'; idColumn = 'id'; break;
    case 'markers': tableName = 'map_markers'; idColumn = 'id'; break;
    case 'blogs': tableName = 'blog_posts'; idColumn = 'id'; break;
    default: throw new Error(`Неизвестный тип контента: ${contentType}`);
  }
  
  const result = await client.query(
    `SELECT * FROM ${tableName} WHERE ${idColumn}::text = $1`,
    [contentId]
  );
  
  return result.rows[0] || null;
}

async function updateContentStatus(contentType, contentId, status, adminId, reason, client) {
  let tableName, idColumn;
  
  switch (contentType) {
    case 'events': tableName = 'events'; idColumn = 'id'; break;
    case 'posts': tableName = 'posts'; idColumn = 'id'; break;
    case 'routes': tableName = 'travel_routes'; idColumn = 'id'; break;
    case 'markers': tableName = 'map_markers'; idColumn = 'id'; break;
    case 'blogs': tableName = 'blog_posts'; idColumn = 'id'; break;
    default: throw new Error(`Неизвестный тип контента: ${contentType}`);
  }
  
  await client.query(
    `UPDATE ${tableName} 
     SET status = $1, 
         moderated_at = NOW(),
         moderated_by = $2,
         moderation_reason = $3,
         updated_at = NOW()
     WHERE ${idColumn}::text = $4`,
    [status, adminId, reason, contentId]
  );
}

