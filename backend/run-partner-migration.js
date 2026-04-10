import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    // First run base migration
    const baseMigrationFile = path.join(__dirname, 'src/migrations/2026-03-08-affiliate-payouts.sql');
    const baseSql = fs.readFileSync(baseMigrationFile, 'utf8');
    
    logger.info('Running base affiliate payouts migration...');
    await pool.query(baseSql);
    logger.info('✅ Base migration completed');

    // Then run partner complete migration
    const migrationFile = path.join(__dirname, 'src/migrations/2026-03-08-partner-complete.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    logger.info('Running partner program migration...');
    await pool.query(sql);
    logger.info('✅ Partner program migration completed successfully');
    
    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', { error: err.message });
    console.error(err);
    process.exit(1);
  }
}

runMigration();
