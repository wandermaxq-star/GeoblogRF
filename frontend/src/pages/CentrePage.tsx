/**
 * CentrePage — Центр Влияния
 * Desktop: glass-панель поверх SVG-фона карты (как posts/activity)
 * Mobile: m-glass-page + m-glass-card (отдельная страница)
 *
 * DEMO MODE: если пользователь не авторизован — показываем mock-данные
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useEffect } from 'react';
import { useIsMobile } from '../hooks/use-mobile';
import { CentreLevelCard, CentreDailyGoals, CentreAchievementsRow, UserProfileCard } from '../components/Centre';
import { Trophy, Flame, Star, Eye } from 'lucide-react';
import { UserLevel, DailyGoal, Achievement } from '../types/gamification';

/* ──────────────── DEMO MOCK DATA ──────────────── */

const DEMO_USER_LEVEL: UserLevel = {
  level: 12,
  currentXP: 680,
  requiredXP: 1200,
  totalXP: 4680,
  rank: 'explorer',
  progress: 57,
};

const DEMO_DAILY_GOALS: DailyGoal[] = [
  {
    id: 'demo_1',
    type: 'create_posts',
    title: 'Написать 2 поста',
    description: 'Опубликуй 2 публикации',
    target: 2,
    current: 1,
    completed: false,
    xpReward: 30,
    difficulty: 'easy',
    icon: '✍️',
  },
  {
    id: 'demo_2',
    type: 'create_markers',
    title: 'Добавить маркер на карту',
    description: 'Поставь 1 маркер',
    target: 1,
    current: 1,
    completed: true,
    xpReward: 25,
    difficulty: 'easy',
    icon: '📍',
  },
  {
    id: 'demo_3',
    type: 'add_photos',
    title: 'Загрузить 3 фото',
    description: 'Добавь фото к своим публикациям',
    target: 3,
    current: 0,
    completed: false,
    xpReward: 40,
    difficulty: 'medium',
    icon: '📸',
  },
];

const DEMO_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_post',
    title: 'Первый пост',
    description: 'Опубликуй свою первую запись',
    icon: '✍️',
    category: 'posts',
    rarity: 'common',
    progress: { current: 1, target: 1 },
    unlocked: true,
    unlockedAt: '2025-01-10T12:00:00Z',
    xpReward: 50,
  },
  {
    id: 'explorer_10',
    title: 'Картограф',
    description: 'Добавь 10 маркеров на карту',
    icon: '🗺️',
    category: 'places',
    rarity: 'rare',
    progress: { current: 10, target: 10 },
    unlocked: true,
    unlockedAt: '2025-02-15T14:30:00Z',
    xpReward: 100,
  },
  {
    id: 'streak_7',
    title: 'Неделя огня',
    description: '7 дней подряд выполняй задания',
    icon: '🔥',
    category: 'activity',
    rarity: 'rare',
    progress: { current: 7, target: 7 },
    unlocked: true,
    unlockedAt: '2025-03-01T18:00:00Z',
    xpReward: 150,
  },
  {
    id: 'quality_master',
    title: 'Мастер качества',
    description: 'Получи 5 оценок «Отлично»',
    icon: '⭐',
    category: 'quality',
    rarity: 'epic',
    progress: { current: 3, target: 5 },
    unlocked: false,
    xpReward: 200,
  },
  {
    id: 'legend_100',
    title: 'Легенда GeoBlog',
    description: 'Достигни 100 уровня',
    icon: '👑',
    category: 'special',
    rarity: 'legendary',
    progress: { current: 12, target: 100 },
    unlocked: false,
    xpReward: 1000,
  },
  {
    id: 'photo_50',
    title: 'Фотограф',
    description: 'Загрузи 50 фотографий',
    icon: '📸',
    category: 'posts',
    rarity: 'epic',
    progress: { current: 22, target: 50 },
    unlocked: false,
    xpReward: 250,
  },
];

/* ──────────────── COMPONENT ──────────────── */

export default function CentrePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const isDemo = !user;

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  if (isMobile) {
    return <CentrePageMobile selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} isDemo={isDemo} />;
  }

  return <CentrePageDesktop selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} isDemo={isDemo} />;
}

