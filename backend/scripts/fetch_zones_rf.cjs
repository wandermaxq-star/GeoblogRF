/* eslint-disable no-console */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Конфигурация ────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const BACKEND_IMPORT_URL = process.env.ZONES_IMPORT_URL || 'http://localhost:3002/api/zones/import';

// Файл прогресса — при сбое скрипт продолжит с места остановки
const PROGRESS_FILE = path.join(__dirname, '.fetch_zones_progress.json');
// Директория кэша — уже загруженные элементы по тайлам
const CACHE_DIR = path.join(__dirname, '.zones_cache');

// Задержка между запросами к Overpass (мс) — уважаем rate-limit
const DELAY_BETWEEN_REQUESTS_MS = 2000;
// Максимальная глубина рекурсивного дробления bbox при ошибке
const MAX_SPLIT_DEPTH = 4;
// Макс. ретраев на один endpoint
const MAX_RETRIES_PER_ENDPOINT = 3;
// Базовая задержка backoff (мс) — каждый ретрай ×2
const BASE_BACKOFF_MS = 5000;
// Таймаут одного HTTP-запроса (мс)
const HTTP_TIMEOUT_MS = 240_000;

// Примерные bbox по федеральным округам РФ (минLon, минLat, максLon, максLat)
const DISTRICTS = {
  cfo:  [30.0, 52.0, 42.0, 58.5],
  szfo: [26.0, 58.0, 60.0, 69.0],
  yfo:  [36.0, 44.0, 50.0, 58.5],
  skfo: [40.0, 41.0, 48.5, 47.5],
  pfo:  [45.0, 52.0, 56.5, 58.5],
  urfo: [56.0, 53.0, 75.0, 67.0],
  sfo:  [60.0, 49.0, 90.0, 75.0],
  dfo:  [120.0, 42.0, 165.0, 75.0]
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bboxToQuery([minLon, minLat, maxLon, maxLat]) {
  return `${minLat},${minLon},${maxLat},${maxLon}`;
}

function bboxKey(bbox) { return bbox.join(','); }

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

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function tileCachePath(bbox) {
  const name = bbox.map(v => v.toFixed(4)).join('_');
  return path.join(CACHE_DIR, `tile_${name}.json`);
}

function loadTileCache(bbox) {
  const p = tileCachePath(bbox);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { /* повреждённый файл — перезапросим */ }
  }
  return null;
}

function saveTileCache(bbox, elements) {
  ensureCacheDir();
  fs.writeFileSync(tileCachePath(bbox), JSON.stringify(elements));
}

// ─── Прогресс ────────────────────────────────────────────────────────────────

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); } catch {}
  }
  return { completedDistricts: [], completedTiles: {} };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function clearProgress() {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (fs.existsSync(CACHE_DIR)) {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const f of files) fs.unlinkSync(path.join(CACHE_DIR, f));
      fs.rmdirSync(CACHE_DIR);
    } catch {}
  }
}

// ─── Overpass запрос ─────────────────────────────────────────────────────────

function overpassQuery(bbox) {
  const box = bboxToQuery(bbox);
  return `
  [out:json][timeout:180];
  (
    // Военные объекты (critical)
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

    // Аэродромы / ВПП / вертолётные площадки (restricted)
    way["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});
    rel["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});

    // Особо охраняемые природные территории (warning)
    way["boundary"="protected_area"](${box});
    rel["boundary"="protected_area"](${box});
    way["boundary"="national_park"](${box});
    rel["boundary"="national_park"](${box});
    way["leisure"="nature_reserve"](${box});
    rel["leisure"="nature_reserve"](${box});

    // Закрытые зоны / ограниченный доступ (restricted)
    way["access"="no"]["landuse"](${box});
    rel["access"="no"]["landuse"](${box});

    // Исправительные учреждения (restricted)
    way["amenity"="prison"](${box});
    rel["amenity"="prison"](${box});

    // Пограничные зоны (restricted)
    way["boundary"="border_zone"](${box});
    rel["boundary"="border_zone"](${box});
  );
  out body;
  >;
  out skel qt;
  `;
}

