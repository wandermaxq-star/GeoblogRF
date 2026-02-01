import type { IMapRenderer, MapConfig, UnifiedMarker, PersistedRoute, GeoPoint, LatLng } from '../IMapRenderer';
import L from 'leaflet';

export class OSMMapRenderer implements IMapRenderer {
  private containerId: string | null = null; 
  private mapInstance: L.Map | null = null;
  private leafletMarkers: Record<string, L.Marker> = {};

  // Соответствует интерфейсу IMapRenderer
  public async init(containerId: string, config?: MapConfig): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Элемент с id "${containerId}" не найден`);
    }

    this.containerId = containerId;

    // Используем координаты из config или значения по умолчанию
    const center = config?.center;
    let lat: number, lon: number;

    if (Array.isArray(center)) {
      // LatLng: [lat, lng]
      lat = center[0];
      lon = center[1];
    } else if (center && typeof center === 'object') {
      // GeoPoint: { lat, lon }
      lat = center.lat;
      lon = center.lon;
    } else {
      // Москва по умолчанию
      lat = 55.7558;
      lon = 37.6176;
    }

    const zoom = config?.zoom ?? 10;

    this.mapInstance = L.map(containerId, {
      center: [lat, lon],
      zoom,
      zoomControl: true,
    });

    // Используем публичный метод для добавления слоя по умолчанию
    this.addTileLayer();

    // Небольшая задержка для корректного отображения (опционально)
    setTimeout(() => {
      this.invalidateSize();
    }, 100);
  }

  /**
   * Добавляет слой тайлов на карту. Публичный метод для фасада.
   */
  public addTileLayer(url?: string, options?: L.TileLayerOptions): L.TileLayer | null {
    if (!this.mapInstance) {
      console.warn('[OSMMapRenderer] addTileLayer called but map is not initialized');
      return null;
    }
    const tileUrl = url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileOpts = options || {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    };
    return L.tileLayer(tileUrl, tileOpts).addTo(this.mapInstance);
  }

  /**
   * Обновляет размер карты (полезно при изменении размеров контейнера).
   */
  public invalidateSize(): void {
    if (!this.mapInstance) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot invalidate size');
      return;
    }
    this.mapInstance.invalidateSize();
  }

  /**
   * Подписка на клик по карте.
   */
  public onMapClick(handler: (e: L.LeafletMouseEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('click', handler);
  }

  /**
   * Подписка на завершение перемещения карты (moveend вместо move).
   */
  public onMapMove(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('moveend', handler);
  }

  public offMapMove(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('moveend', handler);
  }

  /**
   * Подписка на завершение изменения зума (zoomend вместо zoom).
   */
  public onMapZoom(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('zoomend', handler);
  }

  public offMapZoom(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('zoomend', handler);
  }

  /**
   * Подписка на начало перемещения карты (movestart).
   */
  public onMapMoveStart(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('movestart', handler);
  }

  public offMapMoveStart(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('movestart', handler);
  }

  /**
   * Подписка на начало изменения зума (zoomstart).
   */
  public onMapZoomStart(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('zoomstart', handler);
  }

  public offMapZoomStart(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.off('zoomstart', handler);
  }

  public getMap(): L.Map | null {
    if (!this.mapInstance) {
      // Не выбрасываем ошибку — фасад и компоненты ожидают `null`/`undefined` когда карта ещё не готова
      console.warn('[OSMMapRenderer] getMap called but map is not initialized');
      return null;
    }
    return this.mapInstance;
  }

  /**
   * Анимированно перелететь к позиции
   */
  public flyTo(center: LatLng, zoom?: number, options?: any): void {
    if (!this.mapInstance) return;
    try { this.mapInstance.flyTo(center, zoom, options); } catch (e) { console.debug('[OSMMapRenderer] flyTo failed:', e); }
  }

  renderMarkers(markers: UnifiedMarker[]): void {
    if (!this.mapInstance) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot render markers');
      return;
    }

    const newIds = new Set(markers.map(m => m.id));
    Object.keys(this.leafletMarkers).forEach(id => {
      if (!newIds.has(id)) {
        this.mapInstance!.removeLayer(this.leafletMarkers[id]);
        delete this.leafletMarkers[id];
      }
    });

    markers.forEach(marker => {
      if (!this.leafletMarkers[marker.id]) {
        const leafletMarker = L.marker([marker.coordinates.lat, marker.coordinates.lon], {
          title: marker.title || marker.name || '',
        });
        leafletMarker.addTo(this.mapInstance!);
        this.leafletMarkers[marker.id] = leafletMarker;
      }
    });

    console.log(`[OSMMapRenderer] Rendering ${markers.length} markers`);
  }

  renderRoute(route: PersistedRoute): void {
    if (!this.mapInstance) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot render route');
      return;
    }
    console.log(`[OSMMapRenderer] Rendering route ${route.id}`);
    // Реализация отрисовки маршрута (полилиния и т.д.)
  }

  setView(center: GeoPoint | LatLng, zoom: number): void {
    if (!this.mapInstance) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot set view');
      return;
    }
    try {
      if (Array.isArray(center)) {
        this.mapInstance.setView([center[0], center[1]], zoom);
      } else {
        this.mapInstance.setView([center.lat, center.lon], zoom);
      }
    } catch (e) {
      console.warn('[OSMMapRenderer] Failed to set view:', e);
    }
  }

  // Проектирование latlng в точку контейнера
  project(latlng: LatLng): { x: number; y: number } {
    if (!this.mapInstance) return { x: 0, y: 0 };
    try {
      const p = this.mapInstance.project([latlng[0], latlng[1]]);
      return { x: p.x, y: p.y };
    } catch (e) {
      console.debug('[OSMMapRenderer] project failed:', e);
      return { x: 0, y: 0 };
    }
  }

  // Обратное проектирование точки в latlng
  unproject(point: { x: number; y: number }, zoom?: number): LatLng {
    if (!this.mapInstance) return [0, 0];
    try {
      const ll = this.mapInstance.unproject(L.point(point.x, point.y), zoom);
      return [ll.lat, ll.lng];
    } catch (e) {
      console.debug('[OSMMapRenderer] unproject failed:', e);
      return [0, 0];
    }
  }

  getSize(): { x: number; y: number } {
    if (!this.mapInstance) return { x: 0, y: 0 };
    try {
      const s = this.mapInstance.getSize();
      return { x: s.x, y: s.y };
    } catch (e) {
      console.debug('[OSMMapRenderer] getSize failed:', e);
      return { x: 0, y: 0 };
    }
  }

  getZoom(): number {
    if (!this.mapInstance) return 0;
    try {
      return this.mapInstance.getZoom();
    } catch (e) {
      console.debug('[OSMMapRenderer] getZoom failed:', e);
      return 0;
    }
  }

  eachLayer(fn: (layer: L.Layer) => void): void {
    if (!this.mapInstance) return;
    try { this.mapInstance.eachLayer(fn); } catch (e) { console.debug('[OSMMapRenderer] eachLayer failed:', e); }
  }

  removeLayer(layer: L.Layer): void {
    if (!this.mapInstance) return;
    try { this.mapInstance.removeLayer(layer); } catch (e) { console.debug('[OSMMapRenderer] removeLayer failed:', e); }
  }
  destroy(): void {
    if (this.mapInstance) {
      try {
        const container = this.mapInstance.getContainer();
        if (container) {
          // Удаляем возможную ссылку
          delete (container as any).__leafletMap;
        }
        this.mapInstance.remove();
        this.mapInstance = null;
        this.leafletMarkers = {};
      } catch (e) {
        console.warn('[OSMMapRenderer] Error destroying map:', e);
      }
    }
    console.log('[OSMMapRenderer] Destroyed');
  }
}