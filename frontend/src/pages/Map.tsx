import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FilterLogic } from '../components/HashtagFilter';
import { MarkerData } from '../types/marker';
import { projectManager } from '../services/projectManager';
import { geocodingService, Place } from '../services/geocodingService';
import SearchResultsDropdown from '../components/Search/SearchResultsDropdown';
import { useLazyMarkers, Bounds } from '../hooks/useLazyMarkers';
import { mapFacade, INTERNAL } from '../services/map_facade/index';
import { useUserLocation } from '../hooks/useUserLocation';
// КРИТИЧНО: Централизованное хранилище маркеров - решает проблему потери маркеров
import { useMapStateStore, mapStateHelpers } from '../stores/mapStateStore';

import {
  FaStar, FaMap, FaCog, FaSearch, FaRoute
} from 'react-icons/fa';
import FavoritesPanel from '../components/FavoritesPanel';
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
import { useGuest } from '../contexts/GuestContext';
import { useAuth } from '../contexts/AuthContext';
import { getAllZones, checkPoint } from '../services/zoneService';
import { getDistanceFromLatLonInKm } from '../utils/russiaBounds';
import '../styles/GlobalStyles.css';
import '../styles/PageLayout.css';
import '../styles/PersistentMap.css';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
import { getPendingContentCounts } from '../services/localModerationStorage';
import { offlineContentStorage, OfflineMarkerDraft } from '../services/offlineContentStorage';

