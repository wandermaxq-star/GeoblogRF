import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MockEvent } from '../components/TravelCalendar/mockEvents';

export interface PickedLocation {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  category?: string;
  type?: string;
}

export interface EventsState {
  // Открытые события (из календаря) - отображаются на карте
  openEvents: MockEvent[];
  
  // Выбранное событие (для детального просмотра)
  selectedEvent: MockEvent | null;

  // --- Режим выбора места события на карте ---
  isPickingEventLocation: boolean;
  pickedEventLocation: PickedLocation | null;
  // Маркер места события на карте (живёт пока форма открыта)
  eventLocationMarker: { lat: number; lng: number } | null;

  // Метод: событие, на которое нужно сфокусировать карту
  focusEvent: MockEvent | null;

  // Методы для управления открытыми событиями
  setOpenEvents: (events: MockEvent[]) => void;
  addOpenEvent: (event: MockEvent) => void;
  removeOpenEvent: (eventId: number) => void;
  clearOpenEvents: () => void;
  
  // Методы для управления выбранным событием
  setSelectedEvent: (event: MockEvent | null) => void;
  
  // Picking
  startPickingLocation: () => void;
  stopPickingLocation: () => void;
  setPickedEventLocation: (loc: PickedLocation | null) => void;
  setEventLocationMarker: (coords: { lat: number; lng: number } | null) => void;

  // Focus
  setFocusEvent: (event: MockEvent | null) => void;
  
  // Проверка, открыто ли событие
  isEventOpen: (eventId: number) => boolean;
}

export const useEventsStore = create<EventsState>()(
  subscribeWithSelector((set, get) => ({
    // Начальное состояние
    openEvents: [],
    selectedEvent: null,
    isPickingEventLocation: false,
    pickedEventLocation: null,
    eventLocationMarker: null,
    focusEvent: null,
    
    // Установка всех открытых событий
    setOpenEvents: (events: MockEvent[]) => {
      set({ openEvents: events });
    },
    
    // Добавление события в открытые
    addOpenEvent: (event: MockEvent) => {
      const { openEvents } = get();
      // Проверяем, не добавлено ли уже событие
      if (!openEvents.find(e => e.id === event.id)) {
        set({ openEvents: [...openEvents, event] });
      }
    },
    
    // Удаление события из открытых
    removeOpenEvent: (eventId: number) => {
      const { openEvents, selectedEvent } = get();
      const filtered = openEvents.filter(e => e.id !== eventId);
      set({ openEvents: filtered });
      
      // Если удаляемое событие было выбрано - снимаем выбор
      if (selectedEvent?.id === eventId) {
        set({ selectedEvent: null });
      }
    },
    
    // Очистка всех открытых событий
    clearOpenEvents: () => {
      set({ openEvents: [], selectedEvent: null });
    },
    
    // Установка выбранного события
    setSelectedEvent: (event: MockEvent | null) => {
      set({ selectedEvent: event });
    },

    // Pick-location
    startPickingLocation: () => {
      set({ isPickingEventLocation: true, pickedEventLocation: null });
    },
    stopPickingLocation: () => {
      set({ isPickingEventLocation: false });
    },
    setPickedEventLocation: (loc: PickedLocation | null) => {
      set({ pickedEventLocation: loc, isPickingEventLocation: false });
    },
    setEventLocationMarker: (coords: { lat: number; lng: number } | null) => {
      set({ eventLocationMarker: coords });
    },

    // Focus
    setFocusEvent: (event: MockEvent | null) => {
      set({ focusEvent: event });
    },
    
    // Проверка, открыто ли событие
    isEventOpen: (eventId: number) => {
      return get().openEvents.some(e => e.id === eventId);
    },
  }))
);

