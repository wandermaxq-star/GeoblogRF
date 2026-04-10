// Сервис для работы с офлайн-данными
import { getregioncity as getRegionCity } from '../stores/regionCities';
import type { CuratedRoutePack, CuratedRouteVariant, CuratedRouteWaypoint } from '../types/proRoutePacks';

export type OfflineRegionDownloadType = 'user_data' | 'user_data_cities' | 'user_data_full';
export type OfflineRoutePackDownloadType = 'route_data' | 'route_cities' | 'route_corridor';
export type TileVersion = 'full' | 'trimmed';

export interface OfflineRegionData {
  regionId: string;
  downloadType: OfflineRegionDownloadType;
  downloadedAt: number;
  userMarkers: any[];
  userRoutes: any[];
  userEvents: any[];
  userPosts: any[];
  mapTiles?: {
    cities?: string[];
    full?: string[];
  };
  sizeEstimate?: number;
}

export interface OfflineRoutePackData {
  storageKey: string;
  packId: string;
  packSlug: string;
  packTitle: string;
  variantId: string;
  variantTitle: string;
  downloadType: OfflineRoutePackDownloadType;
  tileVersion: TileVersion;
  downloadedAt: number;
  coveredRegionIds: string[];
  includedWaypointIds: string[];
  includedWaypoints: CuratedRouteWaypoint[];
  userMarkers: any[];
  userRoutes: any[];
  userEvents: any[];
  userPosts: any[];
  mapTiles?: {
    cities?: string[];
    corridor?: string[];
  };
  sizeEstimate?: number;
  isPurchased?: boolean;
}

export interface DownloadProgress {
  regionId: string;
  progress: number;
  status: 'preparing' | 'downloading' | 'processing' | 'completed' | 'error';
  message?: string;
}

