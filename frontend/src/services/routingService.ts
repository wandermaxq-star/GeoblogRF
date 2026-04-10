import { yandexMapsService } from './yandexMapsService';

// Кэш для запросов к ORS (чтобы не превышать rate limit)
const routeCache = new Map<string, [number, number][]>();
// Сбрасываем кэш при каждой загрузке модуля (hot reload), чтобы не отдавать устаревшие маршруты
routeCache.clear();

// Маппинг типов транспорта приложения → профили ORS
// ORS поддерживает: driving-car, driving-hgv, foot-walking, cycling-regular,
//                   cycling-road, cycling-mountain, cycling-electric
const ORS_PROFILE_MAP: Record<string, string> = {
  'driving-car':      'driving-car',
  'driving-hgv':      'driving-hgv',
  'driving-bus':      'driving-car',
  'motorcycle':       'driving-car',
  'scooter':          'driving-car',
  'foot-walking':     'foot-walking',
  'cycling-regular':  'cycling-regular',
  'cycling-road':     'cycling-road',
  'cycling-mountain': 'cycling-mountain',
  'cycling-electric': 'cycling-electric',
  'public-transport': 'driving-car',
};

// Функция для создания ключа кэша из координат
function getCacheKey(points: [number, number][], profile: string, preference: string, avoidFeatures?: string[]): string {
  // Округляем координаты до 4 знаков после запятой (~11м точность) для кэширования
  const rounded = points.map(([lat, lng]) => [
    Math.round(lat * 10000) / 10000,
    Math.round(lng * 10000) / 10000
  ]);
  const avoidStr = avoidFeatures?.slice().sort().join(',') ?? '';
  return `${profile}:${preference}:${avoidStr}:${JSON.stringify(rounded)}`;
}

/**
 * Получить polyline маршрута через OpenRouteService.
 * Запрос идёт через бэкенд-прокси (/api/ors/...), который хранит API-ключ.
 * @param points Массив точек [широта, долгота] (lat, lng)
 * @param profile Тип транспорта (маппится в профиль ORS)
 * @param preference fastest | shortest | recommended (default: fastest — кратчайшее по времени)
 * @returns Массив координат маршрута [широта, долгота]
 */
export async function getRoutePolyline(
  points: [number, number][],
  profile: string = 'driving-car',
  preference: 'fastest' | 'shortest' | 'recommended' = 'fastest'
): Promise<[number, number][]> {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('Необходимо минимум 2 точки для построения маршрута');
  }

  const orsProfile = ORS_PROFILE_MAP[profile] || 'driving-car';
  const cacheKey = getCacheKey(points, orsProfile, preference);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // ORS API ожидает координаты в формате [долгота, широта] = [lng, lat]
    // А нам передают [широта, долгота] = [lat, lng]
    const orsCoordinates: [number, number][] = points.map(([lat, lng]) => [lng, lat]);

    // Запрос идёт через бэкенд-прокси: /api/ors/... → backend server.js → ORS API
    // API-ключ добавляется на стороне бэкенда из process.env.OPENROUTE_SERVICE_API_KEY
    const response = await fetch(`/api/ors/v2/directions/${orsProfile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: orsCoordinates,
        preference,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.warn(`[routingService] ORS API error (${response.status}):`, errorData);
      return [];
    }

    const data = await response.json();
    
    // ORS возвращает GeoJSON с координатами в формате [lng, lat]
    // Нам нужно конвертировать обратно в [lat, lng]
    const geometry = data?.features?.[0]?.geometry;
    if (geometry && geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      const routeCoords: [number, number][] = geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      if (routeCoords.length >= 2) {
        // Сохраняем в кэш
        routeCache.set(cacheKey, routeCoords);
        // Очищаем старые записи кэша
        if (routeCache.size > 100) {
          const firstKey = routeCache.keys().next().value;
          if (firstKey) routeCache.delete(firstKey);
        }
        return routeCoords;
      }
    }

    console.warn('[routingService] ORS вернул неожиданный формат данных или недостаточно точек:', data);
    return [];

  } catch (err) {
    console.warn('[routingService] Ошибка при запросе маршрута:', err);
    return points.slice();
  }
}

export interface RouteData {
  polyline: [number, number][];
  /** Расстояние в метрах (0 если ORS не вернул) */
  distanceMeters: number;
  /** Длительность в секундах (0 если ORS не вернул) */
  durationSeconds: number;
}

async function getYandexShortestRouteData(points: [number, number][]): Promise<RouteData> {
  try {
    const data = await yandexMapsService.getRouteData(points);
    if (Array.isArray(data.polyline) && data.polyline.length >= 2) {
      return {
        polyline: data.polyline,
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
      };
    }
  } catch (err) {
    console.warn('[routingService] Yandex shortest route error, fallback to ORS:', err);
  }

  return getRouteData(points, 'driving-car', 'shortest');
}

/**
 * Аналог getRoutePolyline, но дополнительно возвращает distance и duration из ORS.
 */
export async function getRouteData(
  points: [number, number][],
  profile: string = 'driving-car',
  preference: 'fastest' | 'shortest' | 'recommended' = 'fastest',
  avoidFeatures?: string[]
): Promise<RouteData> {
  if (!Array.isArray(points) || points.length < 2) {
    return { polyline: points.slice() as [number, number][], distanceMeters: 0, durationSeconds: 0 };
  }

  const orsProfile = ORS_PROFILE_MAP[profile] || 'driving-car';
  const orsCoordinates: [number, number][] = points.map(([lat, lng]) => [lng, lat]);

  try {
    const response = await fetch(`/api/ors/v2/directions/${orsProfile}/geojson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: orsCoordinates,
        preference,
        ...(avoidFeatures && avoidFeatures.length > 0 ? { options: { avoid_features: avoidFeatures } } : {}),
      })
    });

    if (!response.ok) {
      console.warn(`[routingService] getRouteData ORS error (${response.status})`);
      return { polyline: [], distanceMeters: 0, durationSeconds: 0 };
    }

    const data = await response.json();
    const feature = data?.features?.[0];
    const geometry = feature?.geometry;
    const summary = feature?.properties?.summary;

    const distanceMeters: number = summary?.distance ?? 0;
    const durationSeconds: number = summary?.duration ?? 0;

    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      const polyline: [number, number][] = geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      if (polyline.length >= 2) {
        // Обновляем общий кэш полилиний
        const cacheKey = getCacheKey(points, orsProfile, preference, avoidFeatures);
        routeCache.set(cacheKey, polyline);
        return { polyline, distanceMeters, durationSeconds };
      }
    }

    console.warn('[routingService] getRouteData ORS вернул неожиданный формат данных или недостаточно точек:', data);
    return { polyline: [], distanceMeters: 0, durationSeconds: 0 };
  } catch (err) {
    console.warn('[routingService] getRouteData error:', err);
    return { polyline: points.slice() as [number, number][], distanceMeters: 0, durationSeconds: 0 };
  }
}

