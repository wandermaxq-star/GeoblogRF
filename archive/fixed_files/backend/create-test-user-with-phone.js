import pool from './db.js';

async function createTestUser() {
  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const result = await pool.query(`
      INSERT INTO users (
        email, username, password_hash, role, 
        first_name, last_name, phone,
        is_verified, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, 'registered', $4, $5, $6, true, true, NOW(), NOW()) 
      RETURNING id, email, username, first_name, last_name, phone, created_at
    `, [
      'test@example.com',
      'testuser',
      hashedPassword,
      'Тест',
      'Пользователь',
      '+7 (999) 123-45-67'
    ]);
    
    console.log('✅ Тестовый пользователь создан:');
    console.log('ID:', result.rows[0].id);
    console.log('Email:', result.rows[0].email);
    console.log('Username:', result.rows[0].username);
    console.log('Phone:', result.rows[0].phone);
    console.log('Name:', result.rows[0].first_name, result.rows[0].last_name);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка создания пользователя:', err);
    process.exit(1);
  }
}

createTestUser();

