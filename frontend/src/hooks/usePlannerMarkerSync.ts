import { useEffect, useRef } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import { projectManager } from '../services/projectManager';
import { isWithinRussiaBounds } from '../utils/russiaBounds';
import type { PlannerMarker } from '../types/planner';
import type { RoutePoint as RoutePlannerContextPoint } from '../contexts/RoutePlannerContext';

export interface UsePlannerMarkerSyncOptions {
  isMapReady: boolean;
  facadeMarkers: PlannerMarker[];
  selectedMarkerIds: string[];
  selectedEventIds: string[];
  routePointsFromContext: RoutePlannerContextPoint[];
  addPointAndRender: (point: { id: string; latitude: number; longitude: number; title: string; description?: string; source?: string }) => Promise<boolean>;
  removeRoutePoint: (id: string) => void;
  renderMarkersOnMap: (markers: PlannerMarker[]) => void;
}

export const usePlannerMarkerSync = ({
  isMapReady,
  facadeMarkers,
  selectedMarkerIds,
  selectedEventIds,
  routePointsFromContext,
  addPointAndRender,
  removeRoutePoint,
  renderMarkersOnMap,
}: UsePlannerMarkerSyncOptions) => {
  const favorites = useFavorites();
  const facadeMarkersRef = useRef<PlannerMarker[]>([]);
  const prevSelectedIdsRef = useRef<string[]>([]);
  const prevSelectedEventIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isMapReady) return;
    const favoritesAsMarkers: any[] = (favorites as any)?.favorites || [];
    const rawPlaces = (favorites as any)?.favoritePlaces || [];
    const prevIds = prevSelectedIdsRef.current;
    const currentIds = selectedMarkerIds;

    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    prevSelectedIdsRef.current = currentIds;

    removedIds.forEach(rawId => {
      const id = String(rawId);
      try { projectManager.getMapApi()?.removeMarker?.(id); } catch {}
      if (removeRoutePoint) removeRoutePoint(id);
    });

    addedIds.forEach(id => {
      if (facadeMarkersRef.current.some(m => m.id === id)) return;
      const marker = favoritesAsMarkers.find((marker: any) => String(marker.id) === String(id))
        || rawPlaces.find((marker: any) => String(marker.id) === String(id));
      if (!marker) return;

      const lat = Number(marker.latitude ?? marker.coordinates?.[0]);
      const lon = Number(marker.longitude ?? marker.coordinates?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const coordinates = isWithinRussiaBounds(lat, lon) ? [lat, lon] as [number, number] : [lat, lon] as [number, number];

      void addPointAndRender({
        id: marker.id || `fav-${Date.now()}`,
        latitude: coordinates[0],
        longitude: coordinates[1],
        title: marker.title || marker.name || 'Без названия',
        description: undefined,
        source: 'favorite',
      });
    });
  }, [isMapReady, selectedMarkerIds, favorites, addPointAndRender, removeRoutePoint]);

  useEffect(() => {
    if (!isMapReady) return;
    const rawEvents: any[] = (favorites as any)?.favoriteEvents || [];
    const prevIds = prevSelectedEventIdsRef.current;
    const currentIds = selectedEventIds;

    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    prevSelectedEventIdsRef.current = currentIds;

    removedIds.forEach(rawId => {
      const pointId = `fav-event-${String(rawId)}`;
      try { projectManager.getMapApi()?.removeMarker?.(pointId); } catch {}
      if (removeRoutePoint) removeRoutePoint(pointId);
    });

    addedIds.forEach(rawId => {
      const event = rawEvents.find((item: any) => String(item.id) === String(rawId));
      if (!event) return;
      const lat = Number(event.latitude);
      const lon = Number(event.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      void addPointAndRender({
        id: `fav-event-${event.id}`,
        latitude: lat,
        longitude: lon,
        title: event.title || 'Событие',
        description: event.description || undefined,
        source: 'event',
      });
    });
  }, [isMapReady, selectedEventIds, favorites, addPointAndRender, removeRoutePoint]);

  // Синхронизируем facadeMarkers с рендерингом — убираем setTimeout костыли
  useEffect(() => {
    if (!isMapReady || facadeMarkers.length === 0) return;
    renderMarkersOnMap(facadeMarkers);
  }, [isMapReady, facadeMarkers, renderMarkersOnMap]);
};
