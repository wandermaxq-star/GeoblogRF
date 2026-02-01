import { DomainGeoPoint, DomainGeoBounds, PolylineStyle, IMapObjectHandle } from './types';

// Backwards-compatible object-based GeoPoint (existing codebase uses {lat, lon})
export interface GeoPoint { lat: number; lon: number; }

// Keep LatLng alias for convenience (tuple [lat, lng])
export type LatLng = [number, number];

// Bounds remain compatible with domain bounds, with legacy aliases
export type Bounds = DomainGeoBounds & {
  southWest?: LatLng;
  northEast?: LatLng;
};


// ========================
// Контекст и конфигурация
// ========================

export type MapContext = 'osm' | 'planner' | 'offline';

export interface MapConfig {
  center?: GeoPoint | LatLng;
  zoom?: number;
  markers?: UnifiedMarker[];
  // Дополнительные параметры, специфичные для провайдера
  [key: string]: unknown;
}

// ========================
// Маркеры и события
// ========================

export interface UnifiedMarker {
  id: string;
  name?: string;
  coordinates: GeoPoint;
  type?: string; // 'post', 'event', 'poi'
  shape?: string; // 'drop', 'circle'
  color?: string;
  icon?: string; // имя иконки или URL
  size?: 'small' | 'medium' | 'large';
  popupContent?: unknown;

  // Расширенные поля для UI
  title?: string;
  description?: string;
  category?: string;
  iconSize?: [number, number];
  routeMarker?: string;
}

export interface CalendarEvent {
  id: string;
  title?: string;
  location?: { coordinates: GeoPoint };
  category?: string;
  startAt?: string | Date;
  [key: string]: unknown;
}

// ========================
// Маршруты
// ========================

export interface PersistedRoute {
  id: string;
  waypoints: GeoPoint[];
  geometry?: unknown; // GeoJSON LineString или аналог
  distance?: number; // метры
  duration?: number; // миллисекунды
  createdAt?: Date;
}

export interface TrackedRoute extends PersistedRoute {
  points: GeoPoint[]; // полный трек с частотой записи
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, unknown>;
  bbox?: Bounds | null;
}

// ========================
// Отдельные интерфейсы для внешнего использования (например, фасада)
// ========================

export interface MapMarker {
  id: string;
  position: GeoPoint;
  title?: string;
  category?: string;
  type?: string;
  description?: string; // optional description allowed for markers
  // Добавь остальные поля, если они нужны, например: icon, popup и т.д.
}

export interface Route {
  id: string;
  points: GeoPoint[];
  distance: number;
  duration: number;
  // ... остальные поля
}

// ========================
// Черновики и избранное
// ========================

// TODO: заменить на конкретные типы при рефакторинге
export type DraftPost = unknown;
export type DraftMarker = unknown;
export type DraftRoute = unknown;
export type DraftEvent = unknown;
export type FavoriteItem = unknown;

// ========================
// Вспомогательные типы
// ========================

export interface MapActionButton {
  id: string;
  icon: string;
  tooltip?: string;
  badge?: number;
  active?: boolean;
}

export type DateRange = { from: Date; to: Date };

export interface RouteStats {
  distance: number; // метры
  duration: number; // миллисекунды
  [key: string]: unknown;
}

// ========================
// Зависимости фасада
// ========================

