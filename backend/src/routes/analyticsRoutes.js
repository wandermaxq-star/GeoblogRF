/**
 * Роуты для аналитики
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { checkAnalyticsOptOut } from '../middleware/analyticsOptOut.js';
import {
  getProductAnalytics,
  getBehavioralAnalytics,
  getTechnicalHealth,
  getComprehensiveMetrics,
  trackEvent,
  trackError
} from '../controllers/analyticsController.js';
import logger from '../../logger.js';

const router = express.Router();

// Трекинг событий и ошибок — доступны авторизованным пользователям (не только admin)
router.post('/track', authenticateToken, checkAnalyticsOptOut, trackEvent);
router.post('/errors', authenticateToken, checkAnalyticsOptOut, trackError);

// Все остальные роуты требуют аутентификации и прав администратора
router.use(authenticateToken, requireRole(['admin']));

// Логируем все запросы к аналитике
router.use((req, res, next) => {
  logger.info('🚀 Запрос к аналитике:', req.method, req.path);
  logger.info('📩 Query params:', req.query);
  logger.info('🧾 Request body:', req.body);
  next();
});

// Продуктовая аналитика
router.get('/product', getProductAnalytics);

// Поведенческая аналитика
router.get('/behavioral', getBehavioralAnalytics);

// Техническое здоровье
router.get('/technical', getTechnicalHealth);

// Комплексные метрики
router.get('/comprehensive', getComprehensiveMetrics);

export default router;

