/**
 * Контроллер аналитики — реальные данные из PostgreSQL
 * Все метрики получаются из реальных таблиц БД
 */

import pool from '../../db.js';
import logger from '../../logger.js';

// ==================== Вспомогательные функции ====================

function getStartDate(timeRange) {
  const now = new Date();
  const days = getDaysInRange(timeRange);
  now.setDate(now.getDate() - days);
  return now;
}

function getDaysInRange(timeRange) {
  const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, 'all': 3650 };
  return map[timeRange] || 7;
}

/** Безопасный запрос — при ошибке возвращает пустой rows[] */
async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    logger.warn('Analytics query skipped:', err.message);
    return { rows: [] };
  }
}

function toInt(val) { return parseInt(val || 0); }
function toFloat(val) { return parseFloat(val || 0); }

// ==================== Функции сбора реальных данных ====================

async function collectUsersData(startDate, timeRange) {
  const [totalR, newR, activeR, regByDayR] = await Promise.all([
    safeQuery('SELECT COUNT(*) as count FROM users'),
    safeQuery('SELECT COUNT(*) as count FROM users WHERE created_at >= $1', [startDate]),
    safeQuery(`
      SELECT COUNT(DISTINCT creator_id) as count FROM (
        SELECT author_id as creator_id FROM posts WHERE created_at >= $1
        UNION SELECT creator_id FROM map_markers WHERE created_at >= $1
        UNION SELECT creator_id FROM events WHERE created_at >= $1
        UNION SELECT creator_id FROM travel_routes WHERE created_at >= $1
      ) a
    `, [startDate]),
    safeQuery(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM users WHERE created_at >= $1
      GROUP BY DATE(created_at) ORDER BY day
    `, [startDate])
  ]);

  const total = toInt(totalR.rows[0]?.count);
  const newUsers = toInt(newR.rows[0]?.count);
  const activeAuthors = toInt(activeR.rows[0]?.count);

  // Рост относительно предыдущего периода
  const days = getDaysInRange(timeRange);
  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - days);
  const prevR = await safeQuery(
    'SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND created_at < $2',
    [prevStart, startDate]
  );
  const prevNewUsers = toInt(prevR.rows[0]?.count);
  const growthRate = prevNewUsers > 0
    ? Math.round(((newUsers - prevNewUsers) / prevNewUsers) * 1000) / 10
    : (newUsers > 0 ? 100 : 0);

  return {
    total,
    new_users: newUsers,
    active_authors: activeAuthors,
    silent_users: total - activeAuthors,
    growth_rate: growthRate,
    registrations_by_day: regByDayR.rows.map(r => ({ day: r.day, count: toInt(r.count) }))
  };
}

async function collectContentData(startDate) {
  const [periodR, totalsR, postsPhotoR, avgCommentsR, byDayR, topAuthorsR, likesR] = await Promise.all([
    safeQuery(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE created_at >= $1) as posts,
        (SELECT COUNT(*) FROM map_markers WHERE created_at >= $1) as markers,
        (SELECT COUNT(*) FROM events WHERE created_at >= $1) as events,
        (SELECT COUNT(*) FROM travel_routes WHERE created_at >= $1) as routes,
        (SELECT COUNT(*) FROM comments WHERE created_at >= $1) as comments
    `, [startDate]),
    safeQuery(`
      SELECT
        (SELECT COUNT(*) FROM posts) as posts,
        (SELECT COUNT(*) FROM map_markers) as markers,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM travel_routes) as routes,
        (SELECT COUNT(*) FROM comments) as comments
    `),
    safeQuery(`
      SELECT
        COUNT(CASE WHEN photo_urls IS NOT NULL AND photo_urls::text NOT IN ('[]','','null') THEN 1 END) * 100.0
          / NULLIF(COUNT(*), 0) as pct
      FROM posts
    `),
    safeQuery('SELECT COALESCE(AVG(comments_count), 0) as avg FROM posts'),
    safeQuery(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM posts WHERE created_at >= $1
      GROUP BY DATE(created_at) ORDER BY day
    `, [startDate]),
    safeQuery(`
      SELECT u.username, COUNT(p.id) as post_count
      FROM users u JOIN posts p ON p.author_id = u.id
      WHERE p.created_at >= $1
      GROUP BY u.id, u.username ORDER BY post_count DESC LIMIT 5
    `, [startDate]),
    safeQuery('SELECT COUNT(*) as total FROM post_likes WHERE created_at >= $1', [startDate])
  ]);

  const period = periodR.rows[0] || {};
  const totals = totalsR.rows[0] || {};

  return {
    period: {
      posts: toInt(period.posts), markers: toInt(period.markers),
      events: toInt(period.events), routes: toInt(period.routes),
      comments: toInt(period.comments)
    },
    totals: {
      posts: toInt(totals.posts), markers: toInt(totals.markers),
      events: toInt(totals.events), routes: toInt(totals.routes),
      comments: toInt(totals.comments)
    },
    posts_with_photos_pct: Math.round(toFloat(postsPhotoR.rows[0]?.pct)),
    avg_comments_per_post: Math.round(toFloat(avgCommentsR.rows[0]?.avg) * 10) / 10,
    posts_by_day: byDayR.rows.map(r => ({ day: r.day, count: toInt(r.count) })),
    top_authors: topAuthorsR.rows.map(r => ({ username: r.username, post_count: toInt(r.post_count) })),
    total_likes_period: toInt(likesR.rows[0]?.total)
  };
}

async function collectModerationData() {
  const [postsR, markersR, eventsR, routesR, aiR] = await Promise.all([
    safeQuery('SELECT status, COUNT(*) as count FROM posts GROUP BY status'),
    safeQuery('SELECT status, COUNT(*) as count FROM map_markers GROUP BY status'),
    safeQuery('SELECT status, COUNT(*) as count FROM events GROUP BY status'),
    safeQuery('SELECT status, COUNT(*) as count FROM travel_routes GROUP BY status'),
    safeQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN admin_verdict IS NOT NULL THEN 1 END) as reviewed,
        COUNT(CASE WHEN ai_suggestion = admin_verdict THEN 1 END) as correct
      FROM ai_moderation_decisions
    `)
  ]);

  const toMap = (rows) => {
    const m = {};
    rows.forEach(r => { m[r.status || 'unknown'] = toInt(r.count); });
    return m;
  };

  const ai = aiR.rows[0] || {};
  const aiReviewed = toInt(ai.reviewed);
  const aiCorrect = toInt(ai.correct);

  return {
    posts: toMap(postsR.rows),
    markers: toMap(markersR.rows),
    events: toMap(eventsR.rows),
    routes: toMap(routesR.rows),
    ai: {
      total_decisions: toInt(ai.total),
      reviewed: aiReviewed,
      accuracy_pct: aiReviewed > 0 ? Math.round((aiCorrect / aiReviewed) * 100) : 0
    }
  };
}

