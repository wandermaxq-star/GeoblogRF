import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ──────────────────────────────────────────────────────────────
// Файл персистенции: backend/data/zones.geojson
// При каждом импорте данные дописываются на диск.
// При старте сервера — автоматически загружаются.
// ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const ZONES_FILE = path.join(DATA_DIR, 'zones.geojson');

// In-memory store of polygons (GeoJSON-like)
// Each zone: { id?, name?, type?, severity?: 'critical'|'restricted'|'warning', polygons: [[[lon,lat]...]], bbox?: [minX,minY,maxX,maxY] }

/** @type {Array<{id?:string,name?:string,type?:string,severity?:string,polygons:number[][][],bbox?:number[]}>} */
const zonesStore = [];

// ── Helpers ────────────────────────────────────────────────────

function computeBBox(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function bboxIntersectsPoint(bbox, x, y) {
  const [minX, minY, maxX, maxY] = bbox;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/** Проверяет пересекаются ли два bbox */
function bboxIntersectsBBox(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// Ray-casting algorithm for point in polygon (lon,lat)
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Проверяет, пересекается ли сегмент [A, B] с ребром полигона [C, D]
 * Используется для обнаружения маршрутов, проходящих ЧЕРЕЗ зону,
 * даже если ни одна вершина маршрута не попадает внутрь.
 */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-12) return false; // параллельны
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Проверяет, пересекает ли сегмент [A, B] полигон (любое его ребро)
 */
function segmentIntersectsPolygon(ax, ay, bx, by, polygon) {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const cx = polygon[i][0], cy = polygon[i][1];
    const dx = polygon[j][0], dy = polygon[j][1];
    if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
  }
  return false;
}

// ── Persistence ───────────────────────────────────────────────

/** Сохраняет текущий zonesStore на диск в формате GeoJSON */
function persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const geojson = {
      type: 'FeatureCollection',
      _meta: {
        savedAt: new Date().toISOString(),
        totalZones: zonesStore.length,
      },
      features: zonesStore.map(z => ({
        type: 'Feature',
        properties: { name: z.name, type: z.type, severity: z.severity },
        geometry: {
          type: 'Polygon',
          coordinates: z.polygons, // [ ring ]
        },
      })),
    };
    fs.writeFileSync(ZONES_FILE, JSON.stringify(geojson), 'utf8');
    console.log(`[ZoneGuard] Зоны сохранены на диск: ${zonesStore.length} зон → ${ZONES_FILE}`);
  } catch (err) {
    console.error('[ZoneGuard] Ошибка сохранения зон на диск:', err?.message || err);
  }
}

/**
 * Автозагрузка зон из файла при старте сервера.
 * Вызывается один раз из server.js.
 * @returns {number} количество загруженных зон
 */
export function loadZonesFromDisk() {
  try {
    if (!fs.existsSync(ZONES_FILE)) {
      console.log('[ZoneGuard] Файл зон не найден — пропускаем автозагрузку');
      return 0;
    }
    const raw = fs.readFileSync(ZONES_FILE, 'utf8');
    const geojson = JSON.parse(raw);
    const count = addZonesFromGeoJSON(geojson, /* persist= */ false);
    console.log(`[ZoneGuard] Автозагрузка: ${count} зон из ${ZONES_FILE}`);
    return count;
  } catch (err) {
    console.error('[ZoneGuard] Ошибка автозагрузки зон:', err?.message || err);
    return 0;
  }
}

// ── Public API ────────────────────────────────────────────────

export function clearZones(/** @type {boolean} */ persistAfterClear = true) {
  zonesStore.length = 0;
  if (persistAfterClear) persistToDisk();
}

/**
 * Импортирует зоны из GeoJSON в in-memory store.
 * @param {object} geojson - FeatureCollection или Feature
 * @param {boolean} persist - сохранять ли на диск (по умолчанию true)
 * @returns {number} кол-во импортированных зон
 */
export function addZonesFromGeoJSON(geojson, persist = true) {
  if (!geojson) return 0;
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
  let count = 0;
  for (const f of features) {
    if (!f || !f.geometry) continue;
    const props = f.properties || {};
    const severity = props.severity || 'restricted';
    const type = props.type || props.zone_type || 'unknown';
    const name = props.name || props.title || 'Zone';
    if (f.geometry.type === 'Polygon') {
      const rings = f.geometry.coordinates || [];
      const outer = rings[0] || [];
      if (outer.length < 3) continue;
      const zone = { name, type, severity, polygons: [outer] };
      zone.bbox = computeBBox(outer);
      // Дедупликация: проверяем нет ли такой же зоны
      if (!isDuplicateZone(zone)) {
        zonesStore.push(zone);
        count += 1;
      }
    } else if (f.geometry.type === 'MultiPolygon') {
      const multi = f.geometry.coordinates || [];
      for (const poly of multi) {
        const outer = poly[0] || [];
        if (outer.length < 3) continue;
        const zone = { name, type, severity, polygons: [outer] };
        zone.bbox = computeBBox(outer);
        if (!isDuplicateZone(zone)) {
          zonesStore.push(zone);
          count += 1;
        }
      }
    }
  }

  if (persist && count > 0) {
    persistToDisk();
  }
  return count;
}

/**
 * Простая дедупликация: зона считается дублем, если совпадают name+type+severity
 * и bbox различаются менее чем на 0.001° (~100 м)
 */
function isDuplicateZone(zone) {
  const EPSILON = 0.001;
  return zonesStore.some(existing => {
    if (existing.name !== zone.name || existing.type !== zone.type || existing.severity !== zone.severity) return false;
    if (!existing.bbox || !zone.bbox) return false;
    return Math.abs(existing.bbox[0] - zone.bbox[0]) < EPSILON &&
           Math.abs(existing.bbox[1] - zone.bbox[1]) < EPSILON &&
           Math.abs(existing.bbox[2] - zone.bbox[2]) < EPSILON &&
           Math.abs(existing.bbox[3] - zone.bbox[3]) < EPSILON;
  });
}

