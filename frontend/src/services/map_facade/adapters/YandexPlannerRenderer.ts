import type { IMapRenderer, MapConfig, UnifiedMarker, PersistedRoute, GeoPoint } from '../IMapRenderer';
import type { DomainGeoPoint, PolylineStyle, IMapObjectHandle, DomainGeoBounds } from '../types';
import { yandexMapsService } from '../../yandexMapsService';

export class YandexPlannerRenderer implements IMapRenderer {
  /** Маркер, позволяющий MapContextFacade отличить этот рендерер от OSM-рендерера.
   *  При активном YandexPlannerRenderer внешние маркеры map.tsx (externalMarkers)
   *  не должны прокидываться сюда — у планировщика своё управление метками. */
  readonly isYandexPlanner = true;

  private map: any = null;
  private markersCollection: any = null;
  // Поддержка множественных маршрутов: ключ = id маршрута, значение = объект на карте
  private routeObjects: Map<string, any> = new Map();
  private currentMultiRoute: any = null;
  private currentRouteEditor: any = null;
  private currentEditedRouteId: string | null = null;
  private currentRouteEditorMode: 'none' | 'addMidPoints' = 'none';
  private routeEditorEventHandlers: Array<{ target: any; event: string; handler: (...args: any[]) => void }> = [];
  private routeGeometryHandler: ((coords: Array<[number, number]>) => void) | null = null;
  private clickHandlers: Array<(coords: [number, number]) => void> = [];

  // Полилинии, добавленные через фасад
  private polylines: Map<string, any> = new Map();

  // Альтернативные маршруты (показываются вместе для сравнения)
  private altPolylines: Map<string, any> = new Map();
  private altLabels: Map<string, any> = new Map();

  // Хранение пользовательских обработчиков, чтобы можно было отписаться
  // Key format: `${event}::${handlerId}` where handlerId is assigned to the handler function
  private eventHandlerWrappers: Map<string, (...args: any[]) => void> = new Map();
  private handlerIdCounter = 0;

  // Слои/объекты, добавленные вручную
  private customLayers: any[] = [];

