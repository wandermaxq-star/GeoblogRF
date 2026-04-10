import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  user: 'bestuser_temp',
  host: 'localhost',
  database: 'bestsite',
  password: '55555',
  port: 5432
});

pool.query(`
  SELECT id, email, username, role, is_verified, is_active
  FROM users 
  LIMIT 5
`)
  .then(res => { 
    console.log('Users in database:');
    res.rows.forEach(u => {
      console.log(`  - ${u.email} (${u.username}) - role: ${u.role}, verified: ${u.is_verified}, active: ${u.is_active}`);
    });
    pool.end(); 
  })
  .catch(err => { 
    console.error('Error:', err.message); 
    pool.end(); 
  });
