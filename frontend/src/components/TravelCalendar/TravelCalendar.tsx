import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Settings, HelpCircle, Plane, Bed, Camera, Utensils, Bus, Music, Trophy, Image, Megaphone, Flag } from 'lucide-react';
import { mockEvents, MockEvent } from './mockEvents';
import { ExternalEvent } from '../../services/externalEventsService';
import { getEvents, EventApiItem } from '../../services/eventService';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useEventsStore } from '../../stores/eventsStore';
import { useRegionsStore, getRegionIdByName } from '../../stores/regionsStore';
import { offlineContentStorage, OfflineEventDraft } from '../../services/offlineContentStorage';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/use-mobile';
import './TravelCalendar.css';
import './CircularCalendar.css';
import CircularCalendar from './CircularCalendar';

// Lazy компоненты
const LazyEventsListModal = lazy(() => import('../Events/EventsListModal').then(module => ({ default: module.EventsListModal })));
const LazyEventDetailPage = lazy(() => import('../Events/EventDetailPage').then(module => ({ default: module.EventDetailPage })));

export const categories = [
  { id: 'festival', name: 'Фестиваль', color: '#d946ef', icon: Megaphone },
  { id: 'concert', name: 'Концерт', color: '#6366f1', icon: Music },
  { id: 'exhibition', name: 'Выставка', color: '#a855f7', icon: Image },
  { id: 'sport', name: 'Спорт', color: '#84cc16', icon: Trophy },
  { id: 'holiday', name: 'Праздник', color: '#ec4899', icon: Flag },
  { id: 'attractions', name: 'Достопримечательности', color: '#0ea5e9', icon: Camera },
  { id: 'restaurants', name: 'Рестораны', color: '#10b981', icon: Utensils },
  { id: 'transport', name: 'Транспорт', color: '#8b5cf6', icon: Bus },
  { id: 'hotels', name: 'Отели', color: '#f97316', icon: Bed },
  { id: 'flights', name: 'Авиабилеты', color: '#ef4444', icon: Plane },
];

function formatDateKey(dateIso: string) {
  return dateIso.split('T')[0];
}

// Маппинг категорий из API на categoryId календаря
const categoryMapping: { [key: string]: string } = {
  'Фестиваль': 'festival',
  'Концерт': 'concert',
  'Выставка': 'exhibition',
  'Спортивное событие': 'sport',
  'Спорт': 'sport',
  // Обратная совместимость с английскими названиями
  'festival': 'festival',
  'concert': 'concert',
  'exhibition': 'exhibition',
  'sport': 'sport',
};

function pickCategoryId(apiItem: EventApiItem): string {
  const raw = (apiItem.category || apiItem.event_type || '').trim();
  if (!raw) return 'festival';
  if (categoryMapping[raw]) return categoryMapping[raw];
  const exists = categories.some(c => c.id === raw);
  return exists ? raw : 'festival';
}

export function getCategoryById(categoryId: string) {
  return categories.find(cat => cat.id === categoryId);
}

interface TravelCalendarProps {
  selectedEventId?: string;
  selectedDate?: Date | null;
  onSelectedDateChange?: (date: Date | null) => void;
  onAddEventClick?: () => void;
  onSearchClick?: () => void;
  onLegendClick?: () => void;
}

