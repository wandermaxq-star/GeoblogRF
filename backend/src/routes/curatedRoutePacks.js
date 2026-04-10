import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// when running under Jest we avoid touching the database; use static packs
let pool;
if (process.env.NODE_ENV !== 'test') {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dbPath = path.join(__dirname, '..', '..', 'db.js');
    // convert to file URL for reliable dynamic import on Windows
    const { pathToFileURL } = await import('url');
    const poolModule = await import(pathToFileURL(dbPath).href);
    pool = poolModule.default || poolModule;
  } catch (e) {
    console.warn('[curatedRoutePacks] could not import db.js, static fallback will be used', e.message);
  }
} else {
  console.warn('[curatedRoutePacks] running in test mode, skipping DB access');
} 
import packs from '../data/curatedRoutePacks.js';
import { logAffiliateEvent } from '../services/affiliateService.js';

const router = express.Router();

// ensure database tables exist; this runs once when module is loaded, with retry
if (pool) {
  (async () => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS curated_route_packs (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_purchased_route_packs (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pack_id TEXT NOT NULL,
        source TEXT DEFAULT 'direct',
        purchased_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT user_purchased_route_packs_unique UNIQUE(user_id, pack_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_user_purchased_packs_user ON user_purchased_route_packs(user_id)`,
      `CREATE TABLE IF NOT EXISTS route_ratings (
        id SERIAL PRIMARY KEY,
        route_id UUID NOT NULL REFERENCES travel_routes(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT route_ratings_unique UNIQUE(route_id, user_id)
      )`,
    ];
    for (const sql of tables) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await pool.query(sql);
          break; // success, move to next statement
        } catch (err) {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 2000));
          } else {
            console.warn('[curatedRoutePacks] failed to create table after 3 attempts:', err.message);
          }
        }
      }
    }
  })();
}
// List all curated packs (read-only for MVP)
router.get('/curated-route-packs', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT data FROM curated_route_packs ORDER BY id');
      if (result.rows.length > 0) {
        return res.json(result.rows.map((r) => r.data));
      }
    } catch (err) {
      console.error('[curatedRoutePacks] list failure', err);
    }
  }
  // fallback to static list when DB is missing/empty
  res.json(packs);
});

// Get a single pack by id
router.get('/curated-route-packs/:id', async (req, res) => {
  const id = req.params.id;
  if (pool) {
    try {
      const result = await pool.query('SELECT data FROM curated_route_packs WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        return res.json(result.rows[0].data);
      }
    } catch (err) {
      console.error('[curatedRoutePacks] item query failure', err);
    }
  }
  // fallback to static
  const pack = packs.find((p) => p.id === id);
  if (!pack) {
    return res.status(404).json({ message: 'Pack not found' });
  }
  res.json(pack);
});

// Purchase curated pack (покупка пакета, привязка к пользователю)
router.post('/curated-route-packs/:id/purchase', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const packId = req.params.id;

  if (!userId) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO user_purchased_route_packs(user_id, pack_id, source) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, pack_id) DO NOTHING`,
        [userId, packId, 'direct']
      );

      // начисляем партнёрский event (платный пакет)
      const purchasedPack = packs.find((p) => p.id === packId);
      if (purchasedPack) {
        // ищем referrer по куки/коду в users
        const referrerQuery = await pool.query(
          `SELECT referred_by FROM users WHERE id = $1`,
          [userId]
        );
        const referrerId = referrerQuery.rows[0]?.referred_by || null;

        if (referrerId) {
          const amount = purchasedPack.price ?? 0;
          await logAffiliateEvent({ referredUserId: userId, referrerId, eventType: 'paid_pack', amount });
        }
      }

      return res.json({ message: 'Пакет куплен', pack_id: packId });
    } catch (err) {
      console.error('[curatedRoutePacks] purchase error', err);
      return res.status(500).json({ message: 'Ошибка при покупке пакета' });
    }
  }

  // static fallback (фейковый)
  const pack = packs.find((p) => p.id === packId);
  if (!pack) {
    return res.status(404).json({ message: 'Pack not found' });
  }
  return res.json({ message: 'Пакет куплен (static mode)', pack_id: packId });
});

// List purchased packs for user
router.get('/users/purchased-route-packs', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  if (!userId) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  if (pool) {
    try {
      const result = await pool.query(
        'SELECT pack_id FROM user_purchased_route_packs WHERE user_id = $1',
        [userId]
      );
      return res.json({ purchased_packs: result.rows.map((row) => row.pack_id) });
    } catch (err) {
      console.error('[curatedRoutePacks] user purchased list error', err);
      return res.status(500).json({ message: 'Ошибка при получении списка пакетов' });
    }
  }

  return res.json({ purchased_packs: [] });
});

// --- Admin CRUD for curated packs ---

// create
router.post('/curated-route-packs', authenticateToken, requireRole(['admin']), async (req, res) => {
  const newPack = req.body;
  if (!newPack || !newPack.id) {
    return res.status(400).json({ message: 'Invalid pack payload' });
  }
  if (!pool) {
    // static fallback
    if (packs.find((p) => p.id === newPack.id)) {
      return res.status(409).json({ message: 'Pack with this id already exists' });
    }
    packs.push(newPack);
    return res.status(201).json(newPack);
  }
  try {
    await pool.query(
      'INSERT INTO curated_route_packs(id, data) VALUES($1, $2)',
      [newPack.id, newPack],
    );
    return res.status(201).json(newPack);
  } catch (err) {
    console.error('[curatedRoutePacks] insert error', err);
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ message: 'Pack with this id already exists' });
    }
    return res.status(500).json({ message: 'Database error' });
  }
});

// update
router.put('/curated-route-packs/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = req.params.id;
  const changes = req.body;
  if (!pool) {
    const idx = packs.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Pack not found' });
    const updated = { ...packs[idx], ...changes };
    packs[idx] = updated;
    return res.json(updated);
  }
  try {
    const result = await pool.query(
      'UPDATE curated_route_packs SET data = data || $2 WHERE id = $1 RETURNING data',
      [id, changes],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pack not found' });
    }
    return res.json(result.rows[0].data);
  } catch (err) {
    console.error('[curatedRoutePacks] update error', err);
    return res.status(500).json({ message: 'Database error' });
  }
});

// delete
router.delete('/curated-route-packs/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = req.params.id;
  if (!pool) {
    const idx = packs.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Pack not found' });
    packs.splice(idx, 1);
    return res.status(204).end();
  }
  try {
    const result = await pool.query('DELETE FROM curated_route_packs WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pack not found' });
    }
    return res.status(204).end();
  } catch (err) {
    console.error('[curatedRoutePacks] delete error', err);
    return res.status(500).json({ message: 'Database error' });
  }
});

export default router;