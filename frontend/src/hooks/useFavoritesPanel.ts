import { useCallback } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useContentStore } from '../stores/contentStore';

export interface UseFavoritesPanelOptions {
  /**
   * Optional callback that will be invoked after the default toggle logic runs.
   * If you provide this, it will receive the same arguments that `markerToggle`
   * receives, but the built-in behaviour (updating selected ids / route planner)
   * will still be executed. Pass `undefined` if you want to completely override
   * the handler and manage everything yourself.
   */
  onMarkerToggle?: (place: any, checked: boolean) => void;
}

export function useFavoritesPanel(options: UseFavoritesPanelOptions = {}) {
  const favorites = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const setLeftContent = useContentStore((state) => state.setLeftContent);
  const setRightContent = useContentStore((state) => state.setRightContent);

  // derive helpers from context (provide harmless defaults when stubbed)
  // Используем memoizedFavorites (контекст экспортирует как favorites) — они уже маппят name → title
  const favoritePlaces: any[] = (favorites as any)?.favorites || (favorites as any)?.favoritePlaces || [];
  const favoriteRoutes: any[] = (favorites as any)?.favoriteRoutes || [];
  const favoriteEvents: any[] = (favorites as any)?.favoriteEvents || [];
  const favoritePosts: any[] = (favorites as any)?.favoritePosts || [];

  const selectedMarkerIds: string[] = (favorites as any)?.selectedMarkerIds || [];
  const setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>> =
    (favorites as any)?.setSelectedMarkerIds || (() => {});

  const selectedRouteIds: string[] = (favorites as any)?.selectedRouteIds || [];
  const setSelectedRouteIds: React.Dispatch<React.SetStateAction<string[]>> =
    (favorites as any)?.setSelectedRouteIds || (() => {});

  const selectedEventIds: string[] = (favorites as any)?.selectedEventIds || [];
  const setSelectedEventIds: React.Dispatch<React.SetStateAction<string[]>> =
    (favorites as any)?.setSelectedEventIds || (() => {});

  const getTotalCount = useCallback(() => {
    return (
      favoritePlaces.length +
      favoriteRoutes.length +
      favoriteEvents.length +
      favoritePosts.length
    );
  }, [favoritePlaces.length, favoriteRoutes.length, favoriteEvents.length, favoritePosts.length]);

  const handleItemClick = useCallback(
    (type: 'place' | 'route' | 'event' | 'post', id: string) => {
      const currentPath = location.pathname;
      switch (type) {
        case 'place': {
          if (currentPath === '/planner' || currentPath === '/map') {
            const params = new URLSearchParams(location.search);
            params.set('marker', id);
            navigate(`${currentPath}?${params.toString()}`);
          } else {
            navigate(`/map?marker=${id}`);
          }
          break;
        }
        case 'route': {
          if (currentPath === '/planner') {
            const params = new URLSearchParams(location.search);
            params.set('route', id);
            navigate(`${currentPath}?${params.toString()}`);
          } else {
            navigate(`/planner?route=${id}`);
          }
          break;
        }
        case 'event':
          setLeftContent('map');
          setRightContent('calendar');
          navigate('/map');
          break;
        case 'post':
          navigate(`/posts/${id}`);
          break;
      }
    },
    [location.pathname, location.search, navigate, setLeftContent, setRightContent]
  );

  const defaultMarkerToggle = useCallback(
    (place: any, checked: boolean) => {
      // Обновляем selectedMarkerIds в контексте
      // Синхронизация с route builder делается в PlannerPage/Planner.tsx
      setSelectedMarkerIds((prev) => {
        const set = new Set(prev || []);
        if (checked) set.add(place.id);
        else set.delete(place.id);
        return Array.from(set);
      });

      if (options.onMarkerToggle) {
        try {
          options.onMarkerToggle(place, checked);
        } catch (e) {
          console.warn('onMarkerToggle callback threw', e);
        }
      }
    },
    [setSelectedMarkerIds, options]
  );

  const markerToggle = options.onMarkerToggle ? defaultMarkerToggle : defaultMarkerToggle;
  // currently we always call defaultMarkerToggle and then optional callback; the parameter
  // exists for future full overrides if needed.

  const routeToggle = useCallback(
    (route: any, checked: boolean) => {
      setSelectedRouteIds((prev) => {
        const set = new Set(prev || []);
        if (checked) set.add(route.id);
        else set.delete(route.id);
        return Array.from(set);
      });
      if (checked && location.pathname === '/planner') {
        const params = new URLSearchParams(location.search);
        params.set('route', route.id);
        navigate(`${location.pathname}?${params.toString()}`);
      }
    },
    [location.pathname, location.search, navigate, setSelectedRouteIds]
  );

  const eventToggle = useCallback(
    (event: any, checked: boolean) => {
      setSelectedEventIds((prev) => {
        const set = new Set(prev || []);
        if (checked) set.add(String(event.id));
        else set.delete(String(event.id));
        return Array.from(set);
      });
    },
    [setSelectedEventIds]
  );

  return {
    favorites,
    favoritePlaces,
    favoriteRoutes,
    favoriteEvents,
    favoritePosts,
    selectedMarkerIds,
    setSelectedMarkerIds,
    selectedRouteIds,
    setSelectedRouteIds,
    selectedEventIds,
    setSelectedEventIds,
    getTotalCount,
    handleItemClick,
    markerToggle: defaultMarkerToggle,
    routeToggle,
    eventToggle,
  };
}