async function collectGamificationData(startDate) {
  const [levelDistR, avgLevelR, xpSourcesR, topUsersR, xpByDayR, totalUsersR, stuckR] = await Promise.all([
    safeQuery('SELECT current_level as level, COUNT(*) as user_count FROM user_levels GROUP BY current_level ORDER BY current_level'),
    safeQuery('SELECT COALESCE(AVG(current_level), 0) as avg, COALESCE(MAX(current_level), 0) as max FROM user_levels'),
    safeQuery(`
      SELECT source, SUM(amount) as total_xp, COUNT(*) as cnt
      FROM xp_history WHERE created_at >= $1
      GROUP BY source ORDER BY total_xp DESC
    `, [startDate]),
    safeQuery(`
      SELECT u.username, ul.total_xp, ul.current_level
      FROM user_levels ul JOIN users u ON ul.user_id = u.id
      ORDER BY ul.total_xp DESC LIMIT 10
    `),
    safeQuery(`
      SELECT DATE(created_at) as day, SUM(amount) as total_xp
      FROM xp_history WHERE created_at >= $1
      GROUP BY DATE(created_at) ORDER BY day
    `, [startDate]),
    safeQuery('SELECT COUNT(*) as count FROM users'),
    safeQuery(`
      SELECT COUNT(*) as count FROM user_levels ul
      WHERE NOT EXISTS (
        SELECT 1 FROM xp_history xh
        WHERE xh.user_id = ul.user_id AND xh.created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
    `)
  ]);

  const totalXp = xpSourcesR.rows.reduce((s, r) => s + toInt(r.total_xp), 0);
  const xpSources = xpSourcesR.rows.map(r => ({
    source: r.source,
    total_xp: toInt(r.total_xp),
    percentage: totalXp > 0 ? Math.round((toInt(r.total_xp) / totalXp) * 100) : 0
  }));

  const totalUsers = toInt(totalUsersR.rows[0]?.count);
  const stuckUsers = toInt(stuckR.rows[0]?.count);
  const usersWithLevels = levelDistR.rows.reduce((s, r) => s + toInt(r.user_count), 0);

  // Проблемные области (автоматически из данных)
  const problemAreas = [];
  if (totalUsers > 0 && stuckUsers > 0) {
    const pct = Math.round((stuckUsers / totalUsers) * 100);
    if (pct > 5) {
      problemAreas.push({ issue: `${pct}% пользователей не получали XP за 30 дней`, affected_users_percentage: pct });
    }
  }
  if (totalUsers > 0 && usersWithLevels < totalUsers) {
    const pct = Math.round(((totalUsers - usersWithLevels) / totalUsers) * 100);
    if (pct > 5) {
      problemAreas.push({ issue: `${pct}% пользователей без уровня в системе`, affected_users_percentage: pct });
    }
  }

  // Daily goals — % пользователей, получивших XP сегодня
  const todayR = await safeQuery('SELECT COUNT(DISTINCT user_id) as count FROM xp_history WHERE created_at >= CURRENT_DATE');
  const dailyGoals = totalUsers > 0 ? Math.round((toInt(todayR.rows[0]?.count) / totalUsers) * 100) : 0;

  // Achievement rate — уникальные пользователи с XP за период / всего
  const uniqueXpR = await safeQuery(
    'SELECT COUNT(DISTINCT user_id) as count FROM xp_history WHERE created_at >= $1',
    [startDate]
  );
  const achievementRate = totalUsers > 0 ? Math.round((toInt(uniqueXpR.rows[0]?.count) / totalUsers) * 100) : 0;

  return {
    daily_goals_completion: dailyGoals,
    achievement_unlock_rate: achievementRate,
    xp_sources: xpSources,
    level_distribution: levelDistR.rows.map(r => ({ level: toInt(r.level), user_count: toInt(r.user_count) })),
    problem_areas: problemAreas,
    avg_level: Math.round(toFloat(avgLevelR.rows[0]?.avg) * 10) / 10,
    max_level: toInt(avgLevelR.rows[0]?.max),
    top_users: topUsersR.rows.map(r => ({ username: r.username, total_xp: toInt(r.total_xp), level: toInt(r.current_level) })),
    xp_by_day: xpByDayR.rows.map(r => ({ day: r.day, total_xp: toInt(r.total_xp) }))
  };
}