import MapComponent from '../components/Map/Map';
import { MapContainer } from '../components/Map/Map.styles';

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

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
  const guest = useGuest();
  const auth = useAuth();
  const isGuest = !auth?.user;
  const isAdmin = auth?.user?.role === 'admin';
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);

  // Регистрируем панели при монтировании компонента
  useEffect(() => {
    registerPanel(); // Левая панель с настройками
    registerPanel(); // Правая панель с избранным
    return () => {
      unregisterPanel(); // Левая панель
      unregisterPanel(); // Правая панель
    };
  }, [registerPanel, unregisterPanel]);

  useEffect(() => {
    console.log('[MapPage] mounted');
    return () => {
      console.log('[MapPage] unmounted');
    };
  }, []);

  // Загрузка запрещенных зон для отрисовки
  useEffect(() => {
    getAllZones().then(setZones).catch(() => { });
  }, []);

  // Состояние для выдвигающихся панелей
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isAddingMarkerMode, setIsAddingMarkerMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleRecordTrackClick = useCallback(async () => {
    if (!isRecording) {
      try {
        mapFacade().startTracking();
        setIsRecording(true);
      } catch (e: any) {
        // best-effort notify
        console.error('startTracking error', e);
      }
      return;
    }

    try {
      const track = await mapFacade().stopTracking();
      setIsRecording(false);
      // Open post constructor or show quick modal to save/attach
      // For now, navigate to profile routes or show notification
      // mapFacade will save draft and notify; optionally handle returned track
      console.log('Track recorded', track);
    } catch (e) {
      console.error('stopTracking error', e);
    }
  }, [isRecording]);

  const favoritesContext = useFavorites();
  const favoritesOpen = (favoritesContext as any)?.favoritesOpen ?? false;
  const setFavoritesOpen = (favoritesContext as any)?.setFavoritesOpen ?? (() => { });

  // Отладочная информация (только в dev режиме)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    }
  }, [favoritesOpen, favoritesContext]);

  const [zones, setZones] = useState<Array<{ severity?: string; polygons: number[][][]; name?: string; type?: string }>>([]);
  const [showZonesLayer, setShowZonesLayer] = useState(false);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [filterLogic] = useState<FilterLogic>('OR');
  const [allMarkers, setAllMarkers] = useState<MarkerData[]>([]);
  const [pendingMarkerDrafts, setPendingMarkerDrafts] = useState<MarkerData[]>([]);
  const [activePreset] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // КРИТИЧНО: Восстанавливаем маркеры из centralized store при возврате на страницу
  // Это решает проблему "маркеры теряются после переключения на Planner и обратно"
  const cachedMarkers = useMapStateStore((state) => state.globalMarkers);
  const markersLoaded = useMapStateStore((state) => state.markersLoaded);

  useEffect(() => {
    // Если маркеры уже загружены в store, но не в локальном state - восстанавливаем
    if (markersLoaded && cachedMarkers.length > 0 && allMarkers.length === 0) {
      console.log('[MapPage] Restoring markers from cache:', cachedMarkers.length);
      // Преобразуем обратно в MarkerData формат
      const restoredMarkers: MarkerData[] = cachedMarkers.map((m: any) => ({
        id: m.id,
        latitude: m.lat,
        longitude: m.lon,
        title: m.title || m.name,
        description: m.description || '',
        category: m.category || 'other',
      } as MarkerData));
      setAllMarkers(restoredMarkers);

      // Previously we passed restored markers to the facade here. That caused duplicate markers
      // to be shown when both the facade renderer and the Map component added markers to the map.
      // To avoid duplicates, we no longer update the facade from this page — Map is the source
      // of truth for rendering markers via the `markers` prop.
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

  // Состояние для ленивой загрузки
  const [useLazyLoading, setUseLazyLoading] = useState(false);
  const [mapBounds, setMapBounds] = useState<Bounds | null>(userBounds);

  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const [geocodingResults, setGeocodingResults] = useState<Place[]>([]);
  const [filteredMarkersForSearch, setFilteredMarkersForSearch] = useState<MarkerData[]>([]);

  const [flyToCoordinates, setFlyToCoordinates] = useState<[number, number] | null>(null);
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  // Состояния для выбранных меток (чекбоксы)
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<string[]>([]);

  // Состояния для избранного
  const [favorites, setFavorites] = useState<MarkerData[]>([]);
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
  const searchLoadingRef = useRef(false);
  const lazyLoadingRef = useRef(false);
  const loadingStartRef = useRef(false);

  // ИСПРАВЛЕНО: Используем store для двухпанельного режима
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const isTwoPanelMode = rightContent !== null;

  // Заглушки для функций, чтобы не было ошибок компиляции
  // (заменить на реальные импорты/контексты при интеграции)
  const startLoading = () => { };
  const stopLoading = () => { };
  const setMarkerDataForBlog = (_?: any) => { };
  const setRoutePoints = (_?: any) => { };
  const openLeftPanel = (_?: any) => { };
  const openRightPanel = (_?: any) => { };
  const navigate = (_?: any) => { };

  // addToFavoritesContext заглушка
  const addToFavoritesContext = undefined;

  // Экспорт компонента


  // Получаем маршруты из FavoritesContext
  const { favoriteRoutes } = favoritesContext || { favoriteRoutes: [] };

  // Преобразуем FavoriteRoute в RouteData для совместимости
  const routes: RouteData[] = favoriteRoutes.map(route => ({
    id: route.id,
    title: route.title,
    description: '',
    points: route.points || [],
    waypoints: [],
    createdAt: route.addedAt.toISOString(),
    updatedAt: route.addedAt.toISOString()
  } as RouteData));

  // Черновики (draft) — то, что меняет пользователь в фильтрах/настройках
  const [draftFilters, setDraftFilters] = useState<{
    categories: string[];
    radiusOn: boolean;
    radius: number;
    preset: string | null;
  }>({
    categories: [],
    radiusOn: false,
    radius: 10,
    preset: null,
  });
  const [draftMapSettings, setDraftMapSettings] = useState({
    mapType: 'light',
    showTraffic: false,
    showBikeLanes: false,
    showHints: true,
    themeColor: 'green',
  });

  // Применённые (applied) — то, что реально отображается на карте
  const [appliedFilters, setAppliedFilters] = useState<{
    categories: string[];
    radiusOn: boolean;
    radius: number;
    preset: string | null;
  }>(draftFilters);
  const [appliedMapSettings, setAppliedMapSettings] = useState(draftMapSettings);

  // Ленивая загрузка маркеров
  const {
    markers: lazyMarkers,
    loading: lazyLoading,
    loadMarkers,
    reloadMarkers
  } = useLazyMarkers({
    categories: appliedFilters.categories,
    limit: 100
  });

  // Перезагружаем маркеры при изменении фильтров
  useEffect(() => {
    if (useLazyLoading && mapBounds) {
      reloadMarkers(mapBounds);
    }
  }, [appliedFilters.categories, useLazyLoading, mapBounds, reloadMarkers]);

  const addToFavorites = (marker: MarkerData) => {
    // Используем функцию из контекста, если она доступна
    // Контекст не используется, только локальная логика

    // Fallback на старую логику, если контекст недоступен
    setFavorites((prev: MarkerData[]) => {
      // Проверяем только по ID - это основная проверка на дубликаты
      const idExists = prev.some(m => m.id === marker.id);
      if (idExists) {
        return prev;
      }

      // Проверяем, что у метки есть ID
      if (!marker.id) {
        return prev;
      }

      return [...prev, marker];
    });
  };

  // Загружаем маркеры при инициализации (только если НЕ используется ленивая загрузка)
  useEffect(() => {
    // В ленивом режиме не загружаем все маркеры сразу
    if (useLazyLoading) {
      console.log('[MapPage] Skipping marker load - using lazy loading');
      return;
    }

    const fetchMarkers = async () => {
      console.log('[MapPage] Starting to fetch markers...');
      loadingStartRef.current = true;
      try {
        startLoading();
        // КРИТИЧНО: используем loadAllMarkers вместо getMarkers 
        // getMarkers() это синхронный метод который возвращает уже загруженные маркеры
        // loadAllMarkers() это асинхронный метод который реально загружает с сервера
        const fetched = await projectManager.loadAllMarkers();
        console.log('[MapPage] Fetched markers:', fetched?.length || 0);
        setAllMarkers(fetched || []);
      } catch (error: any) {
        console.error('[MapPage] Failed to load markers:', error);
        setAllMarkers([]);
      } finally {
        if (loadingStartRef.current) {
          stopLoading();
          loadingStartRef.current = false;
        }
      }
    };
    fetchMarkers();
  }, [useLazyLoading]); // Добавляем зависимость от useLazyLoading

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
      if (selectedMarker) {
        setSelectedMarkerIdForPopup(selectedMarkerId);
        setCenter([selectedMarker.latitude, selectedMarker.longitude]);
        setZoom(15);
        // Если showOnlySelected, скрываем панели
        if (showOnlySelected) {
          setSettingsOpen(false);
          setFavoritesOpen(false);
        }
      }
    }
  }, [selectedMarkerId, allMarkers, showOnlySelected]);

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

  // ОТКЛЮЧЕНО: Автоматическое центрирование при изменении региона
  // Это вызывало сброс состояния карты при переключении Map <-> Planner
  // Центрирование теперь происходит только при первой загрузке или по запросу пользователя
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

  // Инициализация маркеров при загрузке страницы (только для ленивого режима)
  useEffect(() => {
    if (useLazyLoading && mapBounds) {
      loadMarkers(mapBounds);
    }
  }, [useLazyLoading, mapBounds, loadMarkers]);

  // Обработчик изменения границ карты для ленивой загрузки
  const handleMapBoundsChange = useCallback((bounds: Bounds) => {
    setMapBounds(bounds);
    if (useLazyLoading) {
      loadMarkers(bounds);
    }
  }, [useLazyLoading, loadMarkers]);

  // Обработчик переключения режима загрузки
  const handleLoadingModeToggle = useCallback((useLazy: boolean) => {
    setUseLazyLoading(useLazy);
    if (useLazy && mapBounds) {
      // Переключаемся на ленивую загрузку - загружаем маркеры для текущей области
      loadMarkers(mapBounds);
    } else if (!useLazy) {
      // Переключаемся на полную загрузку - загружаем все маркеры
      const fetchAllMarkers = async () => {
        try {
          const fetched = await projectManager.getMarkers();
          setAllMarkers(fetched);
        } catch (error) {
        }
      };
      fetchAllMarkers();
    }
  }, [mapBounds, loadMarkers]);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearchQuery.length < 3) {
        setGeocodingResults([]);
        setFilteredMarkersForSearch([]);
        setIsDropdownVisible(false);
        return;
      }

      setIsSearchLoading(true);
      setIsDropdownVisible(true);
      // mark global loading for search
      searchLoadingRef.current = true;
      try { startLoading(); } catch (e) { }

      // Запускаем оба поиска одновременно
      const placesPromise = geocodingService.searchPlaces(debouncedSearchQuery);

      const q = debouncedSearchQuery.toLowerCase();
      const markersPromise = Promise.resolve(
        allMarkers.filter(marker => (marker.title || '').toLowerCase().includes(q))
      );

      const [places, markers] = await Promise.all([placesPromise, markersPromise]);

      setGeocodingResults(places);
      setFilteredMarkersForSearch(markers);
      setIsSearchLoading(false);
      if (searchLoadingRef.current) {
        try { stopLoading(); } catch (e) { }
        searchLoadingRef.current = false;
      }
    };

    performSearch();
  }, [debouncedSearchQuery, allMarkers]);

  // Синхронизируем глобальный loading с lazyLoading из хука маркеров
  useEffect(() => {
    if (useLazyLoading && lazyLoading) {
      if (!lazyLoadingRef.current) {
        try { startLoading(); } catch (e) { }
        lazyLoadingRef.current = true;
      }
    } else {
      if (lazyLoadingRef.current) {
        try { stopLoading(); } catch (e) { }
        lazyLoadingRef.current = false;
      }
    }
  }, [useLazyLoading, lazyLoading, startLoading, stopLoading]);

  const handlePlaceSelect = (place: Place) => {
    setFlyToCoordinates(place.coordinates);
    setSearchQuery('');
    setIsDropdownVisible(false);
  };

  const handleMarkerSelect = (marker: MarkerData) => {
    setFlyToCoordinates([marker.longitude, marker.latitude]);
    setSelectedMarkerIdForPopup(marker.id);
    setSearchQuery('');
    setIsDropdownVisible(false);
  };

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setAppliedMapSettings(draftMapSettings);

    // Если используем ленивую загрузку, перезагружаем маркеры с новыми фильтрами
    if (useLazyLoading && mapBounds) {
      reloadMarkers(mapBounds);
    }
  };

  const handleReset = () => {
    const defaultFilters = {
      categories: [],
      radiusOn: false,
      radius: 10,
      preset: null,
    };
    const defaultMapSettings = {
      mapType: 'light',
      showTraffic: false,
      showBikeLanes: false,
      showHints: true,
      themeColor: 'green',
    };
    setDraftFilters(defaultFilters);
    setDraftMapSettings(defaultMapSettings);
    setAppliedFilters(defaultFilters);
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

  const removeFromFavorites = (id: string) => {
    setFavorites((prev: MarkerData[]) => prev.filter((m: MarkerData) => m.id !== id));
  };

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
  const handleRouteToggleFromFavorites = async (route: any, checked: boolean) => {
    if (!route || !Array.isArray(route.points)) return;
    if (checked) {
      // Передаём точки в планировщик и открываем страницу планирования — построение маршрута в Planner
      const routePointsForPlanner = route.points.map((point: any, index: number) => ({
        id: point.id || `route-point-${index}`,
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        title: point.title || `Точка ${index + 1}`,
        description: point.description || '',
      }));
      setRoutePoints?.(routePointsForPlanner);
      navigate('/planner');
    } else {
      // Скрываем маршрут
      setRouteData(null);
      setRouteModalOpen(false);
    }
  };

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

  const [searchRadiusCenter, setSearchRadiusCenter] = useState<[number, number]>([56.1366, 40.3966]);

  // Оптимизация: мемоизация фильтрованных маркеров
  const filteredMarkers = useMemo(() => {
    // Выбираем источник маркеров в зависимости от режима загрузки
    let result = useLazyLoading && lazyMarkers.length > 0 ? lazyMarkers : allMarkers;

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

    // Фильтр по категориям - показываем все маркеры, если категории не выбраны
    if (appliedFilters.categories && appliedFilters.categories.length > 0) {
      result = result.filter(marker =>
        appliedFilters.categories.includes(marker.category)
      );
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
  }, [useLazyLoading, lazyMarkers, allMarkers, pendingMarkerDrafts, auth?.user?.id, selectedHashtags, filterLogic, searchQuery, activePreset, appliedFilters, searchRadiusCenter, selectedMarkerIds, favorites, selectedRegions]);

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
      // Очищаем созданные URL для изображений
      pendingMarkerDrafts.forEach(marker => {
        marker.photo_urls?.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      });
    };
  }, [auth?.user?.id]);

  // Объединяем обычные маркеры с маркерами модерации
  // Используем только отфильтрованные маркеры (без модерации на карте)
  const allMarkersWithModeration = filteredMarkers;

  // NOTE: Previously we synchronized markers to the facade here via `mapFacade().updateExternalMarkers()`.
  // That produced duplicate markers in cases where both the facade renderer and the Map component
  // would add markers to the map (facade.renderMarkers + Map.useMapMarkers). To avoid duplicates
  // the Map component is now the single source of truth for marker rendering and we do NOT
  // update the facade here automatically. If external components need to push markers into
  // the facade for other contexts, they should call `mapFacade().updateExternalMarkers(...)` explicitly.
  // (intentionally left blank)


  // Раньше здесь автоматически открывалась левая панель с картой при монтировании
  // страницы, что приводило к нежелательной предзагрузке карты. Оставляем
  // управление открытием панели за явными действиями (пользователь или
  // другие контроллеры через `openLeftPanel` / `setLeftContent`).
  return (
    <MirrorGradientContainer className="page-layout-container page-container map-mode">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative" style={{ background: 'transparent', borderRadius: 0 }}>
            {/* Стеклянный блок с инструментами: Поиск + RegionSelector + Запрещенные зоны
                ВАЖНО: Вынесен за пределы MapContainer чтобы выпадающий список не обрезался
                Стиль: тёмное матовое стекло */}
            <div
              className="absolute flex items-center gap-3"
              style={{
                // Отступ сверху - больше в двухоконном режиме
                top: isTwoPanelMode ? '70px' : '20px',
                // В двухоконном режиме центр активной зоны карты = 25% от левого края
                // В одноэкранном режиме - по центру (50%)
                left: isTwoPanelMode ? '25%' : '50%',
                transform: 'translateX(-50%)',
                // Тёмное матовое стекло
                background: 'rgba(30, 30, 35, 0.6)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '8px 16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
                  className="dark-glass-input"
                  style={{
                    padding: '8px 16px 8px 40px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    outline: 'none',
                    fontSize: '14px',
                    width: '280px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    color: '#ffffff',
                    caretColor: '#ffffff'
                  }}
                />
                <FaSearch
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255, 255, 255, 0.7)',
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

              {/* Переключатель запрещенных зон - тёмный стиль */}
              <button
                onClick={() => setShowZonesLayer(!showZonesLayer)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
                style={{
                  background: showZonesLayer ? 'rgba(76, 201, 240, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${showZonesLayer ? 'rgba(76, 201, 240, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                  color: showZonesLayer ? '#4cc9f0' : 'rgba(255, 255, 255, 0.9)'
                }}
                title={showZonesLayer ? 'Скрыть запрещённые зоны' : 'Показать запрещённые зоны'}
              >
                <FaRoute className="w-4 h-4" />
                <span className="text-sm font-medium whitespace-nowrap">
                  Зоны
                </span>
              </button>
            </div>

            {/* Кнопки действий карты - в двухоконном режиме рендерим ВНЕ MapContainer чтобы избежать overflow: hidden */}
            {
              isTwoPanelMode && (
                <MapActionButtons
                  onSettingsClick={() => setSettingsOpen(true)}
                  onFavoritesClick={() => {
                    if (process.env.NODE_ENV === 'development') {
                    }
                    setFavoritesOpen(true);
                  }}
                  favoritesCount={favoritesCount}
                  onLegendClick={() => setLegendOpen(true)}
                  onAddMarkerClick={() => setIsAddingMarkerMode(true)}
                  isAddingMarkerMode={isAddingMarkerMode}
                  onRecordTrackClick={handleRecordTrackClick}
                  isRecording={isRecording}
                  isTwoPanelMode={isTwoPanelMode}
                />
              )
            }

            {/* Область карты */}
            <MapContainer className="facade-map-root map-area">
              {/* Кнопки управления по бокам карты - в однооконном режиме внутри MapContainer */}
              {!isTwoPanelMode && (
                <MapActionButtons
                  onSettingsClick={() => setSettingsOpen(true)}
                  onFavoritesClick={() => {
                    if (process.env.NODE_ENV === 'development') {
                    }
                    setFavoritesOpen(true);
                  }}
                  favoritesCount={favoritesCount}
                  onLegendClick={() => setLegendOpen(true)}
                  onAddMarkerClick={() => setIsAddingMarkerMode(true)}
                  isAddingMarkerMode={isAddingMarkerMode}
                  onRecordTrackClick={handleRecordTrackClick}
                  isRecording={isRecording}
                  isTwoPanelMode={isTwoPanelMode}
                />
              )}

              {/* Кнопка "Избранное" теперь в компоненте Map */}

              {/* Индикатор загрузки геолокации убран - геолокация работает в фоне, не блокирует карту */}

              {useLazyLoading && lazyLoading && (
                <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Загрузка маркеров...</span>
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
                  if (process.env.NODE_ENV === 'development') {
                  }
                  setFavoritesOpen(true);
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
                onSearchRadiusCenterChange={setSearchRadiusCenter}
                selectedMarkerIds={selectedMarkerIds}
                onAddToBlog={handleAddMarkerToBlog}
                onBoundsChange={handleMapBoundsChange}
                routeData={routeData}
                isAddingMarkerMode={isAddingMarkerMode}
                onAddMarkerModeChange={setIsAddingMarkerMode}
                legendOpen={legendOpen}
                onLegendOpenChange={setLegendOpen}
              />
            </MapContainer>

            {/* Левая выдвигающаяся панель с настройками */}
            {/* Левая панель настроек в стиле стекла */}
            <GlassPanel
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              position="left"
              width="400px"
              closeOnOverlayClick={true}
              showCloseButton={false}
              className="map-settings-panel"
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

            {/* Правая выдвигающаяся панель с избранным - использует GlassPanel внутри */}
            <FavoritesPanel
              favorites={favorites}
              routes={routes}
              isVip={isVip}
              onRemove={removeFromFavorites}
              onClose={() => {
                setFavoritesOpen(false);
              }}
              onMoveToPlanner={handleMoveToPlanner}
              onBuildRoute={handleBuildRoute}
              onLoadRoute={handleLoadRoute}
              onRouteToggle={handleRouteToggleFromFavorites}
              mode="map"
              selectedMarkerIds={selectedMarkerIds}
              onSelectedMarkersChange={setSelectedMarkerIds}
              selectedRouteIds={[]}
              onSelectedRouteIdsChange={() => { }}
              isOpen={favoritesOpen}
              constrainToMapArea={isTwoPanelMode}
            />

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
                    if (mapBounds) {
                      reloadMarkers(mapBounds);
                    } else if (useLazyLoading) {
                      const defaultBounds = {
                        north: center[0] + 0.1,
                        south: center[0] - 0.1,
                        east: center[1] + 0.1,
                        west: center[1] - 0.1
                      };
                      reloadMarkers(defaultBounds);
                    } else {
                      const fetchMarkers = async () => {
                        try {
                          const fetched = await projectManager.getMarkers();
                          setAllMarkers(fetched || []);
                        } catch (err) {
                          console.error('Ошибка загрузки маркеров:', err);
                        }
                      };
                      fetchMarkers();
                    }
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
  );
};

export default MapPage;
