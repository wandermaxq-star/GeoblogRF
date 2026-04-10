/**
 * Единая система построения маршрутов
 * Объединяет все источники точек в одном состоянии
 */

export type PointSource = 'search' | 'favorites' | 'event' | 'click' | 'coordinates' | 'route';

export interface RoutePoint {
  id: string;
  coordinates: [number, number];
  title: string;
  description?: string;
  source: PointSource;
  sourceId?: string; // ID исходного объекта (например, favoriteId)
  order: number; // Порядок в маршруте
  address?: string; // Для точек из поиска
  isActive: boolean; // Активна ли точка в маршруте
}

export interface RouteState {
  activePoints: RoutePoint[]; // Единый список активных точек
  routePolyline: [number, number][]; // Построенный маршрут
  isBuilding: boolean; // Состояние построения
  lastBuiltKey: string; // Ключ последнего построенного маршрута
  totalDistance?: number; // Общее расстояние
  totalDuration?: number; // Общее время
}

export interface RoutePointManager {
  // Добавление точек
  addPoint: (point: Omit<RoutePoint, 'id' | 'order' | 'isActive'>) => void;
  addSearchPoint: (address: string, coordinates: [number, number]) => void;
  addFavoritePoint: (favoriteId: string, title: string, coordinates: [number, number]) => void;
  addEventPoint: (eventId: string, title: string, coordinates: [number, number]) => void;
  addClickPoint: (coordinates: [number, number], title?: string) => void;
  addCoordinatePoint: (coordinates: [number, number], title: string) => void;
  
  // Управление точками
  removePoint: (pointId: string) => void;
  removePointBySource: (source: PointSource, sourceId: string) => void;
  updatePoint: (pointId: string, updates: Partial<RoutePoint>) => void;
  reorderPoints: (newOrder: string[]) => void;
  togglePoint: (pointId: string) => void; // Включить/выключить точку
  
  // Построение маршрута
  buildRoute: (options?: { profile?: string; preference?: 'fastest' | 'shortest' | 'recommended' }) => Promise<void>;
  rebuildRoute: (options?: { profile?: string; preference?: 'fastest' | 'shortest' | 'recommended' }) => Promise<void>;
  clearRoute: () => void;
  
  // Получение данных
  getActivePoints: () => RoutePoint[];
  getRouteStats: () => { distance: number; duration: number; pointsCount: number };
  canBuildRoute: () => boolean;
}

export interface CoordinateInputData {
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
}

export interface SearchPointData {
  address: string;
  coordinates: [number, number];
  title: string;
  description?: string;
}
