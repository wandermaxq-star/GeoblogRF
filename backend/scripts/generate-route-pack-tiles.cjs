#!/usr/bin/env node
// Node script to build a tile extract for a curated route pack.
// Usage: node scripts/generate-route-pack-tiles.cjs <packId> [outputDir]
// Requires external tools installed: ogr2ogr (GDAL), tippecanoe or similar.

import fs from 'fs';
import path from 'path';
import pool from '../src/db.js';
import packs from '../src/data/curatedRoutePacks.js';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: generate-route-pack-tiles <packId> [outputDir]');
  process.exit(1);
}
const packId = args[0];
const outDir = args[1] || path.join(process.cwd(), 'tmp', packId);

async function loadPack(id) {
  // try database first
  if (pool) {
    try {
      const res = await pool.query('SELECT data FROM curated_route_packs WHERE id = $1', [id]);
      if (res.rows.length > 0) return res.rows[0].data;
    } catch (e) {
      console.warn('db lookup failed, falling back to static file', e.message);
    }
  }
  return packs.find((p) => p.id === id);
}

async function main() {
  const pack = await loadPack(packId);
  if (!pack) {
    console.error('Pack not found', packId);
    process.exit(2);
  }

  // For this example we assume the pack contains variants with waypoint coordinates
  // and that the route geometry is produced externally or described in pack.
  // Here we simply create a GeoJSON LineString by connecting waypoints in order.
  const variant = pack.variants[0];
  if (!variant) {
    console.error('No variant available on pack', packId);
    process.exit(3);
  }

  const coords = variant.waypoints.map((wp) => wp.coordinates);
  const routeGeojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: packId }
        ,
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      },
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  const routeFile = path.join(outDir, 'route.geojson');
  fs.writeFileSync(routeFile, JSON.stringify(routeGeojson));
  console.log('wrote', routeFile);

  // buffer by 1500 meters
  const bufferFile = path.join(outDir, 'buffer.geojson');
  console.log('running ogr2ogr buffer, requires gdal');
  console.log(`ogr2ogr -f GeoJSON ${bufferFile} ${routeFile} -dialect sqlite -sql "SELECT ST_Buffer(Geometry,1500) AS Geometry FROM route"`);
  console.log('now you can use tippecanoe or gdal2tiles on', bufferFile);

  // example tippecanoe command:
  console.log('tippecanoe -o', path.join(outDir, `${packId}.mbtiles`), '--drop-densest-as-needed --extent=4096 --buffer=128', bufferFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});