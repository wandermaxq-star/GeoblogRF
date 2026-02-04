#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const MIGRATION = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(process.cwd(), 'backend', 'src', 'migrations', '2026-02-01-add-posts-to-activity.sql');

async function run() {
  const env = process.env;
  // Allow overriding via CLI env vars
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const dbUser = process.env.DB_USER || process.env.POSTGRES_USER || process.env.POSTGRES_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '';
  const dbHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || process.env.POSTGRES_PORT || 5432;
  const dbName = process.env.DB_DATABASE || process.env.POSTGRES_DB || 'bestsite';

  if (!dbPassword) {
    console.error('DB password not set. Set DB_PASSWORD or POSTGRES_PASSWORD env var.');
    process.exit(2);
  }

  // Lazy import pg after checking env
  const pg = await import('pg');
  const pool = new pg.Pool({ user: dbUser, password: dbPassword, host: dbHost, port: Number(dbPort), database: dbName });

  const sql = fs.readFileSync(MIGRATION, 'utf8');
  console.log('Applying migration:', MIGRATION);
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });