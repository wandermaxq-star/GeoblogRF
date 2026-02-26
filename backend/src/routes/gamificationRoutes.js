import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getUserLevel,
  addXP,
  getDailyGoals,
  completeGoal,
  claimDailyReward,
  getAchievements,
  getStats,
  getFeatures,
  applyRetroactiveGamification,
  markGuestActionAsApproved,
  getUserProfile,
} from '../controllers/gamificationController.js';

const router = express.Router();

// Feature flags - публичный endpoint (не требует аутентификации)
router.get('/features', getFeatures);

// Ретроактивное начисление - требует аутентификации
router.post('/retroactive', authenticateToken, applyRetroactiveGamification);

// Отметка действия гостя как одобренного - требует аутентификации (для модераторов)
router.post('/guest-actions/approve', authenticateToken, markGuestActionAsApproved);

// Все остальные маршруты требуют аутентификации
router.use(authenticateToken);

// Уровни
router.get('/level/:userId?', getUserLevel);

// XP
router.post('/xp', addXP);

// Ежедневные цели
router.get('/daily-goals', getDailyGoals);
router.post('/goals/:goalId/complete', completeGoal);
router.post('/daily-reward/claim', claimDailyReward);

// Достижения
router.get('/achievements', getAchievements);

// Статистика
router.get('/stats', getStats);

// Публичный профиль пользователя (для Центра Влияния)
router.get('/user/:userId/profile', getUserProfile);

export default router;

