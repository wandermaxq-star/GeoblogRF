import React, { Suspense, useMemo, useEffect, startTransition, lazy } from 'react';
import {
  LazyMap,
  LazyPlanner,
  LazyActivity,
  LazyChat,
  // LazyBlog отключен - блоги не используются 
  LazyFriends,
  LazyTest,
  LazyFavorites
} from '../components/LazyComponents';
// КРИТИЧНО: Posts загружается СТАТИЧЕСКИ для немедленной загрузки при открытии проекта
// Это гарантирует, что посты загружаются сразу, без ожидания lazy loading
import Posts from './Posts';
import { FEATURES } from '../config/features';
import { useContentStore, ContentType } from '../stores/contentStore';

// Новая панель событий — заменяет отдельную страницу /calendar в двухоконном режиме
const LazyEventPanel = lazy(() => import('../components/Events/EventPanel'));

interface PageLayerProps {
  side: 'left' | 'right';
}

const PAGES = {
  map: LazyMap,
  planner: LazyPlanner,
  posts: Posts, // Posts загружается лениво
  ...(FEATURES.CHAT_ENABLED ? { chat: LazyChat } : {}),
  feed: LazyActivity,
  // blogs отключены - используем только posts
  friends: LazyFriends,
  test: LazyTest,
  favorites: LazyFavorites,
} as const;

const leftPages = ['map', 'planner'];
const rightPages = [
  ...(FEATURES.CHAT_ENABLED ? ['chat'] as const : []),
  'feed', 'posts', 'friends', 'test', 'favorites', 'calendar'
];

// КРИТИЧНО: Кэш для загруженных компонентов - предотвращает повторную загрузку
const loadedComponentsCache = new Map<string, React.ComponentType<any>>();

