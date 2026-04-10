/**
 * Универсальный сервис для хранения офлайн контента всех типов в IndexedDB
 * Поддерживает: посты, метки, маршруты, события
 */

export type ContentType = 'post' | 'marker' | 'route' | 'event';
export type DraftStatus = 'draft' | 'uploading' | 'failed' | 'failed_permanent';

// Базовый интерфейс черновика
export interface OfflineContentDraft {
  id: string; // UUID
  contentType: ContentType;
  createdAt: number; // timestamp
  status: DraftStatus;
  retries: number;
  regionId: string;
  
  // Данные контента (зависят от типа)
  contentData: any;
  
  // Общие поля для файлов
  images?: File[]; // Массив File объектов (для постов, меток, событий)
  hasImages: boolean;
  
  // Специфичные поля
  track?: GeoJSON.Feature<GeoJSON.LineString> | null; // Для постов и маршрутов
  hasTrack?: boolean; // Для постов и маршрутов
  
  // Метаданные офлайн-сессии
  offlineSessionMetadata?: {
    network_status_at_creation: 'offline' | 'online';
    offline_actions?: number; // Количество правок, фото, точек трека
    last_modified?: number; // timestamp последнего изменения
  };
}

// Специфичные интерфейсы для каждого типа
export interface OfflinePostDraft extends OfflineContentDraft {
  contentType: 'post';
  contentData: {
    text: string;
    title?: string;
    route_id?: string | null;
    marker_id?: string | null;
    event_id?: string | null;
  };
  track: GeoJSON.Feature<GeoJSON.LineString> | null;
  hasTrack: boolean;
}

import storageService from './storageService';

export interface OfflineMarkerDraft extends OfflineContentDraft {
  contentType: 'marker';
  contentData: {
    title: string;
    description?: string;
    latitude: number;
    longitude: number;
    category: string;
    hashtags?: string[];
    address?: string;
  };
}

export interface OfflineRouteDraft extends OfflineContentDraft {
  contentType: 'route';
  contentData: {
    title: string;
    description?: string;
    points: Array<{
      id?: string;
      latitude: number;
      longitude: number;
      title?: string;
      description?: string;
    }>;
    waypoints?: Array<{
      marker_id: string;
      order_index: number;
      arrival_time?: string;
      departure_time?: string;
      duration_minutes?: number;
      notes?: string;
      is_overnight?: boolean;
    }>;
    totalDistance?: number;
    estimatedDuration?: number;
    tags?: string[];
  };
  track: GeoJSON.Feature<GeoJSON.LineString> | null;
  hasTrack: boolean;
}

export interface OfflineEventDraft extends OfflineContentDraft {
  contentType: 'event';
  contentData: {
    title: string;
    description?: string;
    start_datetime: string;
    end_datetime?: string;
    location?: string;
    latitude?: number | null;
    longitude?: number | null;
    category?: string;
    hashtags?: string[];
    organizer?: string;
  };
}

// Объединённый тип
export type AnyOfflineDraft = 
  | OfflinePostDraft 
  | OfflineMarkerDraft 
  | OfflineRouteDraft 
  | OfflineEventDraft;

const DB_NAME = 'geoblog_offline_content';
const DB_VERSION = 1;
const STORE_NAME = 'offline_content';

class OfflineContentStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private resetConnection() {
    this.db = null;
    this.initPromise = null;
  }

  private isRecoverableConnectionError(error: unknown): boolean {
    if (error instanceof DOMException) {
      return error.name === 'InvalidStateError';
    }

    const message = error instanceof Error ? error.message : String(error);
    return message.includes('database connection is closing') || message.includes('connection is closing');
  }

  /**
   * Инициализация IndexedDB с миграциями
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Ошибка открытия IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        const activeDb = request.result;

        activeDb.onversionchange = () => {
          try {
            activeDb.close();
          } catch {
            // ignore close race
          }

          if (this.db === activeDb) {
            this.resetConnection();
          }
        };

        activeDb.onclose = () => {
          if (this.db === activeDb) {
            this.resetConnection();
          }
        };

        // console.log('✅ IndexedDB для офлайн контента инициализирован');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Удаляем старое хранилище если есть (для миграций)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        // Создаём хранилище для офлайн контента
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Индексы для фильтрации и поиска
        objectStore.createIndex('contentType', 'contentType', { unique: false });
        objectStore.createIndex('status', 'status', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        objectStore.createIndex('regionId', 'regionId', { unique: false });
        // Составной индекс для фильтрации по типу и статусу
        objectStore.createIndex('type_status', ['contentType', 'status'], { unique: false });

        // console.log('✅ IndexedDB схема создана/обновлена');
      };
    });

    return this.initPromise;
  }

  /**
   * Миграция старых черновиков из localStorage в IndexedDB
   */
  async migrateLocalStorageDrafts(): Promise<number> {
    await this.init();
    
    let migratedCount = 0;

    try {
      // Мигрируем посты из старого хранилища
      const oldPostsStorage = storageService.getItem('geoblog_offline_posts');
      if (oldPostsStorage) {
        try {
          const oldDrafts = JSON.parse(oldPostsStorage);
          if (Array.isArray(oldDrafts)) {
            for (const draft of oldDrafts) {
              if (draft.id && draft.text) {
                await this.addDraft({
                  contentType: 'post',
                  contentData: {
                    text: draft.text,
                    title: draft.title
                  },
                  images: draft.images || [],
                  hasImages: (draft.images?.length || 0) > 0,
                  track: draft.track || null,
                  hasTrack: !!draft.track,
                  status: draft.status || 'draft',
                  regionId: draft.regionId || 'default'
                });
                migratedCount++;
              }
            }
          }
        } catch (e) {
          console.warn('Ошибка миграции старых постов:', e);
        }
      }

      // Мигрируем метки из localModerationStorage
      try {
        const { getAllPendingContent } = await import('./localModerationStorage');
        const pendingMarkers = getAllPendingContent('marker');
        for (const marker of pendingMarkers) {
          if (marker.data && marker.data.latitude && marker.data.longitude) {
            await this.addDraft({
              contentType: 'marker',
              contentData: {
                title: marker.data.title || '',
                description: marker.data.description || '',
                latitude: marker.data.latitude,
                longitude: marker.data.longitude,
                category: marker.data.category || 'other',
                hashtags: marker.data.hashtags || [],
                address: marker.data.address
              },
              images: [], // Фото из localStorage не можем восстановить как File
              hasImages: false,
              status: 'draft',
              regionId: 'default'
            });
            migratedCount++;
          }
        }
      } catch (e) {
        console.warn('Ошибка миграции меток:', e);
      }

      // Мигрируем события из localModerationStorage
      try {
        const { getAllPendingContent } = await import('./localModerationStorage');
        const pendingEvents = getAllPendingContent('event');
        for (const event of pendingEvents) {
          if (event.data && event.data.title) {
            await this.addDraft({
              contentType: 'event',
              contentData: {
                title: event.data.title || '',
                description: event.data.description || '',
                start_datetime: event.data.start_datetime || event.data.start_date || new Date().toISOString(),
                end_datetime: event.data.end_datetime || event.data.end_date,
                location: typeof event.data.location === 'string' ? event.data.location : event.data.location?.address || '',
                latitude: event.data.latitude || null,
                longitude: event.data.longitude || null,
                category: event.data.category,
                hashtags: event.data.hashtags || [],
                organizer: event.data.organizer
              },
              images: [], // Фото из localStorage не можем восстановить как File
              hasImages: false,
              status: 'draft',
              regionId: 'default'
            });
            migratedCount++;
          }
        }
      } catch (e) {
        console.warn('Ошибка миграции событий:', e);
      }

      // Мигрируем маршруты из guestDrafts
      try {
        const guestDraftsModule = await import('./guestDrafts');
        // guestDrafts экспортирует listDrafts, а не loadAll
        const listDrafts = (guestDraftsModule as any).listDrafts;
        const guestDrafts = listDrafts ? listDrafts('route') : [];
        for (const draft of guestDrafts) {
          if (draft.type === 'route' && draft.data) {
            let track: GeoJSON.Feature<GeoJSON.LineString> | null = null;
            try {
              if (draft.data.route_data) {
                track = typeof draft.data.route_data === 'string' ? 
                  JSON.parse(draft.data.route_data) : draft.data.route_data;
              }
            } catch (e) {
              console.warn('Ошибка парсинга трека маршрута:', e);
            }

            await this.addDraft({
              contentType: 'route',
              contentData: {
                title: draft.data.title || 'Новый маршрут',
                description: draft.data.description || '',
                points: draft.data.points || draft.data.waypoints?.map((wp: any) => ({
                  latitude: wp.coordinates?.[0] || wp.latitude || 0,
                  longitude: wp.coordinates?.[1] || wp.longitude || 0,
                  title: wp.name || wp.title || ''
                })) || [],
                waypoints: draft.data.waypoints,
                totalDistance: draft.data.total_distance,
                estimatedDuration: draft.data.estimated_duration,
                tags: draft.data.tags || []
              },
              track: track,
              hasTrack: !!track,
              hasImages: false, // Маршруты не имеют изображений
              status: 'draft',
              regionId: 'default'
            });
            migratedCount++;
          }
        }
      } catch (e) {
        console.warn('Ошибка миграции маршрутов:', e);
      }

      if (migratedCount > 0) {
        // console.log(`✅ Мигрировано черновиков из localStorage: ${migratedCount}`);
        // Помечаем, что миграция выполнена
        storageService.setItem('geoblog_offline_migration_done', 'true');
      }
    } catch (error) {
      console.error('Ошибка миграции черновиков:', error);
    }

    return migratedCount;
  }

  /**
   * Добавить черновик
   */
  async addDraft(draft: Omit<AnyOfflineDraft, 'id' | 'createdAt' | 'retries'>): Promise<string> {
    await this.init();

    const id = crypto.randomUUID();
    const fullDraft: AnyOfflineDraft = {
      ...draft,
      id,
      createdAt: Date.now(),
      retries: 0
    } as AnyOfflineDraft;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(fullDraft);

      request.onsuccess = () => {
        // console.log(`✅ Черновик сохранён [${draft.contentType}]: ${id}`);
        resolve(id);
      };

      request.onerror = () => {
        console.error('Ошибка сохранения черновика:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Получить черновик по ID
   */
  async getDraft(id: string): Promise<AnyOfflineDraft | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Получить все черновики (с фильтрацией)
   */
  async getAllDrafts(
    contentType?: ContentType,
    status?: DraftStatus
  ): Promise<AnyOfflineDraft[]> {
    const loadDrafts = async (): Promise<AnyOfflineDraft[]> => {
      await this.init();

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('База данных не инициализирована'));
          return;
        }

        let request: IDBRequest;

        try {
          const transaction = this.db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);

          if (contentType && status) {
            const index = store.index('type_status');
            request = index.getAll([contentType, status]);
          } else if (contentType) {
            const index = store.index('contentType');
            request = index.getAll(contentType);
          } else if (status) {
            const index = store.index('status');
            request = index.getAll(status);
          } else {
            request = store.getAll();
          }

          transaction.onabort = () => {
            reject(transaction.error || new Error('Транзакция чтения черновиков была прервана'));
          };

          request.onsuccess = () => {
            const drafts = request.result || [];
            drafts.sort((a: AnyOfflineDraft, b: AnyOfflineDraft) => b.createdAt - a.createdAt);
            resolve(drafts);
          };

          request.onerror = () => {
            reject(request.error);
          };
        } catch (error) {
          reject(error);
        }
      });
    };

    try {
      return await loadDrafts();
    } catch (error) {
      if (!this.isRecoverableConnectionError(error)) {
        throw error;
      }

      this.resetConnection();
      await this.init();
      return loadDrafts();
    }
  }

  /**
   * Обновить статус черновика
   */
  async updateDraftStatus(
    id: string,
    status: DraftStatus,
    retries?: number
  ): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const draft = getRequest.result;
        if (!draft) {
          reject(new Error('Черновик не найден'));
          return;
        }

        draft.status = status;
        if (retries !== undefined) {
          draft.retries = retries;
        }

        const putRequest = store.put(draft);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Удалить черновик
   */
  async deleteDraft(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        // console.log(`✅ Черновик удалён: ${id}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Автоочистка старых черновиков (>30 дней)
   */
  async cleanupOldDrafts(): Promise<number> {
    await this.init();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const draft = cursor.value as AnyOfflineDraft;
          // Удаляем только draft и failed статусы (не uploading!)
          if (draft.status === 'draft' || draft.status === 'failed' || draft.status === 'failed_permanent') {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            // console.log(`✅ Удалено старых черновиков: ${deletedCount}`);
          }
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Получить количество черновиков
   */
  async getDraftsCount(contentType?: ContentType, status?: DraftStatus): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      let request: IDBRequest<number>;

      if (contentType && status) {
        const index = store.index('type_status');
        request = index.count([contentType, status]);
      } else if (contentType) {
        const index = store.index('contentType');
        request = index.count(contentType);
      } else if (status) {
        const index = store.index('status');
        request = index.count(status);
      } else {
        request = store.count();
      }

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Получить статистику по черновикам
   */
  async getDraftsStats(): Promise<Record<ContentType, { total: number; byStatus: Record<DraftStatus, number> }>> {
    await this.init();

    const stats: Record<ContentType, { total: number; byStatus: Record<DraftStatus, number> }> = {
      post: { total: 0, byStatus: { draft: 0, uploading: 0, failed: 0, failed_permanent: 0 } },
      marker: { total: 0, byStatus: { draft: 0, uploading: 0, failed: 0, failed_permanent: 0 } },
      route: { total: 0, byStatus: { draft: 0, uploading: 0, failed: 0, failed_permanent: 0 } },
      event: { total: 0, byStatus: { draft: 0, uploading: 0, failed: 0, failed_permanent: 0 } }
    };

    const allDrafts = await this.getAllDrafts();
    
    for (const draft of allDrafts) {
      stats[draft.contentType].total++;
      stats[draft.contentType].byStatus[draft.status]++;
    }

    return stats;
  }
}

// Экспортируем singleton
export const offlineContentStorage = new OfflineContentStorage();

// Инициализация при импорте модуля (пропускаем в тестовой среде)
if (typeof window !== 'undefined' && !(typeof process !== 'undefined' && process.env.VITEST === 'true')) {
  offlineContentStorage.init().then(() => {
    // Выполняем миграцию только раз
    const migrationDone = storageService.getItem('geoblog_offline_migration_done');
    if (migrationDone !== 'true') {
      offlineContentStorage.migrateLocalStorageDrafts().catch(console.error);
    }
  }).catch(console.error);
}

