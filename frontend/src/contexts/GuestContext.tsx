import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MarkerData } from '../types/marker';
import { RouteData } from '../types/route';
import { EventData } from '../types/event';
// Blog type removed during cleanup

interface GuestData {
  markers: MarkerData[];
  routes: RouteData[];
  events: EventData[];
  sessionId: string;
  createdAt: string;
}

interface GuestContextType {
  // Данные гостевой сессии
  guestData: GuestData;
  
  // Методы для работы с данными
  addMarker: (marker: MarkerData) => void;
  updateMarker: (id: string, marker: Partial<MarkerData>) => void;
  removeMarker: (id: string) => void;
  
  addRoute: (route: RouteData) => void;
  updateRoute: (id: string, route: Partial<RouteData>) => void;
  removeRoute: (id: string) => void;
  
  addEvent: (event: EventData) => void;
  updateEvent: (id: string, event: Partial<EventData>) => void;
  removeEvent: (id: string) => void;

  // Управление сессией
  clearGuestData: () => void;
  hasGuestContent: () => boolean;
  getGuestContentCount: () => { markers: number; routes: number; events: number; posts: number; blogs: number };
  
  // Состояние
  isGuestMode: boolean;
  setIsGuestMode: (isGuest: boolean) => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'guest_session_data';

// Генерация уникального ID для сессии
const generateSessionId = (): string => {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Загрузка данных из localStorage
const loadGuestData = (): GuestData => {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        markers: parsed.markers || [],
        routes: parsed.routes || [],
        events: parsed.events || [],
        sessionId: parsed.sessionId || generateSessionId(),
        createdAt: parsed.createdAt || new Date().toISOString()
      };
    }
  } catch (error) {
    console.warn('Ошибка загрузки гостевых данных:', error);
  }
  
  return {
    markers: [],
    routes: [],
    events: [],
    sessionId: generateSessionId(),
    createdAt: new Date().toISOString()
  };
};

// Сохранение данных в localStorage
const saveGuestData = (data: GuestData): void => {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Ошибка сохранения гостевых данных:', error);
  }
};

export const GuestProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [guestData, setGuestData] = useState<GuestData>(loadGuestData());
  const [isGuestMode, setIsGuestMode] = useState<boolean>(true);

  // Сохранение данных при изменении
  useEffect(() => {
    saveGuestData(guestData);
  }, [guestData]);

  // Методы для работы с метками
  const addMarker = (marker: MarkerData) => {
    setGuestData(prev => ({
      ...prev,
      markers: [...prev.markers, { ...marker, id: marker.id || `marker_${Date.now()}` }]
    }));
  };

  const updateMarker = (id: string, marker: Partial<MarkerData>) => {
    setGuestData(prev => ({
      ...prev,
      markers: prev.markers.map(m => m.id === id ? { ...m, ...marker } : m)
    }));
  };

  const removeMarker = (id: string) => {
    setGuestData(prev => ({
      ...prev,
      markers: prev.markers.filter(m => m.id !== id)
    }));
  };

  // Методы для работы с маршрутами
  const addRoute = (route: RouteData) => {
    setGuestData(prev => ({
      ...prev,
      routes: [...prev.routes, { ...route, id: route.id || `route_${Date.now()}` }]
    }));
  };

  const updateRoute = (id: string, route: Partial<RouteData>) => {
    setGuestData(prev => ({
      ...prev,
      routes: prev.routes.map(r => r.id === id ? { ...r, ...route } : r)
    }));
  };

  const removeRoute = (id: string) => {
    setGuestData(prev => ({
      ...prev,
      routes: prev.routes.filter(r => r.id !== id)
    }));
  };

  // Методы для работы с событиями
  const addEvent = (event: EventData) => {
    setGuestData(prev => ({
      ...prev,
      events: [...prev.events, { ...event, id: event.id || `event_${Date.now()}` }]
    }));
  };

  const updateEvent = (id: string, event: Partial<EventData>) => {
    setGuestData(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === id ? { ...e, ...event } : e)
    }));
  };

  const removeEvent = (id: string) => {
    setGuestData(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== id)
    }));
  };

  // Posts and Blogs removed — no-op placeholders removed.

  // Очистка гостевых данных
  const clearGuestData = () => {
    setGuestData({
      markers: [],
      routes: [],
      events: [],
      sessionId: generateSessionId(),
      createdAt: new Date().toISOString()
    });
    localStorage.removeItem(GUEST_STORAGE_KEY);
  };

  // Проверка наличия гостевого контента
  const hasGuestContent = (): boolean => {
    return guestData.markers.length > 0 || 
           guestData.routes.length > 0 || 
           guestData.events.length > 0;
  };

  // Получение количества гостевого контента
  const getGuestContentCount = () => {
    return {
      markers: guestData.markers.length,
      routes: guestData.routes.length,
      events: guestData.events.length,
      posts: 0,
      blogs: 0
    };
  };

  const value: GuestContextType = {
    guestData,
    addMarker,
    updateMarker,
    removeMarker,
    addRoute,
    updateRoute,
    removeRoute,
    addEvent,
    updateEvent,
    removeEvent,
    clearGuestData,
    hasGuestContent,
    getGuestContentCount,
    isGuestMode,
    setIsGuestMode
  };

  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = (): GuestContextType => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};