  async init(containerId: string | HTMLElement, config?: MapConfig): Promise<any> {
    // Сбрасываем обработчики кликов, чтобы при повторной инициализации
    // не накапливались дубли из предыдущего mount-цикла
    this.clickHandlers = [];
    // Ensure ymaps is loaded
    await yandexMapsService.init();
    const ymaps = (window as any).ymaps;
    const center = (config && config.center && Array.isArray(config.center)) ? (config.center as [number, number]) : [55.7558, 37.6176];
    const zoom = config?.zoom ?? 10;

    // Получаем контейнер - может быть строкой (ID) или HTMLElement
    let container: HTMLElement | string;
    if (typeof containerId === 'string') {
      container = containerId;
    } else if (containerId instanceof HTMLElement) {
      // Если передан HTMLElement, используем его ID или создаем временный ID
      if (!containerId.id) {
        containerId.id = `yandex-map-${Date.now()}`;
      }
      container = containerId.id;
    } else {
      throw new Error('Invalid container: must be string ID or HTMLElement');
    }

    // Ждем, пока контейнер будет иметь валидные размеры
    const containerEl = typeof container === 'string' ? document.getElementById(container) : container;
    if (containerEl) {
      let attempts = 0;
      while ((containerEl.offsetWidth === 0 || containerEl.offsetHeight === 0) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }

    // КРИТИЧНО: Если в контейнере уже есть старая карта - уничтожаем её перед созданием новой
    if (containerEl && (containerEl as any).__yandexMap) {
      try {
        (containerEl as any).__yandexMap.destroy();
      } catch (e) {
        // ignore
      }
    }

    // Create map instance
    this.map = new ymaps.Map(container, { center, zoom });
    // Ensure basic behaviors are enabled (drag, scroll zoom, multiTouch)
    try {
      if (this.map && this.map.behaviors) {
        ['drag','scrollZoom','multiTouch','dblClickZoom'].forEach(b => {
          try { this.map.behaviors.enable(b); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) { /* ignore */ }

    // Добавляем нативные контролы Yandex Maps для Planner
    let yandexTypeSelector: any = null;
    let yandexLayerControl: any = null;
    try {
      if (ymaps.control && ymaps.control.TypeSelector) {
        yandexTypeSelector = this.map.controls.add(new ymaps.control.TypeSelector({ float: 'right' }));
      }
      if (ymaps.control && ymaps.control.TrafficControl) {
        this.map.controls.add(new ymaps.control.TrafficControl({ float: 'right' }));
      }
      if (ymaps.control && ymaps.control.LayerControl) {
        yandexLayerControl = this.map.controls.add(new ymaps.control.LayerControl({ float: 'right' }));
      }
    } catch (e) {
      console.warn('[YandexPlannerRenderer] Failed to add native Yandex controls:', e);
    }

    // Сохраняем ссылку на карту и родные контролы для последующей проверки
    if (containerEl) {
      (containerEl as any).__yandexMap = this.map;
      if (yandexTypeSelector) {
        (containerEl as any).__yandexTypeSelector = yandexTypeSelector;
      }
      if (yandexLayerControl) {
        (containerEl as any).__yandexLayerControl = yandexLayerControl;
      }
    }

    this.markersCollection = new ymaps.GeoObjectCollection();
    this.map.geoObjects.add(this.markersCollection);

    // Обработка изменения размеров контейнера
    if (containerEl) {
      const resizeObserver = new ResizeObserver(() => {
        if (this.map) {
          try {
            this.map.container.fitToViewport();
          } catch (e) {
            // Игнорируем ошибки при изменении размеров
          }
        }
      });
      resizeObserver.observe(containerEl);
      // Сохраняем observer для очистки при destroy
      (this as any).resizeObserver = resizeObserver;
    }

    // If config contains initial markers, render them
    try {
      if (config && Array.isArray((config as any).markers) && (config as any).markers.length > 0) {
        this.renderMarkers((config as any).markers.map((m: any) => ({
          id: m.id || crypto.randomUUID(),
          coordinates: { lat: m.lat ?? m.latitude, lon: m.lon ?? m.longitude },
          title: m.title || m.name
        })));
      }
    } catch (e) { /* ignore */ }

    // Attach a single click listener that forwards to stored handlers
    try {
      this.map.events.add('click', (e: any) => {
        const c = e.get('coords');
        if (c && Array.isArray(c)) {
          this.clickHandlers.forEach(h => {
            try { h([c[0], c[1]]); } catch (err) { /* ignore */ }
          });
        }
      });
    } catch (e) { /* ignore */ }

    // Return minimal API so facade can expose it via INTERNAL.api
    const api = {
      map: this.map,
      clear: this.clear.bind(this),
      renderMarkers: this.renderMarkers.bind(this),
      renderRoute: this.renderRoute.bind(this),
      removeRoute: this.removeRoute.bind(this),
      clearAllRoutes: this.clearAllRoutes.bind(this),
      // Мультимаршруты: альтернативы в стиле Google Maps
      renderAlternatives: this.renderAlternatives.bind(this),
      clearAlternatives: this.clearAlternatives.bind(this),
      createRouteEditor: this.createRouteEditor.bind(this),
      setRouteEditorMode: this.setRouteEditorMode.bind(this),
      getEditedRouteGeometry: this.getEditedRouteGeometry.bind(this),
      removeRouteEditor: this.removeRouteEditor.bind(this),
      clearRoutesExceptEditor: this.clearRoutesExceptEditor.bind(this),
      onClick: this.onClick.bind(this),
      onRouteGeometry: (h: (coords: Array<[number, number]>) => void) => { this.routeGeometryHandler = h; },
      // Методы для двухоконного режима
      setMapMargin: this.setMapMargin.bind(this),
      resetMapMargin: this.resetMapMargin.bind(this),
    };

    return api;
  }

  renderMarkers(markers: UnifiedMarker[]): void {
    if (!this.map) return;
    try {
      console.log('[YandexPlannerRenderer] renderMarkers called with', markers.length, 'markers');
      this.markersCollection.removeAll();
      markers.forEach(m => {
        const lat = (m.coordinates && (m.coordinates as any).lat) ?? (m as any).lat;
        const lon = (m.coordinates && (m.coordinates as any).lon) ?? (m as any).lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        // Определяем цвет капли в зависимости от типа маркера
        // Категории planner: favorite, event, map-click, coordinates, address, saved-route, route-point
        let markerColor = '#3B82F6'; // синий по умолчанию
        if (m.category === 'favorite') {
          markerColor = '#F59E0B'; // оранжевый для избранного
        } else if (m.category === 'event') {
          markerColor = '#7C3AED'; // фиолетовый для событий
        } else if (m.category === 'map-click') {
          markerColor = '#3B82F6'; // синий клика по карте
        } else if (m.category === 'coordinates') {
          markerColor = '#10B981'; // зелёный пункта по координатам
        } else if (m.category === 'address') {
          markerColor = '#EF4444'; // красный - введённый адрес
        } else if (m.category === 'saved-route') {
          markerColor = '#000000'; // чёрный — точки сохранённого маршрута
        } else if (m.category === 'route-point') {
          markerColor = '#6366F1'; // фиолетово-синий для точки маршрута
        } else if (m.color) {
          markerColor = m.color;
        }

        // SVG маркер в форме капли с заданным цветом и номером
        const markerNum = (m as any).number;
        const numText = markerNum != null ? String(markerNum) : '';
        const fontSize = numText.length > 1 ? 9 : 11;
        const svgMarker = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
          <path d="M16 1C8.268 1 2 7.268 2 15c0 8.5 14 27 14 27s14-18.5 14-27C30 7.268 23.732 1 16 1z"
                fill="${markerColor}" stroke="white" stroke-width="1.5"/>
          <circle cx="16" cy="14" r="9" fill="white"/>
          ${numText ? `<text x="16" y="14" text-anchor="middle" dominant-baseline="central" fill="${markerColor}" font-size="${fontSize}" font-weight="bold" font-family="Arial,sans-serif">${numText}</text>` : ''}
        </svg>`;

        // Кодируем SVG в data URI через encodeURIComponent (поддержка Unicode)
        const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarker)}`;
        // btoa не используем — кириллица в future-proof URI безопаснее

        const placemark = new (window as any).ymaps.Placemark(
          [lat, lon],
          { balloonContent: m.title || '' },
          {
            iconLayout: 'default#image',
            iconImageHref: svgDataUri,
            iconImageSize: [32, 42],
            iconImageOffset: [-16, -42],
            hideIconOnBalloonOpen: false,
          }
        );
        this.markersCollection.add(placemark);
      });
    } catch (e) {
      console.warn('[YandexPlannerRenderer] renderMarkers error:', e);
    }
  }

  // Удаляет конкретный маршрут по id
  removeRoute(routeId: string): void {
    if (!this.map) return;
    if (routeId && routeId === this.currentEditedRouteId) {
      this.removeRouteEditor();
      return;
    }
    const existing = this.routeObjects.get(routeId);
    if (existing) {
      try { this.map.geoObjects.remove(existing); } catch { /* ignore */ }
      this.routeObjects.delete(routeId);
    }
  }

  // Удаляет ВСЕ маршруты (safety net — на случай если id-ы не совпали)
  clearAllRoutes(): void {
    if (!this.map) return;
    this.removeRouteEditor();
    for (const [id, obj] of this.routeObjects.entries()) {
      try { this.map.geoObjects.remove(obj); } catch { /* ignore */ }
      this.routeObjects.delete(id);
    }
  }

  private extractMultiRouteCoordinates(multiRoute: any): Array<[number, number]> {
    if (!multiRoute || !multiRoute.model) return [];

    try {
      const active = multiRoute.model.getRoutes?.()?.get?.(0) ?? multiRoute.getActiveRoute?.();
      if (!active) return [];

      const paths = active.getPaths?.();
      if (!paths || paths.getLength?.() === 0) return [];

      const coords: Array<[number, number]> = [];
      for (let pathIndex = 0; pathIndex < paths.getLength(); pathIndex += 1) {
        const path = paths.get(pathIndex);
        const segments = path?.getSegments?.() || [];
        segments.forEach((seg: any) => {
          const raw = seg?.geometry?.getCoordinates?.() || [];
          this.addRouteCoords(coords, raw);
        });
      }
      return coords;
    } catch (e) {
      return [];
    }
  }

  private addRouteCoords(coords: Array<[number, number]>, raw: any): void {
    if (!raw) return;

    if (Array.isArray(raw)) {
      raw.forEach((item: any) => this.addRouteCoords(coords, item));
      return;
    }

    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.coordinates)) {
        this.addRouteCoords(coords, raw.coordinates);
      } else if (Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
        const lat = Number(raw[0]);
        const lon = Number(raw[1]);
        coords.push([lat, lon]);
      }
    }
  }

  private buildRouteReferencePoints(route: PersistedRoute): Array<[number, number]> {
    const points: Array<[number, number]> = [];

    const pushPoint = (lat?: number, lon?: number) => {
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push([lat!, lon!]);
      }
    };

    const addRawPoint = (raw: any) => {
      if (Array.isArray(raw)) {
        if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
          pushPoint(Number(raw[0]), Number(raw[1]));
        } else {
          raw.forEach((item: any) => addRawPoint(item));
        }
      } else if (raw && typeof raw === 'object') {
        if (Number.isFinite(Number(raw.lat)) && Number.isFinite(Number(raw.lon))) {
          pushPoint(Number(raw.lat), Number(raw.lon));
        } else if (Array.isArray((raw as any).coordinates)) {
          addRawPoint((raw as any).coordinates);
        }
      }
    };

    if (Array.isArray(route.waypoints) && route.waypoints.length >= 2) {
      route.waypoints.forEach((w: any) => pushPoint(Number(w.lat), Number(w.lon)));
    }

    if (points.length < 2 && route.geometry) {
      addRawPoint(route.geometry);
    }

    if (points.length < 2 && Array.isArray((route as any).points) && (route as any).points.length >= 2) {
      addRawPoint((route as any).points);
    }

    return points;
  }

