import express from 'express';
import { checkPointAgainstZones, checkLineAgainstZones, addZonesFromGeoJSON, clearZones, getZonesStats, getZonesSnapshot, getZonesFilePath } from '../utils/zoneGuard.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/zones/check  (mounted at /api/zones in server.js)
router.post('/check', async (req, res) => {
  try {
    const { points, lineString } = req.body || {};
    const results = [];

    if (Array.isArray(points)) {
      for (const p of points) {
        if (!Array.isArray(p) || p.length !== 2) continue;
        const [lon, lat] = p.map(Number);
        const zones = await checkPointAgainstZones(lon, lat);
        if (zones && zones.length) {
          results.push({ type: 'point', lon, lat, zones });
        }
      }
    }

    if (Array.isArray(lineString) && lineString.length >= 2) {
      const coords = lineString.map(([lon, lat]) => [Number(lon), Number(lat)]);
      const zones = await checkLineAgainstZones(coords);
      if (zones && zones.length) {
        results.push({ type: 'line', zones });
      }
    }

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Zone check failed', error: e?.message });
  }
});

// Admin endpoints
router.post('/import', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const geojson = req.body;
    if (!geojson) return res.status(400).json({ ok: false, message: 'GeoJSON required' });
    // addZonesFromGeoJSON теперь автоматически сохраняет на диск
    const count = addZonesFromGeoJSON(geojson);
    res.json({ ok: true, imported: count, stats: getZonesStats(), persisted: getZonesFilePath() });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Import failed', error: e?.message });
  }
});

router.post('/clear', authenticateToken, requireRole(['admin']), async (_req, res) => {
  clearZones(/* persistAfterClear= */ true);
  res.json({ ok: true, stats: getZonesStats() });
});

// Get all zones (for map rendering)
router.get('/all', async (_req, res) => {
  try {
    const stats = getZonesStats();
    const zones = getZonesSnapshot();
    res.json({ ok: true, stats, zones });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Failed to list zones', error: e?.message });
  }
});

export default router;

