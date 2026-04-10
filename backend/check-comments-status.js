#!/usr/bin/env node
import pool from './db.js';

const res = await pool.query(`
  SELECT status, is_public, COUNT(*) as cnt 
  FROM comments 
  GROUP BY status, is_public
  ORDER BY status, is_public
`);

console.log('\n📊 Комментарии по статусам/видимости:');
res.rows.forEach(r => {
  console.log(`  ${r.status} / is_public=${r.is_public}: ${r.cnt} шт`);
});

// Также проверим одобренные видимые
const activePublic = await pool.query(`
  SELECT COUNT(*) as cnt FROM comments 
  WHERE status = 'active' AND is_public = true
`);
console.log(`\n✅ Одобрённых видимых: ${activePublic.rows[0].cnt}`);

await pool.end();
