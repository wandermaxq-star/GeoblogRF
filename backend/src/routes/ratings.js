import express from 'express';
import pool from '../../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Ensure ratings table exists
async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type VARCHAR(32) NOT NULL CHECK (target_type IN ('marker','route','event','post')),
        target_id UUID NOT NULL,
        value INTEGER NOT NULL CHECK (value >= 1 AND value <= 5),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, target_type, target_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_type, target_id);
    `);
  } catch (error) {
    // Игнорируем ошибки создания таблицы (может уже существовать)
    console.warn('Ratings table creation warning:', error.message);
  }
}

// Helper: get summary
async function getSummary(targetType, targetId) {
  try {
    // Проверяем, является ли ID числом (старый формат) или UUID
    const isNumeric = /^\d+$/.test(targetId);
    
    // Для числовых ID не можем найти в UUID поле - возвращаем пустые значения
    if (isNumeric) {
      return { avg: 0, count: 0 };
    }
    
    // Если ID не числовой, ищем как UUID
    const { rows } = await pool.query(
      `SELECT COALESCE(AVG(value),0)::numeric(3,2) AS avg, COUNT(*)::int AS count
       FROM ratings WHERE target_type = $1 AND target_id = $2`,
      [targetType, targetId]
    );
    const avg = parseFloat(rows[0]?.avg) || 0;
    const count = Number(rows[0]?.count) || 0;
    return { avg, count };
  } catch (error) {
    // Если ошибка связана с форматом UUID, возвращаем пустые значения
    if (error.message && error.message.includes('invalid input syntax for type uuid')) {
      return { avg: 0, count: 0 };
    }
    console.error('Error in getSummary:', error);
    return { avg: 0, count: 0 };
  }
}

// Upsert rating
router.post('/ratings', authenticateToken, async (req, res) => {
  try {
    await ensureTable();
    const userId = req.user.id;
    const { target_type, target_id, value } = req.body || {};
    const targetType = String(target_type || '').toLowerCase();
    const targetId = String(target_id || '');

    if (!['marker','route','event','post'].includes(targetType)) {
      return res.status(400).json({ ok: false, message: 'Invalid target_type' });
    }
    const intValue = Number(value);
    if (!Number.isInteger(intValue) || intValue < 1 || intValue > 5) {
      return res.status(400).json({ ok: false, message: 'Invalid value' });
    }

    // Проверяем, является ли ID числом (старый формат) или UUID
    const isNumeric = /^\d+$/.test(targetId);
    
    if (isNumeric) {
      // Если ID числовой, не можем сохранить в UUID поле - пропускаем
      // В будущем можно создать маппинг числовых ID на UUID
      return res.status(400).json({ 
        ok: false, 
        message: 'Numerical event IDs are not supported for ratings. Please use UUID format.' 
      });
    }
    
    await pool.query(
      `INSERT INTO ratings (user_id, target_type, target_id, value)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, target_type, target_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [userId, targetType, targetId, intValue]
    );

    const summary = await getSummary(targetType, targetId);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to rate', error: e?.message });
  }
});

// Fetch summary
router.get('/ratings/summary', async (req, res) => {
  try {
    await ensureTable();
    const targetType = String(req.query.type || '').toLowerCase();
    const targetId = String(req.query.id || '');
    
    if (!targetType || !targetId) {
      return res.status(400).json({ ok: false, message: 'Missing required params: type and id' });
    }
    
    if (!['marker','route','event','post'].includes(targetType)) {
      return res.status(400).json({ ok: false, message: 'Invalid target_type' });
    }
    
    // Для числовых ID возвращаем пустой рейтинг (не поддерживаются)
    const isNumeric = /^\d+$/.test(targetId);
    if (isNumeric) {
      return res.json({ ok: true, summary: { avg: 0, count: 0 } });
    }
    
    const summary = await getSummary(targetType, targetId);
    res.json({ ok: true, summary });
  } catch (e) {
    console.error('Error getting rating summary:', e);
    // Для числовых ID возвращаем пустой рейтинг вместо ошибки
    const targetId = String(req.query.id || '');
    const isNumeric = /^\d+$/.test(targetId);
    if (isNumeric) {
      return res.json({ ok: true, summary: { avg: 0, count: 0 } });
    }
    res.status(500).json({ ok: false, message: 'Failed to get summary', error: e?.message });
  }
});

// Fetch current user's rating for a target
router.get('/ratings/user', authenticateToken, async (req, res) => {
  try {
    await ensureTable();
    const userId = req.user.id;
    const targetType = String(req.query.type || '').toLowerCase();
    const targetId = String(req.query.id || '');
    
    if (!targetType || !targetId) {
      return res.status(400).json({ ok: false, message: 'Missing required params: type and id' });
    }
    
    if (!['marker','route','event','post'].includes(targetType)) {
      return res.status(400).json({ ok: false, message: 'Invalid target_type' });
    }
    
    // Проверяем, является ли ID числом (старый формат) или UUID
    const isNumeric = /^\d+$/.test(targetId);
    
    // Если ID числовой, не можем найти в UUID поле - возвращаем null
    if (isNumeric) {
      return res.json({ ok: true, value: null });
    }
    
    const { rows } = await pool.query(
      `SELECT value FROM ratings WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
      [userId, targetType, targetId]
    );
    res.json({ ok: true, value: rows[0]?.value ?? null });
  } catch (e) {
    console.error('Error getting user rating:', e);
    // Для числовых ID возвращаем null вместо ошибки
    const targetId = String(req.query.id || '');
    const isNumeric = /^\d+$/.test(targetId);
    if (isNumeric) {
      return res.json({ ok: true, value: null });
    }
    res.status(500).json({ ok: false, message: 'Failed to get user rating', error: e?.message });
  }
});

export default router;


