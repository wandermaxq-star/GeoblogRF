import { jest } from '@jest/globals';

const {
  validateRegister,
  validateLogin,
  validateMarker,
  validateProfileUpdate,
} = await import('../src/middleware/validation.js');

function mockReqResNext(body = {}) {
  const req = { body };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Validation middleware', () => {
  describe('validateRegister', () => {
    const validBody = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'pass123',
      phone: '+79001234567',
    };

    test('passes with valid data', () => {
      const { req, res, next } = mockReqResNext(validBody);
      validateRegister(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('fails without email', () => {
      const { req, res, next } = mockReqResNext({ ...validBody, email: undefined });
      validateRegister(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with invalid email', () => {
      const { req, res, next } = mockReqResNext({ ...validBody, email: 'not-an-email' });
      validateRegister(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with short username', () => {
      const { req, res, next } = mockReqResNext({ ...validBody, username: 'ab' });
      validateRegister(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with short password', () => {
      const { req, res, next } = mockReqResNext({ ...validBody, password: '12345' });
      validateRegister(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with invalid phone format', () => {
      const { req, res, next } = mockReqResNext({ ...validBody, phone: 'abc' });
      validateRegister(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });
  });

  describe('validateLogin', () => {
    test('passes with valid credentials', () => {
      const { req, res, next } = mockReqResNext({ email: 'test@example.com', password: 'pass123' });
      validateLogin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('fails without email', () => {
      const { req, res, next } = mockReqResNext({ password: 'pass123' });
      validateLogin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails without password', () => {
      const { req, res, next } = mockReqResNext({ email: 'test@example.com' });
      validateLogin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });
  });

  describe('validateMarker', () => {
    const validMarker = {
      title: 'Test Marker',
      latitude: 55.75,
      longitude: 37.62,
      category: 'nature',
    };

    test('passes with valid marker data', () => {
      const { req, res, next } = mockReqResNext(validMarker);
      validateMarker(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('fails without title', () => {
      const { req, res, next } = mockReqResNext({ ...validMarker, title: undefined });
      validateMarker(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with invalid latitude', () => {
      const { req, res, next } = mockReqResNext({ ...validMarker, latitude: 100 });
      validateMarker(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails without category', () => {
      const { req, res, next } = mockReqResNext({ ...validMarker, category: undefined });
      validateMarker(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('strips unknown fields', () => {
      const { req, res, next } = mockReqResNext({ ...validMarker, unknownField: 'test' });
      validateMarker(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.unknownField).toBeUndefined();
    });
  });

  describe('validateProfileUpdate', () => {
    test('passes with valid update', () => {
      const { req, res, next } = mockReqResNext({ username: 'newname' });
      validateProfileUpdate(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('passes with empty body (all optional)', () => {
      const { req, res, next } = mockReqResNext({});
      validateProfileUpdate(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('fails with short username', () => {
      const { req, res, next } = mockReqResNext({ username: 'ab' });
      validateProfileUpdate(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('fails with invalid email', () => {
      const { req, res, next } = mockReqResNext({ email: 'bad' });
      validateProfileUpdate(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });
  });
});
