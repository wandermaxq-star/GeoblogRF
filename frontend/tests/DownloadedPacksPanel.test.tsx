import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DownloadedPacksPanel from '../src/components/Offline/DownloadedPacksPanel';
import { offlineService } from '../src/services/offlineService';

describe('DownloadedPacksPanel', () => {
  const samplePack = {
    storageKey: 'pack1',
    packId: 'pack1',
    packSlug: 'slug',
    packTitle: 'Title',
    variantId: 'v1',
    variantTitle: 'V1',
    downloadType: 'route_data',
    tileVersion: 'full',
    downloadedAt: Date.now(),
    coveredRegionIds: ['r1'],
    includedWaypointIds: [],
    includedWaypoints: [],
    userMarkers: [],
    userRoutes: [],
    userEvents: [],
    userPosts: [],
  };

  beforeEach(() => {
    vi.spyOn(offlineService, 'getDownloadedRoutePacks').mockResolvedValue([samplePack] as any);
    vi.spyOn(offlineService, 'deleteRoutePackData').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pack list and allows deleting', async () => {
    render(<DownloadedPacksPanel />);
    await waitFor(() => screen.getByText(/Скачанные маршрутные пакеты/i));
    expect(screen.getByText('Title — V1')).toBeTruthy();

    fireEvent.click(screen.getByText('Удалить'));
    await waitFor(() => expect(offlineService.deleteRoutePackData).toHaveBeenCalledWith('pack1'));
  });
});