import React, { Suspense, useMemo, startTransition } from 'react';
import {
  LazyMap,
  LazyPlanner,
  LazyActivity,
  LazyChat,
  // LazyBlog отключен - блоги не используются 
  LazyCalendar,
  LazyFriends,
  LazyTest
} from '../components/LazyComponents';
// КРИТИЧНО: Posts загружается СТАТИЧЕСКИ для немедленной загрузки при открытии проекта
// Это гарантирует, что посты загружаются сразу, без ожидания lazy loading
import Posts from './Posts';
import { FEATURES } from '../config/features';
import { useContentStore, ContentType } from '../stores/contentStore';

interface PageLayerProps {
  side: 'left' | 'right';
}

const PAGES = {
  map: LazyMap,
  planner: LazyPlanner,
  calendar: LazyCalendar,
  posts: Posts, // Posts загружается лениво
  ...(FEATURES.CHAT_ENABLED ? { chat: LazyChat } : {}),
  feed: LazyActivity,
  // blogs отключены - используем только posts
  friends: LazyFriends,
  test: LazyTest,
} as const;

const leftPages = ['map', 'planner', 'calendar'];
const rightPages = [
  ...(FEATURES.CHAT_ENABLED ? ['chat'] as const : []),
  'feed', 'posts', 'friends', 'test'
];

// КРИТИЧНО: Кэш для загруженных компонентов - предотвращает повторную загрузку
const loadedComponentsCache = new Map<string, React.ComponentType<any>>();

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

  // КРИТИЧНО: Монтируем ВСЕ компоненты для этой стороны, но показываем только активный
  // Это предотвращает перемонтирование и сохраняет состояние
  const allPagesForSide = useMemo(() => {
    return side === 'left' ? leftPages : rightPages;
  }, [side]);

  // Проверяем, что активная страница относится к нужной стороне
  const isValidPage = useMemo(() => {
    return effectiveActive && (
      (side === 'left' && leftPages.includes(effectiveActive)) ||
      (side === 'right' && rightPages.includes(effectiveActive))
    );
  }, [effectiveActive, side]);

  // КРИТИЧНО: Монтируем все компоненты для этой стороны, но показываем только активный
  // Это предотвращает перемонтирование и сохраняет состояние при переключении
  // ВАЖНО: Все компоненты монтируются сразу, чтобы lazy loading начал работать
  return (
    <div className="h-full w-full flex flex-col relative">
      {allPagesForSide.map((pageId) => {
        const PageComponent = PAGES[pageId as keyof typeof PAGES];
        if (!PageComponent) return null;

        const isActive = effectiveActive === pageId;

        return (
          <div
            key={`${side}-${pageId}`}
            style={{
              // Убрали класс absolute inset-0 - он создавал лишнюю рамку
              display: isActive ? 'block' : 'none',
              width: '100%',
              height: '100%',
              position: 'relative',
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            <div className={isInsetPanel ? 'panel-inset' : ''} style={isInsetPanel ? undefined : { width: '100%', height: '100%', pointerEvents: 'auto' }}>
              {/* КРИТИЧНО: Все компоненты оборачиваем в Suspense для избежания синхронных обновлений */}
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