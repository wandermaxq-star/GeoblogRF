import pool from '../../db.js';
import logger from '../../logger.js';
import {
  approveContent as facadeApprove,
  rejectContent as facadeReject,
  hideContent as facadeHide,
  getModerationStats as facadeStats,
  getTableMapping,
} from '../services/moderationFacade.js';

/**
 * Единый контроллер модерации для всех типов контента.
 * Вся бизнес-логика (XP, статусы) — в moderationFacade.js.
 */

// ── Получить pending-контент ────────────────────────────────────────
export const getPendingContent = async (req, res) => {
  try {
    const { contentType } = req.params;

    let query;

    switch (contentType) {
      case 'events':
        query = `
          SELECT e.*, u.username as creator_name
          FROM events e
          LEFT JOIN users u ON e.creator_id = u.id
          WHERE e.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd
              WHERE amd.content_type = 'events' AND amd.content_id::text = e.id::text
            )
          ORDER BY e.created_at DESC`;
        break;

      case 'posts':
        query = `
          SELECT p.*, u.username as creator_name
          FROM posts p
          LEFT JOIN users u ON p.author_id::text = u.id::text
          WHERE p.status = 'pending'
            AND (
              NOT EXISTS (
                SELECT 1 FROM ai_moderation_decisions amd
                WHERE amd.content_type = 'posts' AND amd.content_id::text = p.id::text
              )
              OR EXISTS (
                SELECT 1 FROM ai_moderation_decisions amd
                WHERE amd.content_type = 'posts' AND amd.content_id::text = p.id::text
                  AND amd.admin_verdict = 'pending'
              )
            )
          ORDER BY p.created_at DESC`;
        break;

      case 'routes':
        query = `
          SELECT r.*, u.username as creator_name
          FROM travel_routes r
          LEFT JOIN users u ON r.creator_id = u.id
          WHERE r.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd
              WHERE amd.content_type = 'routes' AND amd.content_id::text = r.id::text
            )
          ORDER BY r.created_at DESC`;
        break;

      case 'markers':
        query = `
          SELECT m.*, u.username as creator_name
          FROM map_markers m
          LEFT JOIN users u ON m.creator_id = u.id
          WHERE m.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd
              WHERE amd.content_type = 'markers' AND amd.content_id::text = m.id::text
            )
          ORDER BY m.created_at DESC`;
        break;

      case 'comments':
        query = `
          SELECT c.*, u.username as creator_name,
                 p.title as source_title, 'posts' as source_type, c.post_id as source_id
          FROM comments c
          LEFT JOIN users u ON c.author_id = u.id
          LEFT JOIN posts p ON c.post_id = p.id
          WHERE c.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd
              WHERE amd.content_type = 'comments' AND amd.content_id::text = c.id::text
            )
          ORDER BY c.created_at DESC`;
        break;

      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    logger.error(`Ошибка получения pending-контента (${req.params.contentType}):`, error);
    res.status(500).json({ message: 'Ошибка сервера при получении контента на модерации.' });
  }
};

// ── Одобрить контент (через фасад) ─────────────────────────────────
export const approveContent = async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const adminId = req.user?.id || req.user?.userId;

    const result = await facadeApprove(contentType, id, adminId);

    res.json({
      message: 'Контент одобрен и опубликован.',
      content: result.content,
      gamification: result.gamification,
    });
  } catch (error) {
    logger.error(`Ошибка одобрения контента (${req.params.contentType}):`, error);
    const status = error.message.includes('не найден') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Ошибка сервера.' });
  }
};

// ── Отклонить контент (soft delete через фасад) ─────────────────────
export const rejectContent = async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const adminId = req.user?.id || req.user?.userId;
    const { reason } = req.body || {};

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Необходимо указать причину отклонения.' });
    }

    const result = await facadeReject(contentType, id, adminId, reason);

    res.json({
      message: 'Контент отклонён.',
      content: result.content,
      reason: result.reason,
    });
  } catch (error) {
    logger.error(`Ошибка отклонения контента (${req.params.contentType}):`, error);
    const status = error.message.includes('не найден') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Ошибка сервера.' });
  }
};

// ── Скрыть контент ──────────────────────────────────────────────────
export const hideContent = async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const adminId = req.user?.id || req.user?.userId;

    const result = await facadeHide(contentType, id, adminId);

    res.json({ message: 'Контент скрыт.', content: result.content });
  } catch (error) {
    logger.error(`Ошибка скрытия контента (${req.params.contentType}):`, error);
    const status = error.message.includes('не найден') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Ошибка сервера.' });
  }
};

// ── Статистика модерации ────────────────────────────────────────────
export const getModerationStats = async (req, res) => {
  try {
    const stats = await facadeStats();
    res.json(stats);
  } catch (error) {
    logger.error('Ошибка получения статистики модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении статистики.' });
  }
};



