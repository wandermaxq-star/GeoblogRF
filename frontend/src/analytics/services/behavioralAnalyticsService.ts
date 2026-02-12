/**
 * Сервис поведенческой аналитики
 * Анализирует поведение пользователей: географические паттерны, контентные предпочтения, социальное поведение
 */

import apiClient from '../../api/apiClient';
import storageService from '../../services/storageService';
import { BehavioralAnalytics, TravelPatterns, ContentBehavior, SocialBehavior, MapBehaviorEvent, TimeRange } from '../types/analytics.types';

class BehavioralAnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 120000; // 2 минуты

  /**
   * Получить поведенческую аналитику
   */
  async getBehavioralAnalytics(timeRange: TimeRange = '7d'): Promise<BehavioralAnalytics> {
    const cacheKey = `behavioral_analytics_${timeRange}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const token = storageService.getItem('token');
      const response = await apiClient.get('/analytics/behavioral', {
        params: { time_range: timeRange },
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error: any) {
      // Тихо: аналитика не критична
      if (process.env.NODE_ENV === 'development') {
        console.debug('Ошибка загрузки поведенческой аналитики:', error?.message);
      }
      return this.getMockData();
    }
  }

  /**
   * Анализировать паттерн поведения
   */
  async analyzeBehaviorPattern(event: {
    user_id?: string;
    event_type: string;
    properties: Record<string, any>;
  }): Promise<void> {
    try {
      const token = storageService.getItem('token');
      // Без токена нет смысла отправлять — сервер вернёт 403
      if (!token) return;
      // Circuit breaker: если endpoint уже возвращал 403, не спамим
      if ((this as any)._trackDisabled) return;
      await apiClient.post('/analytics/track', {
        event_type: event.event_type,
        user_id: event.user_id,
        properties: event.properties,
        category: 'behavior'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Circuit breaker: отключаем дальнейшие запросы на этот endpoint
        (this as any)._trackDisabled = true;
        return;
      }
      console.debug('Ошибка трекинга поведения:', error?.message || error);
    }
  }

  /**
   * Извлечь географические паттерны из события карты
   * ВАЖНО: Координаты анонимизируются до уровня региона
   */
  extractGeographicPatterns(mapEvent: MapBehaviorEvent): {
    region?: string;
    interaction_type: string;
    frequency: number;
  } {
    // Анонимизируем координаты - определяем только регион, не точные координаты
    const region = mapEvent.properties.center 
      ? this.detectRegion(mapEvent.properties.center[0], mapEvent.properties.center[1])
      : undefined;
    
    return {
      interaction_type: mapEvent.event_type,
      frequency: 1,
      region // Только регион, не координаты!
    };
  }

  /**
   * Определить регион по координатам (упрощённая версия)
   */
  private detectRegion(lat: number, lon: number): string {
    // Упрощённая логика определения региона
    if (lat > 55 && lon > 30 && lon < 40) return 'Москва и область';
    if (lat > 59 && lon > 28 && lon < 32) return 'Санкт-Петербург';
    if (lat > 44 && lon > 33 && lon < 37) return 'Крым';
    if (lat > 60 && lon > 30 && lon < 35) return 'Карелия';
    if (lat > 50 && lon > 82 && lon < 88) return 'Алтай';
    return 'Другой регион';
  }

  /**
   * Анонимизировать координаты (округлить до региона)
   */
  private anonymizeCoordinates(lat?: number, lon?: number): string | null {
    if (lat === undefined || lon === undefined) return null;
    
    // Округляем координаты до ~10 км точности (около 0.1 градуса)
    const roundedLat = Math.round(lat * 10) / 10;
    const roundedLon = Math.round(lon * 10) / 10;
    
    // Определяем регион вместо точных координат
    return this.detectRegion(roundedLat, roundedLon);
  }

  /**
   * Анонимизировать геоданные в свойствах
   */
  private anonymizeGeoData(properties: Record<string, any>): Record<string, any> {
    const anonymized = { ...properties };
    
    // Удаляем персональные данные
    delete anonymized.user_id;
    delete anonymized.email;
    delete anonymized.username;
    
    // Анонимизируем координаты
    if (anonymized.latitude !== undefined || anonymized.longitude !== undefined) {
      const region = this.anonymizeCoordinates(anonymized.latitude, anonymized.longitude);
      delete anonymized.latitude;
      delete anonymized.longitude;
      if (region) {
        anonymized.region = region;
      }
    }
    
    // Анонимизируем координаты в массивах (например, в треках)
    if (Array.isArray(anonymized.coordinates)) {
      anonymized.coordinates = anonymized.coordinates.map((coord: any) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          return this.anonymizeCoordinates(coord[0], coord[1]);
        }
        return null;
      }).filter((r: any) => r !== null);
    }
    
    // Анонимизируем треки (GeoJSON)
    if (anonymized.track && anonymized.track.geometry) {
      const trackRegion = anonymized.track.geometry.coordinates && anonymized.track.geometry.coordinates.length > 0
        ? this.anonymizeCoordinates(
            anonymized.track.geometry.coordinates[0][1],
            anonymized.track.geometry.coordinates[0][0]
          )
        : null;
      delete anonymized.track;
      if (trackRegion) {
        anonymized.track_region = trackRegion;
        anonymized.track_points_count = anonymized.track?.geometry?.coordinates?.length || 0;
      }
    }
    
    return anonymized;
  }

  /**
   * Трекинг обезличенных данных
   */
  trackAnonymized(event: string, properties: Record<string, any>): void {
    // Анонимизируем все данные (включая координаты)
    const anonymized = this.anonymizeGeoData(properties);
    
    // Отправляем на сервер
    this.analyzeBehaviorPattern({
      event_type: event,
      properties: anonymized
    });
  }

  /**
   * Моковые данные
   */
  private getMockData(): BehavioralAnalytics {
    return {
      travel_patterns: {
        popular_routes: [
          {
            route_id: '1',
            popularity_score: 8.5,
            region: 'Крым',
            seasonality: ['лето', 'осень'],
            user_segments: ['explorer', 'planner'],
            avg_rating: 4.7,
            views_count: 1250
          }
        ],
        seasonal_destinations: [
          {
            destination: 'Крым',
            region: 'Юг России',
            peak_seasons: ['лето'],
            interest_trend: [
              { month: 'июнь', interest_level: 85 },
              { month: 'июль', interest_level: 95 },
              { month: 'август', interest_level: 90 }
            ]
          }
        ],
        user_movement_types: [
          { type: 'explorer', percentage: 35, avg_routes_per_user: 8 },
          { type: 'planner', percentage: 40, avg_routes_per_user: 12 },
          { type: 'follower', percentage: 20, avg_routes_per_user: 5 },
          { type: 'casual', percentage: 5, avg_routes_per_user: 2 }
        ]
      },
      content_behavior: {
        search_patterns: [
          {
            query: 'горнолыжные курорты',
            frequency: 450,
            results_clicked: 320,
            avg_time_to_click: 2.3,
            region: 'Москва'
          }
        ],
        consumption_depth: {
          avg_time_on_content: 180,
          scroll_depth: {
            '25%': 85,
            '50%': 65,
            '75%': 45,
            '100%': 30
          },
          bounce_rate: 35,
          return_rate: 42
        },
        engagement_triggers: [
          { trigger_type: 'image', effectiveness_score: 8.5, usage_count: 1200 },
          { trigger_type: 'location', effectiveness_score: 7.8, usage_count: 950 }
        ]
      },
      social_behavior: {
        sharing_patterns: [
          {
            content_type: 'post',
            share_channel: 'internal',
            share_rate: 1.8,
            avg_shares_per_content: 2.3
          }
        ],
        influence_networks: [],
        community_interactions: [
          {
            interaction_type: 'like',
            frequency: 1250,
            peak_hours: [18, 19, 20],
            content_types: ['post', 'marker']
          }
        ]
      },
      timestamp: Date.now()
    };
  }
}

export const behavioralAnalyticsService = new BehavioralAnalyticsService();

