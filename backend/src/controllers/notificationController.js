/**
 * Контроллер уведомлений пользователя.
 */

import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService.js';
import logger from '../../logger.js';

/** GET /notifications — список уведомлений текущего пользователя */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Требуется авторизация.' });

    const { limit = 20, offset = 0, unreadOnly } = req.query;

    const result = await getUserNotifications(userId, {
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      offset: parseInt(offset, 10) || 0,
      unreadOnly: unreadOnly === 'true',
    });

    res.json(result);
  } catch (error) {
    logger.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

/** GET /notifications/unread-count — количество непрочитанных */
export const getNotificationsUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Требуется авторизация.' });

    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    logger.error('Ошибка получения счётчика уведомлений:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

/** POST /notifications/:id/read — отметить как прочитанное */
export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Требуется авторизация.' });

    await markAsRead(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка отметки уведомления:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

/** POST /notifications/read-all — отметить все как прочитанные */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Требуется авторизация.' });

    await markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка отметки всех уведомлений:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};
