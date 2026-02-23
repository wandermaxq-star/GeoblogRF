import { generateToken, verifyToken, extractTokenFromHeader } from '../src/utils/jwt.js';

describe('JWT utilities', () => {
  const userId = 42;

  describe('generateToken', () => {
    test('returns a non-empty string', () => {
      const token = generateToken(userId);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('token contains correct payload fields', () => {
      const token = generateToken(userId, 'admin');
      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(userId);
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe('admin');
    });

    test('defaults role to registered', () => {
      const token = generateToken(userId);
      const decoded = verifyToken(token);
      expect(decoded.role).toBe('registered');
    });
  });

  describe('verifyToken', () => {
    test('returns decoded payload for valid token', () => {
      const token = generateToken(userId);
      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(userId);
    });

    test('returns null for invalid token', () => {
      expect(verifyToken('invalid.token.string')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(verifyToken('')).toBeNull();
    });

    test('returns null for tampered token', () => {
      const token = generateToken(userId);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(verifyToken(tampered)).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    test('extracts token from valid Bearer header', () => {
      expect(extractTokenFromHeader('Bearer abc123')).toBe('abc123');
    });

    test('returns null when header is missing', () => {
      expect(extractTokenFromHeader(null)).toBeNull();
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    test('returns null when header has wrong prefix', () => {
      expect(extractTokenFromHeader('Token abc123')).toBeNull();
      expect(extractTokenFromHeader('abc123')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(extractTokenFromHeader('')).toBeNull();
    });
  });
});
