interface Place {
  name: string;
  coordinates: [number, number];
}

export interface YandexRouteData {
  polyline: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
}

class YandexMapsService {
  private apiKey: string | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
    this.apiKey = key || null;
  }

  async init(): Promise<void> {
    // Если уже инициализирован, возвращаем сразу
    if (this.isInitialized) return;

    // Если инициализация уже в процессе, ждём её
    if (this.initPromise) return this.initPromise;

    // Создаём новое обещание инициализации
    this.initPromise = this.performInit();

    try {
      await this.initPromise;
    } finally {
      // Не сбрасываем initPromise, чтобы избежать race condition
      // Если init() вызовется снова, проверка isInitialized вернёт true
    }
  }

  private performInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const win: any = window;

      const onReady = () => {
        if (!win.ymaps?.ready) {
          reject(new Error('Yandex Maps API not found'));
          return;
        }

        try {
          win.ymaps.ready(() => {
            const ymaps = win.ymaps;
            
            console.log('[YandexMapsService] ✅ Yandex Maps loaded');
            console.log('[YandexMapsService] multiRouter:', !!ymaps.multiRouter);
            console.log('[YandexMapsService] MultiRoute:', !!ymaps.multiRouter?.MultiRoute);
            console.log('[YandexMapsService] editor:', !!ymaps.multiRouter?.editor);
            
            // Ensure required modules are loaded
            if (!ymaps.multiRouter) {
              console.warn('[YandexMapsService] multiRouter module not available, attempting to load...');
              ymaps.load('multiRouter')
                .then(() => {
                  console.log('[YandexMapsService] multiRouter module loaded successfully');
                  this.isInitialized = true;
                  resolve();
                })
                .catch((error: any) => {
                  console.error('[YandexMapsService] Failed to load multiRouter module:', error);
                  reject(new Error('Failed to load required Yandex Maps modules'));
                });
            } else {
              this.isInitialized = true;
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      };

      // Если API уже загружен
      if (win.ymaps?.ready) {
        onReady();
        return;
      }

      // Удаляем старые скрипты
      document.head.querySelectorAll('script[src*="api-maps.yandex.ru"]').forEach(s => s.remove());

      // Загружаем API с явной загрузкой multiRouter
      const script = document.createElement('script');
      const apiKey = this.apiKey || '';
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&load=package.full,multiRouter&mode=release&_t=${Date.now()}`;
      script.async = true;
      script.onload = onReady;
      script.onerror = () => reject(new Error('Failed to load Yandex Maps API script'));

      document.head.appendChild(script);
    });
  }

  async getRoute(points: Array<[number, number]>): Promise<Array<[number, number]>> {
    const data = await this.getRouteData(points);
    return data.polyline;
  }

  async getRouteData(points: Array<[number, number]>): Promise<YandexRouteData> {
    await this.init();
    return new Promise((resolve, reject) => {
      const ymaps = (window as any).ymaps;
      if (!ymaps?.multiRouter) {
        reject(new Error('MultiRoute недоступен'));
        return;
      }

      const multiRoute = new ymaps.multiRouter.MultiRoute(
        { referencePoints: points },
        {
          routingMode: 'auto',
          boundsAutoApply: false,
          wayPointDraggable: false,
          viaPointDraggable: false
        }
      );

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for route'));
      }, 15000);

      const cleanup = () => clearTimeout(timeout);

      // Обработка успеха
      multiRoute.model.events.add('requestsuccess', () => {
        cleanup();
        try {
          const result = this.extractRouteData(multiRoute);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      // Обработка ошибки
      multiRoute.model.events.add('requestfail', (error: any) => {
        cleanup();
        reject(new Error('Route request failed'));
      });
    });
  }

  private extractRouteData(multiRoute: any): YandexRouteData {
    // Получение маршрута
    const activeRoute = this.getActiveRoute(multiRoute);
    if (!activeRoute) {
      throw new Error('Маршрут не найден');
    }

    // Извлечение координат
    const coords = this.extractRouteCoordinates(activeRoute);
    if (coords.length < 2) {
      throw new Error('Недостаточно точек в маршруте');
    }

    // Извлечение расстояния и времени
    const distance = activeRoute.properties?.get?.('distance')?.value || 0;
    const duration = activeRoute.properties?.get?.('duration')?.value || 0;

    return {
      polyline: coords,
      distanceMeters: distance,
      durationSeconds: duration,
    };
  }

  private getActiveRoute(multiRoute: any): any {
    // Способ 1: через getRoutes() если доступен
    const routes = multiRoute.model.getRoutes?.();
    if (routes?.length > 0) {
      return routes[0];
    }

    // Способ 2: через getActiveRoute если доступен
    if (typeof multiRoute.getActiveRoute === 'function') {
      return multiRoute.getActiveRoute();
    }

    return null;
  }

  private extractRouteCoordinates(activeRoute: any): Array<[number, number]> {
    const coords: Array<[number, number]> = [];

    // Пытаемся получить геометрию напрямую
    if (activeRoute.geometry?.getCoordinates) {
      this.addCoordinatesFromArray(coords, activeRoute.geometry.getCoordinates());
      if (coords.length > 0) return coords;
    }

    // Альтернативный способ через пути
    if (activeRoute.getPaths) {
      this.extractCoordinatesFromPaths(coords, activeRoute.getPaths());
    }

    return coords;
  }

  private extractCoordinatesFromPaths(coords: Array<[number, number]>, paths: any): void {
    if (!paths?.getLength) return;

    for (let i = 0; i < paths.getLength(); i++) {
      const path = paths.get(i);
      if (!path?.getSegments) continue;

      const segments = path.getSegments();
      for (let j = 0; j < segments.getLength(); j++) {
        const segment = segments.get(j);
        const geometry = segment?.geometry;
        
        if (geometry?.getCoordinates) {
          this.addCoordinatesFromArray(coords, geometry.getCoordinates());
        }
      }
    }
  }

  private addCoordinatesFromArray(coords: Array<[number, number]>, rawCoords: any): void {
    if (!rawCoords) return;

    if (Array.isArray(rawCoords)) {
      rawCoords.forEach((item: any) => {
        if (Array.isArray(item)) {
          if (item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
            coords.push([item[0], item[1]]);
          } else {
            this.addCoordinatesFromArray(coords, item);
          }
        }
      });
      return;
    }

    if (rawCoords && typeof rawCoords === 'object') {
      if (Array.isArray(rawCoords.coordinates)) {
        this.addCoordinatesFromArray(coords, rawCoords.coordinates);
      }
    }
  }

  async searchPlaces(query: string, bounds?: [[number, number], [number, number]]): Promise<Place[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const searchControl = new (window as any).ymaps.control.SearchControl({
        options: {
          provider: 'yandex#search',
          boundedBy: bounds,
          strictBounds: !!bounds
        }
      });

      searchControl.search(query)
        .then((res: any) => {
          const geoObjects = res.geoObjects;
          const places: Place[] = [];
          geoObjects.each((obj: any) => {
            const place: Place = {
              name: obj.properties.get('name'),
              coordinates: obj.geometry.getCoordinates()
            };
            places.push(place);
          });
          resolve(places);
        })
        .catch(reject);
    });
  }

  async getPlaceDetails(coordinates: [number, number]): Promise<Place | null> {
    await this.init();

    const ymaps = (window as any).ymaps;
    const res = await ymaps.geocode(`${coordinates[0]},${coordinates[1]}`, {
      results: 1,
      kind: 'house'
    });

    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) {
      throw new Error('Место не найдено');
    }

    return {
      name: firstGeoObject.properties.get('name'),
      coordinates: firstGeoObject.geometry.getCoordinates()
    };
  }

  async searchNearbyOrganizations(
    coordinates: [number, number],
    type: string,
    radius: number = 1000
  ): Promise<Place[]> {
    await this.init();

    const searchControl = new window.ymaps.control.SearchControl({
      options: {
        provider: 'yandex#search',
        boundedBy: this.getBoundsFromPoint(coordinates, radius)
      }
    });

    const res = await searchControl.search(type);
    const places: Place[] = [];
    res.geoObjects.each((org: any) => {
      places.push({
        name: org.properties.get('name'),
        coordinates: org.geometry.getCoordinates()
      });
    });

    return places;
  }

  private getBoundsFromPoint(coordinates: [number, number], radius: number): [[number, number], [number, number]] {
    const [lon, lat] = coordinates;
    const latRadian = (lat * Math.PI) / 180;
    const degLatKm = 111.32 * 1000;
    const degLonKm = (111.32 * Math.cos(latRadian)) * 1000;
    const deltaLat = radius / degLatKm;
    const deltaLon = radius / degLonKm;
    return [
      [lon - deltaLon, lat - deltaLat],
      [lon + deltaLon, lat + deltaLat]
    ];
  }
}

export const yandexMapsService = new YandexMapsService();

declare global {
  interface Window {
    ymaps: any;
  }
}