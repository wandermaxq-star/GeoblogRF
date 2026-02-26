/**
 * Карточка профиля другого пользователя — glassmorphism
 * Открывается по клику на пользователя в лидерборде
 */

import React, { useState, useEffect } from 'react';
import { X, Zap, Flame, Trophy, MapPin, FileText, Navigation, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { UserLevel, Achievement } from '../../types/gamification';
import { getRankInfo } from '../../utils/xpCalculator';
import apiClient from '../../api/apiClient';
import CentreAchievementsRow from './CentreAchievementsRow';

interface UserPublicProfile {
  userId: string;
  username: string;
  level: number;
  totalXP: number;
  rank: string;
  currentXP: number;
  requiredXP: number;
  progress: number;
  streak: number;
  achievements: Achievement[];
  stats: {
    markers: number;
    posts: number;
    routes: number;
    comments: number;
  };
  badges: Array<{
    title: string;
    icon: string;
    type: string;
    earnedAt: string;
  }>;
}

interface UserProfileCardProps {
  userId: string;
  onClose: () => void;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ userId, onClose }) => {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/gamification/user/${userId}/profile`);
        if (!cancelled) {
          setProfile(response.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError('Не удалось загрузить профиль');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [userId]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (loading) {
    return (
      <div className="centre-user-profile-card animate-pulse">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="centre-user-profile-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/50">{error || 'Профиль не найден'}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const rankInfo = getRankInfo(profile.rank as any);
  const userInitials = profile.username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // Круговой прогресс
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (profile.progress / 100) * circumference;

  const ringColor = (() => {
    switch (profile.rank) {
      case 'novice': return '#9ca3af';
      case 'explorer': return '#22c55e';
      case 'traveler': return '#3b82f6';
      case 'legend': return '#8b5cf6';
      case 'geoblogger': return '#ec4899';
      default: return '#6366f1';
    }
  })();

  // Создаём UserLevel для AchievementsRow
  const userLevel: UserLevel = {
    level: profile.level,
    currentXP: profile.currentXP,
    requiredXP: profile.requiredXP,
    totalXP: profile.totalXP,
    rank: profile.rank as any,
    progress: profile.progress,
  };

  return (
    <div className="centre-user-profile-card">
      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors z-10"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>

      {/* Шапка профиля */}
      <div className="flex items-center gap-4 mb-4">
        {/* Мини-кольцо прогресса */}
        <div className="relative flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="34" cy="34" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="34" cy="34" r={radius}
              fill="none" stroke={ringColor} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar className="w-11 h-11 border-2 border-white/20">
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold border-2 border-black/20">
            {profile.level}
          </div>
        </div>

        {/* Имя + ранг */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{profile.username}</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{rankInfo.emoji}</span>
            <span className="text-sm text-white/70">{rankInfo.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              {profile.totalXP.toLocaleString()} XP
            </span>
            {profile.streak > 0 && (
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                {profile.streak}д
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatItem icon={<MapPin className="w-4 h-4 text-blue-400" />} value={profile.stats.markers} label="Маркеры" />
        <StatItem icon={<FileText className="w-4 h-4 text-green-400" />} value={profile.stats.posts} label="Посты" />
        <StatItem icon={<Navigation className="w-4 h-4 text-purple-400" />} value={profile.stats.routes} label="Маршруты" />
        <StatItem icon={<MessageSquare className="w-4 h-4 text-orange-400" />} value={profile.stats.comments} label="Коммент." />
      </div>

      {/* Достижения */}
      <CentreAchievementsRow externalAchievements={profile.achievements} />

      {/* Бейджи / Рейтинговые моменты */}
      {profile.badges.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Рейтинговые достижения</h4>
          <div className="space-y-1.5">
            {profile.badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-lg">{badge.icon}</span>
                <span className="text-sm text-white/80">{badge.title}</span>
                <span className="text-xs text-white/30 ml-auto">
                  {new Date(badge.earnedAt).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label }) => (
  <div className="flex flex-col items-center gap-1 py-2 rounded-lg bg-white/5">
    {icon}
    <span className="text-sm font-bold text-white">{value}</span>
    <span className="text-[10px] text-white/40">{label}</span>
  </div>
);

export default UserProfileCard;
