import pool from '../../db.js';
import logger from '../../logger.js';
import { getPartnerTierInfo } from '../services/affiliateService.js';

// Пороговые значения для Simple User (активный автор)
const REQUIREMENTS = {
  routes_needed: 15,           // опубликованных маршрутов (status='active')
  positive_votes_needed: 20,   // положительных голосов суммарно по всем маршрутам
  ambassador_routes: 8,        // порог для амбассадора
  ambassador_votes: 10,        // порог для амбассадора
};

/**
 * Прогресс пользователя на пути к партнёрству.
 * GET /api/partners/progress
 *
 * Разделяет логику для:
 * - Simple User (активный автор): прогресс по маршрутам/голосам, комиссия 15-25%
 * - Pro Guide (проф. гид): метрики по премиум-рефералам и продажам паков
 */
export const getPartnerProgress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'Требуется авторизация' });
    }

    // --- user ---
    let user;
    try {
      const userRes = await pool.query(
        'SELECT partner_status, partner_role, username FROM users WHERE id = $1',
        [userId]
      );
      user = userRes.rows[0];
    } catch (err) {
      // 42703 = column does not exist
      if (err?.code === '42703') {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        user = userRes.rows[0];
        if (user) {
          user.partner_status = 'none';
          user.partner_role = null;
        }
      } else {
        throw err;
      }
    }
    if (!user) return res.status(404).json({ ok: false, message: 'Пользователь не найден' });

    const partnerRole = user.partner_role || null;
    const partnerStatus = user.partner_status || 'none';

    // --- published routes ---
    let publishedRoutes = 0;
    try {
      const routesRes = await pool.query(
        `SELECT COUNT(*) AS published_routes
         FROM travel_routes WHERE creator_id = $1 AND status = 'active'`,
        [userId]
      );
      publishedRoutes = Number(routesRes.rows[0]?.published_routes || 0);
    } catch (err) {
      if (err?.code === '42P01') {
        logger.warn('travel_routes table missing, returning 0 routes');
      } else {
        throw err;
      }
    }

    // --- votes ---
    let positiveVotes = 0, negativeVotes = 0, totalVotes = 0;
    try {
      const votesRes = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN rr.vote = 1  THEN 1 ELSE 0 END), 0) AS positive_votes,
           COALESCE(SUM(CASE WHEN rr.vote = -1 THEN 1 ELSE 0 END), 0) AS negative_votes,
           COUNT(rr.id) AS total_votes
         FROM route_ratings rr
         JOIN travel_routes tr ON tr.id = rr.route_id
         WHERE tr.creator_id = $1`,
        [userId]
      );
      positiveVotes = Number(votesRes.rows[0]?.positive_votes || 0);
      negativeVotes = Number(votesRes.rows[0]?.negative_votes || 0);
      totalVotes    = Number(votesRes.rows[0]?.total_votes    || 0);
    } catch (err) {
      if (err?.code === '42P01') {
        logger.warn('route_ratings or travel_routes table missing, returning 0 votes');
      } else {
        throw err;
      }
    }

    // --- last application ---
    let application = null;
    try {
      const appRes = await pool.query(
        `SELECT id, status, application_type, created_at
         FROM partner_applications
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      application = appRes.rows[0] || null;
    } catch (err) {
      if (err?.code === '42P01' || err?.code === '42703') {
        logger.warn('partner_applications table/column missing, skipping');
      } else {
        throw err;
      }
    }

    // ============================================================
    // Формируем ответ в зависимости от роли
    // ============================================================

    const response = {
      ok: true,
      username: user.username,
      partner_status: partnerStatus,
      partner_role: partnerRole,
      is_simple_user: partnerRole === 'simple' || (!partnerRole && partnerStatus !== 'pro_guide'),
      is_pro_guide: partnerRole === 'pro_guide',
      has_referral_link: partnerRole === 'pro_guide',
      stats: {
        published_routes: publishedRoutes,
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        total_votes: totalVotes
      },
      requirements: REQUIREMENTS,
      application,
    };

    // --- Simple User: прогресс по маршрутам/голосам ---
    if (partnerRole === 'simple' || !partnerRole) {
      const routesPct = Math.min(1, publishedRoutes / REQUIREMENTS.routes_needed);
      const votesPct = Math.min(1, positiveVotes / REQUIREMENTS.positive_votes_needed);
      const overallPct = Math.round(((routesPct + votesPct) / 2) * 100);

      const routesMet = publishedRoutes >= REQUIREMENTS.routes_needed;
      const votesMet = positiveVotes >= REQUIREMENTS.positive_votes_needed;
      const isEligible = routesMet && votesMet;

      // Определяем уровень Simple User
      let simpleLevel = 'novice';
      let simpleCommission = 15;

      if (routesMet && votesMet) {
        simpleLevel = 'expert';
        simpleCommission = 25;
      } else if (publishedRoutes >= REQUIREMENTS.ambassador_routes && positiveVotes >= REQUIREMENTS.ambassador_votes) {
        simpleLevel = 'ambassador';
        simpleCommission = 20;
      }

      const missing = [];
      if (!routesMet) missing.push(`Опубликуй ещё ${REQUIREMENTS.routes_needed - publishedRoutes} маршрутов`);
      if (!votesMet) missing.push(`Набери ещё ${REQUIREMENTS.positive_votes_needed - positiveVotes} положительных оценок`);

      response.simple_progress = {
        level: simpleLevel,
        commission: simpleCommission,
        routes: publishedRoutes,
        needed_routes: REQUIREMENTS.routes_needed,
        votes: positiveVotes,
        needed_votes: REQUIREMENTS.positive_votes_needed,
        routes_pct: Math.round(routesPct * 100),
        votes_pct: Math.round(votesPct * 100),
        overall_pct: overallPct,
        is_eligible: isEligible,
        missing,
      };

      // Алиас для совместимости с фронтендом (ожидает поле `progress`)
      response.progress = {
        routes_pct: Math.round(routesPct * 100),
        votes_pct: Math.round(votesPct * 100),
        overall_pct: overallPct,
        routes_met: routesMet,
        votes_met: votesMet,
        is_eligible: isEligible,
        missing,
      };

      // Simple User НЕ имеет доступа к рефералкам
      response.guide_progress = null;
      response.can_apply_pro_guide = true;
    }

    // --- Pro Guide: метрики по рефералам и продажам ---
    if (partnerRole === 'pro_guide') {
      // Получаем статистику из affiliate_events
      const guidePremiumRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM affiliate_events
         WHERE referrer_id = $1 AND event_type = 'paid_premium_referral'`,
        [userId]
      );
      const guidePackRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM affiliate_events
         WHERE referrer_id = $1 AND event_type = 'curated_pack_sale'`,
        [userId]
      );

      const premiumReferrals = Number(guidePremiumRes.rows[0]?.cnt || 0);
      const packSales = Number(guidePackRes.rows[0]?.cnt || 0);

      // Премиум-рефералы: 10→10%, 25→15%, 50→20%, 100+→25%
      let premiumTier = 'none';
      let premiumCommission = 0;
      if (premiumReferrals >= 100) { premiumTier = 'top'; premiumCommission = 25; }
      else if (premiumReferrals >= 50) { premiumTier = 'expert'; premiumCommission = 20; }
      else if (premiumReferrals >= 25) { premiumTier = 'growth'; premiumCommission = 15; }
      else if (premiumReferrals >= 10) { premiumTier = 'start'; premiumCommission = 10; }

      // Продажи паков: 10→15%, 25→20%, 50→25%, 100+→30%
      let packTier = 'none';
      let packCommission = 0;
      if (packSales >= 100) { packTier = 'top'; packCommission = 30; }
      else if (packSales >= 50) { packTier = 'expert'; packCommission = 25; }
      else if (packSales >= 25) { packTier = 'growth'; packCommission = 20; }
      else if (packSales >= 10) { packTier = 'start'; packCommission = 15; }

      response.simple_progress = null; // Pro Guide не имеет simple-прогресса
      response.progress = null; // Pro Guide не использует simple-прогресс
      response.guide_progress = {
        premium_referrals: premiumReferrals,
        premium_tier: premiumTier,
        premium_commission: premiumCommission,
        pack_sales: packSales,
        pack_tier: packTier,
        pack_commission: packCommission,
      };
      response.can_apply_pro_guide = false; // Уже pro_guide
    }

    return res.json(response);
  } catch (err) {
    logger.error('getPartnerProgress error', { err });
    res.status(500).json({ ok: false, message: 'Ошибка получения прогресса' });
  }
};

