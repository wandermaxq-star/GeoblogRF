#!/usr/bin/env node
import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

(async function(){
  try{
    // Create a pending post directly in DB
    const title = 'Test post for moderation';
    const body = 'This is a test body indicating nothing bad.';

    const insertRes = await pool.query(`INSERT INTO posts (title, body, author_id, status, created_at, updated_at) VALUES ($1,$2,$3,'pending',NOW(),NOW()) RETURNING *`, [title, body, null]);
    const post = insertRes.rows[0];
    console.log('Created post id', post.id);

    // Import and call autoAnalyzeContent
    const { autoAnalyzeContent } = await import('../src/middleware/autoModeration.js');
    await autoAnalyzeContent('posts', post.id, post);

    // Wait a bit for async tasks (though function is awaited here)
    // Check ai_moderation_decisions
    const check = await pool.query('SELECT * FROM ai_moderation_decisions WHERE content_type = $1 AND content_id = $2', ['posts', String(post.id)]);
    if (check.rows.length > 0) {
      console.log('AI decision created:', check.rows[0]);
    } else {
      console.error('No AI decision found');
    }

    // Cleanup
    await pool.query('DELETE FROM ai_moderation_decisions WHERE content_type = $1 AND content_id = $2', ['posts', String(post.id)]);
    await pool.query('DELETE FROM posts WHERE id = $1', [post.id]);

  } catch (e){
    console.error('Integration test failed:', e);
  } finally{
    await pool.end();
  }
})();
