import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { projectManager } from '../services/projectManager';
import type { PlannerRoute, PlannerRouteAlternative } from '../types/planner';
import type { RouteAlternativeId } from '../services/routingService';

export interface UsePlannerRouteSyncOptions {
  isMapReady: boolean;
  facadeRoutes: PlannerRoute[];
  routeAlternatives: PlannerRouteAlternative[];
  selectedAltId: string;
  setSelectedAltId: Dispatch<SetStateAction<string>>;
  renderedRouteIdsRef?: MutableRefObject<Set<string>>;
  isRouteEditing?: boolean;
}

export const usePlannerRouteSync = ({
  isMapReady,
  facadeRoutes,
  routeAlternatives,
  selectedAltId,
  setSelectedAltId,
  renderedRouteIdsRef,
  isRouteEditing = false,
}: UsePlannerRouteSyncOptions) => {
  const internalRenderedRouteIdsRef = useRef<Set<string>>(new Set());
  const routeIdsRef = renderedRouteIdsRef ?? internalRenderedRouteIdsRef;

  useEffect(() => {
    if (!isMapReady || isRouteEditing) return;

    const mapApi = projectManager.getMapApi?.();
    if (!mapApi || typeof mapApi.renderRoute !== 'function') {
      return;
    }

    const currentIds = new Set(facadeRoutes.map(route => route.id).filter(Boolean));

    routeIdsRef.current.forEach(renderedId => {
      if (!currentIds.has(renderedId)) {
        try {
          mapApi.removeRoute?.(renderedId);
        } catch {}
        routeIdsRef.current.delete(renderedId);
      }
    });

    facadeRoutes.forEach(route => {
      if (!route.id || routeIdsRef.current.has(route.id) || !route.points?.length) return;
      try {
        mapApi.renderRoute({ id: route.id, geometry: route.points, color: route.color });
        routeIdsRef.current.add(route.id);
      } catch (error) {
        console.warn('[usePlannerRouteSync] renderRoute failed:', error);
      }
    });
  }, [isMapReady, facadeRoutes, isRouteEditing]);

  useEffect(() => {
    if (!isMapReady || isRouteEditing) return;
    const mapApi = projectManager.getMapApi?.();
    if (!mapApi || typeof (mapApi as any).renderAlternatives !== 'function') return;

    try {
      const displayAlts = routeAlternatives.map(alt => ({
        ...alt,
        isSelected: alt.id === selectedAltId,
      }));

      (mapApi as any).renderAlternatives(displayAlts, (id: string) => {
        if (id !== selectedAltId) {
          setSelectedAltId(id as RouteAlternativeId);
        }
      });
    } catch (error) {
      console.warn('[usePlannerRouteSync] renderAlternatives failed:', error);
    }
  }, [isMapReady, routeAlternatives, selectedAltId, setSelectedAltId, isRouteEditing]);
};