interface CentrePageInnerProps {
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  isDemo: boolean;
}

/**
 * Desktop: glass-панель в centre-mode (position: fixed, glassmorphism)
 */
function CentrePageDesktop({ selectedUserId, setSelectedUserId, isDemo }: CentrePageInnerProps) {
  return (
    <MirrorGradientContainer className="centre-mode">
      {/* Заголовок */}
      <div className="centre-static-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h2>Центр Влияния</h2>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && <DemoBadge />}
            <p className="text-xs text-white/40">Прогресс · Соревнования · Мотивация</p>
          </div>
        </div>
      </div>

      {/* Скролльный контент */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-4">
          {/* Карточка профиля другого пользователя (overlay) */}
          {selectedUserId && !isDemo && (
            <UserProfileCard
              userId={selectedUserId}
              onClose={() => setSelectedUserId(null)}
            />
          )}

          {/* 1. Карточка уровня */}
          <CentreLevelCard
            externalData={isDemo ? {
              userLevel: DEMO_USER_LEVEL,
              username: 'Демо Путешественник',
              streak: 5,
            } : undefined}
          />

          {/* 2. Ежедневные задания */}
          <CentreDailyGoals
            demoGoals={isDemo ? DEMO_DAILY_GOALS : undefined}
            demoStreak={isDemo ? 5 : undefined}
          />

          {/* 3. Достижения */}
          <CentreAchievementsRow
            externalAchievements={isDemo ? DEMO_ACHIEVEMENTS : undefined}
          />

          {/* 4–7: Заглушки для будущих секций (Фазы 2–4) */}
          <ComingSoonSection
            icon={<Trophy className="w-5 h-5 text-yellow-400" />}
            title="Лидерборд"
            description="Рейтинг лучших исследователей — скоро"
          />
          <ComingSoonSection
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            title="Сезонный конкурс"
            description="Сезонные соревнования — скоро"
          />
        </div>
      </div>
    </MirrorGradientContainer>
  );
}

/**
 * Mobile: glassmorphism в мобильном стиле
 * Рендерится внутри MobileLayout (TopBar + BottomNav уже есть)
 */
function CentrePageMobile({ selectedUserId, setSelectedUserId, isDemo }: CentrePageInnerProps) {
  return (
    <div className="h-full overflow-y-auto m-glass-page">
      <div className="p-4 space-y-3">
        {isDemo && (
          <div className="mb-2">
            <DemoBadge />
          </div>
        )}

        {/* Карточка профиля другого пользователя */}
        {selectedUserId && !isDemo && (
          <UserProfileCard
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
          />
        )}

        {/* 1. Карточка уровня */}
        <CentreLevelCard
          externalData={isDemo ? {
            userLevel: DEMO_USER_LEVEL,
            username: 'Демо Путешественник',
            streak: 5,
          } : undefined}
        />

        {/* 2. Ежедневные задания */}
        <CentreDailyGoals
          demoGoals={isDemo ? DEMO_DAILY_GOALS : undefined}
          demoStreak={isDemo ? 5 : undefined}
        />

        {/* 3. Достижения */}
        <CentreAchievementsRow
          externalAchievements={isDemo ? DEMO_ACHIEVEMENTS : undefined}
        />

        {/* Заглушки */}
        <div className="m-glass-card p-4 text-center">
          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm font-medium m-glass-text">Лидерборд</p>
          <p className="text-xs m-glass-text-muted mt-1">Скоро</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Бейдж «Demo» — показывается когда нет авторизации
 */
function DemoBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
      bg-gradient-to-r from-amber-500/20 to-orange-500/20
      border border-amber-500/30 backdrop-blur-sm">
      <Eye className="w-3 h-3 text-amber-400" />
      <span className="text-[11px] font-medium text-amber-300">Demo</span>
    </div>
  );
}

/**
 * Заглушка «Скоро» для будущих секций
 */
function ComingSoonSection({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="centre-glass-card flex items-center gap-3 opacity-60">
      {icon}
      <div>
        <p className="text-sm font-medium text-white/70">{title}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
    </div>
  );
}