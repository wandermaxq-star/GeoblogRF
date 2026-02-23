// backend/src/routes/commentRoutes.js
// CRUD для комментариев с поддержкой модерации и вложенных ответов

import express from 'express';
import pool from '../../db.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../../logger.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/posts/:postId/comments
// Возвращает одобренные комментарии к посту (публично).
// Авторизованный пользователь также видит свои комментарии на модерации.
// ─────────────────────────────────────────────
router.get('/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;

  // Опциональная авторизация — смотрим, есть ли токен, но не требуем его
  let currentUserId = null;
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(
        authHeader.slice(7),
        process.env.JWT_SECRET || 'secret'
      );
      currentUserId = decoded.id || decoded.userId || null;
    } catch {
      // невалидный токен — игнорируем
    }
  }

  try {
    // Проверяем наличие таблицы
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'comments'
      ) AS exists`
    );
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }

    // Получаем комментарии:
    // - approved (active) для всех
    // - собственные pending — только для самого автора
    const result = await pool.query(
      `SELECT
          c.id,
          c.post_id,
          c.author_id,
          c.content,
          c.parent_id,
          c.status,
          c.likes_count,
          c.created_at,
          c.updated_at,
          u.username   AS author_name,
          u.avatar_url AS author_avatar,
          u.first_name AS author_first_name,
          u.last_name  AS author_last_name,
          -- лайкнул ли текущий пользователь
          CASE WHEN $2::uuid IS NOT NULL AND EXISTS(
            SELECT 1 FROM comment_likes cl
            WHERE cl.comment_id = c.id AND cl.user_id = $2::uuid
          ) THEN true ELSE false END AS user_liked
       FROM comments c
       LEFT JOIN users u ON c.author_id = u.id
       WHERE c.post_id = $1::bigint
         AND (
           c.status = 'active'
           OR (c.status = 'pending' AND $2::uuid IS NOT NULL AND c.author_id = $2::uuid)
         )
       ORDER BY c.created_at ASC`,
      [postId, currentUserId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('GET /posts/:postId/comments error', { error: err?.message });
    res.status(500).json({ message: 'Ошибка получения комментариев' });
  }
});

// ─────────────────────────────────────────────
// POST /api/posts/:postId/comments
// Создаёт новый комментарий (требует авторизации).
// Комментарий сразу идёт в status='pending' — ждёт модерации.
// ─────────────────────────────────────────────
router.post('/posts/:postId/comments', authenticateToken, async (req, res) => {
  const { postId } = req.params;
  const { content, parent_id } = req.body;
  const authorId = req.user?.id;

  if (!content?.trim()) {
    return res.status(400).json({ message: 'Текст комментария не может быть пустым' });
  }
  if (content.trim().length > 2000) {
    return res.status(400).json({ message: 'Комментарий слишком длинный (максимум 2000 символов)' });
  }
  if (!authorId) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  try {
    // Проверяем существование поста
    const postCheck = await pool.query(
      `SELECT id FROM posts WHERE id::text = $1 LIMIT 1`,
      [postId]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    // Если это ответ — проверяем существование родительского комментария
    if (parent_id) {
      const parentCheck = await pool.query(
        `SELECT id FROM comments WHERE id = $1 AND post_id = $2 LIMIT 1`,
        [parent_id, postId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Родительский комментарий не найден' });
      }
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, author_id, content, parent_id, status, is_public)
       VALUES ($1::bigint, $2::uuid, $3, $4, 'pending', false)
       RETURNING *`,
      [postId, authorId, content.trim(), parent_id || null]
    );

    const comment = result.rows[0];

    // Получаем данные автора для ответа
    const userResult = await pool.query(
      `SELECT username, avatar_url, first_name, last_name FROM users WHERE id = $1::uuid`,
      [authorId]
    );
    const user = userResult.rows[0] || {};

    logger.info(`Comment created: post=${postId}, author=${authorId}, status=pending`);

    res.status(201).json({
      ...comment,
      author_name: user.username,
      author_avatar: user.avatar_url,
      author_first_name: user.first_name,
      author_last_name: user.last_name,
      user_liked: false
    });
  } catch (err) {
    logger.error('POST /posts/:postId/comments error', { error: err?.message });
    res.status(500).json({ message: 'Ошибка создания комментария' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/posts/:postId/comments/:commentId
// Удаляет комментарий (только автор или admin).
// ─────────────────────────────────────────────
router.delete('/posts/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user?.id;
  const role = req.user?.role;

  try {
    const commentResult = await pool.query(
      `SELECT id, author_id, status FROM comments WHERE id = $1 AND post_id = $2::bigint LIMIT 1`,
      [commentId, postId]
    );
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }

    const comment = commentResult.rows[0];
    if (comment.author_id !== userId && role !== 'admin') {
      return res.status(403).json({ message: 'Нет прав для удаления этого комментария' });
    }

    await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId]);

    logger.info(`Comment deleted: id=${commentId}, by=${userId}`);
    res.json({ message: 'Комментарий удалён', id: Number(commentId) });
  } catch (err) {
    logger.error('DELETE /posts/:postId/comments/:commentId error', { error: err?.message });
    res.status(500).json({ message: 'Ошибка удаления комментария' });
  }
});

// ─────────────────────────────────────────────
// POST /api/posts/:postId/comments/:commentId/like
// Лайк / снятие лайка (toggle).
// ─────────────────────────────────────────────
router.post('/posts/:postId/comments/:commentId/like', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2::uuid`,
      [commentId, userId]
    );

    let liked;
    if (existing.rows.length > 0) {
      await client.query(`DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2::uuid`, [commentId, userId]);
      await client.query(`UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`, [commentId]);
      liked = false;
    } else {
      await client.query(`INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2::uuid)`, [commentId, userId]);
      await client.query(`UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1`, [commentId]);
      liked = true;
    }

    const updated = await client.query(`SELECT likes_count FROM comments WHERE id = $1`, [commentId]);
    await client.query('COMMIT');

    res.json({ liked, likes_count: updated.rows[0]?.likes_count ?? 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('POST comment like error', { error: err?.message });
    res.status(500).json({ message: 'Ошибка лайка' });
  } finally {
    client.release();
  }
});

export default router;
