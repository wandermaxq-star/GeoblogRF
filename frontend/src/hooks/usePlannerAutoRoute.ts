import { useEffect, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { projectManager } from '../services/projectManager';
import { canCreateRoute } from '../services/zoneService';
import { getAlternativeRoutes } from '../services/routingService';
import type { PlannerRoute, PlannerMarker, PlannerRouteAlternative } from '../types/planner';
import type { RouteAlternativeId } from '../services/routingService';

export interface UsePlannerAutoRouteOptions {
  isMapReady: boolean;
  facadeMarkers: PlannerMarker[];
  facadeRoutes: PlannerRoute[];
  routeAlternatives: any[];
  setFacadeRoutes: Dispatch<SetStateAction<PlannerRoute[]>>;
  setRouteAlternatives: Dispatch<SetStateAction<any[]>>;
  setSelectedAltId: Dispatch<SetStateAction<string>>;
  setRouteStats: Dispatch<SetStateAction<{ distanceText: string; durationText: string; distanceKm: number; durationSec: number } | null>>;
  renderedRouteIdsRef: React.MutableRefObject<Set<string>>;
}

export const usePlannerAutoRoute = ({
  isMapReady,
  facadeMarkers,
  facadeRoutes,
  routeAlternatives,
  setFacadeRoutes,
  setRouteAlternatives,
  setSelectedAltId,
  setRouteStats,
  renderedRouteIdsRef,
}: UsePlannerAutoRouteOptions) => {
  const autoRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoRouteKeyRef = useRef<string>('');
  const isAutoRoutingRef = useRef(false);

  // Нормализует координаты в [lat, lon]
  const normalizePoint = useCallback((p: unknown): [number, number] | null => {
    if (!p) return null;
    let lat: number | undefined;
    let lon: number | undefined;

    if (Array.isArray(p)) {
      const a = Number(p[0]);
      const b = Number(p[1]);
      lat = a;
      lon = b;
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        if (Number.isFinite(b) && b >= -90 && b <= 90 && Number.isFinite(a)) {
          lat = b;
          lon = a;
        }
      }
    } else if (typeof p === 'object' && p !== null) {
      lat = Number((p as any).latitude ?? (p as any).lat);
      lon = Number((p as any).longitude ?? (p as any).lng ?? (p as any).lon);
    } else {
      return null;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return [lat, lon];
  }, []);

  // Нормализует полилинию из API
  const normalizePolyline = useCallback((poly: any[]): [number, number][] => {
    if (!Array.isArray(poly)) return [];
    const out: [number, number][] = [];
    for (const p of poly) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const a = Number(p[0]),
        b = Number(p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a >= -180 && a <= 180 && (a < -90 || a > 90) && b >= -90 && b <= 90) {
        out.push([b, a]);
      } else {
        out.push([a, b]);
      }
    }
    return out;
  }, []);

  // Функция построения маршрута
  const buildAndSetRoute = useCallback(
    async (points: any[]): Promise<PlannerRoute | null> => {
      if (!Array.isArray(points) || points.length < 2) {
        return null;
      }

      try {
        // Нормализуем входные точки
        const normalized = points
          .map((p: unknown) => normalizePoint(p))
          .filter((p): p is [number, number] => p !== null);

        if (normalized.length < 2) {
          return null;
        }

        // Проверяем валидность координат
        const allValid = normalized.every(
          ([lat, lon]) =>
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
        );

        if (!allValid) {
          return null;
        }

        // Проверяем запретные зоны
        try {
          const routeZoneCheck = await canCreateRoute(normalized);
          if (!routeZoneCheck.allowed) {
            alert(
              `🚫 Маршрут заблокирован: ${routeZoneCheck.reason || 'Маршрут проходит через запретную зону'}`
            );
            return null;
          }
        } catch (err) {
          console.error('[usePlannerAutoRoute] Zone check error:', err);
          alert('🚫 Не удалось проверить запретные зоны. Построение отменено.');
          return null;
        }

        // Запрашиваем альтернативные маршруты
        const alts = await getAlternativeRoutes(normalized);

        if (alts.length === 0) {
          const route: PlannerRoute = {
            id: `auto-route-${Date.now()}`,
            points: normalized,
            color: '#3B82F6',
          };
          setFacadeRoutes(prev => [...prev.filter(r => !r.id?.startsWith('auto-route-')), route]);
          setRouteAlternatives([]);
          return route;
        }

        setRouteAlternatives(alts);
        setSelectedAltId('shortest');

        setFacadeRoutes(prev => prev.filter(r => !r.id?.startsWith('auto-route-')));

        const primary = alts.find(a => a.id === 'shortest') ?? alts[0];
        return {
          id: `auto-route-${Date.now()}`,
          points: primary.polyline,
          color: primary.colorActive,
        };
      } catch {
        return null;
      }
    },
    [setFacadeRoutes, setRouteAlternatives, setSelectedAltId, normalizePoint]
  );

  // Автопостроение маршрута при добавлении маркеров
  useEffect(() => {
    const activeMarkers = facadeMarkers.filter(m => (m as any).isActive !== false);
    if (!isMapReady || activeMarkers.length < 2) return;

    const markersKey = activeMarkers.map(m => `${m.lat},${m.lon}`).join('|');
    if (markersKey === lastAutoRouteKeyRef.current) return;

    if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);

    autoRouteTimerRef.current = setTimeout(async () => {
      while (isAutoRoutingRef.current) {
        await new Promise(r => setTimeout(r, 50));
      }

      isAutoRoutingRef.current = true;
      try {
        const mapApi = projectManager.getMapApi?.();
        if (typeof (mapApi as any)?.clearAlternatives === 'function') {
          (mapApi as any).clearAlternatives();
        }
        if (typeof (mapApi as any)?.clearAllRoutes === 'function') {
          (mapApi as any).clearAllRoutes();
        } else {
          for (const routeId of renderedRouteIdsRef.current) {
            try {
              mapApi?.removeRoute?.(routeId);
            } catch {}
          }
        }
        renderedRouteIdsRef.current.clear();
        setFacadeRoutes([]);

        const currentActive = facadeMarkers.filter(m => (m as any).isActive !== false);
        const routePoints = currentActive.map(m => [Number(m.lat), Number(m.lon)] as [number, number]);
        if (routePoints.length < 2) return;

        lastAutoRouteKeyRef.current = markersKey;
        await buildAndSetRoute(routePoints);
      } catch (e) {
        console.warn('[usePlannerAutoRoute] Auto route build failed:', e);
      } finally {
        isAutoRoutingRef.current = false;
      }
    }, 800);

    return () => {
      if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
    };
  }, [isMapReady, facadeMarkers, buildAndSetRoute, setFacadeRoutes, renderedRouteIdsRef]);

  // Отчищает альтернативы если маркеров меньше 2
  useEffect(() => {
    const activeCount = facadeMarkers.filter(m => (m as any).isActive !== false).length;
    if (activeCount < 2 && routeAlternatives.length > 0) {
      setRouteAlternatives([]);
    }
  }, [facadeMarkers, routeAlternatives, setRouteAlternatives]);

  return {
    buildAndSetRoute,
    normalizePoint,
    normalizePolyline,
  };
};
