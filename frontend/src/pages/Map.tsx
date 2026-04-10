import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { FilterLogic } from '../components/HashtagFilter';
import { MarkerData } from '../types/marker';
import { geocodingService, Place } from '../services/geocodingService';
import SearchResultsDropdown from '../components/Search/SearchResultsDropdown';
import { Bounds } from '../hooks/useLazyMarkers';
import { useMapFilters } from '../hooks/useMapFilters';
import { useMapSearch } from '../hooks/useMapSearch';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { mapFacade, INTERNAL } from '../services/map_facade/index';
import { projectManager } from '../services/projectManager';
import { useUserLocation } from '../hooks/useUserLocation';
import { useLocationMode } from '../hooks/useLocationMode';
// КРИТИЧНО: Централизованное хранилище маркеров - решает проблему потери маркеров
import { useMapStateStore, mapStateHelpers } from '../stores/mapStateStore';

import {
  FaStar, FaMap, FaCog, FaSearch, FaRoute, FaDownload
} from 'react-icons/fa';
import MapActionButtons from '../components/Map/MapActionButtons';
import MapFilters from '../components/Map/MapFilters';
import RegionSelector from '../components/Regions/RegionSelector';
import { useRegionsStore, getRegionIdByName } from '../stores/regionsStore';
// import { getregioncity as getRegionCity } from '../stores/regionCities'; // ЗАМЕНЕНО: Используем картографический фасад
import { GlassPanel, GlassHeader } from '../components/Glass';
import { RouteData } from '../types/route';
import { getRoutePolyline } from '../services/routingService';
import { useFavorites } from '../contexts/FavoritesContext';
import { useRoutePlanner, RoutePoint } from '../contexts/RoutePlannerContext';
import { useNavigate } from 'react-router-dom';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useLayoutState } from '../contexts/LayoutContext';
import { useLoading } from '../contexts/LoadingContext';
import { useContentStore, ContentType } from '../stores/contentStore';
import { useGeoFocusStore } from '../stores/geoFocusStore';
import { useGuest } from '../contexts/GuestContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAllZones, checkPoint } from '../services/zoneService';
import { getDistanceFromLatLonInKm } from '../utils/russiaBounds';
import '../styles/PageLayout.css';
import '../styles/PersistentMap.css';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
import { getPendingContentCounts } from '../services/localModerationStorage';
import { offlineContentStorage, OfflineMarkerDraft } from '../services/offlineContentStorage';
import MapComponent from '../components/Map/Map';
import { MapContainer } from '../components/Map/Map.styles';
import CategoryQuickFilter from '../components/Map/CategoryQuickFilter';
import MapAddSelector, { MapAddMode } from '../components/Map/MapAddSelector';
import { useEventsStore } from '../stores/eventsStore';
import { getEvents } from '../services/eventService';
import { mockEvents } from '../components/TravelCalendar/mockEvents';

const LazyEventDetailPage = lazy(() =>
  import('../components/Events/EventDetailPage').then(m => ({ default: m.EventDetailPage }))
);


interface MapPageProps {
  selectedMarkerId?: string;
  showOnlySelected?: boolean;
}

