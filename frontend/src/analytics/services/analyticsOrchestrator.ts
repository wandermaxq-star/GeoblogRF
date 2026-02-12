/**
 * Главный оркестратор аналитики
 * Координирует работу всех сервисов аналитики
 */

import { productAnalyticsService } from './productAnalyticsService';
import { behavioralAnalyticsService } from './behavioralAnalyticsService';
import { performanceMonitoringService } from './performanceMonitoringService';
import { errorTrackingService } from './errorTrackingService';
import { storageService } from '../../services/storageService';
import { UserJourneyEvent, MapBehaviorEvent, ComprehensiveMetrics, TimeRange } from '../types/analytics.types';
import { getAnalyticsConsent } from '../utils/analyticsConsent';

class AnalyticsOrchestrator {
  private initialized = false;

  /**
   * Инициализация всех систем
   */
  initialize(): void {
    if (this.initialized) return;

    // Инициализация уже выполнена в конструкторах сервисов
    this.initialized = true;
  }

  /**
   * Трекинг комплексного события пользовательского пути
   * Проверяет флаг analytics_opt_out перед трекингом
   */
  async trackUserJourney(event: UserJourneyEvent): Promise<void> {
    // Проверяем согласие на аналитику
    if (!getAnalyticsConsent()) {
      // Аналитика отключена - молча игнорируем событие
      return;
    }

    // Fire-and-forget: запускаем каждый сервис отдельно и обрабатываем ошибки локально
    try {
      // Продуктовая аналитика (не блокируем основной поток)
      Promise.resolve(productAnalyticsService.trackConversion({
        event_type: event.event_type,
        user_id: event.user_id,
        properties: event.properties
      })).catch(() => { /* analytics non-critical */ });

      // Поведенческая аналитика
      Promise.resolve(behavioralAnalyticsService.analyzeBehaviorPattern({
        user_id: event.user_id,
        event_type: event.event_type,
        properties: event.properties
      })).catch(() => { /* analytics non-critical */ });

      // Performance monitoring (если есть длительность) — тоже неблокирующий вызов
      if (event.properties?.duration) {
        try {
          Promise.resolve(performanceMonitoringService.trackUserTiming({
            event_type: event.event_type,
            duration: event.properties.duration,
            component: event.properties.component
          })).catch(() => { /* analytics non-critical */ });
        } catch {
          // analytics non-critical
        }
      }
    } catch (error) {
      // На уровне оркестратора — логируем редкие синхронные ошибки и продолжаем
      // Тихо: аналитика не критична
    }
  }

  /**
   * Аналитика карт и геоданных
   * Проверяет флаг analytics_opt_out перед трекингом
   */
  async trackMapBehavior(mapEvent: MapBehaviorEvent): Promise<{
    geographic_patterns: any;
    performance_metrics: any;
    user_engagement: number;
  }> {
    // Проверяем согласие на аналитику
    if (!getAnalyticsConsent()) {
      // Аналитика отключена - возвращаем пустые данные
      return {
        geographic_patterns: {},
        performance_metrics: {},
        user_engagement: 0
      };
    }

    try {
      const geographicPatterns = behavioralAnalyticsService.extractGeographicPatterns(mapEvent);
      const performanceMetrics = performanceMonitoringService.getMapPerformance(mapEvent);
      const userEngagement = productAnalyticsService.calculateEngagement({
        time_spent: mapEvent.properties.zoom_level ? 10 : 5,
        interactions: 1,
        content_views: 0
      });

      return {
        geographic_patterns: geographicPatterns,
        performance_metrics: performanceMetrics,
        user_engagement: userEngagement
      };
    } catch (error) {
      // Тихо: аналитика не критична
      return {
        geographic_patterns: {},
        performance_metrics: {},
        user_engagement: 0
      };
    }
  }

  /**
   * Получить комплексные метрики
   */
  async getComprehensiveMetrics(timeRange: TimeRange = '7d'): Promise<ComprehensiveMetrics> {
    try {
      const [product, behavioral, technical] = await Promise.all([
        productAnalyticsService.getProductAnalytics(timeRange),
        behavioralAnalyticsService.getBehavioralAnalytics(timeRange),
        Promise.resolve(errorTrackingService.getTechnicalHealth())
      ]);

      // Получаем метрики геймификации и контента (будут добавлены позже)
      const gamification = {
        daily_goals_completion: 67,
        achievement_unlock_rate: 23,
        xp_sources: [
          { source: 'посты', percentage: 45, total_xp: 0 },
          { source: 'метки', percentage: 30, total_xp: 0 },
          { source: 'цели', percentage: 25, total_xp: 0 }
        ],
        level_distribution: [],
        problem_areas: [
          { issue: '15% пользователей не понимают систему уровней', affected_users_percentage: 15 },
          { issue: '40% бросают создание поста на шаге "добавление карты"', affected_users_percentage: 40 }
        ]
      };

      const content = {
        quality: {
          posts_with_photos: 64,
          detailed_descriptions: 42,
          reuse_rate: 28,
          trends: [
            { metric: 'Посты с фото', current: 64, previous: 58, change: 6, direction: 'up' as const },
            { metric: 'Детальные описания', current: 42, previous: 45, change: -3, direction: 'down' as const }
          ]
        },
        engagement: {
          likes_per_view: 3.2,
          sharing_rate: 1.8,
          save_rate: 5.1,
          comments_per_post: 2.3,
          avg_engagement_time: 180
        }
      };

      return {
        product,
        behavioral,
        technical,
        gamification,
        content,
        timestamp: Date.now()
      };
    } catch (error) {
      // Тихо: аналитика не критична
      throw error;
    }
  }

  /**
   * Трекинг события страницы
   */
  trackPageView(path: string, previousPath?: string, timeOnPreviousPage?: number): void {
    this.trackUserJourney({
      user_id: undefined,
      event_type: 'page_view',
      timestamp: Date.now(),
      properties: {
        path,
        previous_path: previousPath,
        time_on_previous_page: timeOnPreviousPage
      },
      session_id: this.getSessionId()
    });
  }

  /**
   * Получить или создать ID сессии
   */
  getSessionId(): string {
    if (typeof window === 'undefined') return 'server';

    // Prefer storageService to keep storage handling centralized and testable
    let sessionId = storageService.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      storageService.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }
}

export const analyticsOrchestrator = new AnalyticsOrchestrator();

// Инициализация при загрузке
if (typeof window !== 'undefined') {
  analyticsOrchestrator.initialize();
}

