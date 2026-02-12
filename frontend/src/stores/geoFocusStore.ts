import { create } from 'zustand';

export type GeoFocusType = 'marker' | 'route' | 'event';

export interface GeoFocusTarget {
  type: GeoFocusType;
  id: string;
  title?: string;
}

interface GeoFocusState {
  /** Текущий объект, на который нужно сфокусировать карту */
  target: GeoFocusTarget | null;
  /** Уникальный счётчик, чтобы повторный клик на тот же объект тоже вызывал flyTo */
  seq: number;
  /** Установить фокус на гео-объект */
  setFocus: (target: GeoFocusTarget) => void;
  /** Сбросить фокус (после того как карта обработала) */
  clearFocus: () => void;
}

export const useGeoFocusStore = create<GeoFocusState>((set, get) => ({
  target: null,
  seq: 0,
  setFocus: (target) => set({ target, seq: get().seq + 1 }),
  clearFocus: () => set({ target: null }),
}));
