import { useState, useCallback } from 'react';

export interface MapFiltersState {
  categories: string[];
  eventCategories: string[];
  radiusOn: boolean;
  radius: number;
  preset: string | null;
}

const DEFAULT_FILTERS: MapFiltersState = {
  categories: ['attraction'],
  eventCategories: [],
  radiusOn: false,
  radius: 10,
  preset: null,
};

/**
 * Hook that encapsulates the draft/applied pattern for map filters.
 *
 * It is intentionally simple: the page is responsible for persisting
 * or syncing filters with URL/store if needed, the hook just manages
 * the two copies and provides helpers for the most common operations.
 */
export function useMapFilters(initial?: Partial<MapFiltersState>) {
  const [draft, setDraft] = useState<MapFiltersState>({
    ...DEFAULT_FILTERS,
    ...initial,
  });
  const [applied, setApplied] = useState<MapFiltersState>(draft);

  const apply = useCallback(() => {
    setApplied(draft);
  }, [draft]);

  const reset = useCallback(() => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }, []);

  const quickChange = useCallback((categories: string[]) => {
    setApplied(prev => ({ ...prev, categories }));
    setDraft(prev => ({ ...prev, categories }));
  }, []);

  return {
    draft,
    applied,
    setDraft,
    apply,
    reset,
    quickChange,
  };
}
