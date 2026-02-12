import type { IMapRenderer, MapConfig, UnifiedMarker, PersistedRoute, GeoPoint, LatLng } from '../IMapRenderer';
import type { DomainGeoPoint, PolylineStyle, IMapObjectHandle } from '../types';
import L from 'leaflet';

export class OSMMapRenderer implements IMapRenderer {
  clear?(): void {
    throw new Error('Method not implemented.');
  }
  removeMarker?(id: string): void {
    throw new Error('Method not implemented.');
  }
  removeRoute?(id: string): void {
    throw new Error('Method not implemented.');
  }
  setZoomControl?(position?: string) {
    throw new Error('Method not implemented.');
  }
  createDivIcon?(opts?: any) {
    throw new Error('Method not implemented.');
  }
  createIcon?(opts?: any) {
    throw new Error('Method not implemented.');
  }
  createMarker?(latlng: any, opts?: any) {
    throw new Error('Method not implemented.');
  }
  point?(x: number, y: number) {
    throw new Error('Method not implemented.');
  }
  latLng?(lat: number, lon: number) {
    throw new Error('Method not implemented.');
  }
  createPolyline?(points: DomainGeoPoint[], style?: PolylineStyle): IMapObjectHandle {
    const id = 'polyline-' + Math.random().toString(36).slice(2, 9);
    if (!this.mapInstance) {
      return { id, remove: () => {} };
    }
    const polyline = L.polyline(points as Array<[number, number]>, style || {}).addTo(this.mapInstance);
    return {
      id,
      remove: () => {
        try { this.mapInstance?.removeLayer(polyline); } catch (e) {}
      }
    };
  }
  latLngBounds?(points: any) {
    throw new Error('Method not implemented.');
  }
  createPolygon?(latlngs: Array<[number, number]>, opts?: any) {
    throw new Error('Method not implemented.');
  }
  createCircle?(center: [number, number], opts?: any) {
    throw new Error('Method not implemented.');
  }
  fitBounds?(bounds: any, opts?: any): void {
    throw new Error('Method not implemented.');
  }
  createMarkerClusterGroup?(opts?: any) {
    throw new Error('Method not implemented.');
  }
  latLngToContainerPoint?(latlng: any): { x: number; y: number; } {
    try {
      if (!this.mapInstance) return { x: 0, y: 0 };
      const pt = (this.mapInstance as any).latLngToContainerPoint?.(latlng as any);
      return { x: pt?.x ?? 0, y: pt?.y ?? 0 };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }
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

    // Если на контейнере уже есть предыдущая инициализация Leaflet — очищаем её
    try {
      // Попытка достать сохранённый инстанс (если предыдущий destroy не сработал)
      const existingMap = (container as any).__leafletMap;
      if (existingMap && typeof existingMap.remove === 'function') {
        try {
          existingMap.remove();
        } catch (e) {
          console.warn('[OSMMapRenderer] Failed to remove existing map instance on container:', e);
        }
      }
      // Удаляем возможные флаги Leaflet у контейнера, чтобы L.map не ругался
      try { delete (container as any)._leaflet_id; } catch (e) {}
      try { delete (container as any).__leafletMap; } catch (e) {}
    } catch (e) {
      // best-effort
    }

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

    // Сохраняем ссылку на созданную карту на контейнере для последующего корректного удаления
    try { (this.mapInstance.getContainer() as any).__leafletMap = this.mapInstance; } catch (e) {}

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
  public addTileLayer(url?: string, options?: L.TileLayerOptions): L.TileLayer {
    if (!this.mapInstance) {
      throw new Error('Карта не инициализирована');
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
   * Подписка на перемещение карты.
   */
  public onMapMove(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('move', handler);
  }

  /**
   * Подписка на изменение зума.
   */
  public onMapZoom(handler: (e: L.LeafletEvent) => void): void {
    if (!this.mapInstance) return;
    this.mapInstance.on('zoom', handler);
  }

  public getMap(): L.Map | null {
    return this.mapInstance;
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

  getZoom?(): number {
    try {
      return this.mapInstance?.getZoom?.() ?? 0;
    } catch (e) {
      return 0;
    }
  }

  addLayer?(layer: any): void {
    try { this.mapInstance?.addLayer?.(layer); } catch (e) {}
  }

  removeLayer?(layer: any): void {
    try { this.mapInstance?.removeLayer?.(layer); } catch (e) {}
  }

  project?(latlng: LatLng): { x: number; y: number } {
    try {
      if (!this.mapInstance) return { x: 0, y: 0 };
      const point = (this.mapInstance as any).project?.(latlng);
      if (point && typeof point.x === 'number' && typeof point.y === 'number') return { x: point.x, y: point.y };
      const pt = (this.mapInstance as any).latLngToContainerPoint?.(latlng as any);
      return { x: pt?.x ?? 0, y: pt?.y ?? 0 };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }


  destroy(): void {
    if (this.mapInstance) {
      try {
        const container = this.mapInstance.getContainer();
        if (container) {
          // Удаляем возможную ссылку и флаги Leaflet
          try { delete (container as any).__leafletMap; } catch (e) {}
          try { delete (container as any)._leaflet_id; } catch (e) {}
        }
        this.mapInstance.remove();
        this.mapInstance = null;
        this.leafletMarkers = {};
      } catch (e) {
        console.warn('[OSMMapRenderer] Error destroying map:', e);
      }
    } else {
      // Если mapInstance уже null, но контейнер мог иметь флаги Leaflet — пытаемся их удалить
      const container = this.containerId ? document.getElementById(this.containerId) : null;
      if (container) {
        try { delete (container as any).__leafletMap; } catch (e) {}
        try { delete (container as any)._leaflet_id; } catch (e) {}
      }
    }
    console.log('[OSMMapRenderer] Destroyed');
  }
}