/**
 * Middleware для автоматического анализа контента ИИ при создании
 * Вызывается после создания контента, чтобы ИИ сразу проанализировал его
 */

import pool from '../../db.js';
import { ModerationService } from '../services/moderationService.js';

const moderationService = new ModerationService();

/**
 * Автоматически анализирует контент после создания
 * Вызывается из контроллеров после успешного создания
 */
export async function autoAnalyzeContent(contentType, contentId, contentData) {
  try {
    // Получаем текст контента
    let contentText = '';
    let location = null;

    switch (contentType) {
      case 'events':
        contentText = `${contentData.title || ''} ${contentData.description || ''}`.trim();
        location = contentData.location || contentData.address;
        break;
      case 'posts':
        contentText = `${contentData.title || ''} ${contentData.body || ''}`.trim();
        break;
      case 'routes':
        contentText = `${contentData.title || ''} ${contentData.description || ''}`.trim();
        break;
      case 'markers':
        contentText = `${contentData.title || ''} ${contentData.description || ''}`.trim();
        location = contentData.address;
        break;
      case 'blogs':
        // Legacy blogs: treat as posts (body may be in `content` or `body`)
        contentText = `${contentData.title || ''} ${contentData.body || contentData.content || ''}`.trim();
        break;
      default:
        return; // Не анализируем неизвестные типы
    }

    if (!contentText) {
      return; // Нет текста для анализа
    }

    // Анализируем контент через ModerationService
    const moderationResult = await moderationService.moderateContent({
      text: contentText,
      type: (contentType === 'posts' || contentType === 'blogs') ? 'post' : 'review',
      userId: contentData.creator_id || contentData.author_id || 'unknown',
      location: location,
      timestamp: new Date()
    });

    // Определяем предложение ИИ
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

    // Сохраняем решение ИИ в БД
    const insertResult = await pool.query(`
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
      String(contentId),
      aiSuggestion,
      moderationResult.confidence,
      aiReason,
      moderationResult.category,
      moderationResult.issues || []
    ]);

    const decisionId = insertResult.rows[0]?.id || 'обновлена';
    console.log(`✅ ИИ проанализировал ${contentType} ${contentId}: ${aiSuggestion} (${Math.round(moderationResult.confidence * 100)}%)`);
    console.log(`📝 Создана запись в ai_moderation_decisions: ${decisionId}, admin_verdict='pending'`);
    console.log(`   - Предложение: ${aiSuggestion}`);
    console.log(`   - Категория: ${moderationResult.category}`);
    console.log(`   - Проблемы: ${moderationResult.issues.length > 0 ? moderationResult.issues.join(', ') : 'нет'}`);
    
    // Проверяем, что запись действительно создалась
    const checkResult = await pool.query(
      'SELECT id, admin_verdict FROM ai_moderation_decisions WHERE content_type = $1 AND content_id = $2',
      [contentType, String(contentId)]
    );
    if (checkResult.rows.length > 0) {
      console.log(`✅ Проверка: запись существует, admin_verdict='${checkResult.rows[0].admin_verdict}'`);
    } else {
      console.error(`❌ ОШИБКА: запись не найдена в БД после создания!`);
    }
  } catch (error) {
    // Не блокируем создание контента, если анализ не удался
    console.error(`❌ Ошибка автоматического анализа контента (${contentType}/${contentId}):`, error);
    console.error(`   Детали ошибки:`, error.message);
    if (error.stack) {
      console.error(`   Stack trace:`, error.stack);
    }
    // Пробуем сохранить хотя бы базовую запись для ручной проверки
    try {
      await pool.query(`
        INSERT INTO ai_moderation_decisions (
          content_type, content_id, ai_suggestion, ai_confidence, 
          ai_reason, ai_category, ai_issues, admin_verdict
        ) VALUES ($1, $2, 'review', 0.5, 'Ошибка анализа, требуется ручная проверка', 'error', ARRAY[]::text[], 'pending')
        ON CONFLICT (content_type, content_id) DO NOTHING
      `, [contentType, String(contentId)]);
      console.log(`⚠️ Создана запись с ошибкой для ручной проверки`);
    } catch (fallbackError) {
      console.error(`❌ Критическая ошибка: не удалось создать запись даже с ошибкой:`, fallbackError.message);
    }
  }
}

