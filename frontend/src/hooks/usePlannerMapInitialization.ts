import { useEffect, useRef, useState } from 'react';
import { projectManager } from '../services/projectManager';
import { mapFacade } from '../services/map_facade';
import { mapStateHelpers } from '../stores/mapStateStore';
import type { PlannerMapConfig, PlannerMarker, PlannerRoute } from '../types/planner';

export interface UsePlannerMapInitializationOptions {
  isPlannerActive: boolean;
  provider: string;
  facadeMarkers: PlannerMarker[];
  facadeRoutes: PlannerRoute[];
  pendingRoutes: PlannerRoute[];
}

export const usePlannerMapInitialization = ({
  isPlannerActive,
  provider,
  facadeMarkers,
  facadeRoutes,
  pendingRoutes,
}: UsePlannerMapInitializationOptions) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const initStartedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isPlannerActive) return;
    if (initializedRef.current) {
      try {
        mapFacade().setActiveContext?.('planner');
      } catch {
        // ignore
      }
      if (!isMapReady) {
        setIsMapReady(true);
      }
      return;
    }
    if (initStartedRef.current) return;

    initStartedRef.current = true;
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 20;

    const initialize = async () => {
      let container = document.getElementById('planner-map-container');
      while ((!container || container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < maxAttempts && isMounted) {
        await new Promise(resolve => setTimeout(resolve, 100));
        container = document.getElementById('planner-map-container');
        attempts += 1;
      }
      if (!isMounted || !container) return;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        setMapError('Контейнер карты имеет нулевые размеры');
        return;
      }

      const savedState = mapStateHelpers.getCenterAndZoom('planner');
      const config: PlannerMapConfig = {
        provider: provider as any,
        center: savedState.center,
        zoom: savedState.zoom,
        markers: facadeMarkers,
        routes: [...facadeRoutes, ...pendingRoutes],
        preserveState: true,
        context: 'planner',
      };

      try {
        await projectManager.initializeMap(container, config as any);
        if (isMounted) {
          initializedRef.current = true;
          setMapError(null);
          setIsMapReady(true);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setMapError(error instanceof Error ? error.message : 'Ошибка инициализации карты');
          setIsMapReady(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [isPlannerActive, provider, facadeMarkers, facadeRoutes, pendingRoutes]);

  return {
    isMapReady,
    mapError,
    setIsMapReady,
  };
};
