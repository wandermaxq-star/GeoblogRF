import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  user: 'bestuser_temp',
  host: 'localhost',
  database: 'bestsite',
  password: '55555',
  port: 5432
});

const testUserId = '052d2d7b-b9ad-48f6-8540-fe2fad06a165';

// Проверяем таблицу user_purchased_route_packs
pool.query(`
  SELECT pack_id FROM user_purchased_route_packs WHERE user_id = $1
`, [testUserId])
  .then(res => { 
    console.log('Purchased packs:', res.rows);
    pool.end(); 
  })
  .catch(err => { 
    console.error('SQL Error:', err.message);
    console.error('Full error:', err);
    pool.end(); 
  });
