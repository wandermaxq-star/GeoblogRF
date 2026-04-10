/**
 * Сервис для ИИ-анализа контента перед модерацией
 * Вызывается при сохранении контента локально
 */

import { PendingContent } from './localModerationStorage';
import apiClient from '../api/apiClient';

export interface AIAnalysisResult {
  rating: number; // 0-100
  confidence: number; // 0-1
  reason: string;
  suggestion: 'approve' | 'reject' | 'review';
  category?: string;
  issues?: string[];
}

/**
 * Анализировать контент с помощью ИИ
 */
export async function analyzeContentWithAI(
  contentType: 'marker' | 'post' | 'event' | 'complaint' | 'suggestion' | 'route',
  contentId: string,
  contentData: any
): Promise<AIAnalysisResult | null> {
  try {
    // Подготавливаем данные для анализа
    const textContent = extractTextContent(contentData);
    const location = extractLocation(contentData);

    console.log(`🤖 ИИ-анализ: запуск для ${contentType}/${contentId}...`);

    // Вызываем API для ИИ-анализа
    const response = await apiClient.post('/moderation/ai/analyze', {
      content_type: contentType,
      content_id: contentId,
      content_text: textContent,
      location: location,
      content_data: contentData,
    });

    const analysis: AIAnalysisResult = {
      rating: response.data.rating || 50,
      confidence: response.data.confidence || 0.5,
      reason: response.data.reason || 'Анализ выполнен',
      suggestion: response.data.suggestion || 'review',
      category: response.data.category,
      issues: response.data.issues || [],
    };

    console.log(`✅ ИИ-анализ успешен: ${analysis.suggestion} (уверенность ${Math.round(analysis.confidence * 100)}%)`);

    // Обновляем локальное хранилище с результатом анализа
    const { getPendingContent, savePendingContent } = await import('./localModerationStorage');
    const pending = getPendingContent(contentType, contentId);
    if (pending) {
      pending.ai_analysis = analysis;
      savePendingContent(pending);
    }

    return analysis;
  } catch (error: any) {
    console.error('⚠️ Ошибка ИИ-анализа контента:', error?.message || error);
    
    // Логируем детали для диагностики
    if (error?.response?.status === 403) {
      console.warn('⚠️ ИИ-анализ недоступен (403 Forbidden) — контент будет отправлен на модерацию без анализа');
    } else if (error?.response?.status === 401) {
      console.warn('⚠️ Требуется авторизация для ИИ-анализа (401)');
    }

    // Возвращаем базовый анализ при ошибке
    // Это позволяет продолжить процесс без блокировки контента
    return {
      rating: 50,
      confidence: 0.3,
      reason: 'Анализ недоступен, требуется ручная проверка',
      suggestion: 'review',
    };
  }
}

/**
 * Извлечь текстовый контент из данных
 */
function extractTextContent(data: any): string {
  const parts: string[] = [];
  
  if (data.title) parts.push(data.title);
  if (data.description) parts.push(data.description);
  if (data.body) parts.push(data.body);
  if (data.content) parts.push(data.content);
  if (data.text) parts.push(data.text);
  
  // Для меток
  if (data.address) parts.push(data.address);
  
  // Для событий
  if (data.name) parts.push(data.name);
  if (data.details) parts.push(data.details);
  
  return parts.join(' ').trim();
}

/**
 * Извлечь локацию из данных
 */
function extractLocation(data: any): { latitude?: number; longitude?: number } | null {
  if (data.latitude && data.longitude) {
    return {
      latitude: typeof data.latitude === 'string' ? parseFloat(data.latitude) : data.latitude,
      longitude: typeof data.longitude === 'string' ? parseFloat(data.longitude) : data.longitude,
    };
  }
  if (data.location) {
    return {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
    };
  }
  return null;
}

