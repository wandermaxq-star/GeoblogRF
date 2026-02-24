// Node script: fetch restricted zones for Central Federal District (RU-CFO) via Overpass
// Categories: military, aerodromes, protected areas, prisons, border zones.
// Converts to GeoJSON and POSTs to backend /api/zones/import
// УСТАРЕЛ: используйте fetch_zones_rf.cjs --district=cfo для загрузки только ЦФО

/* eslint-disable no-console */
const axios = require('axios');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];
const BACKEND_IMPORT_URL = process.env.ZONES_IMPORT_URL || 'http://localhost:3002/api/zones/import';

const CFO_BBOX = [30.0, 52.0, 42.0, 58.5];

function bboxToQuery([minLon, minLat, maxLon, maxLat]) {
  return `${minLat},${minLon},${maxLat},${maxLon}`;
}

function overpassQuery(bbox) {
  const box = bboxToQuery(bbox);
  return `
  [out:json][timeout:180];
  (
    way["landuse"="military"](${box});
    rel["landuse"="military"](${box});
    way["military"](${box});
    rel["military"](${box});
    way["military"="danger_area"](${box});
    rel["military"="danger_area"](${box});
    way["military"="range"](${box});
    rel["military"="range"](${box});

    way["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});
    rel["aeroway"~"^(aerodrome|runway|helipad|heliport)$"](${box});

    way["boundary"="protected_area"](${box});
    rel["boundary"="protected_area"](${box});
    way["boundary"="national_park"](${box});
    rel["boundary"="national_park"](${box});
    way["leisure"="nature_reserve"](${box});
    rel["leisure"="nature_reserve"](${box});

    way["amenity"="prison"](${box});
    rel["amenity"="prison"](${box});
    way["boundary"="border_zone"](${box});
    rel["boundary"="border_zone"](${box});
  );
  out body;
  >;
  out skel qt;
  `;
}

function buildNodesMap(elements) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === 'node') {
      map.set(el.id, [el.lon, el.lat]);
    }
  }
  return map;
}

function buildWaysMap(elements, nodesMap) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.nodes)) {
      const coords = el.nodes.map(id => nodesMap.get(id)).filter(Boolean);
      if (coords.length >= 2) map.set(el.id, { coords, tags: el.tags || {} });
    }
  }
  return map;
}

function assembleRingsFromWays(wayIds, waysMap) {
  const segments = [];
  for (const id of wayIds) {
    const w = waysMap.get(id);
    if (w && w.coords.length >= 2) segments.push([...w.coords]);
  }
  const rings = [];
  const used = new Set();
  while (used.size < segments.length) {
    let startIdx = -1;
    for (let i = 0; i < segments.length; i++) { if (!used.has(i)) { startIdx = i; break; } }
    if (startIdx < 0) break;
    const ring = [...segments[startIdx]];
    used.add(startIdx);
    let changed = true;
    while (changed) {
      changed = false;
      const lastPt = ring[ring.length - 1];
      if (ring.length >= 4 && Math.abs(lastPt[0] - ring[0][0]) < 1e-7 && Math.abs(lastPt[1] - ring[0][1]) < 1e-7) break;
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const seg = segments[i];
        if (Math.abs(lastPt[0] - seg[0][0]) < 1e-7 && Math.abs(lastPt[1] - seg[0][1]) < 1e-7) {
          ring.push(...seg.slice(1)); used.add(i); changed = true; break;
        }
        if (Math.abs(lastPt[0] - seg[seg.length - 1][0]) < 1e-7 && Math.abs(lastPt[1] - seg[seg.length - 1][1]) < 1e-7) {
          ring.push(...seg.slice(0, -1).reverse()); used.add(i); changed = true; break;
        }
      }
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

function assemblePolygons(elements, nodesMap) {
  const waysMap = buildWaysMap(elements, nodesMap);
  const polygons = [];

  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.nodes) && el.nodes.length >= 3) {
      const coords = el.nodes.map(id => nodesMap.get(id)).filter(Boolean);
      if (coords.length >= 3) {
        const first = coords[0]; const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        polygons.push({ coords, tags: el.tags || {} });
      }
    }
  }

  // Relations type=multipolygon
  for (const el of elements) {
    if (el.type !== 'relation') continue;
    const tags = el.tags || {};
    if (tags.type !== 'multipolygon' && tags.type !== 'boundary') continue;
    if (!Array.isArray(el.members)) continue;
    const outerWayIds = el.members
      .filter(m => m.type === 'way' && (m.role === 'outer' || !m.role))
      .map(m => m.ref);
    const rings = assembleRingsFromWays(outerWayIds, waysMap);
    for (const ring of rings) {
      if (ring.length >= 3) {
        const first = ring[0]; const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        polygons.push({ coords: ring, tags });
      }
    }
  }

  return polygons;
}

function tagToSeverityAndType(tags = {}) {
  if (tags.military === 'danger_area') return { severity: 'critical', type: 'military_danger' };
  if (tags.military === 'range') return { severity: 'critical', type: 'military_range' };
  if (tags.landuse === 'military' || tags.military) return { severity: 'critical', type: 'military' };
  if (tags.aeroway) return { severity: 'restricted', type: 'aerodrome' };
  if (tags.amenity === 'prison') return { severity: 'restricted', type: 'prison' };
  if (tags.boundary === 'border_zone') return { severity: 'restricted', type: 'border_zone' };
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
    if (!groups.has(key)) {
      groups.set(key, { name, type, severity, polygons: [] });
    }
    groups.get(key).polygons.push(p.coords);
  }
  return Array.from(groups.values());
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

async function main() {
  console.log('Fetching zones for RU-CFO via Overpass (with retries, tiling, and relation support)...');
  const tiles = splitBBox(CFO_BBOX);
  let allElements = [];
  for (const tile of tiles) {
    const query = overpassQuery(tile);
    const data = await fetchOverpass(query);
    console.log(`Tile returned ${data.elements.length} elements.`);
    allElements = allElements.concat(data.elements);
  }
  console.log(`Total elements: ${allElements.length}`);

  const nodesMap = buildNodesMap(allElements);
  const polygons = assemblePolygons(allElements, nodesMap);
  console.log(`Assembled ${polygons.length} polygons (ways + relations).`);

  const zones = groupByType(polygons);
  console.log(`Prepared ${zones.length} zone groups. Importing to backend...`);

  const payload = { type: 'FeatureCollection', features: zones.map(z => ({ properties: { name: z.name, type: z.type, severity: z.severity }, geometry: { type: 'MultiPolygon', coordinates: z.polygons.map(ring => [ring]) } })) };

  const resp = await axios.post(BACKEND_IMPORT_URL, payload, { headers: { 'Content-Type': 'application/json' } });
  console.log('Import response:', resp.data);
  console.log('Done.');
}

main().catch(err => {
  console.error('Failed:', err?.response?.data || err?.message || err);
  process.exit(1);
});


