// services/projectManager.ts
// Централизованный сервис управления проектом и картой

import { mapFacade } from './map_facade';
import type { MapConfig } from './map_facade';
import { markerService } from '../services/markerService';
import { Bounds } from '../hooks/useLazyMarkers';
import { MarkerData } from '../types/marker';

class ProjectManager {
  private static instance: ProjectManager;
  private initialized = false;
  private markers: MarkerData[] = [];
  private lazyMode = false;
  private mapInitialized = false;
  private mapContainer: HTMLElement | null = null;
  private mapConfig: MapConfig | null = null;
  private mapApi: any = null;

  private constructor() { }

  static getInstance() {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  async initializeProject(options?: { lazyMode?: boolean; bounds?: Bounds; mapContainer?: HTMLElement; mapConfig?: MapConfig }) {
    if (this.initialized) return;
    this.lazyMode = !!options?.lazyMode;
    if (options?.mapContainer && options?.mapConfig) {
      await this.initializeMap(options.mapContainer, options.mapConfig);
    } else if (!this.mapInitialized) {
      throw new Error('Map must be initialized with container and config at least once');
    }
    if (this.lazyMode && options?.bounds) {
      await this.loadMarkersLazy(options.bounds);
    } else {
      await this.loadAllMarkers();
    }
    this.initialized = true;
  }

  async initializeMap(container: HTMLElement, config: MapConfig) {
    // КРИТИЧНО: Проверяем что контейнер ещё в DOM. Если нет — нужна реинициализация.
    const containerInDom = this.mapContainer && this.mapContainer.isConnected;
    if (this.mapInitialized && this.mapContainer === container && containerInDom) return this.mapApi;
    this.mapContainer = container;
    this.mapConfig = config;
    this.mapApi = await mapFacade().initialize(container, config);
    this.mapInitialized = true;
    return this.mapApi;
  }

  getMapApi() {
    return this.mapApi;
  }

  async reinitializeMap(container?: HTMLElement, config?: MapConfig) {
    // Принудительная переинициализация карты
    if (container && config) {
      this.mapContainer = container;
      this.mapConfig = config;
    }
    if (!this.mapContainer || !this.mapConfig) throw new Error('No container/config for reinit');
    this.mapApi = await mapFacade().initialize(this.mapContainer, this.mapConfig);
    this.mapInitialized = true;
    return this.mapApi;
  }

  async loadAllMarkers() {
    this.markers = await markerService.getAllMarkers();
    return this.markers;
  }

  async loadMarkersLazy(bounds: Bounds) {
    // Предполагается, что markerService поддерживает ленивую загрузку по границам
    this.markers = await markerService.getMarkersByBounds(bounds);
    return this.markers;
  }

  getMarkers() {
    return this.markers;
  }

  isInitialized() {
    return this.initialized;
  }

  setMapInitialized(val: boolean) {
    this.mapInitialized = val;
  }

  reset() {
    this.initialized = false;
    this.mapInitialized = false;
    this.mapApi = null;
    this.mapContainer = null;
    this.mapConfig = null;
    this.markers = [];
  }

  // Управление margin карты при двухоконном режиме
  setMapMargin(rightMargin: number) {
    try {
      // Для Leaflet карты используем panBy для смещения видимой области
      if (this.mapApi && typeof this.mapApi.panBy === 'function') {
        // Смещаем карту вправо на половину правой полосы
        const offsetX = Math.floor(rightMargin * 0.5);
        this.mapApi.panBy([offsetX, 0], { animate: false, duration: 0 });
      }
    } catch (e) {
      console.warn('[ProjectManager] Failed to set map margin:', e);
    }
  }

  resetMapMargin() {
    try {
      // Возвращаем карту на нормальный центр
      if (this.mapApi && typeof this.mapApi.panBy === 'function') {
        const mapContainer = this.mapContainer;
        if (mapContainer) {
          const offsetX = Math.floor(mapContainer.offsetWidth * 0.25);
          this.mapApi.panBy([-offsetX, 0], { animate: false, duration: 0 });
        }
      }
    } catch (e) {
      console.warn('[ProjectManager] Failed to reset map margin:', e);
    }
  }

  // Можно добавить методы для управления состоянием проекта, картой, маршрутами и т.д.
}

export const projectManager = ProjectManager.getInstance();
