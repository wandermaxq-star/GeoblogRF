#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

(async function(){
  try{
    const { rows: users } = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) throw new Error('No users in DB');
    const userId = users[0].id;

    // Backup existing settings
    const { rows: existing } = await pool.query('SELECT * FROM activity_privacy_settings WHERE user_id = $1', [userId]);

    // Upsert settings: set post_created_visibility = 'private'
    await pool.query(`
      INSERT INTO activity_privacy_settings (user_id, post_created_visibility, post_published_visibility)
      VALUES ($1, 'private', 'private')
      ON CONFLICT (user_id) DO UPDATE SET post_created_visibility = EXCLUDED.post_created_visibility, post_published_visibility = EXCLUDED.post_published_visibility
    `, [userId]);

    // Call create_activity
    const targetId = uuidv4();
    const { rows } = await pool.query("SELECT create_activity($1::uuid, $2::activity_type, $3::target_type, $4::uuid, '{}'::jsonb, true) as id", [userId, 'post_created', 'post', targetId]);
    const activityId = rows[0].id;
    console.log('Created activity id', activityId);

    const { rows: arows } = await pool.query('SELECT is_public FROM activity_feed WHERE id = $1', [activityId]);
    console.log('is_public for activity:', arows[0].is_public);

    // Cleanup: delete activity
    await pool.query('DELETE FROM activity_feed WHERE id = $1', [activityId]);

    // Restore or delete existing settings
    if (existing.length === 0) {
      await pool.query('DELETE FROM activity_privacy_settings WHERE user_id = $1', [userId]);
    } else {
      // Restore previous columns (simple restore)
      await pool.query(`UPDATE activity_privacy_settings SET post_created_visibility = $1, post_published_visibility = $2 WHERE user_id = $3`, [existing[0].post_created_visibility, existing[0].post_published_visibility, userId]);
    }

  } catch (e){
    console.error('Activity privacy test failed:', e);
  } finally{
    await pool.end();
  }
})();
