// zones functionality disabled on backend; stubs returned to keep API shape

/**
 * All functions here simply return harmless defaults.  
 * The full implementation lives in `zoneGuard.js` but is not imported
 * while the feature is turned off to avoid CPU and memory overhead.
 */

export async function checkPointAgainstZones() {
  return [];
}

export async function checkLineAgainstZones() {
  return [];
}

export function addZonesFromGeoJSON() {
  return 0;
}

export function clearZones() {
  // no-op
}

export function getZonesStats() {
  return { total: 0, bySeverity: {}, byType: {} };
}

export function getZonesSnapshot() {
  return [];
}

export function getZonesFilePath() {
  return './data/zones.geojson';
}
