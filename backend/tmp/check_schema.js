import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER || 'bestuser_temp',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'bestsite',
  password: process.env.DB_PASSWORD || '55555',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

(async () => {
  try {
    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='partner_status'");
    console.log('partner_status exists:', colRes.rows.length > 0);
    const t1 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name='route_ratings'");
    console.log('route_ratings exists:', t1.rows.length > 0);
    const t2 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name='travel_routes'");
    console.log('travel_routes exists:', t2.rows.length > 0);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
