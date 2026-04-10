import { Pool } from 'pg';
import dotenv from 'dotenv';
import packs from './src/data/curatedRoutePacks.js';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'bestuser_temp',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'bestsite',
  password: process.env.DB_PASSWORD || '55555',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  client_encoding: 'utf8'
});

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curated_route_packs (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица curated_route_packs создана/проверена');
  } catch (err) {
    console.error('❌ Ошибка при создании таблицы curated_route_packs:', err);
    throw err;
  }
}

async function seedData() {
  try {
    for (const pack of packs) {
      await pool.query(
        `INSERT INTO curated_route_packs(id, data) VALUES($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [pack.id, pack],
      );
    }
    console.log(`✅ Загружено ${packs.length} пакетов в базу`);
  } catch (err) {
    console.error('❌ Ошибка при заполнении пакетов:', err);
  }
}

async function run() {
  await ensureTable();
  await seedData();
  process.exit(0);
}

run().catch((e) => {
  console.error('run failed', e);
  process.exit(1);
});