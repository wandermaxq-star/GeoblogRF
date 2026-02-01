import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

// Mock OSMMapRenderer so tests don't require real Leaflet DOM behavior
vi.mock('../../services/map_facade/adapters/OSMMapRenderer', () => ({
  OSMMapRenderer: class {
    init = async (_: string, __?: any) => { return; };
    getMap = () => ({ on: () => {}, off: () => {}, getZoom: () => 13 });
    destroy = () => {};
    onMapClick = (_: Function) => {};
    setView = (_: any, __?: any) => {};
    getZoom = () => 13;
  }
}));

import MiniEventMap from './MiniEventMap';

describe('MiniEventMap', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders container and does not crash', () => {
    const { container } = render(<MiniEventMap />);
    const el = container.querySelector('.mini-event-map');
    expect(el).toBeTruthy();
  });
});