// ============================
// Альтернативные маршруты
// ============================

export type RouteAlternativeId = 'highway' | 'shortest' | 'city';

export interface RouteAlternative {
  id: RouteAlternativeId;
  label: string;
  hint: string;
  colorActive: string;
  polyline: [number, number][];
  distanceKm: number;
  durationMin: number;
}

const ALT_META: Record<RouteAlternativeId, Omit<RouteAlternative, 'id' | 'polyline' | 'distanceKm' | 'durationMin'>> = {
  highway:  { label: 'По трассе',    hint: 'Быстрый маршрут через шоссе и объездные',  colorActive: '#3b82f6' },
  shortest: { label: 'Кратчайший',  hint: 'Минимум расстояния',                        colorActive: '#22c55e' },
  city:     { label: 'Через город', hint: 'Без трасс, через местные дороги',           colorActive: '#f59e0b' },
};

// Отфильтровываем практически одинаковые маршруты (разница по расстоянию < 5%)
function deduplicateAlternatives(alts: RouteAlternative[]): RouteAlternative[] {
  if (alts.length <= 1) return alts;
  const kept = [alts[0]];
  for (let i = 1; i < alts.length; i++) {
    const candidate = alts[i];
    const isDuplicate = kept.some(a => {
      const maxDist = Math.max(a.distanceKm, candidate.distanceKm);
      return maxDist > 0 && Math.abs(a.distanceKm - candidate.distanceKm) / maxDist < 0.05;
    });
    if (!isDuplicate) kept.push(candidate);
  }
  return kept;
}

/**
 * Получить несколько альтернативных маршрутов параллельно.
 * Стратегии:
 *   highway  — recommended preference (ORS устарел fastest, оба дают одно и то же);
 *   shortest — shortest preference (минимум км, может идти через город);
 *   city     — recommended + avoid_features=["highways"] (без трасс, через местные дороги).
 * Маршруты с разницей <5% по расстоянию считаются дубликатами и отбрасываются.
 */
export async function getAlternativeRoutes(
  points: [number, number][]
): Promise<RouteAlternative[]> {
  if (!Array.isArray(points) || points.length < 2) return [];

  const ids: RouteAlternativeId[] = ['shortest', 'highway', 'city'];
  const fetches: Promise<RouteData>[] = [
    getYandexShortestRouteData(points),
    getRouteData(points, 'driving-car', 'recommended'),
    getRouteData(points, 'driving-car', 'recommended', ['highways']),
  ];

  const settled = await Promise.allSettled(fetches);
  const results: RouteAlternative[] = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const id = ids[i];
    if (result.status === 'fulfilled' && result.value.polyline.length >= 2 && result.value.distanceMeters > 0) {
      results.push({
        id,
        ...ALT_META[id],
        polyline: result.value.polyline,
        distanceKm: result.value.distanceMeters / 1000,
        durationMin: Math.round(result.value.durationSeconds / 60),
      });
    }
  }

  return deduplicateAlternatives(results);
}

/**
 * Тестирование подключения к ORS API через бэкенд-прокси
 */
export async function testORSConnection(): Promise<boolean> {
  try {
    // Тестовые координаты в формате [lng, lat] (Москва)
    const testPoints: [number, number][] = [
      [37.6173, 55.7558],
      [37.5847, 55.7762]
    ];

    const res = await fetch('/api/ors/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates: testPoints })
    });

    return res.ok;
  } catch {
    return false;
  }
}