  async createRouteEditor(route: PersistedRoute, options?: { addMidPoints?: boolean }): Promise<boolean> {
    if (!this.map) {
      console.warn('[YandexPlannerRenderer] Map not initialized');
      return false;
    }
    
    const ymaps = (window as any).ymaps;
    
    // Диагностика доступности модулей
    console.log('[YandexPlannerRenderer] Checking Yandex Maps modules...');
    console.log('[YandexPlannerRenderer] ymaps available:', !!ymaps);
    console.log('[YandexPlannerRenderer] multiRouter available:', !!ymaps?.multiRouter);
    console.log('[YandexPlannerRenderer] editor available:', !!ymaps?.multiRouter?.editor);
    console.log('[YandexPlannerRenderer] MultiRoute available:', !!ymaps?.multiRouter?.MultiRoute);
    
    if (!ymaps) {
      console.warn('[YandexPlannerRenderer] ymaps is not loaded at all');
      return false;
    }
    
    // Ensure required modules are loaded
    if (!ymaps.multiRouter) {
      console.warn('[YandexPlannerRenderer] multiRouter module not loaded. Attempting to load...');
      try {
        await ymaps.load('multiRouter');
        console.log('[YandexPlannerRenderer] multiRouter module loaded successfully');
      } catch (error) {
        console.error('[YandexPlannerRenderer] Failed to load multiRouter module:', error);
        return false;
      }
    }
    
    if (!ymaps.multiRouter.MultiRoute) {
      console.warn('[YandexPlannerRenderer] MultiRoute class not available. Please check API configuration.');
      return false;
    }
    
    if (!ymaps.multiRouter.editor) {
      console.warn('[YandexPlannerRenderer] editor class not available after loading multiRouter. Retrying module load...');
      try {
        await ymaps.load('multiRouter');
        console.log('[YandexPlannerRenderer] Retried loading multiRouter module');
      } catch (error) {
        console.error('[YandexPlannerRenderer] Failed to retry loading multiRouter module:', error);
      }
    }

    if (!ymaps.multiRouter.editor) {
      console.warn('[YandexPlannerRenderer] editor class still not available after retry. Please check API configuration. Available multiRouter keys:', Object.keys(ymaps.multiRouter || {}));
      return false;
    }

    console.log('[YandexPlannerRenderer] All required modules are available, proceeding with editor creation');

    const referencePoints = this.buildRouteReferencePoints(route);
    if (referencePoints.length < 2) {
      console.warn('[YandexPlannerRenderer] createRouteEditor failed: insufficient reference points');
      return false;
    }

    this.removeRouteEditor();

    const routeId = (route as any).id || `editor-route-${Date.now()}`;
    const multiRoute = new ymaps.multiRouter.MultiRoute(
      { referencePoints },
      {
        routingMode: 'auto',
        boundsAutoApply: true,
        wayPointDraggable: true,
        viaPointDraggable: true,
        routeActiveStrokeColor: '#3b78e7',
        routeActiveStrokeWidth: 5,
        routeStrokeColor: '#3b78e7',
        routeStrokeWidth: 4,
        routeActiveStrokeOpacity: 0.92,
        routeStrokeOpacity: 0.65,
        viaPointVisible: true,
      }
    );

    this.map.geoObjects.add(multiRoute);
    this.routeObjects.set(routeId, multiRoute);
    this.currentMultiRoute = multiRoute;
    this.currentEditedRouteId = routeId;

    const editor = new ymaps.multiRouter.editor(multiRoute);
    this.currentRouteEditor = editor;
    this.currentRouteEditorMode = options?.addMidPoints ? 'addMidPoints' : 'none';

    if (options?.addMidPoints) {
      try {
        editor.state.set('addMidPoints', true);
      } catch (e) {
        console.warn('[YandexPlannerRenderer] Failed to enable addMidPoints:', e);
      }
    }

    const handleRequestSuccess = () => {
      if (options?.addMidPoints) {
        try {
          editor.state.set('addMidPoints', true);
        } catch (e) {
          console.warn('[YandexPlannerRenderer] Failed to enable addMidPoints after requestsuccess:', e);
        }
      }

      const geometry = this.extractMultiRouteCoordinates(multiRoute);
      if (geometry.length >= 2 && this.routeGeometryHandler) {
        try { this.routeGeometryHandler(geometry); } catch (e) { /* ignore */ }
      }
    };

    multiRoute.model.events.add('requestsuccess', handleRequestSuccess);
    multiRoute.model.events.add('update', handleRequestSuccess);
    this.routeEditorEventHandlers.push({ target: multiRoute.model.events, event: 'requestsuccess', handler: handleRequestSuccess });
    this.routeEditorEventHandlers.push({ target: multiRoute.model.events, event: 'update', handler: handleRequestSuccess });
    return true;
  }

