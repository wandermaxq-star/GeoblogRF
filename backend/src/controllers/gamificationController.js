import pool from '../../db.js';
import { calculateLevelFromTotalXP } from '../utils/xpCalculator.js';
import logger from '../../logger.js';


/**
 * Определить этап геймификации на основе количества пользователей
 */
function getGamificationStage(userCount) {
  if (userCount < 50) return 1;
  if (userCount < 200) return 2;
  if (userCount < 500) return 3;
  return 4;
}

/**
 * Получить активные функции для этапа
 */
function getActiveFeatures(stage) {
  return {
    basicLevels: true,
    basicXP: true,
    basicAchievements: true,
    dailyGoals: true, // Базовая функция Центра Влияния — включена всегда
    qualityAchievements: stage >= 2,
    streak: true, // Стрик — включён всегда (мотивация)
    leaderboards: stage >= 3,
    specialEvents: stage >= 3,
    advancedBoosts: stage >= 4,
  };
}

/**
 * Получить уровень пользователя
 */
export const getUserLevel = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Получаем или создаём уровень пользователя
    let result = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Создаём начальный уровень
      await pool.query(
        `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
         VALUES ($1, 0, 1, 0, 100, 'novice')`,
        [userId]
      );
      
      result = await pool.query(
        'SELECT * FROM user_levels WHERE user_id = $1',
        [userId]
      );
    }

    const levelData = result.rows[0];
    
    // Рассчитываем прогресс
    const progress = levelData.required_xp > 0 
      ? (levelData.current_level_xp / levelData.required_xp) * 100 
      : 100;

    res.json({
      level: levelData.current_level,
      currentXP: levelData.current_level_xp,
      requiredXP: levelData.required_xp,
      totalXP: levelData.total_xp,
      rank: levelData.rank,
      progress: Math.min(100, Math.max(0, progress)),
    });
  } catch (error) {
    logger.error('getUserLevel error:', error);
    res.status(500).json({ error: 'Failed to get user level' });
  }
};

/**
 * Добавить XP пользователю
 */
