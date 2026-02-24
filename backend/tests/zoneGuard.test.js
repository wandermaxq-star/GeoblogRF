import {
  checkPointAgainstZones,
  checkLineAgainstZones,
  addZonesFromGeoJSON,
  clearZones,
  getZonesStats,
  getZonesSnapshot,
} from '../src/utils/zoneGuard.js';

// В тестах отключаем персистенцию на диск
const importZones = (geojson) => addZonesFromGeoJSON(geojson, /* persist= */ false);
const resetZones = () => clearZones(/* persistAfterClear= */ false);

// Тестовый GeoJSON полигона (примерная зона вокруг Кремля)
const kremlinZoneGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Зона Кремль',
        type: 'military',
        severity: 'critical',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [37.613, 55.752],
          [37.623, 55.752],
          [37.623, 55.758],
          [37.613, 55.758],
          [37.613, 55.752],
        ]],
      },
    },
  ],
};

const warningZoneGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Зона предупреждения',
        type: 'protected_area',
        severity: 'warning',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [30.30, 59.93],
          [30.35, 59.93],
          [30.35, 59.95],
          [30.30, 59.95],
          [30.30, 59.93],
        ]],
      },
    },
  ],
};

describe('Zone Guard utilities', () => {
  afterEach(() => {
    resetZones();
  });

  describe('addZonesFromGeoJSON', () => {
    test('imports zones from GeoJSON FeatureCollection', () => {
      const count = importZones(kremlinZoneGeoJSON);
      expect(count).toBe(1);
    });

    test('returns 0 for null/empty input', () => {
      expect(importZones(null)).toBe(0);
      expect(importZones({})).toBe(0);
    });

    test('imports MultiPolygon geometry', () => {
      const multiGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Multi', severity: 'restricted' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [[[37.0, 55.0], [37.1, 55.0], [37.1, 55.1], [37.0, 55.1], [37.0, 55.0]]],
              [[[38.0, 56.0], [38.1, 56.0], [38.1, 56.1], [38.0, 56.1], [38.0, 56.0]]],
            ],
          },
        }],
      };
      const count = importZones(multiGeoJSON);
      expect(count).toBe(2);
    });

    test('ignores features without geometry', () => {
      const noGeom = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {} }],
      };
      expect(importZones(noGeom)).toBe(0);
    });

    test('deduplicates identical zones', () => {
      importZones(kremlinZoneGeoJSON);
      const count2 = importZones(kremlinZoneGeoJSON);
      expect(count2).toBe(0); // дубль не импортируется
      expect(getZonesStats().total).toBe(1);
    });
  });

  describe('clearZones', () => {
    test('removes all zones', () => {
      importZones(kremlinZoneGeoJSON);
      expect(getZonesStats().total).toBe(1);
      resetZones();
      expect(getZonesStats().total).toBe(0);
    });
  });

  describe('getZonesStats', () => {
    test('returns correct stats after import', () => {
      importZones(kremlinZoneGeoJSON);
      importZones(warningZoneGeoJSON);
      const stats = getZonesStats();
      expect(stats.total).toBe(2);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.byType.military).toBe(1);
      expect(stats.byType.protected_area).toBe(1);
    });

    test('returns zeros when empty', () => {
      const stats = getZonesStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('getZonesSnapshot', () => {
    test('returns all zone data', () => {
      importZones(kremlinZoneGeoJSON);
      const snapshot = getZonesSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].name).toBe('Зона Кремль');
      expect(snapshot[0].severity).toBe('critical');
      expect(snapshot[0].polygons).toBeDefined();
      expect(snapshot[0].bbox).toBeDefined();
    });
  });

  describe('checkPointAgainstZones', () => {
    beforeEach(() => {
      importZones(kremlinZoneGeoJSON);
    });

    test('detects point inside zone', async () => {
      // Точка внутри зоны Кремля
      const hits = await checkPointAgainstZones(37.618, 55.755);
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].name).toBe('Зона Кремль');
      expect(hits[0].severity).toBe('critical');
    });

    test('returns empty for point outside zone', async () => {
      // Точка далеко от зоны
      const hits = await checkPointAgainstZones(30.0, 50.0);
      expect(hits.length).toBe(0);
    });

    test('detects point in buffer zone', async () => {
      // Точка чуть за пределами зоны, но в буферной зоне (~0.018° = ~2 км для critical)
      const hits = await checkPointAgainstZones(37.630, 55.755);
      // Должна быть в буфере (расстояние ~0.007° < 0.018°)
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].inBuffer).toBe(true);
    });

    test('returns empty for point far outside buffer', async () => {
      // Точка далеко за пределами буфера
      const hits = await checkPointAgainstZones(37.700, 55.755);
      expect(hits.length).toBe(0);
    });
  });

  describe('checkLineAgainstZones', () => {
    beforeEach(() => {
      importZones(kremlinZoneGeoJSON);
    });

    test('detects line passing through zone', async () => {
      const line = [
        [37.610, 55.750],  // до зоны
        [37.618, 55.755],  // внутри зоны
        [37.630, 55.760],  // после зоны
      ];
      const hits = await checkLineAgainstZones(line);
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].name).toBe('Зона Кремль');
    });

    test('detects line segment crossing zone without vertices inside', async () => {
      // Линия из двух точек, обе ВНЕ зоны, но сегмент проходит ЧЕРЕЗ неё
      const line = [
        [37.618, 55.740],  // ниже зоны
        [37.618, 55.770],  // выше зоны
      ];
      const hits = await checkLineAgainstZones(line);
      // Сегмент пересекает границы полигона зоны
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].name).toBe('Зона Кремль');
    });

    test('returns empty for line not passing through zone', async () => {
      const line = [
        [30.0, 50.0],
        [30.1, 50.1],
      ];
      const hits = await checkLineAgainstZones(line);
      expect(hits.length).toBe(0);
    });

    test('deduplicates zone hits across multiple vertices', async () => {
      const line = [
        [37.615, 55.754],  // внутри
        [37.618, 55.755],  // внутри
        [37.620, 55.756],  // внутри
      ];
      const hits = await checkLineAgainstZones(line);
      // Та же зона — дедупликация
      const kremlinHits = hits.filter(h => h.name === 'Зона Кремль');
      expect(kremlinHits.length).toBe(1);
    });
  });

  describe('multiple zones', () => {
    test('detects which specific zone a point is in', async () => {
      importZones(kremlinZoneGeoJSON);
      importZones(warningZoneGeoJSON);

      // Точка в Кремле
      const kremlinHits = await checkPointAgainstZones(37.618, 55.755);
      expect(kremlinHits.length).toBeGreaterThanOrEqual(1);
      expect(kremlinHits[0].severity).toBe('critical');

      // Точка в СПб
      const spbHits = await checkPointAgainstZones(30.32, 59.94);
      expect(spbHits.length).toBeGreaterThanOrEqual(1);
      expect(spbHits[0].severity).toBe('warning');

      // Точка вне обеих зон
      const noneHits = await checkPointAgainstZones(40.0, 60.0);
      expect(noneHits.length).toBe(0);
    });
  });
});
