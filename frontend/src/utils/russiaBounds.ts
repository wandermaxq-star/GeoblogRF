/**
 * Утилиты для работы с географическими границами Российской Федерации
 * Включает буферную зону 5км для обеспечения корректной работы на границах
 */

// Точные координаты границ РФ с буферной зоной 5км
// ВНИМАНИЕ: Карта России повернута на 90 градусов!
export const RUSSIA_BOUNDS = {
  // Северная граница (мыс Челюскин) + 5км буфер
  north: 81.8583,
  // Южная граница (Дагестан) + 5км буфер  
  south: 41.0,  // Исправлено: правильная южная граница РФ
  // Восточная граница (Чукотка) + 5км буфер
  east: -169.05,  // Чукотка находится на -169° долготы
  // Западная граница (Калининград) + 5км буфер
  west: 19.6389
} as const;

// Центр РФ для инициализации карт (Москва)
export const RUSSIA_CENTER = {
  latitude: 55.7558,
  longitude: 37.6176
} as const;

// Основные города РФ для навигации
export const RUSSIA_MAJOR_CITIES = [
  { name: 'Москва', lat: 55.7558, lng: 37.6176 },
  { name: 'Санкт-Петербург', lat: 59.9311, lng: 30.3609 },
  { name: 'Новосибирск', lat: 55.0084, lng: 82.9357 },
  { name: 'Екатеринбург', lat: 56.8431, lng: 60.6454 },
  { name: 'Казань', lat: 55.8304, lng: 49.0661 },
  { name: 'Нижний Новгород', lat: 56.2965, lng: 43.9361 },
  { name: 'Челябинск', lat: 55.1644, lng: 61.4368 },
  { name: 'Самара', lat: 53.2001, lng: 50.1500 },
  { name: 'Омск', lat: 54.9885, lng: 73.3242 },
  { name: 'Ростов-на-Дону', lat: 47.2357, lng: 39.7015 },
  { name: 'Уфа', lat: 54.7388, lng: 55.9721 },
  { name: 'Красноярск', lat: 56.0184, lng: 92.8672 },
  { name: 'Воронеж', lat: 51.6720, lng: 39.1843 },
  { name: 'Пермь', lat: 58.0105, lng: 56.2502 },
  { name: 'Волгоград', lat: 48.7080, lng: 44.5133 }
] as const;

/**
 * Проверяет, находится ли точка в пределах границ РФ (включая буферную зону)
 * @param latitude - широта точки
 * @param longitude - долгота точки
 * @returns true, если точка находится в пределах РФ
 */
export const isWithinRussiaBounds = (latitude: number, longitude: number): boolean => {
  // Широта: стандартная проверка [south .. north]
  if (latitude < RUSSIA_BOUNDS.south || latitude > RUSSIA_BOUNDS.north) return false;

  // Долгота: Россия пересекает 180-й меридиан (Калининград 19.6° → Чукотка -169°)
  // Поэтому точка внутри, если lon >= west ИЛИ lon <= east
  return longitude >= RUSSIA_BOUNDS.west || longitude <= RUSSIA_BOUNDS.east;
};

/**
 * Проверяет, находится ли точка в пределах РФ без буферной зоны
 * @param latitude - широта точки
 * @param longitude - долгота точки
 * @returns true, если точка находится в пределах РФ
 */
export const isWithinRussiaStrict = (latitude: number, longitude: number): boolean => {
  // Более строгие границы без буферной зоны
  const STRICT_BOUNDS = {
    north: 77.65,
    south: 41.0,
    east: -169.15,  // Чукотка за 180-м меридианом
    west: 19.73
  };

  if (latitude < STRICT_BOUNDS.south || latitude > STRICT_BOUNDS.north) return false;

  // Россия пересекает 180-й меридиан: lon >= west ИЛИ lon <= east
  return longitude >= STRICT_BOUNDS.west || longitude <= STRICT_BOUNDS.east;
};

/**
 * Получает ближайший крупный город РФ к указанным координатам
 * @param latitude - широта точки
 * @param longitude - долгота точки
 * @returns объект с информацией о ближайшем городе
 */
export const getNearestRussiaCity = (latitude: number, longitude: number) => {
  let nearestCityIndex = 0;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < RUSSIA_MAJOR_CITIES.length; i++) {
    const city = RUSSIA_MAJOR_CITIES[i];
    const distance = getDistanceFromLatLonInKm(latitude, longitude, city.lat, city.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCityIndex = i;
    }
  }

  const nearestCity = RUSSIA_MAJOR_CITIES[nearestCityIndex];
  return {
    name: nearestCity.name,
    lat: nearestCity.lat,
    lng: nearestCity.lng,
    distance: minDistance
  };
};

