#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  try {
    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) throw new Error('No users found in DB to use as test user');
    const userId = users[0].id;
    const targetId = uuidv4();

    const { rows } = await pool.query(`SELECT create_activity($1::uuid, 'post_created'::activity_type, 'post'::target_type, $2::uuid, '{}'::jsonb, true) as id`, [userId, targetId]);
    console.log('create_activity returned id:', rows[0].id);

    const activity = await pool.query('SELECT activity_type, target_type, target_id, is_public FROM activity_feed WHERE id = $1', [rows[0].id]);
    console.log('Inserted activity:', activity.rows[0]);

  } catch (err) {
    console.error('Activity test failed:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

test().catch(e=>{console.error(e); process.exit(1);});