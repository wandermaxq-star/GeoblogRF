/**
 * OfflineOSMRenderer — рендерер офлайн-карт на базе Leaflet.
 *
 * Использует тайлы, раздаваемые бэкендом из MBTiles файлов:
 *   /api/tiles/{tileset}/{z}/{x}/{y}
 *
 * Поддерживает:
 *  - Инициализацию с указанием тайлсета и fallback на онлайн OSM
 *  - Рендеринг маркеров и маршрутов (идентично OSMMapRenderer)
 *  - Переключение тайлсетов на лету
 *  - Отображение границ покрытия офлайн-тайлов
 */

import type {
  IMapRenderer,
  MapConfig,
  UnifiedMarker,
  PersistedRoute,
  GeoPoint,
  LatLng,
} from '../IMapRenderer';
import type { DomainGeoPoint, PolylineStyle, IMapObjectHandle } from '../types';
import L from 'leaflet';

/** Расширенный конфиг для офлайн-рендерера */
export interface OfflineMapConfig extends MapConfig {
  /** Имя тайлсета (без .mbtiles), например 'vla' или 'vlacity' */
  tileset?: string;
  /** Базовый URL API (по умолчанию '' — через Vite proxy) */
  apiBase?: string;
  /** Показывать онлайн-слой как fallback для отсутствующих тайлов */
  onlineFallback?: boolean;
  /** Показывать границу покрытия офлайн-тайлов */
  showBoundsOverlay?: boolean;
}

export class OfflineOSMRenderer implements IMapRenderer {
  private containerId: string | null = null;
  private mapInstance: L.Map | null = null;
  private leafletMarkers: Record<string, L.Marker> = {};
  private routeLayers: Record<string, L.Polyline> = {};
  private offlineTileLayer: L.TileLayer | null = null;
  private onlineTileLayer: L.TileLayer | null = null;
  private boundsOverlay: L.Rectangle | null = null;

  private currentTileset: string = 'test-raster';
  private apiBase: string = '';

  // ========================
  // Инициализация
  // ========================

