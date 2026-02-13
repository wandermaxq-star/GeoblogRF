import express from 'express';
import pool from '../../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getPendingContent,
  approveContent,
  rejectContent,
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original:   hideContent,
  getModerationStats
} from '../controllers/moderationController.js';
import {
  getContentForReview,
  analyzeContent,
  setAdminVerdict,
  getAIStats,
  getModerationCounts
} from '../controllers/aiModerationController.js';
import {
  getModerationHistory,
  getContentDetails
} from '../controllers/moderationHistoryController.js';
import {
  getModerationTasks,
  getModerationTasksCount
} from '../controllers/moderationTasksController.js';
import { getRejectionReasons } from '../config/rejectionReasons.js';
import logger from '../../logger.js';

const router = express.Router();

// Все маршруты требуют авторизации и роли admin
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ===== ИИ-МОДЕРАЦИЯ (полуавтоматическая) =====
// Получить контент для проверки (ИИ уже проанализировал)
router.get('/ai/:contentType/review', getContentForReview);

// ИИ анализирует контент и создает предложение
router.post('/ai/:contentType/:contentId/analyze', analyzeContent);

// Админ ставит вердикт (правильно/неправильно)
router.post('/ai/decisions/:decisionId/verdict', setAdminVerdict);

// Статистика работы ИИ
router.get('/ai/stats', getAIStats);

// Счётчики модерации по типам контента и состояниям
router.get('/ai/counts', getModerationCounts);

// ===== РУЧНАЯ МОДЕРАЦИЯ (для сравнения/переопределения) =====
// Получить статистику модерации
router.get('/stats', getModerationStats);

// Получить список типовых причин отклонения
router.get('/rejection-reasons', (req, res) => {
  res.json(getRejectionReasons());
});

// ===== ЗАДАЧИ МОДЕРАЦИИ (для страниц контента) =====
// Получить задачи модерации для конкретной страницы
router.get('/tasks/:contentType', getModerationTasks);
// Получить количество задач модерации
router.get('/tasks-count', getModerationTasksCount);

// ===== ИСТОРИЯ МОДЕРАЦИИ (должны быть ДО параметрических роутов) =====
// Получить историю модерации (все посты с любым статусом)
router.get('/history/:contentType', getModerationHistory);

// Получить детальную информацию о контенте с рекомендациями ИИ
router.get('/:contentType/:contentId/details', getContentDetails);

// Получить контент на модерации по типу
router.get('/:contentType/pending', getPendingContent);

// Одобрить контент
router.post('/:contentType/:id/approve', approveContent);

// Отклонить контент
router.post('/:contentType/:id/reject', rejectContent);

// Отправить на доработку
router.post('/:contentType/:id/revision', async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.user?.userId;

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tableName, idColumn;
    switch (contentType) {
      case 'posts':
        tableName = 'posts';
        idColumn = 'id';
        break;
      case 'events':
        tableName = 'events';
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
      case 'comments':
        tableName = 'comments';
        idColumn = 'id';
        break;
      default:
        return res.status(400).json({ message: 'Неизвестный тип контента.' });
    }

      await pool.query(`
      UPDATE ${tableName} 
      SET status = 'revision',
          moderation_reason = $1,
          moderated_at = NOW(),
          moderated_by = $2,
          updated_at = NOW()
      WHERE ${idColumn}::text = $3
    `, [reason || 'Отправлено на доработку', userId, id]);

    res.json({ message: 'Контент отправлен на доработку.' });
  } catch (error) {
    console.error('Ошибка отправки на доработку:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
});

