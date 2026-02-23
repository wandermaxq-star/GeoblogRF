import request from 'supertest';
import express from 'express';
import { clearZones } from '../src/utils/zoneGuard.js';

let app;
let zonesRouter;

beforeAll(async () => {
  const mod = await import('../src/routes/zones.js');
  zonesRouter = mod.default;
  app = express();
  app.use(express.json());
  // Монтируем так же, как в server.js
  app.use('/api/zones', zonesRouter);
});

afterEach(() => {
  clearZones();
});

const testGeoJSON = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Test Zone', severity: 'restricted', type: 'military' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [37.613, 55.752],
        [37.623, 55.752],
        [37.623, 55.758],
        [37.613, 55.758],
        [37.613, 55.752],
      ]],
    },
  }],
};

describe('Zones API routes', () => {
  describe('GET /api/zones/all', () => {
    test('returns empty zones initially', async () => {
      const res = await request(app).get('/api/zones/all');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.zones).toEqual([]);
      expect(res.body.stats.total).toBe(0);
    });
  });

  describe('POST /api/zones/check', () => {
    test('check with no zones returns empty results', async () => {
      const res = await request(app)
        .post('/api/zones/check')
        .send({ points: [[37.618, 55.755]] })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results).toEqual([]);
    });

    test('check point inside imported zone returns hit', async () => {
      // Сначала добавим зону напрямую (без auth, через утилиту)
      const { addZonesFromGeoJSON } = await import('../src/utils/zoneGuard.js');
      addZonesFromGeoJSON(testGeoJSON);

      const res = await request(app)
        .post('/api/zones/check')
        .send({ points: [[37.618, 55.755]] })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].type).toBe('point');
      expect(res.body.results[0].zones[0].name).toBe('Test Zone');
    });

    test('check point outside zone returns no hits', async () => {
      const { addZonesFromGeoJSON } = await import('../src/utils/zoneGuard.js');
      addZonesFromGeoJSON(testGeoJSON);

      const res = await request(app)
        .post('/api/zones/check')
        .send({ points: [[30.0, 50.0]] })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    test('check lineString through zone returns zone hit', async () => {
      const { addZonesFromGeoJSON } = await import('../src/utils/zoneGuard.js');
      addZonesFromGeoJSON(testGeoJSON);

      const res = await request(app)
        .post('/api/zones/check')
        .send({
          lineString: [
            [37.610, 55.750],
            [37.618, 55.755],
            [37.630, 55.760],
          ]
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].type).toBe('line');
    });

    test('handles invalid points gracefully', async () => {
      const res = await request(app)
        .post('/api/zones/check')
        .send({ points: [[1]] }) // неполная точка
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results).toEqual([]);
    });

    test('handles empty body', async () => {
      const res = await request(app)
        .post('/api/zones/check')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('POST /api/zones/import (requires auth)', () => {
    test('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/zones/import')
        .send(testGeoJSON)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/zones/clear (requires auth)', () => {
    test('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/zones/clear');

      expect(res.status).toBe(401);
    });
  });
});
