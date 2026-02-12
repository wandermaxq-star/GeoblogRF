import type {
  MapContext,
  MapFacadeDependencies,
  IMapRenderer,
  GeoPoint,
  UnifiedMarker,
  PersistedRoute,
  TrackedRoute,
  CalendarEvent,
  MapMarker,
  Route,
  Bounds,
  MapAnalyticsEvent,
  MapActionButton,
  DateRange,
} from './IMapRenderer';

// Адаптеры карт (каноничные расположения)
import { OSMMapRenderer } from './adapters/OSMMapRenderer';
import { YandexPlannerRenderer } from './adapters/YandexPlannerRenderer';
import { OfflineOSMRenderer } from './adapters/OfflineOSMRenderer';

// Попытка импортировать утилиту категорий — если модуль недоступен при сборке,
// используем локальный fallback, который будет заменён реальной реализацией позже.
import { getCategoryByKey as getCategoryByKeyOriginal, type MarkerCategory } from '../../constants/markerCategories';

let getCategoryByKey: (key: string | undefined) => { id: string; color?: string; icon?: string } = (k) => ({ id: k || 'other', color: '#3B82F6', icon: 'map-pin' });

// Используем статический импорт (ESM-compatible)
if (getCategoryByKeyOriginal) {
  getCategoryByKey = (key) => {
    if (!key) {
      return { id: 'other', color: '#3B82F6', icon: 'map-pin' };
    }
    const result = getCategoryByKeyOriginal(key);
    if (result) {
      // Преобразуем MarkerCategory в ожидаемый формат
      return {
        id: result.key,
        color: result.color,
        icon: result.iconName
      };
    }
    return { id: key, color: '#3B82F6', icon: 'map-pin' };
  };
}

const objectHasOwn = (obj: any, prop: PropertyKey) => (Object as any).hasOwn ? (Object as any).hasOwn(obj, prop) : Object.getOwnPropertyDescriptor(obj, prop) !== undefined;

export class MapContextFacade {
  private activeContext: MapContext = 'osm';
  private isOnline = true;
  private currentRenderer: IMapRenderer | null = null;
  // Пул рендереров по контекстам, чтобы не уничтожать и не пересоздавать карту при переключениях
  private rendererPool: Partial<Record<MapContext, IMapRenderer>> = {};
  // Метаданные по контейнерам для каждого контекста (помогает валидировать переиспользование)
  private rendererMeta: Partial<Record<MapContext, { containerId?: string }>> = {};
  // Event handler registries
  private readonly clickHandlers: Array<(latLng: [number, number]) => void> = [];
  private readonly routeGeometryHandlers: Array<(coords: Array<[number, number]>) => void> = [];
  // Добавлены новые реестры для событий перемещения и зума
  private readonly moveHandlers: Array<() => void> = [];
  private readonly zoomHandlers: Array<() => void> = []; 
  private readonly moveStartHandlers: Array<() => void> = [];
  private readonly zoomStartHandlers: Array<() => void> = [];

  private splitScreenState = {
    left: 'osm' as MapContext | 'calendar',
    right: null as MapContext | 'planner' | null,
  };

  // GPS-трекинг
  private trackingActive = false;
  private trackingPoints: GeoPoint[] = [];
  private trackingStartTime: Date | null = null;
  private trackingPaused = false; // Переменное свойство (используется в MapContextFacade.startTracking)
  private readonly trackingPausedTime = 0;
  private geoLocationWatchId: number | null = null;

  // Зависимости (DI)
  private readonly deps: MapFacadeDependencies;
  // Буфер для внешних меток, пока рендерер не инициализирован
  private pendingExternalMarkers: any[] = [];
  private readonly isInitializing = false;

  /**
   * Безопасно получает инстанс Leaflet карты.
   * OSMMapRenderer.getMap() бросает Error если карта не инициализирована,
   * поэтому нельзя использовать `getMap?.() ?? fallback` — исключение перехватывается
   * внешним try/catch и fallback никогда не срабатывает.
   */
  private getMapSafe(): any {
    // 1. Пробуем получить через рендерер
    try {
      if (this.currentRenderer && typeof (this.currentRenderer as any).getMap === 'function') {
        const m = (this.currentRenderer as any).getMap();
        if (m) return m;
      }
    } catch (_) { /* getMap() throws when not initialized — это нормально */ }
    // 2. Прямой доступ к свойству .map / .mapInstance рендерера
    try {
      const r = this.currentRenderer as any;
      if (r?.mapInstance) return r.mapInstance;
      if (r?.map) return r.map;
    } catch (_) { /* ignore */ }
    // 3. Fallback на INTERNAL.api
    try {
      const internal = (this as any).INTERNAL;
      if (internal?.api?.map) return internal.api.map;
      if (internal?.api?.mapInstance) return internal.api.mapInstance;
    } catch (_) { /* ignore */ }
    return null;
  }

