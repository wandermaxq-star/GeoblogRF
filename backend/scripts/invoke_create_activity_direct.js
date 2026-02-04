#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

(async function(){
  try{
    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = users[0].id;
    const targetId = uuidv4();
    const sql = `SELECT create_activity($1::uuid, $2::activity_type, $3::target_type, $4::uuid, $5::jsonb, $6::boolean) as id`;
    const params = [userId, 'post_created', 'post', targetId, '{}', true];
    const res = await pool.query(sql, params);
    console.log('create_activity id', res.rows[0].id);
  } catch (e){
    console.error('Error calling create_activity:', e);
  } finally{
    await pool.end();
  }
})();