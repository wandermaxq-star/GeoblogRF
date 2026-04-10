import api from './api';
import { isWithinRussiaBounds } from '../utils/russiaBounds';
import { FEATURES } from '../config/features';

export interface ZoneCheckResult {
  zoneId: string;
  zoneName: string;
  severity: 'critical' | 'restricted' | 'warning';
  message: string;
  coordinates: [number, number];
  inBuffer?: boolean;
  bufferMessage?: string;
}

export interface ZoneValidationResult {
  isValid: boolean;
  blocked: boolean;
  warnings: ZoneCheckResult[];
  criticalZones: ZoneCheckResult[];
  restrictedZones: ZoneCheckResult[];
  message?: string;
}

// ── Кэш всех зон для отображения на карте ──
let globalZonesGeojson: any = null;
let zonesLoadPromise: Promise<any> | null = null;

/**
 * Загружает зоны из сервера один раз и кэширует их
 * @returns GeoJSON FeatureCollection с запретными зонами
 */
export async function loadZonesData(): Promise<any> {
  // allow disabling completely during development
  if (process.env.REACT_APP_DISABLE_ZONES === 'true') {
    return { type: 'FeatureCollection', features: [] };
  }

  // Если уже загружали — возвращаем кэш
  if (globalZonesGeojson) {
    return globalZonesGeojson;
  }

  // try persistent cache (localStorage) to avoid re-download on reload
  try {
    const cached = window.localStorage.getItem('cachedZones');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        globalZonesGeojson = parsed.geojson;
        return globalZonesGeojson;
      }
    }
  } catch {}

  // Если уже идет загрузка — возвращаем промис
  if (zonesLoadPromise) {
    return zonesLoadPromise;
  }

  // Запускаем загрузку
  zonesLoadPromise = (async () => {
    try {
      const { data } = await api.get<{ ok: boolean; geojson: any }>('/zones/all');
      globalZonesGeojson = data?.geojson;
      // persist for next reload
      try {
        window.localStorage.setItem('cachedZones', JSON.stringify({
          timestamp: Date.now(),
          geojson: globalZonesGeojson
        }));
      } catch {}
      return globalZonesGeojson;
    } catch (err) {
      console.warn('Ошибка загрузки зон:', err);
      return { type: 'FeatureCollection', features: [] };
    }
  })();

  return zonesLoadPromise;
}

// ── Retry-логика для устойчивости к временным сбоям сети ──
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ── КЭШИРОВАНИЕ РЕЗУЛЬТАТОВ ПРОВЕРКИ ЗОН ──
// Ключ: "lat,lon", значение: ZoneValidationResult
// Это предотвращает DDoS API и браузера при повторных проверках одних координат
const pointCheckCache = new Map<string, { result: ZoneValidationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

function getCacheKey(lat: number, lon: number): string {
  // Округляем до 5 знаков (точность ~1.2м) для лучшего кэширования
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function getCachedResult(lat: number, lon: number): ZoneValidationResult | null {
  const key = getCacheKey(lat, lon);
  const cached = pointCheckCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  pointCheckCache.delete(key);
  return null;
}

function setCachedResult(lat: number, lon: number, result: ZoneValidationResult): void {
  const key = getCacheKey(lat, lon);
  pointCheckCache.set(key, { result, timestamp: Date.now() });
}

// Очищаем кэш автоматически каждый час
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pointCheckCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      pointCheckCache.delete(key);
    }
  }
}, 60 * 1000);

// ── КЭШИРОВАНИЕ РЕЗУЛЬТАТОВ ПРОВЕРКИ МАРШРУТОВ ──
const routeCheckCache = new Map<string, { result: ZoneValidationResult; timestamp: number }>();

function getRouteCheckCacheKey(coords: [number, number][]): string {
  // Округляем каждую точку и создаем ключ
  return coords.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(';');
}

function getCachedRouteResult(coords: [number, number][]): ZoneValidationResult | null {
  const key = getRouteCheckCacheKey(coords);
  const cached = routeCheckCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  routeCheckCache.delete(key);
  return null;
}