  constructor(dependencies: MapFacadeDependencies) {
    this.deps = dependencies;
    // Ensure INTERNAL object exists and provide reactive externalMarkers early
    try {
      (this as any).INTERNAL = (this as any).INTERNAL || {};
      const internalObj = (this as any).INTERNAL;
      if (!objectHasOwn(internalObj, 'externalMarkers')) {
        let _externalMarkers: any = internalObj.externalMarkers;
        Object.defineProperty(internalObj, 'externalMarkers', {
          configurable: true,
          enumerable: true,
          get: () => _externalMarkers,
          set: (val: any) => {
            _externalMarkers = val;
            try {
              const toUnified = (m: any) => ({ id: m.id || crypto.randomUUID(), name: m.name ?? m.title, coordinates: { lat: m.lat ?? m.latitude, lon: m.lon ?? m.longitude }, title: m.title || m.name });
              const arr = Array.isArray(val) ? val.map(toUnified) : [];
              if (this.currentRenderer?.renderMarkers) {
                this.currentRenderer.renderMarkers(arr);
              } else {
                this.pendingExternalMarkers = arr;
              }
            } catch (err) { console.debug('[MapContextFacade] Failed processing externalMarkers set:', err); }
          }
        });
      }
    } catch (error_) { console.debug('[MapContextFacade] Ignored error during constructor setup:', error_); }

    this.switchToRenderer(this.activeContext);
  }

  setActiveContext(context: MapContext): void {
    if (this.activeContext === context) return;
    const prev = this.activeContext;
    this.activeContext = context;
    this.switchToRenderer(context);
    this.trackMapEvent({
      action: 'context_switch',
      from: prev,
      to: context,
    });
  }

  setOnlineMode(isOnline: boolean): void {
    if (this.isOnline === isOnline) return;
    this.isOnline = isOnline;
    this.switchToRenderer(this.activeContext);
  }

  isOfflineCapable(): boolean {
    return this.deps.accessControlService.isPremium() && this.hasDownloadedRegions();
  }

  private hasDownloadedRegions(): boolean {
    return this.deps.storageService.getDownloadedRegions().length > 0;
  }

  private switchToRenderer(context: MapContext): void {
    // КРИТИЧНО: Сохраняем маркеры ПЕРЕД переключением рендерера
    const savedMarkers = this.pendingExternalMarkers.length > 0
      ? [...this.pendingExternalMarkers]
      : ((this as any).INTERNAL?.externalMarkers ? [...((this as any).INTERNAL.externalMarkers)] : []);

    if (savedMarkers.length > 0) {
      console.debug('[MapContextFacade] Saving markers before renderer switch:', savedMarkers.length);
    }

    // Пытаемся взять готовый рендерер из пула
    const pooled = this.rendererPool[context];

    if (pooled) {
      // Проверяем, что рендерер из пула в рабочем состоянии (map инициализирован)
      const r = pooled as any;
      const hasMap = r.map || r.mapInstance;
      if (hasMap) {
        this.currentRenderer = pooled;
      } else {
        // Рендерер в пуле устарел (map уничтожен) — удаляем из пула, создаём новый
        console.debug('[MapContextFacade] Pooled renderer stale, creating new for:', context);
        delete this.rendererPool[context];
        if (!this.isOnline) {
          this.switchToOfflineRenderer(context);
        } else {
          this.switchToOnlineRenderer(context);
        }
        if (this.currentRenderer) {
          this.rendererPool[context] = this.currentRenderer;
        }
      }
    } else {
      if (!this.isOnline) {
        this.switchToOfflineRenderer(context);
      } else {
        this.switchToOnlineRenderer(context);
      }
      if (this.currentRenderer) {
        this.rendererPool[context] = this.currentRenderer;
      }
    }

    this.bindRendererEventHandlers();

    // Сохраняем маркеры в pending — они будут отрисованы после init() через renderInitialMarkers
    // НЕ пытаемся рендерить сразу, т.к. рендерер может быть ещё не инициализирован (map === null)
    if (savedMarkers.length > 0) {
      this.pendingExternalMarkers = savedMarkers;
    }
  }

  private switchToOfflineRenderer(context: MapContext): void {
    if (context === 'offline' && this.isOfflineCapable()) {
      this.currentRenderer = new OfflineOSMRenderer();
    }
  }

  private switchToOnlineRenderer(context: MapContext): void {
    const rendererMap: Record<MapContext, any> = {
      'osm': OSMMapRenderer,
      'planner': YandexPlannerRenderer,
      'offline': this.isOfflineCapable() ? OfflineOSMRenderer : null,
    };

    const RendererClass = rendererMap[context];
    if (RendererClass) {
      this.currentRenderer = new RendererClass();
    } else {
      this.currentRenderer = null;
    }
  }

  private bindRendererEventHandlers(): void {
    try {
      if (!this.currentRenderer) return;

      const r = this.currentRenderer as any;

      // Bind Click handlers
      if (r.onMapClick && this.clickHandlers.length > 0) {
        r.onMapClick((e: any) => {
          const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
          this.clickHandlers.forEach(h => {
            try { h(coords); } catch (error_) { console.debug('[MapContextFacade] click handler error:', error_); }
          });
        });
      }

      // Bind Route Geometry handlers
      if (r.onRouteGeometry && this.routeGeometryHandlers.length > 0) {
        r.onRouteGeometry((coords: Array<[number, number]>) => {
          this.routeGeometryHandlers.forEach(h => {
            try { h(coords); } catch (error_) { console.debug('[MapContextFacade] routeGeometry handler error:', error_); }
          });
        });
      }

      // Bind Move handlers
      if (r.onMapMove && this.moveHandlers.length > 0) {
        r.onMapMove(() => {
          this.moveHandlers.forEach(h => {
            try { h(); } catch (error_) { console.debug('[MapContextFacade] move handler error:', error_); }
          });
        });
      }

      // Bind Zoom handlers
      if (r.onMapZoom && this.zoomHandlers.length > 0) {
        r.onMapZoom(() => {
          this.zoomHandlers.forEach(h => {
            try { h(); } catch (error_) { console.debug('[MapContextFacade] zoom handler error:', error_); }
          });
        });
      }

      // Bind MoveStart handlers
      if (r.onMapMoveStart && this.moveStartHandlers.length > 0) {
        r.onMapMoveStart(() => {
          this.moveStartHandlers.forEach(h => {
            try { h(); } catch (error_) { console.debug('[MapContextFacade] moveStart handler error:', error_); }
          });
        });
      }

      // Bind ZoomStart handlers
      if (r.onMapZoomStart && this.zoomStartHandlers.length > 0) {
        r.onMapZoomStart(() => {
          this.zoomStartHandlers.forEach(h => {
            try { h(); } catch (error_) { console.debug('[MapContextFacade] zoomStart handler error:', error_); }
          });
        });
      }
    } catch (error_) {
      console.debug('[MapContextFacade] Ignored binding error:', error_);
    }
  }

