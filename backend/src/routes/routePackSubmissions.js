// backend/src/routes/routePackSubmissions.js
// Эндпоинты для авторов и Admin — Route Pack Builder
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.js';

let pool;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const { pathToFileURL } = await import('url');
  const dbPath = path.join(__dirname, '..', '..', 'db.js');
  const poolModule = await import(pathToFileURL(dbPath).href);
  pool = poolModule.default || poolModule;
} catch (e) {
  console.warn('[routePackSubmissions] could not import db.js:', e.message);
}

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// AUTHOR ENDPOINTS
// ─────────────────────────────────────────────────────────────

// POST /api/route-pack-submissions — отправить пак на модерацию
router.post('/route-pack-submissions', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { title, subtitle, summary, route_kind, tags, highlight, hero_metric,
          polyline, waypoints, distance_meters, duration_seconds, variants,
          price, is_exclusive } = req.body;

  // Валидация обязательных полей
  if (!title || title.trim().length < 5)
    return res.status(400).json({ message: 'Название должно содержать минимум 5 символов' });
  if (!polyline || !Array.isArray(polyline) || polyline.length < 2)
    return res.status(400).json({ message: 'Маршрут должен содержать минимум 2 точки' });
  if (price !== undefined && (isNaN(price) || price < 0))
    return res.status(400).json({ message: 'Цена не может быть отрицательной' });
  if (!Array.isArray(polyline) || polyline.length > 10000)
    return res.status(400).json({ message: 'Маршрут содержит слишком много точек (max 10 000)' });

  try {
    const result = await pool.query(
      `INSERT INTO route_pack_submissions
        (author_id, title, subtitle, summary, route_kind, tags, highlight, hero_metric,
         polyline, waypoints, distance_meters, duration_seconds, variants,
         price, is_exclusive)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, status, submitted_at`,
      [
        req.user.id,
        title.trim(),
        subtitle?.trim() || '',
        summary?.trim() || '',
        route_kind || 'regional',
        tags || [],
        highlight?.trim() || '',
        hero_metric?.trim() || '',
        JSON.stringify(polyline),
        JSON.stringify(waypoints || []),
        distance_meters || null,
        duration_seconds || null,
        JSON.stringify(variants || []),
        parseInt(price) || 0,
        Boolean(is_exclusive),
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[routePackSubmissions] POST error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/route-pack-submissions/my — мои паки
router.get('/route-pack-submissions/my', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });
  try {
    const result = await pool.query(
      `SELECT id, title, route_kind, status, moderation_comment,
              submitted_at, published_at, price, is_exclusive,
              download_count, purchase_count, rating_avg, rating_count,
              tile_pack_ready, tile_pack_size_mb
       FROM route_pack_submissions
       WHERE author_id = $1
       ORDER BY submitted_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[routePackSubmissions] GET my error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/route-pack-submissions/:id — редактировать пак (только pending/revision)
router.patch('/route-pack-submissions/:id', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  // Проверяем владельца и статус
  const check = await pool.query(
    `SELECT author_id, status FROM route_pack_submissions WHERE id = $1`,
    [id]
  );
  if (check.rows.length === 0) return res.status(404).json({ message: 'Пак не найден' });
  if (check.rows[0].author_id !== req.user.id)
    return res.status(403).json({ message: 'Нет доступа' });
  if (!['pending', 'revision'].includes(check.rows[0].status))
    return res.status(400).json({ message: 'Нельзя редактировать одобренный или отклонённый пак' });

  const { title, subtitle, summary, route_kind, tags, highlight, hero_metric,
          polyline, waypoints, distance_meters, duration_seconds, variants,
          price, is_exclusive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE route_pack_submissions SET
        title           = COALESCE($2, title),
        subtitle        = COALESCE($3, subtitle),
        summary         = COALESCE($4, summary),
        route_kind      = COALESCE($5, route_kind),
        tags            = COALESCE($6, tags),
        highlight       = COALESCE($7, highlight),
        hero_metric     = COALESCE($8, hero_metric),
        polyline        = COALESCE($9, polyline),
        waypoints       = COALESCE($10, waypoints),
        distance_meters = COALESCE($11, distance_meters),
        duration_seconds= COALESCE($12, duration_seconds),
        variants        = COALESCE($13, variants),
        price           = COALESCE($14, price),
        is_exclusive    = COALESCE($15, is_exclusive),
        status          = 'pending'
       WHERE id = $1
       RETURNING id, status`,
      [
        id,
        title?.trim() || null,
        subtitle?.trim() || null,
        summary?.trim() || null,
        route_kind || null,
        tags || null,
        highlight?.trim() || null,
        hero_metric?.trim() || null,
        polyline ? JSON.stringify(polyline) : null,
        waypoints ? JSON.stringify(waypoints) : null,
        distance_meters || null,
        duration_seconds || null,
        variants ? JSON.stringify(variants) : null,
        price !== undefined ? parseInt(price) : null,
        is_exclusive !== undefined ? Boolean(is_exclusive) : null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[routePackSubmissions] PATCH error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/route-pack-submissions/:id — удалить неопубликованный пак
router.delete('/route-pack-submissions/:id', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  const check = await pool.query(
    `SELECT author_id, status FROM route_pack_submissions WHERE id = $1`,
    [id]
  );
  if (check.rows.length === 0) return res.status(404).json({ message: 'Пак не найден' });
  if (check.rows[0].author_id !== req.user.id)
    return res.status(403).json({ message: 'Нет доступа' });
  if (check.rows[0].status === 'approved')
    return res.status(400).json({ message: 'Нельзя удалить опубликованный пак' });

  try {
    await pool.query('DELETE FROM route_pack_submissions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[routePackSubmissions] DELETE error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────

// GET /api/admin/pack-submissions — очередь модерации
router.get('/admin/pack-submissions', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const status = req.query.status || 'pending';
  const countOnly = req.query.count === 'true';

  try {
    if (countOnly) {
      const r = await pool.query(
        `SELECT COUNT(*) FROM route_pack_submissions WHERE status = $1`,
        [status]
      );
      return res.json({ count: parseInt(r.rows[0].count) });
    }

    const result = await pool.query(
      `SELECT s.id, s.title, s.subtitle, s.route_kind, s.status, s.price, s.is_exclusive,
              s.distance_meters, s.duration_seconds, s.submitted_at, s.moderation_comment,
              s.waypoints, s.tags, s.highlight, s.hero_metric,
              u.id AS author_id, u.username AS author_name, u.email AS author_email
       FROM route_pack_submissions s
       JOIN users u ON u.id = s.author_id
       WHERE s.status = $1
       ORDER BY s.submitted_at ASC`,
      [status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[routePackSubmissions] admin GET error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/pack-submissions/:id/approve
router.patch('/admin/pack-submissions/:id/approve', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE route_pack_submissions
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2, published_at = NOW(), moderation_comment = NULL
       WHERE id = $1`,
      [id, req.user.id]
    );

    // Обновляем счётчик публикаций у автора
    await pool.query(
      `UPDATE users SET author_packs_published = author_packs_published + 1
       WHERE id = (SELECT author_id FROM route_pack_submissions WHERE id = $1)`,
      [id]
    );

    // Запустить тайловый pipeline асинхронно (не блокируем ответ)
    import('../services/tilePackService.js')
      .then(m => (m.default || m).enqueueTilePack(id))
      .catch(err => console.warn('[tilePackService] enqueue failed:', err.message));

    res.json({ success: true, status: 'approved' });
  } catch (err) {
    console.error('[routePackSubmissions] approve error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/pack-submissions/:id/reject
router.patch('/admin/pack-submissions/:id/reject', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ message: 'Укажите причину отклонения' });

  try {
    await pool.query(
      `UPDATE route_pack_submissions
       SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $2, moderation_comment = $3
       WHERE id = $1`,
      [id, req.user.id, comment.trim()]
    );
    res.json({ success: true, status: 'rejected' });
  } catch (err) {
    console.error('[routePackSubmissions] reject error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/pack-submissions/:id/revision
router.patch('/admin/pack-submissions/:id/revision', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ message: 'Укажите что нужно доработать' });

  try {
    await pool.query(
      `UPDATE route_pack_submissions
       SET status = 'revision', reviewed_at = NOW(), reviewed_by = $2, moderation_comment = $3
       WHERE id = $1`,
      [id, req.user.id, comment.trim()]
    );
    res.json({ success: true, status: 'revision' });
  } catch (err) {
    console.error('[routePackSubmissions] revision error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/users/become-author — стать автором паков
router.patch('/users/become-author', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });
  try {
    await pool.query(
      `UPDATE users SET is_pack_author = TRUE WHERE id = $1`,
      [req.user.id]
    );
    res.json({ success: true, is_pack_author: true });
  } catch (err) {
    console.error('[routePackSubmissions] become-author error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
