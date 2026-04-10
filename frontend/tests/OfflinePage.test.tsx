import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OfflinePage from '../src/pages/OfflinePage';
import { BrowserRouter } from 'react-router-dom';
import { offlineService } from '../src/services/offlineService';

// stub RussiaMapSvg to avoid rendering complexity
vi.mock('../src/components/Offline/RussiaMapSvg', () => {
  return {
    default: ({ onRegionClick }: any) => <div data-testid="map" onClick={() => onRegionClick('r1')} />,
  };
});

// stub RegionPanel since it has many dependencies
vi.mock('../src/components/Offline/RegionPanel', () => {
  return {
    default: ({ onRegionClick }: any) => <div data-testid="region-panel">RP</div>,
  };
});

// stub DownloadRegionModal
vi.mock('../src/components/Regions/DownloadRegionModal', () => {
  return {
    default: () => null,
  };
});

describe('OfflinePage', () => {
  beforeEach(() => {
    vi.spyOn(offlineService, 'getDownloadedRegions').mockResolvedValue(['r1']);
    vi.spyOn(offlineService, 'getDownloadedRoutePacks').mockResolvedValue([
      { packId: 'p1', storageKey: 'p1', packSlug: 's', packTitle: 'T1', variantId: 'v1', variantTitle: 'V1', downloadType: 'route_data', tileVersion: 'full', downloadedAt: Date.now(), coveredRegionIds: [], includedWaypointIds: [], includedWaypoints: [], userMarkers: [], userRoutes: [], userEvents: [], userPosts: [] } as any,
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows downloaded packs panel when packs exist', async () => {
    render(
      <BrowserRouter>
        <OfflinePage />
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId('map')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Скачанные маршрутные пакеты/i)).toBeTruthy());
    expect(screen.getByText(/T1 — V1/i)).toBeTruthy();
  });
});