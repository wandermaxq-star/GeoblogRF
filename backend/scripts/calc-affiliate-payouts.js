#!/usr/bin/env node
import pool from '../db.js';
import { calculatePayouts } from '../src/services/affiliateService.js';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

async function runScript() {
  const now = new Date();
  // расчёт за предыдущий месяц
  const periodEnd = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-01`;
  const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const periodStart = `${prev.getFullYear()}-${(prev.getMonth()+1).toString().padStart(2,'0')}-01`;

  console.log('Calculating affiliate payouts for', periodStart, '–', periodEnd);
  try {
    const payouts = await calculatePayouts({ periodStart, periodEnd });
    console.log('Created payouts:', payouts.length);
    payouts.forEach(p => console.log(p));
  } catch (err) {
    console.error('Error during payout calculation', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runScript();
}

export default runScript;
