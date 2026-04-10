// backend/src/routes/hubRoutes.js
// Публичный Hub — список одобренных паков, рейтинги, покупки
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';

let pool;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const { pathToFileURL } = await import('url');
  const dbPath = path.join(__dirname, '..', '..', 'db.js');
  const poolModule = await import(pathToFileURL(dbPath).href);
  pool = poolModule.default || poolModule;
} catch (e) {
  console.warn('[hubRoutes] could not import db.js:', e.message);
}

const AUTHOR_SHARE_PERCENT = 70;

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// GET /api/hub/packs — каталог одобренных паков
// Query: ?kind=regional&free=true&sort=popular&limit=20&offset=0&q=текст
// ─────────────────────────────────────────────────────────────
router.get('/hub/packs', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { kind, free, sort = 'popular', limit = 20, offset = 0, q } = req.query;
  const params = ['approved'];
  const conditions = ['s.status = $1'];

  if (kind && ['federal', 'regional', 'event'].includes(kind)) {
    params.push(kind);
    conditions.push(`s.route_kind = $${params.length}`);
  }
  if (free === 'true') {
    conditions.push('s.price = 0');
  } else if (free === 'false') {
    conditions.push('s.price > 0');
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(s.title ILIKE $${params.length} OR s.summary ILIKE $${params.length})`);
  }

  const orderMap = {
    popular: 's.purchase_count DESC, s.download_count DESC',
    new:     's.published_at DESC',
    rating:  's.rating_avg DESC, s.rating_count DESC',
  };
  const orderBy = orderMap[sort] || orderMap.popular;

  params.push(Math.min(parseInt(limit) || 20, 100));
  params.push(Math.max(parseInt(offset) || 0, 0));

  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.subtitle, s.highlight, s.hero_metric,
              s.route_kind, s.tags, s.price, s.is_exclusive,
              s.distance_meters, s.duration_seconds,
              s.download_count, s.purchase_count, s.rating_avg, s.rating_count,
              s.tile_pack_ready, s.tile_pack_size_mb,
              s.published_at, s.waypoints,
              u.id AS author_id, u.username AS author_name, u.author_bio
       FROM route_pack_submissions s
       JOIN users u ON u.id = s.author_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[hubRoutes] GET /hub/packs error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/hub/packs/:id — детали одного пака
// ─────────────────────────────────────────────────────────────
router.get('/hub/packs/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.subtitle, s.summary, s.highlight, s.hero_metric,
              s.route_kind, s.tags, s.price, s.is_exclusive,
              s.polyline, s.waypoints, s.variants,
              s.distance_meters, s.duration_seconds,
              s.download_count, s.purchase_count, s.rating_avg, s.rating_count,
              s.tile_pack_ready, s.tile_pack_size_mb, s.tile_pack_url,
              s.published_at,
              u.id AS author_id, u.username AS author_name, u.author_bio, u.author_packs_published
       FROM route_pack_submissions s
       JOIN users u ON u.id = s.author_id
       WHERE s.id = $1 AND s.status = 'approved'`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Пак не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[hubRoutes] GET /hub/packs/:id error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/hub/packs/:id/rate — лайк/дизлайк (auth)
// Body: { vote: 1 | -1, review?: string }
// ─────────────────────────────────────────────────────────────
router.post('/hub/packs/:id/rate', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  const { vote, review } = req.body;
  if (vote !== 1 && vote !== -1)
    return res.status(400).json({ message: 'vote должен быть 1 или -1' });

  try {
    // Проверяем что пак существует и одобрен
    const pack = await pool.query(
      `SELECT id FROM route_pack_submissions WHERE id = $1 AND status = 'approved'`,
      [id]
    );
    if (pack.rows.length === 0) return res.status(404).json({ message: 'Пак не найден' });

    // Upsert рейтинга
    await pool.query(
      `INSERT INTO route_pack_ratings (pack_id, user_id, vote, review)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT uq_route_pack_ratings
       DO UPDATE SET vote = $3, review = COALESCE($4, route_pack_ratings.review)`,
      [id, req.user.id, vote, review?.trim() || null]
    );

    // Пересчитать rating_avg и rating_count
    const stats = await pool.query(
      `SELECT COUNT(*) AS cnt,
              ROUND(AVG(vote)::numeric, 2) AS avg
       FROM route_pack_ratings WHERE pack_id = $1`,
      [id]
    );
    const { cnt, avg } = stats.rows[0];
    await pool.query(
      `UPDATE route_pack_submissions
       SET rating_count = $2, rating_avg = $3
       WHERE id = $1`,
      [id, parseInt(cnt), parseFloat(avg) || 0]
    );

    res.json({ success: true, rating_avg: parseFloat(avg) || 0, rating_count: parseInt(cnt) });
  } catch (err) {
    console.error('[hubRoutes] POST /hub/packs/:id/rate error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/hub/packs/:id/purchase — купить пак (auth)
// ─────────────────────────────────────────────────────────────
router.post('/hub/packs/:id/purchase', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  try {
    // Получаем пак
    const packRes = await pool.query(
      `SELECT id, author_id, price FROM route_pack_submissions WHERE id = $1 AND status = 'approved'`,
      [id]
    );
    if (packRes.rows.length === 0) return res.status(404).json({ message: 'Пак не найден' });
    const pack = packRes.rows[0];

    // Проверяем, не куплен ли уже
    const existing = await pool.query(
      `SELECT id FROM user_purchased_route_packs WHERE user_id = $1 AND pack_id = $2`,
      [req.user.id, id]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ message: 'Пак уже куплен' });

    // Записать покупку
    await pool.query(
      `INSERT INTO user_purchased_route_packs (user_id, pack_id, source)
       VALUES ($1, $2, 'hub')
       ON CONFLICT DO NOTHING`,
      [req.user.id, id]
    );

    // Записать заработок автора (70/30)
    if (pack.price > 0 && pack.author_id !== req.user.id) {
      const authorShare = Math.round(pack.price * AUTHOR_SHARE_PERCENT / 100);
      const platformFee = pack.price - authorShare;
      await pool.query(
        `INSERT INTO author_earnings (author_id, pack_id, buyer_id, gross_amount, author_share, platform_fee)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pack.author_id, id, req.user.id, pack.price, authorShare, platformFee]
      );
      // Обновить total_earnings автора
      await pool.query(
        `UPDATE users SET author_total_earnings = author_total_earnings + $1 WHERE id = $2`,
        [authorShare, pack.author_id]
      );
    }

    // Увеличить purchase_count пака
    await pool.query(
      `UPDATE route_pack_submissions SET purchase_count = purchase_count + 1 WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[hubRoutes] POST /hub/packs/:id/purchase error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/hub/packs/:id/download-url — ссылка на тайлы (auth + purchased)
// ─────────────────────────────────────────────────────────────
router.get('/hub/packs/:id/download-url', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });

  const { id } = req.params;
  try {
    const packRes = await pool.query(
      `SELECT price, tile_pack_ready, tile_pack_url
       FROM route_pack_submissions WHERE id = $1 AND status = 'approved'`,
      [id]
    );
    if (packRes.rows.length === 0) return res.status(404).json({ message: 'Пак не найден' });
    const pack = packRes.rows[0];

    if (!pack.tile_pack_ready)
      return res.status(202).json({ message: 'Тайловый пак ещё генерируется' });

    // Для платных паков — проверить покупку
    if (pack.price > 0) {
      const purchased = await pool.query(
        `SELECT id FROM user_purchased_route_packs WHERE user_id = $1 AND pack_id = $2`,
        [req.user.id, id]
      );
      if (purchased.rows.length === 0)
        return res.status(403).json({ message: 'Пак не куплен' });
    }

    res.json({ url: pack.tile_pack_url });
  } catch (err) {
    console.error('[hubRoutes] GET download-url error:', err.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/hub/packs/:id/my-vote — мой голос за пак (auth)
// ─────────────────────────────────────────────────────────────
router.get('/hub/packs/:id/my-vote', authenticateToken, async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'БД недоступна' });
  try {
    const result = await pool.query(
      `SELECT vote FROM route_pack_ratings WHERE pack_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ vote: result.rows[0]?.vote ?? null });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
