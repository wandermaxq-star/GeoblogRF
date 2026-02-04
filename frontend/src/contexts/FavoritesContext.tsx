import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { MarkerData } from '../types/marker';

// Типы для избранного
export interface FavoriteRoute {
  id: string;
  title: string;
  distance: number;
  duration: number;
  rating: number;
  addedAt: Date;
  likes: number;
  isOriginal: boolean; // Родительский маршрут или форк
  parentRouteId?: string; // Для форков
  points?: any[]; // Точки маршрута
  waypoints?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    name?: string;
    description?: string;
    order: number;
  }>;
  created_at: string;
  updated_at: string;
  
  // НОВОЕ: Категории вместо purpose
  categories: {
    personal: boolean;  // Всегда true (избранное)
    post: boolean;     // [ ] Посты
    event: boolean;    // [ ] События
  };
  
  // СТАРОЕ: оставляем для совместимости, но помечаем как deprecated
  /** @deprecated Используйте categories вместо purpose */
  purpose?: 'personal' | 'post' | 'event' | 'shared' | 'draft';
  category?: string; // Оставляем для совместимости
  
  tags: string[]; // Теги для поиска и фильтрации
  description?: string; // Описание маршрута
  visibility: 'private' | 'public' | 'friends'; // Видимость маршрута
  isTemplate?: boolean; // Шаблон для копирования
  lastUsed?: Date; // Последнее использование
  usageCount: number; // Количество использований
  relatedContent?: {
    blogs?: string[]; // ID связанных блогов
    events?: string[]; // ID связанных событий
    posts?: string[]; // ID связанных постов
  };
}

export interface FavoritePlace {
  id: string;
  name: string;
  location: string;
  type: string; // Достопримечательность, ресторан, отель и т.д.
  rating: number;
  addedAt: Date;
  coordinates: [number, number];
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  
  // НОВОЕ: Категории вместо purpose
  categories: {
    personal: boolean;  // Всегда true (избранное)
    post: boolean;     // [ ] Посты
    event: boolean;    // [ ] События
  };
  
  // СТАРОЕ: оставляем для совместимости, но помечаем как deprecated
  /** @deprecated Используйте categories вместо purpose */
  purpose?: 'personal' | 'post' | 'event' | 'draft';
  
  tags: string[]; // Теги для поиска и фильтрации
  description?: string; // Описание места
  visibility: 'private' | 'public' | 'friends'; // Видимость места
  lastUsed?: Date; // Последнее использование
  usageCount: number; // Количество использований
  relatedContent?: {
    blogs?: string[]; // ID связанных блогов
    events?: string[]; // ID связанных событий
    posts?: string[]; // ID связанных постов
  };
}

export interface FavoriteEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location: string;
  latitude: number;
  longitude: number;
  participants?: string;
  addedAt: Date;
  category: string; // Праздник, фестиваль, выставка и т.д.
  created_at: string;
  updated_at: string;
  
  // Новые поля для категоризации
  purpose: 'personal' | 'post' | 'event' | 'draft';
  tags: string[]; // Теги для поиска и фильтрации
  visibility: 'private' | 'public' | 'friends'; // Видимость события
  lastUsed?: Date; // Последнее использование
  usageCount: number; // Количество использований
  relatedContent?: {
    blogs?: string[]; // ID связанных блогов
    events?: string[]; // ID связанных событий
    posts?: string[]; // ID связанных постов
  };
}

// FavoriteBlog removed during cleanup

interface FavoritesContextType {
  // Маршруты
  favoriteRoutes: FavoriteRoute[];
  addFavoriteRoute: (route: Omit<FavoriteRoute, 'addedAt'>) => void;
  removeFavoriteRoute: (id: string) => void;
  updateFavoriteRoute: (id: string, updates: Partial<FavoriteRoute>) => void;
  isRouteFavorite: (id: string) => boolean;
  clearAllRoutes: () => void;
  
