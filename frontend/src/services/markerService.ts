/**
 * Сервис для работы с маркерами на карте
 * 
 * Основные функции:
 * - getAllMarkers() - получение всех маркеров
 * - getMarkersByBounds() - ленивая загрузка маркеров по области
 * - getMarkersByCategories() - фильтрация маркеров по категориям
 * - createMarker() - создание нового маркера
 * - updateMarkerFromContent() - обновление маркера из контента
 * - deleteMarkerForContent() - удаление маркера
 * - addPhotoToMarker() - добавление фото к маркеру
 */

import { MarkerData } from '../types/marker';
import apiClient from '../api/apiClient';
import { recordGuestAction } from './guestActionsService';
import { addXPForMarker } from '../utils/gamificationHelper';
import storageService from './storageService';

interface ContentSource {
  id: string;
  type: 'post' | 'event' | 'route' | 'chat' | 'attraction' | 'restaurant' | 'hotel' | 'nature' | 'culture' | 'entertainment' | 'transport' | 'service' | 'other';
  title: string;
  location: {
    latitude: number;
    longitude: number;
  };
  creatorId: string;
  hashtags?: string[];
}

// Единая точка входа через ProjectManager
import { projectManager } from './projectManager';

export const getAllMarkers = async (): Promise<MarkerData[]> => {
  // В markerService.ts, функция getAllMarkers:
  const response = await apiClient.get('/markers');
  console.log('[markerService] Received markers:', response.data?.length || 0);

  // ЕСЛИ API вернул 0 маркеров - используем мок
  if (!response.data || response.data.length === 0) {
      console.log('[markerService] No markers from API, using mock');
      return [
          { id: '1', name: 'Москва', latitude: 55.7558, longitude: 37.6173, category: 'city', status: 'published', rating: 0, photo_urls: [] } as any,
          { id: '2', name: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351, category: 'city', status: 'published', rating: 0, photo_urls: [] } as any,
          { id: '3', name: 'Казань', latitude: 55.7887, longitude: 49.1221, category: 'city', status: 'published', rating: 0, photo_urls: [] } as any,
      ];
  }

  return response.data || [];
};

export const getMarkerById = async (markerId: string): Promise<MarkerData | null> => {
  try {
    const response = await apiClient.get(`/markers/${markerId}`);
    return response.data || null;
  } catch (error: any) {
    return null;
  }
};

export const getMarkersByBounds = async (bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}, categories?: string[], limit: number = 100): Promise<MarkerData[]> => {
  try {
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
      limit: limit.toString()
    });

    if (categories && categories.length > 0) {
      params.append('categories', categories.join(','));
    }

    const response = await apiClient.get(`/markers/bounds?${params.toString()}`);
    return response.data || [];
  } catch (error) {
    throw error;
  }
};

