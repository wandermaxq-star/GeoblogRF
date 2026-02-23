import { hashPassword, comparePassword } from '../src/utils/password.js';

describe('Password utilities', () => {
  const plainPassword = 'TestPassword123';

  test('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword(plainPassword);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(plainPassword);
    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  test('comparePassword returns true for correct password', async () => {
    const hash = await hashPassword(plainPassword);
    const result = await comparePassword(plainPassword, hash);
    expect(result).toBe(true);
  });

  test('comparePassword returns false for wrong password', async () => {
    const hash = await hashPassword(plainPassword);
    const result = await comparePassword('WrongPassword', hash);
    expect(result).toBe(false);
  });

  test('different calls produce different hashes (salt)', async () => {
    const hash1 = await hashPassword(plainPassword);
    const hash2 = await hashPassword(plainPassword);
    expect(hash1).not.toBe(hash2);
    // Both should still match the original password
    expect(await comparePassword(plainPassword, hash1)).toBe(true);
    expect(await comparePassword(plainPassword, hash2)).toBe(true);
  });
});
