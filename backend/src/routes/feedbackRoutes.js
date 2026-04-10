import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  submitFeedback,
  getFeedbackList,
  getFeedbackById,
  updateFeedbackStatus,
  getFeedbackStats,
} from '../controllers/feedbackController.js';
import logger from '../../logger.js';

const router = express.Router();

// Отправка feedback - требует авторизации
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    await submitFeedback(req, res);
  } catch (err) {
    logger.error('POST /feedback/submit error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Все остальные маршруты требуют роли admin
router.use(authenticateToken, requireRole(['admin']));

// Получить статистику
router.get('/admin/stats', async (req, res) => {
  try {
    await getFeedbackStats(req, res);
  } catch (err) {
    logger.error('GET /feedback/admin/stats error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить список feedback
router.get('/admin/list', async (req, res) => {
  try {
    await getFeedbackList(req, res);
  } catch (err) {
    logger.error('GET /feedback/admin/list error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить один feedback
router.get('/admin/:id', async (req, res) => {
  try {
    await getFeedbackById(req, res);
  } catch (err) {
    logger.error('GET /feedback/admin/:id error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновить статус feedback
router.patch('/admin/:id/status', async (req, res) => {
  try {
    await updateFeedbackStatus(req, res);
  } catch (err) {
    logger.error('PATCH /feedback/admin/:id/status error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
