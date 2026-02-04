import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock react-dom/client createRoot
const mockRoot = { render: vi.fn(), unmount: vi.fn() };
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => mockRoot) }));

// Capture marker instances created by the mocked facade
const createdMarkers: any[] = [];

// Mock mapFacade with the minimal API used by the hook (singleton facade)
const facade = {
  createMarkerClusterGroup: vi.fn((opts: any) => ({ addLayer: vi.fn(), addTo: vi.fn() })),
  createIcon: vi.fn(),
  createDivIcon: vi.fn(),
  createMarker: vi.fn((coords: any, opts: any) => {
    const handlers: Record<string, Function> = {};
    const marker: any = {
      _coords: coords,
      _opts: opts,
      on: (ev: string, cb: Function) => { handlers[ev] = cb; },
      off: (ev: string) => { delete handlers[ev]; },
      bindPopup: vi.fn(),
      bindTooltip: vi.fn(),
      getHandlers: () => handlers,
      getPopup: () => ({ getElement: () => ({ querySelector: (s: string) => document.createElement('div') }) }),
      isPopupOpen: () => true
    };
    createdMarkers.push(marker);
    return marker;
  }),
  point: (x: number, y: number) => ({ x, y }),
  latLng: (lat: number, lng: number) => ({ lat, lng })
};

vi.mock('../../services/map_facade', () => ({ mapFacade: () => facade }));

import { useMapMarkers } from './useMapMarkers';

function TestWrapper(props: any) {
  useMapMarkers(props);
  return null;
}

describe('useMapMarkers', () => {
  beforeEach(() => {
    createdMarkers.length = 0;
    mockRoot.render.mockClear();
    mockRoot.unmount.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not create markers if mapRef is not set', async () => {
    const mapRef = { current: null } as any;
    render(<TestWrapper
      mapRef={mapRef}
      markerClusterGroupRef={{ current: null }}
      markersData={[]}
      isDarkMode={false}
      filters={{ radiusOn: false, radius: 1 }}
      searchRadiusCenter={[0,0]}
      mapSettings={{ themeColor: '#000', showHints: false }}
      openEvents={[]}
      selectedEvent={null}
      leftContent={null}
      rightContent={null}
      isMapReady={false}
      setMiniPopup={() => {} }
      setEventMiniPopup={() => {} }
      setSelectedMarkerIdForPopup={() => {} }
    />);

    const facade = (await import('../../services/map_facade')).mapFacade();
    expect(facade.createMarkerClusterGroup).not.toHaveBeenCalled();
  });

  it('creates cluster group and markers', async () => {
    const mapRef = { current: { eachLayer: () => {} } } as any;

    // Ensure the mocked facade returns the same map instance used by the hook
    const realFacade = (await import('../../services/map_facade')).mapFacade();
    (realFacade as any).getMap = () => mapRef.current;

    render(<TestWrapper
      mapRef={mapRef}
      markerClusterGroupRef={{ current: null }}
      markersData={[{ id: 'm1', latitude: '10', longitude: '20', title: 'T', category: 'other' }]}
      isDarkMode={false}
      filters={{ radiusOn: false, radius: 1 }}
      searchRadiusCenter={[0,0]}
      mapSettings={{ themeColor: '#000', showHints: true }}
      openEvents={[]}
      selectedEvent={null}
      leftContent={null}
      rightContent={null}
      isMapReady={true}
      setMiniPopup={() => {} }
      setEventMiniPopup={() => {} }
      setSelectedMarkerIdForPopup={() => {} }
    />);

    const facade = (await import('../../services/map_facade')).mapFacade();
    expect(facade.createMarkerClusterGroup).toHaveBeenCalled();
    expect(facade.createMarker).toHaveBeenCalled();
    expect(createdMarkers.length).toBeGreaterThan(0);
  });

  it('renders MarkerPopup when popupopen is fired and cleans up on popupclose', async () => {
    const mapRef = { current: { eachLayer: () => {} } } as any;
    const setMini = vi.fn();
    const hookProps = {
      mapRef,
      markerClusterGroupRef: { current: null },
      markersData: [{ id: 'm2', latitude: '10', longitude: '20', title: 'T', category: 'other' }],
      isDarkMode: false,
      filters: { radiusOn: false, radius: 1 },
      searchRadiusCenter: [0,0] as [number,number],
      mapSettings: { themeColor: '#000', showHints: true },
      openEvents: [],
      selectedEvent: null,
      leftContent: null,
      rightContent: null,
      isMapReady: true,
      setMiniPopup: setMini,
      setEventMiniPopup: () => {},
      setSelectedMarkerIdForPopup: () => {},
      onAddToFavorites: vi.fn(),
      onRemoveFromFavorites: vi.fn(),
      onHashtagClickFromPopup: vi.fn(),
      onAddToBlog: vi.fn()
    } as any;

    // Ensure the mocked facade returns the same map instance used by the hook
    const realFacade = (await import('../../services/map_facade')).mapFacade();
    (realFacade as any).getMap = () => mapRef.current;

    const { unmount } = render(<TestWrapper {...hookProps} />);

    // marker should have been created
    expect(createdMarkers.length).toBeGreaterThan(0);
    const marker = createdMarkers[0];
    const handlers = marker.getHandlers();
    expect(handlers.popupopen).toBeDefined();

    // simulate popupopen
    const popupContent = document.createElement('div');
    const popupInner = document.createElement('div');
    popupInner.className = 'leaflet-popup-content';
    popupContent.appendChild(popupInner);

    handlers.popupopen({ popup: { getElement: () => popupContent } });

    // createRoot.render should be called
    expect(mockRoot.render).toHaveBeenCalled();

    // simulate popupclose
    expect(handlers.popupclose).toBeDefined();
    handlers.popupclose();

    // root.unmount should have been called
    expect(mockRoot.unmount).toHaveBeenCalled();

    // cleanup hook
    unmount();
  });

  it('shows mini popup on mouseover and clears on mouseout', async () => {
    const mapRef = { current: { eachLayer: () => {} } } as any;
    const setMini = vi.fn();
    const realFacade = (await import('../../services/map_facade')).mapFacade();
    (realFacade as any).getMap = () => mapRef.current;

    render(<TestWrapper
      mapRef={mapRef}
      markerClusterGroupRef={{ current: null }}
      markersData={[{ id: 'm3', latitude: '10', longitude: '20', title: 'T', category: 'other' }]}
      isDarkMode={false}
      filters={{ radiusOn: false, radius: 1 }}
      searchRadiusCenter={[0,0]}
      mapSettings={{ themeColor: '#000', showHints: true }}
      openEvents={[]}
      selectedEvent={null}
      leftContent={null}
      rightContent={null}
      isMapReady={true}
      setMiniPopup={setMini}
      setEventMiniPopup={() => {} }
      setSelectedMarkerIdForPopup={() => {} }
    />);

    expect(createdMarkers.length).toBeGreaterThan(0);
    const marker = createdMarkers[0];
    const handlers = marker.getHandlers();

    // simulate mouseover
    handlers.mouseover && handlers.mouseover({});
    expect(setMini).toHaveBeenCalled();

    // simulate mouseout
    handlers.mouseout && handlers.mouseout({});
    // ensure cleared (last call sets null)
    expect(setMini).toHaveBeenLastCalledWith(null);
  });

});
