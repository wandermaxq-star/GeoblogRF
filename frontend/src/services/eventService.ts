import apiClient from '../api/apiClient';
import { EventData } from '../types/event';

export const getEventById = async (eventId: string): Promise<EventData | null> => {
  try {
    const response = await apiClient.get(`/events/${eventId}`);
    return response.data || null;
  } catch (error) {
    console.error('getEventById failed:', error);
    return null;
  }
};

// Функция для получения всех событий
export const getAllEvents = async (): Promise<EventData[]> => {
  try {
    const response = await apiClient.get('/events');
    return response.data || [];
  } catch (error) {
    console.error('getAllEvents failed:', error);
    return [];
  }
};

// Обновление события
export const updateEvent = async (eventId: string, updates: Partial<EventData & { photo_urls?: string[]; cover_image_url?: string }>): Promise<EventData | null> => {
  try {
    // Преобразуем photo_urls в строку, если это массив
    const updateData: any = { ...updates };
    if (updateData.photo_urls && Array.isArray(updateData.photo_urls)) {
      updateData.photo_urls = updateData.photo_urls.join(',');
    }

    const response = await apiClient.put(`/events/${eventId}`, updateData);
    return response.data || null;
  } catch (error) {
    console.error('updateEvent failed:', error);
    throw error;
  }
};

// Экспортируем функцию getEvents для совместимости
export const getEvents = getAllEvents;

// Получение событий на модерации
export const getPendingEvents = async (): Promise<EventData[]> => {
  try {
    const response = await apiClient.get('/events/pending');
    return response.data || [];
  } catch (error: any) {
    console.error('Ошибка загрузки событий на модерации:', error);
    if (error.response?.status === 403) {
      throw new Error('Недостаточно прав. Требуется роль администратора.');
    }
    if (error.response?.status === 401) {
      throw new Error('Требуется авторизация');
    }
    throw error;
  }
};

// Одобрение события
export const approveEvent = async (eventId: string): Promise<EventData> => {
  try {
    const response = await apiClient.post(`/events/${eventId}/approve`, {});
    return response.data.event;
  } catch (error: any) {
    console.error('Ошибка одобрения события:', error);
    if (error.response?.status === 403) {
      throw new Error('Недостаточно прав. Требуется роль администратора.');
    }
    throw error;
  }
};

// Отклонение события
export const rejectEvent = async (eventId: string, reason?: string): Promise<EventData> => {
  try {
    const response = await apiClient.post(`/events/${eventId}/reject`, { reason });
    return response.data.event;
  } catch (error: any) {
    console.error('Ошибка отклонения события:', error);
    if (error.response?.status === 403) {
      throw new Error('Недостаточно прав. Требуется роль администратора.');
    }
    throw error;
  }
};

// Создание нового события
export const createEvent = async (data: {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  is_public?: boolean;
  hashtags?: string[];
}): Promise<EventData> => {
  const response = await apiClient.post('/events', {
    ...data,
    start_datetime: data.start_date,
    end_datetime: data.end_date,
    is_public: data.is_public ?? true,
    status: 'pending',
  });
  return response.data;
};

// Экспортируем объект сервиса для совместимости
export const eventService = {
  getEventById,
  getAllEvents,
  updateEvent,
  createEvent,
};

// Экспортируем тип для совместимости
export type EventApiItem = EventData;