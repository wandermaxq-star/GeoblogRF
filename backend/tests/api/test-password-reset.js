import fetch from 'node-fetch';
import { NEW_PWD } from '../test-credentials.js';

async function testPasswordReset() {
  console.log('🔐 Тестируем восстановление пароля...\n');

  try {
    // 1. Запрашиваем восстановление пароля
    console.log('1️⃣ Запрашиваем восстановление пароля...');
    const resetResponse = await fetch('http://localhost:3002/api/users/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '+79991234568'
      }),
    });

    if (!resetResponse.ok) {
      const error = await resetResponse.text();
      console.error('❌ Ошибка запроса восстановления:', error);
      return;
    }

    const resetData = await resetResponse.json();
    console.log('✅ Запрос восстановления отправлен:', resetData.message);

    // 2. Получаем код из базы данных
    const { Pool } = await import('pg');
    const DB_PWD = process.env.TEST_DB_PASSWORD || 'pg_temp';
    const pool = new Pool({
      user: 'bestuser_temp',
      host: 'localhost',
      database: 'bestsite',
      password: DB_PWD,
      port: 5432,
    });

    const result = await pool.query(
      `SELECT code FROM sms_codes 
       WHERE phone = $1 AND type = 'password_reset' 
       AND expires_at > NOW() AND used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      ['+79991234568']
    );

    if (result.rows.length === 0) {
      console.log('❌ Код восстановления не найден');
      await pool.end();
      return;
    }

    const resetCode = result.rows[0].code;
    console.log('🔑 Код восстановления:', resetCode);

    // 3. Подтверждаем восстановление пароля
    console.log('\n2️⃣ Подтверждаем восстановление пароля...');
    const confirmResponse = await fetch('http://localhost:3002/api/users/confirm-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '+79991234568',
        code: resetCode,
        newPassword: NEW_PWD
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('❌ Ошибка подтверждения восстановления:', error.message);
    } else {
      const confirmData = await confirmResponse.json();
      console.log('✅ Пароль успешно изменен:', confirmData.message);
      console.log('👤 Пользователь:', confirmData.user.username);
      console.log('🔑 Новый токен получен:', confirmData.token ? 'Да' : 'Нет');
    }

    await pool.end();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

testPasswordReset();