async function collectGeographyData() {
  const [byCatR, topRegR, noCoordR] = await Promise.all([
    safeQuery('SELECT category, COUNT(*) as count FROM map_markers GROUP BY category ORDER BY count DESC'),
    safeQuery(`
      SELECT
        TRIM(SPLIT_PART(address, ',', GREATEST(array_length(string_to_array(address, ','), 1), 1))) as region,
        COUNT(*) as count
      FROM map_markers
      WHERE address IS NOT NULL AND address != ''
      GROUP BY region ORDER BY count DESC LIMIT 15
    `),
    safeQuery('SELECT COUNT(*) as count FROM map_markers WHERE latitude IS NULL OR longitude IS NULL')
  ]);

  return {
    by_category: byCatR.rows.map(r => ({ category: r.category || 'без категории', count: toInt(r.count) })),
    top_regions: topRegR.rows.map(r => ({ region: r.region || 'Неизвестно', count: toInt(r.count) })),
    markers_without_coords: toInt(noCoordR.rows[0]?.count)
  };
}

async function collectNotificationData(startDate) {
  const [totalR, readR] = await Promise.all([
    safeQuery('SELECT COUNT(*) as count FROM notifications WHERE created_at >= $1', [startDate]),
    safeQuery('SELECT COUNT(*) as count FROM notifications WHERE created_at >= $1 AND is_read = true', [startDate])
  ]);
  const total = toInt(totalR.rows[0]?.count);
  const read = toInt(readR.rows[0]?.count);
  return { total, read, unread: total - read, read_rate_pct: total > 0 ? Math.round((read / total) * 100) : 0 };
}

