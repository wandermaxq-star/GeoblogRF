import pool from './db.js';
import bcrypt from 'bcryptjs';

async function createTestUser() {
  try {
    const email = 'testapi@example.com';
    const username = 'testapi';
    const password = 'testpass123';
    
    // Проверяем, существует ли пользователь
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Тестовый пользователь уже существует');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      return;
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email',
      [username, email, hashedPassword, 'registered']
    );
    
    console.log('✅ Тестовый пользователь создан:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Username: ${result.rows[0].username}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error.message);
  } finally {
    await pool.end();
  }
}

createTestUser();