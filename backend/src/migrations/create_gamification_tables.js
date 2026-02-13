/**
 * Скрипт для создания таблиц системы геймификации
 * 
 * Использование:
 * node src/migrations/create_gamification_tables.js
 */

import pool from '../../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createGamificationTables() {
  const client = await pool.connect();
  
  try {
    logger.info('🔄 Начинаю создание таблиц системы геймификации...');
    
    // Читаем SQL файл
    const sqlPath = join(__dirname, '../../create_gamification_tables.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Выполняем SQL
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    logger.info('✅ Таблицы системы геймификации успешно созданы!');
    logger.info('📋 Созданные таблицы:');
    logger.info('   - user_levels');
    logger.info('   - xp_history');
    logger.info('   - daily_goals');
    logger.info('   - daily_goals_history');
    logger.info('   - user_achievements');
    logger.info('   - gamification_actions');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при создании таблиц:', error.message);
    
    if (error.code === '42P07') {
      logger.info('ℹ️  Некоторые таблицы уже существуют. Это нормально.');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем миграцию
createGamificationTables()
  .then(() => {
    logger.info('✅ Миграция завершена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  });

