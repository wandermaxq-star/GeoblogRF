import { create } from 'zustand';
import type { MarkerData } from '../types/marker';

export interface PackBuilderRouteData {
  // Вариант А: из Planner (готовая полилиния)
  polyline?: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
  initialWaypoints?: Array<{ title: string; coordinates: [number, number] }>;
  // Вариант Б: из Избранного (исходные маркеры, маршрут строится внутри Builder)
  sourceMarkers?: MarkerData[];
}

interface PackBuilderState {
  isOpen: boolean;
  routeData: PackBuilderRouteData | null;
  open: (data: PackBuilderRouteData) => void;
  close: () => void;
}

export const usePackBuilderStore = create<PackBuilderState>((set) => ({
  isOpen: false,
  routeData: null,
  open: (data) => set({ isOpen: true, routeData: data }),
  close: () => set({ isOpen: false, routeData: null }),
}));