/**
 * Apply for partner program
 * POST /api/partners/apply
 * Body: { name, about }
 */
export const applyForPartner = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'Требуется авторизация' });
    }

    const { name, about } = req.body;
    if (!name || !about) {
      return res.status(400).json({ ok: false, message: 'Заполните все поля (name, about)' });
    }

    // Уже есть заявка?
    const existing = await pool.query(
      'SELECT id FROM partner_applications WHERE user_id = $1',
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, message: 'Вы уже подали заявку' });
    }

    // Снимок метрик на момент подачи
    const routesRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM travel_routes WHERE creator_id=$1 AND status='active'`,
      [userId]
    );
    const votesRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN rr.vote=1 THEN 1 ELSE 0 END),0) AS pos,
         COUNT(rr.id) AS total
       FROM route_ratings rr
       JOIN travel_routes tr ON tr.id=rr.route_id
       WHERE tr.creator_id=$1`,
      [userId]
    );
    const routesCount   = Number(routesRes.rows[0]?.cnt  || 0);
    const positiveVotes = Number(votesRes.rows[0]?.pos   || 0);
    const totalVotes    = Number(votesRes.rows[0]?.total || 0);

    const result = await pool.query(
      `INSERT INTO partner_applications
         (user_id, name, about, application_type, status, routes_count, positive_votes, total_votes, created_at)
       VALUES ($1, $2, $3, 'organic', 'new', $4, $5, $6, NOW())
       RETURNING id, status, created_at`,
      [userId, name, about, routesCount, positiveVotes, totalVotes]
    );

    // Обновляем partner_status пользователя → pending
    try {
      await pool.query(`UPDATE users SET partner_status='pending' WHERE id=$1`, [userId]);
    } catch (err) {
      if (err?.code === '42703' && err.message?.includes('partner_status')) {
        logger.warn('partner_status column missing - skipping update (run migration)', { userId });
      } else {
        throw err;
      }
    }

    logger.info(`Partner organic application from user ${userId}`, { name, routesCount });

    return res.json({
      ok: true,
      message: 'Заявка успешно отправлена. Ожидайте рассмотрения.',
      application: result.rows[0],
    });
  } catch (err) {
    logger.error('applyForPartner error', { err });
    res.status(500).json({ ok: false, message: 'Ошибка при подаче заявки' });
  }
};

