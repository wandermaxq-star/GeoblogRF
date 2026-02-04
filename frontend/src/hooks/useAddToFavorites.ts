import { useState } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';

export interface AddToFavoritesItem {
  id: string;
  title: string;
  type: 'marker' | 'event' | 'route' | 'photo';
  data?: any;
}

export const useAddToFavorites = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<AddToFavoritesItem | null>(null);
  const favorites = useFavorites();

  const openModal = (item: AddToFavoritesItem) => {
    setCurrentItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const handleConfirm = (category: string) => {
    if (currentItem && favorites) {
      // Сохраняем в соответствующую категорию
      if (currentItem.type === 'marker') {
        favorites.addToFavorites(currentItem.data, category);
      } else if (currentItem.type === 'event') {
        // Добавляем событие в избранное с категорией
        favorites.addFavoriteEvent({
          id: currentItem.data.id,
          title: currentItem.data.title,
          description: currentItem.data.description,
          date: currentItem.data.date,
          location: currentItem.data.location,
          latitude: 0,
          longitude: 0,
          category: category, // Используем выбранную категорию
          purpose: category as 'personal' | 'post' | 'event' | 'draft', // Используем выбранную категорию
          tags: [],
          visibility: 'private',
          usageCount: 0,
          relatedContent: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } else if (currentItem.type === 'route') {
        // Добавляем маршрут в избранное с категорией
        favorites.addFavoriteRoute({
          id: currentItem.data.id,
          title: currentItem.data.title,
          distance: currentItem.data.distance || 0,
          duration: currentItem.data.duration || 0,
          rating: currentItem.data.rating || 0,
          likes: currentItem.data.likes || 0,
          isOriginal: true,
          points: currentItem.data.points || [],
          categories: {
            personal: true,
            post: category === 'post',
            event: category === 'event'
          },
          category: category, // Используем выбранную категорию
          purpose: category as 'personal' | 'post' | 'event' | 'shared' | 'draft', // Используем выбранную категорию
          tags: [],
          description: currentItem.data.description,
          visibility: 'private',
          isTemplate: false,
          usageCount: 0,
          relatedContent: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  };

  return {
    isModalOpen,
    currentItem,
    openModal,
    closeModal,
    handleConfirm
  };
};
