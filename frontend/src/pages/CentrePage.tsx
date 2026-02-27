/**
 * CentrePage — Центр Влияния
 * Desktop: glass-панель поверх анимированного gradient-фона (orbs)
 * Mobile: m-glass-page + m-glass-card (отдельная страница)
 *
 * Все данные загружаются из GamificationContext (реальный бэкенд).
 * Для гостей — CTA с приглашением войти.
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useEffect } from 'react';
import { useIsMobile } from '../hooks/use-mobile';
import { CentreLevelCard, CentreDailyGoals, CentreAchievementsRow, UserProfileCard } from '../components/Centre';
import CentreBackground from '../components/Centre/CentreBackground';
import { Trophy, Flame, Star, LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ──────────────── COMPONENT ──────────────── */

export default function CentrePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const isGuest = !user;

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  if (isMobile) {
    return (
      <>
        <CentreBackground />
        <CentrePageMobile selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} isGuest={isGuest} />
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <CentrePageDesktop selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} isGuest={isGuest} />
    </>
  );
}

interface CentrePageInnerProps {
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  isGuest: boolean;
}

/**
 * Desktop: glass-панель в centre-mode (position: fixed, glassmorphism)
 */
function CentrePageDesktop({ selectedUserId, setSelectedUserId, isGuest }: CentrePageInnerProps) {
  const [achievementsExpanded, setAchievementsExpanded] = useState(false);

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
          <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>Прогресс · Соревнования · Мотивация</p>
        </div>
      </div>

      {/* Скролльный контент */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-5">
          {isGuest ? (
            <GuestCTA />
          ) : (
            <>
              {/* Карточка профиля другого пользователя (overlay) */}
              {selectedUserId && (
                <UserProfileCard
                  userId={selectedUserId}
                  onClose={() => setSelectedUserId(null)}
                />
              )}

              {/* Верхний ряд: Профиль + Достижения */}
              {achievementsExpanded ? (
                <>
                  <CentreLevelCard />
                  <CentreAchievementsRow onExpandChange={setAchievementsExpanded} />
                </>
              ) : (
                <div className="grid grid-cols-5 gap-5">
                  <div className="col-span-3">
                    <CentreLevelCard />
                  </div>
                  <div className="col-span-2">
                    <CentreAchievementsRow onExpandChange={setAchievementsExpanded} />
                  </div>
                </div>
              )}

              {/* Ежедневные задания — на всю ширину */}
              <CentreDailyGoals />

              {/* Заглушки в два столбца */}
              <div className="grid grid-cols-2 gap-5">
                <ComingSoonSection
                  icon={<Trophy className="w-5 h-5 text-yellow-500" />}
                  title="Лидерборд"
                  description="Рейтинг лучших исследователей — скоро"
                />
                <ComingSoonSection
                  icon={<Flame className="w-5 h-5 text-orange-500" />}
                  title="Сезонный конкурс"
                  description="Сезонные соревнования — скоро"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </MirrorGradientContainer>
  );
}

/**
 * Mobile: glassmorphism в мобильном стиле
 * Рендерится внутри MobileLayout (TopBar + BottomNav уже есть)
 */
function CentrePageMobile({ selectedUserId, setSelectedUserId, isGuest }: CentrePageInnerProps) {
  return (
    <div className="h-full overflow-y-auto centre-mobile-page">
      <div className="p-4 space-y-3">
        {isGuest ? (
          <GuestCTA />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

/**
 * CTA для неавторизованных пользователей
 */
function GuestCTA() {
  const navigate = useNavigate();

  return (
    <div className="centre-glass-card text-center py-8 px-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 flex items-center justify-center border border-white/10">
        <Sparkles className="w-8 h-8 text-purple-300" />
      </div>
      <h3 className="text-xl font-bold cg-text mb-2">Центр Влияния</h3>
      <p className="text-sm cg-text-muted mb-1">
        Уровни, достижения, ежедневные задания и рейтинги.
      </p>
      <p className="text-sm cg-text-muted mb-5">
        Войди, чтобы отслеживать свой прогресс исследователя.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.7), rgba(139, 92, 246, 0.7))',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
        }}
      >
        <LogIn className="w-4 h-4" />
        Войти
      </button>
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
    <div className="centre-glass-card flex items-center gap-3 opacity-70 hover:opacity-90 transition-opacity">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
           style={{ background: 'var(--card-bg-subtle)' }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold cg-text">{title}</p>
        <p className="text-xs font-medium cg-text-muted">{description}</p>
      </div>
    </div>
  );
}