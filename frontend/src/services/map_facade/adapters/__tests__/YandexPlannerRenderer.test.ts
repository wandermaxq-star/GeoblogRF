/// <reference types="vitest" />
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { YandexPlannerRenderer } from '../YandexPlannerRenderer';
import { yandexMapsService } from '../../../yandexMapsService';

// Simple fake ymaps implementation
const makeFakeYm = () => {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  return {
    Map: class {
      container: any;
      geoObjects: any;
      events: any;
      behaviors: any;
      _center: any = [55.0, 37.0];
      _zoom: any = 10;
      _bounds: any = null;
      _behEnable?: any;
      _behDisable?: any;
      constructor(container: any, opts: any) {
        this.container = { getElement: () => document.getElementById(container) || null };
        this.geoObjects = {
          _objs: [] as any[],
          add: (o: any) => { this.geoObjects._objs.push(o); },
          remove: (o: any) => { this.geoObjects._objs = this.geoObjects._objs.filter((x: any) => x !== o); },
          removeAll: () => { this.geoObjects._objs = []; }
        };
        this.events = {
          add: (event: string, h: (...args: any[]) => void) => { handlers[event] = handlers[event] || []; handlers[event].push(h); },
          remove: (event: string, h: (...args: any[]) => void) => {
            handlers[event] = (handlers[event] || []).filter((fn: (...args: any[]) => void) => fn !== h);
          }
        };
        this.behaviors = { enable: (id: string) => { this._behEnable = id; }, disable: (id: string) => { this._behDisable = id; } };
      }
      setCenter(c: any, z?: any) { this._center = c; if (z) this._zoom = z; }
      getCenter() { return this._center; }
      setBounds(b: any, opts?: any) { this._bounds = { b, opts }; }
    },
    Polyline: class {
      points: any;
      options: any;
      constructor(points: any, data: any, opts: any) { this.points = points; this.options = opts; }
    },
    GeoObjectCollection: class { constructor(){ } }
  };
};

describe('YandexPlannerRenderer (facade extensions)', () => {
  let fakeYm: any;
  let rootDiv: HTMLDivElement;

  beforeEach(() => {
    // fake DOM container
    rootDiv = document.createElement('div');
    rootDiv.id = 'yandex-test-container';
    rootDiv.style.width = '200px';
    rootDiv.style.height = '200px';
    // Ensure offsetWidth/offsetHeight are available in JSDOM
    Object.defineProperty(rootDiv, 'offsetWidth', { value: 200, configurable: true });
    Object.defineProperty(rootDiv, 'offsetHeight', { value: 200, configurable: true });
    document.body.appendChild(rootDiv);

    // Mock ResizeObserver global (not available in JSDOM)
    (global as any).ResizeObserver = class {
      cb: Function;
      constructor(cb: Function) { this.cb = cb; }
      observe() { /* no-op */ }
      disconnect() { /* no-op */ }
    } as any;

    fakeYm = makeFakeYm();
    // stub yandexMapsService.init to install our fake ymaps
    vi.spyOn(yandexMapsService, 'init').mockImplementation(async () => {
      (window as any).ymaps = fakeYm;
      // provide ready() that resolves asynchronously
      (window as any).ymaps.ready = (cb: Function) => { setTimeout(() => cb(), 0); };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.removeChild(rootDiv);
    delete (window as any).ymaps;
    delete (global as any).ResizeObserver;
  });

  it('creates and removes a polyline via facade', async () => {
    const r = new YandexPlannerRenderer();
    await r.init('yandex-test-container');

    const handle = r.createPolyline([[55.0, 37.0], [55.1, 37.1]], { color: '#ff0000', weight: 3 });
    expect(handle.id).toBeDefined();

    // polyline should be present in geoObjects
    const map = r.getMap() as any;
    expect(map.geoObjects._objs.length).toBeGreaterThanOrEqual(1);

    const addedObj = map.geoObjects._objs[map.geoObjects._objs.length - 1];
    handle.remove();
    expect(map.geoObjects._objs.find((o: any) => o === addedObj)).toBeUndefined();
  });

  it('setBounds converts domain bounds to yandex bounds', async () => {
    const r = new YandexPlannerRenderer();
    await r.init('yandex-test-container');
    r.setBounds([[55.0, 37.0], [56.0, 38.0]], { padding: 10 });
    const map = r.getMap() as any;
    expect(map._bounds).toBeDefined();
    // Expect bounds to be [[lng, lat], [lng, lat]]
    expect(map._bounds.b[0][0]).toBeCloseTo(37.0);
    expect(map._bounds.b[0][1]).toBeCloseTo(55.0);
  });

  it('on/off registers and unregisters events', async () => {
    const r = new YandexPlannerRenderer();
    await r.init('yandex-test-container');
    const handler = vi.fn();
    r.on('click', handler);
    // simulate event firing through ymaps.events implementation not available here; check wrappers stored
    // We don't have direct access to handlers object, but ensure no error on off
    r.off('click', handler);
    // should not throw
  });
});