/**
 * Вычисляет расстояние между двумя точками в километрах
 * @param lat1 - широта первой точки
 * @param lon1 - долгота первой точки
 * @param lat2 - широта второй точки
 * @param lon2 - долгота второй точки
 * @returns расстояние в километрах
 */
export const getDistanceFromLatLonInKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Проверяет, можно ли использовать указанные координаты для маршрута
 * @param coordinates - массив координат [latitude, longitude]
 * @returns объект с результатом проверки
 */
export const validateRouteCoordinates = (coordinates: [number, number][]): {
  isValid: boolean;
  invalidPoints: number[];
  message?: string;
} => {
  const invalidPoints: number[] = [];

  coordinates.forEach(([lat, lng], index) => {
    if (!isWithinRussiaBounds(lat, lng)) {
      invalidPoints.push(index);
    }
  });

  if (invalidPoints.length === 0) {
    return { isValid: true, invalidPoints: [] };
  }

  return {
    isValid: false,
    invalidPoints,
    message: `Точки ${invalidPoints.map(p => p + 1).join(', ')} находятся за пределами РФ`
  };
};

/**
 * Получает границы для инициализации карты в пределах РФ
 * @param centerLat - широта центра
 * @param centerLng - долгота центра
 * @param zoom - уровень масштабирования
 * @returns объект с границами карты
 */
export const getRussiaMapBounds = (centerLat?: number, centerLng?: number, zoom: number = 6) => {
  const center = centerLat && centerLng 
    ? { lat: centerLat, lng: centerLng }
    : { lat: RUSSIA_CENTER.latitude, lng: RUSSIA_CENTER.longitude };

  // Проверяем, что центр в пределах РФ
  if (!isWithinRussiaBounds(center.lat, center.lng)) {
    return {
      center: { lat: RUSSIA_CENTER.latitude, lng: RUSSIA_CENTER.longitude },
      bounds: {
        north: RUSSIA_BOUNDS.north,
        south: RUSSIA_BOUNDS.south,
        east: RUSSIA_BOUNDS.east,
        west: RUSSIA_BOUNDS.west
      }
    };
  }

  return {
    center,
    bounds: {
      north: RUSSIA_BOUNDS.north,
      south: RUSSIA_BOUNDS.south,
      east: RUSSIA_BOUNDS.east,
      west: RUSSIA_BOUNDS.west
    }
  };
};

/**
 * Фильтрует массив координат, оставляя только те, что в пределах РФ
 * @param coordinates - массив координат
 * @returns отфильтрованный массив координат
 */
export const filterRussiaCoordinates = (coordinates: [number, number][]): [number, number][] => {
  return coordinates.filter(([lat, lng]) => isWithinRussiaBounds(lat, lng));
};

/**
 * Получает сообщение об ошибке для координат за пределами РФ
 * @param latitude - широта
 * @param longitude - долгота
 * @returns сообщение об ошибке
 */
export const getRussiaBoundsErrorMessage = (latitude: number, longitude: number): string => {
  const nearestCity = getNearestRussiaCity(latitude, longitude);
  
  if (latitude > RUSSIA_BOUNDS.north) {
    return 'Указанная точка находится севернее границ РФ';
  }
  if (latitude < RUSSIA_BOUNDS.south) {
    return 'Указанная точка находится южнее границ РФ';
  }
  // Долгота вне диапазона: между east и west (gap в Тихом океане / Атлантике)
  // Gap: от -169.05 до 19.6389 — всё, что > east И < west
  if (longitude > RUSSIA_BOUNDS.east && longitude < RUSSIA_BOUNDS.west) {
    return 'Указанная точка находится за пределами долготных границ РФ';
  }
  
  return `Указанная точка находится за пределами РФ. Ближайший город: ${nearestCity.name} (${Math.round(nearestCity.distance)}км)`;
};

export default {
  RUSSIA_BOUNDS,
  RUSSIA_CENTER,
  RUSSIA_MAJOR_CITIES,
  isWithinRussiaBounds,
  isWithinRussiaStrict,
  getNearestRussiaCity,
  getDistanceFromLatLonInKm,
  validateRouteCoordinates,
  getRussiaMapBounds,
  filterRussiaCoordinates,
  getRussiaBoundsErrorMessage
};
