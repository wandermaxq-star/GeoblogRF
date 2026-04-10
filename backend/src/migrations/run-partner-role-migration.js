// Скрипт для выполнения миграции partner-role-separation
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../../db.js';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('🚀 Начинаем выполнение миграции partner-role-separation...');
    
    // Читаем SQL файл миграции
    const migrationPath = join(__dirname, '2026-03-20-partner-role-separation.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Выполняем миграцию
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    logger.info('✅ Миграция успешно выполнена!');
    logger.info('   - Добавлена колонка partner_role в таблицу users');
    logger.info('   - Добавлена колонка is_pro_guide_allowed в таблицу users');
    logger.info('   - Расширен CHECK constraint для partner_status');
    logger.info('   - Мигрированы существующие данные');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
