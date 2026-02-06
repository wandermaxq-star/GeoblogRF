import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SideContentPanel from '../components/SideContentPanel';
import GuestIndicator from '../components/GuestIndicator';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore } from '../stores/contentStore';
import PageLayer from '../pages/PageLayer';
import { usePreload } from '../hooks/usePreload';
import Topbar from '../components/Topbar';
import MapBackgroundExtension from '../components/MapBackgroundExtension';
// import AppRoutes from '../routes';

const SOLO_ROUTES: string[] = []; // Страницы которые открываются на полный экран (блог обрабатывается отдельно)

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const layoutContext = useLayoutState();

  // Используем store для получения состояния панелей
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const navigate = useNavigate();
  const isMobile = useContentStore((state) => state.isMobile);
  const resetAllPanels = useContentStore((state) => state.resetAllPanels);
  const openRightPanel = useContentStore((state) => state.openRightPanel);
  const { preloadRoute } = usePreload();

  // Определяем страницы, которые НЕ участвуют в двухоконном режиме
  // Эти страницы должны сбрасывать панели и показывать children напрямую
  const soloPages = ['/centre', '/pro', '/partners', '/admin', '/test', '/legal'];
  const isSoloPage = soloPages.some(path => location.pathname.startsWith(path));

  // КРИТИЧНО: Предзагружаем компоненты карт при загрузке проекта
  useEffect(() => {
    // Предзагружаем карты в фоновом режиме для быстрой загрузки
    preloadRoute('/map');
    preloadRoute('/planner');
  }, [preloadRoute]);

  // Устанавливаем CSS-переменную с высотой Topbar для корректного расчёта высоты карты
  useEffect(() => {
    const setTopVar = () => {
      try {
        const topbar = document.querySelector('.topbar-container');
        const h = topbar ? (topbar as HTMLElement).offsetHeight : 64;
        document.documentElement.style.setProperty('--facade-map-top', `${h}px`);
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
      resetAllPanels();
      return;
    }

    // Синхронизируем route с store - ТОЛЬКО на основе pathname
    const store = useContentStore.getState();

    // КРИТИЧНО: Если leftContent УЖЕ установлен (через Sidebar), НЕ перезаписываем!
    // Это предотвращает гонку между Sidebar.setLeftContent() и navigate()
    // Sidebar всегда имеет приоритет над URL-based синхронизацией
    const leftContentAlreadySet = store.leftContent !== null;

    // Если путь указывает на карту или планировщик - открываем соответствующую панель
    // НО НЕ трогаем если уже установлено через Sidebar
    if (location.pathname === '/map') {
      // Синхронизируем ТОЛЬКО если leftContent null или уже 'map'
      if (!leftContentAlreadySet) {
        store.setLeftContent('map');
      }
    } else if (location.pathname === '/planner') {
      // Синхронизируем ТОЛЬКО если leftContent null
      if (!leftContentAlreadySet) {
        store.setLeftContent('planner');
      }
    } else if (location.pathname === '/calendar') {
      if (!leftContentAlreadySet) {
        store.setLeftContent('calendar');
      }
    } else if (location.pathname === '/' || location.pathname === '/posts') {
      // Главная страница или посты - открываем только посты (без карты)
      // Но только если явно перешли на / или /posts
      store.setLeftContent(null);
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
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          {children}
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
        {/* Левая панель (карта/планировщик/календарь) - с самого верха до низа, с самого лева */}
        {/* Карта и планировщик должны быть ПОД сайдбаром для эффекта стеклянного прозрачного сайдбара с морфизмом */}
        <div
          className="h-full absolute top-0 left-0 transition-all duration-300 ease-in-out left-panel-map"
          style={{
            // Карта всегда занимает весь экран когда активна
            width: leftContent ? '100%' : '0%',
            visibility: leftContent ? 'visible' : 'hidden',
            // Когда левая панель активна (map или planner), ставим её ПОД сайдбаром для эффекта стекла
            // Сайдбар имеет zIndex = 1150, карта должна быть ниже для морфизма
            zIndex: leftContent === 'map' || leftContent === 'planner' ? 1140 : (leftContent ? 1160 : 0),
            overflow: 'visible',
            // В map-mode карта рендерится через portal на body — этот контейнер
            // должен пропускать клики (pointer-events: none), чтобы Leaflet получал события.
            // Для planner и прочего контент рендерится внутри, поэтому auto.
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