  setRouteEditorMode(mode: 'addMidPoints' | 'none'): void {
    this.currentRouteEditorMode = mode;
    if (!this.currentRouteEditor) return;
    try {
      const enabled = mode === 'addMidPoints';
      this.currentRouteEditor.state.set('addMidPoints', enabled);
    } catch (e) {
      console.warn('[YandexPlannerRenderer] setRouteEditorMode failed:', e);
    }
  }

  getEditedRouteGeometry(): Array<[number, number]> | null {
    if (!this.currentMultiRoute) return null;
    const geometry = this.extractMultiRouteCoordinates(this.currentMultiRoute);
    return geometry.length >= 2 ? geometry : null;
  }

  removeRouteEditor(): void {
    if (this.currentRouteEditor) {
      try {
        this.currentRouteEditor.state.set('addMidPoints', false);
      } catch {
        // ignore
      }
      this.currentRouteEditor = null;
      this.currentRouteEditorMode = 'none';
    }

    if (this.currentMultiRoute) {
      try {
        this.map.geoObjects.remove(this.currentMultiRoute);
      } catch {
        // ignore
      }
      if (this.currentEditedRouteId) {
        this.routeObjects.delete(this.currentEditedRouteId);
      }
      this.currentMultiRoute = null;
      this.currentEditedRouteId = null;
    }

    this.routeEditorEventHandlers.forEach(({ target, event, handler }) => {
      try { target.remove(event, handler); } catch { /* ignore */ }
    });
    this.routeEditorEventHandlers = [];
  }

