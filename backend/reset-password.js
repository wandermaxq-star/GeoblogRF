import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pg;

const pool = new Pool({ 
  user: 'bestuser_temp',
  host: 'localhost',
  database: 'bestsite',
  password: '55555',
  port: 5432
});

const newPassword = 'password123';
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

pool.query(
  `UPDATE users 
   SET password_hash = $1, is_active = true, is_verified = true
   WHERE email = 'alice@example.com'
   RETURNING id, email, username`,
  [hashedPassword]
)
  .then(res => { 
    if (res.rows.length > 0) {
      console.log('Password updated for:', res.rows[0]);
      console.log('Email: alice@example.com');
      console.log('Password: password123');
    } else {
      console.log('User not found');
    }
    pool.end(); 
  })
  .catch(err => { 
    console.error('Error:', err.message); 
    pool.end(); 
  });