class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state = { error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[PageLayer] Error loading page component:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center" style={{ background: 'transparent' }}>
          <div className="text-center text-red-500">
            <div>Ошибка загрузки страницы:</div>
            <div className="text-sm">{(this.state.error as Error | undefined)?.message || 'Unknown error'}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageLayer: React.FC<PageLayerProps> = ({ side }) => {
  // КРИТИЧНО: Используем ТОЛЬКО store, не props и не route!
  // Store является единственным источником истины для отображения контента
  const storeLeftContent = useContentStore((state) => state.leftContent);
  const storeRightContent = useContentStore((state) => state.rightContent);

  // ВАЖНО: Используем ТОЛЬКО store, НЕ используем route fallback
  // Это гарантирует, что store является единственным источником истины
  // Route fallback может вызывать конфликты при навигации (например, показывать map вместо planner)
  const effectiveActive = side === 'left' ? storeLeftContent : storeRightContent;

  // КРИТИЧНО: isInsetPanel должен быть реактивным - подписываемся на leftContent через селектор
  // Раньше использовали getState() который не обновлялся при изменении store
  const isInsetPanel = side === 'right' && storeLeftContent !== null;

  // -----------------------------
  // Монтирование страниц: кэшируем ТОЛЬКО map/planner на левой стороне
  // -----------------------------
  // Карта и планировщик имеют тяжёлый Leaflet-инстанс — их нельзя размонтировать
  // (потеря состояния, повторная инициализация тайлов/маршрутов).
  // Все правые панели (posts/activity/favorites/friends) НЕ кэшируются —
  // они размонтируются при переключении, не оставляя невидимых DOM-узлов.
  const [mountedPages, setMountedPages] = React.useState<Set<ContentType>>(new Set());

  React.useEffect(() => {
    if (!effectiveActive) return;
    // Кэшируем только map/planner слева — они Leaflet-heavy и должны оставаться смонтированными
    const isPersistentPage = side === 'left' && (effectiveActive === 'map' || effectiveActive === 'planner');
    if (isPersistentPage) {
      setMountedPages(prev => {
        if (prev.has(effectiveActive)) return prev;
        const next = new Set(prev);
        next.add(effectiveActive);
        return next;
      });
    }
  }, [effectiveActive, side]);

  const pagesToRender = React.useMemo(() => {
    const set = new Set(mountedPages);
    if (effectiveActive) set.add(effectiveActive);
    return Array.from(set);
  }, [mountedPages, effectiveActive]);

  // Проверяем, что активная страница относится к нужной стороне
  const isValidPage = useMemo(() => {
    return effectiveActive && (
      (side === 'left' && leftPages.includes(effectiveActive)) ||
      (side === 'right' && rightPages.includes(effectiveActive))
    );
  }, [effectiveActive, side]);

  // далее идёт return
  return (
    <div className="h-full w-full flex flex-col relative">
      {pagesToRender.map((pageId) => {
        const PageComponent = PAGES[pageId as keyof typeof PAGES];

          // Если в правой панели открыт "calendar" — рендерим EventPanel вместо старой страницы
          if (pageId === 'calendar' && side === 'right') {
            const isActive = effectiveActive === pageId;
            return (
              <div
                key={`component-${side}-${pageId}`}
                style={{
                  display: isActive ? 'flex' : 'none',
                  width: '100%',
                  height: '100%',
                }}
              >
                <Suspense fallback={<div className="p-4 text-center text-sm">Загрузка...</div>}>
                  <LazyEventPanel
                    onClose={() => useContentStore.getState().closeRightPanel()}
                  />
                </Suspense>
              </div>
            );
          }

        if (!PageComponent) return null;

        const isActive = effectiveActive === pageId;

        // Тяжёлые картографические страницы слева должны оставаться смонтированными,
        // иначе при возврате получаем повторную инициализацию и потерю живого состояния.
        const isMapLikeOnLeft = side === 'left' && (pageId === 'map' || pageId === 'planner');

        // КРИТИЧНО: Карта рендерит через Portal на body, но её контейнер #map
        // должен быть "видимым" в DOM, иначе Leaflet не инициализируется
        // (checkVisibility проверяет offsetWidth/Height). Используем
        // visibility: hidden + position: absolute + size: 1px вместо display: none.
        const shouldKeepMounted = isMapLikeOnLeft && !isActive;

        return (
          <div
            key={`${side}-${pageId}`}
            style={shouldKeepMounted ? {
              // Карта скрыта визуально, но DOM остаётся для Portal-рендера
              visibility: 'hidden',
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              pointerEvents: 'none',
            } : {
              display: isActive ? 'block' : 'none',
              width: '100%',
              height: '100%',
              position: 'relative',
              pointerEvents: isMapLikeOnLeft ? 'none' : (isActive ? 'auto' : 'none'),
            }}
          >
            <div style={{ width: '100%', height: '100%', pointerEvents: isMapLikeOnLeft ? 'none' : 'auto' }}>
              {/* КРИТИЧНО: Все компоненты оборачиваем в Suspense для избежания синхронных обновлений */}
              <PageErrorBoundary>
                <Suspense
                  key={`suspense-${side}-${pageId}`}
                  fallback={
                    <div className="h-full w-full flex items-center justify-center" style={{ background: 'transparent' }}>
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <div className="text-gray-600 text-lg">Загрузка {pageId}...</div>
                      </div>
                    </div>
                  }
                >
                  <div key={`component-${side}-${pageId}`} style={{ width: '100%', height: '100%' }}>
                    <PageComponent compact={isInsetPanel} />
                  </div>
                </Suspense>
              </PageErrorBoundary>
            </div>
          </div>
        );
      })}

      {/* Показываем сообщение, если нет активной страницы */}
      {!isValidPage && side === 'left' && (
        <div className="h-full w-full flex items-center justify-center" style={{ background: 'transparent', pointerEvents: 'none' }}>
          <div className="text-gray-500">
            Левая панель неактивна
          </div>
        </div>
      )}
    </div>
  );
};

export default PageLayer;