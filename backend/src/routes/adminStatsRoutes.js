import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getProjectStats, getUserStats, getTrends } from '../controllers/adminStatsController.js';
import {
  listPayouts,
  triggerCalculation,
  changePayoutStatus,
  listApplications,
  updateApplication
} from '../controllers/adminAffiliateController.js';

const router = express.Router();

// Все роуты требуют авторизации
router.use(authenticateToken);

// Общая статистика проекта
router.get('/stats/project', getProjectStats);

// Статистика конкретного пользователя
router.get('/stats/user/:targetUserId', getUserStats);

// Тенденции (рост/падение)
router.get('/stats/trends', getTrends);

// партнёрская программа – выплаты и заявки
router.get('/affiliates/payouts', listPayouts);                // ?status=calculated|sent|paid
router.post('/affiliates/payouts/calc', triggerCalculation);   // body {periodStart,periodEnd,minAmount}
router.post('/affiliates/payouts/:id/status', changePayoutStatus);

router.get('/affiliates/applications', listApplications);
router.post('/affiliates/applications/:id', updateApplication);

export default router;

