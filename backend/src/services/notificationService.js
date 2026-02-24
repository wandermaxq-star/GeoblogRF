/**
 * СЕРВИС УВЕДОМЛЕНИЙ
 *
 * Создаёт in-app уведомления для пользователей.
 * Используется модерацией для информирования авторов о результатах.
 */

import pool from '../../db.js';
import logger from '../../logger.js';

/**
 * Создать уведомление для пользователя.
 * @param {string} userId - UUID пользователя
 * @param {object} params - параметры уведомления
 * @param {string} params.type - тип (moderation, system, xp, etc.)
 * @param {string} params.title - заголовок
 * @param {string} params.message - текст
 * @param {string} [params.contentType] - тип контента
 * @param {string} [params.contentId] - ID контента
 * @param {object} [params.metadata] - доп. данные
 * @param {object} [client] - PG-клиент (для транзакций)
 */
export async function createNotification(userId, { type = 'moderation', title, message, contentType, contentId, metadata }, client) {
  const db = client || pool;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, content_type, content_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, title, message, contentType || null, contentId ? String(contentId) : null, metadata ? JSON.stringify(metadata) : null],
    );
    logger.info(`🔔 Уведомление для ${userId}: ${title}`);
  } catch (err) {
    logger.warn(`Не удалось создать уведомление для ${userId}: ${err.message}`);
  }
}

/**
 * Уведомить автора об одобрении контента.
 */
export async function notifyContentApproved(authorId, contentType, contentId, contentTitle, client) {
  const typeLabels = {
    events: 'Событие', posts: 'Пост', routes: 'Маршрут',
    markers: 'Метка', comments: 'Комментарий',
  };
  const label = typeLabels[contentType] || contentType;
  const title = `✅ ${label} одобрен`;
  const name = contentTitle || `#${contentId}`;
  const message = `Ваш контент «${name}» прошёл модерацию и опубликован.`;

  await createNotification(authorId, {
    type: 'moderation',
    title,
    message,
    contentType,
    contentId,
    metadata: { action: 'approved' },
  }, client);
}

/**
 * Уведомить автора об отклонении контента.
 */
export async function notifyContentRejected(authorId, contentType, contentId, contentTitle, reason, client) {
  const typeLabels = {
    events: 'Событие', posts: 'Пост', routes: 'Маршрут',
    markers: 'Метка', comments: 'Комментарий',
  };
  const label = typeLabels[contentType] || contentType;
  const title = `❌ ${label} отклонён`;
  const name = contentTitle || `#${contentId}`;
  const message = `Ваш контент «${name}» отклонён модератором.${reason ? `\nПричина: ${reason}` : ''}`;

  await createNotification(authorId, {
    type: 'moderation',
    title,
    message,
    contentType,
    contentId,
    metadata: { action: 'rejected', reason },
  }, client);
}

/**
 * Уведомить автора о необходимости доработки.
 */
export async function notifyContentRevision(authorId, contentType, contentId, contentTitle, reason, client) {
  const typeLabels = {
    events: 'Событие', posts: 'Пост', routes: 'Маршрут',
    markers: 'Метка', comments: 'Комментарий',
  };
  const label = typeLabels[contentType] || contentType;
  const title = `🔄 ${label} отправлен на доработку`;
  const name = contentTitle || `#${contentId}`;
  const message = `Ваш контент «${name}» требует доработки.${reason ? `\nКомментарий модератора: ${reason}` : ''}`;

  await createNotification(authorId, {
    type: 'moderation',
    title,
    message,
    contentType,
    contentId,
    metadata: { action: 'revision', reason },
  }, client);
}

/**
 * Получить уведомления пользователя.
 */
export async function getUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  const conditions = ['user_id = $1'];
  const params = [userId];

  if (unreadOnly) {
    conditions.push('is_read = false');
  }

  const result = await pool.query(
    `SELECT * FROM notifications
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM notifications WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return {
    notifications: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Количество непрочитанных уведомлений.
 */
export async function getUnreadCount(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Отметить уведомление как прочитанное.
 */
export async function markAsRead(notificationId, userId) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [notificationId, userId],
  );
}

/**
 * Отметить все уведомления пользователя как прочитанные.
 */
export async function markAllAsRead(userId) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId],
  );
}
