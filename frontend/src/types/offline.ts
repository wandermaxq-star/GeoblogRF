/**
 * Типы для офлайн функциональности
 */

export interface OfflineTileset {
  name: string;
  format: 'png' | 'pbf' | 'jpg';
  sizeMB: number;
  bounds: [number, number, number, number] | null;
  center: [number, number] | null;
  minzoom: number | null;
  maxzoom: number | null;
  description: string | null;
}

export interface OfflineTilesetMetadata {
  name: string;
  format: string;
  minzoom?: number;
  maxzoom?: number;
  center?: [number, number];
  bounds?: [number, number, number, number];
  description?: string;
}

export interface OfflineState {
  isActive: boolean;
  menuOpen: boolean;
  tilesets: OfflineTileset[];
  activeSet: string;
  metadata: OfflineTilesetMetadata | null;
  loading: boolean;
  error: string | null;
}

export interface MapMode {
  type: 'online' | 'offline';
  activeSet?: string;
}

/**
 * Популярный маршрут (для PRO)
 */
export interface PopularRoute {
  id: string;
  name: string;
  description: string;
  cities: RouteCity[];
  totalSizeMB: number;
  imageUrl?: string;
}

export interface RouteCity {
  id: string;
  name: string;
  region: string;
  coordinates: [number, number];
  zoom: number;
  bounds: [number, number, number, number];
  tilesetName: string;
  sizeMB: number;
  selected: boolean;
}
