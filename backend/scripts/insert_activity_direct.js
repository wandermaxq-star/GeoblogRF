#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

(async ()=>{
  try{
    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = users[0].id;
    const targetId = uuidv4();
    const { rows } = await pool.query("INSERT INTO activity_feed (user_id, activity_type, target_type, target_id, metadata, is_public) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, activity_type, target_type, is_public", [userId, 'post_created', 'post', targetId, '{}', true]);
    console.log('Inserted activity:', rows[0]);
  }catch(e){ console.error('insert failed', e.message || e); process.exit(1);} finally{ await pool.end(); }
})();