#!/usr/bin/env node
import pool from '../db.js';

(async function(){
  try{
    const { rows } = await pool.query("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'activity_type' ORDER BY e.enumsortorder");
    console.log('activity_type values:', rows.map(r=>r.enumlabel));
  } catch (e){
    console.error('Error fetching enum:', e);
  } finally{
    await pool.end();
  }
})();
