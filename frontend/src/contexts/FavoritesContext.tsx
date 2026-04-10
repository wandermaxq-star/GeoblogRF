import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  // Hydration flag. true when initial load from storage has completed.
  isHydrated: boolean;

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

  // Глобально выбранные ID маршрутов в избранном (чекбоксы)
  selectedRouteIds: string[];
  setSelectedRouteIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Глобально выбранные ID событий в избранном (чекбоксы)
  selectedEventIds: string[];
  setSelectedEventIds: React.Dispatch<React.SetStateAction<string[]>>;

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

  // флаг, который становится true когда первоначальная загрузка из IndexedDB
  // завершена. Без него перваяuseEffect ниже будет записывать пустой массив в
  // базу, что стирает настоящие данные до их чтения.
  const [isHydrated, setIsHydrated] = useState(false);

  // Миграция: при монтировании переносим данные из localStorage в IndexedDB и загружаем
  useEffect(() => {
    (async () => {
      try {
        await storageService.migrateFromLocalStorage();
        const items = await storageService.getFavorites();
        if (items && items.length) {
          // Нормализуем items: добавляем type если его нет, основываясь на структуре
          const normalized = items.map((i: any) => {
            if (!i.type) {
              // Угадываем тип по структуре
              if (i.points && Array.isArray(i.points)) i.type = 'route';
              else if (i.date || i.time) i.type = 'event';
              else i.type = 'place';
            }
            return i;
          });
          
          const routes = normalized.filter((i: any) => i.type === 'route');
          const events = normalized.filter((i: any) => i.type === 'event');
          const places = normalized.filter((i: any) => i.type !== 'route' && i.type !== 'event');
          const normalizePurpose = (value: any): FavoriteEvent['purpose'] => (value === 'post' || value === 'event' || value === 'draft') ? value : 'personal';
          setFavoriteRoutes(routes.map((r: any) => ({ ...r, addedAt: r.addedAt ? new Date(r.addedAt) : new Date() })));
          setFavoriteEvents(events.map((e: any) => ({ ...e, purpose: normalizePurpose(e.purpose), addedAt: e.addedAt ? new Date(e.addedAt) : new Date() })));
          setFavoritePlaces(places.map((p: any) => ({ ...p, coordinates: p.coordinates || [], addedAt: p.addedAt ? new Date(p.addedAt) : new Date() }))); 
        }
      } catch (e) {
        // ignore
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // Сохраняем все избранные в IndexedDB при изменении (только после гидратации)
  useEffect(() => {
    if (!isHydrated) return;
    (async () => {
      try {
        const combined = [
          ...favoritePlaces.map((p: any) => ({ ...p, type: 'place' })),
          ...favoriteRoutes.map((r: any) => ({ ...r, type: 'route' })),
          ...favoriteEvents.map((e: any) => ({ ...e, type: 'event' }))
        ];
        await storageService.setFavorites(combined as any[]);
      } catch (e) {
        // noop
      }
    })();
  }, [favoritePlaces, favoriteRoutes, favoriteEvents, isHydrated]);

  // Глобальное состояние выбранных чекбоксов избранных меток (не сохраняем между сессиями)
  const [selectedMarkerIds, _setSelectedMarkerIds] = useState<string[]>([]);

  const setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>> = (next) => {
    _setSelectedMarkerIds(prev => {
      const resolved = typeof next === 'function' ? (next as (p: string[]) => string[])(prev) : next;
      const safeArray = Array.isArray(resolved) ? resolved : [];
      const deduped = Array.from(new Set(safeArray));
      // Возвращаем prev если содержимое не изменилось — предотвращает лишние ре-рендеры
      if (deduped.length === prev.length && deduped.every((id, i) => id === prev[i])) return prev;
      return deduped;
    });
  };

  // Глобальное состояние выбранных чекбоксов избранных маршрутов
  const [selectedRouteIds, _setSelectedRouteIds] = useState<string[]>([]);

  const setSelectedRouteIds: React.Dispatch<React.SetStateAction<string[]>> = (next) => {
    _setSelectedRouteIds(prev => {
      const resolved = typeof next === 'function' ? (next as (p: string[]) => string[])(prev) : next;
      const safeArray = Array.isArray(resolved) ? resolved : [];
      const deduped = Array.from(new Set(safeArray));
      // Возвращаем prev если содержимое не изменилось
      if (deduped.length === prev.length && deduped.every((id, i) => id === prev[i])) return prev;
      return deduped;
    });
  };

  const [selectedEventIds, _setSelectedEventIds] = useState<string[]>([]);

  const setSelectedEventIds: React.Dispatch<React.SetStateAction<string[]>> = (next) => {
    _setSelectedEventIds(prev => {
      const resolved = typeof next === 'function' ? (next as (p: string[]) => string[])(prev) : next;
      const safeArray = Array.isArray(resolved) ? resolved : [];
      const deduped = Array.from(new Set(safeArray));
      if (deduped.length === prev.length && deduped.every((id, i) => id === prev[i])) return prev;
      return deduped;
    });
  };

  // Глобальное состояние открытости панели избранного
  const [favoritesOpen, _setFavoritesOpen] = useState<boolean>(false);

  const setFavoritesOpen: React.Dispatch<React.SetStateAction<boolean>> = (next) => {
    _setFavoritesOpen(prev => (typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next));
  };

  // Совместимый API для Map.tsx и FavoritesPanel
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
      type: 'route', // ← КРИТИЧНО: ДОБАВЛЕН type для фильтрации при загрузке
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
    const coordinates = (() => {
      if (Array.isArray(place.coordinates) && place.coordinates.length >= 2) {
        return [Number(place.coordinates[0]), Number(place.coordinates[1])];
      }
      if (typeof place.coordinates === 'string') {
        const parts = (place.coordinates as string).split(',').map((s: string) => Number(s.trim()));
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          return [parts[0], parts[1]];
        }
      }
      if (place.latitude != null && place.longitude != null) {
        return [Number(place.latitude), Number(place.longitude)];
      }
      return [null, null];
    })();

    const newPlace: FavoritePlace & { type: string } = {
      ...place,
      coordinates,
      latitude: coordinates[0] ?? place.latitude,
      longitude: coordinates[1] ?? place.longitude,
      type: 'place', // ← КРИТИЧНО: ДОБАВЛЕН type для фильтрации при загрузке
      addedAt: new Date()
    } as any;

    setFavoritePlaces(prev => {
      const next = [...prev, newPlace as FavoritePlace];
      storageService.setFavorites([
        ...next.map(p => ({ ...p, type: 'place' })),
        ...favoriteRoutes.map(r => ({ ...r, type: 'route' })),
        ...favoriteEvents.map(e => ({ ...e, type: 'event' }))
      ]).catch(() => {});
      return next;
    });
  };

  const removeFavoritePlace = (id: string) => {
    setFavoritePlaces(prev => {
      const next = prev.filter(place => place.id !== id);
      storageService.setFavorites([
        ...next.map(p => ({ ...p, type: 'place' })),
        ...favoriteRoutes.map(r => ({ ...r, type: 'route' })),
        ...favoriteEvents.map(e => ({ ...e, type: 'event' }))
      ]).catch(() => {});
      return next;
    });
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
    const newEvent: FavoriteEvent & { type: string } = {
      ...event,
      type: 'event', // ← КРИТИЧНО: ДОБАВЛЕН type для фильтрации при загрузке
      addedAt: new Date()
    } as any;
    setFavoriteEvents(prev => [...prev, newEvent as FavoriteEvent]);
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

  // Мемоизируем favorites чтобы не создавать новый массив на каждый ре-рендер провайдера
  // Без этого filteredMarkers в Map.tsx пересчитывался при каждом ре-рендере FavoritesProvider
  const memoizedFavorites = useMemo(() => favoritePlaces.map(place => {
    // some favorite items may store coordinates as [lat, lon], others as separate fields
    const coordsFromArray = Array.isArray(place.coordinates) && place.coordinates.length >= 2
      ? [Number(place.coordinates[0]), Number(place.coordinates[1])]
      : [undefined, undefined];

    const coordsFromString = typeof place.coordinates === 'string'
      ? (place.coordinates as string).split(',').map((s: string) => Number(s.trim()))
      : [undefined, undefined];

    const lat = Number(
      place.latitude ??
      coordsFromArray[0] ??
      coordsFromString[0]
    );
    const lon = Number(
      place.longitude ??
      coordsFromArray[1] ??
      coordsFromString[1]
    );

    return {
      id: place.id,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
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
    } as MarkerData;
  }), [favoritePlaces]);

  const contextValue = useMemo(() => ({
    isHydrated,
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
    // memoizedFavorites стабилен — меняется только при изменении favoritePlaces
    favorites: memoizedFavorites,
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
      
      setFavoritePlaces(prev => {
          const next = [...prev, newPlace];
          storageService.setFavorites([
            ...next.map(p => ({ ...p, type: 'place' })),
            ...favoriteRoutes.map(r => ({ ...r, type: 'route' })),
            ...favoriteEvents.map(e => ({ ...e, type: 'event' }))
          ]).catch(() => {});
          return next;
        });
    },
    // Глобальное состояние выбранных чекбоксов
    selectedMarkerIds,
    setSelectedMarkerIds,
    // Глобальное состояние выбранных маршрутов
    selectedRouteIds,
    setSelectedRouteIds,
    // Глобальное состояние выбранных событий
    selectedEventIds,
    setSelectedEventIds,
    // Открытость панели избранного
    favoritesOpen,
    setFavoritesOpen,
  }), [
    isHydrated,
    favoriteRoutes,
    favoritePlaces,
    favoriteEvents,
    memoizedFavorites,
    selectedMarkerIds,
    selectedRouteIds,
    selectedEventIds,
    favoritesOpen,
  ]);

  return (
    <FavoritesContext.Provider
      value={contextValue}
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
      _isStub: true,
      isHydrated: false,
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
      selectedRouteIds: [],
      setSelectedRouteIds: () => {},
      selectedEventIds: [],
      setSelectedEventIds: () => {},
      favoritesOpen: false,
      setFavoritesOpen: () => {},
    };
  }
  return context;
};