/**
 * Fetch с ротацией серверов + экспоненциальным backoff.
 * Каждый endpoint пробуется MAX_RETRIES_PER_ENDPOINT раз.
 * При 429 / 504 / timeout — ждём дольше.
 */
async function fetchOverpass(query) {
  let lastErr;

  for (const url of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_ENDPOINT; attempt++) {
      try {
        const { data } = await axios.post(url, query, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          timeout: HTTP_TIMEOUT_MS,
          decompress: true
        });

        if (!data || typeof data !== 'object' || !Array.isArray(data.elements)) {
          throw new Error('Non-JSON or invalid Overpass response');
        }
        return data;
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        const isRateLimit = status === 429 || status === 504 || status === 503;
        const backoff = isRateLimit
          ? BASE_BACKOFF_MS * Math.pow(3, attempt)   // 15s, 45s, 135s для rate-limit
          : BASE_BACKOFF_MS * Math.pow(2, attempt - 1); // 5s, 10s, 20s для обычных ошибок

        const reason = status ? `HTTP ${status}` : (e.code || e.message || 'unknown');
        console.warn(`  ⚠ ${url} attempt ${attempt}/${MAX_RETRIES_PER_ENDPOINT} failed (${reason}). Waiting ${(backoff / 1000).toFixed(0)}s...`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

/**
 * Загружает тайл с адаптивным дроблением: если запрос не проходит
 * даже после всех ретраёв — bbox делится на 4 части, каждая запрашивается отдельно.
 * Рекурсивно, до MAX_SPLIT_DEPTH уровней.
 */
async function fetchTileAdaptive(bbox, depth = 0) {
  // Проверяем кэш
  const cached = loadTileCache(bbox);
  if (cached) {
    console.log(`  ✓ Тайл из кэша [${bboxKey(bbox)}] — ${cached.length} элементов`);
    return cached;
  }

  try {
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
    const data = await fetchOverpass(overpassQuery(bbox));
    console.log(`  ✓ Тайл [${bboxKey(bbox)}] — ${data.elements.length} элементов`);
    saveTileCache(bbox, data.elements);
    return data.elements;
  } catch (e) {
    if (depth >= MAX_SPLIT_DEPTH) {
      console.error(`  ✗ Тайл [${bboxKey(bbox)}] не удалось загрузить даже после дробления (глубина ${depth}). Пропуск.`);
      return [];
    }

    console.warn(`  ↓ Тайл [${bboxKey(bbox)}] — ошибка, дроблю на 4 подтайла (глубина ${depth + 1})...`);
    const subTiles = splitBBox(bbox);
    let all = [];
    for (const sub of subTiles) {
      const elements = await fetchTileAdaptive(sub, depth + 1);
      all = all.concat(elements);
    }
    saveTileCache(bbox, all);
    return all;
  }
}

// ─── Сборка геометрий ────────────────────────────────────────────────────────

function buildNodesMap(elements) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === 'node') map.set(el.id, [el.lon, el.lat]);
  }
  return map;
}

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

function assemblePolygons(elements, nodesMap) {
  const waysMap = buildWaysMap(elements, nodesMap);
  const polygons = [];

  // 1) Way-полигоны
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

  // 2) Relations type=multipolygon — собираем outer-кольца
  for (const el of elements) {
    if (el.type !== 'relation') continue;
    const tags = el.tags || {};
    if (tags.type !== 'multipolygon' && tags.type !== 'boundary') continue;
    if (!Array.isArray(el.members)) continue;

    const outerWayIds = el.members
      .filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '' || !m.role))
      .map(m => m.ref);

    const rings = assembleRingsFromWays(outerWayIds, waysMap, nodesMap);
    const relTags = { ...tags };

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

