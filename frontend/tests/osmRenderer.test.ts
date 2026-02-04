import { describe, it, expect } from 'vitest';
import { OSMMapRenderer } from '../src/services/map_facade/adapters/OSMMapRenderer';

describe('OSMMapRenderer', () => {
  it('getMap should return null before init', () => {
    const r = new OSMMapRenderer();
    expect(r.getMap()).toBeNull();
  });
});
