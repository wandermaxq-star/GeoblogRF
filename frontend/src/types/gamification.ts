/**
 * Типы для системы геймификации
 * Исключены маршруты для предотвращения накруток
 */

// Источники XP (включая все типы контента, включая GPS)
export type XPSource =
  | 'post_created'
  | 'post_with_photo'
  | 'post_with_marker'
  | 'marker_created'
  | 'marker_with_photo'
  | 'marker_with_description'
  | 'event_created'
  | 'event_with_photo'
  | 'route_created'
  | 'route_with_waypoints'
  | 'blog_created'
  | 'blog_with_photos'
  | 'comment_created'
  | 'chat_created'
  | 'quality_high'
  | 'quality_perfect'
  | 'content_approved'
  | 'daily_goal_completed'
  | 'daily_goals_all'
  | 'achievement_unlocked'
  | 'streak_bonus'
  | 'gps_track_recorded'
  | 'gps_track_long'
  | 'gps_track_exported';

// Параметры для добавления XP
export interface XPParams {
  userId: string;
  source: XPSource;
  amount: number;
  contentId?: string; // ID контента для проверки уникальности
  contentType?: 'post' | 'marker' | 'event' | 'route' | 'comment' | 'chat';
  metadata?: {
    hasPhoto?: boolean;
    hasMarker?: boolean;
    completeness?: number; // 0-100
    rating?: number; // 0-5
    quality?: 'low' | 'medium' | 'high' | 'perfect';
    // GPS-specific
    distance?: number; // meters
    isTracked?: boolean;
    format?: 'gpx' | 'kml' | 'geojson';
  };
}

// Результат добавления XP
export interface XPResult {
  success: boolean;
  reason?: 'not_moderated' | 'duplicate' | 'limit_exceeded' | 'invalid' | 'cooldown';
  newLevel?: number;
  levelUp?: boolean;
  totalXP?: number;
  currentLevelXP?: number;
  requiredXP?: number;
}

// Уровень пользователя
export interface UserLevel {
  level: number;
  currentXP: number; // XP в текущем уровне
  requiredXP: number; // Требуемый XP для следующего уровня
  totalXP: number; // Всего XP за всё время
  rank: UserRank;
  progress: number; // 0-100%
}

// Ранг пользователя
export type UserRank = 'novice' | 'explorer' | 'traveler' | 'legend' | 'geoblogger';

// Информация о ранге
export interface RankInfo {
  name: string;
  emoji: string;
  description: string;
  privileges: string[];
  levelRange: [number, number];
}

// Ежедневная цель
export interface DailyGoal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  target: number; // Целевое значение
  current: number; // Текущий прогресс
  completed: boolean;
  xpReward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  icon: string;
}

// Тип цели (БЕЗ маршрутов)
export type GoalType = 
  | 'create_posts'
  | 'create_markers'
  | 'add_photos'
  | 'improve_quality'
  | 'get_approval';

// История целей
export interface DailyGoalHistory {
  date: string; // YYYY-MM-DD
  goals: DailyGoal[];
  allCompleted: boolean;
  streak: number;
  rewardClaimed: boolean;
}

// Достижение (обновлено - БЕЗ маршрутов)
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'places' | 'posts' | 'quality' | 'activity' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: { current: number; target: number };
  unlocked: boolean;
  unlockedAt?: string; // ISO date
  xpReward: number;
  isDynamic?: boolean;
  isLastSignificant?: boolean;
}

// Статистика геймификации
export interface GamificationStats {
  userLevel: UserLevel;
  achievements: {
    total: number;
    unlocked: number;
    byRarity: Record<string, number>;
  };
  dailyGoals: {
    current: DailyGoal[];
    streak: number;
    todayProgress: number; // 0-100%
  };
  recentXP: Array<{
    source: XPSource;
    amount: number;
    timestamp: string;
  }>;
}

// Конфигурация источника XP
export interface XPSourceConfig {
  id: XPSource;
  name: string;
  description: string;
  baseAmount: number;
  category: 'content' | 'quality' | 'activity' | 'achievement';
  requiresModeration?: boolean; // Требует одобрения модератором
  cooldown?: number; // Кулердаун в секундах
  dailyLimit?: number; // Максимум раз в день
}

