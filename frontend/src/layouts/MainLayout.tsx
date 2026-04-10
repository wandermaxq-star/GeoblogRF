import React, { useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useThemeStore } from '../stores/themeStore';
import SideContentPanel from '../components/SideContentPanel';
import GuestIndicator from '../components/GuestIndicator';
import { useContentStore, ContentType } from '../stores/contentStore';
import PageLayer from '../pages/PageLayer';
import { usePreload } from '../hooks/usePreload';
import Topbar from '../components/Topbar';
import MapBackgroundExtension from '../components/MapBackgroundExtension';
import PersistentMapBackground from '../components/PersistentMapBackground';
import { usePackBuilderStore } from '../stores/packBuilderStore';
const RoutePackageBuilder = lazy(() => import('../components/Planner/RoutePackageBuilder'));
// import AppRoutes from '../routes';

// Unused: const SOLO_ROUTES: string[] = [];

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { isOpen: isPackBuilderOpen, routeData: packBuilderData, close: closePackBuilder } = usePackBuilderStore();

  // Используем store для получения состояния панелей
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  // Двухоконный режим: когда есть левая панель (map/planner) И правая панель (posts/feed/calendar/favorites)
  // posts ТОЖЕ участвует в dual mode когда есть map/planner слева
  const hasLeftPanel = leftContent === 'map' || leftContent === 'planner';
  const isDualPanelMode = hasLeftPanel && !!rightContent;
  const navigate = useNavigate();
  const resetAllPanels = useContentStore((state) => state.resetAllPanels);
  const { preloadRoute } = usePreload();
  const { theme } = useThemeStore();

  // Определяем страницы, которые НЕ участвуют в двухоконном режиме
  // Эти страницы должны сбрасывать панели и показывать children напрямую
  const soloPages = ['/centre', '/pro', '/hub', '/partners', '/partner', '/admin', '/legal', '/profile'];
  const isSoloPage = soloPages.some(path => location.pathname.startsWith(path));

  // Centre использует собственный фон (градиентные орбы) вместо карты
  const isCentrePage = location.pathname.startsWith('/centre');

  // Leaflet-фон показываем на ВСЕХ контентных страницах в одностраничном режиме
  // (posts, activity, calendar, favorites). Когда map/planner активен — они сами рисуют карту.
  // PersistentMapBackground всегда смонтирован и сам управляет visibility.
  const showMapBackground = !hasLeftPanel && !isCentrePage && !isSoloPage;

  // КРИТИЧНО: Предзагружаем компоненты карт при загрузке проекта
  useEffect(() => {
    // Предзагружаем карты в фоновом режиме для быстрой загрузки
    preloadRoute('/map');
    preloadRoute('/planner');
  }, [preloadRoute]);

  // Добавляем/удаляем класс map-mode на body для глобального контроля цвета
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (showMapBackground || hasLeftPanel) {
        document.body.classList.add('map-mode');
      } else {
        document.body.classList.remove('map-mode');
      }
    }
  }, [showMapBackground, hasLeftPanel]);

  // Устанавливаем CSS-переменную с высотой Topbar
  // Карта рендерится с top: 0 чтобы просвечивать за glass-топбаром
  useEffect(() => {
    const setTopVar = () => {
      try {
        const topbar = document.querySelector('.topbar-container');
        const h = topbar ? (topbar as HTMLElement).offsetHeight : 64;
        // Карта начинается с top: 0 (за топбаром) для glass-эффекта
        document.documentElement.style.setProperty('--facade-map-top', '0px');
        // Сохраняем высоту топбара для отступов контролов
        document.documentElement.style.setProperty('--topbar-height', `${h}px`);
      } catch (e) {
        // ignore
      }
    };
    setTopVar();
    window.addEventListener('resize', setTopVar);
    return () => window.removeEventListener('resize', setTopVar);
  }, []);

  // КРИТИЧНО: Синхронизируем route с store ТОЛЬКО при ПЕРВИЧНОЙ загрузке страницы
  // или при прямом переходе по URL (не через Sidebar)
  // ВАЖНО: НЕ перезаписываем store если он уже установлен - Sidebar имеет приоритет
  useEffect(() => {
    const store = useContentStore.getState();

    // Определяем, пришли ли мы с solo-страницы. store.lastRouteWasSolo сохраняет
    // это состояние между переходами, включая случаи, когда MainLayout перемонтируется.
    const cameFromSolo = store.lastRouteWasSolo;

    // Если сейчас на solo-странице — очищаем панели и помечаем это состояние.
    if (isSoloPage) {
      store.setLeftContent(null);
      store.setRightContent(null);
      document.body.classList.add('solo-page-active');
      store.setLastRouteWasSolo(true);
      return;
    }

    // Вне solo — снимаем метку solo и убираем класс
    document.body.classList.remove('solo-page-active');
    store.setLastRouteWasSolo(false);

    // Синхронизируем route с store - ТОЛЬКО на основе pathname
    // Ключевое: не перезаписываем store если он уже установлен через Sidebar.
    const hadLeftPanel = store.leftContent === 'map' || store.leftContent === 'planner';

    if (location.pathname === '/map') {
      store.setLeftContent('map');
      if (cameFromSolo) {
        store.setRightContent(null);
      }
    } else if (location.pathname === '/planner') {
      store.setLeftContent('planner');
      if (cameFromSolo) {
        store.setRightContent(null);
      }
    } else if (location.pathname === '/calendar') {
      // /calendar теперь редиректит на /map — оставляем совместимость
      store.setLeftContent('map');
      store.setRightContent('calendar');
    } else if (location.pathname === '/' || location.pathname === '/posts') {
      if (cameFromSolo) {
        store.setLeftContent(null);
      } else if (store.leftContent !== 'map' && store.leftContent !== 'planner') {
        store.setLeftContent(null);
      }
      store.setRightContent('posts');
    } else if (location.pathname === '/activity') {
      if (cameFromSolo) {
        store.setLeftContent(null);
      } else if (store.leftContent !== 'map' && store.leftContent !== 'planner') {
        store.setLeftContent(null);
      }
      store.setRightContent('feed');
    } else if (location.pathname === '/favorites') {
      if (cameFromSolo) {
        store.setLeftContent(null);
      } else if (store.leftContent !== 'map' && store.leftContent !== 'planner') {
        store.setLeftContent(null);
      }
      store.setRightContent('favorites');
    }
  }, [isSoloPage, location.pathname, resetAllPanels, navigate]);


  // КРИТИЧНО: MainLayout читает состояние ТОЛЬКО из store
  // НЕ используем pathname для определения контента - только store!
  // Управление состоянием происходит через Sidebar и store

  const soloOverlay = isSoloPage ? (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        left: '56px',
        right: 0,
        bottom: 0,
        zIndex: 1150,
        background: 'var(--bg-page)',
        overflow: 'auto',
        pointerEvents: 'auto',
      }}
    >
      {children}
    </div>
  ) : null;

  return (
    <div className="app-root" style={{
      background: 'transparent',
      minHeight: '100vh',
      overflow: 'visible',
      position: 'relative',
      width: '100%',
      height: '100vh'
    }}>
      {/* Topbar — общий над всем */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        height: '64px'
      }}>
        <Topbar />
      </div>

      <div
        className={`map-with-sidebar-container${hasLeftPanel || showMapBackground ? ' map-mode' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          overflow: 'visible'
        }}
      >
        {/* Статичный картографический SVG‑паттерн (fallback / decorative) */}
        <MapBackgroundExtension />
        {/* Leaflet-фон (тайлы OSM) — без контролов, без маркеров.
            Компонент создаёт <div> прямо в document.body и возвращает null из render.
            Всегда смонтирован — сам скрывается когда leftContent='map'|'planner'. */}
        <PersistentMapBackground />

        {/* Левая панель — fullscreen для карты/планировщика */}
        <div
          className="h-full absolute top-0 left-0 left-panel-map transition-all duration-300 ease-in-out"
          style={{
            width: hasLeftPanel ? '100%' : '0%',
            visibility: hasLeftPanel ? 'visible' : 'hidden',
            zIndex: hasLeftPanel ? 1140 : 0,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <PageLayer side="left" />
        </div>

        {/* Сайдбар - всегда виден для навигации */}
        <Sidebar />

        {/* Правая панель (лента активности/посты) */}
        {rightContent && (
          <div
            className={`activity-feed h-full transition-all duration-300 ease-in-out ${isDualPanelMode ? 'has-left-panel' : 'no-left-panel'}`}
            style={isDualPanelMode ? {
              position: 'fixed',
              right: '1cm',
              top: '64px',
              bottom: '60px',
              left: '50%',
              display: 'flex',
              justifyContent: 'flex-end',
              visibility: 'visible',
              zIndex: 1145,
              background: 'transparent',
              overflow: 'visible',
              pointerEvents: 'auto',
            } : {
              position: 'fixed',
              top: '64px',
              bottom: '60px',
              left: '56px',
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              pointerEvents: 'auto',
              overflow: 'visible',
              background: 'transparent',
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'visible',
            }}>
              <PageLayer side="right" />
            </div>
          </div>
        )}

        {soloOverlay}
      </div>
      <SideContentPanel />
      <GuestIndicator />

      {/* Route Pack Builder — глобальный overlay, независимый от planner.tsx */}
      {isPackBuilderOpen && packBuilderData && (
        <Suspense fallback={null}>
          <RoutePackageBuilder
            polyline={packBuilderData.polyline}
            distanceMeters={packBuilderData.distanceMeters}
            durationSeconds={packBuilderData.durationSeconds}
            initialWaypoints={packBuilderData.initialWaypoints}
            sourceMarkers={packBuilderData.sourceMarkers}
            onClose={closePackBuilder}
          />
        </Suspense>
      )}
    </div>
  );
}

export default MainLayout;

