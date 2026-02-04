#!/usr/bin/env node
import pool from '../db.js';

async function check() {
  try {
    const res1 = await pool.query("SELECT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='target_type' AND e.enumlabel='post') AS exists;");
    console.log('target_type has post:', res1.rows[0].exists);

    const res2 = await pool.query("SELECT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='activity_type' AND e.enumlabel='post_created') AS exists;");
    console.log('activity_type has post_created:', res2.rows[0].exists);

    const res3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='activity_privacy_settings' AND column_name IN ('post_created_visibility','post_published_visibility')");
    console.log('post visibility columns present:', res3.rows.map(r=>r.column_name));

  } catch (err) {
    console.error('Check failed:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

check().catch(e=>{console.error(e); process.exit(1);});