import pool from './db.js';
import { hashPassword } from './src/utils/password.js';
import { generateUniqueReferralCode } from './src/utils/codeGenerator.js';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestAccounts() {
  try {
    logger.info('Creating test accounts...');

    // Test user
    const testCode = await generateUniqueReferralCode(pool);
    const testPassword = await hashPassword('test123');
    await pool.query(
      `INSERT INTO users (email, username, password_hash, role, first_name, last_name, is_verified, is_active, referral_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, is_active = true
       RETURNING id, email`,
      ['test@example.com', 'testuser', testPassword, 'user', 'Test', 'User', testCode]
    );
    logger.info('✅ Test account created: test@example.com / test123');

    // Admin user
    const adminCode = await generateUniqueReferralCode(pool);
    const adminPassword = await hashPassword('admin123');
    await pool.query(
      `INSERT INTO users (email, username, password_hash, role, first_name, last_name, is_verified, is_active, referral_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, is_active = true, role = $4
       RETURNING id, email`,
      ['admin@test.com', 'adminuser', adminPassword, 'admin', 'Admin', 'User', adminCode]
    );
    logger.info('✅ Admin account created: admin@test.com / admin123');

    logger.info('✅ All test accounts created successfully');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Error creating test accounts:', { error: err.message });
    console.error(err);
    process.exit(1);
  }
}

createTestAccounts();
