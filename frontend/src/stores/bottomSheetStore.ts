import { create } from 'zustand';

export interface RegionDownload {
  id: string;
  name: string;
  area: string;
  sizeMb: number;
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress?: number; // 0..100
  selected: boolean;
}

interface BottomSheetState {
  isOpen: boolean;
  regions: RegionDownload[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  setRegions: (regions: RegionDownload[]) => void;
  updateRegion: (id: string, patch: Partial<RegionDownload>) => void;
  selectRegion: (id: string, selected: boolean) => void;
}

export const useBottomSheetStore = create<BottomSheetState>((set) => ({
  isOpen: false,
  regions: [],
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setRegions: (regions) => set({ regions }),
  updateRegion: (id, patch) =>
    set((s) => ({
      regions: s.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  selectRegion: (id, selected) =>
    set((s) => ({
      regions: s.regions.map((r) => (r.id === id ? { ...r, selected } : r)),
    })),
}));