// КРИТИЧНО: Убираем React.memo, чтобы компонент всегда обновлялся при изменении store
// React.memo может "заморозить" компонент и не дать ему обновиться при изменении store
const MapPage: React.FC<MapPageProps> = ({ selectedMarkerId, showOnlySelected = false }) => {
  // Реф для контейнера карты
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const { isDarkMode } = useTheme();
  const { startLoading, stopLoading } = useLoading();
  const { setMarkerDataForBlog, openLeftPanel, openRightPanel } = useLayoutState();

  // Portal root for facade map (ensures map renders at document.body and is not clipped by page layout)
  const [facadeMapRootEl] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('facade-map-root') as HTMLElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = 'facade-map-root';
        document.body.appendChild(el);
      }
      return el;
    }
    return null;
  });
  const guest = useGuest();
  const auth = useAuth();
  const isGuest = !auth?.user;
  const isAdmin = auth?.user?.role === 'admin';
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);

  // Регистрируем панели при монтировании компонента
  useEffect(() => {
    registerPanel(); // Левая панель с настройками
    // Правая панель с избранным удалена, так как избранное теперь отдельная страница
    return () => {
      unregisterPanel(); // Левая панель
    };
  }, [registerPanel, unregisterPanel]);

  useEffect(() => {
    console.log('[MapPage] mounted');
    // КРИТИЧНО: явно устанавливаем leftContent='map' при монтировании,
    // чтобы Map.tsx (компонент) видел isMapInteractive=true сразу,
    // не дожидаясь useEffect в MainLayout (как сделано в мобильной версии)
    useContentStore.getState().setLeftContent('map');
    return () => {
      console.log('[MapPage] unmounted');
    };
  }, []);

  // Состояние для выдвигающихся панелей
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isAddingMarkerMode, setIsAddingMarkerMode] = useState(false);
  const [isAddingEventMode, setIsAddingEventMode] = useState(false);
  const [addSelectorOpen, setAddSelectorOpen] = useState(false);
  const [isCreationPanelOpen, setIsCreationPanelOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Обработчик записи трека (GPS)
  const handleRecordTrackClick = useCallback(async () => {
    if (!isRecording) {
      try {
        await projectManager.startTracking();
        setIsRecording(true);
      } catch (e: any) {
        // best-effort notify
        console.error('startTracking error', e);
      }
      return;
    }

    try {
      const track = await projectManager.stopTracking();
      setIsRecording(false);
      // Open post constructor or show quick modal to save/attach
      // For now, navigate to profile routes or show notification
      // mapFacade will save draft and notify; optionally handle returned track
      console.log('Track recorded', track);
    } catch (e) {
      console.error('stopTracking error', e);
    }
  }, [isRecording]);

  const handleCalendarClick = () => {
    if (rightContent === 'calendar') {
      closeRightPanel();
      setIsCalendarOpen(false);
    } else {
      setRightContent('calendar');
      setIsCalendarOpen(true);
    }
  };

  /** Единая кнопка "+" — открывает/закрывает предвыборный попап */
  const handleAddClick = () => {
    if (isAddingMarkerMode || isAddingEventMode) {
      // Отменяем активный режим
      setIsAddingMarkerMode(false);
      setIsAddingEventMode(false);
      setAddSelectorOpen(false);
    } else {
      setAddSelectorOpen(prev => !prev);
    }
  };

  /** Пользователь выбрал тип в MapAddSelector */
  const handleAddModeSelect = (mode: MapAddMode) => {
    setAddSelectorOpen(false);
    if (mode === 'marker') {
      setIsAddingMarkerMode(true);
      setIsAddingEventMode(false);
    } else {
      setIsAddingEventMode(true);
      setIsAddingMarkerMode(false);
    }
  };

  const favoritesContext = useFavorites();
  const navigate = useNavigate();
  const { setRoutePoints } = useRoutePlanner();
  // favoritesOpen и setFavoritesOpen больше не нужны, так как избранное отдельная страница

  // КРИТИЧНО: Получаем глобальное состояние выбранных маршрутов из FavoritesContext
  // Это обеспечивает синхронизацию чекбоксов маршрутов между Favorites, Map и Planner
  const selectedRouteIds = (favoritesContext as any)?.selectedRouteIds ?? [];
  const setSelectedRouteIds = (favoritesContext as any)?.setSelectedRouteIds ?? (() => { });

  // КРИТИЧНО: Берём favorites и selectedMarkerIds из КОНТЕКСТА, а не из локального state.
  // Это обеспечивает синхронизацию: MarkerPopup добавляет через контекст → FavoritesPanel и карта видят изменения.
  const favorites: MarkerData[] = (favoritesContext as any)?.favorites ?? [];
  const selectedMarkerIds: string[] = (favoritesContext as any)?.selectedMarkerIds ?? [];
  const setSelectedMarkerIds: React.Dispatch<React.SetStateAction<string[]>> = (favoritesContext as any)?.setSelectedMarkerIds ?? (() => {});

  // Отладочная информация (только в dev режиме)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    }
  }, [favoritesContext]);

  const [zones, setZones] = useState<Array<{ severity?: string; polygons: number[][][]; name?: string; type?: string }>>([]);
  const [showZonesLayer, setShowZonesLayer] = useState(false);

  // Загрузка запрещённых зон для отрисовки — только когда пользователь включил слой
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
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [filterLogic] = useState<FilterLogic>('OR');
  // markers state is managed by shared hook (handles loading, favorites merge, lazy mode etc.)
  const [pendingMarkerDrafts, setPendingMarkerDrafts] = useState<MarkerData[]>([]);
  const [activePreset] = useState<string | null>(null);

  // NOTE: actual call to useMapMarkers is moved further down, after we know
  // the `appliedFilters` object from useMapFilters.  We also want to tie the
  // hook's behaviour to the `useLazyLoading` state, which is declared later.


  // КРИТИЧНО: Восстанавливаем маркеры из centralized store при возврате на страницу
  // Это решает проблему "маркеры теряются после переключения на Planner и обратно"
  const cachedMarkers = useMapStateStore((state) => state.globalMarkers);
  const markersLoaded = useMapStateStore((state) => state.markersLoaded);

  useEffect(() => {
    // Если маркеры уже загружены в store, но не в локальном state - восстанавливаем
    if (markersLoaded && cachedMarkers.length > 0 && allMarkers.length === 0) {
      console.log('[MapPage] Restoring markers from cache:', cachedMarkers.length);
      // просто обновляем фасад, чтобы картины не «мигали» после возвращения
      try {
        mapFacade().updateExternalMarkers(cachedMarkers);
        console.log('[MapPage] Restored markers passed to facade');
      } catch (err) {
        console.warn('[MapPage] Failed passing restored markers to facade:', err);
      }
    }
  }, [markersLoaded, cachedMarkers.length]); // Не зависим от allMarkers чтобы избежать циклов

  // Получаем выбранные регионы для фильтрации
  const { selectedRegions, addRegion } = useRegionsStore();

  // Устанавливаем Владимирскую область как начальный регион при первом монтировании
  useEffect(() => {
    if (selectedRegions.length === 0) {
      addRegion('vladimir_oblast');
    }
  }, []);

  // Автоматическое определение местоположения пользователя
  const { location: userLocation, bounds: userBounds, loading: locationLoading, error: locationError, refreshLocation, clearLocation } = useUserLocation();

  // Режим геолокации: 'auto' - использовать местоположение пользователя, 'manual' - ручной режим
  const { mode: locationMode, toggleMode: toggleLocationMode } = useLocationMode();

  // Состояние для ленивой загрузки
  const [useLazyLoading, setUseLazyLoading] = useState(false);
  const [mapBounds, setMapBounds] = useState<Bounds | null>(userBounds);


  const [flyToCoordinates, setFlyToCoordinates] = useState<[number, number] | null>(null);
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  // selectedMarkerIds и favorites теперь берутся из FavoritesContext (выше)
  // VIP статус (заглушка, если не используется)
  const isVip = false;

  // Состояние для отображения загруженного маршрута
  const [routeData, setRouteData] = useState<{
    id: string;
    title: string;
    polyline: [number, number][];
    markers: any[];
  } | null>(null);


  // Центр и зум карты - КРИТИЧНО: используем значения из store
  const savedState = mapStateHelpers.getCenterAndZoom('osm');
  const [center, setCenter] = useState<[number, number]>(savedState.center);
  const [zoom, setZoom] = useState<number>(savedState.zoom);

  // Ссылки для поиска
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingStartRef = useRef(false);

  // ИСПРАВЛЕНО: Используем store для двухпанельного режима
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const setRightContent = useContentStore((state) => state.setRightContent);
  const closeRightPanel = useContentStore((state) => state.closeRightPanel);
  const isTwoPanelMode = rightContent !== null;

  // navigate уже объявлен выше через useNavigate, используем реальные контексты и store


  // Экспорт компонента


  // Получаем маршруты из FavoritesContext
  const { favoriteRoutes } = favoritesContext || { favoriteRoutes: [] };

  // Преобразуем FavoriteRoute в RouteData для совместимости.
  // useMemo стабилизирует ссылку — useEffect([selectedRouteIds, routes]) не срабатывает на каждый рендер
  const routes = useMemo<RouteData[]>(() => favoriteRoutes.map(route => ({
    id: route.id,
    title: route.title,
    description: '',
    points: route.points || [],
    waypoints: [],
    createdAt: route.addedAt.toISOString(),
    updatedAt: route.addedAt.toISOString()
  } as RouteData)), [favoriteRoutes]);

  // Черновики (draft) — то, что меняет пользователь в фильтрах/настройках
  // filters are managed by shared hook
  const {
    draft: draftFilters,
    applied: appliedFilters,
    setDraft: setDraftFilters,
    apply: applyFilters,
    reset: resetFilters,
    quickChange: handleQuickCategoryChange,
  } = useMapFilters();

  // Когда пользователь выбирает категорию "Событие" в QuickFilter — загружаем события в store
  const setOpenEvents = useEventsStore((state) => state.setOpenEvents);
  const selectedEvent = useEventsStore((state) => state.selectedEvent);
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent);

  // Мемоизированный ExternalEvent для EventDetailPage.
  // Зависим только от id чтобы объект не пересоздавался на каждый рендер (иначе бесконечный цикл).
  const selectedEventForDetail = useMemo(() => {
    const ev = selectedEvent;
    if (!ev) return null;
    return {
      id: String(ev.id),
      title: ev.title,
      description: ev.description || '',
      start_date: ev.date,
      end_date: ev.endDate ?? ev.date,
      location: {
        address: ev.location || '',
        latitude: Number.isFinite(ev.latitude) ? ev.latitude : undefined,
        longitude: Number.isFinite(ev.longitude) ? ev.longitude : undefined,
      },
      source: 'local' as const,
      category: ev.categoryId,
      url: '',
      image_url: '',
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id]);
  useEffect(() => {
    if (!appliedFilters.categories.includes('event')) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getEvents();
        if (cancelled) return;
        const mapped = data
          .filter((e: any) => e.latitude != null && e.longitude != null)
          .map((e: any) => ({
            id: Number(e.id) || 0,
            title: e.title,
            description: e.description || '',
            date: (e.start_datetime || '').split('T')[0],
            endDate: e.end_datetime ? (e.end_datetime).split('T')[0] : undefined,
            categoryId: e.category || e.event_type || 'festival',
            hashtags: Array.isArray(e.hashtags) ? e.hashtags : [],
            location: e.location || '',
            latitude: Number(e.latitude),
            longitude: Number(e.longitude),
          }));
        const all = [...mapped, ...mockEvents].filter(
          ev => !isNaN(ev.latitude) && !isNaN(ev.longitude) && ev.latitude !== 0 && ev.longitude !== 0
        );
        setOpenEvents(all);
      } catch (_err) {
        // Показываем хотя бы mockEvents
        const valid = mockEvents.filter(ev => !isNaN(ev.latitude) && !isNaN(ev.longitude));
        if (!cancelled) setOpenEvents(valid);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedFilters.categories, setOpenEvents]);

  const [draftMapSettings, setDraftMapSettings] = useState({
    mapType: 'light',
    showTraffic: false,
    showBikeLanes: false,
    showHints: true,
    themeColor: 'green',
  });

  // Применённые (applied) — то, что реально отображается на карте
  const [appliedMapSettings, setAppliedMapSettings] = useState(draftMapSettings);

  // Общий хук для загрузки маркеров. В аргументах указываем категории из
  // применённых фильтров и состояние ленивой загрузки из локального стейта.
  // 'event' — специальная «виртуальная» категория для событий, не передаём в API
  const markerApiCategories = appliedFilters.categories.filter(c => c !== 'event');
  const {
    allMarkers,
    loading: markersLoading,
    error: markersError,
    loadMarkers,
    reloadMarkers,
    clearMarkers,
  } = useMapMarkers({
    categories: markerApiCategories,
    lazy: useLazyLoading,
    // если отключаем ленивый режим, limit undefined означает "без ограничения" в
    // реализации хука. при ленивом режиме можно оставить default 100.
    limit: useLazyLoading ? 100 : undefined,
  });

  // search is handled by shared hook (depends on allMarkers)
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    isLoading: isSearchLoading,
    isDropdownVisible,
    setIsDropdownVisible,
    places: geocodingResults,
    markers: filteredMarkersForSearch,
  } = useMapSearch(allMarkers);

  // synchronize global loading indicator with search status
  useEffect(() => {
    if (isSearchLoading) {
      try { startLoading(); } catch {}
    } else {
      try { stopLoading(); } catch {}
    }
  }, [isSearchLoading, startLoading, stopLoading]);

  // когда карта получает новые границы, хук может подгрузить маркеры сам (в lazy
  // режиме), но для простоты мы вызываем reloadMarkers вручную при смене
  // режимов/границ ниже (см. handleMapBoundsChange / handleLoadingModeToggle).

  const addToFavorites = useCallback((marker: MarkerData) => {
    // Используем контекстную функцию для единого источника данных
    try {
      const isRealContext = favoritesContext && !(favoritesContext as any)._isStub;
      if (isRealContext && typeof (favoritesContext as any).addToFavorites === 'function') {
        (favoritesContext as any).addToFavorites(marker);
      }
    } catch (err) {
      console.warn('[MapPage] addToFavorites error:', err);
    }
  }, [favoritesContext]);


  // КРИТИЧНО: Передаем загруженные маркеры в фасад для отрисовки
  // Это главный способ как маркеры попадают на карту!
  useEffect(() => {
    if (allMarkers.length > 0) {
      console.log('[MapPage] Passing markers to facade:', allMarkers.length);

      // ИСПРАВЛЕНО: Преобразуем маркеры в формат фасада
      const markers = allMarkers.map(marker => ({
        id: marker.id,
        lat: marker.latitude,
        lon: marker.longitude,
        title: marker.title,
        name: marker.title,
        description: marker.description,
        category: marker.category,
      }));

      // КРИТИЧНО: Сохраняем маркеры в централизованное хранилище
      // Это позволяет восстанавливать их при переключении Map <-> Planner
      mapStateHelpers.setMarkers(markers);
      console.log('[MapPage] Markers saved to central store');

      // NOTE: Do not write directly into INTERNAL from render-time.
      // We let the final, filtered effect sync markers into the facade to avoid conflicts.
      // If early synchronization is required, use `mapFacade().updateExternalMarkers(markers)` here.
      // mapFacade().updateExternalMarkers(markers); // optional
    }
  }, [allMarkers]);

  // Если передан selectedMarkerId, выделяем эту метку
  useEffect(() => {
    if (selectedMarkerId && allMarkers.length > 0) {
      const selectedMarker = allMarkers.find(marker => marker.id === selectedMarkerId);
      if (selectedMarker && Number.isFinite(selectedMarker.latitude) && Number.isFinite(selectedMarker.longitude)) {
        setSelectedMarkerIdForPopup(selectedMarkerId);
        setCenter([selectedMarker.latitude, selectedMarker.longitude]);
        setZoom(15);
        // Если showOnlySelected, скрываем панели
        if (showOnlySelected) {
          setSettingsOpen(false);
          // setFavoritesOpen больше не используется
        }
      }
    }
  }, [selectedMarkerId, allMarkers, showOnlySelected]);

  // GeoFocus: клик по гео-иконке в PostCard/ActivityCard → фокусируем карту на объекте
  const geoFocusTarget = useGeoFocusStore((s) => s.target);
  const geoFocusSeq = useGeoFocusStore((s) => s.seq);
  useEffect(() => {
    if (!geoFocusTarget || allMarkers.length === 0) return;
    const { type, id } = geoFocusTarget;

    if (type === 'marker') {
      const marker = allMarkers.find((m) => m.id === id);
      if (marker && Number.isFinite(marker.longitude) && Number.isFinite(marker.latitude)) {
        setFlyToCoordinates([marker.latitude, marker.longitude]);
        setSelectedMarkerIdForPopup(marker.id);
      }
    }
    // route / event — пока только маркеры; можно расширить позже
    // Не сбрасываем target, чтобы при повторном клике сработал flyTo
    // (seq гарантирует реактивность)
  }, [geoFocusSeq, geoFocusTarget, allMarkers]);

  // ОТКЛЮЧЕНО: Автоматическое центрирование по геолокации
  // Это сбрасывало сохранённое состояние карты
  // Пользователь может центрироваться вручную через кнопку
  /*
  useEffect(() => {
    if (userLocation) {
      setCenter([userLocation.latitude, userLocation.longitude]);
    }
  }, [userLocation]);
  */

  // РЕГИОНЫ: раньше автоматически центрировали карту при изменении selectedRegions.
  // Эта логика вызывала «приклеивание» к исходной точке – каждый раз, когда
  // список регионов обновлялся (например, при детекции геолокации), центр
  // сбрасывался. Код оставлен как комментарий для истории и наглядности, но
  // он **не выполняется**. Центрирование теперь делается вручную через
  // RegionSelector или кнопки, поэтому проблема с блокировкой прокрутки
  // приводящая к жалобе исчезла.
  /*
  useEffect(() => {
    if (selectedRegions.length > 0) {
      const primaryRegion = selectedRegions[0];
      try {
        const { getregioncity } = require('../stores/regionCities');
        const regionCityInfo = getregioncity(primaryRegion);
        if (regionCityInfo && regionCityInfo.coordinates) {
          const [lat, lon] = regionCityInfo.coordinates;
          const zoom = regionCityInfo.zoom || 10;
          setCenter([lat, lon]);
          setZoom(zoom);
          setSearchRadiusCenter([lat, lon]);
          console.log(`[Map] Centered on region: ${primaryRegion} at [${lat}, ${lon}]`);
        }
      } catch (error) {
        console.warn('[Map] Could not center on region:', error);
      }
    }
  }, [selectedRegions]);
  */

  useEffect(() => {
    if (userBounds) {
      setMapBounds(userBounds);
    }
  }, [userBounds]);

  // when bounds change or mode toggles we simply ask the hook to reload markers.
  useEffect(() => {
    if (mapBounds) {
      reloadMarkers(mapBounds);
    }
  }, [mapBounds, reloadMarkers]);

  const handleMapBoundsChange = useCallback((bounds: Bounds) => {
    setMapBounds(bounds);
    reloadMarkers(bounds);
  }, [reloadMarkers]);

  const handleLoadingModeToggle = useCallback((useLazy: boolean) => {
    setUseLazyLoading(useLazy);
    // new mode — reload markers appropriately
    reloadMarkers(mapBounds || undefined);
  }, [mapBounds, reloadMarkers]);

  // синхронизируем индикатор загрузки с возвращаемым значением из хука
  useEffect(() => {
    if (markersLoading) {
      try { startLoading(); } catch {};
    } else {
      try { stopLoading(); } catch {};
    }
  }, [markersLoading, startLoading, stopLoading]);

  const handlePlaceSelect = (place: Place) => {
    setFlyToCoordinates(place.coordinates);
    setSearchQuery('');
    // dropdown visibility is controlled by hook
  };

  const handleMarkerSelect = (marker: MarkerData) => {
    if (Number.isFinite(marker.longitude) && Number.isFinite(marker.latitude)) {
      setFlyToCoordinates([marker.latitude, marker.longitude]);
    }
    setSelectedMarkerIdForPopup(marker.id);
    setSearchQuery('');
    setIsDropdownVisible(false);
  };

  // quick-change logic comes from the filters hook
  // (we already aliased `handleQuickCategoryChange` above)

  const handleApply = () => {
    applyFilters();
    setAppliedMapSettings(draftMapSettings);

    // Если используем ленивую загрузку, перезагружаем маркеры с новыми фильтрами
    if (useLazyLoading && mapBounds) {
      reloadMarkers(mapBounds);
    }
  };

  const handleReset = () => {
    resetFilters();
    const defaultMapSettings = {
      mapType: 'light',
      showTraffic: false,
      showBikeLanes: false,
      showHints: true,
      themeColor: 'green',
    };
    setDraftMapSettings(defaultMapSettings);
    setAppliedMapSettings(defaultMapSettings);
  };

  // УДАЛЕН handleMapClick - клик по карте больше НЕ создаёт метки напрямую!
  // Метки создаются только через кнопку + (режим добавления) и временную метку
  const handleMapClick = useCallback(async (coordinates: [number, number]) => {
    // Эта функция больше не используется, так как создание меток теперь происходит
    // только через режим добавления (кнопка + -> клик по карте -> клик по временной метке -> форма)
    // Удаляем эту логику, чтобы избежать случайного создания меток при клике по карте
  }, []);

  const handleHashtagClickFromPopup = useCallback((hashtag: string) => {
    // Убираем '#' из тега, если он есть, для консистентности
    const cleanHashtag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;

    setSelectedHashtags(prevSelected => {
      if (prevSelected.includes(cleanHashtag)) {
        return prevSelected.filter(tag => tag !== cleanHashtag);
      } else {
        return [...prevSelected, cleanHashtag];
      }
    });
  }, []);

  const removeFromFavorites = useCallback((id: string) => {
    try {
      const isRealContext = favoritesContext && !(favoritesContext as any)._isStub;
      if (isRealContext && typeof (favoritesContext as any).removeFavoritePlace === 'function') {
        (favoritesContext as any).removeFavoritePlace(id);
      }
    } catch (err) {
      console.warn('[MapPage] removeFromFavorites error:', err);
    }
  }, [favoritesContext]);

  const favoritesCount = favorites && favorites.length ? favorites.length : 0;

  const handleLoadRoute = (route: any, mode?: 'map' | 'planner') => {
    if (!route || !route.points) return;

    // Переводим точки маршрута в формат RoutePoint и передаём в планировщик
    const routePointsForPlanner = route.points.map((point: any, index: number) => ({
      id: point.id || `route-point-${index}`,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      title: point.title || `Точка ${index + 1}`,
      description: point.description || '',
    }));

    // Сохраняем в контексте планировщика — дальнейшее построение выполняется в Planner
    setRoutePoints?.(routePointsForPlanner);
    // Переключаемся на страницу планировщика — пользователь там явно построит маршрут
    navigate('/planner');
  };

  const handleBuildRoute = (ids: string[]) => {
    // Соблюдаем заданный порядок следования: по порядку ids
    const selectedMarkers = ids
      .map(id => favorites.find((m: { id: string; }) => m.id === id))
      .filter((m): m is MarkerData => Boolean(m));
    // Преобразуем в RoutePoint[] в этом же порядке
    const points: RoutePoint[] = selectedMarkers.map((m) => ({
      id: m.id,
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      title: m.title,
      description: m.description,
    }));
    setRoutePoints?.(points);
    // Синхронизируем выбор чекбоксов через глобальный контекст
    try { setSelectedMarkerIds(Array.isArray(ids) ? ids : []); } catch { }
    setTimeout(() => {
      navigate('/planner');
    }, 150);
  };

  // Перенос выбранных меток в планировщик без немедленного построения маршрута
  const handleMoveToPlanner = (ids: string[]) => {
    const selectedMarkers = ids
      .map(id => favorites.find((m: { id: string; }) => m.id === id))
      .filter((m): m is MarkerData => Boolean(m));
    const points: RoutePoint[] = selectedMarkers.map((m) => ({
      id: m.id,
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      title: m.title,
      description: m.description,
    }));
    setRoutePoints?.(points);
    // Пишем напрямую в контекст выбранные ID, без localStorage
    try { setSelectedMarkerIds(Array.isArray(ids) ? ids : []); } catch { }
    // Переход в планировщик - Sidebar сам откроет панель при навигации
    navigate('/planner');
  };

  // Отображение маршрута по чекбоксу из избранного (режим карты)
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [activeFavoriteRoutes, setActiveFavoriteRoutes] = useState<Map<string, any>>(new Map());
  
  const handleRouteToggleFromFavorites = async (route: any, checked: boolean) => {
    if (!route || !route.id) return;
    
    const routeId = route.id;
    
    if (checked) {
      // Добавляем маршрут в активные маршруты для отображения на карте
      setActiveFavoriteRoutes(prev => {
        const newMap = new Map(prev);
        newMap.set(routeId, route);
        return newMap;
      });
      
      // Извлекаем точки маршрута
      const routePoints = route.points || [];
      if (routePoints.length >= 2) {
        // Нормализуем точки в формат [lat, lon]
        const normalizedPoints: [number, number][] = routePoints
          .map((p: any) => {
            const lat = Number(p?.latitude ?? p?.lat);
            const lon = Number(p?.longitude ?? p?.lon ?? p?.lng);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              return [lat, lon] as [number, number];
            }
            return null;
          })
          .filter((p: [number, number] | null): p is [number, number] => p !== null);
        
        if (normalizedPoints.length >= 2) {
          // Устанавливаем данные маршрута для отображения на карте
          // Используем polyline вместо geometry для совместимости с типами
          setRouteData({
            id: `fav-route-${routeId}`,
            title: route.title || 'Маршрут из избранного',
            polyline: normalizedPoints,
            markers: [],
          });
          
          // Центрируем карту на первой точке маршрута
          setCenter(normalizedPoints[0]);
          setZoom(12);
        }
      }
      
      console.log('[Map] Route displayed from favorites:', routeId);
    } else {
      // Удаляем маршрут из активных
      setActiveFavoriteRoutes(prev => {
        const newMap = new Map(prev);
        newMap.delete(routeId);
        return newMap;
      });
      
      // Скрываем маршрут с карты
      setRouteData(null);
      setRouteModalOpen(false);
      
      console.log('[Map] Route hidden from favorites:', routeId);
    }
  };

  // КРИТИЧНО: Синхронизация selectedRouteIds с отображением маршрутов на карте
  // Это позволяет отображать маршруты выбранные на странице Favorites.tsx
  const prevSelectedRouteIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevSelectedRouteIdsRef.current;
    const currentIds = selectedRouteIds;
    
    // Определяем добавленные и удалённые ID
    const addedIds = currentIds.filter((id: string) => !prevIds.includes(id));
    const removedIds = prevIds.filter((id: string) => !currentIds.includes(id));
    
    prevSelectedRouteIdsRef.current = currentIds;
    
    // Обрабатываем добавленные маршруты
    addedIds.forEach((routeId: string) => {
      // Ищем маршрут в favoriteRoutes
      const route = routes.find((r: RouteData) => r.id === routeId);
      if (route) {
        handleRouteToggleFromFavorites(route, true);
      }
    });
    
    // Обрабатываем удалённые маршруты
    removedIds.forEach((routeId: string) => {
      // Скрываем маршрут с карты
      if (routeData?.id === `fav-route-${routeId}`) {
        setRouteData(null);
        setActiveFavoriteRoutes(prev => {
          const newMap = new Map(prev);
          newMap.delete(routeId);
          return newMap;
        });
      }
    });
    
    console.log('[Map] selectedRouteIds changed:', { addedIds, removedIds, currentIds });
  }, [selectedRouteIds, routes]);

  // Функция для передачи данных метки в блог
  const handleAddMarkerToBlog = (marker: MarkerData) => {
    // Передаем данные метки в контекст
    setMarkerDataForBlog?.({
      id: marker.id,
      title: marker.title,
      description: marker.description,
      latitude: Number(marker.latitude),
      longitude: Number(marker.longitude),
      category: marker.category,
      address: marker.address,
      hashtags: marker.hashtags,
      photoUrls: marker.photo_urls
    });

    // Открываем двухоконный режим: карта слева, посты справа
    openLeftPanel('map');
    openRightPanel('posts');
  };

  // Функция для показа всех маркеров
  const handleShowAllMarkers = () => {
    // Больше не очищаем глобальный выбор здесь, это делается только в настройках карты
  };

  // Центр поиска/радиуса - зависит от режима геолокации
  // В режиме 'auto' - используем местоположение пользователя
  // В режиме 'manual' - используем текущий центр карты
  const [manualSearchRadiusCenter, setManualSearchRadiusCenter] = useState<[number, number]>([56.1366, 40.3966]);
  
  // Вычисляем searchRadiusCenter на основе режима
  const searchRadiusCenter = useMemo<[number, number]>(() => {
    if (locationMode === 'auto' && userLocation) {
      return [userLocation.latitude, userLocation.longitude];
    }
    return manualSearchRadiusCenter;
  }, [locationMode, userLocation, manualSearchRadiusCenter]);

  // Обновляем manualSearchRadiusCenter когда пользователь перемещает карту в ручном режиме
  const handleSearchRadiusCenterChange = useCallback((newCenter: [number, number]) => {
    if (locationMode === 'manual') {
      setManualSearchRadiusCenter(newCenter);
    }
    // В режиме 'auto' searchRadiusCenter автоматически обновляется через useMemo
  }, [locationMode]);

  // Оптимизация: мемоизация фильтрованных маркеров
  const filteredMarkers = useMemo(() => {
    // Защитная проверка: убеждаемся что allMarkers это массив
    const markers = Array.isArray(allMarkers) ? allMarkers : [];
    
    // Источник маркеров определяется одним массивом из хука;
    // ленивый режим уже реализован внутри самого хука.
    let result = markers;

    // Логируем количество маркеров для отладки
    console.log('[MapPage] Filtering markers:', {
      source: useLazyLoading ? 'lazy' : 'all',
      count: result.length,
      selectedRegions: selectedRegions.length
    });

    // Добавляем черновики меток для временного отображения (только для автора)
    if (auth?.user?.id && pendingMarkerDrafts.length > 0) {
      result = [...result, ...pendingMarkerDrafts];
    }

    // КРИТИЧНО: Фильтрация по регионам ОТКЛЮЧЕНА по умолчанию
    // Это позволяет показывать все метки на карте без ограничений
    // Фильтрация по регионам будет применяться только если пользователь явно выбрал регион
    // И мы хотим фильтровать (например, через настройки)
    // if (selectedRegions.length > 0) {
    //   result = result.filter(marker => {
    //     if (marker.address) {
    //       const markerRegionId = getRegionIdByName(marker.address);
    //       if (markerRegionId && selectedRegions.includes(markerRegionId)) {
    //         return true;
    //       }
    //     }
    //     return true; // Показываем метки без адреса или с неопределённым регионом
    //   });
    // }

    // Добавляем выбранные метки из избранного, которых еще нет на карте
    const selectedFavorites = selectedMarkerIds
      .filter(id => !result.find(m => m.id === id))
      .map(id => favorites.find(m => m.id === id))
      .filter(Boolean) as MarkerData[];

    if (selectedFavorites.length > 0) {
      result = [...result, ...selectedFavorites];
    }

    // Фильтр по хэштегам
    if (selectedHashtags.length > 0) {
      if (filterLogic === 'AND') {
        result = result.filter(marker =>
          selectedHashtags.every(tag =>
            (marker.hashtags || []).some(markerTag =>
              (markerTag || '').toLowerCase().includes(tag.toLowerCase())
            )
          )
        );
      } else {
        result = result.filter(marker =>
          selectedHashtags.some(tag =>
            (marker.hashtags || []).some(markerTag =>
              (markerTag || '').toLowerCase().includes(tag.toLowerCase())
            )
          )
        );
      }
    }

    // Фильтр по поиску
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(marker =>
        (marker.title || '').toLowerCase().includes(q) ||
        (marker.description || '').toLowerCase().includes(q) ||
        (marker.hashtags || []).some(tag => (tag || '').toLowerCase().includes(q))
      );
    }

    // Фильтр по пресетам
    if (activePreset) {
      switch (activePreset) {
        case 'popular':
          result = result.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
          break;

        case 'new':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          result = result.filter(marker => new Date(marker.created_at) > weekAgo);
          break;

        case 'nearby':
          // Фильтр "Рядом" - будет реализован с использованием геолокации пользователя
          // Пока оставляем все маркеры, фильтрация будет добавлена позже
          break;

        case 'interests':
          // Фильтр "По интересам" - будет реализован на основе предпочтений пользователя
          // Пока оставляем все маркеры, фильтрация будет добавлена позже
          break;

        default:
          break;
      }
    }

    // Фильтр по категориям - показываем все маркеры, если категории не выбраны.
    // 'event' — специальная категория для событий, не фильтрует обычные метки
    if (appliedFilters.categories && appliedFilters.categories.length > 0) {
      const regularCategoryFilter = appliedFilters.categories.filter(c => c !== 'event');
      if (regularCategoryFilter.length > 0) {
        result = result.filter(marker =>
          regularCategoryFilter.includes(marker.category)
        );
      }
    }

    // Фильтр по радиусу
    if (appliedFilters.radiusOn) {
      result = result.filter(marker => {
        if (!searchRadiusCenter) return true;

        const distance = getDistanceFromLatLonInKm(
          searchRadiusCenter[0],
          searchRadiusCenter[1],
          marker.latitude,
          marker.longitude
        );

        return distance <= appliedFilters.radius;
      });
    }

    return result;
  }, [allMarkers, pendingMarkerDrafts, auth?.user?.id, selectedHashtags, filterLogic, searchQuery, activePreset, appliedFilters, searchRadiusCenter, selectedMarkerIds, favorites, selectedRegions]);

  // Загружаем счётчик модерации
  useEffect(() => {
    if (isAdmin) {
      const counts = getPendingContentCounts();
      setModerationCount(counts.marker);
    }
  }, [isAdmin]);

  // Загружаем черновики меток для временного отображения
  useEffect(() => {
    if (!auth?.user?.id) return; // Только для авторизованных пользователей

    const loadPendingMarkers = async () => {
      try {
        await offlineContentStorage.init();
        // Получаем черновики меток со статусом draft, uploading или failed
        const drafts = await offlineContentStorage.getAllDrafts('marker');

        // Преобразуем черновики в MarkerData для отображения на карте
        const markerDrafts: MarkerData[] = drafts
          .filter((draft): draft is OfflineMarkerDraft => draft.contentType === 'marker' && draft.status !== 'failed_permanent')
          .map((draft) => {
            const { contentData, id, createdAt } = draft;

            // Создаём временные URL для изображений, если есть
            const photoUrls: string[] = [];
            if (draft.images && draft.images.length > 0) {
              draft.images.forEach(file => {
                try {
                  photoUrls.push(URL.createObjectURL(file));
                } catch (e) {
                  console.warn('Ошибка создания URL для изображения:', e);
                }
              });
            }

            return {
              id: `draft_${id}`, // Префикс для отличия от обычных меток
              latitude: contentData.latitude,
              longitude: contentData.longitude,
              title: contentData.title || 'Новая метка',
              description: contentData.description || '',
              address: contentData.address,
              category: contentData.category || 'other',
              rating: 0,
              rating_count: 0,
              photo_urls: photoUrls,
              hashtags: contentData.hashtags || [],
              author_name: auth.user?.username || auth.user?.email || 'Вы',
              created_at: new Date(createdAt).toISOString(),
              updated_at: new Date(createdAt).toISOString(),
              likes_count: 0,
              comments_count: 0,
              shares_count: 0,
              status: 'pending',
              is_pending: true,
              is_draft: true,
              // Сохраняем оригинальный ID черновика для дальнейшей работы
              metadata: { draftId: id, draftStatus: draft.status }
            } as MarkerData;
          });

        setPendingMarkerDrafts(markerDrafts);
      } catch (error) {
        console.error('Ошибка загрузки черновиков меток:', error);
      }
    };

    loadPendingMarkers();

    // Подписываемся на изменения черновиков (можно добавить через события или polling)
    const interval = setInterval(loadPendingMarkers, 10000); // Обновляем каждые 10 секунд

    return () => {
      clearInterval(interval);
      // Очищаем созданные URL для изображений.
      // Используем setPendingMarkerDrafts с чтением текущего state чтобы избежать stale closure
      setPendingMarkerDrafts(current => {
        current.forEach(marker => {
          marker.photo_urls?.forEach((url: string) => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          });
        });
        return current; // не меняем state, только читаем
      });
    };
  }, [auth?.user?.id]);

  // Объединяем обычные маркеры с маркерами модерации
  // Используем только отфильтрованные маркеры (без модерации на карте)
  const allMarkersWithModeration = filteredMarkers;

  // Синхронизируем метки с mapFacade (в useEffect чтобы избежать сайд-эффектов в рендере)
  useEffect(() => {
    // debounce updates so that clicking UI controls rapidly doesn't
    // flood the map with synchronous work
    let handle: number | null = null;
    const sync = () => {
      try {
        projectManager.updateMarkers(allMarkersWithModeration);
        console.debug('[MapPage] External markers synchronized to facade:', allMarkersWithModeration.length);
      } catch (err) {
        console.warn('[MapPage] Failed to update facade external markers:', err);
      }
    };
    handle = window.setTimeout(sync, 0);
    return () => {
      if (handle !== null) {
        clearTimeout(handle);
      }
    };
  }, [allMarkersWithModeration]);

  // Раньше здесь автоматически открывалась левая панель с картой при монтировании
  // страницы, что приводило к нежелательной предзагрузке карты. Оставляем
  // управление открытием панели за явными действиями (пользователь или
  // другие контроллеры через `openLeftPanel` / `setLeftContent`).
  return (
    <>
    <MirrorGradientContainer className="page-layout-container page-container map-mode" style={{ pointerEvents: 'none' }}>
      <div className="page-main-area" style={{ pointerEvents: 'none' }}>
        <div className="page-content-wrapper" style={{ pointerEvents: 'none' }}>
          <div className="page-main-panel relative" style={{ background: 'transparent', borderRadius: 0, pointerEvents: 'none' }}>
            {/* Стеклянный блок с инструментами: Поиск + RegionSelector
                ВАЖНО: Вынесен за пределы MapContainer чтобы выпадающий список не обрезался
                Стиль: тёмное матовое стекло */}
            <div
              className="absolute flex items-center gap-3 map-search-toolbar glass-l1"
              style={{
                // Отступ сверху: ниже topbar + отступ
                top: isTwoPanelMode ? 'calc(var(--topbar-height, 64px) + 16px)' : 'calc(var(--topbar-height, 64px) + 16px)',
                // В двухоконном режиме центр активной зоны карты = 25% от левого края
                // В одноэкранном режиме - по центру (50%)
                left: isTwoPanelMode ? '25%' : '50%',
                transform: 'translateX(-50%)',
                borderRadius: '16px',
                padding: '8px 16px',
                transition: 'left 0.3s ease-in-out, top 0.3s ease-in-out',
                zIndex: 10,
                // Включаем события мыши для этого блока
                pointerEvents: 'auto'
              }}
            >
              {/* Поиск */}
              <div className="relative" style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Адрес или объект"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchQuery.length > 0) setIsDropdownVisible(true); }}
                  onBlur={() => {
                    setTimeout(() => setIsDropdownVisible(false), 200);
                  }}
                  ref={inputRef}
                  className="dark-glass-input glass-l2"
                  style={{
                    padding: '8px 16px 8px 40px',
                    outline: 'none',
                    fontSize: '14px',
                    width: '280px',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    color: 'var(--glass-text)',
                    caretColor: 'var(--glass-text)'
                  }}
                />
                <FaSearch
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--glass-card-text-secondary)',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={() => {
                    // Логика поиска
                  }}
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px 14px',
                    background: 'rgba(76, 201, 240, 0.9)',
                    color: '#000',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'background 0.2s',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                >
                  Найти
                </button>
                {isDropdownVisible && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10000,
                    marginTop: '4px'
                  }}>
                    <SearchResultsDropdown
                      loading={isSearchLoading}
                      places={geocodingResults}
                      markers={filteredMarkersForSearch}
                      onPlaceSelect={handlePlaceSelect}
                      onMarkerSelect={handleMarkerSelect}
                    />
                  </div>
                )}
              </div>

              {/* Селектор регионов */}
              <RegionSelector />

              {/* Кнопка перехода в PRO раздел офлайн-карт */}
              <button
                onClick={() => window.location.href = '/pro'}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 map-offline-btn glass-l2"
                title="Офлайн-карты (PRO)"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                }}
              >
                <FaDownload className="w-4 h-4" style={{ color: '#60a5fa' }} />
                <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#60a5fa' }}>
                  Офлайн
                </span>
              </button>
            </div>

            {/* Виджет быстрого выбора категорий — всегда виден на карте */}
            {!(isAddingMarkerMode || isAddingEventMode || addSelectorOpen || isCreationPanelOpen) && (
              <CategoryQuickFilter
                selectedCategories={appliedFilters.categories}
                onCategoriesChange={handleQuickCategoryChange}
                isTwoPanelMode={isTwoPanelMode}
              />
            )}

            {/* Кнопки действий карты — ВСЕГДА видны на карте, рендерим вне портала для корректного z-index */}
            <MapActionButtons
              onSettingsClick={() => setSettingsOpen(true)}
              onLegendClick={() => setLegendOpen(true)}
              onAddClick={handleAddClick}
              isAddingMode={isAddingMarkerMode || isAddingEventMode || addSelectorOpen}
              isTwoPanelMode={isTwoPanelMode}
              locationMode={locationMode}
              onLocationModeToggle={toggleLocationMode}
            />

            {/* Предвыбор типа добавляемого объекта */}
            <MapAddSelector
              isOpen={addSelectorOpen}
              onSelect={handleAddModeSelect}
              onClose={() => setAddSelectorOpen(false)}
            />
            {/* Область карты (рендерим в portal, чтобы избежать обрезания родительскими панелями) */}
            {typeof document !== 'undefined' && facadeMapRootEl && ReactDOM.createPortal(
              <MapContainer
                className={`facade-map-root map-area ${isTwoPanelMode ? 'two-panel-mode' : 'single-panel-mode'}`}
              >

                {/* MapActionButtons рендерятся вне портала — выше по дереву */}

                {/* Индикатор загрузки геолокации убран - геолокация работает в фоне, не блокирует карту */}

                {markersLoading && (
                  <div className="absolute top-4 right-4 z-10 rounded-lg px-4 py-2 flex items-center space-x-2 glass-l2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm" style={{ color: 'var(--glass-text-secondary)' }}>Загрузка маркеров...</span>
                  </div>
                )}

                {/* Информация о местоположении */}

                {/* Сообщение об ошибке геолокации - убрано, геолокация опциональна */}
                {/* Карта работает с дефолтным местоположением (Москва) без показа ошибок */}

                <MapComponent
                  center={center}
                  zoom={zoom}
                  radius={appliedFilters.radius}
                  markers={allMarkersWithModeration}
                  onHashtagClickFromPopup={handleHashtagClickFromPopup}
                  flyToCoordinates={flyToCoordinates}
                  selectedMarkerIdForPopup={selectedMarkerIdForPopup}
                  setSelectedMarkerIdForPopup={setSelectedMarkerIdForPopup}
                  onAddToFavorites={addToFavorites}
                  onRemoveFromFavorites={(id: string) => {
                    try { (favoritesContext as any)?.removeFavoritePlace?.(id); } catch (e) { }
                  }}
                  setSelectedMarkerIds={(ids: string[]) => {
                    try { setSelectedMarkerIds(Array.isArray(ids) ? ids : []); } catch (e) { }
                  }}
                  onFavoritesClick={() => {
                    navigate('/favorites');
                  }}
                  favoritesCount={favoritesCount}
                  isFavorite={marker => {
                    const isFav = favorites.some((m: { id: string; }) => m.id === marker.id);
                    return isFav;
                  }}
                  mapSettings={appliedMapSettings}
                  zones={showZonesLayer ? zones : []}
                  filters={appliedFilters}
                  searchRadiusCenter={searchRadiusCenter}
                  onSearchRadiusCenterChange={handleSearchRadiusCenterChange}
                  selectedMarkerIds={selectedMarkerIds}
                  onAddToBlog={handleAddMarkerToBlog}
                  onBoundsChange={handleMapBoundsChange}
                  routeData={routeData}
                  isAddingMarkerMode={isAddingMarkerMode}
                  onAddMarkerModeChange={setIsAddingMarkerMode}
                  isAddingEventMode={isAddingEventMode}
                  onAddingEventModeChange={setIsAddingEventMode}
                  onCreationPanelVisibilityChange={setIsCreationPanelOpen}
                  legendOpen={legendOpen}
                  onLegendOpenChange={setLegendOpen}
                />
              </MapContainer>,
              facadeMapRootEl
            )}

            {/* Левая выдвигающаяся панель с настройками */}
            {/* Левая панель настроек в стиле стекла */}
            <GlassPanel
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              position="left"
              width="400px"
              closeOnOverlayClick={true}
              showCloseButton={false}
              className={`map-settings-panel${isDarkMode ? ' dark' : ''}`}
              constrainToMapArea={isTwoPanelMode}
            >
              <MapFilters
                filters={draftFilters}
                onFiltersChange={setDraftFilters}
                mapSettings={draftMapSettings}
                onMapSettingsChange={setDraftMapSettings}
                onApply={handleApply}
                onReset={handleReset}
                onShowAllMarkers={handleShowAllMarkers}
                onClose={() => setSettingsOpen(false)}
                useLazyLoading={useLazyLoading}
                onLoadingModeToggle={handleLoadingModeToggle}
              />
            </GlassPanel>

            {/* Правая выдвигающаяся панель с избранным удалена, так как избранное теперь отдельная страница /favorites */}

            {/* Кнопка модерации для админа */}
            {
              isAdmin && !showModerationModal && (
                <button
                  onClick={() => setShowModerationModal(true)}
                  className="fixed right-4 top-20 z-40 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                  title="Модерация меток"
                >
                  <span>📋</span>
                  <span>Модерация</span>
                  {moderationCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {moderationCount}
                    </span>
                  )}
                </button>
              )
            }

            {/* Модальное окно модерации */}
            {
              isAdmin && (
                <AdminModerationModal
                  isOpen={showModerationModal}
                  onClose={() => setShowModerationModal(false)}
                  contentType="marker"
                  onContentApproved={(contentId) => {
                    // Перезагружаем маркеры после одобрения
                    reloadMarkers(mapBounds || undefined);
                    // Обновляем счётчик
                    const counts = getPendingContentCounts();
                    setModerationCount(counts.marker);
                  }}
                  onTaskClick={(content) => {
                    // Если у контента есть координаты, центрируем карту
                    if (content.data.latitude && content.data.longitude) {
                      setCenter([content.data.latitude, content.data.longitude]);
                      setZoom(15);
                    }
                  }}
                />
              )
            }
          </div >
        </div >
      </div >
    </MirrorGradientContainer >

    {/* Панель детальной информации о событии — открывается при клике на маркер события на карте
        Показывается ТОЛЬКО когда календарь не активен в правой панели (иначе EventDetailPage
        показывается внутри самого TravelCalendar поверх его фона) */}
    {selectedEventForDetail && rightContent !== 'calendar' && (() => {
      const externalEvent = selectedEventForDetail;
      if (!externalEvent) return null;
      return (
        <GlassPanel
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
          position="right"
          width="480px"
          closeOnOverlayClick={true}
          showCloseButton={false}
          className={`map-event-detail-panel${isDarkMode ? ' dark' : ''}`}
        >
          <Suspense fallback={<div style={{ padding: 24, color: 'var(--glass-text)' }}>Загрузка...</div>}>
            <LazyEventDetailPage
              event={externalEvent}
              onClose={() => setSelectedEvent(null)}
              onBack={() => setSelectedEvent(null)}
              standalone={true}
            />
          </Suspense>
        </GlassPanel>
      );
    })()}

    </>
  );
};

export default MapPage;
