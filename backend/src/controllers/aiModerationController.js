import pool from '../../db.js';
import ModerationService from '../services/moderationService.js';

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

    console.log(`🔍 ИИ-помощник: найдено ${result.rows.length} записей для ${contentType} со статусом '${status}'`);

    // Логируем детали для диагностики
    if (result.rows.length > 0) {
      result.rows.forEach((row, idx) => {
        const content = row.content_data || {};
        console.log(`  ${idx + 1}. Post ID: ${row.content_id}, Title: ${content.title || 'нет'}, AI: ${row.ai_suggestion}, Confidence: ${Math.round(row.ai_confidence * 100)}%`);
      });
    } else {
      console.log(`  ⚠️ Нет постов для модерации. Проверьте, что есть посты со status='pending' и записи в ai_moderation_decisions с admin_verdict='pending'`);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения контента для проверки:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

// ИИ анализирует контент и создает предложение
export const analyzeContent = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;

    // Получаем контент
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

      case 'blogs':
        // Legacy: treat blogs as posts
        const blogResult = await pool.query('SELECT * FROM posts WHERE id::text = $1', [contentId]);
        if (blogResult.rows.length === 0) {
          return res.status(404).json({ message: 'Пост не найден.' });
        }
        content = blogResult.rows[0];
        contentText = `${content.title || ''} ${content.body || content.content || ''}`.trim();
        contentData = content;
        break;

      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    // Используем ModerationService для анализа
    const moderationResult = await ModerationService.moderateContent({
      text: contentText,
      type: (contentType === 'posts' || contentType === 'blogs') ? 'post' : 'review',
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
    console.error('Ошибка анализа контента ИИ:', error);
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
      console.log(`✅ Админ согласен с ИИ. Применяем решение: ${decision.ai_suggestion} для ${decision.content_type}:${decision.content_id}`);
      
      // Если ИИ предложил одобрить, используем полноценную функцию approveContent для начисления XP
      if (decision.ai_suggestion === 'approve') {
        try {
          console.log(`🎯 ИИ предложил одобрить - вызываем approveContent для начисления XP...`);
          
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
                console.log(`✅ Контент одобрен через ИИ-модерацию:`, data);
                if (data.gamification) {
                  console.log(`💰 XP начислено:`, data.gamification);
                }
                return fakeRes;
              }
            }),
            json: (data) => {
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:               approvalResult = data;
              console.log(`✅ Контент одобрен через ИИ-модерацию:`, data);
              if (data.gamification) {
                console.log(`💰 XP начислено:`, data.gamification);
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
          
          console.log(`✅ Одобрение завершено успешно`);
        } catch (approveError) {
          console.error('❌ Ошибка при автоматическом одобрении контента через ИИ:', approveError);
          console.error('   Stack:', approveError.stack);
          // Пытаемся хотя бы обновить статус вручную
          try {
            await applyAIDecision(decision.content_type, decision.content_id, 'approve');
            console.log(`⚠️ Статус обновлён вручную, но XP не начислено из-за ошибки`);
          } catch (fallbackError) {
            console.error('❌ Критическая ошибка: не удалось даже обновить статус:', fallbackError);
          }
        }
      } else {
        // Если ИИ предложил reject или hide, просто применяем решение
        console.log(`🎯 ИИ предложил ${decision.ai_suggestion} - применяем решение...`);
        await applyAIDecision(decision.content_type, decision.content_id, decision.ai_suggestion);
        console.log(`✅ Решение применено: статус обновлён на ${decision.ai_suggestion === 'reject' ? 'rejected' : 'hidden'}`);
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
    console.error('Ошибка установки вердикта:', error);
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
    case 'blogs':
      tableName = 'blog_posts';
      break;
    default:
      console.warn(`⚠️ Неизвестный тип контента для applyAIDecision: ${contentType}`);
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
    console.log(`ℹ️ Решение '${suggestion}' не требует изменения статуса`);
    return; // 'review' - оставляем как есть
  }

  console.log(`🔄 Обновляем ${tableName} ${contentId}: status=${status}, is_public=${isPublic}`);
  
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
    console.log(`✅ Статус обновлён: ${tableName} ${contentId} → ${status}`);
  } else {
    console.warn(`⚠️ Контент не найден для обновления: ${tableName} ${contentId}`);
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
    case 'blogs':
      query = 'SELECT title, content FROM blog_posts WHERE id::text = $1';
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
    console.error('Ошибка получения статистики ИИ:', error);
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
    const simplifiedCounts = await pool.query(`
      WITH content_status AS (
        SELECT 'posts' as content_type, id::text as content_id, status FROM posts
        UNION ALL
        SELECT 'events' as content_type, id::text as content_id, status FROM events
        UNION ALL
        SELECT 'routes' as content_type, id::text as content_id, status FROM travel_routes
        UNION ALL
        SELECT 'markers' as content_type, id::text as content_id, status FROM map_markers
        UNION ALL
        SELECT 'comments' as content_type, id::text as content_id, status FROM comments
      )
      SELECT 
        amd.content_type,
        COUNT(*) FILTER (WHERE amd.admin_verdict = 'pending' AND cs.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE amd.admin_verdict = 'correct' AND cs.status = 'active') as approved,
        COUNT(*) FILTER (WHERE amd.admin_verdict = 'incorrect' AND cs.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE cs.status = 'revision' OR cs.status = 'pending_revision') as revision
      FROM ai_moderation_decisions amd
      LEFT JOIN content_status cs ON cs.content_type = amd.content_type AND cs.content_id = amd.content_id
      WHERE amd.content_type IN ('posts', 'events', 'routes', 'markers', 'comments', 'complaints', 'suggestions')
      GROUP BY amd.content_type
    `);

    // Формируем результат в удобном формате
    const result = {
      posts: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      events: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      routes: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      markers: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      comments: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      complaints: { pending: 0, approved: 0, rejected: 0, revision: 0 },
      suggestions: { pending: 0, approved: 0, rejected: 0, revision: 0 }
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
    console.error('Ошибка получения счётчиков модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};




