/**
 * Утилиты для расчёта XP и уровней (Backend версия)
 */

// Формула: XP_требуемое = 100 * уровень^1.5
export function calculateRequiredXP(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Рассчитать уровень на основе общего XP
export function calculateLevelFromTotalXP(totalXP) {
  // Защита от некорректных входных данных
  if (!Number.isFinite(totalXP) || totalXP < 0) {
    totalXP = 0;
  }
  
  let level = 1;
  let accumulatedXP = 0;
  
  while (true) {
    const requiredXP = calculateRequiredXP(level);
    if (accumulatedXP + requiredXP > totalXP) {
      break;
    }
    accumulatedXP += requiredXP;
    level++;
    
    if (level > 1000) {
      // Дополнительная защита: если уровень превысил 1000, прерываем цикл
      // и устанавливаем accumulatedXP как totalXP, чтобы currentLevelXP был 0
      accumulatedXP = totalXP;
      break;
    }
  }
  
  const currentLevelXP = totalXP - accumulatedXP;
  const requiredXP = calculateRequiredXP(level);
  
  // Определяем ранг
  let rank = 'novice';
  if (level >= 50) rank = 'geoblogger';
  else if (level >= 31) rank = 'legend';
  else if (level >= 16) rank = 'traveler';
  else if (level >= 6) rank = 'explorer';
  
  return {
    level,
    currentLevelXP,
    requiredXP,
    rank,
  };
}

// Создать объект UserLevel из общего XP
export function createUserLevelFromTotalXP(totalXP) {
  const levelData = calculateLevelFromTotalXP(totalXP);
  const progress = levelData.requiredXP > 0 
    ? (levelData.currentLevelXP / levelData.requiredXP) * 100 
    : 100;
  
  return {
    level: levelData.level,
    currentXP: levelData.currentLevelXP,
    requiredXP: levelData.requiredXP,
    totalXP,
    rank: levelData.rank,
    progress: Math.min(100, Math.max(0, progress)),
  };
}

