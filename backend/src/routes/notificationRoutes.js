/**
 * Маршруты уведомлений пользователя.
 * Все роуты требуют аутентификации.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotifications,
  getNotificationsUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateToken);

// GET  /notifications              — список уведомлений (?limit, offset, unreadOnly)
router.get('/', getNotifications);

// GET  /notifications/unread-count — кол-во непрочитанных
router.get('/unread-count', getNotificationsUnreadCount);

// POST /notifications/read-all    — отметить все как прочитанные
router.post('/read-all', markAllNotificationsRead);

// POST /notifications/:id/read    — отметить одно как прочитанное
router.post('/:id/read', markNotificationRead);

export default router;
