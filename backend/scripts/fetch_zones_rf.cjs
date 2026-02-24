/* eslint-disable no-console */
const axios = require('axios');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const BACKEND_IMPORT_URL = process.env.ZONES_IMPORT_URL || 'http://localhost:3002/api/zones/import';

// Примерные bbox по федеральным округам РФ (минLon, минLat, максLon, максLat)
// При необходимости уточним полигонами границ. Для зон достаточно крупных bbox.
const DISTRICTS = {
  cfo: [30.0, 52.0, 42.0, 58.5],         // Центральный
  szfo: [26.0, 58.0, 60.0, 69.0],        // Северо-Западный
  yfo: [36.0, 44.0, 50.0, 58.5],         // Южный (прибл. + часть СКФО)
  skfo: [40.0, 41.0, 48.5, 47.5],        // Северо-Кавказский (компактнее)
  pfo: [45.0, 52.0, 56.5, 58.5],         // Приволжский
  urfo: [56.0, 53.0, 75.0, 67.0],        // Уральский
  sfo: [60.0, 49.0, 90.0, 75.0],         // Сибирский
  dfo: [120.0, 42.0, 165.0, 75.0]        // Дальневосточный
};

function bboxToQuery([minLon, minLat, maxLon, maxLat]) {
  return `${minLat},${minLon},${maxLat},${maxLon}`;
}

function overpassQuery(bbox) {
  const box = bboxToQuery(bbox);
  return `
  [out:json][timeout:180];
  (
    // ── Военные объекты (critical) ──
    way["landuse"="military"](${box});
    rel["landuse"="military"](${box});
    way["military"](${box});
    rel["military"](${box});
    way["military"="danger_area"](${box});
    rel["military"="danger_area"](${box});
    way["military"="nuclear_testing_site"](${box});
    rel["military"="nuclear_testing_site"](${box});
    way["military"="range"](${box});
    rel["military"="range"](${box});
    way["military"="naval_base"](${box});
    rel["military"="naval_base"](${box});

    // ── Аэродромы / ВПП / вертолётные площадки (restricted) ──
    way["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});
    rel["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});

    // ── Особо охраняемые природные территории (warning) ──
    way["boundary"="protected_area"](${box});
    rel["boundary"="protected_area"](${box});
    way["boundary"="national_park"](${box});
    rel["boundary"="national_park"](${box});
    way["leisure"="nature_reserve"](${box});
    rel["leisure"="nature_reserve"](${box});

    // ── Закрытые зоны / ограниченный доступ (restricted) ──
    way["access"="no"]["landuse"](${box});
    rel["access"="no"]["landuse"](${box});

    // ── Исправительные учреждения (restricted) ──
    way["amenity"="prison"](${box});
    rel["amenity"="prison"](${box});

    // ── Пограничные зоны (restricted) ──
    way["boundary"="border_zone"](${box});
    rel["boundary"="border_zone"](${box});
  );
  out body;
  >;
  out skel qt;
  `;
}

