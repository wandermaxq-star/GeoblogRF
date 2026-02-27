import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SideContentPanel from '../components/SideContentPanel';
import GuestIndicator from '../components/GuestIndicator';
import { useContentStore, ContentType } from '../stores/contentStore';
import PageLayer from '../pages/PageLayer';
import { usePreload } from '../hooks/usePreload';
import Topbar from '../components/Topbar';
import MapBackgroundExtension from '../components/MapBackgroundExtension';
// import AppRoutes from '../routes';

// Unused: const SOLO_ROUTES: string[] = [];

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();

  // Используем store для получения состояния панелей
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const navigate = useNavigate();
  const resetAllPanels = useContentStore((state) => state.resetAllPanels);
  const { preloadRoute } = usePreload();

  // Определяем страницы, которые НЕ участвуют в двухоконном режиме
  // Эти страницы должны сбрасывать панели и показывать children напрямую
  const soloPages = ['/centre', '/pro', '/partners', '/admin', '/test', '/legal'];
  const isSoloPage = soloPages.some(path => location.pathname.startsWith(path));
  // Centre использует собственный фон (градиентные орбы) вместо карты
  const isCentrePage = location.pathname.startsWith('/centre');

  // КРИТИЧНО: Предзагружаем компоненты карт при загрузке проекта
  useEffect(() => {
    // Предзагружаем карты в фоновом режиме для быстрой загрузки
    preloadRoute('/map');
    preloadRoute('/planner');
  }, [preloadRoute]);

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

  // КРИТИЧНО: Используем useRef для предотвращения двойных обновлений
  const lastPathnameRef = React.useRef<string>('');

  // КРИТИЧНО: Синхронизируем route с store ТОЛЬКО при ПЕРВИЧНОЙ загрузке страницы
  // или при прямом переходе по URL (не через Sidebar)
  // ВАЖНО: НЕ перезаписываем store если он уже установлен - Sidebar имеет приоритет
  useEffect(() => {
    // Если pathname не изменился - не обновляем
    if (lastPathnameRef.current === location.pathname) {
      return;
    }

    lastPathnameRef.current = location.pathname;

    if (isSoloPage) {
      const store = useContentStore.getState();
      if (isCentrePage) {
        // Centre: собственный фон, карта не нужна
        store.setLeftContent(null);
      } else {
        // Остальные solo-страницы: Leaflet-карта как фон
        if (store.leftContent !== 'map') {
          store.setLeftContent('map');
        }
      }
      store.setRightContent(null);
      // Скрываем контролы карты через body-класс
      document.body.classList.add('solo-page-active');
      return;
    } else {
      document.body.classList.remove('solo-page-active');
    }

    // Синхронизируем route с store - ТОЛЬКО на основе pathname
    const store = useContentStore.getState();

    // КРИТИЧНО: Если leftContent УЖЕ установлен (через Sidebar), НЕ перезаписываем!
    // Это предотвращает гонку между Sidebar.setLeftContent() и navigate()
    // Sidebar всегда имеет приоритет над URL-based синхронизацией

    // Если путь указывает на карту или планировщик - открываем соответствующую панель
    // КРИТИЧНО: НЕ трогаем rightContent! Sidebar уже установил нужное состояние.
    // Правая панель (posts/feed/friends) должна сохраняться при переключении карт.
    if (location.pathname === '/map') {
      store.setLeftContent('map');
      // НЕ сбрасываем rightContent — посты/activity остаются
    } else if (location.pathname === '/planner') {
      store.setLeftContent('planner');
      // НЕ сбрасываем rightContent — посты/activity остаются
    } else if (location.pathname === '/calendar') {
      // Календарь — универсальный контент: LEFT когда нет map/planner, RIGHT когда есть
      if (store.leftContent === 'map' || store.leftContent === 'planner') {
        store.setRightContent('calendar' as ContentType);
      } else {
        store.setLeftContent('calendar' as ContentType);
        if (!store.rightContent) store.setRightContent('posts');
      }
    } else if (location.pathname === '/' || location.pathname === '/posts') {
      // Главная страница или посты
      // КРИТИЧНО: Если карта/планировщик уже открыты (leftContent установлен),
      // НЕ сбрасываем их! Это значит Sidebar переключил правую панель.
      // Сбрасываем leftContent только при прямой навигации (leftContent ещё не установлен)
      if (!store.leftContent) {
        store.setLeftContent(null);
      }
      store.setRightContent('posts');
    } else if (location.pathname === '/activity') {
      // Если есть открытая левая панель (map/planner/other), показываем Activity в правой панели
      if (store.leftContent) {
        store.setRightContent('feed');
      } else {
        // Без левой панели показываем Activity полноэкранно
        store.setLeftContent(null);
        store.setRightContent('feed');
      }
    }
  }, [isSoloPage, location.pathname, resetAllPanels, navigate]);

  // КРИТИЧНО: MainLayout читает состояние ТОЛЬКО из store
  // НЕ используем pathname для определения контента - только store!
  // Управление состоянием происходит через Sidebar и store

  if (isSoloPage) {
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

        <div className="map-with-sidebar-container" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          overflow: 'visible'
        }}>
          {/* Статичный SVG-фон карты — fallback пока Leaflet загружается */}
          <MapBackgroundExtension />
          {/* Leaflet-карта как фоновый слой — идентично posts/activity */}
          <div
            className="h-full absolute top-0 left-0 left-panel-map solo-page-map-bg"
            style={{
              width: '100%',
              visibility: 'visible',
              zIndex: 1,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <PageLayer side="left" />
          </div>
          <Sidebar />
          {/* Glass-обёртка для soloPage контента */}
          <div className="activity-feed no-left-panel" style={{
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
          }}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'visible' }}>
              {children}
            </div>
          </div>
        </div>
        <SideContentPanel />
        <GuestIndicator />
      </div>
    );
  }

  // 🎨 НОВАЯ СТРУКТУРА: Карта с самого верха до низа, Topbar общий над всем
  return (
    <div className="app-root" style={{
      background: 'transparent', // Прозрачный фон - карта просвечивает
      minHeight: '100vh',
      overflow: 'visible',
      position: 'relative',
      width: '100%',
      height: '100vh'
    }}>
      {/* Topbar - общий над всем с высоким z-index */}
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

      {/* Основное пространство: карта с самого верха до низа, с самого лева */}
      <div
        className="map-with-sidebar-container"
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
        {/* Левая панель — fullscreen для карты/планировщика, content panel для календаря */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            leftContent === 'calendar'
              ? 'left-panel-content'
              : 'h-full absolute top-0 left-0 left-panel-map'
          }`}
          style={leftContent === 'calendar' ? {
            // Календарь: контентная панель — выровнена с постами
            // UNIFIED GLASS — единственный слой glass на этом wrapper
            position: 'fixed',
            top: 'calc(64px + 1cm)',
            bottom: '1cm',
            left: 'calc(56px + 1cm)',
            right: rightContent ? 'calc(50% + 0.5cm)' : '1cm',
            zIndex: 1145,
            overflow: 'hidden',
            pointerEvents: 'auto',
            // Единый glass стиль (идентично posts/activity dual-mode)
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px) saturate(160%)',
            WebkitBackdropFilter: 'blur(10px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            boxShadow: '0 14px 48px rgba(0,0,0,0.25)',
            visibility: 'visible',
          } : {
            // Карта/планировщик: fullscreen background
            width: leftContent ? '100%' : '0%',
            visibility: leftContent ? 'visible' : 'hidden',
            zIndex: (leftContent === 'map' || leftContent === 'planner') ? 1140 : 0,
            overflow: 'visible',
            pointerEvents: leftContent === 'map' ? 'none' : (leftContent ? 'auto' : 'none'),
          }}
        >
          <PageLayer side="left" />
        </div>

        {/* Стильная полоса-разделитель по центру - убрана, так как создает темную полосу */}

        {/* Сайдбар - всегда виден для навигации */}
        <Sidebar />

        {/* Правая панель (лента активности/посты)
            - Просто контейнер-обёртка, glassmorphism в CSS posts-mode
            - Если есть левая панель => справа
            - Если нет левой панели => по центру, CSS применит стили */}
        {rightContent && (
          <div
            className={`activity-feed h-full transition-all duration-300 ease-in-out ${leftContent ? 'has-left-panel' : 'no-left-panel'}`}
            style={leftContent ? {
              // Двухоконный режим:
              // - Справа: 1cm от края экрана (вертикальная полоса карты)
              // - Слева: от центра экрана (50%)
              // - Сверху/снизу: как в однооконном режиме
              position: 'fixed',
              right: '1cm',              // 1cm от правого края
              top: '64px',               // под topbar
              bottom: '60px',            // ~15mm от низа (как в однооконном)
              left: '50%',               // от центра экрана
              display: 'flex',
              justifyContent: 'flex-end',
              visibility: 'visible',
              zIndex: 1145,
              background: 'transparent',
              overflow: 'visible',
              pointerEvents: 'auto',
            } : {
              // Однооконный режим - прозрачный контейнер, CSS сделает остальное
              position: 'fixed',
              top: '64px',               // сразу под topbar
              bottom: '60px',            // ~15mm от низа экрана
              left: '56px',              // справа от sidebar
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
      </div>
      <SideContentPanel />
      <GuestIndicator />
    </div>
  );

  // КРИТИЧНО: НЕ принудительно открываем посты
  // LayoutContext уже имеет посты по умолчанию, Sidebar управляет состоянием

  // Все режимы обрабатываются единым контейнером выше
  // Это предотвращает перемонтирование компонентов
};

export default MainLayout;