const TravelCalendar: React.FC<TravelCalendarProps> = ({ 
  selectedEventId, 
  selectedDate: externalSelectedDate,
  onSelectedDateChange,
  onAddEventClick,
  onSearchClick,
  onLegendClick
}) => {
  const { selectedRegions } = useRegionsStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | null>(null);
  
  // Используем внешний selectedDate если передан, иначе внутренний
  const selectedDate = externalSelectedDate !== undefined ? externalSelectedDate : internalSelectedDate;
  const setSelectedDate = (date: Date | null) => {
    if (onSelectedDateChange) {
      onSelectedDateChange(date);
    } else {
      setInternalSelectedDate(date);
    }
  };

  const [showEventsModal, setShowEventsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MockEvent | null>(null);
  const [realEvents, setRealEvents] = useState<MockEvent[]>([]);
  const [pendingEventDrafts, setPendingEventDrafts] = useState<MockEvent[]>([]);
  const [archiveEvents, setArchiveEvents] = useState<MockEvent[]>([]);
  
  // Загружаем черновики событий для временного отображения
  useEffect(() => {
    if (!user?.id) return;

    const loadPendingEvents = async () => {
      try {
        await offlineContentStorage.init();
        const drafts = await offlineContentStorage.getAllDrafts('event');
        
        const eventDrafts: MockEvent[] = drafts
          .filter((draft): draft is OfflineEventDraft => draft.contentType === 'event' && draft.status !== 'failed_permanent')
          .map((draft) => {
            const { contentData, id, createdAt } = draft;
            
            const startDate = new Date(contentData.start_datetime || createdAt);
            const endDate = contentData.end_datetime ? new Date(contentData.end_datetime) : undefined;
            
            const formatDate = (date: Date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            };

            return {
              id: `draft_${id}` as any,
              title: contentData.title || 'Новое событие',
              description: contentData.description || '',
              date: formatDate(startDate),
              endDate: endDate ? formatDate(endDate) : undefined,
              categoryId: contentData.category || 'festival',
              hashtags: contentData.hashtags || [],
              location: contentData.location || '',
              latitude: contentData.latitude || 0,
              longitude: contentData.longitude || 0,
              isPending: true,
              status: 'pending',
              metadata: { draftId: id, draftStatus: draft.status }
            } as MockEvent & { isPending?: boolean; status?: string; metadata?: any };
          });

        setPendingEventDrafts(eventDrafts);
      } catch (error) {
        console.error('Ошибка загрузки черновиков событий:', error);
      }
    };

    loadPendingEvents();
    const interval = setInterval(loadPendingEvents, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);
  
  // Фильтрация событий по выбранным регионам
  const filteredEvents = useMemo(() => {
    const allEvents = [...realEvents, ...pendingEventDrafts];
    
    if (selectedRegions.length === 0) {
      return allEvents;
    }
    
    return allEvents.filter(event => {
      if (event.location) {
        const eventRegionId = getRegionIdByName(event.location);
        if (eventRegionId && selectedRegions.includes(eventRegionId)) {
          return true;
        }
      }
      return false;
    });
  }, [realEvents, pendingEventDrafts, selectedRegions]);
  
  // Если передан selectedEventId, выделяем это событие
  useEffect(() => {
    if (selectedEventId && filteredEvents.length > 0) {
      const eventToSelect = filteredEvents.find((event: MockEvent) => event.id.toString() === selectedEventId);
      if (eventToSelect) {
        setSelectedEvent(eventToSelect);
        setShowEventsModal(true);
      }
    }
  }, [selectedEventId, filteredEvents]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await getEvents();

        const mapped: MockEvent[] = await Promise.all(data.map(async (e: any) => {
          const startDate = formatDateKey(e.start_datetime);
          const endDate = e.end_datetime ? formatDateKey(e.end_datetime) : undefined;
          const categoryId = pickCategoryId(e);

          let latitude = e.latitude;
          let longitude = e.longitude;

          if ((latitude == null || longitude == null) && e.location) {
            try {
              const { geocodeAddress } = await import('../../services/geocodingService');
              const geocoded = await geocodeAddress(e.location);
              if (geocoded && geocoded.latitude && geocoded.longitude) {
                latitude = geocoded.latitude;
                longitude = geocoded.longitude;
              }
            } catch (err) {}
          }

          if (latitude == null || longitude == null) {
            latitude = NaN;
            longitude = NaN;
          }

          return {
            id: Number(e.id) || Math.abs(hashCode(e.id)),
            title: e.title,
            description: e.description || '',
            date: startDate,
            endDate: endDate && endDate !== startDate ? endDate : undefined,
            categoryId: categoryId,
            hashtags: Array.isArray(e.hashtags) ? e.hashtags : [],
            location: e.location || '',
            latitude: latitude,
            longitude: longitude
          };
        }));

        if (isMounted) setRealEvents(mapped);
      } catch (err) {
        if (isMounted) setRealEvents([]);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  function hashCode(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return h;
  }

  const addOpenEvent = useEventsStore((state) => state.addOpenEvent);
  const setSelectedEventInStore = useEventsStore((state) => state.setSelectedEvent);
  const setOpenEvents = useEventsStore((state) => state.setOpenEvents);
  const setFocusEvent = useEventsStore((state) => state.setFocusEvent);

  // Синхронизируем filteredEvents + mockEvents → eventsStore.openEvents для отображения на карте
  useEffect(() => {
    const allEvents = [...filteredEvents, ...mockEvents];
    const validEvents = allEvents.filter(
      ev => !isNaN(ev.latitude) && !isNaN(ev.longitude) && ev.latitude !== 0 && ev.longitude !== 0
    );
    setOpenEvents(validEvents);
  }, [filteredEvents, setOpenEvents]);

  const handleDateClick = (day: number, month: number, year: number) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);

    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const all = [...filteredEvents, ...mockEvents];
    const events = all.filter((event: MockEvent) => {
      if (event.date === dateKey) return true;
      if (event.endDate) {
        const eventStart = new Date(event.date);
        const eventEnd = new Date(event.endDate);
        const checkDate = new Date(dateKey);
        return checkDate >= eventStart && checkDate <= eventEnd;
      }
      return false;
    });

    if (events.length > 0) {
      setArchiveEvents(events);
      setShowEventsModal(true);
      events.forEach(event => addOpenEvent(event));
      if (events.length > 0) {
        setSelectedEventInStore(events[0]);
      }
    }
  };

  const handleExternalEventClick = (event: ExternalEvent) => {
    const mockEvent: MockEvent = {
      id: parseInt(event.id),
      title: event.title,
      description: event.description || '',
      date: event.start_date,
      categoryId: event.category || 'festival',
      hashtags: [],
      location: event.location?.address || '',
      latitude: event.location?.latitude != null ? event.location.latitude : NaN,
      longitude: event.location?.longitude != null ? event.location.longitude : NaN
    };
    setSelectedEvent(mockEvent);
    setShowEventsModal(false);
    setSelectedEventInStore(mockEvent);
    // Фокус карты на событии
    setFocusEvent(mockEvent);
    // На мобильном — переходим на страницу карты
    if (isMobile) {
      navigate('/map');
    }
  };

  const adaptMockEventToExternal = (event: MockEvent): ExternalEvent => ({
    id: event.id.toString(),
    title: event.title,
    description: event.description || '',
    start_date: event.date,
    end_date: event.date,
    location: { address: event.location || '' },
    source: 'local',
    category: event.categoryId,
    url: '',
    image_url: '',
    attendees_count: undefined,
    price: undefined,
    organizer: undefined
  });

  return (
    <div className="h-full w-full flex flex-col travel-calendar-root">
      <div className="flex gap-4 h-full">
        {/* Календарь - растянут на весь размер */}
        <div className="w-full transition-all duration-300 h-full flex flex-col">
          <div className="travel-calendar-container h-full flex flex-col relative">
            <div className="p-4 flex-1 flex flex-col relative z-10">
              {/* Круговой календарь */}
              <div className="w-full h-full">
                <CircularCalendar
                  currentDate={currentDate}
                  onDateChange={(d) => setCurrentDate(d)}
                  onMonthChange={(d) => setCurrentDate(d)}
                  events={[...realEvents, ...pendingEventDrafts, ...mockEvents]}
                  selectedDate={selectedDate}
                  onDateClick={handleDateClick}
                  onSearchClick={onSearchClick}
                  onAddEventClick={onAddEventClick}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно со списком событий */}
        <Suspense fallback={<div className="text-center p-4">Загрузка модального окна...</div>}>
          <LazyEventsListModal
            isOpen={showEventsModal}
            onClose={() => setShowEventsModal(false)}
            events={archiveEvents.map(adaptMockEventToExternal)}
            date={selectedDate ? selectedDate.toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }) : ''}
            onEventClick={handleExternalEventClick}
          />
        </Suspense>

        {/* Детальная страница события */}
        {selectedEvent && (
          <Suspense fallback={<div className="text-center p-4">Загрузка деталей события...</div>}>
            <LazyEventDetailPage
              event={adaptMockEventToExternal(selectedEvent)}
              onClose={() => {
                setShowEventsModal(false);
                setSelectedEvent(null);
              }}
              onBack={() => {
                setShowEventsModal(false);
                setSelectedEvent(null);
                setShowEventsModal(true);
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default TravelCalendar;
