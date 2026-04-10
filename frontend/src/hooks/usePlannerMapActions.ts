import { useCallback, useEffect } from 'react';
import type React from 'react';
import { projectManager } from '../services/projectManager';
import { canCreateMarker } from '../services/zoneService';
import { resolveMarkerCategory, resolveMarkerColor, buildMarkerNumbered, buildMarkerTitle } from '../utils/plannerMapUtils';
import type { PlannerMarker } from '../types/planner';
import type { RoutePoint as RoutePlannerContextPoint } from '../contexts/RoutePlannerContext';
import { usePlannerFacadeStore } from '../stores/plannerFacadeStore';

export interface PlannerContextRoutePoint extends RoutePlannerContextPoint {
  source?: string;
}

export interface UsePlannerMapActionsOptions {
  isMapReady: boolean;
  isPlannerActive: boolean;
  routePointsFromContext: PlannerContextRoutePoint[];
  addRoutePoint: (point: { id: string; latitude: number; longitude: number; title: string; description?: string; source?: string; sourceId?: string }) => void;
  removeRoutePoint: (id: string) => void;
}

export const usePlannerMapActions = ({
  isMapReady,
  isPlannerActive,
  routePointsFromContext,
  addRoutePoint,
  removeRoutePoint,
}: UsePlannerMapActionsOptions) => {
  // Получаем setFacadeMarkers из Zustand store вместо пропсов
  const { setFacadeMarkers, facadeMarkers } = usePlannerFacadeStore();
  const renderMarkersOnMap = useCallback((markers: PlannerMarker[]) => {
    try {
      const mapApi = projectManager.getMapApi?.();
      if (!mapApi) {
        console.warn('[usePlannerMapActions] renderMarkersOnMap: mapApi not ready');
        return;
      }

      const numberedMarkers = buildMarkerNumbered(markers);
      if (typeof mapApi.renderMarkers === 'function') {
        const unifiedMarkers = numberedMarkers.map(m => ({
          id: m.id || `m-${Date.now()}`,
          coordinates: { lat: Number(m.lat), lon: Number(m.lon) },
          title: buildMarkerTitle(m),
          category: m.category || resolveMarkerCategory(m.source),
          number: (m as any)._num,
        }));
        mapApi.renderMarkers(unifiedMarkers);
        return;
      }

      const ymaps = (window as any).ymaps;
      const map = mapApi?.map || mapApi?.mapInstance;
      if (!map || !ymaps) return;

      const collection = new ymaps.GeoObjectCollection();
      numberedMarkers.forEach(m => {
        const lat = Number(m.lat);
        const lon = Number(m.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const markerColor = resolveMarkerColor(m.category);
        const num = (m as any)._num;
        const svgMarker = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C8.268 1 2 7.268 2 15c0 8.5 14 27 14 27s14-18.5 14-27C30 7.268 23.732 1 16 1z" fill="${markerColor}" stroke="white" stroke-width="1.5"/><circle cx="16" cy="14" r="9" fill="white"/>${num ? `<text x="16" y="14" text-anchor="middle" dominant-baseline="central" fill="${markerColor}" font-size="${String(num).length > 1 ? 9 : 11}" font-weight="bold" font-family="Arial,sans-serif">${num}</text>` : ''}</svg>`;
        collection.add(new ymaps.Placemark([lat, lon],
          { balloonContent: buildMarkerTitle(m) },
          { iconLayout: 'default#image', iconImageHref: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarker)}`, iconImageSize: [32, 42], iconImageOffset: [-16, -42] }
        ));
      });
      if ((window as any).__plannerMarkersCollection) {
        try { map.geoObjects.remove((window as any).__plannerMarkersCollection); } catch {}
      }
      map.geoObjects.add(collection);
      (window as any).__plannerMarkersCollection = collection;
    } catch (error) {
      console.warn('[usePlannerMapActions] renderMarkersOnMap error:', error);
    }
  }, []);

  const addPointAndRender = useCallback(async (point: { id: string; latitude: number; longitude: number; title: string; description?: string; source?: string }) => {
    try {
      const zoneCheck = await canCreateMarker(point.latitude, point.longitude);
      if (!zoneCheck.allowed) {
        alert(`🚫 Точка заблокирована: ${zoneCheck.reason || 'Запретная зона'}`);
        return false;
      }
    } catch (error) {
      console.error('[usePlannerMapActions] Zone check error:', error);
      alert('🚫 Не удалось проверить запретные зоны. Точка не добавлена для безопасности.');
      return false;
    }

    const stringId = String(point.id);
    addRoutePoint({ ...point, id: stringId });

    setFacadeMarkers(prev => {
      if (prev.some(m => m.id === stringId)) {
        // Маркер уже есть, синхронизация произойдёт через usePlannerMarkerSync
        return prev;
      }

      const newMarker: PlannerMarker = {
        id: stringId,
        lat: point.latitude,
        lon: point.longitude,
        title: point.title,
        name: point.title,
        description: point.description || '',
        category: resolveMarkerCategory(point.source),
        source: point.source as any,
      };
      // Синхронизация произойдёт автоматически через usePlannerMarkerSync
      return [...prev, newMarker];
    });
    return true;
  }, [addRoutePoint, setFacadeMarkers]);

  useEffect(() => {
    if (!isMapReady || !isPlannerActive) return;
    // Синхронизация facadeMarkers происходит через usePlannerMarkerSync
    // Здесь просто обновляем store при изменении контекста
  }, [isMapReady, isPlannerActive]);

  // useEffect(() => {
  //   if (!isMapReady || routePointsFromContext.length === 0) return;

  //   const newMarkers: PlannerMarker[] = routePointsFromContext.map((rp, idx) => ({
  //     id: rp.id || `rp-${idx}`,
  //     lat: rp.latitude,
  //     lon: rp.longitude,
  //     title: rp.title || `Точка ${idx + 1}`,
  //     name: rp.title || `Точка ${idx + 1}`,
  //     description: rp.description || '',
  //     category: resolveMarkerCategory(rp.source),
  //     source: rp.source as any,
  //   }));

  //   setFacadeMarkers(prev => {
  //     const preservedMarkers = prev.filter(m => m.category === 'saved-route' || m.source === 'saved-route');
  //     // Синхронизация произойдёт автоматически через usePlannerMarkerSync
  //     return [...preservedMarkers, ...newMarkers];
  //   });
  // }, [isMapReady, routePointsFromContext, setFacadeMarkers]);

  return {
    addPointAndRender,
    renderMarkersOnMap,
  };
};
