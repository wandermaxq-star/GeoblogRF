import express from 'express';
// zones API disabled; handlers return empty results without touching disk
import { getZonesFilePath } from '../utils/lazyZoneGuard.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/zones/check  (mounted at /api/zones in server.js)
// Zones endpoint is a no-op while feature is disabled
router.post('/check', async (_req, res) => {
  res.json({ ok: true, results: [] });
});

// Middleware для проверки локального импорта (allow localhost + имеет админский токен)
const authOrLocalhost = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  const isLocalhost = clientIP === '127.0.0.1' || clientIP === 'localhost' || clientIP === '::1';
  
  if (isLocalhost) {
    // Локальные запросы (0.0.0.0, localhost, 127.0.0.1) разрешены без токена
    return next();
  }
  
  // Иначе требуем аутентификацию и роль админа
  return authenticateToken(req, res, () => {
    return requireRole(['admin'])(req, res, next);
  });
};

// Admin endpoints
router.post('/import', authOrLocalhost, async (_req, res) => {
  // feature temporarily disabled
  res.status(503).json({ ok: false, message: 'Zone import unavailable' });
});

router.post('/clear', authOrLocalhost, async (_req, res) => {
  res.status(503).json({ ok: false, message: 'Zone clear unavailable' });
});

// Get all zones - now always returns empty payload
router.get('/all', async (_req, res) => {
  res.json({ ok: true, stats: { total: 0, bySeverity: {}, byType: {} }, geojson: { type: 'FeatureCollection', features: [] }, zones: [] });
});

export default router;

