import { useMemo, useState, useCallback, useEffect } from 'react';
import { MarkerData } from '../types/marker';
import { useLazyMarkers, Bounds } from './useLazyMarkers';
import { useFavorites } from '../contexts/FavoritesContext';
import type { FavoritePlace } from '../types/favorites';

export interface MapMarkersOptions {
  categories?: string[];
  limit?: number;
  debounceMs?: number;
  /**
   * Если true, используем ленивую загрузку через `useLazyMarkers`.
   * Если false, будет загружаться полный список маркеров при вызове `reloadMarkers`.
   * (по умолчанию `true`, т.е. ленивый режим)
   */
  lazy?: boolean;
  // дополнительные опции можно добавить позже
}

export const useMapMarkers = (opts: MapMarkersOptions = {}) => {
  const { categories, limit, debounceMs, lazy = true } = opts;

  const favoritesCtx = useFavorites();
  // Защитная проверка: убеждаемся что favoritePlaces это массив
  const favoritePlaces: FavoritePlace[] = Array.isArray((favoritesCtx as any)?.favoritePlaces) 
    ? (favoritesCtx as any).favoritePlaces 
    : [];

  // ленивый режим: держим хук всегда подключённым, чтобы не нарушать порядок хуков
  const {
    markers: lazyMarkers,
    loading: lazyLoading,
    error: lazyError,
    loadedBounds: lazyLoadedBounds,
    loadMarkers: lazyLoadMarkers,
    reloadMarkers: lazyReloadMarkers,
    clearMarkers: lazyClearMarkers,
  } = useLazyMarkers({ categories, limit, debounceMs });

  // полный режим: загружаем весь список отдельно, но тоже объявляем хуки без ветвления
  const [fullMarkers, setFullMarkers] = useState<MarkerData[]>([]);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);

  const reloadFullMarkers = useCallback(async () => {
    setFullLoading(true);
    setFullError(null);
    try {
      const { getAllMarkers } = await import('../services/markerService');
      const fetched = await getAllMarkers({ categories });
      setFullMarkers(fetched || []);
    } catch (err: any) {
      setFullError(err.message || 'Ошибка загрузки маркеров');
    } finally {
      setFullLoading(false);
    }
  }, [categories]);

  const clearFullMarkers = useCallback(() => {
    setFullMarkers([]);
    setFullError(null);
  }, []);

  useEffect(() => {
    if (!lazy) {
      reloadFullMarkers();
    }
  }, [categories, reloadFullMarkers, lazy]);

  const resolveFavoriteCoords = useCallback((p: any): [number, number] | null => {
    if (p.latitude !== undefined && p.longitude !== undefined) {
      const lat = Number(p.latitude);
      const lon = Number(p.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    }
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
      const lat = Number(p.coordinates[0]);
      const lon = Number(p.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    }
    return null;
  }, []);

  const mergeFavoritePlaces = useCallback((base: MarkerData[]): MarkerData[] => {
    if (!favoritePlaces.length) return base;

    const ids = new Set(base.map(m => m.id));
    const extra = favoritePlaces
      .map(place => ({
        place,
        coords: resolveFavoriteCoords(place),
      }))
      .filter(({ place, coords }) => coords && !ids.has(place.id))
      .map(({ place, coords }) => ({
        id: place.id,
        latitude: coords![0],
        longitude: coords![1],
        title: (place as any).name || '',
        category: (place as any).category || 'other',
        description: (place as any).description || '',
        rating: 0,
        rating_count: 0,
        photo_urls: [],
        hashtags: [],
        author_name: 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
      } as MarkerData));

    return [...base, ...extra];
  }, [favoritePlaces, resolveFavoriteCoords]);

  const mergedLazyMarkers = useMemo<MarkerData[]>(() => mergeFavoritePlaces(lazyMarkers), [lazyMarkers, mergeFavoritePlaces]);
  const mergedFullMarkers = useMemo<MarkerData[]>(() => mergeFavoritePlaces(fullMarkers), [fullMarkers, mergeFavoritePlaces]);

  const loadMarkers = useCallback((bounds?: Bounds) => {
    if (lazy) {
      if (bounds) lazyLoadMarkers(bounds);
      return;
    }
    void reloadFullMarkers();
  }, [lazy, lazyLoadMarkers, reloadFullMarkers]);

  const reloadMarkers = useCallback((bounds?: Bounds) => {
    if (lazy) {
      if (bounds) lazyReloadMarkers(bounds);
      return;
    }
    void reloadFullMarkers();
  }, [lazy, lazyReloadMarkers, reloadFullMarkers]);

  const clearMarkers = useCallback(() => {
    if (lazy) {
      lazyClearMarkers();
      return;
    }
    clearFullMarkers();
  }, [lazy, lazyClearMarkers, clearFullMarkers]);

  return {
    allMarkers: lazy ? mergedLazyMarkers : mergedFullMarkers,
    loading: lazy ? lazyLoading : fullLoading,
    error: lazy ? lazyError : fullError,
    loadedBounds: lazy ? lazyLoadedBounds : null,
    loadMarkers,
    reloadMarkers,
    clearMarkers,
  };
};
