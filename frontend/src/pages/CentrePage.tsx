/**
 * CentrePage — Центр Влияния
 * Desktop: glass-панель поверх SVG-фона карты (как posts/activity)
 * Mobile: m-glass-page + m-glass-card (отдельная страница)
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useEffect } from 'react';
import { useIsMobile } from '../hooks/use-mobile';
import { CentreLevelCard, CentreDailyGoals, CentreAchievementsRow, UserProfileCard } from '../components/Centre';
import { Trophy, Flame, Star } from 'lucide-react';

export default function CentrePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  if (!user) return (
    <MirrorGradientContainer className="centre-mode">
      <div className="centre-static-header">
        <h2>Центр Влияния</h2>
      </div>
      <div className="centre-scroll-area">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-3"></div>
            <p className="text-sm text-white/50">Загрузка...</p>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );

  if (isMobile) {
    return <CentrePageMobile selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />;
  }

  return <CentrePageDesktop selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />;
}

interface CentrePageInnerProps {
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
}

/**
 * Desktop: glass-панель в centre-mode (position: fixed, glassmorphism)
 */
function CentrePageDesktop({ selectedUserId, setSelectedUserId }: CentrePageInnerProps) {
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
          <p className="text-xs text-white/40">Прогресс · Соревнования · Мотивация</p>
        </div>
      </div>

      {/* Скролльный контент */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-4">
          {/* Карточка профиля другого пользователя (overlay) */}
          {selectedUserId && (
            <UserProfileCard
              userId={selectedUserId}
              onClose={() => setSelectedUserId(null)}
            />
          )}

          {/* 1. Карточка уровня */}
          <CentreLevelCard />

          {/* 2. Ежедневные задания */}
          <CentreDailyGoals />

          {/* 3. Достижения */}
          <CentreAchievementsRow />

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
function CentrePageMobile({ selectedUserId, setSelectedUserId }: CentrePageInnerProps) {
  return (
    <div className="h-full overflow-y-auto m-glass-page">
      <div className="p-4 space-y-3">
        {/* Карточка профиля другого пользователя */}
        {selectedUserId && (
          <UserProfileCard
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
          />
        )}

        {/* 1. Карточка уровня */}
        <CentreLevelCard />

        {/* 2. Ежедневные задания */}
        <CentreDailyGoals />

        {/* 3. Достижения */}
        <CentreAchievementsRow />

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