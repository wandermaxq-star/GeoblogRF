#!/usr/bin/env node
import pool from '../db.js';
(async function(){
  try{
    const r = await pool.query("SELECT 'post_created'::activity_type as t, 'post'::target_type as tt");
    console.log('cast ok:', r.rows[0]);
  }catch(e){
    console.error('cast error:', e.message);
  } finally{ await pool.end(); }
})();