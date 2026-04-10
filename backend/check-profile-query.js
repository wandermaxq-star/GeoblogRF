import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  user: 'bestuser_temp',
  host: 'localhost',
  database: 'bestsite',
  password: '55555',
  port: 5432
});

// Реальный UUID из теста
const testUserId = '052d2d7b-b9ad-48f6-8540-fe2fad06a165';

pool.query(`
  SELECT id, email, username, role, first_name, last_name, avatar_url, bio,
          referral_code, referred_by,
          is_verified, is_active, created_at, updated_at, last_login, 
          subscription_expires_at, settings, analytics_opt_out
   FROM users WHERE id = $1
`, [testUserId])
  .then(res => { 
    console.log('Query result:', res.rows);
    if (res.rows.length > 0) {
      console.log('\nUser found:', res.rows[0].email);
    } else {
      console.log('\nNo user with that id');
    }
    pool.end(); 
  })
  .catch(err => { 
    console.error('SQL Error:', err.message);
    console.error('Full error:', err);
    pool.end(); 
  });
