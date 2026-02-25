/**
 * Главный оркестратор аналитики
 * Координирует работу всех сервисов аналитики
 */

import { performanceMonitoringService } from './performanceMonitoringService';
import { storageService } from '../../services/storageService';
import { UserJourneyEvent, MapBehaviorEvent, ComprehensiveMetrics, TimeRange } from '../types/analytics.types';
import { getAnalyticsConsent } from '../utils/analyticsConsent';
import apiClient from '../../api/apiClient';

class AnalyticsOrchestrator {
  private initialized = false;

  /**
   * Инициализация всех систем
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Трекинг комплексного события пользовательского пути
   */
  async trackUserJourney(event: UserJourneyEvent): Promise<void> {
    if (!getAnalyticsConsent()) return;

    try {
      apiClient.post('/analytics/track', {
        event_type: event.event_type,
        user_id: event.user_id,
        properties: event.properties,
        category: 'user_journey'
      }).catch(() => { /* analytics non-critical */ });
    } catch {
      // analytics non-critical
    }
  }

  /**
   * Аналитика карт и геоданных
   */
  async trackMapBehavior(mapEvent: MapBehaviorEvent): Promise<{
    geographic_patterns: any;
    performance_metrics: any;
    user_engagement: number;
  }> {
    if (!getAnalyticsConsent()) {
      return { geographic_patterns: {}, performance_metrics: {}, user_engagement: 0 };
    }

    try {
      const performanceMetrics = performanceMonitoringService.getMapPerformance(mapEvent);
      return {
        geographic_patterns: {},
        performance_metrics: performanceMetrics,
        user_engagement: 0
      };
    } catch {
      return { geographic_patterns: {}, performance_metrics: {}, user_engagement: 0 };
    }
  }

  /**
   * Получить комплексные метрики — единый вызов к бэкенду
   * Все данные реальные, из PostgreSQL
   */
  async getComprehensiveMetrics(timeRange: TimeRange = '7d'): Promise<ComprehensiveMetrics> {
    const response = await apiClient.get('/analytics/comprehensive', {
      params: { time_range: timeRange }
    });
    return response.data as ComprehensiveMetrics;
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

    let sessionId = storageService.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      storageService.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }
}

export const analyticsOrchestrator = new AnalyticsOrchestrator();

if (typeof window !== 'undefined') {
  analyticsOrchestrator.initialize();
}

