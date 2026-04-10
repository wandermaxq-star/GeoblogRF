import type React from 'react';
import type { GeoPoint, MapConfig as FacadeMapConfig } from '../services/map_facade/IMapRenderer';
import type { RoutePoint } from './routeBuilder';

export type PlannerMapProvider = 'yandex' | 'osm' | 'unknown';

export type PlannerMarkerSource =
  | 'favorite'
  | 'event'
  | 'click'
  | 'coordinates'
  | 'address'
  | 'saved-route'
  | 'hub'
  | 'route-point';

export interface PlannerMarker {
  id: string;
  lat: number;
  lon: number;
  title: string;
  name?: string;
  description?: string;
  category: string;
  source?: PlannerMarkerSource;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlannerRoute {
  id: string;
  points: [number, number][];
  color?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PlannerMapSettings {
  showTraffic: boolean;
}

export interface PlannerMapState {
  isMapReady: boolean;
  isLayerControlOpen: boolean;
  currentProvider: PlannerMapProvider;
}

export type PlannerMapConfig = Omit<FacadeMapConfig, 'markers'> & {
  provider: PlannerMapProvider;
  preserveState?: boolean;
  context?: string;
  markers?: PlannerMarker[];
  routes?: PlannerRoute[];
};

export interface PlannerRouteAlternative {
  id: string;
  label: string;
  hint?: string;
  colorActive?: string;
  polyline: [number, number][];
  distanceKm: number;
  durationMin: number;
}

export interface PlannerInitializationResult {
  isMapReady: boolean;
  mapError: string | null;
}

export interface PlannerMarkerSyncResult {
  facadeMarkers: PlannerMarker[];
  setFacadeMarkers: React.Dispatch<React.SetStateAction<PlannerMarker[]>>;
}
