// Кэш для запросов к ORS (чтобы не превышать rate limit)
const routeCache = new Map<string, [number, number][]>();

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
 * Запрос идёт через бэкенд-прокси (/api/ors/...), который хранит API-ключ.
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
    const orsCoordinates: [number, number][] = points.map(([lat, lng]) => [lng, lat]);

    // Запрос идёт через бэкенд-прокси: /api/ors/... → backend server.js → ORS API
    // API-ключ добавляется на стороне бэкенда из process.env.OPENROUTE_SERVICE_API_KEY
    const response = await fetch(`/api/ors/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: orsCoordinates,
        radiuses: orsCoordinates.map(() => 500)
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.warn(`[routingService] ORS API error (${response.status}):`, errorData);
      return points.slice();
    }

    const data = await response.json();
    
    // ORS возвращает GeoJSON с координатами в формате [lng, lat]
    // Нам нужно конвертировать обратно в [lat, lng]
    const geometry = data?.features?.[0]?.geometry;
    if (geometry && geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      const routeCoords: [number, number][] = geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      // Сохраняем в кэш
      routeCache.set(cacheKey, routeCoords);
      // Очищаем старые записи кэша
      if (routeCache.size > 100) {
        const firstKey = routeCache.keys().next().value;
        if (firstKey) routeCache.delete(firstKey);
      }
      return routeCoords;
    }

    console.warn('[routingService] ORS вернул неожиданный формат данных:', data);
    return points.slice();
  } catch (err) {
    console.warn('[routingService] Ошибка при запросе маршрута:', err);
    return points.slice();
  }
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
