import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TopBar from '@/components/Mobile/TopBar';
import BottomNavigation from '@/components/Mobile/BottomNavigation';
import ActionButtons from '@/components/Mobile/ActionButtons';
import MobileFavoritesPanel from '@/components/Mobile/MobileFavoritesPanel';

// Маппинг путей к заголовкам
const getPageTitle = (pathname: string): string => {
  const titleMap: Record<string, string> = {
    '/': 'Посты',
    '/home': 'Посты',
    '/map': 'Карта',
    '/posts': 'Посты',
    '/planner': 'Планировщик',
    '/calendar': 'Календарь',
    '/activity': 'Активность',
    '/centre': 'Центр влияния',
    '/profile': 'Профиль',
  };
  
  return titleMap[pathname] || 'ГеоБлог';
};

// Страницы, на которых показываем ActionButtons
const PAGES_WITH_ACTIONS = ['/', '/home', '/posts', '/map', '/planner', '/calendar'];

const MobileLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getPageTitle(location.pathname);
  const showActions = PAGES_WITH_ACTIONS.includes(location.pathname);
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const handleSettingsClick = () => {
    const params = new URLSearchParams(location.search);
    params.set('settings', 'true');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  const handleFavoritesClick = () => {
    setFavoritesOpen(true);
  };

  const isMapPage = location.pathname === '/map' || location.pathname === '/planner';

  return (
    <div 
      className={`flex flex-col h-screen ${isMapPage ? '' : 'bg-background'}`} 
      style={{ 
        position: 'relative', 
        zIndex: 2,
        // На странице карты пропускаем клики к порталу карты (#global-map-root z-index:1)
        pointerEvents: isMapPage ? 'none' : undefined 
      }}
    >
      <TopBar 
        title={title} 
        showSearch={location.pathname === '/posts' || location.pathname === '/'}
        showSettings={isMapPage}
        showHelp={true}
        onSettingsClick={handleSettingsClick}
        onFavoritesClick={handleFavoritesClick}
      />
      
      <main className={`flex-1 overflow-hidden pb-bottom-nav relative ${isMapPage ? 'bg-transparent' : ''}`}>
        <Outlet />
        {/* Кнопки быстрого выбора поверх карты */}
        {showActions && (
          <div className="absolute top-0 left-0 right-0 z-40" style={{ pointerEvents: 'auto' }}>
            <ActionButtons onFavoritesClick={handleFavoritesClick} />
          </div>
        )}
      </main>
      
      <BottomNavigation />
      
      {/* Меню избранного - всегда доступно через кнопку */}
      <MobileFavoritesPanel 
        isOpen={favoritesOpen} 
        onClose={() => setFavoritesOpen(false)} 
      />
    </div>
  );
};

export default MobileLayout;

