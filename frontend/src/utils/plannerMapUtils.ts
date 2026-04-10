import type { PlannerMarker, PlannerMarkerSource, PlannerMapSettings, PlannerRoute } from '../types/planner';

export const isFiniteCoordinate = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const normalizeCoordinate = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const normalizeLatLon = (lat: unknown, lon: unknown): [number, number] | null => {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLon = normalizeCoordinate(lon);
  if (normalizedLat === null || normalizedLon === null) return null;
  return [normalizedLat, normalizedLon];
};

export const resolveMarkerCategory = (source?: string): string => {
  switch (source) {
    case 'favorite':
      return 'favorite';
    case 'event':
      return 'event';
    case 'click':
      return 'map-click';
    case 'coordinates':
      return 'coordinates';
    case 'search':
    case 'address':
      return 'address';
    case 'saved-route':
      return 'saved-route';
    default:
      return 'route-point';
  }
};

export const resolveMarkerColor = (category?: string): string => {
  switch (category) {
    case 'favorite':
      return '#F59E0B';
    case 'event':
      return '#7C3AED';
    case 'map-click':
      return '#3B82F6';
    case 'coordinates':
      return '#10B981';
    case 'address':
      return '#EF4444';
    case 'saved-route':
      return '#000000';
    default:
      return '#3B82F6';
  }
};

export const buildMarkerTitle = (marker: PlannerMarker): string => {
  return marker.title || marker.name || 'Точка маршрута';
};

export const buildMarkerNumbered = (markers: PlannerMarker[]) => {
  let activeNum = 0;
  return markers.map(marker => ({
    ...marker,
    _num: marker.isActive !== false ? ++activeNum : undefined,
  }));
};

export const normalizePlannerRoutePoints = (route: PlannerRoute): [number, number][] => {
  return (route.points || []).filter(point => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]));
};

export const buildRouteId = (routeId: string): string => `planner-route-${routeId}`;

export const mergePlannerMarkers = (existing: PlannerMarker[], incoming: PlannerMarker[]) => {
  const ids = new Set(existing.map(marker => marker.id));
  return [...existing, ...incoming.filter(marker => !ids.has(marker.id))];
};

export const applyMapSettings = (settings: PlannerMapSettings, mapApi: any) => {
  if (!mapApi) return;
  try {
    if (typeof mapApi.showTraffic === 'function' || typeof mapApi.hideTraffic === 'function') {
      if (settings.showTraffic) {
        mapApi.showTraffic?.();
      } else {
        mapApi.hideTraffic?.();
      }
    }
  } catch (error) {
    console.warn('[plannerMapUtils] applyMapSettings error:', error);
  }
};
