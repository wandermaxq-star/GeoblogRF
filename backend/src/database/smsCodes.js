import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../../logger.js';

dotenv.config(); // Загружаем переменные окружения из .env

const pool = new Pool({
  user: process.env.DB_USER || 'bestuser_temp',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'bestsite',
  password: process.env.DB_PASSWORD || '55555',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  client_encoding: 'utf8'
});

async function createSMSCodesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_codes (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'verification' или 'password_reset'
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создаем индекс для быстрого поиска по телефону и типу
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_codes_phone_type 
      ON sms_codes(phone, type, expires_at);
    `);

    logger.info('✅ Таблица sms_codes создана успешно');
  } catch (error) {
    console.error('❌ Ошибка создания таблицы sms_codes:', error);
  }
}

async function cleanupExpiredCodes() {
  try {
    const result = await pool.query(`
      DELETE FROM sms_codes 
      WHERE expires_at < NOW() OR used = TRUE
    `);
    logger.info(`🧹 Удалено ${result.rowCount} устаревших SMS-кодов`);
  } catch (error) {
    console.error('❌ Ошибка очистки устаревших кодов:', error);
  }
}

// Запускаем создание таблицы
createSMSCodesTable().then(() => {
  // Очищаем устаревшие коды при запуске
  cleanupExpiredCodes();
});

export { pool, createSMSCodesTable, cleanupExpiredCodes };
