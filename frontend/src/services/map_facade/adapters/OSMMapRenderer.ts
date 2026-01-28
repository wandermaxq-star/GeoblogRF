import type { IMapRenderer, MapConfig, UnifiedMarker, PersistedRoute, GeoPoint } from '../IMapRenderer';

export class OSMMapRenderer implements IMapRenderer {
  private containerId: string | null = null;
  private map: any = null;

  async init(containerId: string, config?: MapConfig): Promise<void> {
    this.containerId = containerId;
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) {
      console.error(`Map container not found: ${containerId}`);
      throw new Error(`Container not found: ${containerId}`);
    }

    // КРИТИЧНО: Проверяем что контейнер в документе
    if (!document.body.contains(container)) {
      console.error('[OSMMapRenderer] Container is not in document');
      throw new Error('Container is not in document');
    }

    try {
      // КРИТИЧНО: Ждем пока контейнер получит валидные размеры
      let attempts = 0;
      const maxAttempts = 100; // 10 секунд
      while ((container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.error('[OSMMapRenderer] Container has zero dimensions after waiting', { attempts, width: container.offsetWidth, height: container.offsetHeight });
        throw new Error(`Container has zero dimensions after ${attempts} attempts`);
      }

      // КРИТИЧНО: Если в контейнере уже есть старая карта - уничтожаем её перед созданием новой
      if ((container as any).__leafletMap) {
        try {
          (container as any).__leafletMap.remove();
        } catch (e) {
          // ignore
        }
      }

      // Import Leaflet dynamically
      const L = (window as any).L;
      if (!L || !L.map) {
        console.error('Leaflet library not loaded');
        throw new Error('Leaflet library not loaded');
      }

      // Create Leaflet map
      const centerLat = ((config?.center as any)?.[0] as number) || 55.7558;
      const centerLon = ((config?.center as any)?.[1] as number) || 37.6176;
      console.log('[OSMMapRenderer] Creating map with container size:', { width: container.offsetWidth, height: container.offsetHeight });
      this.map = L.map(container).setView(
        [centerLat, centerLon],
        config?.zoom || 6
      );

      // Сохраняем ссылку на карту для последующей проверки
      (container as any).__leafletMap = this.map;

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // КРИТИЧНО: Пересчитываем размер карты после инициализации
      // Это гарантирует что тайлы загрузятся правильно
      setTimeout(() => {
        try {
          this.map.invalidateSize();
          console.log('[OSMMapRenderer] Map size invalidated successfully');
        } catch (e) {
          console.warn('[OSMMapRenderer] Failed to invalidate size:', e);
        }
      }, 100);

      // Дополнительная проверка размера через 500ms для медленных DOM-операций
      setTimeout(() => {
        try {
          if (this.map && container.offsetWidth > 0 && container.offsetHeight > 0) {
            this.map.invalidateSize();
            console.log('[OSMMapRenderer] Final size invalidation completed');
          }
        } catch (e) {
          console.warn('[OSMMapRenderer] Failed final size invalidation:', e);
        }
      }, 500);

      console.log('[OSMMapRenderer] Leaflet map initialized successfully');
      return this.map;
    } catch (error) {
      console.error('[OSMMapRenderer] Failed to initialize Leaflet map:', error);
      throw error;
    }
  }

  private leafletMarkers: Record<string, any> = {};

  renderMarkers(markers: UnifiedMarker[]): void {
    if (!this.map) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot render markers');
      return;
    }
    // Удаляем старые маркеры, которых нет в новом списке
    const newIds = new Set(markers.map(m => m.id));
    Object.keys(this.leafletMarkers).forEach(id => {
      if (!newIds.has(id)) {
        this.map.removeLayer(this.leafletMarkers[id]);
        delete this.leafletMarkers[id];
      }
    });

    // Добавляем новые маркеры
    markers.forEach(marker => {
      if (!this.leafletMarkers[marker.id]) {
        const L = (window as any).L;
        if (!L) return;
        const leafletMarker = L.marker([marker.coordinates.lat, marker.coordinates.lon], {
          title: marker.title || marker.name || '',
        });
        leafletMarker.addTo(this.map);
        this.leafletMarkers[marker.id] = leafletMarker;
      }
    });
    console.log(`[OSMMapRenderer] Rendering ${markers.length} markers`);
  }

  renderRoute(route: PersistedRoute): void {
    if (!this.map) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot render route');
      return;
    }
    console.log(`[OSMMapRenderer] Rendering route ${route.id}`);
    // Implementation would add route polyline to Leaflet map
  }

  setView(center: GeoPoint, zoom: number): void {
    if (!this.map) {
      console.warn('[OSMMapRenderer] Map not initialized, cannot set view');
      return;
    }
    try {
      this.map.setView([center.lat, center.lon], zoom);
    } catch (e) {
      console.warn('[OSMMapRenderer] Failed to set view:', e);
    }
  }

  destroy(): void {
    if (this.map) {
      try {
        // Очищаем ссылку из контейнера перед уничтожением
        const container = this.map.getContainer();
        if (container && (container as any).__leafletMap) {
          delete (container as any).__leafletMap;
        }
        this.map.remove();
        this.map = null;
      } catch (e) {
        console.warn('[OSMMapRenderer] Error destroying map:', e);
      }
    }
    console.log('[OSMMapRenderer] Destroyed');
  }
}