class OfflineService {
  private readonly DB_NAME = 'geoblog_offline';
  private readonly DB_VERSION = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('regions')) {
          const regionStore = db.createObjectStore('regions', { keyPath: 'regionId' });
          regionStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('routePacks')) {
          const routePackStore = db.createObjectStore('routePacks', { keyPath: 'storageKey' });
          routePackStore.createIndex('packId', 'packId', { unique: false });
          routePackStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('mapTiles')) {
          const tileStore = db.createObjectStore('mapTiles', { keyPath: 'url' });
          tileStore.createIndex('regionId', 'regionId', { unique: false });
        }
      };
    });
  }

  isPremiumUser(subscriptionExpiresAt?: string | null): boolean {
    if (!subscriptionExpiresAt) return false;
    const expiresAt = new Date(subscriptionExpiresAt).getTime();
    return expiresAt > Date.now();
  }

  async estimateDownloadSize(
    regionId: string,
    downloadType: OfflineRegionDownloadType,
    userId: string,
    tileVersion: TileVersion = 'trimmed'
  ): Promise<number> {
    const cityInfo = getRegionCity(regionId);
    if (!cityInfo) return 0;

    let size = 100 * 1024;
    void userId;

    if (downloadType === 'user_data_cities') {
      size += (tileVersion === 'full' ? 7 : 5) * 1024 * 1024;
    } else if (downloadType === 'user_data_full') {
      size += (tileVersion === 'full' ? 75 : 50) * 1024 * 1024;
    }

    return size;
  }

  async estimateRoutePackDownloadSize(
    pack: CuratedRoutePack,
    variant: CuratedRouteVariant,
    enabledWaypointIds: string[],
    downloadType: OfflineRoutePackDownloadType,
    userId: string,
    tileVersion: TileVersion = 'trimmed'
  ): Promise<number> {
    void userId;

    const includedWaypoints = this.getIncludedWaypoints(variant, enabledWaypointIds);
    const scenarioWeightMb = variant.estimatedBaseSizeMb + includedWaypoints.reduce((sum, waypoint) => sum + waypoint.estimatedTileWeightMb, 0);
    const coveredRegionCount = this.collectCoveredRegions(pack, includedWaypoints).length;

    let totalMb = 0;

    if (downloadType === 'route_data') {
      totalMb = Math.max(4, scenarioWeightMb * 0.35 + 2);
    }

    if (downloadType === 'route_cities') {
      totalMb = scenarioWeightMb;
    }

    if (downloadType === 'route_corridor') {
      const corridorWeightPerRegion = tileVersion === 'full' ? 18 : 9;
      totalMb = scenarioWeightMb + coveredRegionCount * corridorWeightPerRegion;
    }

    return Math.round(totalMb * 1024 * 1024);
  }

  async downloadRegionData(
    regionId: string,
    downloadType: OfflineRegionDownloadType,
    userId: string,
    onProgress?: (progress: DownloadProgress) => void,
    tileVersion: TileVersion = 'trimmed'
  ): Promise<OfflineRegionData> {
    await this.ensureReady();

    const cityInfo = getRegionCity(regionId);
    if (!cityInfo) {
      throw new Error('Регион не найден');
    }

    onProgress?.({ regionId, progress: 0, status: 'preparing', message: 'Подготовка данных...' });
    onProgress?.({ regionId, progress: 10, status: 'downloading', message: 'Загрузка ваших меток...' });
    const userMarkers = await this.fetchUserMarkers(regionId, userId);

    onProgress?.({ regionId, progress: 30, status: 'downloading', message: 'Загрузка ваших маршрутов...' });
    const userRoutes = await this.fetchUserRoutes(regionId, userId);

    onProgress?.({ regionId, progress: 50, status: 'downloading', message: 'Загрузка ваших событий...' });
    const userEvents = await this.fetchUserEvents(regionId, userId);

    onProgress?.({ regionId, progress: 70, status: 'downloading', message: 'Загрузка ваших постов...' });
    const userPosts = await this.fetchUserPosts(regionId, userId);

    let mapTiles: OfflineRegionData['mapTiles'];
    if (downloadType === 'user_data_cities' || downloadType === 'user_data_full') {
      onProgress?.({ regionId, progress: 80, status: 'downloading', message: 'Загрузка карт...' });
      mapTiles = await this.downloadMapTiles(regionId, downloadType, tileVersion);
    }

    onProgress?.({ regionId, progress: 95, status: 'processing', message: 'Сохранение данных...' });

    const offlineData: OfflineRegionData = {
      regionId,
      downloadType,
      downloadedAt: Date.now(),
      userMarkers,
      userRoutes,
      userEvents,
      userPosts,
      mapTiles,
      sizeEstimate: await this.estimateDownloadSize(regionId, downloadType, userId, tileVersion),
    };

    await this.saveRegionData(offlineData);
    onProgress?.({ regionId, progress: 100, status: 'completed', message: 'Скачивание завершено!' });
    return offlineData;
  }

  async downloadRoutePackData(
    pack: CuratedRoutePack,
    variant: CuratedRouteVariant,
    enabledWaypointIds: string[],
    userId: string,
    downloadType: OfflineRoutePackDownloadType,
    onProgress?: (progress: DownloadProgress) => void,
    tileVersion: TileVersion = 'trimmed',
    isPurchased: boolean = false
  ): Promise<OfflineRoutePackData> {
    await this.ensureReady();

    const includedWaypoints = this.getIncludedWaypoints(variant, enabledWaypointIds);
    const coveredRegionIds = this.collectCoveredRegions(pack, includedWaypoints);

    // inform the store that regions are being downloaded as part of this pack
    try {
      const mod = await import('../stores/offlineTilesStore');
      const { setDownloadStatus, setDownloadProgress } = mod.useOfflineTilesStore.getState();
      coveredRegionIds.forEach((rid) => setDownloadStatus(rid, 'downloading'));
    } catch {
      // swallow – store might not exist in some test contexts
    }

    onProgress?.({ regionId: pack.id, progress: 0, status: 'preparing', message: 'Собираем маршрутный пакет...' });
    onProgress?.({ regionId: pack.id, progress: 15, status: 'downloading', message: 'Загрузка ваших меток по маршруту...' });
    const markerChunks = await Promise.all(coveredRegionIds.map((regionId) => this.fetchUserMarkers(regionId, userId)));

    onProgress?.({ regionId: pack.id, progress: 35, status: 'downloading', message: 'Загрузка ваших маршрутов по маршруту...' });
    const routeChunks = await Promise.all(coveredRegionIds.map((regionId) => this.fetchUserRoutes(regionId, userId)));

    onProgress?.({ regionId: pack.id, progress: 55, status: 'downloading', message: 'Загрузка ваших событий по маршруту...' });
    const eventChunks = await Promise.all(coveredRegionIds.map((regionId) => this.fetchUserEvents(regionId, userId)));

    onProgress?.({ regionId: pack.id, progress: 70, status: 'downloading', message: 'Загрузка ваших постов по маршруту...' });
    const postChunks = await Promise.all(coveredRegionIds.map((regionId) => this.fetchUserPosts(regionId, userId)));

    let mapTiles: OfflineRoutePackData['mapTiles'];
    if (downloadType !== 'route_data') {
      onProgress?.({ regionId: pack.id, progress: 82, status: 'downloading', message: 'Подготовка оффлайн-карт маршрута...' });
      mapTiles = this.buildRoutePackTiles(pack, includedWaypoints, coveredRegionIds, downloadType, tileVersion);
    }

    onProgress?.({ regionId: pack.id, progress: 94, status: 'processing', message: 'Сохраняем маршрутный пакет...' });

    const offlineData: OfflineRoutePackData = {
      storageKey: pack.id,
      packId: pack.id,
      packSlug: pack.slug,
      packTitle: pack.title,
      variantId: variant.id,
      variantTitle: variant.title,
      downloadType,
      tileVersion,
      downloadedAt: Date.now(),
      coveredRegionIds,
      includedWaypointIds: includedWaypoints.map((waypoint) => waypoint.id),
      includedWaypoints,
      userMarkers: markerChunks.flat(),
      userRoutes: routeChunks.flat(),
      userEvents: eventChunks.flat(),
      userPosts: postChunks.flat(),
      mapTiles,
      sizeEstimate: await this.estimateRoutePackDownloadSize(pack, variant, enabledWaypointIds, downloadType, userId, tileVersion),
      isPurchased,
    };

    await this.saveRoutePackData(offlineData);

    // mark covered regions as downloaded in the shared store
    try {
      const mod = await import('../stores/offlineTilesStore');
      const { setDownloadStatus } = mod.useOfflineTilesStore.getState();
      coveredRegionIds.forEach((rid) => setDownloadStatus(rid, 'downloaded'));
    } catch {
      // best-effort only
    }

    onProgress?.({ regionId: pack.id, progress: 100, status: 'completed', message: 'Маршрутный пакет сохранён оффлайн!' });
    return offlineData;
  }

  async getRegionData(regionId: string): Promise<OfflineRegionData | null> {
    await this.ensureReady();
    return this.getByKey<OfflineRegionData>('regions', regionId);
  }

  async getRoutePackData(packId: string): Promise<OfflineRoutePackData | null> {
    await this.ensureReady();
    return this.getByKey<OfflineRoutePackData>('routePacks', packId);
  }

  async isRegionDownloaded(regionId: string): Promise<boolean> {
    const data = await this.getRegionData(regionId);
    return data !== null;
  }

  async isRoutePackDownloaded(packId: string): Promise<boolean> {
    const data = await this.getRoutePackData(packId);
    return data !== null;
  }

  async deleteRegionData(regionId: string): Promise<void> {
    await this.ensureReady();
    return this.deleteByKey('regions', regionId);
  }

  async deleteRoutePackData(packId: string): Promise<void> {
    await this.ensureReady();
    await this.deleteByKey('routePacks', packId);

    // after removal, refresh the region download status store so that any regions
    // only covered by that pack no longer appear as downloaded
    try {
      const allRegions = await this.getDownloadedRegions();
      // store is safe to import directly without hooks
      const mod = await import('../stores/offlineTilesStore');
      const { initDownloadedRegions } = mod.useOfflineTilesStore.getState();
      initDownloadedRegions(allRegions);
    } catch {
      // ignore errors, this is best-effort UI sync
    }
  }

  async getDownloadedRegions(): Promise<string[]> {
    await this.ensureReady();
    const regions = await this.getAll<OfflineRegionData>('regions');
    const regionIds = regions.map((data) => data.regionId);

    // include any regions that are covered by saved route packs as well
    const packs = await this.getAll<OfflineRoutePackData>('routePacks');
    packs.forEach((pack) => {
      pack.coveredRegionIds.forEach((rid) => {
        if (!regionIds.includes(rid)) {
          regionIds.push(rid);
        }
      });
    });

    return regionIds;
  }

  async getDownloadedRoutePacks(): Promise<OfflineRoutePackData[]> {
    await this.ensureReady();
    return this.getAll<OfflineRoutePackData>('routePacks');
  }

  private async fetchUserMarkers(regionId: string, userId: string): Promise<any[]> {
    void regionId;
    void userId;
    return [];
  }

  private async fetchUserRoutes(regionId: string, userId: string): Promise<any[]> {
    void regionId;
    void userId;
    return [];
  }

  private async fetchUserEvents(regionId: string, userId: string): Promise<any[]> {
    void regionId;
    void userId;
    return [];
  }

  private async fetchUserPosts(regionId: string, userId: string): Promise<any[]> {
    void regionId;
    void userId;
    return [];
  }

  private async downloadMapTiles(
    regionId: string,
    downloadType: 'user_data_cities' | 'user_data_full',
    tileVersion: TileVersion
  ): Promise<OfflineRegionData['mapTiles']> {
    const cityInfo = getRegionCity(regionId);
    if (!cityInfo) return undefined;

    const baseTileUrl = `offline://${regionId}/${tileVersion}`;

    return {
      cities: downloadType === 'user_data_cities' ? [`${baseTileUrl}/cities/${cityInfo.cityname}`] : undefined,
      full: downloadType === 'user_data_full' ? [`${baseTileUrl}/full`] : undefined,
    };
  }

  private buildRoutePackTiles(
    pack: CuratedRoutePack,
    waypoints: CuratedRouteWaypoint[],
    coveredRegionIds: string[],
    downloadType: OfflineRoutePackDownloadType,
    tileVersion: TileVersion
  ): OfflineRoutePackData['mapTiles'] {
    const cityTiles = waypoints.map((waypoint) => `offline://${pack.id}/${tileVersion}/city/${waypoint.id}`);
    const corridorTiles = downloadType === 'route_corridor'
      ? coveredRegionIds.map((regionId) => `offline://${pack.id}/${tileVersion}/corridor/${regionId}`)
      : undefined;

    return {
      cities: cityTiles,
      corridor: corridorTiles,
    };
  }

  private getIncludedWaypoints(variant: CuratedRouteVariant, enabledWaypointIds: string[]): CuratedRouteWaypoint[] {
    const enabledSet = new Set(enabledWaypointIds);
    return variant.waypoints.filter((waypoint) => waypoint.isRequired || enabledSet.has(waypoint.id));
  }

  private collectCoveredRegions(pack: CuratedRoutePack, includedWaypoints: CuratedRouteWaypoint[]): string[] {
    return Array.from(new Set([...pack.regions, ...includedWaypoints.map((waypoint) => waypoint.regionId)]));
  }

  private async saveRegionData(data: OfflineRegionData): Promise<void> {
    return this.putRecord('regions', data);
  }

  private async saveRoutePackData(data: OfflineRoutePackData): Promise<void> {
    return this.putRecord('routePacks', data);
  }

  private async putRecord(storeName: string, value: unknown): Promise<void> {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result as T[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureReady(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }
}

export const offlineService = new OfflineService();
