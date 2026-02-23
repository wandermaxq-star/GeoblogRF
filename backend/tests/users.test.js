import request from 'supertest';
import { createTestAppWithRoutes } from './helpers/testApp.js';
import pool from '../db.js';

let app;

beforeAll(async () => {
  // Создаём тестовое приложение с user-маршрутами
  app = await createTestAppWithRoutes({
    '/api/users': '../../src/routes/userRoutes.js',
  });
}, 15000);

afterAll(async () => {
  await pool.end();
});

describe('Users API (integration)', () => {
  describe('POST /api/users/login', () => {
    test('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'nonexistent_test_xyzzy@example.com', password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Неверный email/);
    });

    test('returns 400 without email', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 without password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 with invalid email format', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/profile', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
    });

    test('returns 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/users/register', () => {
    test('returns 400 with missing fields', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('returns 400 with short password', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: '123',
          phone: '+79001234567',
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/avatar', () => {
    test('returns 401 without auth token', async () => {
      const res = await request(app)
        .put('/api/users/avatar')
        .send({ avatar_url: 'https://example.com/avatar.png' });

      expect(res.status).toBe(401);
    });
  });
});
