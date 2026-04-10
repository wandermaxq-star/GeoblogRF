/**
 * EventBottomSheet — мобильная "шторка" с календарём событий.
 * Открывается по кнопке "Календарь" в BottomNavigation.
 * Содержит ту же логику, что и EventPanel (десктоп), но в формате bottom sheet.
 */
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockEvents, MockEvent } from '../TravelCalendar/mockEvents';
import { ExternalEvent } from '../../services/externalEventsService';
import { getEvents, EventApiItem } from '../../services/eventService';
import { useEventsStore } from '../../stores/eventsStore';
import { useRegionsStore, getRegionIdByName } from '../../stores/regionsStore';
import { offlineContentStorage, OfflineEventDraft } from '../../services/offlineContentStorage';
import { useAuth } from '../../contexts/AuthContext';
import CircularCalendar from '../TravelCalendar/CircularCalendar';
import '../TravelCalendar/TravelCalendar.css';
import '../TravelCalendar/CircularCalendar.css';

const LazyEventsListModal = lazy(() => import('./EventsListModal').then(m => ({ default: m.EventsListModal })));
const LazyEventDetailPage = lazy(() => import('./EventDetailPage').then(m => ({ default: m.EventDetailPage })));

// ––– утилиты ––––––––––––––––––––––––––––––––––––––––––––––––
function formatDateKey(dateIso: string) {
  return dateIso.split('T')[0];
}

const categoryMapping: Record<string, string> = {
  'Фестиваль': 'festival',
  'Концерт': 'concert',
  'Выставка': 'exhibition',
  'Спортивное событие': 'sport',
  'Спорт': 'sport',
  festival: 'festival',
  concert: 'concert',
  exhibition: 'exhibition',
  sport: 'sport',
};

