/**
 * Feature Flags для поэтапного раскрытия геймификации
 * 
 * Этапы:
 * 1. Старт (0-50 пользователей) - базовые функции
 * 2. Рост (50-200) - ежедневные цели, качество
 * 3. Развитие (200-500) - рейтинги, события
 * 4. Зрелость (500+) - все функции
 */

export interface GamificationFeatures {
  // Базовые функции (всегда включены)
  basicLevels: boolean;
  basicXP: boolean;
  basicAchievements: boolean;
  
  // Этап 2 (50+ пользователей)
  dailyGoals: boolean;
  qualityAchievements: boolean;
  streak: boolean;
  
  // Этап 3 (200+ пользователей)
  leaderboards: boolean;
  specialEvents: boolean;
  
  // Этап 4 (500+ пользователей)
  advancedBoosts: boolean;
}

/**
 * Определить этап на основе количества пользователей
 */
export function getGamificationStage(userCount: number): number {
  if (userCount < 50) return 1;
  if (userCount < 200) return 2;
  if (userCount < 500) return 3;
  return 4;
}

/**
 * Получить активные функции для этапа
 */
export function getActiveFeatures(stage: number): GamificationFeatures {
  return {
    // Базовые (всегда включены)
    basicLevels: true,
    basicXP: true,
    basicAchievements: true,
    
    // Базовые функции Центра Влияния — включены всегда
    dailyGoals: true,
    qualityAchievements: stage >= 2,
    streak: true,
    
    // Этап 3
    leaderboards: stage >= 3,
    specialEvents: stage >= 3,
    
    // Этап 4
    advancedBoosts: stage >= 4,
  };
}

/**
 * Получить активные функции (с проверкой на бэкенде)
 * По умолчанию используем этап 1 (базовые функции)
 */
export async function getActiveFeaturesFromAPI(): Promise<GamificationFeatures> {
  try {
    const response = await fetch('/api/gamification/features');
    if (response.ok) {
      const data = await response.json();
      return data.features || getActiveFeatures(1);
    }
  } catch (error) {
    console.warn('Failed to fetch features from API, using defaults:', error);
  }
  
  // По умолчанию - этап 1 (базовые функции)
  return getActiveFeatures(1);
}

/**
 * Проверить, доступна ли функция
 */
export function isFeatureEnabled(features: GamificationFeatures, feature: keyof GamificationFeatures): boolean {
  return features[feature] === true;
}

