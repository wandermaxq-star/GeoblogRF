#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

(async function(){
  try{
    // Ensure table (same SQL as in route)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type VARCHAR(32) NOT NULL CHECK (target_type IN ('marker','route','event','post')),
        target_id UUID NOT NULL,
        value INTEGER NOT NULL CHECK (value >= 1 AND value <= 5),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, target_type, target_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_type, target_id);
    `);

    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) throw new Error('No users in DB');
    const userId = users[0].id;

    const targetId = uuidv4();

    await pool.query(`INSERT INTO ratings (user_id, target_type, target_id, value) VALUES ($1,$2,$3,$4)`, [userId, 'post', targetId, 4]);

    const { rows } = await pool.query(`SELECT COALESCE(AVG(value),0)::numeric(3,2) AS avg, COUNT(*)::int AS count FROM ratings WHERE target_type = $1 AND target_id = $2`, ['post', targetId]);

    console.log('summary:', rows[0]);

    // Cleanup
    await pool.query('DELETE FROM ratings WHERE target_id = $1', [targetId]);
  } catch (e){
    console.error('Ratings integration test failed:', e);
  } finally{
    await pool.end();
  }
})();
