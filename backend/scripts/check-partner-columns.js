// Проверка структуры таблицы users после миграции
import pool from '../db.js';

async function checkColumns() {
  const res = await pool.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name IN ('partner_role', 'is_pro_guide_allowed', 'partner_status')
    ORDER BY column_name
  `);
  
  console.log('\n📋 Columns in users table:\n');
  console.table(res.rows);
  
  // Проверим constraint
  const constraintRes = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'users'::regclass 
    AND conname = 'users_partner_status_check'
  `);
  
  if (constraintRes.rows.length > 0) {
    console.log('\n✅ CHECK constraint for partner_status:');
    console.log(constraintRes.rows[0].definition);
  }
  
  await pool.end();
}

checkColumns().catch(console.error);