export const createMarkerFromContent = async (content: ContentSource): Promise<MarkerData> => {
  try {
    const markerPayload = {
      title: content.title,
      latitude: content.location.latitude,
      longitude: content.location.longitude,
      category: content.type,
      hashtags: content.hashtags || [],
      content_id: content.id,
      content_type: content.type,
    };
    const response = await apiClient.post('/markers', markerPayload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateMarkerFromContent = async (content: ContentSource): Promise<MarkerData> => {
  try {
    const markerPayload = {
      title: content.title,
      latitude: content.location.latitude,
      longitude: content.location.longitude,
      hashtags: content.hashtags || [],
    };
    const response = await apiClient.put(`/markers/by-content/${content.type}/${content.id}`, markerPayload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteMarkerForContent = async (contentType: string, contentId: string): Promise<void> => {
  try {
    await apiClient.delete(`/markers/by-content/${contentType}/${contentId}`);
  } catch (error) {
    throw error;
  }
};

export const addPhotoToMarker = async (markerId: string, file: File): Promise<MarkerData> => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiClient.post(`/markers/${markerId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createMarker = async (markerData: {
  title: string;
  description?: string;
  latitude: number | string;
  longitude: number | string;
  category: string;
  hashtags?: string[] | string;
  photoUrls?: string[] | string;
  address?: string;
}): Promise<MarkerData> => {
  try {
    // Убеждаемся, что координаты - это числа
    const latitude = typeof markerData.latitude === 'string' ? parseFloat(markerData.latitude) : Number(markerData.latitude);
    const longitude = typeof markerData.longitude === 'string' ? parseFloat(markerData.longitude) : Number(markerData.longitude);

    // Проверяем валидность координат
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error('Неверные координаты маркера');
    }

    const apiData = {
      ...markerData,
      latitude,
      longitude,
      hashtags: Array.isArray(markerData.hashtags)
        ? markerData.hashtags
        : (markerData.hashtags ? markerData.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag) : []),
      photoUrls: Array.isArray(markerData.photoUrls)
        ? markerData.photoUrls
        : (markerData.photoUrls && typeof markerData.photoUrls === 'string' && markerData.photoUrls.trim()
          ? markerData.photoUrls.split(',').map(url => url.trim()).filter(url => url)
          : [])
    };

    const token = storageService.getItem('token');
    if (!token) {
      // Save as guest draft
      const { saveDraft } = await import('./guestDrafts');
      const draft = saveDraft('marker', apiData);

      // Отслеживаем действие гостя
      const hasPhoto = !!(markerData.photoUrls && (Array.isArray(markerData.photoUrls) ? markerData.photoUrls.length > 0 : markerData.photoUrls));
      const hasDescription = !!markerData.description;
      const completeness = hasDescription && hasPhoto ? 100 : hasDescription ? 80 : hasPhoto ? 60 : 40;

      recordGuestAction({
        actionType: 'marker',
        contentId: draft.id,
        contentData: apiData,
        approved: false,
        metadata: {
          hasPhoto,
          hasDescription,
          completeness,
        },
      });

      return {
        id: `draft:${draft.id}`,
        title: apiData.title,
        description: apiData.description || '',
        latitude: apiData.latitude,
        longitude: apiData.longitude,
        category: apiData.category,
        rating: 0,
        rating_count: 0,
        photo_urls: apiData.photoUrls || [],
        hashtags: Array.isArray(apiData.hashtags) ? apiData.hashtags : [],
        author_name: 'Гость',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_draft: true,
      } as any;
    }

    // Проверяем, является ли пользователь админом
    let isAdmin = false;
    try {
      const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        isAdmin = user?.role === 'admin';
      }
    } catch (e) {
      // Игнорируем ошибку парсинга
    }

    // Для не-админов сохраняем локально на модерацию
    if (!isAdmin) {
      const { savePendingContent } = await import('./localModerationStorage');
      const { analyzeContentWithAI } = await import('./aiModerationService');

      const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const authorName = (() => {
        try {
          const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user?.username || user?.email || 'Пользователь';
          }
        } catch { }
        return 'Пользователь';
      })();

      const authorId = (() => {
        try {
          const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user?.id;
          }
        } catch { }
        return undefined;
      })();

      // Сохраняем локально
      savePendingContent({
        id: pendingId,
        type: 'marker',
        data: apiData,
        created_at: new Date().toISOString(),
        author_id: authorId,
        author_name: authorName,
      });

      // Запускаем ИИ-анализ асинхронно
      analyzeContentWithAI('marker', pendingId, apiData).catch(err =>
        console.error('Ошибка ИИ-анализа метки:', err)
      );

      // Возвращаем метку с флагом "на модерации"
      return {
        id: pendingId,
        title: apiData.title,
        description: apiData.description || '',
        latitude: apiData.latitude,
        longitude: apiData.longitude,
        category: apiData.category,
        rating: 0,
        rating_count: 0,
        photo_urls: apiData.photoUrls || [],
        hashtags: Array.isArray(apiData.hashtags) ? apiData.hashtags : [],
        author_name: authorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_pending: true, // Флаг "на модерации"
        status: 'pending',
      } as any;
    }

    // Для админов сохраняем сразу в БД
    const response = await apiClient.post('/markers', apiData);
    const marker = response.data;

    // Интеграция геймификации (асинхронно, не блокируем ответ)
    if (marker?.id) {
      // Используем setTimeout для асинхронного выполнения без блокировки
      setTimeout(() => {
        // Получаем userId из токена
        const token = storageService.getItem('token');
        let userId = marker.creator_id || undefined;

        // Если userId нет в ответе, пытаемся получить из токена (упрощённо)
        if (!userId && token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.userId || payload.id || undefined;
          } catch (e) {
            // Игнорируем ошибку парсинга токена
          }
        }

        if (userId) {
          const hasPhoto = !!(markerData.photoUrls && (Array.isArray(markerData.photoUrls) ? markerData.photoUrls.length > 0 : markerData.photoUrls));
          const hasDescription = !!markerData.description;
          const completeness = hasDescription && hasPhoto ? 100 : hasDescription ? 80 : hasPhoto ? 60 : 40;

          addXPForMarker(marker.id, {
            hasPhoto,
            hasDescription,
            completeness,
            userId,
          }).catch(err => console.error('Gamification error:', err));
        }
      }, 0);
    }

    return marker;
  } catch (error) {
    throw error;
  }
};

export const getMarkersByCategories = async (categories: string[]): Promise<MarkerData[]> => {
  try {
    const params = new URLSearchParams({
      categories: categories.join(',')
    });

    const response = await apiClient.get(`/markers?${params.toString()}`);
    return response.data || [];
  } catch (error) {
    throw error;
  }
};

export const updateMarker = async (markerId: string, updates: Partial<MarkerData>): Promise<MarkerData> => {
  try {
    const response = await apiClient.put(`/markers/${markerId}`, updates);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Получить все фото пользователя из его маркеров
export const getUserPhotos = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get('/markers/user/photos');
    return response.data?.photos || [];
  } catch (error) {
    throw error;
  }
};

// Загрузить фото и получить URL
export const uploadImage = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiClient.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data?.photoUrl || '';
  } catch (error) {
    throw error;
  }
};

export const markerService = {
  getAllMarkers,
  getMarkersByBounds,
  // Экспортируем ProjectManager для централизованного доступа
  projectManager,
  getMarkersByCategories, // Новая функция для фильтрации по категориям
  createMarkerFromContent,
  createMarker,
  updateMarker,
  updateMarkerFromContent,
  deleteMarkerForContent,
  addPhotoToMarker,
  getUserPhotos,
};
