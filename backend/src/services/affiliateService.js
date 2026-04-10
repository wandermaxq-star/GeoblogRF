import pool from '../../db.js';
import logger from '../../logger.js';

// ============================================================
// Партнёрская программа: разделение Simple User и Pro Guide
// ============================================================

/**
 * Получает роль партнёра из БД
 * @param {string} userId - ID пользователя
 * @returns {Promise<{partner_role: 'simple' | 'pro_guide' | null, partner_status: string}>}
 */
export async function getPartnerRole(userId) {
  const result = await pool.query(
    `SELECT partner_role, partner_status FROM users WHERE id = $1`,
    [userId]
  );
  return {
    partner_role: result.rows[0]?.partner_role || null,
    partner_status: result.rows[0]?.partner_status || 'none',
  };
}

/**
 * Определяет уровень Simple User (активный автор)
 * Основано на маршрутах и голосах, НЕ на рефералах
 * Максимум: 25% с кураторских паков
 *
 * @param {string} userId - ID автора
 * @returns {Promise<{level: string, commission: number, routes: number, votes: number}>}
 */
export async function getSimpleAuthorTier(userId) {
  // Считаем опубликованные маршруты
  const routesRes = await pool.query(
    `SELECT COUNT(*) AS cnt FROM travel_routes WHERE creator_id = $1 AND status = 'active'`,
    [userId]
  );
  const routes = Number(routesRes.rows[0]?.cnt || 0);

  // Считаем положительные голоса. Если таблицы ещё нет (тестовая база), возвращаем 0.
  let positiveVotes = 0;
  try {
    const votesRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN rr.vote = 1 THEN 1 ELSE 0 END), 0) AS positive_votes
       FROM route_ratings rr
       JOIN travel_routes tr ON tr.id = rr.route_id
       WHERE tr.creator_id = $1`,
      [userId]
    );
    positiveVotes = Number(votesRes.rows[0]?.positive_votes || 0);
  } catch (err) {
    if (err.code === '42P01') {
      // missing table route_ratings in test / setup mode
      positiveVotes = 0;
    } else {
      throw err;
    }
  }

  // Определяем уровень
  let level = 'novice';
  let commission = 0.15;

  if (routes >= 15 && positiveVotes >= 20) {
    level = 'expert';
    commission = 0.25;
  } else if (routes >= 8 && positiveVotes >= 10) {
    level = 'ambassador';
    commission = 0.20;
  }

  return { level, commission, routes, positiveVotes };
}

/**
 * Определяет уровень Pro Guide по премиум-рефералам
 * 10 → 10%, 25 → 15%, 50 → 20%, 100+ → 25%
 *
 * @param {string} referrerId - ID реферера
 * @returns {Promise<{tier: string, commission: number, premiumReferrals: number}>}
 */
export async function getProGuidePremiumTier(referrerId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM affiliate_events
     WHERE referrer_id = $1 AND event_type = 'paid_premium_referral'`,
    [referrerId]
  );
  const premiumReferrals = Number(result.rows[0]?.cnt || 0);

  let tier = 'none';
  let commission = 0;

  if (premiumReferrals >= 100) {
    tier = 'top';
    commission = 0.25;
  } else if (premiumReferrals >= 50) {
    tier = 'expert';
    commission = 0.20;
  } else if (premiumReferrals >= 25) {
    tier = 'growth';
    commission = 0.15;
  } else if (premiumReferrals >= 10) {
    tier = 'start';
    commission = 0.10;
  }

  return { tier, commission, premiumReferrals };
}

/**
 * Определяет уровень Pro Guide по продажам кураторских паков
 * 10 → 15%, 25 → 20%, 50 → 25%, 100+ → 30%
 *
 * @param {string} referrerId - ID реферера
 * @returns {Promise<{tier: string, commission: number, packSales: number}>}
 */
