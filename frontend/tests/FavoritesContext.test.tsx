// @vitest-environment happy-dom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// make sure the storage service is mocked before the provider is imported
vi.mock('../src/services/storageService', () => {
  return {
    storageService: {
      migrateFromLocalStorage: vi.fn(() => Promise.resolve()),
      getFavorites: vi.fn(() => Promise.resolve([])),
      setFavorites: vi.fn(() => Promise.resolve()),
      getRoutes: vi.fn(() => Promise.resolve([])),
      deleteRoute: vi.fn(() => Promise.resolve()),
      saveRoute: vi.fn(() => Promise.resolve()),
      addToFavorites: vi.fn(() => Promise.resolve()),
      removeFavorite: vi.fn(() => Promise.resolve()),
      getDownloadedRegions: () => []
    }
  };
});

// now import provider and context hook
import { FavoritesProvider, useFavorites } from '../src/contexts/FavoritesContext';
import { storageService } from '../src/services/storageService';

// import again after mocking
// (since we already imported above, the mock had to happen earlier; this file is structured to ensure the mock is in place before anything uses it)


describe('FavoritesContext persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not clear stored items on initial render', async () => {
    const fakePlace = { id: 'p1', type: 'place' };
    (storageService.getFavorites as any).mockResolvedValue([fakePlace]);

    const calls: any[] = [];
    (storageService.setFavorites as any).mockImplementation(async (items: any[]) => {
      calls.push(items);
    });

    const TestComponent = () => {
      const fav = useFavorites();
      return (
        <>
          <div data-testid="count">{fav.favoritePlaces.length}</div>
          <div data-testid="hydrated">{String(fav.isHydrated)}</div>
        </>
      );
    };

    render(
      <FavoritesProvider>
        <TestComponent />
      </FavoritesProvider>
    );

    await waitFor(() => {
      // wait for initial getFavorites to be called and for context to render the place
      expect(storageService.getFavorites).toHaveBeenCalled();
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe('1');
      // hydration flag should eventually flip
      expect(document.querySelector('[data-testid="hydrated"]')?.textContent).toBe('true');
    });

    // allow effects to flush
    await waitFor(() => calls.length > 0);

    // the provider should never have written an empty array first
    expect(calls.every(arr => Array.isArray(arr) && arr.length > 0)).toBe(true);
    expect(calls).toEqual([expect.arrayContaining([expect.objectContaining({ id: 'p1' })])]);
  });

  it('persists new items after hydration', async () => {
    (storageService.getFavorites as any).mockResolvedValue([]);

    const saved: any[] = [];
    (storageService.setFavorites as any).mockImplementation(async (items: any[]) => {
      saved.push(items);
    });

    const TestComponent = () => {
      const fav = useFavorites();
      return (
        <button
          data-testid="add"
          onClick={() => {
            fav.addToFavorites({ id: 'new', title: 'New place', latitude: 1, longitude: 2, category: 'x' } as any);
          }}
        >
          add
        </button>
      );
    };

    const { getByTestId } = render(
      <FavoritesProvider>
        <TestComponent />
      </FavoritesProvider>
    );

    // after hydration there should be at least one save (empty list) but that's ok here because stored was empty
    await waitFor(() => expect(storageService.getFavorites).toHaveBeenCalled());

    // click add after hydration
    getByTestId('add').click();

    await waitFor(() => {
      expect(saved.some(arr => arr.find((i: any) => i.id === 'new'))).toBe(true);
    });
  });
});