  addToFavorites(item: UnifiedMarker | PersistedRoute | { id: string; coordinates: GeoPoint; type: 'event' }): void {
    this.deps.storageService.addToFavorites?.(item as any);
    this.trackMapEvent({ action: 'favorite_added', context: this.activeContext, coordinates: (item as any).coordinates });
  }

  getFavorites(): any[] {
    return this.deps.storageService.getFavorites?.() ?? [];
  }

  removeFromFavorites(itemId: string): void {
    this.deps.storageService.removeFromFavorites?.(itemId);
  }

  async createPost(draft: any): Promise<void> {
    if (!this.isOnline) {
      await this.deps.offlineContentQueue.saveDraft?.('post', draft);
      return;
    }
    await this.deps.moderationService.submitPost?.(draft);
    this.registerGamifiedAction('create_post', { hasPhoto: !!draft.photos?.length });
    this.deps.activityService.recordActivity?.({
      type: 'post_created',
      metadata: { coordinates: draft.coordinates },
    });
  }

  async attachGeoToPost(postId: string, coordinates: GeoPoint): Promise<void> {
    this.trackMapEvent({ action: 'geo_attached', context: this.activeContext, coordinates });
  }

  async syncPendingPosts(): Promise<void> {
    await this.deps.offlineContentQueue.syncPosts?.();
  }

  async planRoute(waypoints: GeoPoint[]): Promise<PersistedRoute> {
    if (this.activeContext !== 'planner' || !this.isOnline) {
      throw new Error('Route planning is only available in PLANNER context and online');
    }
    const route = await (this.currentRenderer as unknown as any).planRoute(waypoints);
    this.saveRoute(route);
    return route;
  }

  displayRoute(route: PersistedRoute): void {
    this.currentRenderer?.renderRoute(route);
  }

  saveRoute(route: PersistedRoute): void {
    this.deps.storageService.saveRoute?.(route);
  }

  startTracking(): void {
    if (!this.deps.accessControlService.isPremium()) {
      throw new Error('GPS tracking is premium-only');
    }
    if (this.trackingActive) return;

    this.trackingActive = true;
    this.trackingPoints = [];
    this.trackingStartTime = new Date();
    this.trackingPaused = false;

    if (!('geolocation' in navigator)) {
      throw new Error('Geolocation API not available');
    }

    this.geoLocationWatchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => {
        this.deps.notificationService?.notify?.({ type: 'error', title: 'GPS error', message: err.message });
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }

  async stopTracking(): Promise<TrackedRoute> {
    if (!this.trackingActive && this.geoLocationWatchId == null) {
      throw new Error('Tracking is not active');
    }

    this.trackingActive = false;
    if (this.geoLocationWatchId != null) {
      navigator.geolocation.clearWatch(this.geoLocationWatchId);
      this.geoLocationWatchId = null;
    }

    const now = new Date();
    const duration = this.trackingStartTime ? now.getTime() - this.trackingStartTime.getTime() - this.trackingPausedTime : 0;

    const distance = this.calculateDistance(this.trackingPoints);
    const bbox = this.calculateBBox(this.trackingPoints);

     const track: TrackedRoute = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      points: [], // <--- ИСПРАВЛЕНО: Заменено на пустой массив, так как переменная 'points' не была объявлена. Если есть данные для точек, укажи их здесь.
      startTime: new Date(),
      endTime: new Date(),
      distance: 0,
      duration: 0,
      bbox: null,
      metadata: {},
      waypoints: [],
    };

    // Save as draft route in offline queue so it persists in offline flow
    try {
      await this.deps.offlineContentQueue.saveDraft?.('route', { id: track.id, track, isTracked: true });
      // notify
      this.deps.notificationService?.notify?.({ type: 'info', title: 'Трек сохранён', message: `Дистанция ${(distance / 1000).toFixed(2)} км` });
      // Gamification: award XP using helper
      await this.awardXPForTrack(track, distance);
    } catch (saveError) {
      console.error('[MapContextFacade] Failed to save draft route, falling back to storage:', saveError instanceof Error ? saveError.message : String(saveError));
      if (this.deps.storageService.saveRoute) { try { this.deps.storageService.saveRoute(track as any); } catch (err) { console.debug('[MapContextFacade] storageService.saveRoute fallback failed:', err); } }
    }

    return track;
  }

  exportTrack(track: TrackedRoute, format: 'gpx' | 'kml' | 'geojson'): Blob {
    if (!this.deps.accessControlService.isPremium()) {
      throw new Error('Export is premium-only');
    }
    if (format === 'geojson') {
      const geojson = this.toGeoJSON(track);
      return new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' });
    }

    if (format === 'gpx') {
      const gpx = this.toGPX(track);
      return new Blob([gpx], { type: 'application/gpx+xml' });
    }

    const kml = this.toKML(track);
    return new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  }

