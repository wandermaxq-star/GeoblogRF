import pool from './db.js';

async function updateTestUser() {
  try {
    const result = await pool.query(`
      UPDATE users 
      SET phone = $1, first_name = $2, last_name = $3, updated_at = NOW()
      WHERE email = 'test@example.com'
      RETURNING id, email, username, first_name, last_name, phone, updated_at
    `, [
      '+7 (999) 123-45-67',
      'Тест',
      'Пользователь'
    ]);
    
    if (result.rows.length > 0) {
      console.log('✅ Тестовый пользователь обновлен:');
      console.log('ID:', result.rows[0].id);
      console.log('Email:', result.rows[0].email);
      console.log('Username:', result.rows[0].username);
      console.log('Phone:', result.rows[0].phone);
      console.log('Name:', result.rows[0].first_name, result.rows[0].last_name);
    } else {
      console.log('❌ Пользователь не найден');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка обновления пользователя:', err);
    process.exit(1);
  }
}

updateTestUser();