function assembleRingsFromWays(wayIds, waysMap, _nodesMap) {
  const segments = [];
  for (const id of wayIds) {
    const w = waysMap.get(id);
    if (w && w.coords.length >= 2) {
      segments.push([...w.coords]);
    }
  }

  const rings = [];
  const used = new Set();

  while (used.size < segments.length) {
    let startIdx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (!used.has(i)) { startIdx = i; break; }
    }
    if (startIdx < 0) break;

    const ring = [...segments[startIdx]];
    used.add(startIdx);

    let changed = true;
    while (changed) {
      changed = false;
      const lastPt = ring[ring.length - 1];
      const firstPt = ring[0];

      if (ring.length >= 4 && Math.abs(lastPt[0] - firstPt[0]) < 1e-7 && Math.abs(lastPt[1] - firstPt[1]) < 1e-7) {
        break;
      }

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const seg = segments[i];
        const segFirst = seg[0];
        const segLast = seg[seg.length - 1];

        if (Math.abs(lastPt[0] - segFirst[0]) < 1e-7 && Math.abs(lastPt[1] - segFirst[1]) < 1e-7) {
          ring.push(...seg.slice(1));
          used.add(i);
          changed = true;
          break;
        }
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

// ─── Классификация ───────────────────────────────────────────────────────────

function tagToSeverityAndType(tags = {}) {
  if (tags.military === 'danger_area') return { severity: 'critical', type: 'military_danger' };
  if (tags.military === 'nuclear_testing_site') return { severity: 'critical', type: 'nuclear' };
  if (tags.military === 'range') return { severity: 'critical', type: 'military_range' };
  if (tags.landuse === 'military' || tags.military) return { severity: 'critical', type: 'military' };

  if (tags.aeroway) return { severity: 'restricted', type: 'aerodrome' };
  if (tags.amenity === 'prison') return { severity: 'restricted', type: 'prison' };
  if (tags.boundary === 'border_zone') return { severity: 'restricted', type: 'border_zone' };
  if (tags.access === 'no' && tags.landuse) return { severity: 'restricted', type: 'closed_area' };

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

// ─── Импорт ──────────────────────────────────────────────────────────────────

async function importZones(groups) {
  const payload = {
    type: 'FeatureCollection',
    features: groups.map(z => ({
      properties: { name: z.name, type: z.type, severity: z.severity },
      geometry: {
        type: 'MultiPolygon',
        coordinates: z.polygons.map(ring => [ring])
      }
    }))
  };
  const resp = await axios.post(BACKEND_IMPORT_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });
  return resp.data;
}

// ─── Обработка округа ────────────────────────────────────────────────────────

async function processDistrict(key, progress) {
  const bbox = DISTRICTS[key];
  if (!bbox) throw new Error(`Unknown district key: ${key}`);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Округ: ${key.toUpperCase()}`);
  console.log(`${'═'.repeat(50)}`);

  // Начальное деление на 4 тайла
  const tiles = splitBBox(bbox);
  let allElements = [];

  for (let i = 0; i < tiles.length; i++) {
    const tileKey = bboxKey(tiles[i]);

    // Проверяем, не загружали ли уже этот тайл в этом запуске
    if (progress.completedTiles[key]?.includes(tileKey)) {
      const cached = loadTileCache(tiles[i]);
      if (cached) {
        console.log(`  [${i + 1}/4] Уже загружен ранее, из кэша — ${cached.length} элементов`);
        allElements = allElements.concat(cached);
        continue;
      }
    }

    console.log(`  [${i + 1}/4] Загрузка тайла...`);
    const elements = await fetchTileAdaptive(tiles[i], 0);
    allElements = allElements.concat(elements);

    // Сохраняем прогресс по тайлу
    if (!progress.completedTiles[key]) progress.completedTiles[key] = [];
    progress.completedTiles[key].push(tileKey);
    saveProgress(progress);
  }

  // Дедупликация элементов (при дроблении могут быть пересечения)
  const seen = new Set();
  const deduped = [];
  for (const el of allElements) {
    const uid = `${el.type}:${el.id}`;
    if (!seen.has(uid)) {
      seen.add(uid);
      deduped.push(el);
    }
  }
  console.log(`  Всего элементов: ${allElements.length} → после дедупликации: ${deduped.length}`);

  const nodesMap = buildNodesMap(deduped);
  const polygons = assemblePolygons(deduped, nodesMap);
  console.log(`  Полигонов: ${polygons.length}`);

  const groups = groupByType(polygons);
  console.log(`  Групп: ${groups.length}. Импорт...`);

  try {
    const res = await importZones(groups);
    console.log('  ✓ Импорт:', res?.stats || res);
  } catch (e) {
    console.error(`  ✗ Ошибка импорта: ${e?.response?.data?.error || e.message}`);
    throw e;
  }

  // Записываем округ как завершённый
  progress.completedDistricts.push(key);
  saveProgress(progress);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const districtArg = (args.find(a => a.startsWith('--district=')) || '').split('=')[1] || 'all';
  const noClear = args.includes('--no-clear');
  const resume = args.includes('--resume');
  const cleanCache = args.includes('--clean');

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Импорт зон РФ из OpenStreetMap (Overpass)  ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Очистка кэша и прогресса
  if (cleanCache) {
    console.log('Очистка кэша и файла прогресса...');
    clearProgress();
    console.log('Готово.');
    return;
  }

  const allKeys = districtArg === 'all' ? Object.keys(DISTRICTS) : districtArg.split(',').map(s => s.trim());

  // Загружаем или создаём прогресс
  let progress;
  if (resume) {
    progress = loadProgress();
    const done = progress.completedDistricts.length;
    if (done > 0) {
      console.log(`\nПродолжение с прошлого запуска. Уже завершено: ${progress.completedDistricts.map(k => k.toUpperCase()).join(', ')}`);
    }
  } else {
    progress = { completedDistricts: [], completedTiles: {} };
    clearProgress();
  }

  // Очистка зон перед импортом
  if (!noClear && !resume) {
    console.log('\nОчистка предыдущих зон перед импортом...');
    try {
      await axios.post(BACKEND_IMPORT_URL.replace('/import', '/clear'), {}, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log('✓ Старые зоны очищены.');
    } catch {
      console.warn('⚠ Не удалось очистить старые зоны. Импорт продолжится с дедупликацией.');
    }
  }

  const keysToProcess = allKeys.filter(k => !progress.completedDistricts.includes(k));

  if (keysToProcess.length === 0) {
    console.log('\nВсе округа уже обработаны. Используйте без --resume для полного перезапуска.');
    clearProgress();
    return;
  }

  console.log(`\nПлан: ${keysToProcess.map(k => k.toUpperCase()).join(' → ')}`);
  console.log(`Задержка между запросами: ${DELAY_BETWEEN_REQUESTS_MS}мс | Макс. дробление: ${MAX_SPLIT_DEPTH} уровней | Backoff: ${BASE_BACKOFF_MS}мс`);

  let failed = 0;
  for (const key of keysToProcess) {
    try {
      await processDistrict(key, progress);
    } catch (e) {
      failed++;
      console.error(`\n✗ Округ ${key.toUpperCase()} не удался: ${e?.response?.data || e?.message || e}`);
      console.log('  Прогресс сохранён. Перезапустите с --resume чтобы продолжить.');
    }
  }

  if (failed === 0) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log('  ✓ Все округа успешно обработаны!');
    console.log(`${'═'.repeat(50)}`);
    clearProgress();
  } else {
    console.log(`\n${failed} из ${keysToProcess.length} округов не удались.`);
    console.log('Перезапустите с --resume чтобы продолжить с места остановки.');
  }
}

main().catch(e => {
  console.error('Fatal:', e?.response?.data || e?.message || e);
  process.exit(1);
});