async function fetchOverpass(query) {
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data } = await axios.post(url, query, { headers: { 'Content-Type': 'text/plain; charset=utf-8' }, timeout: 180000 });
        if (!data || typeof data !== 'object' || !Array.isArray(data.elements)) {
          throw new Error('Non-JSON or invalid Overpass response');
        }
        return data;
      } catch (e) {
        lastErr = e;
        const delay = 1000 * attempt;
        console.warn(`Overpass attempt ${attempt} failed at ${url}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function splitBBox([minLon, minLat, maxLon, maxLat]) {
  const midLon = (minLon + maxLon) / 2;
  const midLat = (minLat + maxLat) / 2;
  return [
    [minLon, minLat, midLon, midLat],
    [midLon, minLat, maxLon, midLat],
    [minLon, midLat, midLon, maxLat],
    [midLon, midLat, maxLon, maxLat]
  ];
}

function buildNodesMap(elements) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === 'node') map.set(el.id, [el.lon, el.lat]);
  }
  return map;
}

/**
 * Строит карту way_id → [coords] для сборки relations
 */
function buildWaysMap(elements, nodesMap) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.nodes)) {
      const coords = el.nodes.map(id => nodesMap.get(id)).filter(Boolean);
      if (coords.length >= 2) {
        map.set(el.id, { coords, tags: el.tags || {} });
      }
    }
  }
  return map;
}

/**
 * Собирает полигоны из way-элементов (как раньше)
 * и из relation type=multipolygon (НОВОЕ — даёт крупные объекты)
 */
function assemblePolygons(elements, nodesMap) {
  const waysMap = buildWaysMap(elements, nodesMap);
  const polygons = [];

  // 1) Обычные way-полигоны
  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.nodes) && el.nodes.length >= 3) {
      const coords = el.nodes.map(id => nodesMap.get(id)).filter(Boolean);
      if (coords.length >= 3) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        polygons.push({ coords, tags: el.tags || {} });
      }
    }
  }

  // 2) Relations type=multipolygon — собираем outer-кольца из member ways
  for (const el of elements) {
    if (el.type !== 'relation') continue;
    const tags = el.tags || {};
    if (tags.type !== 'multipolygon' && tags.type !== 'boundary') continue;
    if (!Array.isArray(el.members)) continue;

    // Берём outer-members (или без роли — тоже outer)
    const outerWayIds = el.members
      .filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '' || !m.role))
      .map(m => m.ref);

    // Собираем кольца из отдельных way-сегментов
    const rings = assembleRingsFromWays(outerWayIds, waysMap, nodesMap);
    const relTags = { ...tags }; // теги от relation (обычно более информативные)

    for (const ring of rings) {
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        polygons.push({ coords: ring, tags: relTags });
      }
    }
  }

  return polygons;
}

/**
 * Склеивает way-сегменты в замкнутые кольца.
 * OSM Relations хранят multipolygon как набор отдельных way, которые нужно
 * соединить «конец к началу». Это стандартная процедура сборки OSM полигонов.
 */
function assembleRingsFromWays(wayIds, waysMap, nodesMap) {
  // Собираем координатные цепочки
  const segments = [];
  for (const id of wayIds) {
    const w = waysMap.get(id);
    if (w && w.coords.length >= 2) {
      segments.push([...w.coords]); // копия
    }
  }

  const rings = [];
  const used = new Set();

  while (used.size < segments.length) {
    // Находим первый неиспользованный сегмент
    let startIdx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (!used.has(i)) { startIdx = i; break; }
    }
    if (startIdx < 0) break;

    const ring = [...segments[startIdx]];
    used.add(startIdx);

    // Пытаемся доращивать кольцо, присоединяя сегменты
    let changed = true;
    while (changed) {
      changed = false;
      const lastPt = ring[ring.length - 1];
      const firstPt = ring[0];

      // Проверяем замкнутость
      if (ring.length >= 4 && Math.abs(lastPt[0] - firstPt[0]) < 1e-7 && Math.abs(lastPt[1] - firstPt[1]) < 1e-7) {
        break; // кольцо замкнуто
      }

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const seg = segments[i];
        const segFirst = seg[0];
        const segLast = seg[seg.length - 1];

        // Конец кольца совпадает с началом сегмента?
        if (Math.abs(lastPt[0] - segFirst[0]) < 1e-7 && Math.abs(lastPt[1] - segFirst[1]) < 1e-7) {
          ring.push(...seg.slice(1));
          used.add(i);
          changed = true;
          break;
        }
        // Конец кольца совпадает с концом сегмента? (реверс)
        if (Math.abs(lastPt[0] - segLast[0]) < 1e-7 && Math.abs(lastPt[1] - segLast[1]) < 1e-7) {
          ring.push(...seg.slice(0, -1).reverse());
          used.add(i);
          changed = true;
          break;
        }
      }
    }

    if (ring.length >= 3) {
      rings.push(ring);
    }
  }

  return rings;
}

function tagToSeverityAndType(tags = {}) {
  // ── Critical: военные объекты, стрельбища, ядерные полигоны ──
  if (tags.military === 'danger_area') return { severity: 'critical', type: 'military_danger' };
  if (tags.military === 'nuclear_testing_site') return { severity: 'critical', type: 'nuclear' };
  if (tags.military === 'range') return { severity: 'critical', type: 'military_range' };
  if (tags.landuse === 'military' || tags.military) return { severity: 'critical', type: 'military' };

  // ── Restricted: аэродромы, тюрьмы, пограничные зоны, закрытые территории ──
  if (tags.aeroway) return { severity: 'restricted', type: 'aerodrome' };
  if (tags.amenity === 'prison') return { severity: 'restricted', type: 'prison' };
  if (tags.boundary === 'border_zone') return { severity: 'restricted', type: 'border_zone' };
  if (tags.access === 'no' && tags.landuse) return { severity: 'restricted', type: 'closed_area' };

  // ── Warning: заповедники, нацпарки ──
  if (tags.boundary === 'protected_area') return { severity: 'warning', type: 'protected_area' };
  if (tags.boundary === 'national_park') return { severity: 'warning', type: 'national_park' };
  if (tags.leisure === 'nature_reserve') return { severity: 'warning', type: 'nature_reserve' };

  return { severity: 'restricted', type: 'restricted' };
}

function groupByType(polygons) {
  const groups = new Map();
  for (const p of polygons) {
    const { severity, type } = tagToSeverityAndType(p.tags);
    const name = p.tags?.name || `${type}`;
    const key = `${type}:${severity}`;
    if (!groups.has(key)) groups.set(key, { name, type, severity, polygons: [] });
    groups.get(key).polygons.push(p.coords);
  }
  return Array.from(groups.values());
}

async function importZones(groups) {
  const payload = { type: 'FeatureCollection', features: groups.map(z => ({ properties: { name: z.name, type: z.type, severity: z.severity }, geometry: { type: 'MultiPolygon', coordinates: z.polygons.map(ring => [ring]) } })) };
  const resp = await axios.post(BACKEND_IMPORT_URL, payload, { headers: { 'Content-Type': 'application/json' } });
  return resp.data;
}

async function processDistrict(key) {
  const bbox = DISTRICTS[key];
  if (!bbox) throw new Error(`Unknown district key: ${key}`);
  console.log(`\n=== ${key.toUpperCase()} ===`);
  const tiles = splitBBox(bbox);
  let all = [];
  for (const tile of tiles) {
    const data = await fetchOverpass(overpassQuery(tile));
    console.log(`Tile -> elements: ${data.elements.length}`);
    all = all.concat(data.elements);
  }
  const nodesMap = buildNodesMap(all);
  const polygons = assemblePolygons(all, nodesMap);
  console.log(`Polygons: ${polygons.length}`);
  const groups = groupByType(polygons);
  console.log(`Groups: ${groups.length}. Importing...`);
  const res = await importZones(groups);
  console.log('Import stats:', res?.stats || res);
}

async function main() {
  const arg = (process.argv.find(a => a.startsWith('--district=')) || '').split('=')[1] || 'all';
  const noClear = process.argv.includes('--no-clear');
  const keys = arg === 'all' ? Object.keys(DISTRICTS) : arg.split(',').map(s => s.trim());

  // Очищаем зоны перед полным импортом (если не указан --no-clear)
  if (!noClear) {
    console.log('Очистка предыдущих зон перед импортом...');
    try {
      await axios.post(BACKEND_IMPORT_URL.replace('/import', '/clear'), {}, {
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {
        // Если /clear требует авторизации, игнорируем — новые зоны с дедупликацией
        console.warn('Не удалось очистить старые зоны (возможно нужна авторизация). Дедупликация на стороне бэкенда.');
      });
    } catch {}
  }

  for (const key of keys) {
    try {
      await processDistrict(key);
    } catch (e) {
      console.error(`Failed ${key}:`, e?.response?.data || e?.message || e);
    }
  }
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Fatal:', e?.response?.data || e?.message || e);
  process.exit(1);
});



