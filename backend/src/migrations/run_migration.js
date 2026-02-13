// Скрипт для выполнения SQL миграций
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
    logger.info('🚀 Начинаем выполнение миграции...');
    
    // Читаем SQL файл миграции
    const migrationPath = join(__dirname, 'add_posts_likes_comments_counts.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Выполняем миграцию
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    logger.info('✅ Миграция успешно выполнена!');
    logger.info('   - Добавлена колонка likes_count в таблицу posts');
    logger.info('   - Добавлена колонка comments_count в таблицу posts');
    logger.info('   - Созданы индексы для оптимизации');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

