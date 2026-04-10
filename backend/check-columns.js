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
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
  AND column_name IN ('partner_role', 'is_pro_guide_allowed')
`)
  .then(res => { 
    console.log('Found columns:', res.rows);
    if (res.rows.length < 2) {
      console.log('\n⚠️  Missing columns! Need to run migration.');
    } else {
      console.log('\n✅ All columns exist.');
    }
    pool.end(); 
  })
  .catch(err => { 
    console.error('Error:', err.message); 
    pool.end(); 
  });