/**
 * Заявка для профессионального гида (Путь 2).
 * POST /api/partners/apply-guide
 */
export const applyAsProGuide = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'Требуется авторизация' });
    }

    const {
      name, city, phone, audience_url,
      experience_years, audience_size, current_formats,
      pack_ideas, has_partners, motivation,
    } = req.body;

    if (!name || !motivation) {
      return res.status(400).json({ ok: false, message: 'Заполните обязательные поля (name, motivation)' });
    }

    const existing = await pool.query(
      `SELECT id FROM partner_applications WHERE user_id=$1 AND application_type='pro_guide'`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, message: 'Заявка гида уже подана' });
    }

    const result = await pool.query(
      `INSERT INTO partner_applications
         (user_id, name, application_type, status, city, phone, audience_url,
          experience_years, audience_size, current_formats, pack_ideas, has_partners, motivation, created_at)
       VALUES ($1,$2,'pro_guide','new',$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       RETURNING id, status, created_at`,
      [userId, name, city || null, phone || null, audience_url || null,
       experience_years || null, audience_size || null, current_formats || null,
       pack_ideas || null, has_partners || null, motivation]
    );

    try {
      await pool.query(
        `UPDATE users SET partner_status='pending' WHERE id=$1 AND partner_status='none'`,
        [userId]
      );
    } catch (err) {
      if (err?.code === '42703' && err.message?.includes('partner_status')) {
        logger.warn('partner_status column missing - skipping update (run migration)', { userId });
      } else {
        throw err;
      }
    }

    logger.info(`Pro-guide application from user ${userId}`, { name });

    return res.json({
      ok: true,
      message: 'Заявка гида отправлена. Мы свяжемся в течение 3 рабочих дней.',
      application: result.rows[0],
    });
  } catch (err) {
    logger.error('applyAsProGuide error', { err });
    res.status(500).json({ ok: false, message: 'Ошибка при подаче заявки гида' });
  }
};

/**
 * Get partner application status
 * GET /api/partners/application
 */
export const getApplicationStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `SELECT id, status, application_type, name, about, motivation, created_at
       FROM partner_applications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return res.json({ ok: true, application: result.rows[0] || null });
  } catch (err) {
    logger.error('getApplicationStatus error', { err });
    res.status(500).json({ ok: false, message: 'Ошибка при получении статуса' });
  }
};
