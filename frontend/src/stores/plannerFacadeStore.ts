import { create } from 'zustand';
import type { PlannerMarker, PlannerRoute } from '../types/planner';

export interface PlannerFacadeState {
  facadeMarkers: PlannerMarker[];
  facadeRoutes: PlannerRoute[];
  setFacadeMarkers: (markers: PlannerMarker[] | ((prev: PlannerMarker[]) => PlannerMarker[])) => void;
  setFacadeRoutes: (routes: PlannerRoute[] | ((prev: PlannerRoute[]) => PlannerRoute[])) => void;
  clearFacade: () => void;
}

export const usePlannerFacadeStore = create<PlannerFacadeState>((set) => ({
  facadeMarkers: [],
  facadeRoutes: [],

  setFacadeMarkers: (markers) => {
    set((state) => ({
      facadeMarkers: typeof markers === 'function' ? markers(state.facadeMarkers) : markers,
    }));
  },

  setFacadeRoutes: (routes) => {
    set((state) => ({
      facadeRoutes: typeof routes === 'function' ? routes(state.facadeRoutes) : routes,
    }));
  },

  clearFacade: () => {
    set({
      facadeMarkers: [],
      facadeRoutes: [],
    });
  },
}));
