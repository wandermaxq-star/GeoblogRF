import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import Topbar from '../components/Topbar';
import { FaTrafficLight } from 'react-icons/fa';
import { Navigation, Minimize2, Building2, Package, Layers } from 'lucide-react';
import { usePackBuilderStore } from '../stores/packBuilderStore';
import PlannerActionButtons from '../components/Planner/PlannerActionButtons';
import { getAllZones, checkRoute, canCreateMarker, canCreateRoute } from '../services/zoneService';
import PlannerAccordion from '../components/Planner/PlannerAccordion';
import { usePlannerMapInitialization } from '../hooks/usePlannerMapInitialization';
import { usePlannerMapActions } from '../hooks/usePlannerMapActions';
import { usePlannerMarkerSync } from '../hooks/usePlannerMarkerSync';
import { usePlannerRouteSync } from '../hooks/usePlannerRouteSync';
import { usePlannerSelectedRoutes } from '../hooks/usePlannerSelectedRoutes';
import { usePlannerAutoRoute } from '../hooks/usePlannerAutoRoute';
import { usePlannerMapClick } from '../hooks/usePlannerMapClick';
import { useMapCenterOnCoordinates } from '../hooks/useMapCenterOnCoordinates';
import { useToast, type ToastVariant } from '../hooks/use-toast';
import { GlassPanel, GlassHeader } from '../components/Glass';
import { RouteCreationData } from '../components/Planner/RouteCategoryModal';

import { MarkerData } from '../types/marker';
import { getRoutePolyline, RouteAlternative } from '../services/routingService';
import { createRoute, CreateRouteDto } from '../api/routes';
import { createMarker as apiCreateMarker } from '../services/markerService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useFavorites, FavoritePlace, FavoriteRoute, FavoriteEvent } from '../contexts/FavoritesContext';
import { useRoutePlanner } from '../contexts/RoutePlannerContext';
import { getPendingContentCounts } from '../services/localModerationStorage';
import { offlineContentStorage, OfflineRouteDraft } from '../services/offlineContentStorage';
import { useRegionsStore } from '../stores/regionsStore';
import { useEventsStore } from '../stores/eventsStore';
import { MockEvent } from '../components/TravelCalendar/mockEvents';
import { useContentStore } from '../stores/contentStore';
import { projectManager } from '../services/projectManager';
import { geocodeAddress } from '../services/geocodingService';
import { getCategoryById } from '../components/TravelCalendar/TravelCalendar';
import { isWithinRussiaBounds } from '../utils/russiaBounds';
import RegionSelector from '../components/Regions/RegionSelector';
import { classifyPoint, generateTitleSuggestions, TitlePoint, requiresModeration } from '../services/routeTitleService';
import { FaCloud } from 'react-icons/fa';
import { PointSource } from '../types/routeBuilder';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
import { usePlannerFacadeStore } from '../stores/plannerFacadeStore';
// Types
import type { PlannerMarker, PlannerRoute } from '../types/planner';
// КРИТИЧНО: Централизованное хранилище состояния карты - для сохранения состояния Planner
import { getYandexControl, getYandexMapFromPlannerContainer, toggleYandexControlExpanded } from '../utils/yandexControls';

const normalizeFavoritePlaceToMarkerData = (fp: FavoritePlace): MarkerData | null => {
  const latitude = Number(fp.latitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[0] : NaN));
  const longitude = Number(fp.longitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[1] : NaN));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: fp.id,
    latitude,
    longitude,
    title: fp.name || fp.type || 'Без названия',
    description: fp.description ?? '',
    address: fp.location ?? '',
    category: fp.type || 'other',
    subcategory: undefined,
    rating: fp.rating ?? 0,
    rating_count: 0,
    photo_urls: [],
    hashtags: [],
    author_name: 'User',
    created_at: fp.created_at || new Date().toISOString(),
    updated_at: fp.updated_at || new Date().toISOString(),
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
  };
};

// Заголовок убран - пользователь видит активную кнопку в сайдбаре

