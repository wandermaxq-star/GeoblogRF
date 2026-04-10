import pool from '../../db.js';
import ModerationService from '../services/moderationService.js';
import logger from '../../logger.js';

/**
 * Контроллер для полуавтоматической модерации с ИИ-помощником
 * ИИ анализирует контент и предлагает решение, админ ставит вердикт
 */

// Получить контент, который нужно проверить (ИИ уже проанализировал)
export const getContentForReview = async (req, res) => {
  try {
    const { contentType } = req.params;
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    // Получаем контент на модерации с решениями ИИ
    const { status = 'pending' } = req.query; // Параметр для фильтрации по статусу
    
    let contentTable, idColumn;
    switch (contentType) {
      case 'events':
        contentTable = 'events';
        idColumn = 'id';
        break;
      case 'posts':
        contentTable = 'posts';
        idColumn = 'id';
        break;
      case 'routes':
        contentTable = 'travel_routes';
        idColumn = 'id';
        break;
      case 'markers':
        contentTable = 'map_markers';
        idColumn = 'id';
        break;
      case 'comments':
        contentTable = 'comments';
        idColumn = 'id';
        break;
      case 'complaints':
      case 'suggestions':
        // Для жалоб и предложений пока используем общую логику
        // В будущем можно добавить отдельные таблицы
        return res.status(400).json({ message: 'Тип контента пока не поддерживается.' });
      default:
        return res.status(400).json({ message: 'Неизвестный тип контента.' });
    }

    // Определяем фильтры в зависимости от статуса
    let statusFilter = '';
    let verdictFilter = '';

    if (status === 'pending') {
      statusFilter = "AND c.status = 'pending'";
      verdictFilter = "AND amd.admin_verdict = 'pending'";
    } else if (status === 'approved') {
      statusFilter = "AND c.status = 'active'";
      verdictFilter = "AND amd.admin_verdict = 'correct'";
    } else if (status === 'rejected') {
      statusFilter = "AND c.status = 'rejected'";
      verdictFilter = "AND amd.admin_verdict = 'incorrect'";
    } else if (status === 'revision') {
      statusFilter = "AND (c.status = 'revision' OR c.status = 'pending_revision')";
      verdictFilter = ""; // Для доработки может быть любой вердикт
    }

    const result = await pool.query(`
      SELECT 
        amd.*,
        row_to_json(c.*) as content_data
      FROM ai_moderation_decisions amd
      INNER JOIN ${contentTable} c ON c.${idColumn}::text = amd.content_id
      WHERE amd.content_type = $1 
        ${verdictFilter}
        ${statusFilter}
      ORDER BY amd.created_at DESC
      LIMIT 50
    `, [contentType]);

    logger.info(`🔍 ИИ-помощник: найдено ${result.rows.length} записей для ${contentType} со статусом '${status}'`);

    // Логируем детали для диагностики
    if (result.rows.length > 0) {
      result.rows.forEach((row, idx) => {
        const content = row.content_data || {};
        logger.info(`  ${idx + 1}. Post ID: ${row.content_id}, Title: ${content.title || 'нет'}, AI: ${row.ai_suggestion}, Confidence: ${Math.round(row.ai_confidence * 100)}%`);
      });
    } else {
      logger.info(`  ⚠️ Нет постов для модерации. Проверьте, что есть посты со status='pending' и записи в ai_moderation_decisions с admin_verdict='pending'`);
    }

    res.json(result.rows);
  } catch (error) {
    logger.error('Ошибка получения контента для проверки:', { error });
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

// ИИ анализирует контент и создает предложение
export const analyzeContent = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;

    // Проверяем, это локальный контент (из фронтенда) или из БД
    const isLocalContent = contentId.startsWith('pending_') || contentId.includes(':');
    
    if (isLocalContent) {
      // Локальный контент: берем данные из body или используем дефолтный анализ
      console.log(`📝 Локальный контент: ${contentType}/${contentId}`);
      
      const textContent = req.body?.content_text || 
                         (req.body?.content_data?.title || '') + ' ' + 
                         (req.body?.content_data?.body || '') +
                         (req.body?.content_data?.description || '');

      // Используем ModerationService для анализа текста из фронтенда
      const moderationResult = await ModerationService.moderateContent({
        text: textContent.trim(),
        type: 'post',
        userId: req.user?.id || 'unknown',
        location: req.body?.location,
        timestamp: new Date()
      });

      const aiSuggestion = 
        moderationResult.action === 'hide' || moderationResult.action === 'block' ? 'reject' :
        moderationResult.action === 'review' ? 'review' : 'approve';

      const aiReason = moderationResult.detailedReason || 
                       (moderationResult.issues?.length > 0 
                         ? moderationResult.issues.join('; ') 
                         : 'Контент проверен');

      console.log(`✅ Локальный анализ завершён: ${aiSuggestion}`);

      return res.json({
        decision: {
          id: `temp_${Date.now()}`,
          content_type: contentType,
          content_id: contentId,
          ai_suggestion: aiSuggestion,
          ai_confidence: moderationResult.confidence,
          ai_reason: aiReason,
          ai_category: moderationResult.category,
          ai_issues: moderationResult.issues || [],
          admin_verdict: 'pending',
        },
        moderationResult,
        status: 'success',
      });
    }

    // Контент из БД: получаем из базы
    let content;
    let contentText = '';
    let contentData = null;

    switch (contentType) {
      case 'events':
        const eventResult = await pool.query('SELECT * FROM events WHERE id::text = $1', [contentId]);
        if (eventResult.rows.length === 0) {
          return res.status(404).json({ message: 'Событие не найдено.' });
        }
        content = eventResult.rows[0];
        contentText = `${content.title || ''} ${content.description || ''}`.trim();
        contentData = content;
        break;

      case 'posts':
        const postResult = await pool.query('SELECT * FROM posts WHERE id::text = $1', [contentId]);
        if (postResult.rows.length === 0) {
          return res.status(404).json({ message: 'Пост не найден.' });
        }
        content = postResult.rows[0];
        contentText = `${content.title || ''} ${content.body || ''}`.trim();
        contentData = content;
        break;

      case 'routes':
        const routeResult = await pool.query('SELECT * FROM travel_routes WHERE id::text = $1', [contentId]);
        if (routeResult.rows.length === 0) {
          return res.status(404).json({ message: 'Маршрут не найден.' });
        }
        content = routeResult.rows[0];
        contentText = `${content.title || ''} ${content.description || ''}`.trim();
        contentData = content;
        break;

      case 'markers':
        const markerResult = await pool.query('SELECT * FROM map_markers WHERE id::text = $1', [contentId]);
        if (markerResult.rows.length === 0) {
          return res.status(404).json({ message: 'Метка не найдена.' });
        }
        content = markerResult.rows[0];
        contentText = `${content.title || ''} ${content.description || ''}`.trim();
        contentData = content;
        break;

      case 'comments':
        const commentResult = await pool.query(
          `SELECT c.*, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id::text = $1`,
          [contentId]
        );
        if (commentResult.rows.length === 0) {
          return res.status(404).json({ message: 'Комментарий не найден.' });
        }
        content = commentResult.rows[0];
        contentText = content.content || '';
        contentData = content;
        break;

      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    // Используем ModerationService для анализа
    const moderationResult = await ModerationService.moderateContent({
      text: contentText,
      type: (contentType === 'posts' || contentType === 'comments') ? 'post' : 'review',
      userId: content.creator_id || content.author_id || 'unknown',
      location: content.location || content.address,
      timestamp: new Date(content.created_at || Date.now())
    });

    // Определяем предложение ИИ на основе результата модерации
    let aiSuggestion = 'approve';
    if (moderationResult.action === 'hide' || moderationResult.action === 'block') {
      aiSuggestion = 'reject';
    } else if (moderationResult.action === 'review') {
      aiSuggestion = 'review';
    }

    // Формируем развёрнутую причину (приоритет: detailedReason > issues)
    let aiReason = moderationResult.detailedReason || 
                   (moderationResult.issues && moderationResult.issues.length > 0 
                     ? moderationResult.issues.join('; ') 
                     : 'Контент проверен автоматически');

    // Сохраняем решение ИИ
    const decisionResult = await pool.query(`
      INSERT INTO ai_moderation_decisions (
        content_type, content_id, ai_suggestion, ai_confidence, 
        ai_reason, ai_category, ai_issues, admin_verdict
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT (content_type, content_id) 
      DO UPDATE SET 
        ai_suggestion = EXCLUDED.ai_suggestion,
        ai_confidence = EXCLUDED.ai_confidence,
        ai_reason = EXCLUDED.ai_reason,
        ai_category = EXCLUDED.ai_category,
        ai_issues = EXCLUDED.ai_issues,
        updated_at = NOW()
      RETURNING *
    `, [
      contentType,
      contentId,
      aiSuggestion,
      moderationResult.confidence,
      aiReason,
      moderationResult.category,
      moderationResult.issues || []
    ]);

    res.json({
      decision: decisionResult.rows[0],
      moderationResult: moderationResult,
      content: contentData
    });
  } catch (error) {
    logger.error('Ошибка анализа контента ИИ:', { error });
    res.status(500).json({ message: 'Ошибка анализа контента.' });
  }
};

// Админ ставит вердикт (правильно/неправильно)
export const setAdminVerdict = async (req, res) => {
  try {
    const { decisionId } = req.params;
    const { verdict, feedback } = req.body; // verdict: 'correct' | 'incorrect', feedback: текст
    const userId = req.user?.id || req.user?.userId;

    if (!['correct', 'incorrect'].includes(verdict)) {
      return res.status(400).json({ message: 'Вердикт должен быть "correct" или "incorrect".' });
    }

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    // Получаем решение ИИ
    const decisionResult = await pool.query(
      'SELECT * FROM ai_moderation_decisions WHERE id = $1',
      [decisionId]
    );

    if (decisionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Решение не найдено.' });
    }

    const decision = decisionResult.rows[0];

    // Обновляем вердикт админа
    await pool.query(`
      UPDATE ai_moderation_decisions 
      SET admin_verdict = $1, 
          admin_feedback = $2,
          admin_id = $3,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
    `, [verdict, feedback || null, userId, decisionId]);

    // Если вердикт "correct", применяем решение ИИ
    if (verdict === 'correct') {
      logger.info(`✅ Админ согласен с ИИ. Применяем решение: ${decision.ai_suggestion} для ${decision.content_type}:${decision.content_id}`);
      
      // Если ИИ предложил одобрить, используем полноценную функцию approveContent для начисления XP
      if (decision.ai_suggestion === 'approve') {
        try {
          logger.info(`🎯 ИИ предложил одобрить - вызываем approveContent для начисления XP...`);
          
          // Импортируем функцию одобрения из moderationController
          const { approveContent: approveContentFunc } = await import('./moderationController.js');
          
          // Создаем req/res для вызова approveContent
          const fakeReq = {
            user: { id: userId },
            params: {
              contentType: decision.content_type,
              id: decision.content_id
            }
          };
          
// SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1481): original:           let approvalResult = null;
          const fakeRes = {
            status: (code) => ({
              json: (data) => {
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:                 approvalResult = data;
                logger.info(`✅ Контент одобрен через ИИ-модерацию:`, data);
                if (data.gamification) {
                  logger.info(`💰 XP начислено:`, data.gamification);
                }
                return fakeRes;
              }
            }),
            json: (data) => {
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:               approvalResult = data;
              logger.info(`✅ Контент одобрен через ИИ-модерацию:`, data);
              if (data.gamification) {
                logger.info(`💰 XP начислено:`, data.gamification);
              }
              return fakeRes;
            }
          };
          
          // Вызываем approveContent, который автоматически:
          // 1. Обновит статус на 'active'
          // 2. Начислит XP автору
          // 3. Обновит уровень пользователя
          // 4. Проверит достижения
          await approveContentFunc(fakeReq, fakeRes);
          
          logger.info(`✅ Одобрение завершено успешно`);
        } catch (approveError) {
          logger.error('❌ Ошибка при автоматическом одобрении контента через ИИ:', { approveError });
          logger.error('   Stack:', { stack: approveError?.stack });
          // Пытаемся хотя бы обновить статус вручную
          try {
            await applyAIDecision(decision.content_type, decision.content_id, 'approve');
            logger.info(`⚠️ Статус обновлён вручную, но XP не начислено из-за ошибки`);
          } catch (fallbackError) {
            logger.error('❌ Критическая ошибка: не удалось даже обновить статус:', { fallbackError });
          }
        }
      } else {
        // Если ИИ предложил reject или hide, просто применяем решение
        logger.info(`🎯 ИИ предложил ${decision.ai_suggestion} - применяем решение...`);
        await applyAIDecision(decision.content_type, decision.content_id, decision.ai_suggestion);
        logger.info(`✅ Решение применено: статус обновлён на ${decision.ai_suggestion === 'reject' ? 'rejected' : 'hidden'}`);
      }
    }

    // Сохраняем в таблицу обучения
    if (verdict === 'incorrect' && feedback) {
      // Получаем текст контента для обучения
      const contentText = await getContentText(decision.content_type, decision.content_id);
      
      await pool.query(`
        INSERT INTO ai_moderation_training (
          decision_id, content_text, content_type, 
          ai_suggestion, admin_verdict, admin_feedback
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        decisionId,
        contentText,
        decision.content_type,
        decision.ai_suggestion,
        verdict,
        feedback
      ]);
    }

    res.json({ 
      message: 'Вердикт сохранен.',
      decision: {
        ...decision,
        admin_verdict: verdict,
        admin_feedback: feedback,
        admin_id: userId,
        reviewed_at: new Date()
      }
    });
  } catch (error) {
    logger.error('Ошибка установки вердикта:', { error });
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

// Применить решение ИИ к контенту (только для reject/hide, approve обрабатывается через approveContent)
async function applyAIDecision(contentType, contentId, suggestion) {
  let tableName;
  let idColumn = 'id';

  switch (contentType) {
    case 'events':
      tableName = 'events';
      break;
    case 'posts':
      tableName = 'posts';
      idColumn = 'id'; // posts.id может быть строкой
      break;
    case 'routes':
      tableName = 'travel_routes';
      break;
    case 'markers':
      tableName = 'map_markers';
      break;
    case 'comments':
      tableName = 'comments';
      break;
    default:
      logger.warn(`⚠️ Неизвестный тип контента для applyAIDecision: ${contentType}`);
      return;
  }

  let status, isPublic;
  if (suggestion === 'approve') {
    status = 'active';
    isPublic = true;
  } else if (suggestion === 'reject') {
    status = 'rejected';
    isPublic = false;
  } else if (suggestion === 'hide') {
    status = 'hidden';
    isPublic = false;
  } else {
    logger.info(`ℹ️ Решение '${suggestion}' не требует изменения статуса`);
    return; // 'review' - оставляем как есть
  }

  logger.info(`🔄 Обновляем ${tableName} ${contentId}: status=${status}, is_public=${isPublic}`);
  
  const result = await pool.query(`
    UPDATE ${tableName} 
    SET status = $1, 
        is_public = $2,
        moderated_at = NOW(),
        updated_at = NOW()
    WHERE ${idColumn}::text = $3
    RETURNING id, status
  `, [status, isPublic, String(contentId)]);
  
  if (result.rows.length > 0) {
    logger.info(`✅ Статус обновлён: ${tableName} ${contentId} → ${status}`);
  } else {
    logger.warn(`⚠️ Контент не найден для обновления: ${tableName} ${contentId}`);
  }
}

// Получить текст контента для обучения
async function getContentText(contentType, contentId) {
  let query;
  
  switch (contentType) {
    case 'events':
      query = 'SELECT title, description FROM events WHERE id::text = $1';
      break;
    case 'posts':
      query = 'SELECT title, body FROM posts WHERE id::text = $1';
      break;
    case 'routes':
      query = 'SELECT title, description FROM travel_routes WHERE id::text = $1';
      break;
    case 'markers':
      query = 'SELECT title, description FROM map_markers WHERE id::text = $1';
      break;
    case 'comments':
      query = 'SELECT content FROM comments WHERE id::text = $1';
      break;
    default:
      return '';
  }

  const result = await pool.query(query, [contentId]);
  if (result.rows.length === 0) return '';
  
  const row = result.rows[0];
  return `${row.title || ''} ${row.description || row.body || row.content || ''}`.trim();
}

// Получить статистику работы ИИ
export const getAIStats = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    // Статистика по вердиктам
    const verdictStats = await pool.query(`
      SELECT 
        admin_verdict,
        COUNT(*) as count,
        AVG(ai_confidence) as avg_confidence
      FROM ai_moderation_decisions
      WHERE admin_verdict IS NOT NULL
      GROUP BY admin_verdict
    `);

    // Статистика по типам контента
    const contentTypeStats = await pool.query(`
      SELECT 
        content_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE admin_verdict = 'correct') as correct,
        COUNT(*) FILTER (WHERE admin_verdict = 'incorrect') as incorrect,
        COUNT(*) FILTER (WHERE admin_verdict = 'pending') as pending
      FROM ai_moderation_decisions
      GROUP BY content_type
    `);

    // Точность ИИ
    const accuracyStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE admin_verdict = 'correct')::float / 
        NULLIF(COUNT(*) FILTER (WHERE admin_verdict IN ('correct', 'incorrect')), 0) * 100 as accuracy
      FROM ai_moderation_decisions
    `);

    res.json({
      verdicts: verdictStats.rows,
      byContentType: contentTypeStats.rows,
      accuracy: accuracyStats.rows[0]?.accuracy || 0
    });
  } catch (error) {
    logger.error('Ошибка получения статистики ИИ:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

// Получить счётчики модерации по типам контента и состояниям
export const getModerationCounts = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    // Упрощённый запрос - считаем по admin_verdict и статусу контента
    const cteUnions = [
      `SELECT 'posts' as content_type, id::text as content_id, status FROM posts`,
      `SELECT 'events' as content_type, id::text as content_id, status FROM events`,
      `SELECT 'routes' as content_type, id::text as content_id, status FROM travel_routes`,
      `SELECT 'markers' as content_type, id::text as content_id, status FROM map_markers`,
      `SELECT 'comments' as content_type, id::text as content_id, status FROM comments`,
    ];

    const simplifiedCounts = await pool.query(`
      WITH content_status AS (
        ${cteUnions.join('\n        UNION ALL\n        ')}
      )
      SELECT 
        amd.content_type,
        COUNT(*) FILTER (WHERE cs.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE cs.status = 'active') as approved,
        COUNT(*) FILTER (WHERE cs.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE cs.status IN ('revision', 'pending_revision')) as revision
      FROM ai_moderation_decisions amd
      LEFT JOIN content_status cs ON cs.content_type = amd.content_type AND cs.content_id = amd.content_id
      WHERE amd.content_type IN ('posts', 'events', 'routes', 'markers', 'comments')
      GROUP BY amd.content_type
    `);

    // Формируем результат в удобном формате
    const result = {
      posts: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      events: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      routes: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      markers: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      comments: { pending: 0, approved: 0, rejected: 0, revision: 0 },
    };

    simplifiedCounts.rows.forEach(row => {
      if (result[row.content_type]) {
        result[row.content_type] = {
          pending: parseInt(row.pending) || 0,
          approved: parseInt(row.approved) || 0,
          rejected: parseInt(row.rejected) || 0,
          revision: parseInt(row.revision) || 0
        };
      }
    });

    res.json(result);
  } catch (error) {
    logger.error('Ошибка получения счётчиков модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};




