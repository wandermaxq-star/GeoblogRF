import { create } from 'zustand';

export type DownloadStatus = 'none' | 'downloading' | 'downloaded';

interface OfflineTilesState {
  /** Статус скачивания по каждому regionId */
  downloadStatus: Record<string, DownloadStatus>;
  /** Прогресс скачивания (0–100) */
  downloadProgress: Record<string, number>;
  /** Активный регион (выбран из списка / подсвечен на карте) */
  activeRegionId: string | null;
  /** Регион под курсором на SVG-карте */
  hoveredRegionId: string | null;

  // ── Actions ──
  setDownloadStatus: (regionId: string, status: DownloadStatus) => void;
  setDownloadProgress: (regionId: string, progress: number) => void;
  setActiveRegion: (regionId: string | null) => void;
  setHoveredRegion: (regionId: string | null) => void;
  /** Инициализация ранее скачанных регионов */
  initDownloadedRegions: (regionIds: string[]) => void;
}

export const useOfflineTilesStore = create<OfflineTilesState>((set) => ({
  downloadStatus: {},
  downloadProgress: {},
  activeRegionId: null,
  hoveredRegionId: null,

  setDownloadStatus: (regionId, status) =>
    set((state) => ({
      downloadStatus: { ...state.downloadStatus, [regionId]: status },
    })),

  setDownloadProgress: (regionId, progress) =>
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [regionId]: progress },
    })),

  setActiveRegion: (regionId) => set({ activeRegionId: regionId }),

  setHoveredRegion: (regionId) => set({ hoveredRegionId: regionId }),

  initDownloadedRegions: (regionIds) =>
    set(() => {
      const status: Record<string, DownloadStatus> = {};
      regionIds.forEach((id) => {
        status[id] = 'downloaded';
      });
      return { downloadStatus: status };
    }),
}));