  clearRoutesExceptEditor(): void {
    if (!this.map) return;
    const keepId = this.currentEditedRouteId;
    const idsToRemove: string[] = [];
    for (const id of this.routeObjects.keys()) {
      if (id !== keepId) {
        idsToRemove.push(id);
      }
    }
    idsToRemove.forEach(id => {
      const obj = this.routeObjects.get(id);
      if (!obj) return;
      try { this.map.geoObjects.remove(obj); } catch { /* ignore */ }
      this.routeObjects.delete(id);
    });
  }

  // Удаляет все объекты альтернативных маршрутов с карты
  clearAlternatives(): void {
    for (const obj of this.altPolylines.values()) {
      try { this.map?.geoObjects.remove(obj); } catch { /* ignore */ }
    }
    for (const obj of this.altLabels.values()) {
      try { this.map?.geoObjects.remove(obj); } catch { /* ignore */ }
    }
    this.altPolylines.clear();
    this.altLabels.clear();
  }

  /**
   * Отрисовывает 2-3 альтернативных маршрута одновременно.
   * Выбранный (isSelected=true) отображается ярко, остальные — полупрозрачно.
   * Клик по полилинии вызывает onSelect(id).
   * Подписи маршрутов рендерятся через React-компонент в Planner.tsx (не на карте).
   */
  renderAlternatives(
    alts: Array<{
      id: string;
      label: string;
      hint: string;
      icon: string;
      colorActive: string;
      polyline: [number, number][];
      distanceKm: number;
      durationMin: number;
      isSelected: boolean;
    }>,
    onSelect: (id: string) => void
  ): void {
    if (!this.map) return;
    const ymaps = (window as any).ymaps;
    if (!ymaps) return;

    this.clearAlternatives();
    if (alts.length === 0) return;

    // Рисуем сначала неактивные маршруты (z-index ниже), потом активный сверху
    const sorted = [...alts].sort((a, b) => (a.isSelected ? 1 : 0) - (b.isSelected ? 1 : 0));

    for (const alt of sorted) {
      const { id, colorActive, polyline, isSelected } = alt;
      const opacity = isSelected ? 0.92 : 0.30;
      const width = isSelected ? 7 : 4;

      const poly = new ymaps.Polyline(
        polyline,
        {},
        {
          strokeColor: colorActive,
          strokeWidth: width,
          strokeOpacity: opacity,
          zIndex: isSelected ? 10 : 5,
        }
      );
      poly.events.add('click', () => onSelect(id));
      this.map.geoObjects.add(poly);
      this.altPolylines.set(id, poly);
    }

    // Подгоняем карту под все альтернативы
    try {
      const allLats = alts.flatMap(a => a.polyline.map(([lat]) => lat));
      const allLons = alts.flatMap(a => a.polyline.map(([, lon]) => lon));
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...allLats), Math.min(...allLons)],
        [Math.max(...allLats), Math.max(...allLons)],
      ];
      this.fitBounds(bounds, { checkZoomRange: true, zoomMargin: 80 });
    } catch { /* ignore */ }
  }

  async renderRoute(route: PersistedRoute): Promise<void> {
    if (!this.map) return;
    try {
      // Удаляем предыдущую версию ЭТОГО маршрута (не всех!)
      const routeId = (route as any).id || 'default';
      const existing = this.routeObjects.get(routeId);
      if (existing) {
        try { this.map.geoObjects.remove(existing); } catch { /* ignore */ }
        this.routeObjects.delete(routeId);
      }

      const ymaps = (window as any).ymaps;

      // Собираем waypoints из различных форматов данных маршрута
      let waypoints: Array<[number, number]> = [];
      if (route.waypoints && Array.isArray(route.waypoints)) {
        waypoints = route.waypoints.map((w: any) => [w.lat, w.lon]);
      } else if ((route as any).points && Array.isArray((route as any).points)) {
        waypoints = (route as any).points.map((p: any) => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lon]);
      }

      // Геометрия маршрута: подходит любой массив >= 2 точек
      const geometry: Array<[number, number]> | null = 
        (route.geometry && Array.isArray(route.geometry) && route.geometry.length >= 2)
          ? route.geometry as Array<[number, number]>
          : null;

      console.log('[YandexPlannerRenderer] renderRoute:', {
        routeId,
        waypointCount: waypoints.length,
        waypoints,
        geometryAvailable: !!geometry,
        geometryLength: geometry?.length ?? 0
      });

      // Рисуем ТОЛЬКО дорожную геометрию (от Яндекс/ORS).
      // Без геометрии — не рисовать вообще: прямые линии между точками не нужны.
      if (!geometry || geometry.length < 2) {
        console.log('[YandexPlannerRenderer] No road geometry yet — skipping render');
        return;
      }

      const lineCoords = geometry as Array<[number, number]>;
      const color = (route as any).color || '#2196F3';

      const polyline = new ymaps.Polyline(
        lineCoords,
        {},
        {
          strokeWidth: 4,
          strokeColor: color,
          strokeOpacity: 0.85,
        }
      );
      this.map.geoObjects.add(polyline);
      this.routeObjects.set(routeId, polyline);

      if (this.routeGeometryHandler) {
        try { this.routeGeometryHandler(lineCoords); } catch (e) { /* ignore */ }
      }
      console.log('[YandexPlannerRenderer] Route polyline drawn, points:', lineCoords.length);
    } catch (e) {
      console.error('[YandexPlannerRenderer] renderRoute error:', e);
    }
  }

  setView(center: GeoPoint, zoom: number): void {
    if (!this.map) return;
    try { this.map.setCenter([center.lat, center.lon], zoom); } catch (e) { /* ignore */ }
  }

  /**
   * Устанавливает margin для двухоконного режима
   * В двухоконном режиме правая панель занимает 50% экрана,
   * поэтому добавляем отступ справа, чтобы центр карты был в центре левой половины
   * @param rightMargin - отступ справа в пикселях (обычно 50% ширины экрана)
   */
  setMapMargin(rightMargin: number): void {
    if (!this.map) return;
    try {
      // Yandex Maps margin: [top, right, bottom, left]
      this.map.margin.setDefaultMargin([0, rightMargin, 0, 0]);
    } catch (e) {
      // Игнорируем ошибки - margin может не поддерживаться в некоторых версиях
      console.warn('[YandexPlannerRenderer] Failed to set map margin:', e);
    }
  }

  /**
   * Сбрасывает margin карты
   */
  resetMapMargin(): void {
    if (!this.map) return;
    try {
      this.map.margin.setDefaultMargin([0, 0, 0, 0]);
    } catch (e) {
      // ignore
    }
  }

  // Дополнительные фасадные методы
  setCenter(center: DomainGeoPoint, zoom?: number): void {
    if (!this.map) return;
    try { this.map.setCenter([center[0], center[1]], zoom); } catch (e) { /* ignore */ }
  }

  getCenter(): DomainGeoPoint {
    if (!this.map) return [0, 0];
    try {
      const c = this.map.getCenter();
      return [c[0], c[1]];
    } catch (e) {
      return [0, 0];
    }
  }

  setBounds(bounds: DomainGeoBounds, options?: any): void {
    if (!this.map) return;
    try {
      let southWest: DomainGeoPoint | null = null;
      let northEast: DomainGeoPoint | null = null;
      if (Array.isArray(bounds)) {
        southWest = bounds[0];
        northEast = bounds[1];
      } else if ((bounds as any).southWest && (bounds as any).northEast) {
        southWest = (bounds as any).southWest;
        northEast = (bounds as any).northEast;
      }
      if (southWest && northEast) {
        // Yandex Maps API 2.1 использует [latitude, longitude] везде, как и setCenter
        const yandexBounds: [[number, number], [number, number]] = [
          [southWest[0], southWest[1]],
          [northEast[0], northEast[1]]
        ];
        try { this.map.setBounds(yandexBounds, options || { checkZoomRange: true }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  fitBounds(bounds: DomainGeoBounds, options?: any): void {
    this.setBounds(bounds, { checkZoomRange: true, ...options });
  }

  createPolyline(points: DomainGeoPoint[], style?: PolylineStyle): IMapObjectHandle {
    if (!this.map) return { id: 'noop', remove: () => {} };
    try {
      const ymaps = (window as any).ymaps;
      const yandexPoints = points.map(p => [p[1], p[0]]);
      const polyline = new ymaps.Polyline(yandexPoints, {}, {
        strokeColor: style?.color || '#2196F3',
        strokeWidth: style?.weight ?? 4,
        opacity: style?.opacity ?? 0.8
      });
      this.map.geoObjects.add(polyline);
      const id = `poly-${crypto.randomUUID()}`;
      this.polylines.set(id, polyline);
      return {
        id,
        remove: () => {
          try {
            const obj = this.polylines.get(id);
            if (obj && this.map) {
              this.map.geoObjects.remove(obj);
            }
            this.polylines.delete(id);
          } catch (e) { /* ignore */ }
        }
      };
    } catch (e) {
      return { id: 'error', remove: () => {} };
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.map) return;
    try {
      const handlerId = (handler as any).__handlerId ?? (((handler as any).__handlerId = ++this.handlerIdCounter));
      const key = `${event}::${handlerId}`;
      const wrapper = (...args: any[]) => { try { handler(...args); } catch (e) { /* ignore */ } };
      this.map.events.add(event, wrapper);
      this.eventHandlerWrappers.set(key, wrapper);
    } catch (e) { /* ignore */ }
  }

  off(event: string, handler: (...args: any[]) => void): void {
    if (!this.map) return;
    try {
      const handlerId = (handler as any).__handlerId;
      const key = handlerId ? `${event}::${handlerId}` : null;
      const wrapper = key ? this.eventHandlerWrappers.get(key) : undefined;
      if (wrapper) {
        this.map.events.remove(event, wrapper);
        if (key) this.eventHandlerWrappers.delete(key);
      } else {
        try { this.map.events.remove(event, handler); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  addLayer(layer: any): void {
    if (!this.map) return;
    try {
      this.map.geoObjects.add(layer);
      this.customLayers.push(layer);
    } catch (e) { /* ignore */ }
  }

  removeLayer(layer: any): void {
    if (!this.map) return;
    try {
      this.map.geoObjects.remove(layer);
      const idx = this.customLayers.indexOf(layer);
      if (idx >= 0) this.customLayers.splice(idx, 1);
    } catch (e) { /* ignore */ }
  }

  getMap(): unknown {
    return this.map;
  }

  enableBehavior(id: string): void {
    if (!this.map || !this.map.behaviors) return;
    try { this.map.behaviors.enable(id); } catch (e) { /* ignore */ }
  }

  disableBehavior(id: string): void {
    if (!this.map || !this.map.behaviors) return;
    try { this.map.behaviors.disable(id); } catch (e) { /* ignore */ }
  }

  clear(): void {
    if (!this.map) return;
    this.removeRouteEditor();
    try { this.map.geoObjects.removeAll(); } catch (e) { /* ignore */ }
    // Очищаем ссылки на удалённые маршруты
    this.routeObjects.clear();
    // Пересоздаём коллекцию маркеров, т.к. removeAll удалила её с карты
    try {
      this.markersCollection = new (window as any).ymaps.GeoObjectCollection();
      this.map.geoObjects.add(this.markersCollection);
    } catch (e) { /* ignore */ }
  }

  destroy(): void {
    try {
      // Очищаем ResizeObserver если был создан
      const resizeObserver = (this as any).resizeObserver;
      if (resizeObserver) {
        resizeObserver.disconnect();
        (this as any).resizeObserver = null;
      }
      this.removeRouteEditor();
      if (this.map) {
        // Очищаем ссылку из контейнера перед уничтожением
        const container = this.map.container.getElement();
        if (container && (container as any).__yandexMap) {
          delete (container as any).__yandexMap;
        }
        // Удаляем пользовательские слои/объекты
        this.customLayers.forEach(l => { try { this.map.geoObjects.remove(l); } catch (e) { /* ignore */ } });
        // Удаляем маршруты
        this.routeObjects.forEach(r => { try { this.map.geoObjects.remove(r); } catch (e) { /* ignore */ } });
        // Удаляем полилинии
        this.polylines.forEach(p => { try { this.map.geoObjects.remove(p); } catch (e) { /* ignore */ } });
        this.map.destroy();
      }
    } catch (e) { /* ignore */ }
    this.map = null;
    this.markersCollection = null;
    this.routeObjects.clear();
    this.polylines.clear();
    this.eventHandlerWrappers.clear();
    this.customLayers = [];
  }

  onClick(handler: (coords: [number, number]) => void): void {
    // Save handler and attach when map is ready (or invoke immediately if ready)
    this.clickHandlers.push(handler);
    if (this.map) {
      // no-op: event listener already routes to clickHandlers
    }
  }

  onRouteGeometry(handler: (coords: Array<[number, number]>) => void): void {
    this.routeGeometryHandler = handler;
  }

  async planRoute(waypoints: GeoPoint[]): Promise<PersistedRoute> {
    // Use yandexMapsService to build a route via provider
    try {
      const coords = waypoints.map(w => [w.lat, w.lon] as [number, number]);
      const geometry = await yandexMapsService.getRoute(coords);
      return { id: `yandex-${Date.now()}`, waypoints, geometry } as PersistedRoute;
    } catch (e) {
      return { id: `yandex-${Date.now()}`, waypoints, geometry: null } as PersistedRoute;
    }
  }
}