function pickCategoryId(e: EventApiItem): string {
  const raw = (e.category || e.event_type || '').trim();
  if (!raw) return 'festival';
  return categoryMapping[raw] ?? 'festival';
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ––– props –––––––––––––––––––––––––––––––––––––––––––––––––
interface EventBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// ––– компонент ––––––––––––––––––––––––––––––––––––––––––––
const EventBottomSheet: React.FC<EventBottomSheetProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { selectedRegions } = useRegionsStore();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [realEvents, setRealEvents] = useState<MockEvent[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<MockEvent[]>([]);
  const [archiveEvents, setArchiveEvents] = useState<MockEvent[]>([]);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MockEvent | null>(null);

  const addOpenEvent = useEventsStore(s => s.addOpenEvent);
  const setSelectedEventInStore = useEventsStore(s => s.setSelectedEvent);
  const setOpenEvents = useEventsStore(s => s.setOpenEvents);
  const setFocusEvent = useEventsStore(s => s.setFocusEvent);
  const eventSheetDate = useEventsStore(s => s.eventSheetDate);
  const eventSheetFocusEventId = useEventsStore(s => s.eventSheetFocusEventId);

  // Блокировка скролла body при открытии
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedEvent(null);
      setShowEventsModal(false);
      return;
    }

    if (eventSheetDate) {
      setSelectedEvent(null);
      setSelectedEventInStore(null);
      setShowEventsModal(false);
    }
  }, [eventSheetDate, isOpen, setSelectedEventInStore]);

  // ––– черновики из offline storage –––––––––––––––––––––––
  useEffect(() => {
    if (!user?.id || !isOpen) return;
    const load = async () => {
      try {
        await offlineContentStorage.init();
        const drafts = await offlineContentStorage.getAllDrafts('event');
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const mapped: MockEvent[] = drafts
          .filter((d): d is OfflineEventDraft => d.contentType === 'event' && d.status !== 'failed_permanent')
          .map(d => {
            const start = new Date(d.contentData.start_datetime || d.createdAt);
            const end = d.contentData.end_datetime ? new Date(d.contentData.end_datetime) : undefined;
            return {
              id: `draft_${d.id}` as any,
              title: d.contentData.title || 'Новое событие',
              description: d.contentData.description || '',
              date: fmt(start),
              endDate: end ? fmt(end) : undefined,
              categoryId: d.contentData.category || 'festival',
              hashtags: d.contentData.hashtags || [],
              location: d.contentData.location || '',
              latitude: d.contentData.latitude || 0,
              longitude: d.contentData.longitude || 0,
            } as MockEvent;
          });
        setPendingDrafts(mapped);
      } catch (e) {
        console.error('[EventBottomSheet] draft load error:', e);
      }
    };
    load();
  }, [user?.id, isOpen]);

  // ––– загрузка событий из API ––––––––––––––––––––––––––––
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getEvents();
        const mapped: MockEvent[] = await Promise.all(
          data.map(async (e: any) => {
            const startDate = formatDateKey(e.start_datetime);
            const endDate = e.end_datetime ? formatDateKey(e.end_datetime) : undefined;
            const categoryId = pickCategoryId(e);
            let latitude = e.latitude;
            let longitude = e.longitude;
            if ((latitude == null || longitude == null) && e.location) {
              try {
                const { geocodeAddress } = await import('../../services/geocodingService');
                const geo = await geocodeAddress(e.location);
                if (geo?.latitude && geo?.longitude) {
                  latitude = geo.latitude;
                  longitude = geo.longitude;
                }
              } catch {}
            }
            return {
              id: Number(e.id) || Math.abs(hashCode(String(e.id))),
              title: e.title,
              description: e.description || '',
              date: startDate,
              endDate: endDate !== startDate ? endDate : undefined,
              categoryId,
              hashtags: Array.isArray(e.hashtags) ? e.hashtags : [],
              location: e.location || '',
              latitude: latitude ?? NaN,
              longitude: longitude ?? NaN,
            } as MockEvent;
          }),
        );
        if (mounted) setRealEvents(mapped);
      } catch {
        if (mounted) setRealEvents([]);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  // ––– filteredEvents –––––––––––––––––––––––––––––––––––––
  const filteredEvents = useMemo(() => {
    const all = [...realEvents, ...pendingDrafts];
    if (selectedRegions.length === 0) return all;
    return all.filter(ev => {
      if (!ev.location) return false;
      const rid = getRegionIdByName(ev.location);
      return rid ? selectedRegions.includes(rid) : false;
    });
  }, [realEvents, pendingDrafts, selectedRegions]);

  // ––– синхронизация маркеров на карте –––––––––––––––––––
  useEffect(() => {
    if (!isOpen) return;
    const all = [...filteredEvents, ...mockEvents];
    const valid = all.filter(
      ev => Number.isFinite(ev.latitude) && Number.isFinite(ev.longitude) && ev.latitude !== 0 && ev.longitude !== 0,
    );
    setOpenEvents(valid);
  }, [filteredEvents, isOpen, setOpenEvents]);

  useEffect(() => {
    if (!isOpen || !eventSheetDate) return;

    const [year, month, day] = eventSheetDate.split('-').map(Number);
    if (!year || !month || !day) return;

    const all = [...filteredEvents, ...mockEvents];
    let events = all.filter(ev => {
      if (ev.date === eventSheetDate) return true;
      if (ev.endDate) {
        return new Date(eventSheetDate) >= new Date(ev.date) && new Date(eventSheetDate) <= new Date(ev.endDate);
      }
      return false;
    });

    if (eventSheetFocusEventId != null) {
      events = [...events].sort((left, right) => {
        if (left.id === eventSheetFocusEventId) return -1;
        if (right.id === eventSheetFocusEventId) return 1;
        return 0;
      });
    }

    if (events.length === 0) return;

    setSelectedDate(new Date(year, month - 1, day));
    setArchiveEvents(events);
    setShowEventsModal(true);
  }, [eventSheetDate, eventSheetFocusEventId, filteredEvents, isOpen]);

  // ––– клик по дате ––––––––––––––––––––––––––––––––––––––
  const handleDateClick = (day: number, month: number, year: number) => {
    const clicked = new Date(year, month, day);
    setSelectedDate(clicked);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const all = [...filteredEvents, ...mockEvents];
    const events = all.filter(ev => {
      if (ev.date === dateKey) return true;
      if (ev.endDate) {
        return new Date(dateKey) >= new Date(ev.date) && new Date(dateKey) <= new Date(ev.endDate);
      }
      return false;
    });
    if (events.length > 0) {
      setArchiveEvents(events);
      setShowEventsModal(true);
      events.forEach(ev => addOpenEvent(ev));
      setSelectedEventInStore(events[0]);
    }
  };

  // ––– адаптер –––––––––––––––––––––––––––––––––––––––––––
  const toExternal = (ev: MockEvent): ExternalEvent => ({
    id: ev.id.toString(),
    title: ev.title,
    description: ev.description || '',
    start_date: ev.date,
    end_date: ev.date,
    location: {
      address: ev.location || '',
      latitude: Number.isFinite(ev.latitude) ? ev.latitude : undefined,
      longitude: Number.isFinite(ev.longitude) ? ev.longitude : undefined,
    },
    source: 'local',
    category: ev.categoryId,
    url: '',
    image_url: '',
    attendees_count: undefined,
    price: undefined,
    organizer: undefined,
  });

  // ––– клик по событию → карта ––––––––––––––––––––––––––
  const handleEventClick = (ext: ExternalEvent) => {
    const mock: MockEvent = {
      id: parseInt(ext.id) || 0,
      title: ext.title,
      description: ext.description || '',
      date: ext.start_date,
      categoryId: ext.category || 'festival',
      hashtags: [],
      location: ext.location?.address || '',
      latitude: ext.location?.latitude ?? NaN,
      longitude: ext.location?.longitude ?? NaN,
    };

    setSelectedEvent(mock);
    setShowEventsModal(false);
    setSelectedEventInStore(mock);
    setFocusEvent(mock);

    // На мобильной версии — переходим на карту
    onClose();
    navigate('/map');
  };

  // ––– рендер –––––––––––––––––––––––––––––––––––––––––––
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="events-sheet-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 1500 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="events-sheet-panel"
            className="fixed inset-x-0 bottom-0 flex flex-col bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden"
            style={{ zIndex: 1501, height: '88vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Заголовок */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 pb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                События на карте
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Закрыть"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Календарь */}
            <div className="flex-1 overflow-y-auto travel-calendar-root">
              <div className="travel-calendar-container h-full flex flex-col relative">
                <div className="p-4 flex-1 flex flex-col relative z-10">
                  <div className="w-full h-full">
                    <CircularCalendar
                      currentDate={currentDate}
                      onDateChange={d => setCurrentDate(d)}
                      onMonthChange={d => setCurrentDate(d)}
                      events={[...realEvents, ...pendingDrafts, ...mockEvents]}
                      selectedDate={selectedDate}
                      onDateClick={handleDateClick}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Список событий дня */}
            <Suspense fallback={<div className="p-4 text-center text-sm">Загрузка...</div>}>
              <LazyEventsListModal
                isOpen={showEventsModal}
                onClose={() => setShowEventsModal(false)}
                events={archiveEvents.map(toExternal)}
                date={
                  selectedDate
                    ? selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''
                }
                onEventClick={handleEventClick}
              />
            </Suspense>

            {/* Детальная карточка */}
            {selectedEvent && (
              <Suspense fallback={<div className="p-4 text-center text-sm">Загрузка...</div>}>
                <LazyEventDetailPage
                  event={toExternal(selectedEvent)}
                  onClose={() => setSelectedEvent(null)}
                  onBack={() => {
                    setSelectedEvent(null);
                    setShowEventsModal(true);
                  }}
                />
              </Suspense>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EventBottomSheet;
