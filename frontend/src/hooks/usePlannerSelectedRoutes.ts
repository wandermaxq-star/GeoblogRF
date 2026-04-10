import { useEffect, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import type { PlannerRoute, PlannerMarker } from '../types/planner';

export interface UsePlannerSelectedRoutesOptions {
  isMapReady: boolean;
  selectedRouteIds: string[];
  setSelectedRouteIds: Dispatch<SetStateAction<string[]>>;
  facadeRoutes: PlannerRoute[];
  setFacadeRoutes: Dispatch<SetStateAction<PlannerRoute[]>>;
  facadeMarkers: PlannerMarker[];
  setFacadeMarkers: Dispatch<SetStateAction<PlannerMarker[]>>;
  renderedRouteIdsRef: React.MutableRefObject<Set<string>>;
}

export const usePlannerSelectedRoutes = ({
  isMapReady,
  selectedRouteIds,
  setSelectedRouteIds,
  facadeRoutes,
  setFacadeRoutes,
  facadeMarkers,
  setFacadeMarkers,
  renderedRouteIdsRef,
}: UsePlannerSelectedRoutesOptions) => {
  const favorites = useFavorites();
  const prevSelectedRouteIdsRef = useRef<string[]>([]);

  // Извлекает координаты маршрута из различных форматов
  const extractRoutePoints = useCallback((route: any): [number, number][] => {
    try {
      let pts: any[] = [];
      if (Array.isArray(route?.points) && route.points.length > 0) {
        pts = route.points;
      } else if (route?.route_data) {
        const rdRaw: any = route.route_data;
        const rd = typeof rdRaw === 'string' ? (JSON.parse(rdRaw) || {}) : (rdRaw || {});
        if (Array.isArray(rd.points)) pts = rd.points;
      }

      if ((!Array.isArray(pts) || pts.length === 0) && Array.isArray(route?.waypoints) && route.waypoints.length > 0) {
        const markersById = new Map(((favorites as any)?.favoritePlaces || []).map((m: any) => [m.id, m]));
        pts = route.waypoints
          .map((wp: any) => markersById.get(wp.marker_id))
          .filter(Boolean)
          .map((m: any) => ({ latitude: m.latitude ?? m.coordinates?.[0], longitude: m.longitude ?? m.coordinates?.[1] }));
      }

      const result: [number, number][] = (pts || [])
        .map((p: any) => {
          if (Array.isArray(p) && p.length >= 2) {
            return [Number(p[0]), Number(p[1])] as [number, number];
          }
          const a = Number(p?.latitude ?? p?.lat);
          const b = Number(p?.longitude ?? p?.lon ?? p?.lng);
          if (Number.isFinite(a) && Number.isFinite(b)) return [a, b] as [number, number];
          return null;
        })
        .filter(Boolean) as [number, number][];
      return result;
    } catch {
      return [];
    }
  }, [favorites]);

  // Извлекает полные данные точек маршрута для создания маркеров
  const extractRoutePointsFull = useCallback((route: any): Array<{ id: string; lat: number; lon: number; title: string }> => {
    try {
      let pts: any[] = [];
      if (Array.isArray(route?.points) && route.points.length > 0) {
        pts = route.points;
      } else if (route?.route_data) {
        const rdRaw: any = route.route_data;
        const rd = typeof rdRaw === 'string' ? (JSON.parse(rdRaw) || {}) : (rdRaw || {});
        if (Array.isArray(rd.points)) pts = rd.points;
      }
      if ((!Array.isArray(pts) || pts.length === 0) && Array.isArray(route?.waypoints) && route.waypoints.length > 0) {
        const markersById = new Map(((favorites as any)?.favoritePlaces || []).map((m: any) => [m.id, m]));
        pts = route.waypoints
          .map((wp: any) => markersById.get(wp.marker_id))
          .filter(Boolean);
      }
      return (pts || [])
        .map((p: any, idx: number) => {
          const lat = Number(p?.latitude ?? p?.lat ?? (Array.isArray(p) ? p[0] : NaN));
          const lon = Number(p?.longitude ?? p?.lon ?? p?.lng ?? (Array.isArray(p) ? p[1] : NaN));
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return {
            id: String(p?.id || p?.marker_id || `route-pt-${idx}`),
            lat,
            lon,
            title: p?.title || p?.name || `Точка ${idx + 1}`,
          };
        })
        .filter(Boolean) as Array<{ id: string; lat: number; lon: number; title: string }>;
    } catch {
      return [];
    }
  }, [favorites]);

  // Добавляет маршрут на карту
  const addRouteToMap = useCallback((routeData: any) => {
    const rid = String(routeData?.id || '');
    if (!rid) return;

    const points = extractRoutePoints(routeData);
    if (points.length < 2) {
      alert('❌ У маршрута недостаточно точек для отображения');
      return;
    }

    const route: PlannerRoute = { id: `fav-route-${rid}`, points, color: '#8B5CF6' };
    setFacadeRoutes(prev => [...prev, route]);

    let markerPts = extractRoutePointsFull(routeData);
    if (markerPts.length === 0 && points.length > 0) {
      markerPts = points.map((p, idx) => ({
        id: `pt-${idx}`,
        lat: p[0],
        lon: p[1],
        title: `Точка ${idx + 1}`,
      }));
    }

    if (markerPts.length > 0) {
      setFacadeMarkers(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMarkers = markerPts
          .filter(p => !existingIds.has(`route-${rid}-${p.id}`))
          .map((p, idx) => ({
            id: `route-${rid}-${p.id}`,
            lat: p.lat,
            lon: p.lon,
            title: p.title,
            name: p.title,
            description: '',
            category: 'saved-route',
            source: 'saved-route' as const,
          }));
        const updated = [...prev, ...newMarkers];
        // Маркеры синхронизируются автоматически через usePlannerMarkerSync
        return updated;
      });
    }
  }, [extractRoutePoints, extractRoutePointsFull, setFacadeRoutes, setFacadeMarkers]);

  // Удаляет маршрут с карты
  const removeRouteFromMap = useCallback((routeId: string) => {
    const routeIdToRemove = `fav-route-${routeId}`;
    setFacadeRoutes(prev => prev.filter(r => r.id !== routeIdToRemove));
    renderedRouteIdsRef.current.delete(routeIdToRemove);

    setFacadeMarkers(prev => {
      const updated = prev.filter(m => !m.id.startsWith(`route-${routeId}-`));
      // Маркеры синхронизируются автоматически через usePlannerMarkerSync
      return updated;
    });
  }, [setFacadeRoutes, setFacadeMarkers, renderedRouteIdsRef]);

  // Переключает маршрут (добавить/удалить с карты)
  const handleRouteToggle = useCallback((routeData: any, checked: boolean) => {
    const rid = String(routeData?.id || '');
    if (!rid) return;

    setSelectedRouteIds((prev: string[]) => {
      const next = new Set(prev);
      if (checked) next.add(rid);
      else next.delete(rid);
      return Array.from(next);
    });

    if (checked) {
      // Если маршрута нет в избранном пользователя – добавим (для ЛК)
      try {
        const fr = (favorites as any)?.favoriteRoutes || [];
        const exists = fr.some((r: any) => String(r.id) === rid);
        if (!exists) {
          const pointsForFav = extractRoutePoints(routeData).map((p, idx) => ({
            id: `pt-${idx}`,
            latitude: p[0],
            longitude: p[1],
          }));
          (favorites as any)?.addFavoriteRoute?.({
            id: rid,
            title: routeData.title || 'Без названия',
            distance: 0,
            duration: 0,
            rating: 0,
            isOriginal: true,
            tags: Array.isArray(routeData.tags) ? routeData.tags : [],
            description: routeData.description || '',
            visibility: 'private',
            usageCount: 0,
            relatedContent: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            points: pointsForFav,
            categories: { personal: true, post: false, event: false },
          });
        }
      } catch {}

      addRouteToMap(routeData);
    } else {
      removeRouteFromMap(rid);
    }
  }, [setSelectedRouteIds, favorites, extractRoutePoints, addRouteToMap, removeRouteFromMap]);

  // Синхронизирует выбранные маршруты с карте
  useEffect(() => {
    if (!isMapReady) return;

    const prevIds = prevSelectedRouteIdsRef.current;
    const currentIds = selectedRouteIds.map(String);

    const addedIds = currentIds.filter((id: string) => !prevIds.includes(id));
    const removedIds = prevIds.filter((id: string) => !currentIds.includes(id));

    prevSelectedRouteIdsRef.current = currentIds;

    if (addedIds.length === 0 && removedIds.length === 0) return;

    const favoriteRoutes = (favorites as any)?.favoriteRoutes || [];

    console.log('[usePlannerSelectedRoutes] Sync:', { addedIds, removedIds, currentIds });

    addedIds.forEach((routeId: string) => {
      const rid = String(routeId);
      const route = favoriteRoutes.find((r: any) => String(r.id) === rid);
      if (!route) {
        console.warn('[usePlannerSelectedRoutes] Route NOT FOUND:', rid);
        return;
      }
      console.log('[usePlannerSelectedRoutes] Adding route:', rid);
      addRouteToMap(route);
    });

    removedIds.forEach((routeId: string) => {
      const rid = String(routeId);
      console.log('[usePlannerSelectedRoutes] Removing route:', rid);
      removeRouteFromMap(rid);
    });
  }, [isMapReady, selectedRouteIds, favorites, addRouteToMap, removeRouteFromMap]);

  return {
    handleRouteToggle,
    extractRoutePoints,
    extractRoutePointsFull,
  };
};