export const addXP = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { source, amount, contentId, contentType, metadata } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!source || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid XP parameters' });
    }

    // Проверяем уникальность действия (защита от накруток)
    if (contentId) {
      const existingAction = await pool.query(
        'SELECT id FROM gamification_actions WHERE user_id = $1 AND source = $2 AND content_id = $3',
        [userId, source, contentId]
      );

      if (existingAction.rows.length > 0) {
        return res.status(400).json({ error: 'Duplicate action', reason: 'duplicate' });
      }
    }

    // Получаем текущий уровень
    let levelResult = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );

    if (levelResult.rows.length === 0) {
      // Создаём начальный уровень
      await pool.query(
        `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
         VALUES ($1, 0, 1, 0, 100, 'novice')`,
        [userId]
      );
      
      levelResult = await pool.query(
        'SELECT * FROM user_levels WHERE user_id = $1',
        [userId]
      );
    }

    const currentLevel = levelResult.rows[0];
    const newTotalXP = currentLevel.total_xp + amount;
    
    // Рассчитываем новый уровень
    const newLevelData = calculateLevelFromTotalXP(newTotalXP);
    
    // Обновляем уровень пользователя
    await pool.query(
      `UPDATE user_levels 
       SET total_xp = $1, current_level = $2, current_level_xp = $3, 
           required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6`,
      [
        newTotalXP,
        newLevelData.level,
        newLevelData.currentLevelXP,
        newLevelData.requiredXP,
        newLevelData.rank,
        userId
      ]
    );

    // Записываем в историю XP
    await pool.query(
      `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, source, amount, contentId || null, contentType || null, JSON.stringify(metadata || {})]
    );

    // Записываем действие для проверки уникальности
    if (contentId) {
      await pool.query(
        `INSERT INTO gamification_actions (user_id, source, content_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, source, content_id) DO NOTHING`,
        [userId, source, contentId]
      );
    }

    const levelUp = newLevelData.level > currentLevel.current_level;

    res.json({
      success: true,
      newLevel: newLevelData.level,
      levelUp,
      totalXP: newTotalXP,
      currentLevelXP: newLevelData.currentLevelXP,
      requiredXP: newLevelData.requiredXP,
    });
  } catch (error) {
    logger.error('addXP error:', error);
    res.status(500).json({ error: 'Failed to add XP', details: error.message });
  }
};

/**
 * Получить ежедневные цели
 */
export const getDailyGoals = async (req, res) => {
  try {
    const userId = req.user?.id;
    const today = new Date().toISOString().split('T')[0];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем цели на сегодня
    let goals = await pool.query(
      'SELECT * FROM daily_goals WHERE user_id = $1 AND date = $2 ORDER BY created_at',
      [userId, today]
    );

    // Если целей нет, создаём новые автоматически
    if (goals.rows.length === 0) {
      const generatedGoals = generateDailyGoals();
      
      for (const goal of generatedGoals) {
        await pool.query(
          `INSERT INTO daily_goals (user_id, goal_id, type, title, description, target, current, completed, xp_reward, difficulty, icon, date)
           VALUES ($1, $2, $3, $4, $5, $6, 0, FALSE, $7, $8, $9, $10)
           ON CONFLICT (user_id, goal_id, date) DO NOTHING`,
          [userId, goal.id, goal.type, goal.title, goal.description, goal.target, goal.xpReward, goal.difficulty, goal.icon, today]
        );
      }
      
      // Перечитываем из БД
      goals = await pool.query(
        'SELECT * FROM daily_goals WHERE user_id = $1 AND date = $2 ORDER BY created_at',
        [userId, today]
      );
      
      if (goals.rows.length === 0) {
        // Если не удалось вставить — прямой возврат сгенерированных
        return res.json({ goals: generatedGoals.map(g => ({
          ...g, current: 0, completed: false, date: today
        })) });
      }
    }

    // Маппим колонки БД в формат фронтенда (camelCase)
    const mappedGoals = goals.rows.map(row => ({
      id: row.goal_id,
      type: row.type,
      title: row.title,
      description: row.description,
      target: row.target,
      current: row.current,
      completed: row.completed,
      xpReward: row.xp_reward,
      difficulty: row.difficulty,
      icon: row.icon,
    }));

    res.json({ goals: mappedGoals });
  } catch (error) {
    logger.error('getDailyGoals error:', error);
    res.status(500).json({ error: 'Failed to get daily goals' });
  }
};

/**
 * Выполнить цель
 */
export const completeGoal = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { goalId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Обновляем цель
    const result = await pool.query(
      `UPDATE daily_goals 
       SET completed = TRUE, current = target, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND goal_id = $2 AND date = $3
       RETURNING *`,
      [userId, goalId, today]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = result.rows[0];

    // Добавляем XP за выполнение цели
    if (goal.xp_reward > 0) {
      // Вызываем addXP через внутренний механизм
      // (упрощённая версия, в реальности лучше использовать общую функцию)
      const levelResult = await pool.query(
        'SELECT * FROM user_levels WHERE user_id = $1',
        [userId]
      );

      if (levelResult.rows.length > 0) {
        const currentLevel = levelResult.rows[0];
        const newTotalXP = currentLevel.total_xp + goal.xp_reward;
        const newLevelData = calculateLevelFromTotalXP(newTotalXP);

        await pool.query(
          `UPDATE user_levels 
           SET total_xp = $1, current_level = $2, current_level_xp = $3, 
               required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $6`,
          [
            newTotalXP,
            newLevelData.level,
            newLevelData.currentLevelXP,
            newLevelData.requiredXP,
            newLevelData.rank,
            userId
          ]
        );
      }
    }

    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    logger.error('completeGoal error:', error);
    res.status(500).json({ error: 'Failed to complete goal' });
  }
};

/**
 * Получить награду за день
 */
export const claimDailyReward = async (req, res) => {
  try {
    const userId = req.user?.id;
    const today = new Date().toISOString().split('T')[0];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Проверяем, все ли цели выполнены
    const goals = await pool.query(
      'SELECT * FROM daily_goals WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (goals.rows.length === 0) {
      return res.status(400).json({ error: 'No goals found' });
    }

    const allCompleted = goals.rows.every(g => g.completed);

    if (!allCompleted) {
      return res.status(400).json({ error: 'Not all goals completed' });
    }

    // Проверяем, не получена ли уже награда
    const history = await pool.query(
      'SELECT * FROM daily_goals_history WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (history.rows.length > 0 && history.rows[0].reward_claimed) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // Рассчитываем бонус XP (50% от всех целей)
    const totalXP = goals.rows.reduce((sum, g) => sum + g.xp_reward, 0);
    const bonusXP = Math.floor(totalXP * 0.5);

    // Добавляем бонус XP
    const levelResult = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );

    if (levelResult.rows.length > 0) {
      const currentLevel = levelResult.rows[0];
      const newTotalXP = currentLevel.total_xp + bonusXP;
      const newLevelData = calculateLevelFromTotalXP(newTotalXP);

      await pool.query(
        `UPDATE user_levels 
         SET total_xp = $1, current_level = $2, current_level_xp = $3, 
             required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $6`,
        [
          newTotalXP,
          newLevelData.level,
          newLevelData.currentLevelXP,
          newLevelData.requiredXP,
          newLevelData.rank,
          userId
        ]
      );
    }

    // Обновляем историю
    await pool.query(
      `INSERT INTO daily_goals_history (user_id, date, all_completed, reward_claimed, streak)
       VALUES ($1, $2, TRUE, TRUE, 
         COALESCE((SELECT streak FROM daily_goals_history WHERE user_id = $1 AND date = $3 ORDER BY date DESC LIMIT 1), 0) + 1)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET all_completed = TRUE, reward_claimed = TRUE, streak = 
         COALESCE((SELECT streak FROM daily_goals_history WHERE user_id = $1 AND date = $3 ORDER BY date DESC LIMIT 1), 0) + 1`,
      [userId, today, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
    );

    res.json({ success: true, bonusXP });
  } catch (error) {
    logger.error('claimDailyReward error:', error);
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
};

/**
 * Полный каталог достижений — хранится в коде, прогресс — в БД
 */
const ACHIEVEMENT_CATALOG = [
  // Категория: places (Исследователь)
  { id: 'explorer_10', title: 'Первые шаги', description: 'Добавь 10 маркеров на карту', icon: '🗺️', category: 'places', rarity: 'common', target: 10, xpReward: 50 },
  { id: 'explorer_50', title: 'Картограф', description: 'Добавь 50 маркеров на карту', icon: '🗺️', category: 'places', rarity: 'rare', target: 50, xpReward: 150 },
  { id: 'explorer_100', title: 'Мастер карт', description: 'Добавь 100 маркеров на карту', icon: '🗺️', category: 'places', rarity: 'epic', target: 100, xpReward: 300 },
  // Категория: posts (Фотограф / Блогер)
  { id: 'photo_5', title: 'Фотолюбитель', description: 'Создай 5 постов с фото', icon: '📸', category: 'posts', rarity: 'common', target: 5, xpReward: 50 },
  { id: 'photo_20', title: 'Фотограф', description: 'Создай 20 постов с фото', icon: '📸', category: 'posts', rarity: 'rare', target: 20, xpReward: 150 },
  { id: 'photo_100', title: 'Фотомастер', description: 'Создай 100 постов с фото', icon: '📸', category: 'posts', rarity: 'epic', target: 100, xpReward: 300 },
  { id: 'blog_5', title: 'Начинающий автор', description: 'Напиши 5 постов', icon: '✍️', category: 'posts', rarity: 'common', target: 5, xpReward: 50 },
  { id: 'comment_50', title: 'Комментатор', description: 'Оставь 50 комментариев', icon: '💬', category: 'posts', rarity: 'rare', target: 50, xpReward: 100 },
  // Категория: activity (Активность)
  { id: 'streak_7', title: 'Неделя огня', description: '7 дней подряд выполняй задания', icon: '🔥', category: 'activity', rarity: 'common', target: 7, xpReward: 100 },
  { id: 'streak_30', title: 'Месяц огня', description: '30 дней подряд выполняй задания', icon: '🔥', category: 'activity', rarity: 'rare', target: 30, xpReward: 300 },
  { id: 'streak_100', title: 'Огненная легенда', description: '100 дней подряд выполняй задания', icon: '🔥', category: 'activity', rarity: 'legendary', target: 100, xpReward: 1000 },
  { id: 'daily_allcomplete_10', title: 'Трудоголик', description: 'Выполни все дневные задания 10 раз', icon: '⚡', category: 'activity', rarity: 'rare', target: 10, xpReward: 200 },
  // Категория: quality
  { id: 'quality_5', title: 'Мастер качества', description: 'Получи 5 оценок «Отлично»', icon: '⭐', category: 'quality', rarity: 'epic', target: 5, xpReward: 200 },
  // Категория: special
  { id: 'best_user_month', title: 'Лучший пользователь', description: 'Стань топ-1 за месяц', icon: '👑', category: 'special', rarity: 'legendary', target: 1, xpReward: 500 },
];

/** Подсчитать реальный прогресс пользователя для достижения */
async function getAchievementProgress(userId, achievementId) {
  try {
    switch (achievementId) {
      case 'explorer_10':
      case 'explorer_50':
      case 'explorer_100': {
        const r = await pool.query('SELECT COUNT(*) as cnt FROM map_markers WHERE creator_id = $1', [userId]);
        return parseInt(r.rows[0]?.cnt) || 0;
      }
      case 'photo_5':
      case 'photo_20':
      case 'photo_100':
      case 'blog_5': {
        const r = await pool.query('SELECT COUNT(*) as cnt FROM posts WHERE author_id = $1', [userId]);
        return parseInt(r.rows[0]?.cnt) || 0;
      }
      case 'comment_50': {
        const r = await pool.query('SELECT COUNT(*) as cnt FROM comments WHERE author_id = $1', [userId]);
        return parseInt(r.rows[0]?.cnt) || 0;
      }
      case 'streak_7':
      case 'streak_30':
      case 'streak_100': {
        const r = await pool.query(
          'SELECT COALESCE(MAX(streak), 0) as max_streak FROM daily_goals_history WHERE user_id = $1',
          [userId]
        );
        return parseInt(r.rows[0]?.max_streak) || 0;
      }
      case 'daily_allcomplete_10': {
        const r = await pool.query(
          'SELECT COUNT(*) as cnt FROM daily_goals_history WHERE user_id = $1 AND all_completed = TRUE',
          [userId]
        );
        return parseInt(r.rows[0]?.cnt) || 0;
      }
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

export const getAchievements = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем сохранённый прогресс из БД
    let savedMap = new Map();
    try {
      const saved = await pool.query(
        'SELECT * FROM user_achievements WHERE user_id = $1',
        [userId]
      );
      savedMap = new Map(saved.rows.map(r => [r.achievement_id, r]));
    } catch (e) {
      // Таблица может не существовать — продолжаем без сохранённого прогресса
      logger.warn('user_achievements table not found, using computed progress only');
    }

    // Собираем полный каталог с реальным прогрессом
    const achievements = [];
    for (const def of ACHIEVEMENT_CATALOG) {
      const savedRow = savedMap.get(def.id);
      const current = await getAchievementProgress(userId, def.id);
      const unlocked = current >= def.target;

      // Синхронизируем в БД если прогресс изменился
      try {
        if (savedRow) {
          if (current !== savedRow.progress_current || unlocked !== savedRow.unlocked) {
            await pool.query(
              `UPDATE user_achievements SET progress_current = $1, unlocked = $2, 
               unlocked_at = CASE WHEN $2 = TRUE AND unlocked_at IS NULL THEN CURRENT_TIMESTAMP ELSE unlocked_at END,
               updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $3 AND achievement_id = $4`,
              [current, unlocked, userId, def.id]
            );
          }
        } else {
          await pool.query(
            `INSERT INTO user_achievements (user_id, achievement_id, unlocked, unlocked_at, progress_current, progress_target)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, achievement_id) DO NOTHING`,
            [userId, def.id, unlocked, unlocked ? new Date().toISOString() : null, current, def.target]
          );
        }
      } catch (e) {
        // Таблица может не существовать — пропускаем синхронизацию
      }

      achievements.push({
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        rarity: def.rarity,
        progress: { current: Math.min(current, def.target), target: def.target },
        unlocked,
        unlockedAt: savedRow?.unlocked_at || (unlocked ? new Date().toISOString() : undefined),
        xpReward: def.xpReward,
      });
    }

    res.json({ achievements });
  } catch (error) {
    logger.error('getAchievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
};

/**
 * Получить статистику
 */
/**
 * Получить feature flags и количество пользователей
 */
export const getFeatures = async (req, res) => {
  try {
    // Получаем количество пользователей
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userCountResult.rows[0].count) || 0;
    
    // Определяем этап
    const stage = getGamificationStage(userCount);
    
    // Получаем активные функции
    const features = getActiveFeatures(stage);
    
    res.json({
      features,
      stage,
      userCount,
    });
  } catch (error) {
    logger.error('getFeatures error:', error);
    res.status(200).json({ 
      error: 'Failed to get features',
      features: getActiveFeatures(1), // Fallback к этапу 1
      stage: 1,
      userCount: 0,
      fallback: true,
    });
  }
};

/**
 * Ретроактивное начисление XP и достижений для гостя при регистрации
 */
export const applyRetroactiveGamification = async (req, res) => {
  try {
    const { guestId, userId } = req.body;
    const currentUserId = req.user?.id || userId;
    
    if (!guestId || !currentUserId) {
      return res.status(400).json({ error: 'guestId and userId required' });
    }
    
    // TODO: Получить одобренные действия гостя из БД
    // Пока используем логику из frontend
    // В будущем можно хранить действия гостей в БД
    
    // Получаем уровень пользователя после начисления
    const levelResult = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [currentUserId]
    );
    
    const levelData = levelResult.rows[0] || {
      current_level: 1,
      total_xp: 0,
      rank: 'novice',
    };
    
    res.json({
      success: true,
      level: levelData.current_level,
      totalXP: levelData.total_xp,
      rank: levelData.rank,
      message: 'Retroactive gamification applied',
    });
  } catch (error) {
    logger.error('applyRetroactiveGamification error:', error);
    res.status(500).json({ error: 'Failed to apply retroactive gamification' });
  }
};

/**
 * Отметить действие гостя как одобренное (вызывается модератором)
 */
export const markGuestActionAsApproved = async (req, res) => {
  try {
    const { contentId, actionType } = req.body;
    
    if (!contentId || !actionType) {
      return res.status(400).json({ error: 'contentId and actionType required' });
    }
    
    // TODO: Сохранить в БД, что действие одобрено
    // Пока это делается на frontend через localStorage
    // В будущем можно хранить в таблице guest_actions
    
    res.json({
      success: true,
      message: 'Guest action marked as approved',
    });
  } catch (error) {
    logger.error('markGuestActionAsApproved error:', error);
    res.status(500).json({ error: 'Failed to mark guest action as approved' });
  }
};

export const getStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем уровень
    const levelResult = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );

    // Получаем достижения
    const achievementsResult = await pool.query(
      'SELECT * FROM user_achievements WHERE user_id = $1',
      [userId]
    );

    // Получаем стрик
    const today = new Date().toISOString().split('T')[0];
    const historyResult = await pool.query(
      'SELECT * FROM daily_goals_history WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
      [userId]
    );

    // Получаем цели на сегодня
    const goalsResult = await pool.query(
      'SELECT * FROM daily_goals WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const level = levelResult.rows[0] || null;
    const achievementRows = achievementsResult.rows || [];
    const streak = historyResult.rows[0]?.streak || 0;
    const goals = goalsResult.rows || [];
    const todayProgress = goals.length > 0 
      ? (goals.filter(g => g.completed).length / goals.length) * 100 
      : 0;

    // Маппим достижения через каталог для получения rarity
    const catalogMap = new Map(ACHIEVEMENT_CATALOG.map(c => [c.id, c]));
    const byRarity = {};
    let unlockedCount = 0;
    for (const a of achievementRows) {
      const def = catalogMap.get(a.achievement_id);
      const rarity = def?.rarity || 'common';
      if (!byRarity[rarity]) byRarity[rarity] = 0;
      if (a.unlocked) {
        byRarity[rarity]++;
        unlockedCount++;
      }
    }

    // Последние начисления XP
    let recentXP = [];
    try {
      const xpResult = await pool.query(
        'SELECT source, amount, created_at FROM xp_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      recentXP = xpResult.rows.map(r => ({
        source: r.source,
        amount: r.amount,
        timestamp: r.created_at,
      }));
    } catch (e) {
      logger.warn('Failed to load recentXP:', e.message);
    }

    res.json({
      userLevel: level ? {
        level: level.current_level,
        currentXP: level.current_level_xp,
        requiredXP: level.required_xp,
        totalXP: level.total_xp,
        rank: level.rank,
        progress: level.required_xp > 0 
          ? (level.current_level_xp / level.required_xp) * 100 
          : 100,
      } : null,
      achievements: {
        total: ACHIEVEMENT_CATALOG.length,
        unlocked: unlockedCount,
        byRarity,
      },
      dailyGoals: {
        current: goals,
        streak,
        todayProgress,
      },
      recentXP,
    });
  } catch (error) {
    logger.error('getStats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

/**
 * Генератор ежедневных целей — 3 задания разной сложности
 */
function generateDailyGoals() {
  // Пул возможных целей
  const goalPool = [
    { id: 'post_1', type: 'create_posts', title: 'Создай пост', description: 'Создай 1 пост с фото', target: 1, xpReward: 20, difficulty: 'easy', icon: '✍️' },
    { id: 'post_2', type: 'create_posts', title: 'Напиши 2 поста', description: 'Создай 2 поста за сегодня', target: 2, xpReward: 35, difficulty: 'medium', icon: '✍️' },
    { id: 'marker_1', type: 'create_markers', title: 'Добавь метку', description: 'Отметь 1 интересное место на карте', target: 1, xpReward: 20, difficulty: 'easy', icon: '📍' },
    { id: 'marker_3', type: 'create_markers', title: 'Добавь 3 метки', description: 'Отметь 3 интересных места', target: 3, xpReward: 40, difficulty: 'medium', icon: '📍' },
    { id: 'photo_2', type: 'add_photos', title: 'Добавь фото', description: 'Добавь 2 фото к постам или маркерам', target: 2, xpReward: 15, difficulty: 'easy', icon: '📸' },
    { id: 'photo_5', type: 'add_photos', title: 'Фотосессия', description: 'Добавь 5 фото за сегодня', target: 5, xpReward: 30, difficulty: 'medium', icon: '📸' },
    { id: 'quality_1', type: 'improve_quality', title: 'Качественный контент', description: 'Создай контент с описанием > 100 символов', target: 1, xpReward: 25, difficulty: 'medium', icon: '⭐' },
  ];

  // Берём по одной из каждой категории, остальное — рандом
  const categories = ['create_posts', 'create_markers', 'add_photos'];
  const selected = [];
  const usedCategories = new Set();

  // Перемешиваем
  const shuffled = goalPool.sort(() => Math.random() - 0.5);

  for (const goal of shuffled) {
    if (selected.length >= 3) break;
    if (usedCategories.has(goal.type)) continue;
    selected.push(goal);
    usedCategories.add(goal.type);
  }

  // Дополняем до 3 если не набрали
  for (const goal of shuffled) {
    if (selected.length >= 3) break;
    if (!selected.find(s => s.id === goal.id)) {
      selected.push(goal);
    }
  }

  // Добавляем суффикс даты к id для уникальности
  const today = new Date().toISOString().split('T')[0];
  return selected.map(g => ({
    ...g,
    id: `${g.id}_${today}`,
  }));
}

/**
 * Публичный профиль пользователя для Центра Влияния
 * GET /api/gamification/user/:userId/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Уровень пользователя
    const levelResult = await pool.query(
      'SELECT * FROM user_levels WHERE user_id = $1',
      [userId]
    );

    // Имя пользователя
    const userResult = await pool.query(
      'SELECT username, email FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const level = levelResult.rows[0];

    // Достижения
    const achievementsResult = await pool.query(
      'SELECT * FROM user_achievements WHERE user_id = $1',
      [userId]
    );

    // Стрик
    const historyResult = await pool.query(
      'SELECT * FROM daily_goals_history WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
      [userId]
    );

    // Статистика контента
    const markersCount = await pool.query(
      'SELECT COUNT(*) FROM markers WHERE user_id = $1',
      [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const postsCount = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE author_id = $1',
      [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const routesCount = await pool.query(
      'SELECT COUNT(*) FROM travel_routes WHERE creator_id = $1',
      [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const commentsCount = await pool.query(
      'SELECT COUNT(*) FROM comments WHERE author_id = $1',
      [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const levelData = level ? {
      level: level.current_level,
      currentXP: level.current_level_xp || 0,
      requiredXP: level.required_xp || 100,
      totalXP: level.total_xp || 0,
      rank: level.rank || 'novice',
      progress: level.required_xp > 0 
        ? Math.round((level.current_level_xp / level.required_xp) * 100) 
        : 0,
    } : {
      level: 1, currentXP: 0, requiredXP: 100, totalXP: 0, rank: 'novice', progress: 0,
    };

    const achievements = (achievementsResult.rows || []).map(a => ({
      id: a.achievement_id,
      title: a.title || a.achievement_id,
      description: a.description || '',
      icon: a.icon || '🏆',
      category: a.category || 'special',
      rarity: a.rarity || 'common',
      progress: { current: a.progress_current || 0, target: a.progress_target || 1 },
      unlocked: a.unlocked || false,
      unlockedAt: a.unlocked_at,
      xpReward: a.xp_reward || 0,
    }));

    res.json({
      userId,
      username: user.username || user.email?.split('@')[0] || 'Пользователь',
      level: levelData.level,
      totalXP: levelData.totalXP,
      rank: levelData.rank,
      currentXP: levelData.currentXP,
      requiredXP: levelData.requiredXP,
      progress: levelData.progress,
      streak: historyResult.rows[0]?.streak || 0,
      achievements,
      stats: {
        markers: parseInt(markersCount.rows[0]?.count || '0'),
        posts: parseInt(postsCount.rows[0]?.count || '0'),
        routes: parseInt(routesCount.rows[0]?.count || '0'),
        comments: parseInt(commentsCount.rows[0]?.count || '0'),
      },
      badges: [], // TODO: Фаза 4 — бейджи из таблицы user_badges
    });
  } catch (error) {
    logger.error('getUserProfile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};