export interface MapFacadeDependencies {
  accessControlService: { isPremium: () => boolean };
  storageService: {
    getDownloadedRegions: () => string[];
    addToFavorites?: (item: unknown) => void;
    getFavorites?: () => unknown[];
    removeFromFavorites?: (id: string) => void;
    saveRoute?: (route: PersistedRoute) => void;
    downloadRegion?: (id: string) => Promise<void>;
    deleteRegion?: (id: string) => Promise<void>;
  };
  notificationService?: {
    notify?: (opts: { type?: string; title?: string; message?: string }) => void;
  };
  userService?: { getCurrentUser?: () => { id?: string } };
  offlineContentQueue: {
    saveDraft?: (type: string, draft: unknown) => Promise<void>;
    syncPosts?: () => Promise<void>;
    getDrafts?: (type?: string) => Promise<unknown[]>;
    syncAll?: () => Promise<void>;
  };
  moderationService: { submitPost?: (draft: unknown) => Promise<void> };
  eventsStore: { getEvents?: (range: DateRange) => Promise<CalendarEvent[]> };
  gamificationFacade: {
    recordAction?: (action: string, meta?: unknown) => Promise<void>;
    isActionRateLimited?: (action: string) => boolean;
  };
  activityService: { recordActivity?: (activity: unknown) => void };
  analyticsOrchestrator: {
    trackMapInteraction?: (event: MapAnalyticsEvent) => void;
  };
}

export type MapAnalyticsEvent = {
  action: string;
} & Record<string, unknown>;

// ========================
// Интерфейс рендерера карты
// ========================

export interface IMapRenderer {
  // Инициализация
  init(containerId: string, config?: MapConfig): Promise<void>;
  destroy(): void;

  // Управление видом
  setView(center: GeoPoint | LatLng, zoom: number): void;
  invalidateSize?(): void;

  // === Координатные и утилитарные методы ===
  // Возвращает пиксельную точку для заданного latlng
  project?(latlng: LatLng): { x: number; y: number };
  // Обратная операция — возвращает [lat, lng]
  unproject?(point: { x: number; y: number }, zoom?: number): LatLng;
  // Возвращает размер контейнера карты в пикселях
  getSize?(): { x: number; y: number };
  // Текущий зум
  getZoom?(): number;

  // === Работа со слоями ===
  eachLayer?(fn: (layer: any) => void): void;

  // Рендеринг данных (вендор-агностично)
  renderMarkers(markers: UnifiedMarker[]): void;
  renderRoute(route: PersistedRoute): void;

  // Высокоуровневые операции с объектами карты
  // Use domain types (tuples) for facade-level polyline operations
  createPolyline?(points: DomainGeoPoint[], style?: PolylineStyle): IMapObjectHandle;

  // Низкоуровневое добавление/удаление слоёв
  addLayer?(layer: any): void;
  removeLayer?(layer: any): void;

  // Очистка (опционально)
  clear?(): void;
  removeMarker?(id: string): void;
  removeRoute?(id: string): void;

  // Навигация и bounds — facade-level uses domain types
  setCenter?(center: DomainGeoPoint, zoom?: number): void;
  getCenter?(): DomainGeoPoint;
  setBounds?(bounds: DomainGeoBounds, options?: any): void;

  // Доступ к инстансу (для расширенных сценариев)
  getMap?(): unknown;

  // --- Доп. утилиты (опциональные) для упрощения работы компонентов через фасад ---
  addTileLayer?(url: string, options?: any): any;
  // Перелет/анимация к точке
  flyTo?(center: LatLng, zoom?: number, options?: any): void;

  // Универсальная подписка на события
  on?(event: string, handler: (...args: any[]) => void): void;
  off?(event: string, handler: (...args: any[]) => void): void;

  // Специфичные опции/поведения (опционально)
  enableBehavior?(id: string): void;
  disableBehavior?(id: string): void;

  // Обработка событий (deprecated shorthands kept for compatibility)
  onMapClick?(handler: (event: any) => void): void;
  onMapMove?(handler: () => void): void;
  offMapMove?(handler: () => void): void;
  onMapZoom?(handler: () => void): void;
  offMapZoom?(handler: () => void): void;

  // События начала перемещения/зума (movestart/zoomstart)
  onMapMoveStart?(handler: () => void): void;
  offMapMoveStart?(handler: () => void): void;
  onMapZoomStart?(handler: () => void): void;
  offMapZoomStart?(handler: () => void): void;
}