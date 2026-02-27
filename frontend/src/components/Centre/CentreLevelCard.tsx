/**
 * Карточка уровня для Центра Влияния
 * Круговой SVG прогресс-бар с рангом, стриком, аватаром
 */

import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Flame, Zap, Sprout, Search, Compass, Crown, Star } from 'lucide-react';
import { useLevelProgress } from '../../hooks/useLevelProgress';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import { RankInfo } from '../../types/gamification';
import { getRankInfo } from '../../utils/xpCalculator';

const CentreLevelCard: React.FC = () => {
  const { userLevel, rankInfo: ownRankInfo, progressPercentage: ownProgress, loading } = useLevelProgress();
  const auth = useAuth();
  const { stats } = useGamification();

  const username = auth?.user?.username || auth?.user?.email?.split('@')[0] || 'Пользователь';
  const streak = stats?.dailyGoals?.streak ?? 0;
  const rankInfo: RankInfo | null = userLevel ? getRankInfo(userLevel.rank) : ownRankInfo;
  const progressPercentage = ownProgress;

  if (loading) {
    return (
      <div className="centre-glass-card animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!userLevel) return null;

  // React-иконка ранга вместо эмодзи
  const RANK_ICONS: Record<string, React.ReactNode> = {
    novice: <Sprout className="w-6 h-6 text-green-400" />,
    explorer: <Search className="w-6 h-6 text-yellow-400" />,
    traveler: <Compass className="w-6 h-6 text-blue-400" />,
    legend: <Star className="w-6 h-6 text-purple-400" />,
    geoblogger: <Crown className="w-6 h-6 text-amber-400" />,
  };
  const rankIcon = userLevel ? RANK_ICONS[userLevel.rank] : RANK_ICONS.novice;

  const level = userLevel.level;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  // Цвет кольца зависит от ранга
  const ringGradient = (() => {
    switch (userLevel.rank) {
      case 'novice': return { from: '#9ca3af', to: '#d1d5db' };
      case 'explorer': return { from: '#eab308', to: '#22c55e' };
      case 'traveler': return { from: '#22c55e', to: '#3b82f6' };
      case 'legend': return { from: '#3b82f6', to: '#8b5cf6' };
      case 'geoblogger': return { from: '#8b5cf6', to: '#ec4899' };
      default: return { from: '#6366f1', to: '#8b5cf6' };
    }
  })();

  const userInitials = username
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="centre-glass-card h-full">
      <div className="flex items-center gap-5">
        {/* Круговой прогресс-бар с аватаром внутри */}
        <div className="relative flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="centre-level-ring">
            <defs>
              <linearGradient id="levelRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={ringGradient.from} />
                <stop offset="100%" stopColor={ringGradient.to} />
              </linearGradient>
            </defs>
            {/* Фоновая дорожка */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="5"
            />
            {/* Прогресс */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="url(#levelRingGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          {/* Аватар по центру кольца */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'rotate(90deg)' }}>
            <Avatar className="w-16 h-16 border-2 border-white/30 shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          {/* Уровень — бейдж внизу-справа */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold border-2 border-white/30 shadow-lg"
               style={{ transform: 'rotate(90deg)' }}>
            {level}
          </div>
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold cg-text truncate">{username}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {rankIcon}
            <span className="text-base font-semibold cg-text-dim">{rankInfo?.name || 'Новичок'}</span>
          </div>
          {/* Линейный прогресс-бар */}
          <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--card-bg-subtle)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPercentage}%`,
                background: `linear-gradient(90deg, ${ringGradient.from}, ${ringGradient.to})`,
              }}
            />
          </div>
          {/* XP текст */}
          <div className="flex items-center gap-4 text-sm cg-text-dim">
            <span className="flex items-center gap-1 font-medium">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              {userLevel.totalXP.toLocaleString()} XP
            </span>
            <span className="cg-text-muted">
              {Math.round(progressPercentage)}% до L{level + 1}
            </span>
          </div>
          {/* Стрик */}
          {streak > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-600">{streak} {getDayWord(streak)} подряд</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last > 1 && last < 5) return 'дня';
  if (last === 1) return 'день';
  return 'дней';
}

export default CentreLevelCard;
