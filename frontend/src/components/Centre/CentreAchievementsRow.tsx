/**
 * Достижения для Центра Влияния
 * Компактный превью + раскрывающийся полный AchievementsDashboard при клике
 */

import React, { useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Award, Trophy } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';
import { useAchievements } from '../../hooks/useAchievements';
import { Achievement } from '../../types/gamification';
import AchievementsDashboard from '../Achievements/AchievementsDashboard';

// shared icon resolver, keeps preview & dashboard in sync
import { getAchievementIcon } from '../Achievements/achievementIcons';



const RARITY_GLOW: Record<string, string> = {
  common: '',
  rare: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]',
  epic: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]',
  legendary: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
};

// text color for unlocked icons
const RARITY_TEXT: Record<string, string> = {
  common: 'text-gray-300',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
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

  // Приоритет: external → hook (local) → context (API)
  // чтобы превью и развёрнутый дашборд всегда брал одну и ту же коллекцию.
  const achievements = externalAchievements || (hookAchievements.length > 0 ? hookAchievements : ctxAchievements);
  const hasHookAchievements = hookAchievements.length > 0; // по прежнему нужен для условия сообщения

  const unlockedCount = achievements.length > 0
    ? achievements.filter(a => a.unlocked).length
    : hookAchievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length > 0 ? achievements.length : hookAchievements.length;

  // Для превью: используем массив, который затем передаётся в компонент
  // дашборда (hookAchievements), чтобы иконки/порядок совпадали.
  const sourceAchievements = achievements.length > 0 ? achievements : hookAchievements;
  // показываем до 12 элементов, последние идут вторая строка
  // отсортировать: сначала разблокированные, потом заблокированные
  const sorted = [...sourceAchievements].sort((a, b) => {
    if (a.unlocked === b.unlocked) return 0;
    return a.unlocked ? -1 : 1;
  });
  const previewAchievements = sorted.slice(0, 12);

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
          className="grid grid-cols-6 justify-items-center gap-2 overflow-y-auto flex-1 pt-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', overflowX: 'visible', paddingRight: '8px' }}
        >
          {previewAchievements.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} compact />
          ))}
        </div>
      )}
    </div>
  );
};

interface AchievementBadgeProps {
  achievement: Achievement;
  compact?: boolean; // скрывать текст под значком (для превью)
}

// helper replicates styles from AchievementsDashboard.AchievementCard
function computePreviewStyles(a: Achievement) {
  if (a.unlocked) {
    switch (a.rarity) {
      case 'common':
        return { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', color: '#FFD700' };
      case 'rare':
        return { bg: 'linear-gradient(135deg, #C0C0C0, #A8A8A8)', color: '#FFD700' };
      case 'epic':
        return { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#FFD700' };
      case 'legendary':
        return { bg: 'linear-gradient(135deg, #9932CC, #8B008B)', color: '#FFD700' };
      default:
        return { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#FFD700' };
    }
  }
  if (a.progress.current && a.progress.current > 0) {
    return { bg: 'linear-gradient(135deg, #9CA3AF, #6B7280)', color: '#6B7280' };
  }
  return { bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', color: '#9CA3AF' };
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement, compact = false }) => {
  const glow = achievement.unlocked ? (RARITY_GLOW[achievement.rarity] || '') : '';
  const isLegendary = achievement.rarity === 'legendary' && achievement.unlocked;
  const { bg, color } = computePreviewStyles(achievement);

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 group relative" title={achievement.title}>
      {/* Иконка */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
          ${achievement.unlocked ? glow : 'centre-achievement-locked'}
          ${isLegendary ? 'centre-rarity-legendary' : ''}
          transition-transform group-hover:scale-110`}
        style={{ background: bg, color }}
      >
        {achievement.unlocked ? (
          getAchievementIcon(achievement.icon)
        ) : (
          <Lock className="w-4 h-4 cg-text-muted" />
        )}
      </div>

      {/* Название */}
      {!compact && (
        <span className={`text-[10px] text-center max-w-[60px] leading-tight
          ${achievement.unlocked ? 'cg-text-dim' : 'cg-text-muted'}`}>
          {achievement.title.split(' ')[0] /* показать только первое слово */}
        </span>
      )}

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
