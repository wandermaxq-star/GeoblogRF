// Запуск миграции: Route Pack Builder
// node backend/src/migrations/run-route-pack-submissions.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Запуск миграции route_pack_submissions...');
    const sql = readFileSync(join(__dirname, '2026-04-01-route-pack-submissions.sql'), 'utf-8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Миграция выполнена успешно!');
    console.log('   ✓ Таблица route_pack_submissions');
    console.log('   ✓ Таблица route_pack_ratings');
    console.log('   ✓ Таблица author_earnings');
    console.log('   ✓ Колонки is_pack_author, author_bio, ... в users');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка миграции:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
