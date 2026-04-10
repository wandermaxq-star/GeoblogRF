/**
 * Generates a unique 6-8 character referral code
 * Format: alphanumeric uppercase
 */
export function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Ensures code uniqueness by checking against existing codes
 */
export async function generateUniqueReferralCode(pool, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateReferralCode();
    const existing = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [code]
    );
    if (existing.rows.length === 0) {
      return code;
    }
  }
  throw new Error('Failed to generate unique referral code after max retries');
}
