import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface SwipeNavigationOptions {
  /** Отключить свайп-навигацию (например, когда открыта карта) */
  disabled?: boolean;
  /** Порог горизонтального свайпа (px) */
  threshold?: number;
  /** Порог вертикального свайпа для pull-to-refresh (px) */
  verticalThreshold?: number;
  /** Порог свайпа вниз для закрытия модалки/sheet (px) */
  dismissThreshold?: number;
  /** Колбэк pull-to-refresh (вызывается только на странице постов) */
  onPullToRefresh?: () => void;
  /** Колбэк закрытия модалки / bottom-sheet по свайпу вниз */
  onSwipeDismiss?: () => void;
  /** Список секций для навигации */
  sections?: string[];
}

const DEFAULT_SECTIONS = ['/posts', '/map', '/planner', '/calendar', '/activity'];

/**
 * Хук свайп-навигации между разделами.
 *
 * - Swipe влево/вправо — переключение между секциями
 * - Swipe вниз (150px) — закрытие модалки/sheet (onSwipeDismiss)
 * - Pull-to-refresh на странице постов (80px)
 * - Отключается при открытой клавиатуре
 */
export function useSwipeNavigation({
  disabled = false,
  threshold = 100,
  verticalThreshold = 80,
  dismissThreshold = 150,
  onPullToRefresh,
  onSwipeDismiss,
  sections = DEFAULT_SECTIONS,
}: SwipeNavigationOptions = {}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const deltaY = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const touchActive = useRef(false);
  /** Pull-to-refresh visual state */
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Простая эвристика: если высота viewport значительно меньше
   * полной высоты, вероятно открыта клавиатура.
   */
  const isKeyboardOpen = useCallback((): boolean => {
    if (!window.visualViewport) return false;
    return window.visualViewport.height < window.innerHeight * 0.75;
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isKeyboardOpen()) return;
      // Не перехватываем свайпы внутри карты (Leaflet, MapGL и пр.)
      const target = e.target as HTMLElement;
      if (target.closest('.leaflet-container, .mapboxgl-map, .maplibregl-map, [data-no-swipe]')) {
        return;
      }

      touchActive.current = true;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      deltaX.current = 0;
      deltaY.current = 0;
    },
    [disabled, isKeyboardOpen]
  );

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!touchActive.current) return;
    deltaX.current = e.touches[0].clientX - startX.current;
    deltaY.current = e.touches[0].clientY - startY.current;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchActive.current) return;
    touchActive.current = false;

    const absX = Math.abs(deltaX.current);
    const absY = Math.abs(deltaY.current);

    // Pull-to-refresh: свайп вниз, минимальный горизонтальный сдвиг, только /posts
    if (
      deltaY.current > verticalThreshold &&
      absX < 50 &&
      onPullToRefresh &&
      location.pathname === '/posts'
    ) {
      try {
        navigator.vibrate?.(50);
      } catch {
        // vibrate не поддерживается
      }
      setRefreshing(true);
      onPullToRefresh();
      // Сбрасываем индикатор через 1.5с (вызывающий может сбросить раньше через setRefreshing)
      setTimeout(() => setRefreshing(false), 1500);
      return;
    }

    // Swipe-down для закрытия модалки / sheet / боковой панели (150px)
    if (
      deltaY.current > dismissThreshold &&
      absX < 50 &&
      onSwipeDismiss
    ) {
      try {
        navigator.vibrate?.(30);
      } catch {
        // vibrate не поддерживается
      }
      onSwipeDismiss();
      return;
    }

    // Горизонтальная навигация (анимация через CSS transition — 300ms)
    if (absX > threshold && absY < 80) {
      const idx = sections.indexOf(location.pathname);
      if (idx === -1) return;

      if (deltaX.current < 0 && idx < sections.length - 1) {
        navigate(sections[idx + 1]);
      } else if (deltaX.current > 0 && idx > 0) {
        navigate(sections[idx - 1]);
      }
    }
  }, [threshold, verticalThreshold, dismissThreshold, onPullToRefresh, onSwipeDismiss, location.pathname, navigate, sections]);

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { refreshing, setRefreshing };
}