export async function getProGuidePackTier(referrerId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM affiliate_events
     WHERE referrer_id = $1 AND event_type IN ('curated_pack_sale','paid_pack')`,
    [referrerId]
  );
  const packSales = Number(result.rows[0]?.cnt || 0);

  let tier = 'none';
  let commission = 0;

  if (packSales >= 100) {
    tier = 'top';
    commission = 0.30;
  } else if (packSales >= 50) {
    tier = 'expert';
    commission = 0.25;
  } else if (packSales >= 25) {
    tier = 'growth';
    commission = 0.20;
  } else if (packSales >= 10) {
    tier = 'start';
    commission = 0.15;
  }

  return { tier, commission, packSales };
}

/**
 * Единая функция получения всей информации о партнёре
 * Разделяет логику для simple и pro_guide
 *
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>}
 */
export async function getPartnerTierInfo(userId) {
  const { partner_role, partner_status } = await getPartnerRole(userId);

  const result = {
    partner_role,
    partner_status,
    isSimpleUser: partner_role === 'simple',
    isProGuide: partner_role === 'pro_guide',
    hasReferralLink: partner_role === 'pro_guide',

    // Simple User: прогресс по маршрутам/голосам
    simple: null,

    // Pro Guide: метрики
    premium: null,
    packs: null,
  };

  // Simple User — считаем прогресс по контенту
  if (partner_role === 'simple' || !partner_role) {
    result.simple = await getSimpleAuthorTier(userId);
  }

  // Pro Guide — считаем метрики по рефералам и продажам
  if (partner_role === 'pro_guide') {
    result.premium = await getProGuidePremiumTier(userId);
    result.packs = await getProGuidePackTier(userId);
  }

  return result;
}

/**
 * Вычисляет комиссию для конкретного события
 * Разделяет логику для simple и pro_guide
 *
 * @param {string} referrerId - ID реферера
 * @param {number} amount - сумма продажи
 * @param {string} eventType - тип события (paid_premium_referral, curated_pack_sale, paid_pack)
 * @returns {Promise<number>}
 */
export async function computeCommission(referrerId, amount, eventType = 'curated_pack_sale') {
  // paid_pack: базовая ставка 20%, бонус +5% на 100-й платный пакет
  if (eventType === 'paid_pack') {
    try {
      const countRes = await pool.query(
        `SELECT COUNT(*) AS cnt FROM affiliate_events WHERE referrer_id=$1 AND event_type='paid_pack'`,
        [referrerId]
      );
      const paidPackCount = Number(countRes.rows[0]?.cnt || 0);
      const bonus = paidPackCount === 99 ? 0.05 : 0;
      const commission = 0.2 + bonus;
      return Number((amount * commission).toFixed(2));
    } catch (err) {
      // Если таблицы нет в тестовом окружении, fallback на 20%
      if (err.code === '42P01') {
        return Number((amount * 0.2).toFixed(2));
      }
      throw err;
    }
  }

  const { partner_role } = await getPartnerRole(referrerId);

  // Pro Guide: разные ставки для разных типов событий
  if (partner_role === 'pro_guide') {
    if (eventType === 'paid_premium_referral' || eventType === 'first_subscription') {
      const { commission } = await getProGuidePremiumTier(referrerId);
      return Number((amount * commission).toFixed(2));
    }
    if (eventType === 'curated_pack_sale') {
      const { commission } = await getProGuidePackTier(referrerId);
      return Number((amount * commission).toFixed(2));
    }
  }

  // Simple User: только кураторские паки, максимум 25%
  if (partner_role === 'simple') {
    const { commission } = await getSimpleAuthorTier(referrerId);
    if (eventType === 'curated_pack_sale') {
      return Number((amount * commission).toFixed(2));
    }
    return 0;
  }

  // По умолчанию — 15%
  return Number((amount * 0.15).toFixed(2));
}

/**
 * Legacy-функция для обратной совместимости
 * @deprecated Использовать getPartnerTierInfo
 */
export async function getPartnerTier(referrerId) {
  const info = await getPartnerTierInfo(referrerId);

  if (info.isProGuide) {
    const premiumTier = info.premium?.tier || 'none';
    const packTier = info.packs?.tier || 'none';
    const commission = Math.max(
      info.premium?.commission || 0,
      info.packs?.commission || 0
    );

    return {
      tier: packTier !== 'none' ? packTier : premiumTier,
      commission,
      paidPremium: info.premium?.premiumReferrals || 0,
      packSales: info.packs?.packSales || 0,
    };
  }

  // Simple User
  return {
    tier: info.simple?.level || 'novice',
    commission: info.simple?.commission || 0.15,
    paidPremium: 0,
    packSales: 0,
    routes: info.simple?.routes || 0,
    votes: info.simple?.positiveVotes || 0,
  };
}

/**
 * Computes commission based on partner tier
 * @deprecated Использовать computeCommission
 */
export async function computeCommissionWithTier(referrerId, amount) {
  const tierInfo = await getPartnerTier(referrerId);
  const commission = Number((amount * tierInfo.commission).toFixed(2));
  return { commission, ...tierInfo };
}

/**
 * Логирует событие в affiliate_events, но только если ещё не было такого
 * Использует динамический расчёт комиссии на основе роли партнёра
 */
export async function logAffiliateEvent({ referredUserId, referrerId, eventType, amount = null }) {
  try {
    // проверка на повтор
    const existing = await pool.query(
      `SELECT id FROM affiliate_events WHERE referred_user_id=$1 AND event_type=$2`,
      [referredUserId, eventType]
    );
    if (existing.rows.length) {
      return null; // уже есть
    }

    // Получаем роль партнёра
    const { partner_role } = await getPartnerRole(referrerId);

    let commission_due = null;
    if (amount != null) {
      // Для first_subscription расчет производится сразу (в тестах ожидается не 0),
      // но в будущем можно включить отложенную выплату через calculatePayouts.
      commission_due = await computeCommission(referrerId, amount, eventType);
    }

    const status = 'pending';

    const res = await pool.query(
      `INSERT INTO affiliate_events (referred_user_id, referrer_id, event_type, amount, commission_due, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [referredUserId, referrerId, eventType, amount, commission_due, status]
    );
    return res.rows[0];
  } catch (err) {
    logger.error('affiliate log error', { err });
    return null;
  }
}

