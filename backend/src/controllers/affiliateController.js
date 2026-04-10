import pool from '../../db.js';
import { getPartnerTier } from '../services/affiliateService.js';

export const getPartnerData = async (req, res) => {
  const userId = req.user.id;
  try {
    // get own referral_code
    const u = await pool.query('SELECT referral_code FROM users WHERE id=$1', [userId]);
    const referral_code = u.rows[0]?.referral_code || null;

    // get partner tier
    const tierInfo = await getPartnerTier(userId);

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE referrer_id=$1) AS total_events,
         COUNT(DISTINCT referred_user_id) FILTER (WHERE referrer_id=$1) AS referred_users,
         COUNT(*) FILTER (WHERE referrer_id=$1 AND event_type='signup') AS signup_events,
         COUNT(*) FILTER (WHERE referrer_id=$1 AND event_type='first_subscription') AS subscription_events,
         COUNT(*) FILTER (WHERE referrer_id=$1 AND event_type='paid_pack') AS paid_pack_sales,
         COALESCE(SUM(commission_due) FILTER (WHERE referrer_id=$1),0) AS total_commission
       FROM affiliate_events`,
      [userId]
    );
    const row = stats.rows[0] || {};
    const paidSales = Number(row.paid_pack_sales || 0);
    const nextBonusIn = paidSales % 100 === 0 ? 100 : 100 - (paidSales % 100);
    res.json({
      referral_code,
      tier: tierInfo.tier,
      commission_rate: (tierInfo.commission * 100).toFixed(0) + '%',
      referred_users: Number(row.referred_users),
      total_events: Number(row.total_events),
      signup_events: Number(row.signup_events),
      subscription_events: Number(row.subscription_events),
      paid_pack_sales: paidSales,
      next_paid_pack_bonus_in: nextBonusIn,
      total_commission: Number(row.total_commission)
    });
  } catch (err) {
    console.error('partner data error', err);
    res.status(500).json({ message: 'Ошибка получения данных партнёра' });
  }
};