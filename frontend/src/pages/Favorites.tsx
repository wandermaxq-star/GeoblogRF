import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useFavorites } from '../contexts/FavoritesContext';
import { useRoutePlanner } from '../contexts/RoutePlannerContext';
import { useAuth } from '../contexts/AuthContext';
import { useContentStore } from '../stores/contentStore';
import { useThemeStore } from '../stores/themeStore';
import { MarkerData } from '../types/marker';
import { RouteData } from '../types/route';
import FavoritesPanel from '../components/FavoritesPanel';
import { getRoutes } from '../api/routes';
import '../styles/PageLayout.css';
import '../styles/MapBackground.css';

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const favoritesContext = useFavorites();
  const routePlannerContext = useRoutePlanner();
  const authContext = useAuth();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const { token } = authContext || { token: null };
  
  // Интеграция с глобальной системой тем: data-theme управляет вариантом стекла
  const { theme } = useThemeStore();
  const glassVariant = theme; // 'light' | 'dark' — мапится на CSS-классы glass-light / glass-dark

  // Проверяем, открыта ли карта слева
  const leftContent = useContentStore((state) => state.leftContent);
  const isMapOpen = leftContent === 'map' || leftContent === 'planner';
  
  // Регистрируем панель
  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  // Состояние для маршрутов
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  
  // КРИТИЧНО: Используем ГЛОБАЛЬНОЕ состояние selectedMarkerIds из FavoritesContext
  // Это обеспечивает синхронизацию чекбоксов с Map и Planner страницами
  const selectedMarkerIds = (favoritesContext as any)?.selectedMarkerIds || [];
  const setSelectedMarkerIds = (favoritesContext as any)?.setSelectedMarkerIds || (() => {});
  
  // КРИТИЧНО: Используем ГЛОБАЛЬНОЕ состояние selectedRouteIds из FavoritesContext
  // Это обеспечивает синхронизацию чекбоксов маршрутов с Map и Planner страницами
  const selectedRouteIds = (favoritesContext as any)?.selectedRouteIds || [];
  const setSelectedRouteIds = (favoritesContext as any)?.setSelectedRouteIds || (() => {});
  
  const [favoritesOpen, setFavoritesOpen] = useState(true);

  // Получаем метки из FavoritesContext
  const favorites: MarkerData[] = useMemo(() => {
    if (!favoritesContext) return [];
    return (favoritesContext as any).favorites || [];
  }, [favoritesContext]);

  // Загрузка маршрутов
  const loadRoutes = useCallback(async () => {
    // Если нет токена, используем локальные избранные маршруты (offline / гостевой режим)
    const localFavoriteRoutes = (favoritesContext as any)?.favoriteRoutes || [];

    if (!token) {
      setRoutes(localFavoriteRoutes);
      return;
    }

    setLoadingRoutes(true);
    try {
      const loadedRoutes = await getRoutes(token);
      if (!loadedRoutes || loadedRoutes.length === 0) {
        setRoutes(localFavoriteRoutes);
      } else {
        setRoutes(loadedRoutes);
      }
    } catch (error) {
      console.error('Ошибка загрузки маршрутов:', error);
      setRoutes(localFavoriteRoutes);
    } finally {
      setLoadingRoutes(false);
    }
  }, [token, favoritesContext]);

  // Загружаем маршруты при монтировании
  React.useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // Удаление метки из избранного
  const handleRemove = useCallback((id: string) => {
    try {
      (favoritesContext as any)?.removeFavoritePlace?.(id);
    } catch (error) {
      console.error('Ошибка при удалении метки:', error);
    }
  }, [favoritesContext]);

  // Построение маршрута из выбранных меток
  const handleBuildRoute = useCallback((ids: string[]) => {
    try {
      if (routePlannerContext) {
        (routePlannerContext as any).setPoints?.(ids.map(id => {
          const marker = favorites.find(f => f.id === id);
          return {
            id,
            latitude: marker?.latitude || 0,
            longitude: marker?.longitude || 0,
            title: marker?.title || '',
            description: marker?.description || ''
          };
        }));
      }
      navigate('/planner');
    } catch (error) {
      console.error('Ошибка при построении маршрута:', error);
    }
  }, [favorites, routePlannerContext, navigate]);

  // Перемещение меток в планировщик
  const handleMoveToPlanner = useCallback((ids: string[]) => {
    try {
      if (routePlannerContext) {
        const existingPoints = (routePlannerContext as any).points || [];
        const newPoints = ids.map(id => {
          const marker = favorites.find(f => f.id === id);
          return {
            id,
            latitude: marker?.latitude || 0,
            longitude: marker?.longitude || 0,
            title: marker?.title || '',
            description: marker?.description || ''
          };
        });
        (routePlannerContext as any).setPoints?.([...existingPoints, ...newPoints]);
      }
      navigate('/planner');
    } catch (error) {
      console.error('Ошибка при перемещении в планировщик:', error);
    }
  }, [favorites, routePlannerContext, navigate]);

  // Загрузка маршрута
  const handleLoadRoute = useCallback((route: RouteData, mode?: 'map' | 'planner') => {
    try {
      if (mode === 'planner' || !mode) {
        if (routePlannerContext) {
          (routePlannerContext as any).setPoints?.(route.points || []);
        }
        navigate('/planner');
      } else {
        navigate('/map');
      }
    } catch (error) {
      console.error('Ошибка при загрузке маршрута:', error);
    }
  }, [routePlannerContext, navigate]);

  // Переключение видимости маршрута
  // КРИТИЧНО: Обновляем глобальное состояние selectedRouteIds
  // При переходе на Map/Planner маршруты автоматически отобразятся
  const handleRouteToggle = useCallback((route: RouteData, checked: boolean, mode: 'map' | 'planner') => {
    const routeId = route.id;
    if (!routeId) return;

    // Обновляем глобальное состояние выбранных маршрутов
    setSelectedRouteIds((prev: string[]) => {
      if (checked) {
        return [...prev, routeId];
      } else {
        return prev.filter(id => id !== routeId);
      }
    });

    console.log('[Favorites] Route toggle:', routeId, checked, 'Global selectedRouteIds updated');
  }, [setSelectedRouteIds]);

  // Закрытие панели
  const handleClose = useCallback(() => {
    // Ничего не делаем - панель всегда открыта на странице избранного
  }, []);

  return (
    <MirrorGradientContainer className={`page-layout-container page-container favorites-mode glass-${glassVariant}`}>
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* L1: Статичный заголовок по центру (аналогично posts.tsx) */}
            <div className="favorites-static-header">
              <div className="favorites-title-row">
                <h1 className="favorites-main-title">Избранное</h1>
              </div>
            </div>

            {/* L2: Скролльная область с контентом */}
            <div className="favorites-scroll-area">
              <div className="favorites-content-centered">
                <FavoritesPanel
                  favorites={favorites}
                  routes={routes}
                  isVip={false}
                  onRemove={handleRemove}
                  onClose={handleClose}
                  onBuildRoute={handleBuildRoute}
                  onMoveToPlanner={handleMoveToPlanner}
                  onLoadRoute={handleLoadRoute}
                  onRouteToggle={handleRouteToggle}
                  mode="map"
                  initialTab="places"
                  isOpen={favoritesOpen}
                  constrainToMapArea={false}
                  showHeader={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );
};

export default FavoritesPage;