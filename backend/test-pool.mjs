import pool from './db.js';

console.log('🔍 Тестирую pool из db.js...');

try {
  const result = await pool.query('SELECT NOW() as time, version() as version');
  console.log('✅ ПУЛ РАБОТАЕТ!');
  console.log('Результат:', result.rows[0]);
} catch (err) {
  console.log('❌ ПУЛ НЕ РАБОТАЕТ:', err.message);
  console.log('Код ошибки:', err.code);
} finally {
  await pool.end();
  process.exit(0);
}
