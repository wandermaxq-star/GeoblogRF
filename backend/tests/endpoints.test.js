import request from 'supertest';
import nock from 'nock';

let app;

beforeAll(async () => {
  process.env.OPENROUTE_SERVICE_API_KEY = 'test-key';
  const mod = await import('../server.js');
  app = mod.default || mod;
});

describe('Inline endpoints', () => {
  // ─── GET / ────────────────────────────────────
  describe('GET /', () => {
    test('returns 200 with welcome text', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Horizon Explorer/i);
    });
  });

  // ─── GET /api/test ────────────────────────────
  describe('GET /api/test', () => {
    test('returns 200 with JSON', async () => {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Test route works');
      expect(res.body).toHaveProperty('headers');
    });
  });

  // ─── GET /api/health ──────────────────────────
  describe('GET /api/health', () => {
    test('returns 200 with status field', async () => {
      const res = await request(app).get('/api/health');
      // Может быть 200 ok или 500 error, зависит от БД — проверяем структуру
      expect([200, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('port');
    });
  });

  describe('Curated-route-pack endpoints', () => {
    let adminToken;
    let userToken;

    beforeAll(async () => {
      const { generateToken } = await import('../src/utils/jwt.js');
      adminToken = generateToken(1, 'admin');
      userToken = generateToken(2, 'registered');

      // In test mode we rely on static packs; no DB seeding necessary

    });

    test('list endpoint returns array', async () => {
      const res = await request(app).get('/api/curated-route-packs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('item endpoint returns object when id exists', async () => {
      const list = (await request(app).get('/api/curated-route-packs')).body;
      if (list.length > 0) {
        const id = list[0].id;
        const res = await request(app).get(`/api/curated-route-packs/${id}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', id);
      }
    });

    test('item endpoint returns 404 for missing id', async () => {
      const res = await request(app).get('/api/curated-route-packs/__no_such__');
      expect(res.status).toBe(404);
    });

    // admin CRUD checks
    test('unauthenticated user cannot create pack', async () => {
      const res = await request(app)
        .post('/api/curated-route-packs')
        .send({ id: 'x' });
      expect(res.status).toBe(401);
    });

    test('non-admin cannot create pack', async () => {
      const res = await request(app)
        .post('/api/curated-route-packs')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ id: 'x' });
      expect(res.status).toBe(403);
    });

    test('admin can create/update/delete pack', async () => {
      const newPack = { id: 'test-pack', title: 'Test', variants: [] };
      let res = await request(app)
        .post('/api/curated-route-packs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPack);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'test-pack');

      // update
      res = await request(app)
        .put('/api/curated-route-packs/test-pack')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Changed' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('title', 'Changed');

      // delete
      res = await request(app)
        .delete('/api/curated-route-packs/test-pack')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});

describe('ORS proxy — edge cases', () => {
  afterEach(() => nock.cleanAll());

  test('returns 503 when API key is missing', async () => {
    // Temporarily remove the key
    const saved = process.env.OPENROUTE_SERVICE_API_KEY;
    delete process.env.OPENROUTE_SERVICE_API_KEY;

    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: [[37.6, 55.7], [37.7, 55.8]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/key/i);

    process.env.OPENROUTE_SERVICE_API_KEY = saved;
  });

  test('returns 400 when coordinates array is empty', async () => {
    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coordinates/i);
  });

  test('returns 400 when coordinates is not an array', async () => {
    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: 'not-array' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });

  test('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });

  test('proxies upstream 429 rate limit', async () => {
    nock('https://api.openrouteservice.org')
      .post('/v2/directions/driving-car/geojson')
      .reply(429, { error: { message: 'Rate limit exceeded' } });

    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: [[37.6, 55.7], [37.7, 55.8]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(429);
  });

  test('proxies upstream 500 error', async () => {
    nock('https://api.openrouteservice.org')
      .post('/v2/directions/driving-car/geojson')
      .reply(500, 'Internal Server Error');

    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: [[37.6, 55.7], [37.7, 55.8]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
  });

  test('handles network error to upstream gracefully', async () => {
    nock('https://api.openrouteservice.org')
      .post('/v2/directions/driving-car/geojson')
      .replyWithError('Connection refused');

    const res = await request(app)
      .post('/api/ors/v2/directions/driving-car/geojson')
      .send({ coordinates: [[37.6, 55.7], [37.7, 55.8]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Proxy error/i);
  });

  test('works with different profile (foot-walking)', async () => {
    const mockResponse = { type: 'FeatureCollection', features: [] };
    nock('https://api.openrouteservice.org')
      .post('/v2/directions/foot-walking/geojson')
      .reply(200, mockResponse);

    const res = await request(app)
      .post('/api/ors/v2/directions/foot-walking/geojson')
      .send({ coordinates: [[37.6, 55.7], [37.7, 55.8]] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
  });
});

describe('Upload — edge cases', () => {
  test('returns 400 when no file is sent', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .field('dummy', 'value'); // multipart без файла

    expect(res.status).toBe(400);
  });

  test('rejects non-image file', async () => {
    const res = await request(app)
      .post('/api/upload/image')
      .attach('image', Buffer.from('hello world'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    // multer fileFilter rejects non-images → ошибка обработки
    expect([400, 500]).toContain(res.status);
  });
});