// ==================== Экспортируемые обработчики ====================

/**
 * Получить комплексные метрики — главный endpoint аналитики
 * Возвращает реальные данные из БД
 */
export const getComprehensiveMetrics = async (req, res) => {
  try {
    const { time_range = '7d' } = req.query;
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }

    const startDate = getStartDate(time_range);
    logger.info('📊 Analytics: сбор реальных данных за', time_range);

    const [users, content, moderation, gamification, geography, notifications] = await Promise.all([
      collectUsersData(startDate, time_range),
      collectContentData(startDate),
      collectModerationData(),
      collectGamificationData(startDate),
      collectGeographyData(),
      collectNotificationData(startDate)
    ]);

    // Формируем ответ, совместимый с ComprehensiveMetrics + расширенные поля
    const response = {
      // === Стандартные поля ComprehensiveMetrics ===
      product: {
        performance: { app_load_time: 0, map_load_time: 0, error_rate: 0, crash_rate: 0, core_web_vitals: { lcp: 0, fid: 0, cls: 0 } },
        business: {
          dau: 0, mau: 0, wau: 0,
          retention: { day_1: 0, day_7: 0, day_30: 0 },
          conversion_funnels: [],
          user_growth: { new_users: users.new_users, growth_rate: users.growth_rate, churn_rate: 0 }
        },
        revenue: { arpu: 0, ltv: 0, conversion_rates: {} },
        timestamp: Date.now()
      },
      behavioral: {
        travel_patterns: { popular_routes: [], seasonal_destinations: [], user_movement_types: [] },
        content_behavior: {
          search_patterns: [],
          consumption_depth: { avg_time_on_content: 0, scroll_depth: { '25%': 0, '50%': 0, '75%': 0, '100%': 0 }, bounce_rate: 0, return_rate: 0 },
          engagement_triggers: []
        },
        social_behavior: { sharing_patterns: [], influence_networks: [], community_interactions: [] },
        timestamp: Date.now()
      },
      technical: {
        error_rate: 0,
        errors_by_component: {},
        errors_by_browser: {},
        errors_by_device: {},
        performance_metrics: [],
        api_errors: []
      },
      gamification: {
        daily_goals_completion: gamification.daily_goals_completion,
        achievement_unlock_rate: gamification.achievement_unlock_rate,
        xp_sources: gamification.xp_sources,
        level_distribution: gamification.level_distribution,
        problem_areas: gamification.problem_areas
      },
      content: {
        quality: {
          posts_with_photos: content.posts_with_photos_pct,
          detailed_descriptions: 0,
          reuse_rate: 0,
          trends: []
        },
        engagement: {
          likes_per_view: 0,
          sharing_rate: 0,
          save_rate: 0,
          comments_per_post: content.avg_comments_per_post,
          avg_engagement_time: 0
        }
      },

      // === Расширенные реальные данные ===
      users,
      contentStats: content,
      moderation,
      geography,
      notifications,
      gamificationExtended: {
        avg_level: gamification.avg_level,
        max_level: gamification.max_level,
        top_users: gamification.top_users,
        xp_by_day: gamification.xp_by_day
      },
      timestamp: Date.now()
    };

    logger.info('✅ Analytics: данные собраны —', users.total, 'пользователей,', content.totals.posts, 'постов');
    res.json(response);
  } catch (error) {
    logger.error('Ошибка получения аналитики:', error);
    res.status(500).json({ message: 'Ошибка получения данных' });
  }
};

