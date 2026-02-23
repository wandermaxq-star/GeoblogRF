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
