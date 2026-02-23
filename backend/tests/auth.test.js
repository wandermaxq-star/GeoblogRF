import { jest } from '@jest/globals';
import { generateToken } from '../src/utils/jwt.js';

// Мокаем logger, чтобы не шумел в тестах
jest.unstable_mockModule('../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { authenticateToken, requireRole } = await import('../src/middleware/auth.js');

// Хелпер для создания mock req/res/next
function mockReqResNext(overrides = {}) {
  const req = {
    headers: {},
    path: '/api/test',
    method: 'GET',
    ...overrides,
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Auth middleware', () => {
  describe('authenticateToken', () => {
    test('passes with valid token and sets req.user', () => {
      const token = generateToken(42, 'registered');
      const { req, res, next } = mockReqResNext({
        headers: { authorization: `Bearer ${token}` },
      });
      authenticateToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(42);
      expect(req.user.role).toBe('registered');
    });

    test('returns 401 when no Authorization header', () => {
      const { req, res, next } = mockReqResNext();
      authenticateToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/Токен/);
    });

    test('returns 401 when header is malformed', () => {
      const { req, res, next } = mockReqResNext({
        headers: { authorization: 'NotBearer abc123' },
      });
      authenticateToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    test('returns 403 for invalid token', () => {
      const { req, res, next } = mockReqResNext({
        headers: { authorization: 'Bearer invalid.token.data' },
      });
      authenticateToken(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Недействительный/);
    });
  });

  describe('requireRole', () => {
    test('passes when user has required role', () => {
      const middleware = requireRole(['admin']);
      const { req, res, next } = mockReqResNext();
      req.user = { id: 1, role: 'admin' };
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('returns 403 when user lacks required role', () => {
      const middleware = requireRole(['admin']);
      const { req, res, next } = mockReqResNext();
      req.user = { id: 1, role: 'registered' };
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    test('returns 401 when no user', () => {
      const middleware = requireRole(['admin']);
      const { req, res, next } = mockReqResNext();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });
  });
});
