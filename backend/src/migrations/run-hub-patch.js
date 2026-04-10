// backend/src/migrations/run-hub-patch.js
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'db.js');
const poolModule = await import(pathToFileURL(dbPath).href);
const pool = poolModule.default || poolModule;

const sql = readFileSync(path.join(__dirname, '2026-04-01-hub-patch.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✅ Hub-патч выполнен: таблица user_purchased_route_packs создана');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
