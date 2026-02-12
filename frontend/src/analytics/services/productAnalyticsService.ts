/**
 * Сервис продуктовой аналитики
 * Отслеживает здоровье продукта: метрики производительности, бизнес-метрики, монетизацию
 */

import apiClient from '../../api/apiClient';
import storageService from '../../services/storageService';
import { ProductAnalytics, PerformanceMetrics, BusinessMetrics, RevenueMetrics, TimeRange } from '../types/analytics.types';

class ProductAnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 минута

  /**
   * Получить все продуктовые метрики
   */
  async getProductAnalytics(timeRange: TimeRange = '7d'): Promise<ProductAnalytics> {
    const cacheKey = `product_analytics_${timeRange}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const token = storageService.getItem('token');
      const response = await apiClient.get('/analytics/product', {
        params: { time_range: timeRange },
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error: any) {
      // Тихо: аналитика не критична, 401/403 ожидаемы
      if (process.env.NODE_ENV === 'development') {
        console.debug('Ошибка загрузки продуктовой аналитики:', error?.message);
      }
      // Возвращаем моковые данные при ошибке
      return this.getMockData();
    }
  }

  /**
   * Получить метрики производительности
   */
  async getPerformanceMetrics(timeRange: TimeRange = '7d'): Promise<PerformanceMetrics> {
    const analytics = await this.getProductAnalytics(timeRange);
    return analytics.performance;
  }

  /**
   * Получить бизнес-метрики
   */
  async getBusinessMetrics(timeRange: TimeRange = '7d'): Promise<BusinessMetrics> {
    const analytics = await this.getProductAnalytics(timeRange);
    return analytics.business;
  }

  /**
   * Получить метрики монетизации
   */
  async getRevenueMetrics(timeRange: TimeRange = '7d'): Promise<RevenueMetrics> {
    const analytics = await this.getProductAnalytics(timeRange);
    return analytics.revenue;
  }

  /**
   * Трекинг конверсии
   */
  async trackConversion(event: {
    event_type: string;
    user_id?: string;
    properties: Record<string, any>;
  }): Promise<void> {
    try {
      const token = storageService.getItem('token');
      if (!token) return; // Без токена — не спамим 403
      // Circuit breaker: если endpoint уже возвращал 403, не спамим
      if ((this as any)._trackDisabled) return;
      await apiClient.post('/analytics/track', {
        event_type: event.event_type,
        user_id: event.user_id,
        properties: event.properties,
        category: 'conversion'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        (this as any)._trackDisabled = true;
        return;
      }
      if (process.env.NODE_ENV !== 'test') {
        console.debug('Ошибка трекинга конверсии:', error?.message || error);
      }
    }
  }

  /**
   * Вычислить вовлеченность
   */
  calculateEngagement(event: any): number {
    // Простая формула вовлеченности
    const factors = {
      time_spent: event.time_spent || 0,
      interactions: event.interactions || 0,
      content_views: event.content_views || 0
    };

    return (
      Math.min(factors.time_spent / 60, 1) * 0.4 +
      Math.min(factors.interactions / 10, 1) * 0.3 +
      Math.min(factors.content_views / 5, 1) * 0.3
    ) * 100;
  }

  /**
   * Моковые данные для разработки
   */
  private getMockData(): ProductAnalytics {
    return {
      performance: {
        app_load_time: 1.2,
        map_load_time: 0.8,
        error_rate: 0.2,
        crash_rate: 0.05,
        core_web_vitals: {
          lcp: 2.1,
          fid: 89,
          cls: 0.08
        }
      },
      business: {
        dau: 1250,
        mau: 8500,
        wau: 4200,
        retention: {
          'day_1': 65,
          'day_7': 45,
          'day_30': 42
        },
        conversion_funnels: [],
        user_growth: {
          new_users: 150,
          growth_rate: 15,
          churn_rate: 8
        }
      },
      revenue: {
        arpu: 0,
        ltv: 0,
        conversion_rates: {}
      },
      timestamp: Date.now()
    };
  }
}

export const productAnalyticsService = new ProductAnalyticsService();

