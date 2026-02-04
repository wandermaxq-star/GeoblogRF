#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  const targetId = uuidv4();
  try {
    await pool.query('BEGIN');
    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) throw new Error('No users found in DB to use as test user');
    const userId = users[0].id;
    await pool.query("INSERT INTO ratings (user_id, target_type, target_id, value) VALUES ($1,$2,$3,$4)", [userId, 'post', targetId, 5]);
    // Insert another with same target and different user (use a different existing user or reuse same user with conflict -> will update)
    await pool.query("INSERT INTO ratings (user_id, target_type, target_id, value) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,target_type,target_id) DO UPDATE SET value = EXCLUDED.value", [userId, 'post', targetId, 4]);
    await pool.query('COMMIT');
    const { rows } = await pool.query(`SELECT COALESCE(AVG(value),0)::numeric(3,2) AS avg, COUNT(*)::int AS count FROM ratings WHERE target_type = $1 AND target_id = $2`, ['post', targetId]);
    console.log('Inserted ratings, summary:', rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error during test ratings:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

test().catch(e=>{console.error(e); process.exit(1);});