/**
 * Горизонтальный скролл достижений для Центра Влияния
 * Круглые иконки по категориям, незаработанные — размыты
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';
import { Achievement } from '../../types/gamification';

const RARITY_COLORS: Record<string, string> = {
  common: 'ring-gray-400/40',
  rare: 'ring-blue-500/50',
  epic: 'ring-purple-500/50',
  legendary: 'ring-yellow-500/50',
};

const RARITY_GLOW: Record<string, string> = {
  common: '',
  rare: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]',
  epic: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]',
  legendary: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
};

interface CentreAchievementsRowProps {
  /** Если передан — показываем чужие достижения */
  externalAchievements?: Achievement[];
}

const CentreAchievementsRow: React.FC<CentreAchievementsRowProps> = ({ externalAchievements }) => {
  const { achievements: ownAchievements } = useGamification();

  const achievements = externalAchievements || ownAchievements;
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  if (achievements.length === 0) {
    return (
      <div className="centre-glass-card">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h3 className="text-base font-bold cg-text">Достижения</h3>
        </div>
        <p className="text-sm font-medium cg-text-muted mt-2">Достижения пока недоступны</p>
      </div>
    );
  }

  // Группируем по категориям, заработанные сначала
  const sorted = [...achievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return 0;
  });

  return (
    <div className="centre-glass-card h-full flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h3 className="text-base font-bold cg-text">Достижения</h3>
          <span className="text-sm font-medium cg-text-muted">{unlockedCount}/{totalCount}</span>
        </div>
      </div>

      {/* Сетка достижений (wrap) */}
      <div
        className="flex flex-wrap gap-3 overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sorted.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  );
};

interface AchievementBadgeProps {
  achievement: Achievement;
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement }) => {
  const ringColor = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;
  const glow = achievement.unlocked ? (RARITY_GLOW[achievement.rarity] || '') : '';
  const isLegendary = achievement.rarity === 'legendary' && achievement.unlocked;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 group relative" title={achievement.title}>
      {/* Иконка */}
      <div
        className={`w-14 h-14 rounded-full ring-2 ${ringColor} flex items-center justify-center text-2xl
          ${achievement.unlocked ? glow : 'centre-achievement-locked'}
          ${isLegendary ? 'centre-rarity-legendary' : ''}
          transition-transform group-hover:scale-110`}
      >
        {achievement.unlocked ? (
          <span>{achievement.icon}</span>
        ) : (
          <Lock className="w-5 h-5 cg-text-muted" />
        )}
      </div>

      {/* Название */}
      <span className={`text-[10px] text-center max-w-[60px] leading-tight
        ${achievement.unlocked ? 'cg-text-dim' : 'cg-text-muted'}`}>
        {achievement.title}
      </span>

      {/* Тултип при ховере */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900/90 backdrop-blur-sm rounded-lg
        text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
        <div className="font-medium">{achievement.title}</div>
        <div className="text-white/70">{achievement.description}</div>
        {!achievement.unlocked && (
          <div className="text-white/50 mt-0.5">
            {achievement.progress.current}/{achievement.progress.target}
          </div>
        )}
      </div>
    </div>
  );
};

export default CentreAchievementsRow;
