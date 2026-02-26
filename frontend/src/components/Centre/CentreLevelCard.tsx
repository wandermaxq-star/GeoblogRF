/**
 * Карточка уровня для Центра Влияния
 * Круговой SVG прогресс-бар с рангом, стриком, аватаром
 */

import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Flame, Zap } from 'lucide-react';
import { useLevelProgress } from '../../hooks/useLevelProgress';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import { UserLevel, RankInfo } from '../../types/gamification';
import { getRankInfo } from '../../utils/xpCalculator';

interface CentreLevelCardProps {
  /** Если передан — показываем чужой профиль */
  externalData?: {
    userLevel: UserLevel;
    username: string;
    streak?: number;
  };
}

const CentreLevelCard: React.FC<CentreLevelCardProps> = ({ externalData }) => {
  const { userLevel: ownLevel, rankInfo: ownRankInfo, progressPercentage: ownProgress, loading } = useLevelProgress();
  const auth = useAuth();
  const { stats } = useGamification();

  // Определяем данные — свои или чужие
  const userLevel = externalData?.userLevel || ownLevel;
  const username = externalData?.username || auth?.user?.username || auth?.user?.email?.split('@')[0] || 'Пользователь';
  const streak = externalData?.streak ?? stats?.dailyGoals?.streak ?? 0;
  const rankInfo: RankInfo | null = userLevel ? getRankInfo(userLevel.rank) : ownRankInfo;
  const progressPercentage = externalData ? userLevel?.progress ?? 0 : ownProgress;

  if (loading && !externalData) {
    return (
      <div className="centre-glass-card animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-200/20 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200/20 rounded w-1/3" />
            <div className="h-4 bg-gray-200/20 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!userLevel) return null;

  const level = userLevel.level;
  const radius = 36;
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
    <div className="centre-glass-card">
      <div className="flex items-center gap-4">
        {/* Круговой прогресс-бар с аватаром внутри */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="centre-level-ring">
            <defs>
              <linearGradient id="levelRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={ringGradient.from} />
                <stop offset="100%" stopColor={ringGradient.to} />
              </linearGradient>
            </defs>
            {/* Фоновая дорожка */}
            <circle
              cx="44" cy="44" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            {/* Прогресс */}
            <circle
              cx="44" cy="44" r={radius}
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
            <Avatar className="w-14 h-14 border-2 border-white/20">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          {/* Уровень — бейдж внизу-справа */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white/20 shadow-lg"
               style={{ transform: 'rotate(90deg)' }}>
            {level}
          </div>
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white truncate">{username}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{rankInfo?.emoji || '🌱'}</span>
            <span className="text-sm font-medium text-white/80">{rankInfo?.name || 'Новичок'}</span>
          </div>
          {/* XP текст */}
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              {userLevel.totalXP.toLocaleString()} XP
            </span>
            <span>
              {Math.round(progressPercentage)}% до L{level + 1}
            </span>
          </div>
          {/* Стрик */}
          {streak > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-300">{streak} {getDayWord(streak)} подряд</span>
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
