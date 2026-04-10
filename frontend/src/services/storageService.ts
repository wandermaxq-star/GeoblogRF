type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

// Расширенный API, который ожидают разные части приложения
type StorageAPI = StorageLike & {
  migrateFromLocalStorage: () => Promise<void>;
  getFavorites: () => Promise<any[]>;
  setFavorites: (items: any[]) => Promise<void>;
  getRoutes: () => Promise<any[]>;
  deleteRoute: (id: string) => Promise<void>;
  saveRoute: (route: any) => Promise<void>;
  addToFavorites: (item: any) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  // дополнительные заглушки для совместимости
  getDownloadedRegions: () => string[];
};
const createInMemory = (): StorageLike => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? String(store.get(k)) : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
};

function detectStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      // sanity test
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return {
        getItem: (k: string) => localStorage.getItem(k),
        setItem: (k: string, v: string) => localStorage.setItem(k, v),
        removeItem: (k: string) => localStorage.removeItem(k),
        clear: () => localStorage.clear()
      };
    }
  } catch (e) {
    // fallthrough to in-memory
  }
  return createInMemory();
}

const impl = detectStorage();

export const storageService: StorageAPI = {
  getItem: (k: string) => {
    try { return impl.getItem(k); } catch { return null; }
  },
  setItem: (k: string, v: string) => {
    try { impl.setItem(k, v); } catch { /* swallow */ }
  },
  removeItem: (k: string) => {
    try { impl.removeItem(k); } catch { /* swallow */ }
  },
  clear: () => {
    try { impl.clear && impl.clear(); } catch { /* swallow */ }
  },

  // Прокси к indexedDBService (если он экспортирован ниже)
  migrateFromLocalStorage: async () => { try { await (indexedDBService as any)?.migrateFromLocalStorage?.(); } catch {} },
  getFavorites: async () => { try { return await (indexedDBService as any)?.getFavorites?.() ?? []; } catch { return []; } },
  setFavorites: async (items: any[]) => { try { return await (indexedDBService as any)?.setFavorites?.(items); } catch {} },
  getRoutes: async () => { try { return await (indexedDBService as any)?.getRoutes?.() ?? []; } catch { return []; } },
  deleteRoute: async (id: string) => { try { return await (indexedDBService as any)?.deleteRoute?.(id); } catch {} },
  saveRoute: async (route: any) => { try { return await (indexedDBService as any)?.saveRoute?.(route); } catch {} },
  addToFavorites: async (item: any) => { try { return await (indexedDBService as any)?.addToFavorites?.(item); } catch {} },
  removeFavorite: async (id: string) => { try { return await (indexedDBService as any)?.removeFavorite?.(id); } catch {} },
  getDownloadedRegions: () => { try { return (indexedDBService as any)?.getDownloadedRegions?.() ?? []; } catch { return []; } }
};

export default storageService;
// Простой IndexedDB адаптер для хранения избранного и других небольших данных
const DB_NAME = 'geoblog_storage_v1';
const DB_VERSION = 1;
const STORE_FAVORITES = 'favorites';

class StorageService {
  private db: IDBDatabase | null = null;

  private normalizeFavoriteItem(item: any) {
    if (item && (item.id !== undefined && item.id !== null && String(item.id).trim() !== '')) {
      return item;
    }
    return {
      ...item,
      id: crypto.randomUUID(),
    };
  }

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
          db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private txn(storeName: string, mode: IDBTransactionMode = 'readonly') {
    if (!this.db) throw new Error('DB not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async addFavorite(item: any): Promise<void> {
    await this.init();
    return new Promise((res, rej) => {
      const store = this.txn(STORE_FAVORITES, 'readwrite');
      const req = store.put(this.normalizeFavoriteItem(item));
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async getFavorites(): Promise<any[]> {
    await this.init();
    return new Promise((res, rej) => {
      const store = this.txn(STORE_FAVORITES, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  }

    // Compatibility methods expected by MapFacadeDependencies
    getDownloadedRegions(): string[] {
      // currently no region store; return empty
      return [];
    }

    async addToFavorites(item: any): Promise<void> {
      return this.addFavorite(item);
    }

    async removeFromFavorites(id: string): Promise<void> {
      return this.removeFavorite(id);
    }

    async saveRoute(route: any): Promise<void> {
      // no-op stub for compatibility
      return Promise.resolve();
    }

      async getRoutes(): Promise<any[]> {
        // stub for routes list - storage doesn't persist routes here
        return [];
      }

      async deleteRoute(id: string): Promise<void> {
        // stub delete
        return Promise.resolve();
      }

    async downloadRegion(id: string): Promise<void> {
      // delegate to offline subsystem if present; stub for now
      return Promise.resolve();
    }

    async deleteRegion(id: string): Promise<void> {
      return Promise.resolve();
    }

  async removeFavorite(id: string): Promise<void> {
    await this.init();
    return new Promise((res, rej) => {
      const store = this.txn(STORE_FAVORITES, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async setFavorites(items: any[]): Promise<void> {
    await this.init();
    return new Promise((res, rej) => {
      const tx = this.db!.transaction([STORE_FAVORITES], 'readwrite');
      const store = tx.objectStore(STORE_FAVORITES);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const it of items) store.put(this.normalizeFavoriteItem(it));
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async getFavoritesStats(): Promise<{ totalPlaces: number; totalRoutes: number; totalEvents: number; totalItems: number }> {
    const items = await this.getFavorites();
    const totalPlaces = items.filter((i: any) => i.type !== 'route' && i.type !== 'event').length;
    const totalRoutes = items.filter((i: any) => i.type === 'route').length;
    const totalEvents = items.filter((i: any) => i.type === 'event').length;
    return { totalPlaces, totalRoutes, totalEvents, totalItems: items.length };
  }

  // Миграция из localStorage (однократно)
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const keys = ['favorites-places', 'favorites-routes', 'favorites-events'];
      const all: any[] = [];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) all.push(...arr);
            localStorage.removeItem(k);
          } catch (e) {
            // skip
          }
        }
      }
      if (all.length) await this.setFavorites(all);
    } catch (e) {
      // swallow
    }
  }
}

export const indexedDBService = new StorageService();
