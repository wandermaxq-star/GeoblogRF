/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { offlineService } from '../src/services/offlineService';
import type { CuratedRoutePack, CuratedRouteVariant, CuratedRouteWaypoint } from '../src/types/proRoutePacks';

describe('offlineService utility methods', () => {
  const sampleWaypoint: CuratedRouteWaypoint = {
    id: 'wp1',
    title: 'Точка 1',
    regionId: 'r1',
    coordinates: [55, 37],
    kind: 'poi',
    estimatedTileWeightMb: 5,
    isRequired: false,
    isDefaultEnabled: true,
  };

  const sampleVariant: CuratedRouteVariant = {
    id: 'v1',
    title: 'Вариант 1',
    durationLabel: '1 день',
    distanceLabel: '100 км',
    estimatedBaseSizeMb: 10,
    summary: 'Краткое описание варианта',
    waypoints: [sampleWaypoint],
  };


  const samplePack: CuratedRoutePack = {
    id: 'pack1',
    slug: 'pack-1',
    title: 'Пакет 1',
    subtitle: 'Подзаголовок',
    summary: 'Описание пакета',
    highlight: 'Главная фишка',
    routeKind: 'regional',
    regions: ['r1', 'r2'],
    tags: ['tag1'],
    heroMetric: 'метрика',
    variants: [sampleVariant],
  };

  it('calculates included waypoints correctly', () => {
    // by default no IDs enabled, so list is empty despite default flags
    let included = offlineService['getIncludedWaypoints'](sampleVariant, []);
    expect(included).toEqual([]);

    // if ID explicitly enabled, it appears
    included = offlineService['getIncludedWaypoints'](sampleVariant, ['wp1']);
    expect(included).toEqual([sampleWaypoint]);

    // if waypoint is not default-enabled and not required, still empty
    const v2: CuratedRouteVariant = { ...sampleVariant, waypoints: [{ ...sampleWaypoint, isDefaultEnabled: false }] };
    included = offlineService['getIncludedWaypoints'](v2, []);
    expect(included).toEqual([]);
  });

  it('collects covered regions (pack + waypoints)', () => {
    const waypoints: CuratedRouteWaypoint[] = [sampleWaypoint];
    const regions = offlineService['collectCoveredRegions'](samplePack, waypoints);
    expect(new Set(regions)).toEqual(new Set(['r1', 'r2']));
  });

  it('builds route pack tile urls correctly', () => {
    const tiles = offlineService['buildRoutePackTiles'](
      samplePack,
      [sampleWaypoint],
      ['r1', 'r2'],
      'route_corridor',
      'trimmed',
    ) as any;
    expect(tiles.cities).toEqual([`offline://${samplePack.id}/trimmed/city/${sampleWaypoint.id}`]);
    expect(tiles.corridor).toEqual([`offline://${samplePack.id}/trimmed/corridor/r1`, `offline://${samplePack.id}/trimmed/corridor/r2`]);
  });

  it('estimates download size consistently', async () => {
    const size = await offlineService.estimateRoutePackDownloadSize(
      samplePack,
      sampleVariant,
      ['wp1'],
      'route_data',
      'user1',
      'trimmed',
    );
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThan(0);
  });

  it('getDownloadedRegions considers pack coverage', async () => {
    const fakePack = {
      storageKey: 'pack1',
      packId: 'pack1',
      packSlug: 'slug',
      packTitle: 'title',
      variantId: 'v1',
      variantTitle: 'v1',
      downloadType: 'route_data',
      tileVersion: 'trimmed',
      downloadedAt: Date.now(),
      coveredRegionIds: ['rX', 'rY'],
      includedWaypointIds: [],
      includedWaypoints: [],
      userMarkers: [],
      userRoutes: [],
      userEvents: [],
      userPosts: [],
    } as any;

    // stub getAll so that getDownloadedRegions sees our fake pack
    const origGetAll = (offlineService as any).getAll.bind(offlineService);
    (offlineService as any).getAll = async (storeName: string) => {
      if (storeName === 'routePacks') return [fakePack];
      if (storeName === 'regions') return [];
      return [];
    };

    const regions = await offlineService.getDownloadedRegions();
    expect(regions).toEqual(expect.arrayContaining(['rX', 'rY']));

    // restore original
    (offlineService as any).getAll = origGetAll;
  });

  it('deleteRoutePackData invokes getDownloadedRegions', async () => {
    // stub getDownloadedRegions to detect the call
    let called = false;
    const origGetDownloaded = offlineService.getDownloadedRegions.bind(offlineService);
    offlineService.getDownloadedRegions = async () => {
      called = true;
      return ['a', 'b'];
    };

    // avoid actual IndexedDB deletion by stubbing method
    const origDeleteByKey = (offlineService as any).deleteByKey.bind(offlineService);
    (offlineService as any).deleteByKey = async () => undefined;

    await offlineService.deleteRoutePackData('pack123');

    expect(called).toBe(true);

    // restore originals
    offlineService.getDownloadedRegions = origGetDownloaded;
    (offlineService as any).deleteByKey = origDeleteByKey;
  });

});
