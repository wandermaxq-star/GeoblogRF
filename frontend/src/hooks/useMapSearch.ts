import { useState, useEffect } from 'react';
import { Place, geocodingService } from '../services/geocodingService';
import { MarkerData } from '../types/marker';
import { useDebounce } from './useDebounce';

export interface UseMapSearchResult {
  query: string;
  setQuery: (q: string) => void;
  debouncedQuery: string;
  isLoading: boolean;
  isDropdownVisible: boolean;
  setIsDropdownVisible: (visible: boolean) => void;
  places: Place[];
  markers: MarkerData[];
  clear: () => void;
}

/**
 * Shared search hook used by desktop+mobile map pages (and later planner).
 *
 * - debounces input
 * - performs geocoding lookup
 * - filters provided `allMarkers` by title
 * - exposes visibility state for dropdown
 */
export function useMapSearch(allMarkers: MarkerData[]): UseMapSearchResult {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);

  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);

  const clear = () => {
    setQuery('');
    setPlaces([]);
    setMarkers([]);
    setIsDropdownVisible(false);
    setIsLoading(false);
  };

  useEffect(() => {
    const perform = async () => {
      if (debouncedQuery.length < 3) {
        setPlaces([]);
        setMarkers([]);
        setIsDropdownVisible(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setIsDropdownVisible(true);

      try {
        const placesPromise = geocodingService.searchPlaces(debouncedQuery);
        const q = debouncedQuery.toLowerCase();
        const markersPromise = Promise.resolve(
          allMarkers.filter(m => (m.title || '').toLowerCase().includes(q))
        );

        const [placesRes, markersRes] = await Promise.all([placesPromise, markersPromise]);
        setPlaces(placesRes);
        setMarkers(markersRes);
      } catch (e) {
        console.warn('useMapSearch: search failed', e);
        setPlaces([]);
        setMarkers([]);
      } finally {
        setIsLoading(false);
      }
    };

    perform();
  }, [debouncedQuery, allMarkers]);

  return {
    query,
    setQuery,
    debouncedQuery,
    isLoading,
    isDropdownVisible,
    setIsDropdownVisible,
    places,
    markers,
    clear,
  };
}
