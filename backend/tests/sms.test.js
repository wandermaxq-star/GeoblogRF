let smsService;

describe('SMS service (test mode)', () => {
  beforeAll(async () => {
    smsService = (await import('../src/services/smsService.js')).default;
  });

  test('generateCode returns 6-digit string', () => {
    const code = smsService.generateCode();
    expect(typeof code).toBe('string');
    expect(code).toHaveLength(6);
  });

  test('sendVerificationCode returns success in test mode', async () => {
    const phone = '+70000000000';
    const code = '123456';
    const result = await smsService.sendVerificationCode(phone, code);
    expect(result).toEqual({ success: true, code });
  });
});