  // --- Tracking helpers ---
  private handlePosition(pos: GeolocationPosition): void {
    if (!this.trackingActive) return;
    const coords = pos.coords;
    // filter by accuracy
    if (coords.accuracy && coords.accuracy > 50) return;

    const point: GeoPoint = { lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy } as any;

    // ignore tiny movements (<5m)
    const last = this.trackingPoints.at(-1);
    if (last) {
      const d = this.haversineDistance([last.lat, last.lon], [point.lat, point.lon]);
      if (d < 5) return;
    }

    this.trackingPoints.push(point);
  }

  private haversineDistance(a: [number, number], b: [number, number]): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  }

  private calculateDistance(points: GeoPoint[]): number {
    if (!points || points.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
      const a: [number, number] = [points[i - 1].lat, points[i - 1].lon];
      const b: [number, number] = [points[i].lat, points[i].lon];
      sum += this.haversineDistance(a, b);
    }
    return sum;
  }

  private calculateBBox(points: GeoPoint[]) {
    if (!points || points.length === 0) return null;
    let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    return { south: minLat, west: minLon, north: maxLat, east: maxLon };
  }

  private estimateAccuracy(points: GeoPoint[]): number {
    if (!points?.length) return 0;
    const acc = points.map((p) => (p as any).accuracy || 0).filter(Boolean);
    if (!acc.length) return 0;
    return Math.round(acc.reduce((a, b) => a + b, 0) / acc.length);
  }

  private toGeoJSON(track: TrackedRoute) {
    return {
      type: 'Feature',
      properties: { id: track.id, startTime: track.startTime, endTime: track.endTime, distance: track.distance },
      geometry: {
        type: 'LineString',
        coordinates: track.points.map((p) => [p.lon, p.lat]),
      },
    };
  }

  private toGPX(track: TrackedRoute): string {
    const header = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoBlog" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><time>${new Date(track.startTime).toISOString()}</time></metadata>`;
    const trkseg = track.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date().toISOString()}</time></trkpt>`).join('\n');
    const footer = `</gpx>`;
    return `${header}\n<trk><name>Tracked route ${track.id}</name><trkseg>\n${trkseg}\n</trkseg></trk>\n${footer}`;
  }

  private toKML(track: TrackedRoute): string {
    const coords = track.points.map((p) => `${p.lon},${p.lat},0`).join(' ');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Track ${track.id}</name><Placemark><LineString><coordinates>${coords}</coordinates></LineString></Placemark></Document></kml>`;
  }

  async downloadRegion(regionId: string): Promise<void> {
    if (!this.deps.accessControlService.isPremium()) {
      throw new Error('Region download is premium-only');
    }
    await this.deps.storageService.downloadRegion?.(regionId);
  }

  getDownloadedRegions(): string[] {
    return this.deps.storageService.getDownloadedRegions?.() ?? [];
  }

  async deleteRegion(regionId: string): Promise<void> {
    await this.deps.storageService.deleteRegion?.(regionId);
  }

  setCenter(coord: [number, number], zoom?: number): void {
    this.currentRenderer?.setView({ lat: coord[0], lon: coord[1] }, zoom ?? 13);
  }

  addMarker(marker: MapMarker): void {
    const category = marker.category ? getCategoryByKey(marker.category) : null;
    const unified: UnifiedMarker = {
      id: marker.id || crypto.randomUUID(),
      name: marker.title || undefined,
      coordinates: { lat: marker.position.lat, lon: marker.position.lon },
      type: marker.type || 'marker',
      shape: marker.type === 'post' ? 'droplet' : 'circle',
      color: category?.color || '#3B82F6',
      icon: category?.icon || 'map-pin',
      size: 'medium',
    };
    this.currentRenderer?.renderMarkers([unified]);
  }

  // --- Facade helpers wrapping Leaflet operations for components that still need low-level access ---
  // These helpers keep Leaflet usage centralized in the facade so components don't import/use Leaflet directly.
  addTileLayer(url: string, options?: any): any {
    try {
      const map: any = this.getMapSafe();
      const L = (window as any).L;
      if (!map || !L) return null;
      const layer = L.tileLayer(url, options || {}).addTo(map);
      return layer;
    } catch (e) {
      console.debug('[MapContextFacade] addTileLayer failed:', e);
      return null;
    }
  }

  setZoomControl(position: string = 'topright'): any {
    try {
      const map: any = this.getMapSafe();
      const L = (window as any).L;
      if (!map || !L) return null;
      const control = L.control.zoom({ position }).addTo(map);
      return control;
    } catch (e) {
      console.debug('[MapContextFacade] setZoomControl failed:', e);
      return null;
    }
  }

  createDivIcon(opts: any): any {
    const L = (window as any).L;
    if (!L) return null;
    return L.divIcon(opts || {});
  }

  createIcon(opts: any): any {
    const L = (window as any).L;
    if (!L) return null;
    return new L.Icon(opts || {});
  }

  createMarker(latlng: [number, number], opts?: any): any {
    try {
      const map: any = this.getMapSafe();
      const L = (window as any).L;
      if (!map || !L) {
        console.debug('[MapContextFacade] createMarker: map=', !!map, 'L=', !!L);
        return null;
      }
      const marker = L.marker(latlng, opts || {}).addTo(map);
      return marker;
    } catch (e) {
      console.debug('[MapContextFacade] createMarker failed:', e);
      return null;
    }
  }

  getMap(): any {
    return this.getMapSafe();
  }

  addLayer(layer: any): void {
    try {
      if (this.currentRenderer?.addLayer) {
        this.currentRenderer.addLayer(layer);
        return;
      }
      const map: any = this.getMapSafe();
      map?.addLayer?.(layer);
    } catch (e) {
      console.debug('[MapContextFacade] addLayer failed:', e);
    }
  }

  removeLayer(layer: any): void {
    try {
      if (this.currentRenderer?.removeLayer) {
        this.currentRenderer.removeLayer(layer);
        return;
      }
      const map: any = this.getMapSafe();
      map?.removeLayer?.(layer);
    } catch (e) {
      console.debug('[MapContextFacade] removeLayer failed:', e);
    }
  }

  project(latlng: [number, number]): { x: number; y: number } {
    try {
      if (this.currentRenderer?.project) {
        return this.currentRenderer.project(latlng as any);
      }
      const map: any = this.getMapSafe();
      if (map?.project) {
        const p = map.project(latlng as any);
        return { x: p?.x ?? 0, y: p?.y ?? 0 };
      }
      if (map?.latLngToContainerPoint) {
        const p = map.latLngToContainerPoint(latlng as any);
        return { x: p?.x ?? 0, y: p?.y ?? 0 };
      }
    } catch (e) {
      console.debug('[MapContextFacade] project failed:', e);
    }
    return { x: 0, y: 0 };
  }

  point(x: number, y: number): any {
    const L = (window as any).L;
    if (!L) return null;
    return L.point(x, y);
  }

  latLng(lat: number, lon: number): any {
    const L = (window as any).L;
    if (!L) return null;
    return L.latLng(lat, lon);
  }

  createPolyline(latlngs: Array<[number, number]>, opts?: any): any {
    try {
      const map: any = this.getMapSafe();
      const L = (window as any).L;
      if (!map || !L) return null;
      const pl = L.polyline(latlngs, opts || {}).addTo(map);
      return pl;
    } catch (e) {
      console.debug('[MapContextFacade] createPolyline failed:', e);
      return null;
    }
  }

  latLngBounds(points: any): any {
    const L = (window as any).L;
    if (!L) return null;
    return L.latLngBounds(points || []);
  }

  createPolygon(latlngs: Array<[number, number]>, opts?: any): any {
    const L = (window as any).L;
    const map: any = this.getMapSafe();
    if (!map || !L) return null;
    return L.polygon(latlngs, opts || {}).addTo(map);
  }

  createCircle(center: [number, number], opts?: any): any {
    const L = (window as any).L;
    const map: any = this.getMapSafe();
    if (!map || !L) return null;
    return L.circle(center, opts || {}).addTo(map);
  }

  // Removed duplicate fitBounds(bounds: any, opts?: any): void { ... }

  createMarkerClusterGroup(opts?: any): any {
    try {
      const L = (window as any).L;
      if (!L || typeof (L as any).markerClusterGroup !== 'function') return null;
      return (L as any).markerClusterGroup(opts || {});
    } catch (e) {
      console.debug('[MapContextFacade] createMarkerClusterGroup failed:', e);
      return null;
    }
  }

  removeMarker(id: string): void {
    try {
      this.currentRenderer?.removeMarker?.(id);
    } catch (err) { console.debug('[MapContextFacade] Failed to remove marker:', err); }
  }

  drawRoute(route: Route): void {
    const persisted: PersistedRoute = {
      id: route.id || crypto.randomUUID(),
      waypoints: route.points.map(p => ({ lat: p.lat, lon: p.lon })),
      geometry: route,
      distance: 0,
      duration: 0,
      createdAt: new Date(),
    };
    this.currentRenderer?.renderRoute(persisted);
  }

  removeRoute(id: string): void {
    try {
      this.currentRenderer?.removeRoute?.(id);
    } catch (err) { console.debug('[MapContextFacade] Failed to remove route:', err); }
  }

  // Clear map overlays/markers without destroying a registered background renderer by default.
  // To fully destroy the renderer and remove registered background API, pass { force: true }.
  clear(opts: { force?: boolean } = {}): void {
    const force = !!opts.force;
    try {
      if (force) {
        try { this.currentRenderer?.destroy?.(); } catch (error_) { console.debug('[MapContextFacade] Error destroying renderer:', error_); }
        this.currentRenderer = null;
        try {
          (this as any).INTERNAL = (this as any).INTERNAL || {};
          (this as any).INTERNAL.api = null;
        } catch (error_) { console.debug('[MapContextFacade] Error clearing INTERNAL api:', error_); }
      } else {
        // Non-forcing clear should only remove dynamic overlays/markers/routes
        try { this.currentRenderer?.clear?.(); } catch (error_) { console.debug('[MapContextFacade] Error clearing renderer:', error_); }
      }
    } catch (e) {
      console.debug('[MapContextFacade] Error in clear():', e);
    }
  }

  getBounds(): Bounds | null {
    try {
      return (this.currentRenderer as any)?.getBounds?.() ?? null;
    } catch {
      return null;
    }
  }

  getCenter(): [number, number] | null {
    try {
      return (this.currentRenderer as any)?.getCenter?.() ?? null;
    } catch {
      return null;
    }
  }

  onClick(handler: (latLng: [number, number]) => void): void {
    this.clickHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onClick) {
        r.onClick((coords: [number, number]) => {
          try { handler(coords); } catch (error_) { console.debug('[MapContextFacade] onClick handler error:', error_); }
        });
      }
    } catch (error_) { console.debug('[MapContextFacade] onClick setup failed:', error_); }
  }

  onRouteGeometry(handler: (coords: Array<[number, number]>) => void): void {
    this.routeGeometryHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onRouteGeometry) {
        r.onRouteGeometry((coords: Array<[number, number]>) => {
          try { handler(coords); } catch (error_) { console.debug('[MapContextFacade] onRouteGeometry handler error:', error_); }
        });
      }
    } catch (error_) { console.debug('[MapContextFacade] onRouteGeometry setup failed:', error_); }
  }

  /**
   * Подписка на событие окончания перемещения карты.
   */
  onMapMove(handler: () => void): void {
    this.moveHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onMapMove) {
        r.onMapMove(() => {
          try { handler(); } catch (error_) { console.debug('[MapContextFacade] onMapMove handler error:', error_); }
        });
      }
    } catch (error_) { console.debug('[MapContextFacade] onMapMove setup failed:', error_); }
  }

  offMapMove(handler: () => void): void {
    try {
      const idx = this.moveHandlers.indexOf(handler);
      if (idx >= 0) this.moveHandlers.splice(idx, 1);
      const r = this.currentRenderer as any;
      if (r?.offMapMove) {
        r.offMapMove(handler);
        return;
      }
      const map: any = this.getMapSafe();
      map?.off?.('move', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] offMapMove failed:', error_); }
  }

  /**
   * Подписка на событие изменения зума.
   */
  onMapZoom(handler: () => void): void {
    this.zoomHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onMapZoom) {
        r.onMapZoom(() => {
          try { handler(); } catch (error_) { console.debug('[MapContextFacade] onMapZoom handler error:', error_); }
        });
      }
    } catch (error_) { console.debug('[MapContextFacade] onMapZoom setup failed:', error_); }
  }

  offMapZoom(handler: () => void): void {
    try {
      const idx = this.zoomHandlers.indexOf(handler);
      if (idx >= 0) this.zoomHandlers.splice(idx, 1);
      const r = this.currentRenderer as any;
      if (r?.offMapZoom) {
        r.offMapZoom(handler);
        return;
      }
      const map: any = this.getMapSafe();
      map?.off?.('zoom', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] offMapZoom failed:', error_); }
  }

  onMapMoveStart(handler: () => void): void {
    this.moveStartHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onMapMoveStart) {
        r.onMapMoveStart(() => {
          try { handler(); } catch (error_) { console.debug('[MapContextFacade] onMapMoveStart handler error:', error_); }
        });
        return;
      }
      const map: any = this.getMapSafe();
      map?.on?.('movestart', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] onMapMoveStart setup failed:', error_); }
  }

  offMapMoveStart(handler: () => void): void {
    try {
      const idx = this.moveStartHandlers.indexOf(handler);
      if (idx >= 0) this.moveStartHandlers.splice(idx, 1);
      const r = this.currentRenderer as any;
      if (r?.offMapMoveStart) {
        r.offMapMoveStart(handler);
        return;
      }
      const map: any = this.getMapSafe();
      map?.off?.('movestart', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] offMapMoveStart failed:', error_); }
  }

  onMapZoomStart(handler: () => void): void {
    this.zoomStartHandlers.push(handler);
    try {
      const r = this.currentRenderer as any;
      if (r?.onMapZoomStart) {
        r.onMapZoomStart(() => {
          try { handler(); } catch (error_) { console.debug('[MapContextFacade] onMapZoomStart handler error:', error_); }
        });
        return;
      }
      const map: any = this.getMapSafe();
      map?.on?.('zoomstart', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] onMapZoomStart setup failed:', error_); }
  }

  offMapZoomStart(handler: () => void): void {
    try {
      const idx = this.zoomStartHandlers.indexOf(handler);
      if (idx >= 0) this.zoomStartHandlers.splice(idx, 1);
      const r = this.currentRenderer as any;
      if (r?.offMapZoomStart) {
        r.offMapZoomStart(handler);
        return;
      }
      const map: any = this.getMapSafe();
      map?.off?.('zoomstart', handler as any);
    } catch (error_) { console.debug('[MapContextFacade] offMapZoomStart failed:', error_); }
  }

  // Fit bounds with an options object to support different providers
  fitBounds(bounds: Bounds, opts?: any): void {
    try {
      (this.currentRenderer as any)?.fitBounds?.(bounds, opts);
    } catch (error_) { console.debug('[MapContextFacade] fitBounds error:', error_); }
  }

  /**
   * Возвращает координаты в пикселях контейнера для переданного latlng используя текущий рендерер
   */
  latLngToContainerPoint(latlng: any): { x: number; y: number } {
    try {
      const map: any = this.getMapSafe();
      if (!map || typeof map.latLngToContainerPoint !== 'function') return { x: 0, y: 0 };
      const pt = map.latLngToContainerPoint(latlng);
      return { x: pt.x, y: pt.y };
    } catch (error_) {
      console.debug('[MapContextFacade] latLngToContainerPoint failed:', error_);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Обновляет внешние метки, безопасно записывая их в INTERNAL.externalMarkers.
   * Рекомендуется вызывать вместо прямого доступа к INTERNAL.
   */
  updateExternalMarkers(markers: any[]): void {
    try {
      (this as any).INTERNAL = (this as any).INTERNAL || {};
      (this as any).INTERNAL.externalMarkers = Array.isArray(markers) ? markers : [];
    } catch (err) {
      console.debug('[MapContextFacade] updateExternalMarkers failed:', err);
    }
  }

  limitBounds(bounds: Bounds): void {
    try {
      (this.currentRenderer as any)?.limitBounds?.(bounds);
    } catch (error_) { console.debug('[MapContextFacade] limitBounds error:', error_); }
  }

  /**
   * Set view to the specified center and zoom. Accepts either GeoPoint or [lat, lon]
   */
  setView(center: GeoPoint | [number, number], zoom?: number): void {
    try {
      const map = this.getMapSafe();
      if (!map) {
        // Map not ready yet — пропускаем вызов, он будет выполнен когда карта будет готова
        console.debug('[MapContextFacade] setView skipped: map not ready');
        return;
      }

      if (Array.isArray(center)) {
        const gp: GeoPoint = { lat: center[0], lon: center[1] };
        (this.currentRenderer as any)?.setView?.(gp, zoom ?? 13);
      } else {
        (this.currentRenderer as any)?.setView?.(center, zoom ?? 13);
      }
    } catch (error_) {
      console.debug('[MapContextFacade] setView error:', error_);
    }
  }

  async getEventsForMap(dateRange: DateRange, bounds?: Bounds): Promise<CalendarEvent[]> {
    return this.deps.eventsStore.getEvents?.(dateRange) ?? [];
  }

  highlightEventOnMap(eventId: string): void {
    try {
      (this.currentRenderer as any)?.highlightEvent?.(eventId);
    } catch (error_) {
      console.debug('[MapContextFacade] highlightEventOnMap failed:', error_);
    }
  }

  async saveOfflineDraft(
    type: 'post' | 'marker' | 'route' | 'event',
    draft: any
  ): Promise<void> {
    await this.deps.offlineContentQueue.saveDraft?.(type, draft);
  }

  async getOfflineDrafts(type?: string): Promise<any[]> {
    return this.deps.offlineContentQueue.getDrafts?.(type) ?? [];
  }

  async syncAllOfflineContent(): Promise<void> {
    await this.deps.offlineContentQueue.syncAll?.();
  }

  async registerGamifiedAction(action: string, metadata?: any): Promise<void> {
    if (this.deps.gamificationFacade.isActionRateLimited?.(action)) {
      throw new Error('Action rate limit exceeded');
    }
    await this.deps.gamificationFacade.recordAction?.(action, metadata);
  }

  trackMapEvent(event: MapAnalyticsEvent): void {
    this.deps.analyticsOrchestrator.trackMapInteraction?.(event);
  }

  getActionButtonsConfig(): MapActionButton[] {
    return [
      { id: 'settings', icon: 'settings', tooltip: 'Настройки карты' },
      { id: 'favorites', icon: 'star', tooltip: 'Избранное', badge: this.getFavorites().length },
      { id: 'legend', icon: 'map', tooltip: 'Легенда' },
      { id: 'add-marker', icon: 'map-pin', tooltip: 'Добавить метку', active: true },
    ];
  }

  setCombinedMode(mode: 'calendar+map' | 'calendar+planner'): void {
    if (mode === 'calendar+map') {
      this.splitScreenState = { left: 'calendar', right: 'osm' };
      this.setActiveContext('osm');
    } else if (mode === 'calendar+planner') {
      this.splitScreenState = { left: 'calendar', right: 'planner' };
      this.setActiveContext('planner');
    }
  }

  // Backwards-compatible initializer used across components
  async initialize(container: HTMLElement | string, cfg?: any): Promise<any> {
    this.initializeContext(cfg);
    this.logInitialization(container, cfg);

    let initResult: any = null;
    if (this.currentRenderer?.init) {
      const containerId = this.resolveContainerId(container);
      initResult = await this.initializeRenderer(containerId, cfg);
    }

    this.setupInternalAPI(initResult);
    this.renderInitialMarkers(cfg);

    return initResult || this;
  }

  private initializeContext(cfg?: any): void {
    const providerToContext: Record<string, MapContext> = {
      yandex: 'planner',
      leaflet: 'osm'
    };
    const context = (cfg?.context) || (cfg?.provider && providerToContext[cfg.provider]) || 'osm';
    try {
      this.setActiveContext(context);
    } catch (error_) {
      console.debug('[MapContextFacade] Ignored error during context init:', error_);
    }
  }

  private logInitialization(container: HTMLElement | string, cfg?: any): void {
    try {
      const id = typeof container === 'string' ? container : (container as any).id || '(no-id)';
      let w = 0, h = 0;
      try {
        const el = typeof container === 'string' ? document.getElementById(container) : (container as any);
        w = el?.offsetWidth || 0;
        h = el?.offsetHeight || 0;
      } catch (error_) { console.debug('[MapContextFacade] logInitialization element read failed:', error_); }
      console.debug?.('[mapFacade] initialize start', { context: cfg?.context, container: id, width: w, height: h });
    } catch (error_) { console.debug('[MapContextFacade] logInitialization failed:', error_); }
  }

  private resolveContainerId(container: HTMLElement | string): string {
    if (typeof container === 'string') return container;
    if ((container as any).id) return (container as any).id;
    (container as any).id = 'map-' + Math.random().toString(36).slice(2, 9);
    return (container as any).id;
  }

  private async initializeRenderer(containerId: string, cfg?: any): Promise<any> {
    try {
        const ctx = this.activeContext;
        const cachedMeta = this.rendererMeta[ctx];
        if (cfg?.preserveState) {
            const internalApi = (this as any).INTERNAL?.api;
            if ((internalApi?.map || internalApi?.mapInstance) && internalApi?.containerId === containerId) {
                return internalApi;
            }
        }
        
        const result = await this.currentRenderer?.init(containerId, cfg);
        
        // Сохраняем containerId в результат для последующей проверки
        if (result) {
            (result as any).containerId = containerId;
            this.rendererMeta[ctx] = { containerId };
        }
        
        // КРИТИЧНО: Сохраняем карту в INTERNAL.api для mapRef
        if (this.currentRenderer) {
            (this as any).INTERNAL = (this as any).INTERNAL || {};
            (this as any).INTERNAL.api = (this as any).INTERNAL.api || {};
            // Пробуем разные пути к карте:
            // 1. renderer.getMap() — основной способ (OSMMapRenderer хранит карту как private mapInstance)
            // 2. renderer.map — для рендереров, которые экспонируют карту напрямую
            let mapInstance = null;
            try {
                if (typeof (this.currentRenderer as any).getMap === 'function') {
                    mapInstance = (this.currentRenderer as any).getMap();
                }
            } catch (e) { /* getMap may throw if not initialized */ }
            if (!mapInstance && (this.currentRenderer as any).map) {
                mapInstance = (this.currentRenderer as any).map;
            }
            if (!mapInstance && (this.currentRenderer as any).mapInstance) {
                mapInstance = (this.currentRenderer as any).mapInstance;
            }
            if (mapInstance) {
                (this as any).INTERNAL.api.map = mapInstance;
                (this as any).INTERNAL.api.mapInstance = mapInstance;
            }
            (this as any).INTERNAL.api.containerId = containerId;
            console.log('[MapContextFacade] Saved map to INTERNAL.api:', !!mapInstance);
        }
        
        return result;
    } catch (error_) {
        console.debug('[MapContextFacade] renderer init failed:', error_);
        return null;
    }
  }

  private setupInternalAPI(initResult: any): void {
    try {
      (this as any).INTERNAL = (this as any).INTERNAL || {};
      (this as any).INTERNAL.api = initResult || (this as any).INTERNAL.api || {};
      this.setupExternalMarkersProperty();
    } catch (error_) {
      console.debug('[MapContextFacade] setupInternalAPI failed:', error_);
    }
  }

  private setupExternalMarkersProperty(): void {
    try {
      const internalObj = (this as any).INTERNAL;
      if (!objectHasOwn(internalObj, 'externalMarkers')) {
        let _externalMarkers: any = internalObj.externalMarkers;
        Object.defineProperty(internalObj, 'externalMarkers', {
          configurable: true,
          enumerable: true,
          get: () => _externalMarkers,
          set: (val: any) => {
            _externalMarkers = val;
            this.renderExternalMarkers(val);
          }
        });
      }
    } catch (err) { console.debug('[MapContextFacade] Error setting up externalMarkers property:', err); }
  }

  private renderExternalMarkers(markers: any): void {
    try {
      const arr = Array.isArray(markers) ? markers.map((m: any) => this.toUnifiedMarker(m)) : [];
      if (this.currentRenderer?.renderMarkers) {
        this.currentRenderer.renderMarkers(arr);
      } else {
        this.pendingExternalMarkers = arr;
      }
    } catch (error_) { console.debug('[MapContextFacade] renderExternalMarkers failed:', error_); }
  }

  private renderInitialMarkers(cfg?: any): void {
    try {
      if (cfg?.markers?.length > 0) {
        this.currentRenderer?.renderMarkers?.(cfg.markers.map((m: any) => this.toUnifiedMarker(m)));
      }
      if (this.pendingExternalMarkers?.length > 0) {
        this.currentRenderer?.renderMarkers?.(this.pendingExternalMarkers);
        this.pendingExternalMarkers = [];
      }
    } catch (error_) { console.debug('[MapContextFacade] renderInitialMarkers failed:', error_); }
  }

  private toUnifiedMarker(m: any) {
    return {
      id: m.id || crypto.randomUUID(),
      name: m.name || m.title,
      coordinates: { lat: m.lat ?? m.latitude, lon: m.lon ?? m.longitude },
      title: m.title || m.name
    };
  }

  private async awardXPForTrack(track: TrackedRoute, distance: number): Promise<void> {
    try {
      const userId = this.deps.userService?.getCurrentUser?.()?.id;
      // Используем динамический import() вместо require() для ESM-совместимости
      const module = await import('../../utils/gamificationHelper');
      if (module.addXPForTrack && userId) {
        await module.addXPForTrack(track.id, { distance, isTracked: true, userId });
      }
    } catch (error_) {
      console.warn('[MapContextFacade] Gamification error:', error_);
    }
  }

  // Compatibility hooks
  onRouteStats(handler: (stats: any) => void): void {
    try {
      const r = this.currentRenderer as any;
      if (r?.onRouteStats) {
        r.onRouteStats(handler);
        return;
      }
    } catch (error_) { console.debug('[MapContextFacade] onRouteStats setup failed:', error_); }
    // otherwise no-op
  }

  // Register an external/background API instance so callers can explicitly
  // hand over a preserved renderer (e.g. persistent Leaflet created by background layer).
  registerBackgroundApi(api: any, containerId?: string): void {
    try {
      (this as any).INTERNAL = (this as any).INTERNAL || {};
      (this as any).INTERNAL.api = api;
      if (containerId) (this as any).INTERNAL.containerId = containerId;
    } catch (error_) { console.debug('[MapContextFacade] registerBackgroundApi failed:', error_); }
  }

  getRegisteredApi(): any {
    return (this as any).INTERNAL?.api ?? null;
  }
}