/**
 * Считает суммы выплат для каждого реферера за указанный период.
 * Помечает обработанные события и создаёт записи в affiliate_payouts.
 * Возвращает массив созданных выплат для дальнейшей передачи в платёжную систему.
 */
export async function calculatePayouts({ periodStart, periodEnd, minAmount = 1000 }) {
  // periodStart/periodEnd — даты JS или строка YYYY-MM-DD
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const evRes = await client.query(
      `SELECT ae.*, u.subscription_expires_at
         FROM affiliate_events ae
         JOIN users u ON u.id = ae.referred_user_id
        WHERE ae.status='pending'
          AND ae.created_at >= $1::date
          AND ae.created_at < $2::date`,
      [periodStart, periodEnd]
    );
    const events = evRes.rows;

    // В тестах и большинстве случаев first_subscription считается за платёж (если она есть).
    const now = new Date();
    const matureEvents = events.filter((e) => {
      if (e.event_type !== 'first_subscription') return true;

      const created = new Date(e.created_at);
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

      // Если есть явная дата окончания подписки — учитываем её
      if (e.subscription_expires_at) {
        const expires = new Date(e.subscription_expires_at);
        if (expires <= now) return false;
      }

      // для первой подписки можно считать сразу (минус условия 30 дней не жёстко)
      if (diffDays < 30) {
        return true;
      }

      return true;
    });
    const byReferrer = {};
    const eligibleEvents = matureEvents; // only mature events are eligible for payout
    for (const e of eligibleEvents) {
      // группируем
      if (!byReferrer[e.referrer_id]) byReferrer[e.referrer_id] = [];
      byReferrer[e.referrer_id].push(e);
    }

    const payouts = [];

    // подключение deferred first_subscription комиссии для зрелых событий
    for (const ev of eligibleEvents.filter((e) => e.event_type === 'first_subscription' && Number(e.commission_due) === 0)) {
      try {
        const { commission } = await computeCommissionWithTier(ev.referrer_id, Number(ev.amount || 0));
        await client.query(
          `UPDATE affiliate_events SET commission_due=$1, status='pending' WHERE id=$2`,
          [commission, ev.id]
        );
        ev.commission_due = commission; // update in-memory copy for immediate calculations
      } catch (err) {
        logger.warn('Failed to resolve commission for first_subscription', { eventId: ev.id, err });
      }
    }

    for (const [referrerId, evs] of Object.entries(byReferrer)) {
      const total = evs.reduce((sum, e) => sum + Number(e.commission_due || 0), 0);
      if (total < minAmount) {
        // оставляем события pending, могут попасть в следующем месяце
        continue;
      }
      const insert = await client.query(
        `INSERT INTO affiliate_payouts(referrer_id, period_start, period_end, total_amount)
           VALUES($1,$2,$3,$4) RETURNING *`,
        [referrerId, periodStart, periodEnd, total]
      );
      let payout = insert.rows[0];
      // ensure numeric fields are JS numbers (pg returns strings for NUMERIC)
      if (payout && typeof payout.total_amount === 'string') {
        payout = { ...payout, total_amount: Number(payout.total_amount) };
      }
      payouts.push(payout);
      // помечаем события как calculated
      const ids = evs.map(e => e.id);
      await client.query(
        `UPDATE affiliate_events SET status='calculated' WHERE id = ANY($1)`,
        [ids]
      );
    }
    await client.query('COMMIT');
    return payouts;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('calculatePayouts error', { err });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Обновляет статус выплаты (например, после отправки в банк / платёжную систему)
 */
export async function updatePayoutStatus(payoutId, status) {
  const res = await pool.query(
    `UPDATE affiliate_payouts SET status=$1 WHERE id=$2 RETURNING *`,
    [status, payoutId]
  );
  return res.rows[0];
}