  // Места
  favoritePlaces: FavoritePlace[];
  addFavoritePlace: (place: Omit<FavoritePlace, 'addedAt'>) => void;
  addToFavorites: (marker: any, category?: string) => void;
  removeFavoritePlace: (id: string) => void;
  updateFavoritePlace: (id: string, updates: Partial<FavoritePlace>) => void;
  isPlaceFavorite: (id: string) => boolean;
  
  // События
  favoriteEvents: FavoriteEvent[];
  addFavoriteEvent: (event: Omit<FavoriteEvent, 'addedAt'>) => void;
  removeFavoriteEvent: (id: string) => void;
  isEventFavorite: (id: string) => boolean;
  
  // Блоги
  // Removed: blog favorites removed during cleanup
  
  // Статистика
  getFavoritesStats: () => {
    totalRoutes: number;
    totalPlaces: number;
    totalEvents: number;
    totalItems: number;
  };

  // Совместимый API для Map.tsx и FavoritesPanel
  favorites: any[];
  setFavorites: React.Dispatch<React.SetStateAction<any[]>>;
  clearDuplicates: () => void;

  // Глобально выбранные ID меток в избранном (чекбоксы)
  selectedMarkerIds: string[];
  setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Открытость панели избранного (единое состояние для map/planner)
  favoritesOpen: boolean;
  setFavoritesOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Инициализируем пустыми — загрузим асинхронно из IndexedDB при монтировании
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);

  // Миграция: при монтировании переносим данные из localStorage в IndexedDB и загружаем
  useEffect(() => {
    (async () => {
      try {
        await storageService.migrateFromLocalStorage();
        const items = await storageService.getFavorites();
        if (items && items.length) {
          const routes = items.filter((i: any) => i.type === 'route');
          const events = items.filter((i: any) => i.type === 'event');
          const places = items.filter((i: any) => i.type !== 'route' && i.type !== 'event');
          const normalizePurpose = (value: any): FavoriteEvent['purpose'] => (value === 'post' || value === 'event' || value === 'draft') ? value : 'personal';
          setFavoriteRoutes(routes.map((r: any) => ({ ...r, addedAt: r.addedAt ? new Date(r.addedAt) : new Date() })));
          setFavoriteEvents(events.map((e: any) => ({ ...e, purpose: normalizePurpose(e.purpose), addedAt: e.addedAt ? new Date(e.addedAt) : new Date() })));
          setFavoritePlaces(places.map((p: any) => ({ ...p, coordinates: p.coordinates || [], addedAt: p.addedAt ? new Date(p.addedAt) : new Date() }))); 
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Сохраняем все избранные в IndexedDB при изменении
  useEffect(() => {
    (async () => {
      try {
        const combined = [
          ...favoritePlaces,
          ...favoriteRoutes,
          ...favoriteEvents
        ];
        await storageService.setFavorites(combined as any[]);
      } catch (e) {
        // noop
      }
    })();
  }, [favoritePlaces, favoriteRoutes, favoriteEvents]);

  // Глобальное состояние выбранных чекбоксов избранных меток (не сохраняем между сессиями)
  const [selectedMarkerIds, _setSelectedMarkerIds] = useState<string[]>([]);

  const setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>> = (next) => {
    _setSelectedMarkerIds(prev => {
      const resolved = typeof next === 'function' ? (next as (p: string[]) => string[])(prev) : next;
      const safeArray = Array.isArray(resolved) ? resolved : [];
      return Array.from(new Set(safeArray));
    });
  };

  // Глобальное состояние открытости панели избранного
  const [favoritesOpen, _setFavoritesOpen] = useState<boolean>(false);

  const setFavoritesOpen: React.Dispatch<React.SetStateAction<boolean>> = (next) => {
    _setFavoritesOpen(prev => (typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next));
  };

  // Совместимый API для Map.tsx и FavoritesPanel
  const setFavorites = useState<any[]>(() => 
    favoritePlaces.map(place => ({
      id: place.id,
      title: place.name,
      latitude: place.coordinates[0],
      longitude: place.coordinates[1],
      category: place.type,
      address: place.location
    }))
  )[1];

  // Обновляем favorites при изменении favoritePlaces
  useEffect(() => {
    setFavorites(
      favoritePlaces.map(place => ({
        id: place.id,
        title: place.name,
        latitude: place.coordinates[0],
        longitude: place.coordinates[1],
        category: place.type,
        address: place.location
      }))
    );
  }, [favoritePlaces]);

  // (сохранение маршрутов/прочих реализовано в общем эффекте выше)

  // Делаем функцию исправления координат доступной глобально
  useEffect(() => {
    (window as any).fixVladimirCoordinates = () => {
      setFavoritePlaces(prev => prev.map(place => {
        if (place.name === "Ледовый комплекс \"Владимир\"" || place.name.includes("Владимир")) {
          return {
            ...place,
            coordinates: [56.1286, 40.4066], // Правильные координаты Владимира
            latitude: 56.1286,
            longitude: 40.4066
          };
        }
        return place;
      }));
    };
  }, []);

  // Persist handled centrally via storageService (see effect above)

  // Функции для маршрутов
  const addFavoriteRoute = (route: Omit<FavoriteRoute, 'addedAt'>) => {
    // Сохраняем переданные категории, иначе выводим из tags/purpose
    const incoming: any = route as any;
    const tags: string[] = Array.isArray(incoming.tags) ? incoming.tags : [];
    const inferredPurpose = incoming.purpose
      || incoming.category
      || (tags.includes('post') ? 'post'
          : tags.includes('event') ? 'event'
          : 'personal');
    const categories = incoming.categories || {
      personal: true,
      post: inferredPurpose === 'post' || tags.includes('post'),
      event: inferredPurpose === 'event' || tags.includes('event')
    };
    const safePoints = Array.isArray(incoming.points) ? incoming.points : [];
    const newRoute: FavoriteRoute = {
      ...(incoming as any),
      categories,
      purpose: inferredPurpose,
      category: incoming.category || inferredPurpose,
      points: safePoints,
      addedAt: new Date()
    };
    setFavoriteRoutes(prev => [...prev, newRoute]);
  };

  const removeFavoriteRoute = (id: string) => {
    setFavoriteRoutes(prev => prev.filter(route => route.id !== id));
  };

  const updateFavoriteRoute = (id: string, updates: Partial<FavoriteRoute>) => {
    setFavoriteRoutes(prev => prev.map(route => 
      route.id === id ? { ...route, ...updates } : route
    ));
  };

  const isRouteFavorite = (id: string) => {
    return favoriteRoutes.some(route => route.id === id);
  };

  const clearAllRoutes = () => {
    setFavoriteRoutes([]);
    localStorage.removeItem('favorites-routes');
  };

  // Функции для мест
  const addFavoritePlace = (place: Omit<FavoritePlace, 'addedAt'>) => {
    const newPlace: FavoritePlace = {
      ...place,
      addedAt: new Date()
    };
    setFavoritePlaces(prev => [...prev, newPlace]);
  };

  const removeFavoritePlace = (id: string) => {
    setFavoritePlaces(prev => prev.filter(place => place.id !== id));
  };

  const updateFavoritePlace = (id: string, updates: Partial<FavoritePlace>) => {
    setFavoritePlaces(prev => prev.map(place => 
      place.id === id ? { ...place, ...updates } : place
    ));
  };

  const isPlaceFavorite = (id: string) => {
    return favoritePlaces.some(place => place.id === id);
  };

  // Функции для событий
  const addFavoriteEvent = (event: Omit<FavoriteEvent, 'addedAt'>) => {
    const newEvent: FavoriteEvent = {
      ...event,
      addedAt: new Date()
    };
    setFavoriteEvents(prev => [...prev, newEvent]);
  };

  const removeFavoriteEvent = (id: string) => {
    setFavoriteEvents(prev => prev.filter(event => event.id !== id));
  };

  const isEventFavorite = (id: string) => {
    return favoriteEvents.some(event => event.id === id);
  };

  // Blog favorites removed — functions are no-ops
  const addFavoriteBlog = (_blog: any) => { /* no-op */ };
  const removeFavoriteBlog = (_id: string) => { /* no-op */ };
  const isBlogFavorite = (_id: string) => false;

  // Статистика
  const getFavoritesStats = () => {
    return {
      totalRoutes: favoriteRoutes.length,
      totalPlaces: favoritePlaces.length,
      totalEvents: favoriteEvents.length,
      totalItems: favoriteRoutes.length + favoritePlaces.length + favoriteEvents.length
    };
  };



  return (
    <FavoritesContext.Provider
      value={{
        favoriteRoutes,
        addFavoriteRoute,
        removeFavoriteRoute,
        updateFavoriteRoute,
        isRouteFavorite,
        clearAllRoutes,
        favoritePlaces,
        addFavoritePlace,
        removeFavoritePlace,
        updateFavoritePlace,
        isPlaceFavorite,
        favoriteEvents,
        addFavoriteEvent,
        removeFavoriteEvent,
        isEventFavorite,
        getFavoritesStats,
        // Совместимый API для Map.tsx и FavoritesPanel
        favorites: favoritePlaces.map(place => ({
          id: place.id,
          latitude: place.coordinates[0],
          longitude: place.coordinates[1],
          title: place.name,
          description: place.description || '',
          address: place.location || '',
          category: place.type || 'other',
          subcategory: '',
          rating: place.rating || 0,
          rating_count: 0,
          photo_urls: [],
          hashtags: [],
          author_name: place.name || '',
          created_at: (place.created_at as string) || new Date().toISOString(),
          updated_at: (place.updated_at as string) || new Date().toISOString(),
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          visibility: 'private',
          marker_type: 'standard'
        } as MarkerData)),
        setFavorites: (newFavorites: MarkerData[] | ((prev: MarkerData[]) => MarkerData[])) => {
          // Если это функция (как в setState), вызываем её с текущим состоянием
          if (typeof newFavorites === 'function') {
            setFavoritePlaces(prev => {
              const prevAsMarkers: MarkerData[] = prev.map(place => ({
                id: place.id,
                latitude: place.coordinates[0],
                longitude: place.coordinates[1],
                title: place.name,
                description: place.description || '',
                address: place.location || '',
                category: place.type || 'other',
                subcategory: '',
                rating: place.rating || 0,
                rating_count: 0,
                photo_urls: [],
                hashtags: [],
                author_name: place.name || '',
                created_at: (place.created_at as string) || new Date().toISOString(),
                updated_at: (place.updated_at as string) || new Date().toISOString(),
                likes_count: 0,
                comments_count: 0,
                shares_count: 0,
                visibility: 'private',
                marker_type: 'standard'
              }));

              const updatedFavorites = newFavorites(prevAsMarkers);

              // Преобразуем обратно в FavoritePlace
              const newPlaces: FavoritePlace[] = updatedFavorites.map((marker: MarkerData) => ({
                id: marker.id,
                name: marker.title || marker.author_name || 'Без названия',
                location: marker.address || marker.description || '',
                type: marker.category || 'other',
                rating: marker.rating || 0,
                addedAt: new Date(),
                coordinates: [marker.latitude, marker.longitude],
                latitude: marker.latitude,
                longitude: marker.longitude,
                created_at: marker.created_at || new Date().toISOString(),
                updated_at: marker.updated_at || new Date().toISOString(),
                categories: {
                  personal: true,
                  post: false,
                  event: false
                },
                purpose: 'personal',
                tags: marker.hashtags || [],
                description: marker.description || '',
                visibility: marker.visibility as any || 'private',
                usageCount: 0,
                relatedContent: {}
              }));

              return newPlaces;
            });
          } else if (Array.isArray(newFavorites)) {
            // Если это массив, заменяем полностью
            const newPlaces: FavoritePlace[] = newFavorites.map((marker: MarkerData) => ({
              id: marker.id,
              name: marker.title || marker.author_name || 'Без названия',
              location: marker.address || marker.description || '',
              type: marker.category || 'other',
              rating: marker.rating || 0,
              addedAt: new Date(),
              coordinates: [marker.latitude, marker.longitude],
              latitude: marker.latitude,
              longitude: marker.longitude,
              created_at: marker.created_at || new Date().toISOString(),
              updated_at: marker.updated_at || new Date().toISOString(),
              categories: {
                personal: true,
                post: false,
                event: false
              },
              purpose: 'personal', // Оставляем для совместимости
              tags: marker.hashtags || [],
              description: marker.description || '',
              visibility: marker.visibility as any || 'private',
              usageCount: 0,
              relatedContent: {}
            }));
            setFavoritePlaces(newPlaces);
          }
        },
        clearDuplicates: () => {
          // Удаляем дубликаты по ID
          setFavoritePlaces(prev => {
            
            const seen = new Set();
            return prev.filter(place => {
              if (seen.has(place.id)) {
                return false;
              }
              seen.add(place.id);
              return true;
            });
          });
        },
        addToFavorites: (marker: MarkerData, category: string = 'personal') => {
          // Проверяем, что метка не уже в избранном
          const isAlreadyFavorite = favoritePlaces.some(place => place.id === marker.id);
          if (isAlreadyFavorite) {
            return;
          }
          
          // Создаем новое место из метки
          const normalizedPurpose = (category === 'post' || category === 'event' || category === 'draft') ? category : 'personal';
          const newPlace: FavoritePlace = {
            id: marker.id,
            name: marker.title || marker.author_name || 'Без названия',
            location: marker.address || marker.description || '',
            type: marker.category || 'other',
            rating: marker.rating || 0,
            addedAt: new Date(),
            coordinates: [marker.latitude, marker.longitude],
            latitude: marker.latitude,
            longitude: marker.longitude,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // Новые поля для категоризации
            categories: {
              personal: true,
              post: normalizedPurpose === 'post',
              event: normalizedPurpose === 'event'
            },
            purpose: normalizedPurpose, // Оставляем для совместимости
            tags: [],
            description: marker.description || '',
            visibility: 'private',
            usageCount: 0,
            relatedContent: {}
          };
          
          setFavoritePlaces(prev => [...prev, newPlace]);
        },
        // Глобальное состояние выбранных чекбоксов
        selectedMarkerIds,
        setSelectedMarkerIds,
        // Открытость панели избранного
        favoritesOpen,
        setFavoritesOpen,
      } as any}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    // Возвращаем заглушку вместо undefined для предотвращения блокировки рендеринга
    return {
      favoriteRoutes: [],
      favoritePlaces: [],
      favoriteEvents: [],
      addFavoriteRoute: () => {},
      removeFavoriteRoute: () => {},
      updateFavoriteRoute: () => {},
      isRouteFavorite: () => false,
      clearAllRoutes: () => {},
      addFavoritePlace: () => {},
      removeFavoritePlace: () => {},
      updateFavoritePlace: () => {},
      isPlaceFavorite: () => false,
      addFavoriteEvent: () => {},
      removeFavoriteEvent: () => {},
      isEventFavorite: () => false,
      getFavoritesStats: () => ({ 
        routes: 0, 
        places: 0, 
        events: 0, 
        totalItems: 0,
        totalRoutes: 0,
        totalPlaces: 0,
        totalEvents: 0
      }),
      clearDuplicates: () => {},
      addToFavorites: () => {},
      favorites: [],
      setFavorites: () => {},
      selectedMarkerIds: [],
      setSelectedMarkerIds: () => {},
      favoritesOpen: false,
      setFavoritesOpen: () => {},
    };
  }
  return context;
};
