/**
 * Универсальный сервис очереди отправки офлайн контента всех типов
 * Управляет отправкой черновиков на сервер с ретраями и бэкоффом
 */

import {
  offlineContentStorage,
  AnyOfflineDraft,
  ContentType,
  OfflinePostDraft,
  OfflineMarkerDraft,
  OfflineRouteDraft,
  OfflineEventDraft
} from './offlineContentStorage';
import apiClient from '../api/apiClient';
import { analyticsOrchestrator } from '../analytics/services/analyticsOrchestrator';
import storageService from './storageService';

export interface UploadProgress {
  contentId: string;
  contentType: ContentType;
  stage: 'creating' | 'uploading_images' | 'uploading_track' | 'completed';
  progress: number; // 0-100
  error?: string;
}

class OfflineContentQueue {
  private isProcessing = false;
  private currentUpload: UploadProgress | null = null;
  private readonly listeners: Set<(progress: UploadProgress | null) => void> = new Set();

  /**
   * Подписаться на обновления прогресса
   */
  onProgress(callback: (progress: UploadProgress | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Уведомить слушателей о прогрессе
   */
  private notifyProgress(progress: UploadProgress | null) {
    this.currentUpload = progress;
    this.listeners.forEach(cb => cb(progress));
  }

  /**
   * Вычислить задержку для ретрая на основе количества попыток
   */
  private getRetryDelay(retries: number): number {
    if (retries === 0) {
      return 0; // Первая попытка - сразу
    } else if (retries === 1) {
      return 60 * 1000; // 1 минута
    } else {
      return 5 * 60 * 1000; // 5 минут для остальных попыток
    }
  }

  /**
   * Трекинг события офлайн-сессии в аналитику
   */
  private trackOfflineSessionEvent(
    contentType: ContentType,
    metadata: { offline_duration: number; offline_actions: number; network_status_at_creation: 'offline' },
    additionalData: Record<string, any> = {}
  ): void {
    try {
      analyticsOrchestrator.trackUserJourney({
        user_id: undefined,
        event_type: 'offline_content_uploaded',
        timestamp: Date.now(),
        properties: {
          content_type: contentType,
          offline_duration: metadata.offline_duration,
          offline_actions: metadata.offline_actions,
          network_status_at_creation: metadata.network_status_at_creation,
          ...additionalData
        },
        session_id: analyticsOrchestrator.getSessionId()
      });
    } catch (error) {
      console.error('Ошибка трекинга офлайн-сессии:', error);
    }
  }

  /**
   * Вычислить метаданные офлайн-сессии
   */
  private calculateOfflineSessionMetadata(draft: AnyOfflineDraft): {
    offline_duration: number; // в секундах
    offline_actions: number;
    network_status_at_creation: 'offline';
  } {
    const now = Date.now();
    const offlineDuration = Math.floor((now - draft.createdAt) / 1000); // в секундах

    // Подсчитываем количество действий (правки, фото, точки трека)
    let offlineActions = 0;

    // Фото
    offlineActions += draft.images?.length || 0;

    // Точки трека
    offlineActions += draft.track?.geometry?.coordinates?.length || 0;

    // Если есть метаданные о правках
    offlineActions += draft.offlineSessionMetadata?.offline_actions || 0;

    return {
      offline_duration: offlineDuration,
      offline_actions: offlineActions,
      network_status_at_creation: 'offline' // Гарантированно офлайн, так как это черновик
    };
  }

  /**
   * Вспомогательные функции для отправки постов и маршрутов
   */
  private async uploadImagesForPost(postId: string, images?: File[]): Promise<void> {
    if (!images?.length) return;
    const formData = new FormData();
    images.forEach((file) => formData.append('images', file));
    await apiClient.post(`/posts/${postId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  private async uploadTrackForPost(postId: string, track?: any): Promise<void> {
    if (!track) return;
    await apiClient.put(`/posts/${postId}/track`, { track });
  }

  private async confirmPostAndRemoveDraft(postId: string, draftId: string): Promise<void> {
    const postCheck = await apiClient.get(`/posts/${postId}`);
    if (postCheck?.data?.id) {
      await offlineContentStorage.deleteDraft(draftId);
    } else {
      throw new Error(`Пост ${postId} не найден в БД после создания`);
    }
  }

  private async finalizePostUpload(draftId: string, offlineMetadata: any, images?: any[], track?: any): Promise<void> {
    this.trackOfflineSessionEvent('post', offlineMetadata, {
      hasImages: (images?.length || 0) > 0,
      hasTrack: !!track,
      imagesCount: images?.length || 0,
      trackPointsCount: track?.geometry?.coordinates?.length || 0
    });

    this.notifyProgress({
      contentId: draftId,
      contentType: 'post',
      stage: 'completed',
      progress: 100
    });

    setTimeout(() => {
      this.notifyProgress(null);
    }, 2000);
  }

  private async createOfflinePost(draft: OfflinePostDraft, offlineMetadata: any): Promise<any> {
    try {
      return await apiClient.post('/offline-posts', {
        text: draft.contentData.text,
        title: (draft.contentData.title || null),
        regionId: draft.regionId,
        hasImages: !!(draft.hasImages && (draft.images?.length || 0) > 0),
        hasTrack: !!(draft.hasTrack && draft.track !== null),
        offline_duration: offlineMetadata.offline_duration,
        offline_actions: offlineMetadata.offline_actions,
        network_status_at_creation: offlineMetadata.network_status_at_creation
      });
    } catch (requestError: any) {
      console.error('❌ Ошибка при запросе создания поста:', {
        error: requestError,
        message: requestError?.message,
        response: requestError?.response,
        status: requestError?.response?.status,
        data: requestError?.response?.data
      });
      throw requestError;
    }
  }

  private async uploadMediaForPost(postId: string, images?: File[], track?: any): Promise<void> {
    // Загрузка изображений
    if (images?.length) {
      this.notifyProgress({
        contentId: postId,
        contentType: 'post',
        stage: 'uploading_images',
        progress: 30
      });

      await this.uploadImagesForPost(postId, images);

      this.notifyProgress({
        contentId: postId,
        contentType: 'post',
        stage: 'uploading_images',
        progress: 70
      });
    }

    // Загрузка трека
    if (track) {
      this.notifyProgress({
        contentId: postId,
        contentType: 'post',
        stage: 'uploading_track',
        progress: 80
      });

      await this.uploadTrackForPost(postId, track);

      this.notifyProgress({
        contentId: postId,
        contentType: 'post',
        stage: 'uploading_track',
        progress: 90
      });
    }
  }

  /**
   * Отправить черновик поста
   */
  private async uploadPostDraft(draft: OfflinePostDraft): Promise<void> {
    const { id, images, track } = draft;

    try {
      // Вычисляем метаданные офлайн-сессии
      const offlineMetadata = this.calculateOfflineSessionMetadata(draft);

      // Этап 1: Создать заглушку поста
      this.notifyProgress({
        contentId: id,
        contentType: 'post',
        stage: 'creating',
        progress: 10
      });



      const createResponse = await this.createOfflinePost(draft, offlineMetadata);

      // Проверяем структуру ответа и наличие данных
      if (!createResponse?.data) {
        if (createResponse?.status === 201 || createResponse?.status === 200) {
          throw new Error('Сервер вернул успешный статус, но без данных. Возможно, проблема с обработкой ответа на сервере.');
        }
        throw new Error(`Неверный формат ответа от сервера: отсутствует data. Статус: ${createResponse?.status || 'неизвестен'}`);
      }

      // responseData - это данные из createResponse.data
      const responseData = createResponse.data;

      // Проверяем наличие ID в ответе
      const postId = responseData.id || responseData.post?.id || responseData.postId;

      if (!postId) {

        throw new Error('Сервер не вернул ID созданного поста. Проверьте авторизацию и попробуйте снова.');
      }



      // Этап 2/3: Загрузить вспомогательные данные (изображения и трек)
      await this.uploadMediaForPost(postId, images, track);

      // ВАЖНО: Удаляем черновик ТОЛЬКО после успешной загрузки ВСЕХ частей
      // Это гарантирует, что если что-то пойдет не так, черновик останется
      // Проверяем и удаляем черновик по результату
      await this.confirmPostAndRemoveDraft(postId, id);

      await this.finalizePostUpload(id, offlineMetadata, images, track);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Отправить черновик метки
   */
  private async uploadMarkerDraft(draft: OfflineMarkerDraft): Promise<void> {
    const { id, contentData, images } = draft;

    try {
      this.notifyProgress({
        contentId: id,
        contentType: 'marker',
        stage: 'creating',
        progress: 20
      });

      // Сначала загружаем фото, если есть
      let photoUrls: string[] = [];
      if (images && images.length > 0) {
        this.notifyProgress({
          contentId: id,
          contentType: 'marker',
          stage: 'uploading_images',
          progress: 30
        });

        const uploadPromises = images.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          const response = await apiClient.post('/upload/image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          return response.data.photoUrl;
        });

        photoUrls = await Promise.all(uploadPromises);
        this.notifyProgress({
          contentId: id,
          contentType: 'marker',
          stage: 'uploading_images',
          progress: 70
        });
      }

      // Вычисляем метаданные офлайн-сессии
      const offlineMetadata = this.calculateOfflineSessionMetadata(draft);

      // Создаём метку
      const markerData = {
        title: contentData.title,
        description: contentData.description,
        latitude: contentData.latitude,
        longitude: contentData.longitude,
        category: contentData.category,
        hashtags: contentData.hashtags || [],
        photoUrls: photoUrls,
        address: contentData.address,
        // Метаданные офлайн-сессии
        offline_duration: offlineMetadata.offline_duration,
        offline_actions: offlineMetadata.offline_actions,
        network_status_at_creation: offlineMetadata.network_status_at_creation
      };

      await apiClient.post('/markers', markerData);

      // Трекинг события офлайн-сессии в аналитику
      this.trackOfflineSessionEvent('marker', offlineMetadata, {
        imagesCount: images?.length || 0
      });

      // Успешно отправлено - удаляем из IndexedDB
      await offlineContentStorage.deleteDraft(id);

      this.notifyProgress({
        contentId: id,
        contentType: 'marker',
        stage: 'completed',
        progress: 100
      });



      setTimeout(() => {
        this.notifyProgress(null);
      }, 2000);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Вспомогательные функции для маршрутов
   */
  private async ensureMarkersForPoints(points: Array<any>): Promise<string[]> {
    const ensuredMarkerIds: string[] = [];

    for (const point of points || []) {
      if (point?.id?.startsWith?.('pending_')) {
        try {
          const markerResponse = await apiClient.post('/markers', {
            title: point.title || `Точка маршрута`,
            latitude: point.latitude,
            longitude: point.longitude,
            category: 'route',
            description: point.description
          });
          ensuredMarkerIds.push(markerResponse.data.id);
        } catch (e) {
          console.warn('Ошибка создания маркера для точки маршрута:', e);
        }
      } else if (point?.id) {
        ensuredMarkerIds.push(point.id);
      }
    }

    return ensuredMarkerIds;
  }

  private async tryAwardXPForRoute(createdId: string | null): Promise<void> {
    const userSnapshot = storageService.getItem('user');
    if (!createdId || !userSnapshot) return;

    const user = JSON.parse(userSnapshot);
    const userId = user?.id;
    if (!userId) return;

    // Попытка аккуратно загрузить опциональный модуль геймификации
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const gamificationModule = require('./gamificationFacade');
      const gamificationFacade = gamificationModule?.gamificationFacade;

      if (gamificationFacade && typeof gamificationFacade.addXP === 'function') {
        await gamificationFacade.addXP({ userId, source: 'route_created', amount: 50, contentId: createdId, contentType: 'route' });
      }
    } catch (err: any) {
      // Если модуль отсутствует — это нормально в тестовой среде или при отключённой фиче
      if (err && err.code === 'MODULE_NOT_FOUND') {
        console.debug('[OfflineContentQueue] gamification module not available, skipping XP award');
      } else {
        console.debug('[OfflineContentQueue] gamification require error:', err?.message || err);
      }
    }
  }

  /**
   * Отправить черновик маршрута
   */
  private async uploadRouteDraft(draft: OfflineRouteDraft): Promise<void> {
    const { id, contentData, track } = draft;

    try {
      this.notifyProgress({
        contentId: id,
        contentType: 'route',
        stage: 'creating',
        progress: 20
      });

      // Сначала создаём маркеры для точек маршрута (если нужно)
      const ensuredMarkerIds = await this.ensureMarkersForPoints(contentData.points || []);

      // Вычисляем метаданные офлайн-сессии
      const offlineMetadata = this.calculateOfflineSessionMetadata(draft);

      // Формируем waypoints
      const waypoints = contentData.waypoints || contentData.points.map((point, index) => ({
        marker_id: ensuredMarkerIds[index] || point.id || `temp_${index}`,
        order_index: index,
        notes: point.description
      }));

      // Создаём маршрут
      const routeData = {
        title: contentData.title,
        description: contentData.description,
        waypoints: waypoints,
        route_data: track ? JSON.stringify(track) : null,
        // client id for idempotency: prefer explicit clientId, fallback to draft id
        client_id: (draft as any).clientId || id,
        total_distance: contentData.totalDistance,
        estimated_duration: contentData.estimatedDuration,
        tags: contentData.tags || [],
        // Метаданные офлайн-сессии
        offline_duration: offlineMetadata.offline_duration,
        offline_actions: offlineMetadata.offline_actions,
        network_status_at_creation: offlineMetadata.network_status_at_creation
      };

      let createResponse;
      try {
        createResponse = await apiClient.post('/routes', routeData);
      } catch (err: any) {
        const status = err?.response?.status;
        // Если сервер сообщает, что это дубликат (идемпотентность), считаем успешной отправку
        if (status === 409 || status === 422) {
          try {
            await offlineContentStorage.deleteDraft(id);
          } catch (e) {
            console.warn('[OfflineContentQueue] Failed removing draft after duplicate route error:', e);
          }
          this.notifyProgress({
            contentId: id,
            contentType: 'route',
            stage: 'completed',
            progress: 100
          });
          setTimeout(() => this.notifyProgress(null), 2000);
          return;
        }
        throw err;
      }

      // Трекинг события офлайн-сессии в аналитику
      this.trackOfflineSessionEvent('route', offlineMetadata, {
        pointsCount: contentData.points?.length || 0,
        hasTrack: !!track,
        trackPointsCount: track?.geometry?.coordinates?.length || 0
      });

      // Попытка начислить XP за создание маршрута (если есть текущий пользователь)
      const createdId = createResponse?.data?.id || null;
      await this.tryAwardXPForRoute(createdId);

      // Успешно отправлено - удаляем из IndexedDB
      await offlineContentStorage.deleteDraft(id);

      this.notifyProgress({
        contentId: id,
        contentType: 'route',
        stage: 'completed',
        progress: 100
      });



      setTimeout(() => {
        this.notifyProgress(null);
      }, 2000);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Отправить черновик события
   */
  private async uploadEventDraft(draft: OfflineEventDraft): Promise<void> {
    const { id, contentData, images } = draft;

    try {
      this.notifyProgress({
        contentId: id,
        contentType: 'event',
        stage: 'creating',
        progress: 20
      });

      // Сначала загружаем фото, если есть
      let photoUrls: string[] = [];
      if (images && images.length > 0) {
        this.notifyProgress({
          contentId: id,
          contentType: 'event',
          stage: 'uploading_images',
          progress: 30
        });

        const uploadPromises = images.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          const response = await apiClient.post('/upload/image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          return response.data.photoUrl;
        });

        photoUrls = await Promise.all(uploadPromises);
        this.notifyProgress({
          contentId: id,
          contentType: 'event',
          stage: 'uploading_images',
          progress: 70
        });
      }

      // Вычисляем метаданные офлайн-сессии
      const offlineMetadata = this.calculateOfflineSessionMetadata(draft);

      // Создаём событие
      const eventData = {
        title: contentData.title,
        description: contentData.description,
        start_datetime: contentData.start_datetime,
        end_datetime: contentData.end_datetime,
        location: contentData.location,
        latitude: contentData.latitude,
        longitude: contentData.longitude,
        category: contentData.category,
        hashtags: contentData.hashtags || [],
        photo_urls: photoUrls,
        organizer: contentData.organizer,
        is_public: true,
        // Метаданные офлайн-сессии
        offline_duration: offlineMetadata.offline_duration,
        offline_actions: offlineMetadata.offline_actions,
        network_status_at_creation: offlineMetadata.network_status_at_creation
      };

      await apiClient.post('/events', eventData);

      // Трекинг события офлайн-сессии в аналитику
      this.trackOfflineSessionEvent('event', offlineMetadata, {
        imagesCount: images?.length || 0
      });

      // Успешно отправлено - удаляем из IndexedDB
      await offlineContentStorage.deleteDraft(id);

      this.notifyProgress({
        contentId: id,
        contentType: 'event',
        stage: 'completed',
        progress: 100
      });



      setTimeout(() => {
        this.notifyProgress(null);
      }, 2000);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Отправить один черновик на сервер (универсальный метод)
   */
  private async uploadDraft(draft: AnyOfflineDraft): Promise<void> {
    try {
      switch (draft.contentType) {
        case 'post':
          await this.uploadPostDraft(draft);
          break;
        case 'marker':
          await this.uploadMarkerDraft(draft);
          break;
        case 'route':
          await this.uploadRouteDraft(draft);
          break;
        case 'event':
          await this.uploadEventDraft(draft);
          break;
        default:
          throw new Error(`Неизвестный тип контента: ${(draft as any).contentType}`);
      }
    } catch (error: any) {
      console.error(`❌ Ошибка отправки ${draft.contentType} ${draft.id}:`, error);

      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка';
      // Считаем ошибку ретраемовой, если это сетевая ошибка или 5xx от сервера
      const statusCode = error.response?.status;
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || (statusCode && statusCode >= 500 && statusCode < 600);

      // Увеличиваем счётчик попыток
      const newRetries = draft.retries + 1;
      const maxRetries = 5;

      if (newRetries >= maxRetries) {
        // Превышен лимит попыток - помечаем как failed_permanent
        await offlineContentStorage.updateDraftStatus(draft.id, 'failed_permanent', newRetries);
        this.notifyProgress({
          contentId: draft.id,
          contentType: draft.contentType,
          stage: 'creating',
          progress: 0,
          error: `Превышен лимит попыток (${maxRetries}). Контент не отправлен.`
        });
      } else {
        // Обновляем статус на failed и увеличиваем retries
        await offlineContentStorage.updateDraftStatus(draft.id, 'failed', newRetries);

        // Если это сетевая ошибка, планируем повтор через задержку
        if (isNetworkError) {
          const delay = this.getRetryDelay(newRetries);


          setTimeout(() => {
            this.processQueue();
          }, delay);
        }

        this.notifyProgress({
          contentId: draft.id,
          contentType: draft.contentType,
          stage: 'creating',
          progress: 0,
          error: errorMessage
        });
      }

      throw error;
    }
  }

  /**
   * Обработать очередь черновиков (отправить один за раз)
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Уже обрабатывается
    }

    // Проверяем наличие интернета
    if (!navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      // Получаем черновики со статусом draft или failed (не failed_permanent и не uploading)
      const drafts = await offlineContentStorage.getAllDrafts();
      const readyDrafts = drafts.filter(
        d => d.status === 'draft' || d.status === 'failed'
      );

      if (readyDrafts.length === 0) {
        return;
      }

      // Берём первый черновик
      const draft = readyDrafts[0];

      // Обновляем статус на uploading
      await offlineContentStorage.updateDraftStatus(draft.id, 'uploading');

      // Отправляем
      await this.uploadDraft(draft);

      // После успешной отправки обрабатываем следующий черновик
      setTimeout(() => {
        this.processQueue();
      }, 1000);
    } catch (error) {
      console.error('Ошибка обработки очереди:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Отправить конкретный черновик вручную
   */
  async uploadDraftById(draftId: string): Promise<void> {
    const draft = await offlineContentStorage.getDraft(draftId);
    if (!draft) {
      throw new Error('Черновик не найден');
    }

    if (draft.status === 'uploading') {
      throw new Error('Черновик уже отправляется');
    }

    // Сбрасываем retries для ручной отправки
    await offlineContentStorage.updateDraftStatus(draft.id, 'draft', 0);

    await this.uploadDraft(draft);
  }

  /**
   * Запустить обработку очереди (если не запущена)
   */
  start(): void {
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Получить текущий прогресс загрузки
   */
  getCurrentProgress(): UploadProgress | null {
    return this.currentUpload;
  }

  /**
   * Получить список черновиков по типу (обёртка над offlineContentStorage)
   */
  async getDrafts(type?: string): Promise<any[]> {
    try {
      // Используем общий метод getAllDrafts из offlineContentStorage
      const drafts = await offlineContentStorage.getAllDrafts(type as any);
      return drafts || [];
    } catch (e) {
      console.error('offlineContentQueue.getDrafts error', e);
      return [];
    }
  }

  /**
   * Удалить черновик (type игнорируется, оставлен для совместимости)
   */
  async deleteDraft(type: string, id: string): Promise<void> {
    try {
      await offlineContentStorage.deleteDraft(id);
    } catch (e) {
      console.error('offlineContentQueue.deleteDraft error', e);
    }
  }
}

// Экспортируем singleton
export const offlineContentQueue = new OfflineContentQueue();

// Автоматический запуск при появлении интернета
if (typeof globalThis !== 'undefined' && (globalThis as any).window) {
  (globalThis as any).window.addEventListener('online', () => {
    offlineContentQueue.start();
  });

  // Запуск при загрузке страницы (если есть черновики)
  (globalThis as any).window.addEventListener('load', () => {
    // intentionally not auto-starting to avoid noisy network ops on load
  });
}