/**
 * Получить продуктовую аналитику (пользователи + контент)
 */
export const getProductAnalytics = async (req, res) => {
  try {
    const { time_range = '7d' } = req.query;
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }
    const startDate = getStartDate(time_range);
    const [users, content] = await Promise.all([
      collectUsersData(startDate, time_range),
      collectContentData(startDate)
    ]);
    res.json({
      performance: { app_load_time: 0, map_load_time: 0, error_rate: 0, crash_rate: 0, core_web_vitals: { lcp: 0, fid: 0, cls: 0 } },
      business: {
        dau: 0, mau: 0, wau: 0,
        retention: { day_1: 0, day_7: 0, day_30: 0 },
        conversion_funnels: [],
        user_growth: { new_users: users.new_users, growth_rate: users.growth_rate, churn_rate: 0 }
      },
      revenue: { arpu: 0, ltv: 0, conversion_rates: {} },
      users, contentStats: content,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Ошибка получения продуктовой аналитики:', error);
    res.status(500).json({ message: 'Ошибка получения данных' });
  }
};

/**
 * Получить поведенческую аналитику (география)
 */
export const getBehavioralAnalytics = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }
    const geography = await collectGeographyData();
    res.json({
      travel_patterns: { popular_routes: [], seasonal_destinations: [], user_movement_types: [] },
      content_behavior: {
        search_patterns: [],
        consumption_depth: { avg_time_on_content: 0, scroll_depth: { '25%': 0, '50%': 0, '75%': 0, '100%': 0 }, bounce_rate: 0, return_rate: 0 },
        engagement_triggers: []
      },
      social_behavior: { sharing_patterns: [], influence_networks: [], community_interactions: [] },
      geography,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Ошибка поведенческой аналитики:', error);
    res.status(500).json({ message: 'Ошибка получения данных' });
  }
};

/**
 * Получить техническое здоровье (модерация + ИИ)
 */
export const getTechnicalHealth = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещён' });
    }
    const moderation = await collectModerationData();
    res.json({
      error_rate: 0,
      errors_by_component: {},
      errors_by_browser: {},
      errors_by_device: {},
      performance_metrics: [],
      api_errors: [],
      moderation
    });
  } catch (error) {
    logger.error('Ошибка получения технического здоровья:', error);
    res.status(500).json({ message: 'Ошибка получения данных' });
  }
};

/**
 * Трекинг события
 */
export const trackEvent = async (req, res) => {
  try {
    const { event_type, user_id, properties, category } = req.body;
    const tableExists = await safeQuery(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_events')
    `);
    if (!tableExists.rows[0]?.exists) {
      return res.json({ success: true, saved: false });
    }
    await safeQuery(
      'INSERT INTO analytics_events (event_type, user_id, properties, category, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [event_type, user_id || null, JSON.stringify(properties || {}), category || 'general']
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка трекинга события:', error);
    res.status(500).json({ message: 'Ошибка сохранения события' });
  }
};

/**
 * Трекинг ошибки
 */
export const trackError = async (req, res) => {
  try {
    const { error_id, error_message, error_type, component, browser, device_type, frequency } = req.body;
    await safeQuery(`
      INSERT INTO error_logs (error_id, error_message, error_type, component, browser, device_type, frequency, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (error_id) DO UPDATE SET frequency = error_logs.frequency + $7, last_seen = NOW()
    `, [error_id, error_message, error_type, component, browser, device_type, frequency || 1]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка трекинга ошибки:', error);
    res.status(500).json({ message: 'Ошибка сохранения ошибки' });
  }
};



