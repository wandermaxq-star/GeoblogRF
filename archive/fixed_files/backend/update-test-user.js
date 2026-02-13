import pool from './db.js';

async function updateTestUser() {
  try {
    console.log('🔍 Обновляем тестового пользователя...');
    
    // Обновляем тестового пользователя
    const result = await pool.query(`
      UPDATE users 
      SET phone = $1, password_hash = $2, updated_at = NOW()
      WHERE email = $3
      RETURNING id, email, username, phone
    `, ['+7-999-123-45-67', 'test123', 'test@example.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ Пользователь test@example.com не найден');
      return;
    }
    
    console.log('✅ Тестовый пользователь обновлен:', result.rows[0]);
    
    // Проверяем авторизацию
    console.log('🔍 Проверяем авторизацию...');
    const authResult = await pool.query(`
      SELECT id, email, username, phone, password_hash
      FROM users 
      WHERE email = $1 AND password_hash = $2
    `, ['test@example.com', 'test123']);
    
    if (authResult.rows.length > 0) {
      console.log('✅ Авторизация работает:', {
        id: authResult.rows[0].id,
        email: authResult.rows[0].email,
        username: authResult.rows[0].username,
        phone: authResult.rows[0].phone
      });
    } else {
      console.log('❌ Авторизация не работает');
    }
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  } finally {
    await pool.end();
  }
}

updateTestUser();