const Planner: React.FC = function Planner() {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const { user, token } = useAuth();
  const { isDarkMode } = useTheme();
  const isAdmin = user?.role === 'admin';
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const [isStandaloneTopbar, setIsStandaloneTopbar] = useState(false);

  useEffect(() => {
    // если topbar уже рендерится MainLayout, не дублируем
    if (typeof document !== 'undefined') {
      setIsStandaloneTopbar(!document.querySelector('.topbar-container'));
    }
  }, []);
  const navigate = useNavigate();
  const safeFavorites = useFavorites();
  const { toast } = useToast();
  const showToast = useCallback((message: string, variant?: ToastVariant) => {
    const inferredVariant: ToastVariant =
      variant ?? (message.startsWith('✅') ? 'success'
        : message.startsWith('❌') ? 'error'
        : message.startsWith('⚠️') ? 'warning'
        : 'info');
    toast({
      title: message,
      variant: inferredVariant,
      duration: inferredVariant === 'error' ? 0 : 4000,
    });
  }, [toast]);

  // Получаем глобальное состояние выбранных маршрутов и меток
  const selectedRouteIds = safeFavorites.selectedRouteIds ?? [];
  const setSelectedRouteIds = safeFavorites.setSelectedRouteIds ?? (() => {});
  const selectedMarkerIds: string[] = safeFavorites.selectedMarkerIds ?? [];
  const setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>> = safeFavorites.setSelectedMarkerIds ?? (() => {});
  const selectedEventIds: string[] = safeFavorites.selectedEventIds ?? [];
  const setSelectedEventIds: React.Dispatch<React.SetStateAction<string[]>> = safeFavorites.setSelectedEventIds ?? (() => {});
  
  // Получаем facadeMarkers и facadeRoutes из Zustand store
  const { facadeMarkers, setFacadeMarkers } = usePlannerFacadeStore();
  const { facadeRoutes, setFacadeRoutes } = usePlannerFacadeStore();
  
  const [routeStats, setRouteStats] = useState<{ distanceText: string; durationText: string; distanceKm: number; durationSec: number } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);
  const [isRouteEditing, setIsRouteEditing] = useState(false);
  const [showZonesLayer, setShowZonesLayer] = useState(false);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);
  const [zones, setZones] = useState<Array<{ severity?: string; polygons: number[][][]; name?: string; type?: string }>>([]);

  // load zones only when layer enabled
  useEffect(() => {
    if (!showZonesLayer) {
      setZones([]);
      return;
    }
    let cancelled = false;
    getAllZones()
      .then(z => { if (!cancelled) setZones(z); })
      .catch(() => { if (!cancelled) setZones([]); });
    return () => { cancelled = true; };
  }, [showZonesLayer]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCoordinateInput, setShowCoordinateInput] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [routeTitleInput, setRouteTitleInput] = useState<string>('');
  const [isCustomTitle, setIsCustomTitle] = useState<boolean>(false);

  const [useForPosts, setUseForPosts] = useState<boolean>(false);
  const [useForEvents, setUseForEvents] = useState<boolean>(false);
  // Controlled inputs для ввода координат (вместо document.getElementById)
  const [coordinateLat, setCoordinateLat] = useState<string>('');
  const [coordinateLon, setCoordinateLon] = useState<string>('');
  // Controlled input для поиска адреса (вместо document.getElementById)
  const [searchAddress, setSearchAddress] = useState<string>('');
  const renderedRouteIdsRef = useRef<Set<string>>(new Set());
  // Альтернативные маршруты для сравнения (Google Maps-стиль)
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedAltId, setSelectedAltId] = useState<string>('shortest');
  // Настройки карты для управления слоями
  const [appliedMapSettings, setAppliedMapSettings] = useState({
    showTraffic: false,
  });
  // Route Pack Builder — управляется глобальным store
  const openPackBuilder = usePackBuilderStore((s) => s.open);
  // --- восстановленные контексты ---
  const { selectedRegions } = useRegionsStore();
  const openEvents = useEventsStore((state) => state.openEvents);
  const selectedEvent = useEventsStore((state) => state.selectedEvent);
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent);
  const routePlannerContext = useRoutePlanner();
  const { addRoutePoint, removeRoutePoint, routePoints: routePointsFromContext, setRoutePoints, clearRoutePoints } = routePlannerContext;
  // Ref для работы с последними routePoints без добавления в deps useEffect
  const routePointsRef = useRef<typeof routePointsFromContext>(routePointsFromContext);
  routePointsRef.current = routePointsFromContext;
  const prevSelectedEventIdRef = useRef<string | null>(null);
  
  // Ref для facadeMarkers чтобы handleMapClick не пересоздавался при изменении маркеров
  const facadeMarkersRef = useRef(facadeMarkers);
  facadeMarkersRef.current = facadeMarkers;

  // --- Централизованные состояния загрузки ---
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRouteDrafts, setPendingRouteDrafts] = useState<PlannerRoute[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- Функция загрузки черновиков маршрутов ---
  const loadPendingRoutes = useCallback(async (userId?: string): Promise<PlannerRoute[] | null> => {
    if (!userId) return [];
    try {
      await offlineContentStorage.init();
      const drafts = await offlineContentStorage.getAllDrafts('route');
      const routeDrafts: PlannerRoute[] = drafts
        .filter((draft): draft is OfflineRouteDraft => draft.contentType === 'route' && draft.status !== 'failed_permanent')
        .map((draft) => {
          const { contentData, id, track } = draft;
          let routePoints: [number, number][] = [];
          if (track && track.geometry && track.geometry.type === 'LineString' && track.geometry.coordinates) {
            routePoints = track.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
          } else if (contentData.points && contentData.points.length >= 2) {
            routePoints = contentData.points.map((point) => [point.latitude, point.longitude] as [number, number]);
          }
          return {
            id: `draft_${id}`,
            points: routePoints,
            color: '#ff9800',
            title: contentData.title || 'Новый маршрут',
            description: contentData.description || '',
            isPending: true,
            status: 'pending',
            metadata: { draftId: id, draftStatus: draft.status }
          } as PlannerRoute;
        })
        .filter(route => route.points.length >= 2);
      return routeDrafts;
    } catch (error) {
      return null;
    }
  }, []);

  // --- Функция загрузки счётчика модерации ---
  const loadModerationCount = useCallback(() => {
    if (isAdmin) {
      try {
        const counts = getPendingContentCounts();
        setModerationCount(counts.route);
      } catch {
        setModerationCount(0);
      }
    }
  }, [isAdmin]);

  // --- Централизованный useEffect для моментальной загрузки ---
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const loadAll = async () => {
      try {
        const markersPromise = projectManager.loadAllMarkers();
        const routeDraftsPromise = loadPendingRoutes(user?.id);

        const [routeDrafts] = await Promise.all([routeDraftsPromise, markersPromise]);

        if (isMounted) {
          if (routeDrafts !== null) {
            setPendingRouteDrafts(routeDrafts);
          }
          setIsLoading(false);
        }
      } catch (e: unknown) {
        if (isMounted) {
          setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
          setIsLoading(false);
        }
      }
    };

    loadAll();

    const interval = setInterval(async () => {
      if (!isMounted) return;
      const routeDrafts = await loadPendingRoutes(user?.id);
      if (isMounted && routeDrafts !== null) {
        setPendingRouteDrafts(routeDrafts);
      }
    }, 10000);

    if (isAdmin) loadModerationCount();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id, loadPendingRoutes, loadModerationCount, isAdmin]);

  // ── Загрузка пака из Маршрутного Хаба (sessionStorage) ─────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('hub_pack_to_load');
      if (!raw) return;
      sessionStorage.removeItem('hub_pack_to_load');
      const pack = JSON.parse(raw) as {
        id: string;
        title: string;
        polyline?: [number, number][];
        waypoints?: Array<{ title: string; coordinates: [number, number] }>;
      };

      // Добавляем точки маршрута как маркеры в Planner
      if (pack.waypoints?.length) {
        const newMarkers: PlannerMarker[] = pack.waypoints.map((wp, i) => ({
          id: `hub-wp-${pack.id}-${i}`,
          lat: wp.coordinates[0],
          lon: wp.coordinates[1],
          title: wp.title,
          name: wp.title,
          description: `Точка пака «${pack.title}»`,
          category: 'hub',
        }));
        setFacadeMarkers(prev => [...prev, ...newMarkers]);
      }

      // Отображаем polyline пака как альтернативный маршрут
      if (pack.polyline && pack.polyline.length >= 2) {
        const synthetic: RouteAlternative = {
          id: 'shortest',
          label: pack.title,
          hint: `Пак из Маршрутного Хаба`,
          colorActive: '#22d3ee',
          polyline: pack.polyline,
          distanceKm: 0,
          durationMin: 0,
        };
        setRouteAlternatives([synthetic]);
        setSelectedAltId('shortest');
      }
    } catch {
      // sessionStorage недоступен или некорректный пакет
    }
  }, [setFacadeMarkers, setRouteAlternatives, setSelectedAltId]); // только при монтировании

  // Используем store для управления панелями (если нужно)
  // const setLeftContent = useContentStore((state) => state.setLeftContent);
  // Состояние для фасада карт - только Яндекс!
  const currentMapProvider = 'yandex';


  // Получаем состояние layout для проверки двухоконного режима
  // ВАЖНО: используем store напрямую для реактивности
  const rightContentFromStore = useContentStore((state) => state.rightContent);
  const leftContentFromStore = useContentStore((state) => state.leftContent);
  // Проверяем, активен ли Planner (виден пользователю)
  const isPlannerActive = leftContentFromStore === 'planner';
  // Двухоконный режим - когда есть посты справа
  const isTwoPanelMode = rightContentFromStore !== null;

  const { isMapReady, setIsMapReady } = usePlannerMapInitialization({
    isPlannerActive,
    provider: currentMapProvider,
    facadeMarkers,
    facadeRoutes,
    pendingRoutes: pendingRouteDrafts,
  });

  const { addPointAndRender, renderMarkersOnMap } = usePlannerMapActions({
    isMapReady,
    isPlannerActive,
    routePointsFromContext,
    addRoutePoint,
    removeRoutePoint,
  });

  // Управление margin карты при двухоконном режиме
  // В двухоконном режиме центр карты должен быть в центре левой половины экрана
  // Реагирует на ресайз окна для корректного пересчёта margin
  useEffect(() => {
    if (!isMapReady) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const calculateAndSetMargin = () => {
      try {
        const mapApi = projectManager.getMapApi?.();
        if (mapApi && typeof mapApi.setMapMargin === 'function') {
          if (isTwoPanelMode) {
            // Правая панель занимает ~50% экрана, добавляем margin справа
            const rightMargin = Math.floor(window.innerWidth * 0.5);
            mapApi.setMapMargin(rightMargin);
          } else {
            // Сбрасываем margin при одноэкранном режиме
            if (typeof mapApi.resetMapMargin === 'function') {
              mapApi.resetMapMargin();
            } else {
              mapApi.setMapMargin(0);
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки - не все карты поддерживают margin
      }
    };

    // Первый вызов при монтировании или изменении зависимостей
    calculateAndSetMargin();

    // Слушаем resize события с throttling (150ms)
    // Это предотвращает множественные пересчёты при растяжении окна вручную
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateAndSetMargin, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [isTwoPanelMode, isMapReady]);

  // Fallback: скрываем лоадер карты через 3 секунды если карта так и не загрузилась
  // Это предотвращает бесконечный белый экран с лоадером
  useEffect(() => {
    if (isMapReady || !isPlannerActive) return;

    const timeout = setTimeout(() => {
      if (!isMapReady) {
        setIsMapReady(true);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [isPlannerActive, isMapReady]);

  // Автоматическое управление событиями в маршруте при смене selectedEvent
  useEffect(() => {
    const selectedEventId = selectedEvent?.id != null ? String(selectedEvent.id) : null;
    if (selectedEventId === prevSelectedEventIdRef.current) return;
    prevSelectedEventIdRef.current = selectedEventId;
    if (!selectedEvent) return;

    const currentEventId = `event-${selectedEvent.id}`;

    // Используем ref чтобы не добавлять routePointsFromContext в deps (избегаем цикла)
    const eventRoutePoints = routePointsRef.current?.filter(rp => rp.id?.startsWith('event-')) || [];

    // Удаляем все события из маршрута, кроме текущего выбранного
    eventRoutePoints.forEach(rp => {
      if (rp.id !== currentEventId) {
        // Это другое событие - удаляем его из маршрута
        removeRoutePoint(rp.id);
      }
    });

    // перед добавлением нового события убираем все предыдущие event-метки
    setFacadeMarkers(prev => {
      const filtered = prev.filter(m => !(typeof m.id === 'string' && m.id.startsWith('event-')));
      return filtered.length === prev.length ? prev : filtered;
    });

    // Добавляем текущее событие в маршрут, если его там еще нет и у него есть координаты
    const isAlreadyInRoute = eventRoutePoints.some(rp => rp.id === currentEventId);
    if (!isAlreadyInRoute &&
      selectedEvent.latitude != null &&
      selectedEvent.longitude != null &&
      !isNaN(selectedEvent.latitude) && !isNaN(selectedEvent.longitude)) {
      // Автоматически добавляем событие в маршрут (с проверкой зон)
      void addPointAndRender({
        id: currentEventId,
        latitude: selectedEvent.latitude,
        longitude: selectedEvent.longitude,
        title: selectedEvent.title,
        description: selectedEvent.description || undefined,
        source: 'event',
      });
    }
  }, [selectedEvent, removeRoutePoint, addPointAndRender]);

  // при появлении списка openEvents (например, клик по дате) устанавливаем первый элемент
  useEffect(() => {
    if (!selectedEvent && openEvents && openEvents.length > 0) {
      setSelectedEvent(openEvents[0]);
    }
  }, [openEvents, selectedEvent, setSelectedEvent]);

  // если выбранное событие сброшено (закрыли попап без добавления),
  // нужно убрать оставшиеся точки/метки с id `event-…` и т.
  // к тому же старый маршрут может остаться, поэтому очистим фасадные метки
  useEffect(() => {
    if (selectedEvent) return;

    const hasEventMarker = facadeMarkers.some(m => typeof m.id === 'string' && m.id.startsWith('event-'));
    if (!hasEventMarker) return;

    // убираем любые event-метки со стены
    setFacadeMarkers(prev => {
      const remaining = prev.filter(m => !(typeof m.id === 'string' && m.id.startsWith('event-')));
      if (remaining.length === prev.length) return prev; // ничего не отфильтровано — та же ссылка
      // Синхронизация произойдёт автоматически через usePlannerMarkerSync
      return remaining;
    });

    // чистим контекст маршрутов
    routePointsRef.current?.forEach(rp => {
      if (rp.id?.startsWith('event-')) {
        removeRoutePoint(rp.id);
      }
    });
  }, [selectedEvent, removeRoutePoint, facadeMarkers]);

  // Центрирование карты на выбранное событие (реакция на selectedEvent)
  useMapCenterOnCoordinates({
    isMapReady,
    latitude: selectedEvent?.latitude,
    longitude: selectedEvent?.longitude,
    zoom: 13,
    isTwoPanelMode,
    animate: true,
    duration: 1.2,
  });

  // Аналогично реагируем на фокус (setFocusEvent) поскольку календарь иногда
  // использует именно этот слот для быстрого центрирования
  const focusEvent = useEventsStore(s => s.focusEvent);
  useMapCenterOnCoordinates({
    isMapReady,
    latitude: focusEvent?.latitude,
    longitude: focusEvent?.longitude,
    zoom: 13,
    isTwoPanelMode,
    animate: true,
    duration: 1.2,
  });

  // Обработчик добавления события в маршрут
  const handleAddEventToRoute = useCallback(async (event: MockEvent) => {
    // Проверяем на null/undefined, а не на falsy значения (0 - валидная координата)
    if (event.latitude == null || event.longitude == null || isNaN(event.latitude) || isNaN(event.longitude)) {
      showToast('❌ У события нет координат для добавления в маршрут');
      return;
    }

    // Добавляем событие как точку маршрута + рендерим на карте (с проверкой зон)
    const added = await addPointAndRender({
      id: `event-${event.id}`,
      latitude: event.latitude,
      longitude: event.longitude,
      title: event.title,
      description: event.description || undefined,
      source: 'event',
    });

    if (added) {
      // Открываем настройки маршрута, чтобы пользователь увидел добавленную точку
      setSettingsOpen(true);
      showToast(`✅ Событие "${event.title}" добавлено в маршрут!`);
    }
  }, [addPointAndRender]);

  // УБРАНО: Маркеры событий теперь добавляются через синхронизацию routePointsFromContext с facadeMarkers
  // FacadeMap автоматически отрисовывает маркеры из facadeMarkers, поэтому не нужно добавлять их напрямую через mapFacade

  // Очистка при смене провайдера - убрано, так как только Яндекс



  // Санитизация списка выбранных ID: если favorite list обновится
  // (например, при возвращении с карты) — очищаем невалидные элементы.
  // Пропускаем проверку до тех пор, пока favoritosContext не гидратирован,
  // иначе первые рендеры будут обнулять selectedMarkerIds.
  const favoriteMarkerIds = useMemo(() => {
    const favs = safeFavorites.favorites || [];
    return new Set<string>(favs.map(f => String(f.id)));
  }, [safeFavorites.favorites]);

  const favoriteEventIds = useMemo(() => {
    const favs = safeFavorites.favoriteEvents || [];
    return new Set<string>(favs.map(f => String(f.id)));
  }, [safeFavorites.favoriteEvents]);

  useEffect(() => {
    if (!Array.isArray(selectedMarkerIds)) return;
    if (!safeFavorites.isHydrated) return;

    const filtered = selectedMarkerIds.filter(id => favoriteMarkerIds.has(id));
    const isSame = filtered.length === selectedMarkerIds.length &&
      filtered.every((id, idx) => id === selectedMarkerIds[idx]);

    if (!isSame) {
      setSelectedMarkerIds(filtered);
    }
  }, [favoriteMarkerIds, selectedMarkerIds, setSelectedMarkerIds, safeFavorites.isHydrated]);

  useEffect(() => {
    if (!Array.isArray(selectedEventIds)) return;
    if (!safeFavorites.isHydrated) return;

    const filtered = selectedEventIds.filter(id => favoriteEventIds.has(id));
    const isSame = filtered.length === selectedEventIds.length &&
      filtered.every((id, idx) => id === selectedEventIds[idx]);

    if (!isSame) {
      setSelectedEventIds(filtered);
    }
  }, [favoriteEventIds, selectedEventIds, setSelectedEventIds, safeFavorites.isHydrated]);

  usePlannerMarkerSync({
    isMapReady,
    facadeMarkers,
    selectedMarkerIds,
    selectedEventIds,
    routePointsFromContext,
    addPointAndRender,
    removeRoutePoint,
    renderMarkersOnMap,
  });

  usePlannerRouteSync({
    isMapReady,
    facadeRoutes,
    routeAlternatives,
    selectedAltId,
    setSelectedAltId,
    renderedRouteIdsRef,
    isRouteEditing,
  });

  const handleToggleRouteEditor = useCallback(async () => {
    const mapApi = projectManager.getMapApi?.();
    if (!mapApi) {
      showToast('❌ Карта ещё не готова');
      return;
    }

    if (isRouteEditing) {
      try {
        if (typeof (mapApi as any).setRouteEditorMode === 'function') {
          (mapApi as any).setRouteEditorMode('none');
        }

        const editedGeometry = typeof (mapApi as any).getEditedRouteGeometry === 'function'
          ? (mapApi as any).getEditedRouteGeometry()
          : null;

        if (Array.isArray(editedGeometry) && editedGeometry.length >= 2) {
          setRouteGeometry(editedGeometry);
          setFacadeRoutes([{
            id: `edited-route-${Date.now()}`,
            points: editedGeometry,
            color: '#3B82F6',
          }]);
        }

        // Удаляем редактор с карты
        if (typeof (mapApi as any).removeRouteEditor === 'function') {
          (mapApi as any).removeRouteEditor();
        }

        setIsRouteEditing(false);
        showToast('✅ Режим редактирования маршрута отключён');
      } catch (error) {
        console.warn('[Planner] Failed to disable route editor:', error);
        showToast('❌ Ошибка при выключении редактирования маршрута');
      }
      return;
    }

    let activePoints = facadeMarkers
      .filter(m => m.isActive !== false && Number.isFinite(m.lat) && Number.isFinite(m.lon))
      .map(m => [m.lat, m.lon] as [number, number]);

    let currentRouteGeometry = routeGeometry.length >= 2 ? routeGeometry : [];

    if (currentRouteGeometry.length < 2 && routeAlternatives.length > 0) {
      const selectedAlt = routeAlternatives.find(a => a.id === selectedAltId);
      if (selectedAlt && Array.isArray(selectedAlt.polyline) && selectedAlt.polyline.length >= 2) {
        currentRouteGeometry = selectedAlt.polyline;
      }
    }

    if (currentRouteGeometry.length < 2) {
      const activeRoute = facadeRoutes.find(route => Array.isArray(route.points) && route.points.length >= 2);
      if (activeRoute) {
        currentRouteGeometry = activeRoute.points;
      }
    }

    if (currentRouteGeometry.length < 2 && activePoints.length >= 2) {
      currentRouteGeometry = activePoints;
    }

    if (currentRouteGeometry.length < 2) {
      showToast('❌ Для редактирования маршрута нужно минимум 2 точки маршрута или готовый маршрут');
      return;
    }

    try {
      const editorWaypoints = activePoints.length >= 2
        ? activePoints
        : [currentRouteGeometry[0], currentRouteGeometry[currentRouteGeometry.length - 1]];

      const editableRoute = {
        id: `editor-route-${Date.now()}`,
        waypoints: editorWaypoints.map(([lat, lon]) => ({ lat, lon })),
        geometry: currentRouteGeometry,
      } as any;

      if (typeof (mapApi as any).createRouteEditor !== 'function') {
        showToast('❌ Редактирование маршрутов не поддерживается текущим рендерером');
        return;
      }

      const didCreate = await (mapApi as any).createRouteEditor(editableRoute, { addMidPoints: true });
      if (!didCreate) {
        showToast('❌ Не удалось включить режим редактирования маршрута');
        return;
      }

      if (typeof (mapApi as any).clearAlternatives === 'function') {
        (mapApi as any).clearAlternatives();
      }
      if (typeof (mapApi as any).clearRoutesExceptEditor === 'function') {
        (mapApi as any).clearRoutesExceptEditor();
      }

      setIsRouteEditing(true);
      showToast('✅ Режим редактирования маршрута включён. Перетащите ползунок на линии.');
    } catch (error) {
      console.warn('[Planner] Failed to enable route editor:', error);
      showToast('❌ Не удалось включить режим редактирования маршрута');
    }
  }, [facadeMarkers, facadeRoutes, isRouteEditing, routeGeometry, routeAlternatives, selectedAltId, setFacadeRoutes, showToast]);

  const { handleRouteToggle, extractRoutePoints } = usePlannerSelectedRoutes({
    isMapReady,
    selectedRouteIds,
    setSelectedRouteIds,
    facadeRoutes,
    setFacadeRoutes,
    facadeMarkers,
    setFacadeMarkers,
    renderedRouteIdsRef,
  });

  const { buildAndSetRoute } = usePlannerAutoRoute({
    isMapReady,
    facadeMarkers,
    facadeRoutes,
    routeAlternatives,
    setFacadeRoutes,
    setRouteAlternatives,
    setSelectedAltId,
    setRouteStats,
    renderedRouteIdsRef,
  });

  // === КРИТИЧНО: Переинициализация маршрутов при возвращении на Planner ===
  // Аналогично маркерам, сбрасываем кэш отрисованных маршрутов при переключении вкладок
  useEffect(() => {
    if (!isMapReady || !isPlannerActive) return;

    const timer = setTimeout(() => {
      const mapApi = projectManager.getMapApi?.();
      if (!mapApi || typeof mapApi.renderRoute !== 'function') {
        return;
      }
      renderedRouteIdsRef.current.clear();
    }, 100);

    return () => clearTimeout(timer);
  }, [isMapReady, isPlannerActive, facadeRoutes]);

  // === Синхронизация routeGeometry и routeStats с выбранной альтернативой ===
  // Данные нужны при сохранении маршрута и отображении статистики
  useEffect(() => {
    const selected = routeAlternatives.find(a => a.id === selectedAltId);
    if (!selected) return;
    setRouteGeometry(selected.polyline);
    const km = selected.distanceKm;
    const distanceText = km >= 1 ? `${km.toFixed(1)} км` : `${Math.round(km * 1000)} м`;
    const totalMin = selected.durationMin;
    const durationText = totalMin >= 60
      ? `${Math.floor(totalMin / 60)} ч ${totalMin % 60} мин`
      : `${totalMin} мин`;
    setRouteStats({ distanceText, durationText, distanceKm: km, durationSec: totalMin * 60 });
  }, [selectedAltId, routeAlternatives]);

  // === Очистка альтернатив при удалении точек маршрута ===
  useEffect(() => {
    const activeCount = facadeMarkers.filter(m => m.isActive !== false).length;
    if (activeCount < 2 && routeAlternatives.length > 0) {
      setRouteAlternatives([]);
    }
  }, [facadeMarkers]);

  // === Автоматическая активация редактора при выборе альтернативы ===
  // Когда пользователь кликает на маршрут A/B/C, автоматически включается режим редактирования
  useEffect(() => {
    if (!isMapReady || routeAlternatives.length === 0) return;
    
    const selected = routeAlternatives.find(a => a.id === selectedAltId);
    if (!selected) return;
    
    const enableEditorForAlt = async () => {
      try {
        const mapApi = projectManager.getMapApi?.();
        if (!mapApi || typeof (mapApi as any).createRouteEditor !== 'function') {
          return;
        }

        const activeWaypoints = facadeMarkers
          .filter(m => m.isActive !== false)
          .map(m => ({ lat: m.lat, lon: m.lon }));

        const editableRoute = {
          id: `alt-route-${selected.id}`,
          waypoints: activeWaypoints.length >= 2 ? activeWaypoints : [],
          geometry: selected.polyline,
        } as any;

        const didCreate = await (mapApi as any).createRouteEditor(editableRoute, { addMidPoints: true });
        if (!didCreate) {
          console.warn('[Planner] Failed to create route editor for alternative');
          return;
        }

        if (typeof (mapApi as any).clearAlternatives === 'function') {
          (mapApi as any).clearAlternatives();
        }

        if (!isRouteEditing) {
          setIsRouteEditing(true);
        }
        console.log('[Planner] Route editor activated for alternative:', selected.id);
      } catch (error) {
        console.warn('[Planner] Failed to auto-enable route editor:', error);
      }
    };

    void enableEditorForAlt();
  }, [isMapReady, selectedAltId, routeAlternatives, facadeMarkers]);

  // Обработчик клика на карте для добавления маркера
  const handleMapClick = useCallback((lat: number, lon: number) => {
    // Используем ref чтобы всегда видеть актуальные маркеры, не пересоздавая коллбэк
    const currentCount = facadeMarkersRef.current.filter(m => m.isActive !== false).length || 0;
    void addPointAndRender({
      id: `click-${Date.now()}-${Math.random()}`,
      latitude: lat,
      longitude: lon,
      title: `Точка ${currentCount + 1}`,
      description: undefined,
      source: 'click',
    });
  }, [addPointAndRender]);

  usePlannerMapClick({
    isMapReady,
    onMapClick: handleMapClick,
  });

  const handleBuildRouteFromFavorites = useCallback(async (markerIds: string[]) => {
    // КРИТИЧНО: Используем favorites (MarkerData[]) из контекста — данные уже нормализованы
    const favoritesAsMarkers: MarkerData[] = safeFavorites.favorites || [];
    const rawPlaces = safeFavorites.favoritePlaces || [];

    const selectedMarkers = markerIds
      .map(id => {
        const fromMarkers = favoritesAsMarkers.find((m) => m.id === id);
        if (fromMarkers) return fromMarkers;
        // Fallback: ищем в сырых FavoritePlace и нормализуем координаты
        const fp = rawPlaces.find((m) => m.id === id);
        if (!fp) return null;
        return normalizeFavoritePlaceToMarkerData(fp);
      })
      .filter((m): m is MarkerData => Boolean(m));

    if (selectedMarkers.length < 2) {
      showToast('❌ Для построения маршрута нужно минимум 2 точки');
      return;
    }

    // Добавляем все маркеры на карту через addPointAndRender
    selectedMarkers.forEach(marker => {
      let lat = Number(marker.latitude);
      let lon = Number(marker.longitude);
      if (isNaN(lat) || isNaN(lon)) return;
      // Коррекция lat/lon если перевёрнуты
      if (!isWithinRussiaBounds(lat, lon) && isWithinRussiaBounds(lon, lat)) {
        const tmp = lat; lat = lon; lon = tmp;
      }
      addPointAndRender({
        id: marker.id || `fav-${Date.now()}-${Math.random()}`,
        latitude: lat,
        longitude: lon,
        title: marker.title || 'Без названия',
        description: undefined
      });
    });

    // Строим маршрут через единую функцию
    const routePoints = selectedMarkers.map(m => [Number(m.latitude), Number(m.longitude)]);
    const route = await buildAndSetRoute(routePoints);

    if (!isMountedRef.current) return;
    if (route) {
      showToast(`✅ Маршрут построен из ${selectedMarkers.length} точек!`);
    }
  }, [safeFavorites, buildAndSetRoute, addPointAndRender]);

  const handleClearAllClickMarkers = useCallback(() => {
    try {
      const mapApi = projectManager.getMapApi();
      if (mapApi && mapApi.clear) {
        mapApi.clear();
      }
      if (typeof mapApi?.clearAlternatives === 'function') {
        mapApi.clearAlternatives();
      }
    } catch {
      // Игнорируем ошибки
    }
    // Очищаем маркеры на Яндекс карте через renderMarkersOnMap
    renderMarkersOnMap([]);
    setFacadeMarkers([]);
    setFacadeRoutes([]);
    clearRoutePoints();
    setRouteAlternatives([]);
    setRouteStats(null);
    renderedRouteIdsRef.current.clear();
    showToast('✅ Карта очищена');
  }, [renderMarkersOnMap]);

  const handleFinalSaveRoute = useCallback(async (routeData: RouteCreationData) => {

    if (!user || !token) {
      showToast('❌ Необходимо войти в систему');
      return;
    }

    // ОБЯЗАТЕЛЬНАЯ финальная проверка запретных зон перед сохранением
    const routeCoords: [number, number][] = facadeMarkers
      .filter(m => m.lat !== undefined && m.lon !== undefined)
      .map(m => [m.lat!, m.lon!]);
    if (routeCoords.length >= 1) {
      try {
        const finalZoneCheck = await canCreateRoute(routeCoords);
        if (!finalZoneCheck.allowed) {
          if (isMountedRef.current) {
            showToast(`🚫 Сохранение заблокировано: ${finalZoneCheck.reason || 'Маршрут проходит через запретную зону'}`);
          }
          return;
        }
      } catch (err) {
        if (isMountedRef.current) {
          showToast('🚫 Не удалось проверить запретные зоны. Сохранение отменено для безопасности.');
        }
        return;
      }
    }

    try {
      const isUuid = (s: string | undefined) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      const pointResults = await Promise.all(facadeMarkers.map(async (m, index) => {
        if (m.lat === undefined || m.lon === undefined) {
          return { marker: m, id: null, success: false };
        }

        if (isUuid(m.id)) {
          return { marker: m, id: m.id, success: true };
        }

        try {
          const created = await apiCreateMarker({
            title: m.title || `Точка ${index + 1}`,
            latitude: m.lat,
            longitude: m.lon,
            category: 'route',
            address: undefined,
            hashtags: []
          });
          return { marker: m, id: created.id, success: true };
        } catch {
          return { marker: m, id: null, success: false };
        }
      }));

      if (!isMountedRef.current) return;

      const successfulPoints = pointResults
        .filter(r => r.success && r.id)
        .map(r => r.marker)
        .filter((m): m is PlannerMarker => m.lat !== undefined && m.lon !== undefined);
      const failedCount = pointResults.length - successfulPoints.length;

      if (failedCount > 0 && isMountedRef.current) {
        showToast(
          `⚠️ ${failedCount} из ${facadeMarkers.length} точек не удалось привязать. Маршрут сохранён с доступными данными.`
        );
      }

      const pointsToSave = successfulPoints.map(m => [m.lat!, m.lon!] as [number, number]);
      const waypointsToSave = pointResults
        .filter(r => r.success && r.id)
        .map((r, index) => ({ marker_id: r.id as string, order_index: index }));

      if (pointsToSave.length < 2) {
        if (isMountedRef.current) {
          showToast('❌ Для сохранения маршрута нужно минимум 2 успешно привязанные точки');
        }
        return;
      }

      let geometryToSave: Array<[number, number]> | undefined = (routeGeometry && routeGeometry.length > 1)
        ? routeGeometry
        : undefined;
      try {
        if (!geometryToSave && pointsToSave.length >= 2) {
          const { getRoutePolyline } = await import('../services/routingService');
          const snapped = await getRoutePolyline(pointsToSave, 'driving-car');
          if (Array.isArray(snapped) && snapped.length > 1) geometryToSave = snapped as Array<[number, number]>;
        }
      } catch { }

      if (!isMountedRef.current) return;

      const payload: CreateRouteDto = {
        title: routeData.title,
        route_data: {
          points: pointsToSave,
          geometry: geometryToSave
        },
        tags: Array.isArray(routeData.tags) ? routeData.tags : [],
        waypoints: waypointsToSave
      };
      const newRoute = await createRoute(payload, token);

      if (!isMountedRef.current) return;
      showToast('✅ Маршрут сохранен!');

      // Сброс UI-состояний после успешного сохранения
      setUseForPosts(false);
      setUseForEvents(false);
      setRouteTitleInput('');
      setIsCustomTitle(false);

      try {
        if (!isMountedRef.current) return;
        const tagsFromToggles: string[] = [
          ...(useForPosts ? ['post'] : []),
          ...(useForEvents ? ['event'] : [])
        ];
        const pointsForFav = (payload.route_data?.points || []).map((p: [number, number], idx: number) => ({ id: `pt-${idx}`, latitude: Number(p[0]), longitude: Number(p[1]) }));
        safeFavorites.addFavoriteRoute?.({
          id: newRoute.id,
          title: newRoute.title || payload.title,
          distance: 0,
          duration: 0,
          rating: 0,
          likes: 0,
          isOriginal: true,
          tags: Array.isArray(newRoute.tags) ? newRoute.tags : tagsFromToggles,
          description: newRoute.description || payload.description || '',
          visibility: 'private',
          usageCount: 0,
          relatedContent: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          points: pointsForFav,
          categories: {
            personal: true,
            post: tagsFromToggles.includes('post'),
            event: tagsFromToggles.includes('event')
          }
        });
      } catch { }
    } catch (error: unknown) {
      if (isMountedRef.current) {
        const serverMsg = error instanceof Error ? error.message : 'Server error';
        showToast(`❌ Ошибка сохранения маршрута: ${serverMsg}`);
      }
    }
  }, [user, token, facadeMarkers, routeStats, safeFavorites, useForPosts, useForEvents]);

  // Сохранение маршрута офлайн
  const handleSaveRouteOffline = useCallback(async (routeData: RouteCreationData) => {
    if (!user?.id) {
      showToast('Для сохранения офлайн необходимо авторизоваться');
      return;
    }

    try {
      const points = facadeMarkers
        .filter(m => m.lat !== undefined && m.lon !== undefined)
        .map(m => ({
          latitude: m.lat!,
          longitude: m.lon!,
          title: m.title || `Точка ${facadeMarkers.indexOf(m) + 1}`
        }));

      if (points.length < 2) {
        if (isMountedRef.current) {
          showToast('Для сохранения маршрута нужно минимум 2 точки');
        }
        return;
      }

      let track: GeoJSON.Feature<GeoJSON.LineString> | null = null;
      if (routeGeometry && routeGeometry.length >= 2) {
        track = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeGeometry.map(([lat, lon]) => [lon, lat])
          },
          properties: {}
        };
      }

      const regionId = 'default';

      await offlineContentStorage.addDraft({
        contentType: 'route',
        contentData: {
          title: routeData.title,
          description: routeData.description || '',
          points: points,
          waypoints: [],
          totalDistance: 0,
          estimatedDuration: 0,
          tags: routeData.tags || []
        },
        track: track,
        hasTrack: !!track,
        hasImages: false,
        status: 'draft',
        regionId: regionId
      });

      if (!isMountedRef.current) return;
      showToast('✅ Маршрут сохранён офлайн! Он будет отправлен автоматически при появлении интернета.');
      
      // Сброс UI-состояний после успешного сохранения
      setUseForPosts(false);
      setUseForEvents(false);
      setRouteTitleInput('');
      setIsCustomTitle(false);
      
      setShowTitleModal(false);
    } catch (error: unknown) {
      if (isMountedRef.current) {
        showToast(`❌ Ошибка сохранения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    }
  }, [user, facadeMarkers, routeGeometry, routeStats, setShowTitleModal]);

  // Подготовка названий и показ модалки
  const openTitleModalAndSuggest = useCallback(() => {
    try {
      const favoriteIds: Set<string> = new Set<string>(
        safeFavorites.favoritePlaces?.map((p) => String(p.id)) ?? []
      );
      const points: TitlePoint[] = facadeMarkers
        .filter(m => m.lat !== undefined && m.lon !== undefined)
        .map(m => ({
          id: m.id,
          name: m.title,
          coordinates: [m.lat!, m.lon!],
          type: classifyPoint(m.title, m.id, favoriteIds)
        }));
      const suggestions = generateTitleSuggestions(points).slice(0, 5);
      setTitleSuggestions(suggestions);
      setRouteTitleInput(suggestions[0] || `Маршрут ${new Date().toLocaleDateString()}`);
      setIsCustomTitle(false);
      setShowTitleModal(true);
    } catch (e) {
      setTitleSuggestions([]);
      setRouteTitleInput(`Маршрут ${new Date().toLocaleDateString()}`);
      setIsCustomTitle(false);
      setShowTitleModal(true);
    }
  }, [facadeMarkers, safeFavorites]);

  // Функция удаления маркера через фасад
  const handleRemoveMarker = (markerId: string) => {
    try { if (markerId) projectManager.getMapApi().removeMarker(markerId); } catch { }
    setFacadeMarkers(prev => {
      const updated = prev.filter(m => m.id !== markerId);
      if (updated.length === prev.length) return prev; // ничего не удалено
      // Маркеры синхронизируются автоматически через usePlannerMarkerSync
      return updated;
    });
    // Также удаляем из routePoints контекста, если это точка маршрута
    if (removeRoutePoint) {
      removeRoutePoint(markerId);
    }
  };

  const handleMoveToPlanner = async (ids: string[]) => {
    // КРИТИЧНО: Используем favorites (MarkerData[]) из контекста — данные уже нормализованы
    // FavoritePlace имеет name/coordinates, а favorites из контекста — title/latitude/longitude
    const favoritesAsMarkers: MarkerData[] = safeFavorites.favorites || [];
    // Также пробуем favoritePlaces для обратной совместимости
    const rawPlaces = safeFavorites.favoritePlaces || [];

    const selectedMarkers = ids
      .map(id => {
        // Сначала ищем в готовых MarkerData
        const fromMarkers = favoritesAsMarkers.find((m) => m.id === id);
        if (fromMarkers) return fromMarkers;
        // Fallback: ищем в сырых FavoritePlace и нормализуем
        const fp = rawPlaces.find((m) => m.id === id);
        if (!fp) return null;
        return normalizeFavoritePlaceToMarkerData(fp);
      })
      .filter((m): m is MarkerData => Boolean(m));

    if (selectedMarkers.length === 0) {
      showToast('❌ Не найдено меток для переноса');
      return;
    }

    // Добавляем метки в routePointsFromContext, корректируя возможную путаницу lat/lon по границам РФ
    let addedCount = 0;
    let blockedCount = 0;
    for (const marker of selectedMarkers) {
      let lat = Number(marker.latitude);
      let lon = Number(marker.longitude);

      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }

      // Если пара (lat, lon) вне РФ, а (lon, lat) внутри РФ — считаем, что была путаница местами
      if (!isWithinRussiaBounds(lat, lon) && isWithinRussiaBounds(lon, lat)) {
        const tmp = lat; lat = lon; lon = tmp;
      }

      // Добавляем точку + рендерим на карте (с проверкой зон)
      const added = await addPointAndRender({
        id: marker.id,
        latitude: lat,
        longitude: lon,
        title: marker.title || 'Место из избранного',
        description: undefined,
        source: 'favorite',
      });
      if (added) {
        addedCount++;
      } else {
        blockedCount++;
      }
    }

    // Открываем настройки и показываем добавленные точки
    if (!isMountedRef.current) return;
    setSettingsOpen(true);
    if (blockedCount > 0) {
      showToast(`⚠️ Добавлено ${addedCount} из ${selectedMarkers.length} меток. ${blockedCount} заблокировано (запретные зоны).`);
    } else {
      showToast(`✅ ${addedCount} меток добавлено в маршрут`);
    }
  };

  const handleFavoriteToggle = useCallback((markerId: string) => {
    setFacadeMarkers(prev => {
      const updated = prev.map(m =>
        m.id === markerId ? { ...m, isActive: m.isActive === false ? true : false } : m
      );
      // Маркеры синхронизируются автоматически через usePlannerMarkerSync
      return updated;
    });
  }, []);

  const handleLoadRoute = useCallback((routeId: string) => {
    const favoriteRoutes = safeFavorites.favoriteRoutes || [];
    const route = favoriteRoutes.find((r) => String(r.id) === routeId);
    if (!route) {
      return;
    }
    const points = extractRoutePoints(route);
    if (points.length < 2) {
      return;
    }
    // Добавляем в selectedRouteIds чтобы синхронизация сработала
    setSelectedRouteIds((prev: string[]) => {
      if (prev.includes(routeId)) return prev;
      return [...prev, routeId];
    });
    // Также напрямую добавляем в facadeRoutes
    const r: PlannerRoute = { id: `fav-route-${routeId}`, points, color: '#8B5CF6' };
    setFacadeRoutes(prev => {
      if (prev.some(existing => existing.id === r.id)) return prev;
      return [...prev, r];
    });
  }, [safeFavorites, extractRoutePoints, setSelectedRouteIds, setFacadeRoutes]);

  const handleCoordinateSubmit = useCallback(async (lat: number, lon: number) => {
    const pointId = `marker-${Date.now()}`;
    const added = await addPointAndRender({
      id: pointId,
      latitude: lat,
      longitude: lon,
      title: `Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      description: undefined,
      source: 'coordinates',
    });
    if (added) {
      setShowCoordinateInput(false);
    }
  }, [addPointAndRender]);

  const handleSearchSubmit = useCallback(async (address: string, coordinates?: [number, number]) => {
    const pointId = `marker-${Date.now()}`;
    let lat: number, lon: number;

    if (coordinates && coordinates[0] !== 55.751244) {
      // Координаты переданы явно (не хардкод)
      lat = coordinates[0];
      lon = coordinates[1];
    } else {
      // Геокодим адрес через Яндекс Geocoder
      try {
        const result = await geocodeAddress(address);
        if (result) {
          lat = result.latitude;
          lon = result.longitude;
        } else {
          showToast(`❌ Адрес "${address}" не найден`);
          return;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        showToast(`❌ Ошибка геокодирования: ${msg}`);
        return;
      }
    }

    const added = await addPointAndRender({
      id: pointId,
      latitude: lat,
      longitude: lon,
      title: address,
      description: undefined,
      source: 'address',
    });
    if (added) {
      setShowSearchForm(false);
    }
  }, [addPointAndRender]);

  // Перестановка точек маршрута из списка в настройках
  const handleReorderPoints = useCallback((newOrder: string[]) => {
    setFacadeMarkers(prev => {
      const byId = new Map(prev.map(m => [m.id, m]));
      const reordered = newOrder
        .map(id => byId.get(id))
        .filter((m): m is PlannerMarker => m !== undefined);

      // добавим отсутствующие (если вдруг есть временные метки вне списка)
      prev.forEach(m => {
        if (m.id && !newOrder.includes(m.id)) {
          reordered.push(m);
        }
      });

      // Маркеры синхронизируются автоматически через usePlannerMarkerSync
      return reordered;
    });
  }, [setFacadeMarkers]);

  useEffect(() => {
    const activePoints = facadeMarkers
      .filter(m => m.isActive !== false && m.lat != null && m.lon != null)
      .map(m => [m.lat!, m.lon!] as [number, number]);

    if (activePoints.length >= 2) {
      buildAndSetRoute(activePoints);
    } else {
      if (routeAlternatives.length > 0) {
        setRouteAlternatives([]);
        setRouteGeometry([]);
      }
    }
  }, [facadeMarkers, buildAndSetRoute, routeAlternatives.length, setRouteAlternatives, setRouteGeometry]);

  // Применение настроек карты к Yandex Maps
  useEffect(() => {
    if (!isMapReady) return;

    const mapApi = projectManager.getMapApi?.();
    if (!mapApi) return;

    try {
      // Применяем пробки
      if (typeof mapApi.showTraffic === 'function' || typeof mapApi.hideTraffic === 'function') {
        if (appliedMapSettings.showTraffic) {
          mapApi.showTraffic?.();
        } else {
          mapApi.hideTraffic?.();
        }
      }

    } catch (error) {
      // Map settings error
    }
  }, [isMapReady, appliedMapSettings]);

  return (
    <>
      {isStandaloneTopbar && <Topbar />}
      <MirrorGradientContainer className="page-layout-container page-container planner-mode map-mode">
        <div className="page-main-area">
          <div className="page-content-wrapper">
            <div className="page-main-panel relative" style={{ background: 'transparent', borderRadius: 0 }}>
              {/* Старые кнопки удалены - теперь используется PlannerActionButtons */}

              {/* Основной контент */}
              <div className="h-full relative flex flex-col" style={{ width: '100%', height: '100%' }}>
                {/* Стеклянный блок с инструментами: RegionSelector + слои + пробки
                  ВАЖНО: Вынесен на верхний уровень чтобы выпадающий список не обрезался
                  Стиль: тёмное матовое стекло */}
                <div
                  className="absolute flex items-center gap-3 glass-l1"
                  style={{
                    // Отступ сверху: ниже topbar (64px) + отступ
                    top: isTwoPanelMode ? '80px' : '80px',
                    // В двухоконном режиме центр активной зоны карты = 25% от левого края
                    // В одноэкранном режиме - по центру (50%)
                    left: isTwoPanelMode ? '25%' : '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: '16px',
                    padding: '8px 16px',
                    transition: 'left 0.3s ease-in-out, top 0.3s ease-in-out',
                    zIndex: 9999,
                    // Включаем события мыши для этого блока
                    pointerEvents: 'auto'
                  }}
                >
                  {/* Селектор регионов */}
                  <RegionSelector />

                  {/* Переключатель слоев */}
                  <button
                    onClick={() => {
                      try {
                        const mapApi = projectManager.getMapApi?.();
                        const yMap = getYandexMapFromPlannerContainer() ?? mapApi?.map ?? mapApi?.mapInstance;
                        const layerControl = getYandexControl(yMap);
                        if (layerControl) {
                          const expanded = toggleYandexControlExpanded(layerControl);
                          setIsLayerControlOpen(expanded);
                        }
                      } catch (error) {
                        // Layer control error
                      }
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${isLayerControlOpen ? 'bg-white text-black shadow-sm' : 'bg-white/10 text-white/80'}`}
                    title={isLayerControlOpen ? 'Закрыть слои' : 'Слои'}
                    aria-label="Слои">
                    <Layers size={18} />
                  </button>

                  {/* Переключатель пробок */}
                  <button
                    onClick={() => {
                      const newSettings = { ...appliedMapSettings, showTraffic: !appliedMapSettings.showTraffic };
                      setAppliedMapSettings(newSettings);
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${appliedMapSettings.showTraffic ? 'bg-white text-black shadow-sm' : 'bg-white/10 text-white/80'}`}
                    title={appliedMapSettings.showTraffic ? 'Пробки включены' : 'Пробки отключены'}
                    aria-label="Пробки">
                    <FaTrafficLight size={18} />
                  </button>

                  {/* Переключатель велодорожек */}
                </div>

                {/* Кнопки действий планировщика - в двухоконном режиме рендерим ВНЕ map-area чтобы избежать overflow: hidden */}
                {isTwoPanelMode && (
                  <PlannerActionButtons
                    onSettingsClick={() => setSettingsOpen(true)}
                    onLayersClick={() => setShowZonesLayer(!showZonesLayer)}
                    showZonesLayer={showZonesLayer}
                    onClearMapClick={handleClearAllClickMarkers}
                    onSaveRouteClick={() => openTitleModalAndSuggest()}
                    onEditRouteClick={handleToggleRouteEditor}
                    isRouteEditing={isRouteEditing}
                    markersCount={facadeMarkers.length}
                    hasMarkersOrRoutes={facadeMarkers.length > 0 || facadeRoutes.length > 0}
                    isTwoPanelMode={true}
                  />
                )}

                <div className="map-content-container flex-1 flex flex-col min-h-0" style={{ width: '100%', height: '100%' }}>
                  {/* Область карты */}
                  <div className="map-area flex-1 min-h-0" style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <div className="full-height-content relative w-full h-full" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                      {/* Индикатор загрузки карты */}
                      {!isMapReady && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 glass-l1">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p style={{ color: 'var(--glass-text-secondary)' }}>Загрузка карты...</p>
                          </div>
                        </div>
                      )}

                      {/* Кнопки действий - в однооконном режиме внутри map-area */}
                      {!isTwoPanelMode && (
                        <PlannerActionButtons
                          onSettingsClick={() => setSettingsOpen(true)}
                          onLayersClick={() => setShowZonesLayer(!showZonesLayer)}
                          showZonesLayer={showZonesLayer}
                          onClearMapClick={handleClearAllClickMarkers}
                          onSaveRouteClick={() => openTitleModalAndSuggest()}
                          onEditRouteClick={handleToggleRouteEditor}
                          isRouteEditing={isRouteEditing}
                          markersCount={facadeMarkers.length}
                          hasMarkersOrRoutes={facadeMarkers.length > 0 || facadeRoutes.length > 0}
                          isTwoPanelMode={false}
                        />
                      )}

                      {/* Карта: единая инициализация через projectManager */}
                      <div id="planner-map-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

                      {/* Панель альтернативных маршрутов (стиль Яндекс Карт) */}
                      {routeAlternatives.length > 0 && (
                        <div
                          style={{
                            position: 'absolute', top: 80, right: 12,
                            zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 6,
                            maxWidth: 260,
                          }}
                        >
                          {routeAlternatives.map(alt => {
                            const isSelected = alt.id === selectedAltId;
                            const distText = alt.distanceKm >= 1
                              ? `${alt.distanceKm.toFixed(1)} км`
                              : `${Math.round(alt.distanceKm * 1000)} м`;
                            const durText = alt.durationMin >= 60
                              ? `${Math.floor(alt.durationMin / 60)} ч ${alt.durationMin % 60} мин`
                              : `${alt.durationMin} мин`;
                            return (
                              <button
                                key={alt.id}
                                onClick={() => setSelectedAltId(alt.id)}
                                style={{
                                  background: isSelected ? alt.colorActive : 'rgba(255,255,255,0.92)',
                                  color: isSelected ? '#fff' : '#1e293b',
                                  border: `2px solid ${isSelected ? alt.colorActive : 'rgba(0,0,0,0.08)'}`,
                                  borderRadius: 10,
                                  padding: '8px 14px',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxShadow: isSelected
                                    ? `0 4px 16px ${alt.colorActive}66`
                                    : '0 2px 8px rgba(0,0,0,0.12)',
                                  backdropFilter: 'blur(8px)',
                                  transition: 'all 0.18s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  fontFamily: 'inherit',
                                  fontSize: 13,
                                  lineHeight: 1.4,
                                  opacity: isSelected ? 1 : 0.85,
                                }}
                              >
                                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                  {alt.id === 'highway'  && <Navigation size={14} />}
                                  {alt.id === 'shortest' && <Minimize2   size={14} />}
                                  {alt.id === 'city'     && <Building2   size={14} />}
                                </span>
                                <span style={{ fontWeight: 600 }}>{alt.label}</span>
                                <span style={{ fontWeight: 400, opacity: isSelected ? 0.88 : 0.65, whiteSpace: 'nowrap' }}>
                                  {distText} · {durText}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Статистика одиночного маршрута (когда нет альтернатив) */}
                      {routeStats && routeAlternatives.length === 0 && (
                        <div
                          className="pointer-events-none glass-l2"
                          style={{
                            position: 'absolute', top: 80, right: 12,
                            padding: '6px 10px', borderRadius: 8,
                            fontSize: 14, zIndex: 1000
                          }}
                        >
                          {`${routeStats.distanceText} • ${routeStats.durationText}`}
                        </div>
                      )}

                      {/* Кнопка «Упаковать маршрут» — видна когда маршрут построен */}
                      {routeAlternatives.length > 0 && (
                        <button
                          onClick={() => {
                            const selectedAlt = routeAlternatives.find(a => a.id === selectedAltId) || routeAlternatives[0];
                            openPackBuilder({
                              polyline: (selectedAlt?.polyline as [number, number][]) ?? [],
                              distanceMeters: Math.round((selectedAlt?.distanceKm ?? 0) * 1000),
                              durationSeconds: Math.round((selectedAlt?.durationMin ?? 0) * 60),
                              initialWaypoints: facadeMarkers
                                .filter((m) => m.lat !== undefined && m.lon !== undefined)
                                .map((m) => ({ title: m.title || 'Точка', coordinates: [m.lat!, m.lon!] as [number, number] })),
                            });
                          }}
                          style={{
                            position: 'absolute', bottom: 16, right: 12, zIndex: 1100,
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '9px 16px', borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(34,211,238,0.85), rgba(167,139,250,0.85))',
                            border: '1px solid rgba(167,139,250,0.4)',
                            color: '#fff', fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', boxShadow: '0 4px 20px rgba(167,139,250,0.35)',
                            backdropFilter: 'blur(8px)',
                            fontFamily: 'inherit',
                          }}
                        >
                          <Package size={15} />
                          Упаковать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Левая выдвигающаяся панель с настройками в стиле стекла */}
              <GlassPanel
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                position="left"
                width="400px"
                closeOnOverlayClick={true}
                showCloseButton={false}
                className={`glass-panel planner-settings-panel${isDarkMode ? ' dark' : ''}`}
                constrainToMapArea={isTwoPanelMode}
              >
                <GlassHeader
                  title="Настройки маршрута"
                  onClose={() => setSettingsOpen(false)}
                  showCloseButton={true}
                  className={isDarkMode ? 'dark' : ''}
                />
                <div className="planner-accordion-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <PlannerAccordion
                    onBuildRoute={(points) => {
                      if (points && points.length > 0) {
                        points.forEach(point => {
                          if (point.address && point.coordinates) {
                            handleSearchSubmit(point.address, point.coordinates);
                          }
                        });
                      }
                    }}
                    onSettingsChange={() => { }}
                    onClose={() => setSettingsOpen(false)}

                    activePoints={facadeMarkers
                      .filter(m => m.lat !== undefined && m.lon !== undefined)
                      .map((m) => {
                        // Стабильный ID: либо реальный UUID, либо хеш координат
                        const stableId = m.id || `temp-${m.lat!.toFixed(5)}-${m.lon!.toFixed(5)}`;
                        
                        return {
                          id: stableId, // ✅ Ключ для React
                          title: m.title || '',
                          coordinates: [m.lat!, m.lon!],
                          source: ((m.category === 'favorite' ? 'favorites' : m.category === 'address' ? 'search' : m.category || 'click') as PointSource),
                          order: facadeMarkers.findIndex(original => original.id === m.id),
                          isActive: m.isActive !== false
                        };
                      })}
                    onRemovePoint={(id) => handleRemoveMarker(id)}
                    onTogglePoint={(id) => handleFavoriteToggle(id)}
                    onReorderPoints={handleReorderPoints}
                    onAddCoordinatePoint={() => setShowCoordinateInput(true)}
                    onAddSearchPoint={() => setShowSearchForm(true)}
                    onAddSearchPointFromForm={handleSearchSubmit}
                    onAddFavoritePoint={() => navigate('/favorites')}
                    onBuildRouteFromPoints={async () => {
                      // Получаем активные маркеры
                      const activeMarkers = facadeMarkers.filter(m => m.isActive !== false);
                      if (activeMarkers.length < 2) {
                        showToast('❌ Для построения маршрута нужно минимум 2 точки');
                        return;
                      }

                      try {
                        // Явно удаляем все маршруты с Яндекс карты перед перестройкой
                        const mapApi = projectManager.getMapApi?.();
                        // clearAllRoutes удаляет ВСЕ маршруты (даже если id-ы не совпали)
                        if (typeof mapApi?.clearAllRoutes === 'function') {
                          mapApi.clearAllRoutes();
                        } else {
                          for (const routeId of renderedRouteIdsRef.current) {
                            try { mapApi?.removeRoute?.(routeId); } catch {}
                          }
                        }
                        renderedRouteIdsRef.current.clear();
                        setFacadeRoutes([]);

                        const activePoints = activeMarkers.map(m => [Number(m.lat), Number(m.lon)] as [number, number]);
                        if (activePoints.length >= 2) await buildAndSetRoute(activePoints);
                      } catch (err) {
                        showToast('❌ Ошибка при построении маршрута');
                      }
                    }}
                    canBuildRoute={facadeMarkers.length >= 2}
                    showSearchForm={showSearchForm}
                    onSearchFormClose={() => setShowSearchForm(false)}
                    routeStats={{
                      distance: routeStats?.distanceKm ?? 0,
                      duration: routeStats?.durationSec ?? 0,
                      totalPoints: facadeMarkers.length,
                      estimatedDistance: 0,
                      estimatedDuration: 0,
                      canBuildRoute: facadeMarkers.length >= 2
                    }}
                  />
                </div>
              </GlassPanel>

              {/* Панель избранного удалена — функционал перенесён на страницу /favorites */}

              {/* Старые кнопки удалены - теперь в стеклянном меню PlannerActionButtons */}

              {/* Модальные окна */}
              {showCoordinateInput && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--glass-overlay)' }}>
                  <div className="glass-l1-strong" style={{ borderRadius: 16, padding: 24, width: 384 }}>
                    <h3 className="text-lg font-semibold mb-4">Ввод координат</h3>
                    <div className="space-y-4">
                      <div className="flex gap-2 mb-4">
                        <input
                          type="number"
                          placeholder="Широта"
                          value={coordinateLat}
                          onChange={(e) => setCoordinateLat(e.target.value)}
                          className="flex-1 p-2 border rounded"
                          step="0.001"
                        />
                        <input
                          type="number"
                          placeholder="Долгота"
                          value={coordinateLon}
                          onChange={(e) => setCoordinateLon(e.target.value)}
                          className="flex-1 p-2 border rounded"
                          step="0.001"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowCoordinateInput(false);
                            setCoordinateLat('');
                            setCoordinateLon('');
                          }}
                          className="px-4 py-2 bg-gray-300 rounded"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => {
                            const lat = parseFloat(coordinateLat);
                            const lon = parseFloat(coordinateLon);
                            if (!isNaN(lat) && !isNaN(lon)) {
                              handleCoordinateSubmit(lat, lon);
                              setCoordinateLat('');
                              setCoordinateLon('');
                            } else {
                              showToast('Введите корректные координаты');
                            }
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded"
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSearchForm && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--glass-overlay)' }}>
                  <div className="glass-l1-strong" style={{ borderRadius: 16, padding: 24, width: 384 }}>
                    <h3 className="text-lg font-semibold mb-4">Поиск адреса</h3>
                    <input
                      type="text"
                      placeholder="Введите адрес..."
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && searchAddress) {
                          handleSearchSubmit(searchAddress);
                          setSearchAddress('');
                        }
                      }}
                      className="w-full p-2 border rounded mb-4"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (searchAddress) {
                            handleSearchSubmit(searchAddress);
                            setSearchAddress('');
                          }
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Найти
                      </button>
                      <button
                        onClick={() => {
                          setShowSearchForm(false);
                          setSearchAddress('');
                        }}
                        className="px-4 py-2 bg-gray-300 rounded"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showTitleModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--glass-overlay)' }}>
                  <div className="glass-l1-strong" style={{ borderRadius: 16, padding: 24, width: 480, maxWidth: '92vw' }}>
                    <h3 className="text-lg font-semibold mb-3">Название маршрута</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--glass-text-secondary)' }}>Выберите предложенный вариант или введите свой.</p>
                    {titleSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {titleSuggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => { setRouteTitleInput(s); setIsCustomTitle(false); }}
                            className={`px-2 py-1 rounded border ${routeTitleInput === s && !isCustomTitle ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={routeTitleInput}
                      onChange={(e) => { setRouteTitleInput(e.target.value); setIsCustomTitle(true); }}
                      className="w-full p-2 border rounded mb-4"
                      placeholder={`Маршрут ${new Date().toLocaleDateString()}`}
                    />
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button onClick={() => setShowTitleModal(false)} className="px-3 py-2 bg-gray-200 rounded">Отмена</button>
                      <button
                        onClick={() => {
                          const favoriteIds: Set<string> = new Set<string>(
                            safeFavorites.favoritePlaces?.map((p) => String(p.id)) ?? []
                          );
                          const points: TitlePoint[] = facadeMarkers
                            .filter(m => m.lat !== undefined && m.lon !== undefined)
                            .map(m => ({
                              id: m.id,
                              name: m.title,
                              coordinates: [m.lat!, m.lon!],
                              type: classifyPoint(m.title, m.id, favoriteIds)
                            }));
                          const needModeration = requiresModeration(routeTitleInput, isCustomTitle, points);
                          const selectedTags: string[] = [
                            
                            ...(useForPosts ? ['post'] : []),
                            ...(useForEvents ? ['event'] : [])
                          ];
                          const payload: RouteCreationData = {
                            title: routeTitleInput,
                            description: needModeration ? 'Черновик: требуется модерация названия' : '',
                            category: 'other',
                            purpose: 'personal',
                            tags: selectedTags,
                            visibility: 'private',
                            isTemplate: false
                          };
                          handleSaveRouteOffline(payload);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2"
                      >
                        <FaCloud />
                        Сохранить офлайн
                      </button>
                      <button
                        onClick={() => {
                          const favoriteIds: Set<string> = new Set<string>(
                            safeFavorites.favoritePlaces?.map((p) => String(p.id)) ?? []
                          );
                          const points: TitlePoint[] = facadeMarkers
                            .filter(m => m.lat !== undefined && m.lon !== undefined)
                            .map(m => ({
                              id: m.id,
                              name: m.title,
                              coordinates: [m.lat!, m.lon!],
                              type: classifyPoint(m.title, m.id, favoriteIds)
                            }));
                          const needModeration = requiresModeration(routeTitleInput, isCustomTitle, points);
                          const selectedTags: string[] = [
                            ...(useForPosts ? ['post'] : []),
                            ...(useForEvents ? ['event'] : [])
                          ];
                          const payload: RouteCreationData = {
                            title: routeTitleInput,
                            description: needModeration ? 'Черновик: требуется модерация названия' : '',
                            category: 'other',
                            purpose: 'personal',
                            tags: selectedTags,
                            visibility: 'private',
                            isTemplate: false
                          };
                          setShowTitleModal(false);
                          handleFinalSaveRoute(payload);
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded"
                      >
                        Сохранить
                      </button>
                    </div>
                    <div className="mt-3 text-sm" style={{ color: 'var(--glass-text-secondary)' }}>
                      <p className="mb-2">Подсказка: выберите готовый вариант для быстрой публикации. Свой вариант может потребовать модерации.</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={useForPosts} onChange={(e) => setUseForPosts(e.target.checked)} />
                          <span>для постов</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={useForEvents} onChange={(e) => setUseForEvents(e.target.checked)} />
                          <span>для событий</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Затемнение при открытых панелях */}
              <div className={`page-overlay ${settingsOpen ? 'active' : ''}`} />
            </div>
          </div>
        </div>

        {/* Кнопка модерации для админа */}
        {isAdmin && !showModerationModal && (
          <button
            onClick={() => setShowModerationModal(true)}
            className="fixed right-4 top-20 z-40 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            title="Модерация маршрутов"
          >
            <span>📋</span>
            <span>Модерация</span>
            {moderationCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {moderationCount}
              </span>
            )}
          </button>
        )}

        {/* Модальное окно модерации */}
        {isAdmin && (
          <AdminModerationModal
            isOpen={showModerationModal}
            onClose={() => setShowModerationModal(false)}
            contentType="route"
            onContentApproved={(contentId) => {
              // Обновляем счётчик
              const counts = getPendingContentCounts();
              setModerationCount(counts.route);
            }}
          />
        )}
      </MirrorGradientContainer>
    </>
  );
};

export default Planner; 