function setCachedRouteResult(coords: [number, number][], result: ZoneValidationResult): void {
  const key = getRouteCheckCacheKey(coords);
  routeCheckCache.set(key, { result, timestamp: Date.now() });
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      // Не ретраим 4xx ошибки (клиентские)
      if (err && typeof err === 'object' && 'response' in err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status && status >= 400 && status < 500) throw err;
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Проверяет точку на соответствие запретным зонам с усиленными ограничениями для РФ
 * @param lat - широта
 * @param lon - долгота
 * @returns результат проверки зон (кэшируется на 5 минут)
 */
export async function checkPoint(lat: number, lon: number): Promise<ZoneValidationResult> {
  // Сначала проверяем кэш
  const cached = getCachedResult(lat, lon);
  if (cached) {
    return cached;
  }

  // Проверяем границы РФ
  if (FEATURES.GEOGRAPHIC_RESTRICTIONS_ENABLED && !isWithinRussiaBounds(lat, lon)) {
    const result: ZoneValidationResult = {
      isValid: false,
      blocked: true,
      warnings: [],
      criticalZones: [],
      restrictedZones: [],
      message: 'Точка находится за пределами РФ'
    };
    setCachedResult(lat, lon, result);
    return result;
  }

  try {
    const { data } = await withRetry(() => api.post('/zones/check', { points: [[lon, lat]] }));
    const results: ZoneCheckResult[] = data?.results || [];
    
    const processed = processZoneResults(results);
    setCachedResult(lat, lon, processed);
    return processed;
  } catch (error) {
    console.error('Ошибка проверки зон (после повторных попыток):', error);
    // Ошибка сети/бэкенда не должна ложноположительно блокировать интерфейс при старте.
    // Разрешаем операцию, но возвращаем предупреждение; реальная блокировка всё равно
    // сработает при успешной проверке сервиса.
    const fallback: ZoneValidationResult = {
      isValid: true,
      blocked: false,
      warnings: [],
      criticalZones: [],
      restrictedZones: [],
      message: 'Не удалось проверить запретные зоны. Будьте осторожны.'
    };
    
    setCachedResult(lat, lon, fallback);
    return fallback;
  }
}

/**
 * Проверяет маршрут на соответствие запретным зонам (результаты кэшируются)
 * @param coords - массив координат маршрута в формате [lat, lon]
 * @returns результат проверки зон
 */
export async function checkRoute(coords: [number, number][]): Promise<ZoneValidationResult> {
  // Проверяем кэш маршрута
  const cached = getCachedRouteResult(coords);
  if (cached) {
    return cached;
  }

  // Проверяем все точки маршрута на границы РФ
  if (FEATURES.GEOGRAPHIC_RESTRICTIONS_ENABLED) {
    const invalidPoints = coords.filter(([lat, lon]) => !isWithinRussiaBounds(lat, lon));
    if (invalidPoints.length > 0) {
      const result: ZoneValidationResult = {
        isValid: false,
        blocked: true,
        warnings: [],
        criticalZones: [],
        restrictedZones: [],
        message: `Маршрут содержит ${invalidPoints.length} точек за пределами РФ`
      };
      setCachedRouteResult(coords, result);
      return result;
    }
  }

  try {
    // Преобразуем координаты из [lat, lon] в [lon, lat] для backend
    const backendCoords = coords.map(([lat, lon]) => [lon, lat]);
    const { data } = await withRetry(() => api.post('/zones/check', { lineString: backendCoords }));
    const results: ZoneCheckResult[] = data?.results || [];
    
    const processed = processZoneResults(results);
    setCachedRouteResult(coords, processed);
    return processed;
  } catch (error) {
    console.error('Ошибка проверки зон маршрута (после повторных попыток):', error);
    const fallback: ZoneValidationResult = {
      isValid: true,
      blocked: false,
      warnings: [],
      criticalZones: [],
      restrictedZones: [],
      message: 'Не удалось проверить запретные зоны маршрута. Будьте осторожны.'
    };
    
    setCachedRouteResult(coords, fallback);
    return fallback;
  }
}

/**
 * Обрабатывает результаты проверки зон и определяет блокировку
 * @param results - результаты проверки зон
 * @returns обработанный результат
 */
function processZoneResults(results: ZoneCheckResult[]): ZoneValidationResult {
  const criticalZones = results.filter(zone => zone.severity === 'critical');
  const restrictedZones = results.filter(zone => zone.severity === 'restricted');
  const warnings = results.filter(zone => zone.severity === 'warning');

  // В режиме РФ блокируем для критических и ограниченных зон
  if (FEATURES.RUSSIA_COMPLIANCE_MODE) {
    if (criticalZones.length > 0) {
      return {
        isValid: false,
        blocked: true,
        warnings,
        criticalZones,
        restrictedZones,
        message: `Операция заблокирована: точка находится в критической зоне "${criticalZones[0].zoneName}"`
      };
    }

    if (restrictedZones.length > 0) {
      return {
        isValid: false,
        blocked: true,
        warnings,
        criticalZones,
        restrictedZones,
        message: `Операция заблокирована: точка находится в ограниченной зоне "${restrictedZones[0].zoneName}"`
      };
    }
  }

  // Если есть только предупреждения, разрешаем с предупреждением
  if (warnings.length > 0) {
    return {
      isValid: true,
      blocked: false,
      warnings,
      criticalZones,
      restrictedZones,
      message: `Внимание: ${warnings.length} предупреждений о зонах`
    };
  }

  // Все проверки пройдены
  return {
    isValid: true,
    blocked: false,
    warnings: [],
    criticalZones: [],
    restrictedZones: []
  };
}

/**
 * Получает все запретные зоны
 * @returns массив запретных зон
 */
export async function getAllZones() {
  try {
  const { data } = await api.get('/zones/all');
  return data?.zones || [];
  } catch (error) {
    console.error('Ошибка получения зон:', error);
    return [];
  }
}

/**
 * Проверяет, можно ли создать маркер в указанной точке
 * @param lat - широта
 * @param lon - долгота
 * @returns true, если маркер можно создать
 */
export async function canCreateMarker(lat: number, lon: number): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const result = await checkPoint(lat, lon);
  
  if (!result.isValid || result.blocked) {
    return {
      allowed: false,
      reason: result.message
    };
  }

  return { allowed: true };
}

/**
 * Проверяет, можно ли построить маршрут через указанные точки
 * @param coordinates - координаты маршрута
 * @returns true, если маршрут можно построить
 */
export async function canCreateRoute(coordinates: [number, number][]): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const result = await checkRoute(coordinates);
  
  if (!result.isValid || result.blocked) {
    return {
      allowed: false,
      reason: result.message
    };
  }

  return { allowed: true };
}

// helpers exported for unit testing
export {
  getCacheKey,
  getCachedResult,
  setCachedResult,
  getRouteCheckCacheKey,
  getCachedRouteResult,
  setCachedRouteResult,
  withRetry,
  CACHE_TTL,
  FEATURES,
  pointCheckCache,
  routeCheckCache
};