// ── Буферная зона ─────────────────────────────────────────────
// Размер буфера в градусах для каждого severity.
// ~0.01° ≈ 1.1 км на широтах 55° (Москва).
// Военные зоны получают буфер ~2 км, аэродромы ~1.5 км, ООПТ ~0.5 км.
const BUFFER_DEGREES = {
  critical: 0.018,   // ~2 км
  restricted: 0.014, // ~1.5 км
  warning: 0.005,    // ~0.5 км
};

/**
 * Расширяет bbox зоны на величину буферной зоны.
 * Применяется при проверке точек — если точка в расширенном bbox,
 * дополнительно проверяем, находится ли она в буферной зоне вокруг полигона.
 */
function getBufferedBBox(bbox, severity) {
  const buf = BUFFER_DEGREES[severity] || 0.01;
  return [bbox[0] - buf, bbox[1] - buf, bbox[2] + buf, bbox[3] + buf];
}

/**
 * Вычисляет минимальное расстояние от точки до ближайшего ребра полигона (в градусах).
 * Это приближённая версия — достаточно точная для буферных проверок.
 */
function distanceToPolygonEdge(px, py, polygon) {
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = polygon[i][0], ay = polygon[i][1];
    const bx = polygon[j][0], by = polygon[j][1];
    const dist = pointToSegmentDist(px, py, ax, ay, bx, by);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/** Расстояние от точки (px,py) до отрезка (ax,ay)-(bx,by) */
function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx, projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// ── Проверки точек и линий ────────────────────────────────────

/**
 * Проверяет точку на попадание в запретные зоны.
 * Проверяет точное попадание внутрь полигона И буферную зону.
 */
export async function checkPointAgainstZones(longitude, latitude) {
  const hits = [];
  for (const z of zonesStore) {
    const bufBBox = z.bbox ? getBufferedBBox(z.bbox, z.severity) : null;
    if (bufBBox && !bboxIntersectsPoint(bufBBox, longitude, latitude)) continue;

    let hit = false;
    for (const ring of z.polygons) {
      // Точное попадание внутрь полигона
      if (pointInPolygon([longitude, latitude], ring)) {
        hits.push({ name: z.name, type: z.type, severity: z.severity, inBuffer: false });
        hit = true;
        break;
      }
    }

    // Буферная зона: точка не внутри, но рядом с границей
    if (!hit) {
      const bufDeg = BUFFER_DEGREES[z.severity] || 0.01;
      for (const ring of z.polygons) {
        const dist = distanceToPolygonEdge(longitude, latitude, ring);
        if (dist <= bufDeg) {
          hits.push({
            name: z.name, type: z.type, severity: z.severity,
            inBuffer: true,
            bufferMessage: `Точка в буферной зоне (${(dist * 111).toFixed(1)} км от границы)`
          });
          break;
        }
      }
    }
  }
  return hits;
}

/**
 * Проверяет линию (маршрут) на пересечение с запретными зонами.
 * В отличие от старой версии, проверяет не только вершины, но и СЕГМЕНТЫ
 * линии на пересечение с рёбрами полигонов зон.
 * Это гарантирует обнаружение маршрутов, проходящих через зону,
 * даже если ни одна точка маршрута не находится внутри зоны.
 */
export async function checkLineAgainstZones(coordinates) {
  const aggregated = new Map();

  // 1) Проверяем каждую вершину (как раньше)
  for (const [lon, lat] of coordinates) {
    const hits = await checkPointAgainstZones(lon, lat);
    for (const h of hits) {
      const key = `${h.name}|${h.type}|${h.severity}`;
      aggregated.set(key, h);
    }
  }

  // 2) Проверяем каждый СЕГМЕНТ линии на пересечение с полигонами зон
  if (coordinates.length >= 2) {
    // Вычисляем bbox всей линии для быстрого пропуска далёких зон
    const lineBBox = computeBBox(coordinates);

    for (const z of zonesStore) {
      // Быстрая проверка: bbox зоны пересекается с bbox линии?
      if (z.bbox && !bboxIntersectsBBox(lineBBox, z.bbox)) continue;

      const key = `${z.name}|${z.type}|${z.severity}`;
      if (aggregated.has(key)) continue; // уже обнаружена

      let found = false;
      for (const ring of z.polygons) {
        for (let i = 0; i < coordinates.length - 1 && !found; i++) {
          const [ax, ay] = coordinates[i];
          const [bx, by] = coordinates[i + 1];
          if (segmentIntersectsPolygon(ax, ay, bx, by, ring)) {
            aggregated.set(key, { name: z.name, type: z.type, severity: z.severity });
            found = true;
          }
        }
        if (found) break;
      }
    }
  }

  return Array.from(aggregated.values());
}

// ── Статистика и снимок ───────────────────────────────────────

export function getZonesStats() {
  const summary = zonesStore.reduce((acc, z) => {
    acc.total += 1;
    acc.bySeverity[z.severity] = (acc.bySeverity[z.severity] || 0) + 1;
    acc.byType[z.type] = (acc.byType[z.type] || 0) + 1;
    return acc;
  }, { total: 0, bySeverity: {}, byType: {} });
  return summary;
}

export function getZonesSnapshot() {
  // Return a safe shallow copy without functions
  return zonesStore.map(z => ({
    name: z.name,
    type: z.type,
    severity: z.severity,
    polygons: z.polygons,
    bbox: z.bbox,
  }));
}

/** Путь к файлу зон (для информации) */
export function getZonesFilePath() {
  return ZONES_FILE;
}

