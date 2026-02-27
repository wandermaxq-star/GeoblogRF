/**
 * Достижения для Центра Влияния
 * Компактный превью + раскрывающийся полный AchievementsDashboard при клике
 */

import React, { useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Award, Map, Camera, PenLine, MessageCircle, Flame, Zap, Star, Crown, Trophy } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';
import { useAchievements } from '../../hooks/useAchievements';
import { Achievement } from '../../types/gamification';
import AchievementsDashboard from '../Achievements/AchievementsDashboard';

/** Маппинг эмодзи-строк из бэкенда в React-иконки */
const ICON_MAP: Record<string, React.ReactNode> = {
  '🗺️': <Map className="w-6 h-6" />,
  '📸': <Camera className="w-6 h-6" />,
  '✍️': <PenLine className="w-6 h-6" />,
  '💬': <MessageCircle className="w-6 h-6" />,
  '🔥': <Flame className="w-6 h-6" />,
  '⚡': <Zap className="w-6 h-6" />,
  '⭐': <Star className="w-6 h-6" />,
  '👑': <Crown className="w-6 h-6" />,
};

const getAchievementIcon = (iconStr: string): React.ReactNode => {
  return ICON_MAP[iconStr] || <Trophy className="w-6 h-6" />;
};

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
  /** Колбэк при смене состояния развёрнутости */
  onExpandChange?: (expanded: boolean) => void;
}

const CentreAchievementsRow: React.FC<CentreAchievementsRowProps> = ({ externalAchievements, onExpandChange }) => {
  const { achievements: ctxAchievements } = useGamification();
  const { achievements: hookAchievements } = useAchievements();
  const [expanded, setExpanded] = useState(false);

  // Приоритет: external → context (API) → hook (local)
  const achievements = externalAchievements || (ctxAchievements.length > 0 ? ctxAchievements : []);
  // useAchievements содержит полную систему с прогрессом — используем для дашборда
  const hasHookAchievements = hookAchievements.length > 0;

  const unlockedCount = achievements.length > 0
    ? achievements.filter(a => a.unlocked).length
    : hookAchievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length > 0 ? achievements.length : hookAchievements.length;

  // Для превью: покажем топ-6 достижений (заработанные первыми)
  const previewAchievements = achievements.length > 0
    ? [...achievements].sort((a, b) => {
        if (a.unlocked && !b.unlocked) return -1;
        if (!a.unlocked && b.unlocked) return 1;
        return 0;
      }).slice(0, 6)
    : [];

  if (achievements.length === 0 && !hasHookAchievements) {
    return (
      <div className="centre-glass-card">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold cg-text">Достижения</h3>
        </div>
        <p className="text-sm font-medium cg-text-muted mt-2">Достижения пока недоступны</p>
      </div>
    );
  }

  return (
    <div className="centre-glass-card h-full flex flex-col">
      {/* Заголовок — кликабельный */}
      <button
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          onExpandChange?.(next);
        }}
        className="flex items-center justify-between mb-3 w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold cg-text">Достижения</h3>
          <span className="text-sm font-medium cg-text-muted">{unlockedCount}/{totalCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium cg-text-muted group-hover:cg-text transition-colors">
            {expanded ? 'Свернуть' : 'Подробнее'}
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4 cg-text-muted group-hover:cg-text transition-colors" />
            : <ChevronDown className="w-4 h-4 cg-text-muted group-hover:cg-text transition-colors" />
          }
        </div>
      </button>

      {expanded ? (
        /* Полный AchievementsDashboard */
        <div className="flex-1 -mx-4 -mb-4 overflow-auto rounded-b-[inherit]"
             style={{ scrollbarWidth: 'thin' }}>
          <AchievementsDashboard isOwnProfile={true} />
        </div>
      ) : (
        /* Компактные бейджи */
        <div
          className="flex flex-wrap gap-3 overflow-y-auto flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {previewAchievements.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
          {achievements.length > 6 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-14 h-14 rounded-full ring-2 ring-white/20 flex items-center justify-center
                bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                <span className="text-sm font-bold cg-text-muted">+{achievements.length - 6}</span>
              </div>
              <span className="text-[10px] cg-text-muted">Ещё</span>
            </button>
          )}
        </div>
      )}
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
          <span className="text-current">{getAchievementIcon(achievement.icon)}</span>
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
