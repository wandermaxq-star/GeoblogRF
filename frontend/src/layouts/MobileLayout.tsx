import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TopBar from '@/components/Mobile/TopBar';
import BottomNavigation from '@/components/Mobile/BottomNavigation';
import EventBottomSheet from '@/components/Events/EventBottomSheet';
// import ActionButtons from '@/components/Mobile/ActionButtons'; // deprecated, moved into TopBar
import MobileFavoritesPanel from '@/components/Mobile/MobileFavoritesPanel';
import { getMobileActions, MobileAction } from '@/utils/mobileActions';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useContentStore } from '@/stores/contentStore';
import { useEventsStore } from '@/stores/eventsStore';
import PersistentMapBackground from '@/components/PersistentMapBackground';

const LazyCreatePostModal = lazy(() => import('@/components/Posts/CreatePostModal'));

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
    '/partner': 'Партнёрская панель',
    '/partner/apply': 'Стать партнёром',
    '/partners': 'Партнёрская программа',
  };
  
  return titleMap[pathname] || 'ГеоБлог';
};

// (actions now rendered always via TopBar, conditional logic inside util)

const MobileLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getPageTitle(location.pathname);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const favorites = useFavorites();
  const eventsOpen = useEventsStore((s) => s.isEventSheetOpen);
  const openEventSheet = useEventsStore((s) => s.openEventSheet);
  const closeEventSheet = useEventsStore((s) => s.closeEventSheet);

  const setLeftContent = useContentStore((s) => s.setLeftContent);

  const handleSettingsClick = () => {
    const params = new URLSearchParams(location.search);
    params.set('settings', 'true');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  const handleFavoritesClick = () => {
    setFavoritesOpen(true);
  };

  const handleSearchClick = () => {
    if (location.pathname.startsWith('/posts')) {
      const params = new URLSearchParams(location.search);
      params.set('search', 'open');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  };

  const handleCreatePostClose = () => {
    setCreatePostOpen(false);
    const params = new URLSearchParams(location.search);
    params.delete('create');
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  };

  const handleCreatePostCreated = () => {
    setCreatePostOpen(false);
    navigate('/posts', { replace: true });
  };

  // На мобильной версии хотим видеть карту как фон **на всех ключевых страницах**,
  // но не нужно делать её интерактивной (т.е. не включать map-mode) для /posts, /activity, /calendar и т.п.
  const showMapBackground = ['/posts', '/', '/activity', '/favorites'].some((p) =>
    location.pathname.startsWith(p)
  );

  // /map использует Leaflet (leftContent='map'), /planner использует Yandex (leftContent='planner') — как на десктопе
  const isMapPage = location.pathname === '/map';
  const isPlannerPage = location.pathname === '/planner';
  const isMapOrPlannerPage = isMapPage || isPlannerPage;

  // Solo-страницы (не участвуют в map-mode, имеют собственный фон)
  const soloPages = ['/centre', '/pro', '/partners', '/partner', '/admin', '/legal', '/profile'];
  const isSoloPage = soloPages.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    if (isMapPage) {
      setLeftContent('map');
    } else if (isPlannerPage) {
      setLeftContent('planner');
    } else {
      const current = useContentStore.getState().leftContent;
      if (current === 'map' || current === 'planner') {
        setLeftContent(null);
      }
    }
  }, [isMapPage, isPlannerPage, setLeftContent]);

  // Синхронизируем body-классы для CSS: map-mode и solo-page-active
  useEffect(() => {
    if (showMapBackground || isMapOrPlannerPage) {
      document.body.classList.add('map-mode');
    } else {
      document.body.classList.remove('map-mode');
    }
    if (isSoloPage) {
      document.body.classList.add('solo-page-active');
    } else {
      document.body.classList.remove('solo-page-active');
    }
    return () => {
      document.body.classList.remove('map-mode');
      document.body.classList.remove('solo-page-active');
    };
  }, [showMapBackground, isMapOrPlannerPage, isSoloPage]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenCreate = params.get('create') === 'true';
    setCreatePostOpen(shouldOpenCreate);
  }, [location.pathname, location.search]);

  const actions: MobileAction[] = getMobileActions({
    pathname: location.pathname,
    navigate,
    favorites,
    onFavoritesClick: handleFavoritesClick,
  });

  const showTopBarSettings = false; // planner должен скрывать кнопку настройки в хедере
  const showTopBarHelp = false; // planner должен скрывать кнопку помощи
  const showTopBarNotifications = true;
  // Показываем реальную кнопку избранного во всех режимах
  const showTopBarFavorites = true;

  return (
    <div 
      className={`flex flex-col h-screen ${showMapBackground ? '' : 'bg-background'}`} 
      style={{ 
        position: 'relative', 
        // zIndex was 2 which put layout above map portal; remove it so
        // topbar/bottom nav (inside this div) stay above the map
      }}
    >
      {/* Фоновая карта в мобильной версии для страниц, где она должна быть видна */}
      {showMapBackground && !isMapPage && <PersistentMapBackground />}

      <TopBar 
        title={title} 
        showSearch={false} /* поиск временно скрыт для всех страниц */
        onSearchClick={handleSearchClick}
        showSettings={showTopBarSettings}
        showHelp={showTopBarHelp}
        showNotifications={showTopBarNotifications}
        showFavorites={showTopBarFavorites}
        onSettingsClick={handleSettingsClick}
        onFavoritesClick={handleFavoritesClick}
        onNotificationClick={() => console.log('Оповещения открыты')}
        actions={actions}
      />
      
      <main
        className={`flex-1 overflow-hidden pb-bottom-nav relative ${showMapBackground ? 'bg-transparent' : ''}`}
        // больше не блокируем события — карта теперь находится выше layout по z-index
        style={{ pointerEvents: 'auto' }}
      >
        <Outlet />
      </main>
      
      <BottomNavigation onEventsClick={() => openEventSheet()} />

      {/* Шторка событий на карте */}
      <EventBottomSheet isOpen={eventsOpen} onClose={closeEventSheet} />

      {/* Global overlay for create-post modal - separate from layout flow to ensure visibility */}
      {createPostOpen && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          <Suspense fallback={null}>
            <LazyCreatePostModal
              isOpen={true}
              inline={false}
              onClose={handleCreatePostClose}
              onPostCreated={handleCreatePostCreated}
            />
          </Suspense>
        </div>
      )}
      
      {/* Меню избранного - всегда доступно через кнопку */}
      <MobileFavoritesPanel 
        isOpen={favoritesOpen} 
        onClose={() => setFavoritesOpen(false)} 
      />
    </div>
  );
};

export default MobileLayout;