  public async init(containerId: string, config?: OfflineMapConfig): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`[OfflineOSMRenderer] Элемент с id "${containerId}" не найден`);
    }

    this.containerId = containerId;
    this.apiBase = config?.apiBase ?? '';
    this.currentTileset = config?.tileset ?? 'test-raster';

    // Очистка предыдущей инициализации
    this.cleanupContainer(container);

    // Определяем центр карты
    let lat: number, lon: number;
    const center = config?.center;

    if (Array.isArray(center)) {
      lat = center[0];
      lon = center[1];
    } else if (center && typeof center === 'object') {
      lat = center.lat;
      lon = center.lon;
    } else {
      // Владимирская область по умолчанию (тестовый регион)
      lat = 56.13;
      lon = 40.41;
    }

    const zoom = config?.zoom ?? 10;

    this.mapInstance = L.map(containerId, {
      center: [lat, lon],
      zoom,
      zoomControl: true,
    });

    // Сохраняем ссылку
    try {
      (this.mapInstance.getContainer() as any).__leafletMap = this.mapInstance;
    } catch (_) {}

    // Онлайн-слой (нижний, fallback для отсутствующих тайлов)
    if (config?.onlineFallback !== false) {
      this.onlineTileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          opacity: 0.3, // Менее яркий, чтобы офлайн-тайлы были основными
        }
      ).addTo(this.mapInstance);
    }

    // Офлайн-слой (основной, поверх)
    this.offlineTileLayer = L.tileLayer(
      `${this.apiBase}/api/tiles/${this.currentTileset}/{z}/{x}/{y}.png`,
      {
        attribution: `© OpenStreetMap contributors | Офлайн: ${this.currentTileset}`,
        maxZoom: 18,
        errorTileUrl: '', // Не показывать broken image
      }
    ).addTo(this.mapInstance);

    // Загружаем метаданные тайлсета и показываем границу покрытия
    if (config?.showBoundsOverlay !== false) {
      this.loadAndShowBounds();
    }

    // Корректное отображение после монтирования
    setTimeout(() => {
      this.invalidateSize();
    }, 100);
  }

  // ========================
  // Управление тайлсетами
  // ========================

  /** Переключить на другой тайлсет */
  public switchTileset(tileset: string): void {
    if (!this.mapInstance) return;

    this.currentTileset = tileset;

    // Удаляем старый офлайн-слой
    if (this.offlineTileLayer) {
      this.mapInstance.removeLayer(this.offlineTileLayer);
    }

    // Создаём новый
    this.offlineTileLayer = L.tileLayer(
      `${this.apiBase}/api/tiles/${tileset}/{z}/{x}/{y}.png`,
      {
        attribution: `© OpenStreetMap contributors | Офлайн: ${tileset}`,
        maxZoom: 18,
        errorTileUrl: '',
      }
    ).addTo(this.mapInstance);

    // Обновляем границы
    this.loadAndShowBounds();

    console.log(`[OfflineOSMRenderer] Переключен на тайлсет: ${tileset}`);
  }

  /** Получить текущий тайлсет */
  public getCurrentTileset(): string {
    return this.currentTileset;
  }

  // ========================
  // Работа с метаданными и границами
  // ========================

  private async loadAndShowBounds(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/api/tiles/${this.currentTileset}/metadata`);
      if (!res.ok) return;

      const meta = await res.json();

      // Удаляем старый overlay
      if (this.boundsOverlay && this.mapInstance) {
        this.mapInstance.removeLayer(this.boundsOverlay);
        this.boundsOverlay = null;
      }

      if (meta.bounds && Array.isArray(meta.bounds) && meta.bounds.length === 4) {
        const [west, south, east, north] = meta.bounds;
        const bounds = L.latLngBounds(
          [south, west], // southwest
          [north, east]  // northeast
        );

        if (this.mapInstance) {
          // Полупрозрачная рамка показывающая зону покрытия
          this.boundsOverlay = L.rectangle(bounds, {
            color: '#2563eb',
            weight: 2,
            fillOpacity: 0.05,
            dashArray: '8, 4',
            interactive: false,
          }).addTo(this.mapInstance);

          // Подгоняем вид карты под покрытие
          this.mapInstance.fitBounds(bounds, { padding: [20, 20] });
        }
      }
    } catch (err) {
      console.warn('[OfflineOSMRenderer] Не удалось загрузить метаданные тайлсета:', err);
    }
  }

  // ========================
  // Утилиты карты
  // ========================

  public invalidateSize(): void {
    if (!this.mapInstance) return;
    this.mapInstance.invalidateSize();
  }

  public getMap(): L.Map | null {
    return this.mapInstance;
  }

  public getZoom(): number {
    try {
      return this.mapInstance?.getZoom?.() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  public getCenter(): DomainGeoPoint {
    try {
      const c = this.mapInstance?.getCenter();
      if (c) return [c.lat, c.lng];
    } catch (_) {}
    return [0, 0];
  }

  public setCenter(center: DomainGeoPoint, zoom?: number): void {
    if (!this.mapInstance) return;
    try {
      this.mapInstance.setView([center[0], center[1]], zoom ?? this.getZoom());
    } catch (_) {}
  }

  // ========================
  // Управление видом
  // ========================

  public setView(center: GeoPoint | LatLng, zoom: number): void {
    if (!this.mapInstance) return;
    try {
      if (Array.isArray(center)) {
        this.mapInstance.setView([center[0], center[1]], zoom);
      } else {
        this.mapInstance.setView([center.lat, center.lon], zoom);
      }
    } catch (e) {
      console.warn('[OfflineOSMRenderer] Failed to set view:', e);
    }
  }

  public flyTo(center: LatLng, zoom?: number, options?: any): void {
    if (!this.mapInstance) return;
    try {
      this.mapInstance.flyTo(center, zoom, options);
    } catch (_) {}
  }

  public setBounds(bounds: any, options?: any): void {
    if (!this.mapInstance) return;
    try {
      this.mapInstance.fitBounds(bounds, options);
    } catch (_) {}
  }

  // ========================
  // Рендеринг маркеров
  // ========================

  public renderMarkers(markers: UnifiedMarker[]): void {
    if (!this.mapInstance) {
      console.warn('[OfflineOSMRenderer] Map not initialized, cannot render markers');
      return;
    }

    const newIds = new Set(markers.map(m => m.id));

    // Удаляем маркеры, которых больше нет
    Object.keys(this.leafletMarkers).forEach(id => {
      if (!newIds.has(id)) {
        this.mapInstance!.removeLayer(this.leafletMarkers[id]);
        delete this.leafletMarkers[id];
      }
    });

    // Добавляем новые маркеры
    markers.forEach(marker => {
      if (!this.leafletMarkers[marker.id]) {
        const leafletMarker = L.marker(
          [marker.coordinates.lat, marker.coordinates.lon],
          { title: marker.title || marker.name || '' }
        );

        // Popup с информацией
        if (marker.title || marker.description) {
          let popupHtml = '';
          if (marker.title) popupHtml += `<strong>${marker.title}</strong>`;
          if (marker.description) popupHtml += `<br/>${marker.description}`;
          leafletMarker.bindPopup(popupHtml);
        }

        leafletMarker.addTo(this.mapInstance!);
        this.leafletMarkers[marker.id] = leafletMarker;
      }
    });
  }

  public removeMarker(id: string): void {
    if (this.leafletMarkers[id] && this.mapInstance) {
      this.mapInstance.removeLayer(this.leafletMarkers[id]);
      delete this.leafletMarkers[id];
    }
  }

  // ========================
  // Рендеринг маршрутов
  // ========================

  public renderRoute(route: PersistedRoute): void {
    if (!this.mapInstance) {
      console.warn('[OfflineOSMRenderer] Map not initialized, cannot render route');
      return;
    }

    // Удаляем старый, если есть
    if (this.routeLayers[route.id]) {
      this.mapInstance.removeLayer(this.routeLayers[route.id]);
    }

    const latLngs: L.LatLngExpression[] = route.waypoints.map(p => [p.lat, p.lon] as L.LatLngExpression);
    if (latLngs.length < 2) return;

    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.8,
    }).addTo(this.mapInstance);

    this.routeLayers[route.id] = polyline;

    // Подгоняем вид карты под маршрут
    this.mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }

  public removeRoute(id: string): void {
    if (this.routeLayers[id] && this.mapInstance) {
      this.mapInstance.removeLayer(this.routeLayers[id]);
      delete this.routeLayers[id];
    }
  }

  // ========================
  // Полилинии (для фасада)
  // ========================

  public createPolyline(points: DomainGeoPoint[], style?: PolylineStyle): IMapObjectHandle {
    const id = 'polyline-' + Math.random().toString(36).slice(2, 9);
    if (!this.mapInstance) {
      return { id, remove: () => {} };
    }
    const polyline = L.polyline(points as Array<[number, number]>, style || {}).addTo(this.mapInstance);
    return {
      id,
      remove: () => {
        try {
          this.mapInstance?.removeLayer(polyline);
        } catch (_) {}
      },
    };
  }

  // ========================
  // Слои
  // ========================

  public addTileLayer(url?: string, options?: L.TileLayerOptions): L.TileLayer {
    if (!this.mapInstance) {
      throw new Error('[OfflineOSMRenderer] Карта не инициализирована');
    }
    const tileUrl = url || `${this.apiBase}/api/tiles/${this.currentTileset}/{z}/{x}/{y}.png`;
    return L.tileLayer(tileUrl, options || { maxZoom: 18 }).addTo(this.mapInstance);
  }

  public addLayer(layer: any): void {
    try {
      this.mapInstance?.addLayer?.(layer);
    } catch (_) {}
  }

  public removeLayer(layer: any): void {
    try {
      this.mapInstance?.removeLayer?.(layer);
    } catch (_) {}
  }

  public eachLayer(fn: (layer: any) => void): void {
    try {
      this.mapInstance?.eachLayer?.(fn);
    } catch (_) {}
  }

  // ========================
  // Координатные утилиты
  // ========================

  public project(latlng: LatLng): { x: number; y: number } {
    try {
      if (!this.mapInstance) return { x: 0, y: 0 };
      const pt = (this.mapInstance as any).latLngToContainerPoint?.(latlng as any);
      return { x: pt?.x ?? 0, y: pt?.y ?? 0 };
    } catch (_) {
      return { x: 0, y: 0 };
    }
  }

  public unproject(point: { x: number; y: number }, zoom?: number): LatLng {
    try {
      if (!this.mapInstance) return [0, 0];
      const z = zoom ?? this.mapInstance.getZoom();
      const ll = this.mapInstance.unproject([point.x, point.y], z);
      return [ll.lat, ll.lng];
    } catch (_) {
      return [0, 0];
    }
  }

  public getSize(): { x: number; y: number } {
    try {
      const size = this.mapInstance?.getSize();
      return size ? { x: size.x, y: size.y } : { x: 0, y: 0 };
    } catch (_) {
      return { x: 0, y: 0 };
    }
  }

  // ========================
  // События карты
  // ========================

  public on(event: string, handler: (...args: any[]) => void): void {
    try {
      this.mapInstance?.on(event, handler);
    } catch (_) {}
  }

  public off(event: string, handler: (...args: any[]) => void): void {
    try {
      this.mapInstance?.off(event, handler);
    } catch (_) {}
  }

  public onMapClick(handler: (e: any) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('click', handler);
  }

  public onMapMove(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('move', handler);
  }

  public offMapMove(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('move', handler);
  }

  public onMapZoom(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('zoom', handler);
  }

  public offMapZoom(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('zoom', handler);
  }

  public onMapMoveStart(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('movestart', handler);
  }

  public offMapMoveStart(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('movestart', handler);
  }

  public onMapZoomStart(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('zoomstart', handler);
  }

  public offMapZoomStart(handler: () => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('zoomstart', handler);
  }

  // ========================
  // Очистка
  // ========================

  public clear(): void {
    if (!this.mapInstance) return;

    // Удаляем все маркеры
    Object.values(this.leafletMarkers).forEach(m => {
      try { this.mapInstance!.removeLayer(m); } catch (_) {}
    });
    this.leafletMarkers = {};

    // Удаляем все маршруты
    Object.values(this.routeLayers).forEach(r => {
      try { this.mapInstance!.removeLayer(r); } catch (_) {}
    });
    this.routeLayers = {};
  }

  public destroy(): void {
    if (this.mapInstance) {
      try {
        const container = this.mapInstance.getContainer();
        if (container) {
          try { delete (container as any).__leafletMap; } catch (_) {}
          try { delete (container as any)._leaflet_id; } catch (_) {}
        }
        this.mapInstance.remove();
      } catch (e) {
        console.warn('[OfflineOSMRenderer] Error destroying map:', e);
      }
    } else {
      const container = this.containerId ? document.getElementById(this.containerId) : null;
      if (container) {
        try { delete (container as any).__leafletMap; } catch (_) {}
        try { delete (container as any)._leaflet_id; } catch (_) {}
      }
    }

    this.mapInstance = null;
    this.leafletMarkers = {};
    this.routeLayers = {};
    this.offlineTileLayer = null;
    this.onlineTileLayer = null;
    this.boundsOverlay = null;

    console.log('[OfflineOSMRenderer] Destroyed');
  }

  // ========================
  // Приватные утилиты
  // ========================

  private cleanupContainer(container: HTMLElement): void {
    try {
      const existingMap = (container as any).__leafletMap;
      if (existingMap && typeof existingMap.remove === 'function') {
        try { existingMap.remove(); } catch (_) {}
      }
      try { delete (container as any)._leaflet_id; } catch (_) {}
      try { delete (container as any).__leafletMap; } catch (_) {}
    } catch (_) {}
  }
}
