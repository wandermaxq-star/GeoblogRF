import { useState, useCallback } from 'react';
import { EventType } from '../types/event';
import { createMarkerFromContent } from '../services/markerService';
import { ContentSource } from '../types';
import apiClient from '../api/apiClient';

interface Integrations {
  mapMarkerId?: string;
  chatRoomId?: string;
  postId?: string;
}

export const useIntegrations = () => {
  const [loading, setLoading] = useState(false);
  const [availableRoutes] = useState([
    { id: 'route1', name: 'Маршрут по Карелии', distance: '45 км' },
    { id: 'route2', name: 'Восхождение на Эльбрус', distance: '12 км' },
    { id: 'route3', name: 'Поход по Алтаю', distance: '78 км' }
  ]);

  const createMapMarker = useCallback(
    async (
      location: { address: string; coordinates: { lat: number; lng: number } },
      eventData?: EventType
    ) => {
      const content: ContentSource = {
        id: '', // пусть сервер генерирует
        type: 'other',
        title: eventData?.title || 'Метка',
        location: {
          latitude: location.coordinates.lat,
          longitude: location.coordinates.lng
        },
        creatorId: '', // если не нужен — уберите
        description: eventData?.description || ''
      };
      const marker = await createMarkerFromContent(content);
      return marker.id;
    },
    []
  );

  // Chats are disabled in RF build — stubbed implementation
  const createChatRoom = useCallback(async (eventData: EventType) => {
    // Return undefined to indicate no chat room created
    return undefined;
  }, []);

  const publishToActivity = useCallback(async (eventData: EventType) => {
    try {
      await apiClient.post('/activity', {
        type: 'event_created',
        eventId: eventData.id,
        title: eventData.title,
        description: eventData.description
      });
      return true;
    } catch (error) {
      throw error;
    }
  }, []);

  const createPost = useCallback(async (eventData: EventType) => {
    try {
      const response = await apiClient.post('/posts', {
        title: `Отчет: ${eventData.title}`,
        body: eventData.description,
        event_id: eventData.id,
        tags: eventData.metadata?.tags || []
      });
      return response.data.id;
    } catch (error) {
      throw error;
    }
  }, []);

  const createIntegratedEvent = useCallback(
    async (eventData: EventType) => {
      setLoading(true);

      try {
        const integrations: Integrations = {};

        // Create map marker
        if (
          eventData.location.address &&
          eventData.location.coordinates &&
          typeof eventData.location.coordinates.lat === 'number' &&
          typeof eventData.location.coordinates.lng === 'number'
        ) {
          integrations.mapMarkerId = await createMapMarker(
            {
              address: eventData.location.address,
              coordinates: eventData.location.coordinates
            },
            eventData
          );
        }

        // Create chat room
        integrations.chatRoomId = await createChatRoom(eventData);

        // Publish to activity feed
        await publishToActivity(eventData);

        // If event is completed, create a post
        if (eventData.status === 'completed') {
          const postId = await createPost(eventData);
          integrations.postId = postId ?? undefined;
        }

        return {
          ...eventData,
          integrations
        };
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [createMapMarker, createChatRoom, publishToActivity, createPost]
  );

  const openInModule = useCallback(
    (moduleType: 'chat' | 'map' | 'route' | 'post', id: string) => {
      // Здесь можно добавить навигацию к соответствующим модулям
      switch (moduleType) {
        case 'chat':
          // Chat disabled in this build — show fallback message
          try { alert('Чаты отключены в текущей сборке приложения.'); } catch (e) { }
          break;
        case 'map':
          window.location.href = `/map?marker=${id}`;
          break;
        case 'route':
          window.location.href = `/routes?route=${id}`;
          break;
        case 'post':
          window.location.href = `/posts/${id}`;
          break;
        default:
          }
    },
    []
  );

  return {
    loading,
    availableRoutes,
    createIntegratedEvent,
    openInModule,
    createMapMarker,
    createChatRoom,
    publishToActivity,
    createPost
  };
};
