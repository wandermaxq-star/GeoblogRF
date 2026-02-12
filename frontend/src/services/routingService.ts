import { API_KEYS } from '../config/api';

// Кэш для запросов к ORS (чтобы не превышать rate limit)
const routeCache = new Map<string, [number, number][]>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

// Функция для создания ключа кэша из координат
function getCacheKey(points: [number, number][], profile: string): string {
  // Округляем координаты до 4 знаков после запятой (~11м точность) для кэширования
  const rounded = points.map(([lat, lng]) => [
    Math.round(lat * 10000) / 10000,
    Math.round(lng * 10000) / 10000
  ]);
  return `${profile}:${JSON.stringify(rounded)}`;
}

/**
 * Получить polyline маршрута через OpenRouteService.
 * @param points Массив точек [широта, долгота] (lat, lng)
 * @param profile Тип маршрута: 'driving-car', 'foot-walking', 'cycling-regular', и т.д.
 * @returns Массив координат маршрута [широта, долгота]
 */
export async function getRoutePolyline(
  points: [number, number][],
  profile: 'driving-car' | 'foot-walking' | 'cycling-regular' = 'driving-car'
): Promise<[number, number][]> {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('Необходимо минимум 2 точки для построения маршрута');
  }

  const cacheKey = getCacheKey(points, profile);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // ORS API ожидает координаты в формате [долгота, широта] = [lng, lat]
    // А нам передают [широта, долгота] = [lat, lng]
    // Конвертируем формат координат для ORS API
    const orsCoordinates: [number, number][] = points.map(([lat, lng]) => [lng, lat]);

    // Используем бэкенд-прокси для ORS API (ВАЖНО: абсолютный адрес на API, а не относительный к 5173)
    // Используем относительный путь через Vite proxy для ORS
    // Формируем заголовки — нужен API ключ ORS
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // ORS API требует авторизацию — добавляем ключ если есть
    if (API_KEYS.ORS) {
      headers['Authorization'] = API_KEYS.ORS;
    }

    const response = await fetch(`/ors/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        coordinates: orsCoordinates,
        radiuses: orsCoordinates.map(() => 500)
      })
    });

    if (!response.ok) {
      // Тихий fallback на прямые линии (не спамим консоль)
      return points.slice();
    }

    const data = await response.json();
    
    // ORS возвращает GeoJSON с координатами в формате [lng, lat]
    // Нам нужно конвертировать обратно в [lat, lng]
    const geometry = data?.features?.[0]?.geometry;
    if (geometry && geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      // Конвертируем из [lng, lat] обратно в [lat, lng]
      const routeCoords: [number, number][] = geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      // Сохраняем в кэш
      routeCache.set(cacheKey, routeCoords);
      // Очищаем старые записи кэша (простая реализация — можно улучшить)
      if (routeCache.size > 100) {
        const firstKey = routeCache.keys().next().value;
        if (firstKey) routeCache.delete(firstKey);
      }
      return routeCoords;
    }

    return points.slice();
  } catch {
    return points.slice();
  }
}

/**
 * Тестирование подключения к ORS API
 */
export async function testORSConnection(): Promise<boolean> {
  try {
    const testPoints: [number, number][] = [
      [37.6173, 55.7558], // Москва, центр - [долгота, широта]
      [37.5847, 55.7762]  // Москва, север - [долгота, широта]
    ];

    const res = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': API_KEYS.YANDEX_MAPS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates: testPoints })
    });

    if (res.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
