import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { FaFilter, FaCog, FaTimes, FaBell, FaHeart, FaComment } from 'react-icons/fa';
import { ActivityFilters as ActivityFiltersType } from '../services/activityService';
import '../styles/PageLayout.css';
import '../styles/MapBackground.css';

// Ленивая загрузка тяжелых компонентов
const LazyActivityFiltersPanel = lazy(() => import('../components/activity').then(module => ({ default: module.ActivityFiltersPanel })));
const LazySimpleActivityFeed = lazy(() => import('../components/activity/SimpleActivityFeedComponent'));

// Импортируем хук сразу (хуки нельзя делать ленивыми)
import { useActivityStats } from '../hooks/useActivityStats';
import { useContentStore } from '../stores/contentStore';

// Стабильный заголовок с красивыми блоками
const ActivityHeader = React.memo(() => {
  return (
    <div className="map-content-header">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <FaBell className="w-5 h-5 text-slate-400" />
          <h1 className="text-lg font-semibold activity-title">Лента активности</h1>        </div>        {/* Статус активности - стабилизирован */}
        <div className="activity-header-status">
          <span className="text-lg">⚡</span>
          <span className="text-sm font-medium activity-status-text">Активный участник</span>
        </div>
      </div>
      
      {/* Вдохновляющее сообщение - стабилизировано */}
      <div className="text-sm italic text-center mt-2 activity-subtitle">
        "Будьте в курсе всех событий сообщества"
      </div>
    </div>
  );
});

// Красивые динамические блоки статистики
const ActivityStatsBlocks = React.memo(() => {
  const { stats, loading } = useActivityStats();
  
  if (loading) {
    return (
      <div className="stat-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)' }}>
            <div className="stat-skeleton"></div>
            <div className="stat-skeleton sm"></div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="stat-grid">
      {/* Общая активность */}
      <div className="stat-card blue">
        <div>
          <div className="text-2xl font-bold">{stats?.total_activities || 0}</div>
          <div className="text-blue-100 text-sm">Всего событий</div>
        </div>
        <FaBell className="text-2xl text-blue-200" />
      </div>
      
      {/* Непрочитанные */}
      <div className="stat-card orange">
        <div>
          <div className="text-2xl font-bold">{stats?.unread_activities || 0}</div>
          <div className="text-orange-100 text-sm">Непрочитанных</div>
        </div>
        <FaComment className="text-2xl text-orange-200" />
      </div>
      
      {/* Сообщения */}
      <div className="stat-card green">
        <div>
          <div className="text-2xl font-bold">{stats?.message_activities || 0}</div>
          <div className="text-green-100 text-sm">Сообщений</div>
        </div>
        <FaComment className="text-2xl text-green-200" />
      </div>
      
      {/* Системные уведомления */}
      <div className="stat-card purple">
        <div>
          <div className="text-2xl font-bold">{stats?.system_activities || 0}</div>
          <div className="text-purple-100 text-sm">Системных</div>
        </div>
        <FaHeart className="text-2xl text-purple-200" />
      </div>
    </div>
  );
});

type ActivityProps = { compact?: boolean };

const Activity: React.FC<ActivityProps> = ({ compact = false }) => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [filters, setFilters] = useState<ActivityFiltersType>({
    limit: 20,
    offset: 0
  });

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  // Проверяем, открыта ли карта слева
  const leftContent = useContentStore((state) => state.leftContent);
  const isMapOpen = leftContent === 'map' || leftContent === 'planner';
  
  return (
    <div 
      className={`page-layout-container activity-map-background ${isMapOpen ? 'map-extension-mode' : ''}`} 
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* Кнопки управления по бокам - с рамками и позиционированием */}
            <div className="page-side-buttons left activity-side-buttons">
              <button
                className="page-side-button left"
                onClick={() => setLeftPanelOpen(true)}
                title="Фильтры активности"
              >
                <FaFilter className="text-gray-600" size={20} />
              </button>
            </div>
            <div className="page-side-buttons right activity-side-buttons">
              <button
                className="page-side-button right"
                onClick={() => setRightPanelOpen(true)}
                title="Настройки уведомлений"
              >
                <FaCog className="text-gray-600" size={20} />
              </button>
            </div>

            {/* Основной контент */}
            <div className="h-full relative">
              <div className="map-content-container">
                {/* Заголовок контента - СТАБИЛИЗИРОВАН */}
                <ActivityHeader />

                {/* Область контента */}
                <div className="map-area">
                  <div className={`full-height-content p-6 ${compact ? 'compact-mode' : ''}`}>
                    {/* Красивые динамические блоки статистики (скрываем в compact режиме) */}
                    {!compact && <ActivityStatsBlocks />}

                    {/* Лента активности */}
                    <div className={`activity-feed-wrapper ${compact ? 'activity-compact' : ''}`}>
                      <Suspense fallback={<div className="text-center p-8">Загрузка ленты активности...</div>}>
                        <LazySimpleActivityFeed filters={filters} compact={compact} />
                      </Suspense>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Левая выдвигающаяся панель с фильтрами */}
            <div className={`page-slide-panel left dark-glass ${leftPanelOpen ? 'open' : ''}`}>
              <div className="page-slide-panel-content">
                <Suspense fallback={<div className="text-center p-4">Загрузка фильтров...</div>}>
                  <LazyActivityFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClose={() => setLeftPanelOpen(false)}
                  />
                </Suspense>
              </div>
            </div>

            {/* Правая выдвигающаяся панель с настройками */}
            <div className={`page-slide-panel right dark-glass ${rightPanelOpen ? 'open' : ''}`}>
              <div className="page-slide-panel-header right">
                <h2 className="text-xl font-semibold">Настройки</h2>
                <button
                  className="page-slide-panel-close"
                  onClick={() => setRightPanelOpen(false)}
                >
                  <FaTimes size={20} />
                </button>
              </div>
              <div className="page-slide-panel-content">
                <div className="p-4">
                  <p className="text-gray-500">Здесь будут настройки уведомлений</p>
                </div>
              </div>
            </div>

            {/* Затемнение при открытых панелях */}
            <div className={`page-overlay ${(leftPanelOpen || rightPanelOpen) ? 'active' : ''}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activity;