import { describe, it, expect, vi, afterEach } from 'vitest';
import * as zoneService from '../zoneService';

// fake small timezone functionality

describe('zoneService helpers', () => {
  it('getCacheKey rounds coordinates to 5 decimals', () => {
    expect(zoneService.getCacheKey(55.1234567, 37.7654321)).toBe('55.12346,37.76543');
    expect(zoneService.getCacheKey(0, 0)).toBe('0.00000,0.00000');
  });

  it('caches and retrieves point results correctly', () => {
    const lat = 10.12345;
    const lon = 20.54321;
    const result = { isValid: true, blocked: false, warnings: [], criticalZones: [], restrictedZones: [] } as any;
    zoneService.setCachedResult(lat, lon, result);
    const cached = zoneService.getCachedResult(lat, lon);
    expect(cached).toBe(result);
  });

  it('returns null after TTL expires', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const lat = 1;
    const lon = 2;
    const result = { isValid: true, blocked: false, warnings: [], criticalZones: [], restrictedZones: [] } as any;
    zoneService.setCachedResult(lat, lon, result);
    // advance time beyond TTL
    vi.spyOn(Date, 'now').mockReturnValue(now + zoneService.CACHE_TTL + 1);
    expect(zoneService.getCachedResult(lat, lon)).toBeNull();
    vi.restoreAllMocks();
  });

  it('route cache key concatenates points', () => {
    const coords: [number, number][] = [[1,2],[3,4]];
    expect(zoneService.getRouteCheckCacheKey(coords)).toBe('1.00000,2.00000;3.00000,4.00000');
  });

  it('withRetry succeeds after retries', async () => {
    let count = 0;
    const fn = vi.fn(async () => {
      count++;
      if (count < 2) throw new Error('fail');
      return 'ok';
    });
    const val = await zoneService.withRetry(fn, 2);
    expect(val).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('withRetry throws after exceeding retries', async () => {
    const fn = vi.fn(async () => { throw new Error('fatal'); });
    await expect(zoneService.withRetry(fn, 1)).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(2); // initial + one retry
  });
});

// Mock api.post for checkPoint and checkRoute
vi.mock('../api', () => ({
  default: {
    post: vi.fn()
  }
}));

// Mock features config
vi.mock('../config/features', () => ({
  FEATURES: {
    CHAT_ENABLED: false,
    REALTIME_ENABLED: false,
    USER_INTERACTION_ENABLED: false,
    GEOGRAPHIC_RESTRICTIONS_ENABLED: true,
    RUSSIA_COMPLIANCE_MODE: true, // default
  }
}));

import api from '../api';

describe('zoneService checkPoint & checkRoute', () => {
  afterEach(() => {
    // clear caches
    zoneService.pointCheckCache.clear();
    zoneService.routeCheckCache.clear();
  });

  it('checkPoint returns cached value when exists', async () => {
    const lat=1, lon=2;
    const fake = { isValid: true, blocked: false, warnings: [], criticalZones: [], restrictedZones: [] };
    zoneService.setCachedResult(lat, lon, fake);
    const res = await zoneService.checkPoint(lat, lon);
    expect(res).toBe(fake);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('checkPoint handles API error fallback when not compliance mode', async () => {
    // ensure features disable compliance
    zoneService.FEATURES.RUSSIA_COMPLIANCE_MODE = false;
    (api.post as any).mockRejectedValue(new Error('network'));
    const res = await zoneService.checkPoint(55, 37);
    expect(res.isValid).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.message).toContain('Не удалось проверить');
  });

  it('checkRoute caches and returns route results', async () => {
    (api.post as any).mockResolvedValue({ data: { results: [] } });
    const coords: [number, number][] = [[55,37]];
    const r1 = await zoneService.checkRoute(coords);
    const r2 = await zoneService.checkRoute(coords);
    expect(r2).toBe(r1);
  });
});