// ===== ОДОБРЕНИЕ ЛОКАЛЬНОГО КОНТЕНТА (из localStorage) =====
router.post('/approve-local', async (req, res) => {
  try {
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original:     const { content_type, local_id, content_data, author_id } = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!content_type || !content_data) {
      return res.status(400).json({ message: 'Не указан тип контента или данные контента.' });
    }

// SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1481): original:     let tableName, insertQuery, insertParams;
    let createdId;

    switch (content_type) {
      case 'marker': {
        tableName = 'map_markers';
        const { title, description, latitude, longitude, category, hashtags, photoUrls, address } = content_data;
        
        const result = await pool.query(`
          INSERT INTO map_markers (
            title, description, latitude, longitude, category, 
            hashtags, photo_urls, address, creator_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), NOW())
          RETURNING id
        `, [
          title,
          description || null,
          latitude,
          longitude,
          category || 'other',
          Array.isArray(hashtags) ? hashtags : (hashtags ? hashtags.split(',').map(t => t.trim()) : []),
          Array.isArray(photoUrls) ? photoUrls : (photoUrls ? photoUrls.split(',').map(u => u.trim()) : []),
          address || null,
          author_id || userId
        ]);
        createdId = result.rows[0].id;

        // Начисляем очки за создание метки через правильную систему геймификации
        if (author_id) {
          try {
            // Проверяем, не начисляли ли уже XP за этот контент
            const existingAction = await pool.query(
              `SELECT id FROM gamification_actions 
               WHERE user_id = $1 AND source = $2 AND content_id = $3`,
              [author_id, 'marker_created', createdId]
            );

            if (existingAction.rows.length === 0) {
              // Рассчитываем XP
              const baseXP = 30;
              let bonusXP = 0;
              
              const hasPhoto = !!(photoUrls && (Array.isArray(photoUrls) ? photoUrls.length > 0 : photoUrls));
              const hasDescription = !!description;
              const hasLocation = !!(latitude && longitude);
              const hasTags = !!(hashtags && (Array.isArray(hashtags) ? hashtags.length > 0 : hashtags));
              
              if (hasPhoto) bonusXP += 25;
              if (hasDescription) bonusXP += 15;
              if (hasLocation) bonusXP += 20;
              if (hasTags) bonusXP += 10;
              
              const totalXP = baseXP + bonusXP;

              // Получаем/создаём уровень пользователя
              let levelResult = await pool.query(
                'SELECT * FROM user_levels WHERE user_id = $1',
                [author_id]
              );

              if (levelResult.rows.length === 0) {
                await pool.query(
                  `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
                   VALUES ($1, 0, 1, 0, 100, 'novice')`,
                  [author_id]
                );
                levelResult = await pool.query(
                  'SELECT * FROM user_levels WHERE user_id = $1',
                  [author_id]
                );
              }

              const currentLevel = levelResult.rows[0];
              const newTotalXP = currentLevel.total_xp + totalXP;

              // Рассчитываем новый уровень
              const { calculateLevelFromTotalXP } = await import('../utils/xpCalculator.js');
              const newLevelData = calculateLevelFromTotalXP(newTotalXP);

              // Обновляем уровень пользователя
              await pool.query(
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
                  author_id
                ]
              );

              // Записываем в историю XP
              await pool.query(
                `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  author_id,
                  'marker_created',
                  totalXP,
                  createdId,
                  'marker',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    hasDescription,
                    hasLocation,
                    hasTags,
                    moderated: true,
                    baseXP,
                    bonusXP
                  })
                ]
              );

              // Записываем действие для проверки уникальности
              await pool.query(
                `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id, source, content_id) DO NOTHING`,
                [
                  author_id,
                  'marker_created',
                  totalXP,
                  createdId,
                  'marker',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    hasDescription,
                    moderated: true
                  })
                ]
              );

              logger.info(`💰 XP начислено автору ${author_id} за метку ${createdId}: ${totalXP} XP (уровень: ${newLevelData.level})`);
            }
          } catch (xpError) {
            console.error('Ошибка начисления очков за метку:', xpError);
          }
        }
        break;
      }
      case 'post': {
        tableName = 'posts';
        const { title, body, route_id, marker_id, event_id, photo_urls, template, content_type: postContentType, constructor_data, payload } = content_data;
        
        // Проверяем наличие колонок в таблице
        let checkColumns;
        try {
          checkColumns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'posts' 
              AND column_name IN ('template', 'content_type', 'constructor_data', 'payload', 'photo_urls')
          `);
        } catch (checkError) {
          console.error('❌ Ошибка проверки колонок:', checkError);
          // Если проверка не удалась, предполагаем, что колонок нет
          checkColumns = { rows: [] };
        }
        
        const availableColumns = checkColumns.rows.map(r => r.column_name.toLowerCase());
        // СТРОГАЯ проверка: проверяем точное совпадение (без учета регистра)
        const hasTemplate = availableColumns.some(col => col === 'template');
        const hasContentType = availableColumns.some(col => col === 'content_type');
        const hasConstructorData = availableColumns.some(col => col === 'constructor_data');
        const hasPayload = availableColumns.some(col => col === 'payload');
        const hasPhotoUrls = availableColumns.some(col => col === 'photo_urls');
        
        logger.info('📊 Проверка колонок posts:', {
          hasTemplate,
          hasContentType,
          hasConstructorData,
          hasPayload,
          hasPhotoUrls,
          availableColumns: availableColumns,
          allColumns: checkColumns.rows.map(r => r.column_name),
          checkRowsCount: checkColumns.rows.length
        });
        
        // ПРИНУДИТЕЛЬНО: если template не найден в БД, НЕ добавляем его
        if (hasTemplate) {
          logger.info('✅ Колонка template найдена в БД, добавляем в запрос');
        } else {
          logger.info('⚠️ Колонка template НЕ найдена в БД, НЕ добавляем в запрос');
        }
        
        // Формируем список колонок и значений динамически
        const columns = ['title', 'body', 'author_id', 'route_id', 'marker_id', 'event_id', 'status'];
        const values = [title || null, body, author_id || userId, route_id || null, marker_id || null, event_id || null, 'active'];
        
        if (hasPhotoUrls) {
          columns.push('photo_urls');
          // Преобразуем photo_urls в строку через запятую для сохранения в БД
          let photoUrlsString = null;
          if (photo_urls) {
            if (Array.isArray(photo_urls)) {
              photoUrlsString = photo_urls.filter(url => url && url.trim()).join(',');
            } else if (typeof photo_urls === 'string') {
              photoUrlsString = photo_urls.trim();
            }
          }
          values.push(photoUrlsString || null);
          logger.info('📸 photo_urls для сохранения:', photoUrlsString ? `${photoUrlsString.substring(0, 100)}...` : 'null');
        }
        
        // ВАЖНО: добавляем template ТОЛЬКО если hasTemplate === true
        if (hasTemplate === true) {
          columns.push('template');
          values.push(template || 'mobile');
          logger.info('✅ template добавлен в запрос');
        } else {
          logger.info('⚠️ template НЕ добавлен в запрос (колонки нет в БД)');
        }
        
        if (hasContentType) {
          columns.push('content_type');
          values.push(postContentType || 'post');
        }
        
        if (hasConstructorData) {
          columns.push('constructor_data');
          values.push(constructor_data ? JSON.stringify(constructor_data) : null);
        }
        
        if (hasPayload) {
          columns.push('payload');
          values.push(payload ? JSON.stringify(payload) : null);
        }
        
        // Добавляем created_at и updated_at как SQL функции
        columns.push('created_at', 'updated_at');
        
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ') + ', NOW(), NOW()';
        
        // Финальная проверка: убеждаемся, что template не в списке, если колонки нет
        if (!hasTemplate && columns.includes('template')) {
          console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: template в списке колонок, но hasTemplate = false!');
          const templateIndex = columns.indexOf('template');
          if (templateIndex !== -1) {
            columns.splice(templateIndex, 1);
            values.splice(templateIndex, 1);
            logger.info('✅ template удален из списка колонок');
          }
        }
        
        logger.info('📝 INSERT запрос для posts:', {
          columns: columns.join(', '),
          placeholders,
          valuesCount: values.length,
          columnsCount: columns.length,
          hasTemplate,
          templateInColumns: columns.includes('template')
        });
        
        // Проверяем, что количество колонок и значений совпадает (без учета NOW())
        const nowCount = 2; // created_at, updated_at
        if (columns.length !== values.length + nowCount) {
          console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Несоответствие количества колонок и значений!', {
            columnsCount: columns.length,
            valuesCount: values.length,
            nowCount,
            expected: values.length + nowCount
          });
          throw new Error(`Несоответствие количества колонок (${columns.length}) и значений (${values.length + nowCount})`);
        }
        
        const result = await pool.query(`
          INSERT INTO posts (${columns.join(', ')})
          VALUES (${placeholders})
          RETURNING id
        `, values);
        
        createdId = result.rows[0].id;

        // Начисляем очки за создание поста через правильную систему геймификации
        if (author_id) {
          try {
            // Проверяем, не начисляли ли уже XP за этот контент
            const existingAction = await pool.query(
              `SELECT id FROM gamification_actions 
               WHERE user_id = $1 AND source = $2 AND content_id = $3`,
              [author_id, 'post_created', createdId]
            );

            if (existingAction.rows.length === 0) {
              // Рассчитываем XP
              const baseXP = 50;
              let bonusXP = 0;
              
              const hasPhoto = !!(photo_urls && (Array.isArray(photo_urls) ? photo_urls.length > 0 : photo_urls));
              const hasMarker = !!marker_id;
              const hasDescription = !!(body && body.length > 50);
              
              if (hasPhoto) bonusXP += 25;
              if (hasDescription) bonusXP += 15;
              if (hasMarker) bonusXP += 20;
              
              const totalXP = baseXP + bonusXP;

              // Получаем/создаём уровень пользователя
              let levelResult = await pool.query(
                'SELECT * FROM user_levels WHERE user_id = $1',
                [author_id]
              );

              if (levelResult.rows.length === 0) {
                await pool.query(
                  `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
                   VALUES ($1, 0, 1, 0, 100, 'novice')`,
                  [author_id]
                );
                levelResult = await pool.query(
                  'SELECT * FROM user_levels WHERE user_id = $1',
                  [author_id]
                );
              }

              const currentLevel = levelResult.rows[0];
              const newTotalXP = currentLevel.total_xp + totalXP;

              // Рассчитываем новый уровень
              const { calculateLevelFromTotalXP } = await import('../utils/xpCalculator.js');
              const newLevelData = calculateLevelFromTotalXP(newTotalXP);

              // Обновляем уровень пользователя
              await pool.query(
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
                  author_id
                ]
              );

              // Записываем в историю XP
              await pool.query(
                `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  author_id,
                  'post_created',
                  totalXP,
                  createdId,
                  'post',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    hasMarker,
                    hasDescription,
                    moderated: true,
                    baseXP,
                    bonusXP
                  })
                ]
              );

              // Записываем действие для проверки уникальности
              await pool.query(
                `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id, source, content_id) DO NOTHING`,
                [
                  author_id,
                  'post_created',
                  totalXP,
                  createdId,
                  'post',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    hasMarker,
                    moderated: true
                  })
                ]
              );

              logger.info(`💰 XP начислено автору ${author_id} за пост ${createdId}: ${totalXP} XP (уровень: ${newLevelData.level})`);
            }
          } catch (xpError) {
            console.error('Ошибка начисления очков за пост:', xpError);
          }
        }
        break;
      }
      case 'event': {
        tableName = 'events';
        const { title, description, start_datetime, end_datetime, location, category, photo_urls, cover_image_url, hashtags, is_public, organizer, latitude, longitude } = content_data;
        
        const result = await pool.query(`
          INSERT INTO events (
            title, description, start_datetime, end_datetime, location, category,
            photo_urls, cover_image_url, hashtags, is_public, organizer, latitude, longitude,
            creator_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', NOW(), NOW())
          RETURNING id
        `, [
          title,
          description || null,
          start_datetime || new Date().toISOString(),
          end_datetime || new Date(Date.now() + 24*60*60*1000).toISOString(),
          location || 'Место не указано',
          category || 'flights',
          Array.isArray(photo_urls) ? photo_urls : (photo_urls || []),
          cover_image_url || null,
          Array.isArray(hashtags) ? hashtags : (hashtags || []),
          is_public !== false,
          organizer || null,
          latitude || null,
          longitude || null,
          author_id || userId
        ]);
        createdId = result.rows[0].id;

        // Начисляем очки за создание события через правильную систему геймификации
        if (author_id) {
          try {
            // Проверяем, не начисляли ли уже XP за этот контент
            const existingAction = await pool.query(
              `SELECT id FROM gamification_actions 
               WHERE user_id = $1 AND source = $2 AND content_id = $3`,
              [author_id, 'event_created', createdId]
            );

            if (existingAction.rows.length === 0) {
              // Рассчитываем XP
              const baseXP = 50;
              let bonusXP = 0;
              
              const hasPhoto = !!(photo_urls && (Array.isArray(photo_urls) ? photo_urls.length > 0 : photo_urls)) || !!cover_image_url;
              const hasDescription = !!(description && description.length > 50);
              const hasLocation = !!(location || (latitude && longitude));
              const hasTags = !!(hashtags && (Array.isArray(hashtags) ? hashtags.length > 0 : hashtags));
              
              if (hasPhoto) bonusXP += 25;
              if (hasDescription) bonusXP += 15;
              if (hasLocation) bonusXP += 20;
              if (hasTags) bonusXP += 10;
              
              const totalXP = baseXP + bonusXP;

              // Получаем/создаём уровень пользователя
              let levelResult = await pool.query(
                'SELECT * FROM user_levels WHERE user_id = $1',
                [author_id]
              );

              if (levelResult.rows.length === 0) {
                await pool.query(
                  `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
                   VALUES ($1, 0, 1, 0, 100, 'novice')`,
                  [author_id]
                );
                levelResult = await pool.query(
                  'SELECT * FROM user_levels WHERE user_id = $1',
                  [author_id]
                );
              }

              const currentLevel = levelResult.rows[0];
              const newTotalXP = currentLevel.total_xp + totalXP;

              // Рассчитываем новый уровень
              const { calculateLevelFromTotalXP } = await import('../utils/xpCalculator.js');
              const newLevelData = calculateLevelFromTotalXP(newTotalXP);

              // Обновляем уровень пользователя
              await pool.query(
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
                  author_id
                ]
              );

              // Записываем в историю XP
              await pool.query(
                `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  author_id,
                  'event_created',
                  totalXP,
                  createdId,
                  'event',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    hasDescription,
                    hasLocation,
                    hasTags,
                    moderated: true,
                    baseXP,
                    bonusXP
                  })
                ]
              );

              // Записываем действие для проверки уникальности
              await pool.query(
                `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (user_id, source, content_id) DO NOTHING`,
                [
                  author_id,
                  'event_created',
                  totalXP,
                  createdId,
                  'event',
                  JSON.stringify({
                    title: title,
                    hasPhoto,
                    moderated: true
                  })
                ]
              );

              logger.info(`💰 XP начислено автору ${author_id} за событие ${createdId}: ${totalXP} XP (уровень: ${newLevelData.level})`);
            }
          } catch (xpError) {
            console.error('Ошибка начисления очков за событие:', xpError);
          }
        }
        break;
      }
      default:
        return res.status(400).json({ message: 'Неизвестный тип контента для одобрения.' });
    }

    // Получаем созданный контент
    const createdContent = await pool.query(`
      SELECT * FROM ${tableName} WHERE id = $1
    `, [createdId]);

    if (createdContent.rows.length === 0) {
      console.error(`❌ Ошибка: контент ${content_type} с ID ${createdId} не найден после создания!`);
      return res.status(500).json({ 
        message: 'Контент создан, но не найден в базе данных.',
        id: createdId
      });
    }

    logger.info(`✅ Контент ${content_type} создан в БД:`, {
      id: createdId,
      title: createdContent.rows[0].title || createdContent.rows[0].name,
      status: createdContent.rows[0].status,
      author_id: createdContent.rows[0].author_id || createdContent.rows[0].creator_id
    });

    res.json({
      message: 'Контент одобрен и опубликован.',
      content: createdContent.rows[0],
      id: createdId,
      success: true
    });
  } catch (error) {
    console.error('Ошибка одобрения локального контента:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
});

export default router;



