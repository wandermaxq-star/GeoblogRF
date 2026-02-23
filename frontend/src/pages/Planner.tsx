/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
// TODO: temporary — relax lint rules in large files while we migrate types (follow-up task)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { FaStar, FaRoute, FaHeart, FaCog } from 'react-icons/fa';
import FivePointStar from '../components/Map/FivePointStar';
import PlannerActionButtons from '../components/Planner/PlannerActionButtons';
import { getAllZones, checkRoute, canCreateMarker, canCreateRoute } from '../services/zoneService';
import PlannerAccordion from '../components/Planner/PlannerAccordion';
import FavoritesPanel from '../components/FavoritesPanel';
import { GlassPanel, GlassHeader } from '../components/Glass';
import RouteRebuildModal from '../components/Planner/RouteRebuildModal';
import RouteCategoryModal, { RouteCreationData } from '../components/Planner/RouteCategoryModal';
import RouteCategorySelector from '../components/Planner/RouteCategorySelector';
import CoordinateInput from '../components/Planner/CoordinateInput';

import { MarkerData } from '../types/marker';
import { RouteData } from '../types/route';
import { getRoutePolyline } from '../services/routingService';
import { createRoute, deleteRoute } from '../api/routes';
import { createMarker as apiCreateMarker } from '../services/markerService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useRoutePlanner } from '../contexts/RoutePlannerContext';
import { getPendingContentCounts } from '../services/localModerationStorage';
import { offlineContentStorage, OfflineRouteDraft } from '../services/offlineContentStorage';
import { useRegionsStore, getRegionIdByName } from '../stores/regionsStore';
import { getregioncity } from '../stores/regionCities';
import { useEventsStore } from '../stores/eventsStore';
import { MockEvent } from '../components/TravelCalendar/mockEvents';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore } from '../stores/contentStore';
import { projectManager } from '../services/projectManager';
import { mapFacade } from '../services/map_facade';
import { useRussiaRestrictions } from '../hooks/useRussiaRestrictions';
import { geocodeAddress } from '../services/geocodingService';
import { getCategoryById } from '../components/TravelCalendar/TravelCalendar';
import { isWithinRussiaBounds } from '../utils/russiaBounds';
import RegionSelector from '../components/Regions/RegionSelector';
import { classifyPoint, generateTitleSuggestions, TitlePoint, requiresModeration } from '../services/routeTitleService';
import { FaCloud } from 'react-icons/fa';
import { PointSource } from '../types/routeBuilder';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
// КРИТИЧНО: Централизованное хранилище состояния карты - для сохранения состояния Planner
import { useMapStateStore, mapStateHelpers } from '../stores/mapStateStore';

// Заголовок убран - пользователь видит активную кнопку в сайдбаре

interface PlannerProps {
  selectedRouteId?: string;
  showOnlySelected?: boolean;
}

// Добавлен временный алиас типа для совместимости компиляции.
// Если в проекте есть реальная структура маршрута, замените `any` на неё.
type Route = any;
type MapMarker = any;
type MapConfig = any;

const Planner: React.FC<PlannerProps> = function Planner() {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const { user, token } = useAuth();
  const { isDarkMode } = useTheme();
  const isAdmin = user?.role === 'admin';
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const favorites = useFavorites();
  // --- восстановленные состояния ---
  const [facadeMarkers, setFacadeMarkers] = useState<MapMarker[]>([]);
  const [facadeRoutes, setFacadeRoutes] = useState<Route[]>([]);
  const [routeStats, setRouteStats] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  // Флаги, чтобы не инициировать карту повторно при возврате вкладки
  const plannerInitStartedRef = useRef(false);
  const plannerInitializedRef = useRef(false);
  const [showZonesLayer, setShowZonesLayer] = useState(false);
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<string[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesTab] = useState<'places' | 'routes'>('places');
  const [showCoordinateInput, setShowCoordinateInput] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [routeTitleInput, setRouteTitleInput] = useState<string>('');
  const [isCustomTitle, setIsCustomTitle] = useState<boolean>(false);

  const [useForPosts, setUseForPosts] = useState<boolean>(false);
  const [useForEvents, setUseForEvents] = useState<boolean>(false);
  const [mapResetKey, setMapResetKey] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  // --- восстановленные контексты ---
  const { selectedRegions } = useRegionsStore();
  const openEvents = useEventsStore((state) => state.openEvents);
  const selectedEvent = useEventsStore((state) => state.selectedEvent);
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent);
  const routePlannerContext = useRoutePlanner();
  const { addRoutePoint, removeRoutePoint, routePoints: routePointsFromContext, setRoutePoints } = routePlannerContext;

  // --- Централизованные состояния загрузки ---
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRouteDrafts, setPendingRouteDrafts] = useState<Route[]>([]);
  // КРИТИЧНО: Маркеры для отображения на карте Planner
  const [allMarkers, setAllMarkers] = useState<MapMarker[]>([]);

  // --- Функция загрузки черновиков маршрутов ---
  const loadPendingRoutes = useCallback(async (userId?: string) => {
    if (!userId) return [];
    try {
      await offlineContentStorage.init();
      const drafts = await offlineContentStorage.getAllDrafts('route');
      const routeDrafts: Route[] = drafts
        .filter((draft): draft is OfflineRouteDraft => draft.contentType === 'route' && draft.status !== 'failed_permanent')
        .map((draft) => {
          const { contentData, id, track } = draft;
          let routePoints: [number, number][] = [];
          if (track && track.geometry && track.geometry.type === 'LineString' && track.geometry.coordinates) {
            routePoints = track.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
          } else if (contentData.points && contentData.points.length >= 2) {
            routePoints = contentData.points.map((point: any) => [point.latitude, point.longitude] as [number, number]);
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
          } as Route;
        })
        .filter(route => route.points.length >= 2);
      setPendingRouteDrafts(routeDrafts);
      return routeDrafts;
    } catch (error) {
      setLoadError('Ошибка загрузки черновиков маршрутов');
      return [];
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
        // КРИТИЧНО: Загружаем маркеры для отображения на карте
        const markersPromise = projectManager.loadAllMarkers();

        await Promise.all([
          loadPendingRoutes(user?.id),
          markersPromise.then(markers => {
            if (isMounted && markers) {
              console.log('[Planner] Loaded markers:', markers.length);
              setAllMarkers(markers.map((m: any) => ({
                id: m.id,
                lat: m.latitude,
                lon: m.longitude,
                title: m.title,
                name: m.title,
                description: m.description,
                category: m.category,
              })));
            }
          }),
        ]);
        if (isMounted) setIsLoading(false);
      } catch (e: any) {
        if (isMounted) {
          setLoadError(e?.message || 'Ошибка загрузки данных');
          setIsLoading(false);
        }
      }
    };
    loadAll();
    // Периодическое обновление черновиков
    const interval = setInterval(() => loadPendingRoutes(user?.id), 10000);
    // Модерация
    loadModerationCount();
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id, loadPendingRoutes, loadModerationCount]);
  // ...existing code...

  // Используем store для управления панелями (если нужно)
  // const setLeftContent = useContentStore((state) => state.setLeftContent);
  // Состояние для фасада карт - только Яндекс!
  const currentMapProvider = 'yandex';
  // Функция ручного обновления всех данных (refresh)
  const handleRefreshAll = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      loadPendingRoutes(user?.id),
      // Можно добавить другие загрузчики
    ]).then(() => setIsLoading(false)).catch((e) => {
      setLoadError(e?.message || 'Ошибка обновления данных');
      setIsLoading(false);
    });
  }, [user?.id, loadPendingRoutes]);
  // Получаем состояние layout для проверки двухоконного режима
  // ВАЖНО: используем store напрямую для реактивности
  const rightContentFromStore = useContentStore((state) => state.rightContent);
  const leftContentFromStore = useContentStore((state) => state.leftContent);
  // Проверяем, активен ли Planner (виден пользователю)
  const isPlannerActive = leftContentFromStore === 'planner';
  // Двухоконный режим - когда есть посты справа
  const isTwoPanelMode = rightContentFromStore !== null;
  const handleFacadeMapReady = useCallback(() => setIsMapReady(true), []);

  // Управление margin карты при двухоконном режиме
  // В двухоконном режиме центр карты должен быть в центре левой половины экрана
  useEffect(() => {
    if (!isMapReady) return;

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
  }, [isTwoPanelMode, isMapReady]);

  // Инициализация карты через projectManager (useEffect только на верхнем уровне компонента)
  // КРИТИЧНО: Инициализируем ТОЛЬКО когда Planner активен (виден пользователю)
  useEffect(() => {
    // НЕ инициализируем карту если Planner не активен - контейнер будет иметь нулевые размеры
    if (!isPlannerActive) {
      console.log('[Planner] Not active, skipping map initialization');
      return;
    }

    // Если карта уже инициализирована или инициализация в процессе — не запускаем снова
    if (plannerInitializedRef.current || plannerInitStartedRef.current) {
      return;
    }

    plannerInitStartedRef.current = true;

    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 20; // 2 секунды максимум (20 * 100ms) - если активен, контейнер должен быть готов быстро

    const initializeMap = async () => {
      // Ждем, пока контейнер будет готов и будет иметь размеры
      let container = document.getElementById('planner-map-container');
      while ((!container || container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < maxAttempts && isMounted) {
        await new Promise(resolve => setTimeout(resolve, 100));
        container = document.getElementById('planner-map-container');
        attempts++;
      }

      if (!container || !isMounted) return;

      // Проверяем, что контейнер имеет валидные размеры
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn('[Planner] Map container has zero dimensions, skipping initialization');
        return;
      }

      // КРИТИЧНО: Восстанавливаем сохранённое состояние для контекста 'planner'
      const savedState = mapStateHelpers.getCenterAndZoom('planner');
      const isRestoring = mapStateHelpers.isInitialized('planner');

      const config: MapConfig = {
        provider: currentMapProvider,
        // Используем сохранённый центр/зум или значения по умолчанию
        center: savedState.center,
        zoom: savedState.zoom,
        // КРИТИЧНО: Объединяем все маркеры - точки маршрута + все маркеры карты
        markers: [...facadeMarkers, ...allMarkers],
        routes: [...facadeRoutes, ...pendingRouteDrafts],
        // Флаг сохранения состояния
        preserveState: true,
        // Указываем контекст для идентификации
        context: 'planner',
      };

      console.log('[Planner] Initializing map with config:', {
        isRestoring,
        center: savedState.center,
        zoom: savedState.zoom,
      });

      try {
        await projectManager.initializeMap(container, config);
        if (isMounted) {
          handleFacadeMapReady();
          plannerInitializedRef.current = true;
          plannerInitStartedRef.current = false;
        }
      } catch (error) {
        console.error('[Planner] Failed to initialize map:', error);
        // Разрешаем повторить попытку при следующей активации
        plannerInitStartedRef.current = false;
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
    };
  }, [isPlannerActive, currentMapProvider, facadeMarkers, facadeRoutes, pendingRouteDrafts, allMarkers, handleFacadeMapReady]);

  // Fallback: скрываем лоадер карты через 3 секунды если карта так и не загрузилась
  // Это предотвращает бесконечный белый экран с лоадером
  useEffect(() => {
    if (isMapReady || !isPlannerActive) return;

    const timeout = setTimeout(() => {
      if (!isMapReady) {
        console.warn('[Planner] Map did not load in 3s, hiding loader anyway');
        setIsMapReady(true);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [isPlannerActive, isMapReady]);

  // === КРИТИЧНО: Единая функция рендеринга маркеров на Яндекс карте ===
  // Вызывается напрямую из каждого обработчика, не через цепочку useEffect
  const renderMarkersOnMap = useCallback((markers: MapMarker[]) => {
    try {
      const mapApi = projectManager.getMapApi?.();
      if (!mapApi) {
        console.warn('[Planner] renderMarkersOnMap: mapApi not ready');
        return;
      }

      // Способ 1: Используем renderMarkers из API (привязан к рендереру через bind)
      if (typeof mapApi.renderMarkers === 'function') {
        const unifiedMarkers = markers.map(m => ({
          id: m.id || `m-${Date.now()}`,
          coordinates: { lat: Number(m.lat), lon: Number(m.lon) },
          title: m.title || m.name || '',
        }));
        mapApi.renderMarkers(unifiedMarkers);
        console.log('[Planner] Rendered', markers.length, 'markers via mapApi.renderMarkers');
        return;
      }

      // Способ 2 (fallback): Рендерим напрямую на карту через ymaps API
      const ymaps = (window as any).ymaps;
      const map = mapApi?.map || mapApi?.mapInstance;
      if (!map || !ymaps) {
        console.warn('[Planner] renderMarkersOnMap: map or ymaps not ready for fallback');
        return;
      }

      const collection = new ymaps.GeoObjectCollection();
      markers.forEach(m => {
        const lat = Number(m.lat);
        const lon = Number(m.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const placemark = new ymaps.Placemark(
          [lat, lon],
          { balloonContent: m.title || m.name || '', iconCaption: m.title || m.name || '' },
          { preset: 'islands#blueCircleDotIcon' }
        );
        collection.add(placemark);
      });
      if ((window as any).__plannerMarkersCollection) {
        try { map.geoObjects.remove((window as any).__plannerMarkersCollection); } catch {}
      }
      map.geoObjects.add(collection);
      (window as any).__plannerMarkersCollection = collection;
      console.log('[Planner] Rendered', markers.length, 'markers via fallback collection');
    } catch (e) {
      console.warn('[Planner] renderMarkersOnMap error:', e);
    }
  }, []);

  // === Единая функция добавления точки на карту и в состояние ===
  // ОБЯЗАТЕЛЬНАЯ проверка запретных зон перед добавлением любой точки
  const addPointAndRender = useCallback(async (point: { id: string; latitude: number; longitude: number; title: string; description?: string }): Promise<boolean> => {
    // 0. Проверка запретных зон — ОБЯЗАТЕЛЬНА, не опция!
    try {
      const zoneCheck = await canCreateMarker(point.latitude, point.longitude);
      if (!zoneCheck.allowed) {
        alert(`🚫 Точка заблокирована: ${zoneCheck.reason || 'Запретная зона'}`);
        return false;
      }
    } catch (err) {
      console.error('[Planner] Zone check error:', err);
      alert('🚫 Не удалось проверить запретные зоны. Точка не добавлена для безопасности.');
      return false;
    }

    // 1. Добавляем в контекст RoutePlanner
    addRoutePoint(point);
    // 2. Обновляем facadeMarkers и рендерим на карте немедленно
    setFacadeMarkers(prev => {
      const newMarker: MapMarker = {
        id: point.id,
        lat: point.latitude,
        lon: point.longitude,
        title: point.title,
        name: point.title,
        description: point.description || '',
      };
      const updated = [...prev, newMarker];
      // Рендерим асинхронно чтобы не блокировать setState
      setTimeout(() => renderMarkersOnMap(updated), 0);
      return updated;
    });
    return true;
  }, [addRoutePoint, renderMarkersOnMap]);

  // Автоматическое управление событиями в маршруте при смене selectedEvent
  useEffect(() => {
    if (!selectedEvent) return;

    const currentEventId = `event-${selectedEvent.id}`;

    // Находим все точки маршрута, которые являются событиями (ID начинается с 'event-')
    const eventRoutePoints = routePointsFromContext?.filter(rp => rp.id?.startsWith('event-')) || [];

    // Удаляем все события из маршрута, кроме текущего выбранного
    eventRoutePoints.forEach(rp => {
      if (rp.id !== currentEventId) {
        // Это другое событие - удаляем его из маршрута
        removeRoutePoint(rp.id);
      }
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
        description: selectedEvent.description || undefined
      });
    }
  }, [selectedEvent, routePointsFromContext, removeRoutePoint, addPointAndRender]);

  // Центрирование карты на выбранное событие
  useEffect(() => {
    if (!isMapReady || !selectedEvent) return;

    // Проверяем, что у события есть валидные координаты
    if (selectedEvent.latitude == null || selectedEvent.longitude == null ||
      isNaN(selectedEvent.latitude) || isNaN(selectedEvent.longitude)) {
      return;
    }

    // Проверяем, что координаты в пределах России
    if (!isWithinRussiaBounds(selectedEvent.latitude, selectedEvent.longitude)) {
      return;
    }

    // Центрируем карту на событие с задержкой для гарантии готовности карты
    const timer = setTimeout(() => {
      try {
        // Используем setCenter с зумом 14 для комфортного просмотра события
        // YandexAdapter поддерживает zoom как второй параметр
        const mapApi = projectManager.getMapApi();
        const provider = mapApi.providers?.[mapApi.currentProvider];
        if (provider && typeof provider.setCenter === 'function') {
          provider.setCenter([selectedEvent.latitude, selectedEvent.longitude], 14);
        } else {
          const mapApi = projectManager.getMapApi();
          mapApi.setCenter([selectedEvent.latitude, selectedEvent.longitude]);
        }
      } catch (error) {
        // Игнорируем ошибки центрирования карты
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedEvent, isMapReady]);

  // Обработчик добавления события в маршрут
  const handleAddEventToRoute = useCallback(async (event: MockEvent) => {
    // Проверяем на null/undefined, а не на falsy значения (0 - валидная координата)
    if (event.latitude == null || event.longitude == null || isNaN(event.latitude) || isNaN(event.longitude)) {
      alert('❌ У события нет координат для добавления в маршрут');
      return;
    }

    // Добавляем событие как точку маршрута + рендерим на карте (с проверкой зон)
    const added = await addPointAndRender({
      id: `event-${event.id}`,
      latitude: event.latitude,
      longitude: event.longitude,
      title: event.title,
      description: event.description || undefined
    });

    if (added) {
      // Открываем настройки маршрута, чтобы пользователь увидел добавленную точку
      setSettingsOpen(true);
      alert(`✅ Событие "${event.title}" добавлено в маршрут!`);
    }
  }, [addPointAndRender]);

  // УБРАНО: Маркеры событий теперь добавляются через синхронизацию routePointsFromContext с facadeMarkers
  // FacadeMap автоматически отрисовывает маркеры из facadeMarkers, поэтому не нужно добавлять их напрямую через mapFacade

  // Очистка при смене провайдера - убрано, так как только Яндекс

  // Стабильный обработчик клика по карте
  const handleMapClick = useCallback(async (coordinates: [number, number]) => {
    const pointId = `marker-${Date.now()}`;
    await addPointAndRender({
      id: pointId,
      latitude: coordinates[0],
      longitude: coordinates[1],
      title: `Точка ${(routePointsFromContext?.length || 0) + 1}`,
      description: undefined
    });
  }, [addPointAndRender, routePointsFromContext]);

  // КРИТИЧНО: Синхронизация routePointsFromContext → facadeMarkers
  // Нужна для случаев когда addRoutePoint вызывается НЕ через нашу addPointAndRender
  // (например, из событий)
  useEffect(() => {
    if (!routePointsFromContext || routePointsFromContext.length === 0) {
      return;
    }
    const newMarkers: MapMarker[] = routePointsFromContext.map((rp: any, idx: number) => ({
      id: rp.id || `rp-${idx}`,
      lat: rp.latitude,
      lon: rp.longitude,
      title: rp.title || `Точка ${idx + 1}`,
      name: rp.title || `Точка ${idx + 1}`,
      description: rp.description || '',
    }));
    setFacadeMarkers(newMarkers);
    // Если карта готова — рендерим сразу
    if (isMapReady) {
      renderMarkersOnMap(newMarkers);
    }
  }, [routePointsFromContext, isMapReady, renderMarkersOnMap]);

  // === СИНХРОНИЗАЦИЯ: чекбоксы избранного → маркеры на карте ===
  // Когда пользователь ставит/снимает галочку в панели избранного,
  // соответствующий маркер появляется/исчезает на карте планировщика.
  const prevSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!isMapReady) return;
    const favoritesAsMarkers: MarkerData[] = (favorites as any)?.favorites || [];
    const rawPlaces = (favorites as any)?.favoritePlaces || [];
    const prevIds = prevSelectedIdsRef.current;
    const currentIds = selectedMarkerIds;

    // Определяем добавленные и удалённые ID
    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    prevSelectedIdsRef.current = currentIds;

    // Удаляем снятые маркеры (инлайн, т.к. handleRemoveMarker определён ниже)
    removedIds.forEach(id => {
      try { if (id) projectManager.getMapApi().removeMarker(id); } catch { }
      setFacadeMarkers(prev => {
        const updated = prev.filter(m => m.id !== id);
        setTimeout(() => renderMarkersOnMap(updated), 0);
        return updated;
      });
      if (removeRoutePoint) removeRoutePoint(id);
    });

    // Добавляем новые маркеры
    addedIds.forEach(id => {
      // Не добавляем, если уже есть на карте
      if (facadeMarkers.some(m => m.id === id)) return;

      // Ищем маркер в favorites
      const marker = favoritesAsMarkers.find((m: any) => m.id === id)
        || (() => {
          const fp = rawPlaces.find((m: any) => m.id === id);
          if (!fp) return null;
          return {
            ...fp,
            title: fp.title || fp.name || 'Без названия',
            latitude: fp.latitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[0] : undefined),
            longitude: fp.longitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[1] : undefined),
          } as MarkerData;
        })();

      if (!marker) return;
      let lat = Number(marker.latitude);
      let lon = Number(marker.longitude);
      if (isNaN(lat) || isNaN(lon)) return;
      if (!isWithinRussiaBounds(lat, lon) && isWithinRussiaBounds(lon, lat)) {
        const tmp = lat; lat = lon; lon = tmp;
      }
      addPointAndRender({
        id: marker.id || `fav-${Date.now()}`,
        latitude: lat,
        longitude: lon,
        title: marker.title || 'Без названия',
        description: undefined
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarkerIds, isMapReady]);

  // КРИТИЧНО: Регистрация обработчика клика по Яндекс карте
  // Используем ref чтобы не дублировать обработчики
  const clickRegisteredRef = useRef(false);
  const handleMapClickRef = useRef(handleMapClick);
  handleMapClickRef.current = handleMapClick;

  useEffect(() => {
    if (!isMapReady || clickRegisteredRef.current) return;

    // Способ 1: через mapApi.onClick (привязан к рендереру через bind - самый надёжный)
    try {
      const mapApi = projectManager.getMapApi?.();
      if (mapApi && typeof mapApi.onClick === 'function') {
        mapApi.onClick((coords: [number, number]) => {
          handleMapClickRef.current(coords);
        });
        clickRegisteredRef.current = true;
        console.log('[Planner] Click handler registered via mapApi.onClick');
      }
    } catch (e0) {
      console.warn('[Planner] mapApi.onClick failed:', e0);
    }

    // Способ 2: через mapFacade onClick
    if (!clickRegisteredRef.current) {
      try {
        const facade = mapFacade();
        if (facade && typeof facade.onClick === 'function') {
          facade.onClick((coords: [number, number]) => {
            handleMapClickRef.current(coords);
          });
          clickRegisteredRef.current = true;
          console.log('[Planner] Click handler registered via facade.onClick');
        }
      } catch (e1) {
        console.warn('[Planner] facade.onClick failed:', e1);
      }
    }

    // Способ 3: напрямую через Яндекс API (fallback)
    if (!clickRegisteredRef.current) {
      try {
        const mapApi = projectManager.getMapApi?.();
        const map = mapApi?.map || mapApi?.mapInstance;
        if (map && map.events) {
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            if (coords && Array.isArray(coords)) {
              handleMapClickRef.current([coords[0], coords[1]]);
            }
          });
          clickRegisteredRef.current = true;
          console.log('[Planner] Click handler registered via direct Yandex API');
        }
      } catch (e2) {
        console.warn('[Planner] Direct click registration failed:', e2);
      }
    }
  }, [isMapReady]);

  // Синхронизация facadeRoutes → рендеринг маршрутов на Яндекс карте
  // Отслеживаем уже отрисованные маршруты чтобы не перерисовывать и корректно удалять
  const renderedRouteIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isMapReady) return;
    const mapApi = projectManager.getMapApi?.();
    if (!mapApi || typeof mapApi.renderRoute !== 'function') {
      console.warn('[Planner] mapApi.renderRoute not available');
      return;
    }

    const currentIds = new Set(facadeRoutes.map(r => r.id).filter(Boolean));

    // 1. Удаляем маршруты, которых больше нет в facadeRoutes
    for (const renderedId of renderedRouteIdsRef.current) {
      if (!currentIds.has(renderedId)) {
        console.log('[Planner] Removing route from map:', renderedId);
        try { mapApi.removeRoute?.(renderedId); } catch { }
        renderedRouteIdsRef.current.delete(renderedId);
      }
    }

    // 2. Рендерим новые маршруты (которых ещё нет на карте)
    for (const route of facadeRoutes) {
      if (!route.id || !route.points || route.points.length < 2) continue;
      if (renderedRouteIdsRef.current.has(route.id)) continue; // уже отрисован

      console.log('[Planner] Rendering route via mapApi.renderRoute:', route.id, route.points.length, 'points');
      try {
        mapApi.renderRoute({ id: route.id, geometry: route.points, color: route.color });
        renderedRouteIdsRef.current.add(route.id);
      } catch (e) {
        console.warn('[Planner] Failed to render route:', route.id, e);
      }
    }
  }, [isMapReady, facadeRoutes]);

  // НОВЫЕ ФУНКЦИИ ДЛЯ МАРШРУТОВ
  // Ключ для принудительной переинициализации карты при удалении маршрутов
  // ...existing code...

  const extractRoutePoints = useCallback((route: any): [number, number][] => {
    try {
      // 1) route.points как массив объектов с latitude/longitude или [lat, lon]
      let pts: any[] = [];
      if (Array.isArray(route?.points) && route.points.length > 0) {
        pts = route.points;
      } else if (route?.route_data) {
        const rdRaw: any = route.route_data;
        const rd = typeof rdRaw === 'string' ? (JSON.parse(rdRaw) || {}) : (rdRaw || {});
        if (Array.isArray(rd.points)) pts = rd.points;
      }

      // Попытка гидратации из waypoints через избранные места
      if ((!Array.isArray(pts) || pts.length === 0) && Array.isArray(route?.waypoints) && route.waypoints.length > 0) {
        const markersById = new Map(((favorites as any)?.favoritePlaces || []).map((m: any) => [m.id, m]));
        pts = route.waypoints
          .map((wp: any) => markersById.get(wp.marker_id))
          .filter(Boolean)
          .map((m: any) => ({ latitude: m.latitude ?? m.coordinates?.[0], longitude: m.longitude ?? m.coordinates?.[1] }));
      }

      // Нормализация к [lat, lon]
      const result: [number, number][] = (pts || [])
        .map((p: any) => {
          if (Array.isArray(p) && p.length >= 2) {
            return [Number(p[0]), Number(p[1])] as [number, number];
          }
          const a = Number(p?.latitude ?? p?.lat);
          const b = Number(p?.longitude ?? p?.lon ?? p?.lng);
          if (Number.isFinite(a) && Number.isFinite(b)) return [a, b] as [number, number];
          return null;
        })
        .filter(Boolean) as [number, number][];
      return result;
    } catch { return []; }
  }, [favorites]);

  const handleRouteToggle = useCallback((routeData: any, checked: boolean) => {
    const rid = String(routeData?.id || '');
    if (!rid) return;

    setSelectedRouteIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(rid); else next.delete(rid);
      return Array.from(next);
    });

    if (checked) {
      // Если маршрута нет в избранном пользователя – добавим (для ЛК)
      try {
        const fr = (favorites as any)?.favoriteRoutes || [];
        const exists = fr.some((r: any) => String(r.id) === rid);
        if (!exists) {
          const pointsForFav = extractRoutePoints(routeData).map((p, idx) => ({ id: `pt-${idx}`, latitude: p[0], longitude: p[1] }));
          (favorites as any)?.addFavoriteRoute?.({
            id: rid,
            title: routeData.title || 'Без названия',
            distance: 0,
            duration: 0,
            rating: 0,
            isOriginal: true,
            tags: Array.isArray(routeData.tags) ? routeData.tags : [],
            description: routeData.description || '',
            visibility: 'private',
            usageCount: 0,
            relatedContent: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            points: pointsForFav,
            categories: { personal: true, post: false, event: false }
          });
        }
      } catch { }

      const points = extractRoutePoints(routeData);
      if (points.length < 2) {
        alert('❌ У маршрута недостаточно точек для отображения');
        return;
      }
      const r: Route = { id: `fav-route-${rid}`, points, color: '#8B5CF6' };
      // Добавляем в состояние - FacadeMap автоматически отрисует через useEffect
      setFacadeRoutes(prev => [...prev, r]);
    } else {
      // Удаляем маршрут из состояния — рендер-эффект удалит его с карты через removeRoute
      const routeIdToRemove = `fav-route-${rid}`;
      setFacadeRoutes(prev => prev.filter(r => r.id !== routeIdToRemove));
      renderedRouteIdsRef.current.delete(routeIdToRemove);
    }
  }, [extractRoutePoints]);

  // Пример использования: кнопка "Построить маршрут" в UI вызывает buildAndSetRoute(routePoints)
  // ...existing code...

  // Нормализует любую форму точки в [lat, lon] (как числа)
  const normalizePoint = (p: unknown): [number, number] | null => {
    if (!p) return null;
    // Возможные формы: {latitude, longitude}, {lat, lng}, [lat, lon], [lon, lat]
    let lat: number | undefined;
    let lon: number | undefined;
    if (Array.isArray(p)) {
      const a = Number(p[0]);
      const b = Number(p[1]);
      lat = a; lon = b;
      // Если похоже на [lon, lat] (первое число вне диапазона широты), попробуем поменять
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        // Попытка поменять порядок (lon, lat -> lat, lon)
        if (Number.isFinite(b) && b >= -90 && b <= 90 && Number.isFinite(a)) {
          lat = b;
          lon = a;
        }
      }
    } else if (typeof p === 'object' && p !== null) {
      lat = Number((p as any).latitude ?? (p as any).lat);
      lon = Number((p as any).longitude ?? (p as any).lng ?? (p as any).lon);
    } else {
      return null;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return [lat, lon];
  };

  // Приводим возвращаемую полилинию к форме [lat, lon]
  const normalizePolyline = (poly: any[]): [number, number][] => {
    if (!Array.isArray(poly)) return [];
    const out: [number, number][] = [];
    for (const p of poly) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const a = Number(p[0]), b = Number(p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      // Если похоже на [lon, lat] (a в [-180..180] и b в [-90..90] и a вне диапазона широты) — поменять местами
      if (a >= -180 && a <= 180 && (a < -90 || a > 90) && b >= -90 && b <= 90) {
        out.push([b, a]);
      } else {
        out.push([a, b]);
      }
    }
    return out;
  };

  // Единая функция построения маршрута - используется только при явных действиях пользователя
  const buildAndSetRoute = useCallback(async (points: any[]): Promise<Route | null> => {
    if (!Array.isArray(points) || points.length < 2) {
      return null;
    }

    setIsBuilding(true);
    try {
      // Нормализуем входные точки в [lat, lon] как числа
      const normalized = points
        .map((p: unknown) => normalizePoint(p))
        .filter((p): p is [number, number] => p !== null) as [number, number][];

      if (normalized.length < 2) {
        return null;
      }

      // Проверяем валидность всех координат
      const allValid = normalized.every(([lat, lon]) =>
        Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      );

      if (!allValid) {
        return null;
      }

      // ОБЯЗАТЕЛЬНАЯ проверка запретных зон для маршрута
      try {
        const routeZoneCheck = await canCreateRoute(normalized);
        if (!routeZoneCheck.allowed) {
          alert(`🚫 Маршрут заблокирован: ${routeZoneCheck.reason || 'Маршрут проходит через запретную зону'}`);
          return null;
        }
      } catch (err) {
        console.error('[Planner] Route zone check error:', err);
        alert('🚫 Не удалось проверить запретные зоны маршрута. Построение отменено.');
        return null;
      }

      // getRoutePolyline принимает [lat, lon] и сам конвертирует в [lon, lat] для ORS внутри
      // НЕ делаем двойной swap — передаём normalized напрямую!
      let builtPolyline: [number, number][] | null = null;
      try {
        const result = await getRoutePolyline(normalized, 'driving-car');
        if (Array.isArray(result) && result.length >= 2) {
          builtPolyline = result; // getRoutePolyline уже возвращает [lat, lon]
        }
      } catch {
        // Ошибка запроса - используем fallback ниже
      }

      // Fallback: соединяем точки прямой линией без запроса к сервису
      if (!builtPolyline || builtPolyline.length < 2) {
        builtPolyline = normalized;
      }

      // Создаем Route объект и добавляем в состояние
      const route: Route = {
        id: `auto-route-${Date.now()}`,
        points: builtPolyline,
        color: '#3B82F6'
      };

      // Добавляем маршрут в состояние - FacadeMap отрисует его через props
      setFacadeRoutes(prev => {
        // Удаляем старые авто-маршруты
        const filtered = prev.filter(r => !r.id?.startsWith('auto-route-'));
        // Очищаем старые авто-маршруты из renderedRouteIds чтобы рендер-эффект их удалил с карты
        prev.forEach(r => {
          if (r.id?.startsWith('auto-route-')) {
            renderedRouteIdsRef.current.delete(r.id);
          }
        });
        return [...filtered, route];
      });

      // НЕ вызываем setRoutePoints здесь — точки уже управляются через addPointAndRender.
      // Вызов setRoutePoints → routePointsFromContext → setFacadeMarkers → autoRoute → бесконечный цикл!

      return route;
    } catch {
      return null;
    } finally {
      setIsBuilding(false);
    }
  }, [setFacadeRoutes]);

  // АВТОПОСТРОЕНИЕ: При изменении facadeMarkers (2+ точки) автоматически строим маршрут
  // Используем ref для предотвращения бесконечного цикла и повторных запросов
  const autoRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoRouteKeyRef = useRef<string>('');
  const isAutoRoutingRef = useRef(false);

  useEffect(() => {
    console.log('[Planner] Auto-route check: isMapReady=', isMapReady, 'markers=', facadeMarkers.length, 'isAutoRouting=', isAutoRoutingRef.current,
      'coords=', facadeMarkers.map(m => `${m.id}(${m.lat},${m.lon})`));
    if (!isMapReady || facadeMarkers.length < 2 || isAutoRoutingRef.current) return;

    // Создаём ключ из координат маркеров для сравнения
    const markersKey = facadeMarkers.map(m => `${m.lat},${m.lon}`).join('|');
    if (markersKey === lastAutoRouteKeyRef.current) {
      console.log('[Planner] Auto-route: same key, skipping');
      return; // Уже построен для этих точек
    }

    // Debounce: ждём 800ms после последнего добавления точки
    if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
    console.log('[Planner] Auto-route: scheduling build in 800ms for key:', markersKey);
    autoRouteTimerRef.current = setTimeout(async () => {
      if (isAutoRoutingRef.current) return;
      isAutoRoutingRef.current = true;
      try {
        const routePoints = facadeMarkers.map(m => [Number(m.lat), Number(m.lon)] as [number, number]);
        console.log('[Planner] Auto-building route for', routePoints.length, 'points:', routePoints);
        lastAutoRouteKeyRef.current = markersKey;
        const result = await buildAndSetRoute(routePoints);
        console.log('[Planner] Auto-route result:', result ? `route ${result.id} with ${result.points?.length} points` : 'null');
      } catch (e) {
        console.warn('[Planner] Auto route build failed:', e);
      } finally {
        isAutoRoutingRef.current = false;
      }
    }, 800);

    return () => {
      if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
    };
  }, [isMapReady, facadeMarkers, buildAndSetRoute]);

  const handleBuildRouteFromFavorites = useCallback(async (markerIds: string[]) => {
    // КРИТИЧНО: Используем favorites (MarkerData[]) из контекста — данные уже нормализованы
    const favoritesAsMarkers: MarkerData[] = (favorites as any)?.favorites || [];
    const rawPlaces = (favorites as any)?.favoritePlaces || [];

    const selectedMarkers = markerIds
      .map(id => {
        const fromMarkers = favoritesAsMarkers.find((m: any) => m.id === id);
        if (fromMarkers) return fromMarkers;
        // Fallback: ищем в сырых FavoritePlace и нормализуем координаты
        const fp = rawPlaces.find((m: any) => m.id === id);
        if (!fp) return null;
        return {
          ...fp,
          title: fp.title || fp.name || 'Без названия',
          latitude: fp.latitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[0] : undefined),
          longitude: fp.longitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[1] : undefined),
        } as MarkerData;
      })
      .filter((m): m is MarkerData => Boolean(m));

    if (selectedMarkers.length < 2) {
      alert('❌ Для построения маршрута нужно минимум 2 точки');
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

    if (route) {
      alert(`✅ Маршрут построен из ${selectedMarkers.length} точек!`);
    }
  }, [favorites, buildAndSetRoute, addPointAndRender]);

  const handleClearAllClickMarkers = useCallback(() => {
    try {
      const mapApi = projectManager.getMapApi();
      if (mapApi && mapApi.clear) {
        mapApi.clear();
      }
    } catch {
      // Игнорируем ошибки
    }
    // Очищаем маркеры на Яндекс карте через renderMarkersOnMap
    renderMarkersOnMap([]);
    setFacadeMarkers([]);
    setFacadeRoutes([]);
    renderedRouteIdsRef.current.clear();
    lastAutoRouteKeyRef.current = '';
    alert('✅ Карта очищена');
  }, [renderMarkersOnMap]);

  const handleFinalSaveRoute = useCallback(async (routeData: RouteCreationData) => {

    if (!user || !token) {
      alert('❌ Необходимо войти в систему');
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
          alert(`🚫 Сохранение заблокировано: ${finalZoneCheck.reason || 'Маршрут проходит через запретную зону'}`);
          return;
        }
      } catch (err) {
        console.error('[Planner] Final zone check error:', err);
        alert('🚫 Не удалось проверить запретные зоны. Сохранение отменено для безопасности.');
        return;
      }
    }

    try {
      // Обеспечиваем валидные marker_id: создаем отсутствующие маркеры на бэке
      const isUuid = (s: string | undefined) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      const ensuredMarkerIds: string[] = [];
      let markerCreationFailed = false;
      for (let i = 0; i < facadeMarkers.length; i++) {
        const m = facadeMarkers[i];
        if (isUuid(m.id)) {
          ensuredMarkerIds.push(m.id as string);
        } else {
          try {
            const created = await apiCreateMarker({
              title: m.title || `Точка ${i + 1}`,
              latitude: m.lat ?? 0,
              longitude: m.lon ?? 0,
              category: 'route',
              address: undefined,
              hashtags: []
            });
            ensuredMarkerIds.push(created.id);
          } catch (e: any) {
            markerCreationFailed = true;
            break;
          }
        }
      }

      // Всегда стараемся сохранить геометрию маршрута по дорогам.
      // Если провайдер не отдал детальную геометрию (routeGeometry пуст),
      // перестраиваем через ORS по текущим точкам как надёжный фолбэк.
      let geometryToSave: Array<[number, number]> | undefined = (routeGeometry && routeGeometry.length > 1)
        ? routeGeometry
        : undefined;
      try {
        if (!geometryToSave) {
          const pts: Array<[number, number]> = facadeMarkers
            .filter(m => m.lat !== undefined && m.lon !== undefined)
            .map(m => [m.lat!, m.lon!]);
          if (Array.isArray(pts) && pts.length >= 2) {
            const { getRoutePolyline } = await import('../services/routingService');
            const snapped = await getRoutePolyline(pts, 'driving-car');
            if (Array.isArray(snapped) && snapped.length > 1) geometryToSave = snapped as Array<[number, number]>;
          }
        }
      } catch { }

      // Минимальный payload для совместимости с бэком
      const payload: any = {
        title: routeData.title,
        route_data: {
          points: facadeMarkers
            .filter(m => m.lat !== undefined && m.lon !== undefined)
            .map(m => [m.lat!, m.lon!])
          , geometry: geometryToSave
        },
        tags: Array.isArray((routeData as any).tags) ? (routeData as any).tags : [],
        waypoints: markerCreationFailed ? [] : ensuredMarkerIds.map((mid, index) => ({
          marker_id: mid,
          order_index: index
        }))
      };
      const newRoute = await createRoute(payload, token);

      alert('✅ Маршрут сохранен!');

      // Добавляем в избранное для отображения в ЛК и назначения ролей
      try {
        const tagsFromToggles: string[] = [
          ...(useForPosts ? ['post'] : []),
          ...(useForEvents ? ['event'] : [])
        ];
        const pointsForFav = (payload.route_data?.points || []).map((p: any, idx: number) => ({ id: `pt-${idx}`, latitude: Number(p[0]), longitude: Number(p[1]) }));
        (favorites as any)?.addFavoriteRoute?.({
          id: newRoute.id,
          title: newRoute.title || payload.title,
          distance: 0,
          duration: 0,
          rating: 0,
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
    } catch (error: any) {
      const serverMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message;
      alert(`❌ Ошибка сохранения маршрута: ${serverMsg || 'Server error'}`);
    }
  }, [user, token, facadeMarkers, routeStats]);

  // Сохранение маршрута офлайн
  const handleSaveRouteOffline = useCallback(async (routeData: RouteCreationData) => {
    if (!user?.id) {
      alert('Для сохранения офлайн необходимо авторизоваться');
      return;
    }

    try {
      // Получаем точки маршрута из facadeMarkers
      const points = facadeMarkers
        .filter(m => m.lat !== undefined && m.lon !== undefined)
        .map(m => ({
          latitude: m.lat!,
          longitude: m.lon!,
          title: m.title || `Точка ${facadeMarkers.indexOf(m) + 1}`
        }));

      if (points.length < 2) {
        alert('Для сохранения маршрута нужно минимум 2 точки');
        return;
      }

      // Получаем трек из routeGeometry, если есть
      let track: GeoJSON.Feature<GeoJSON.LineString> | null = null;
      if (routeGeometry && routeGeometry.length >= 2) {
        track = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeGeometry.map(([lat, lon]) => [lon, lat]) // GeoJSON использует [lon, lat]
          },
          properties: {}
        };
      }

      // Получаем regionId
      const regionId = 'default';

      // Сохраняем в IndexedDB
      await offlineContentStorage.addDraft({
        contentType: 'route',
        contentData: {
          title: routeData.title,
          description: routeData.description || '',
          points: points,
          waypoints: [],
          totalDistance: 0, // Будет вычислено при отправке
          estimatedDuration: 0, // Будет вычислено при отправке
          tags: routeData.tags || []
        },
        track: track,
        hasTrack: !!track,
        hasImages: false,
        status: 'draft',
        regionId: regionId
      });

      alert('✅ Маршрут сохранён офлайн! Он будет отправлен автоматически при появлении интернета.');
      setShowTitleModal(false);
    } catch (error: any) {
      console.error('Ошибка сохранения маршрута офлайн:', error);
      alert(`❌ Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`);
    }
  }, [user, facadeMarkers, routeGeometry, routeStats, setShowTitleModal]);

  // Подготовка названий и показ модалки
  const openTitleModalAndSuggest = useCallback(() => {
    try {
      const favoriteIds: Set<string> = new Set<string>(
        (((favorites as any)?.favoritePlaces || []) as any[]).map((p: any) => String(p.id))
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
  }, [facadeMarkers, favorites]);

  // Функция удаления маркера через фасад
  const handleRemoveMarker = (markerId: string) => {
    try { if (markerId) projectManager.getMapApi().removeMarker(markerId); } catch { }
    setFacadeMarkers(prev => {
      const updated = prev.filter(m => m.id !== markerId);
      // Перерисовываем оставшиеся маркеры
      setTimeout(() => renderMarkersOnMap(updated), 0);
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
    const favoritesAsMarkers: MarkerData[] = (favorites as any)?.favorites || [];
    // Также пробуем favoritePlaces для обратной совместимости
    const rawPlaces = (favorites as any)?.favoritePlaces || [];

    const selectedMarkers = ids
      .map(id => {
        // Сначала ищем в готовых MarkerData
        const fromMarkers = favoritesAsMarkers.find((m: any) => m.id === id);
        if (fromMarkers) return fromMarkers;
        // Fallback: ищем в сырых FavoritePlace и нормализуем
        const fp = rawPlaces.find((m: any) => m.id === id);
        if (!fp) return null;
        return {
          ...fp,
          title: fp.title || fp.name || 'Без названия',
          latitude: fp.latitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[0] : undefined),
          longitude: fp.longitude ?? (Array.isArray(fp.coordinates) ? fp.coordinates[1] : undefined),
          category: fp.category || fp.type || 'other',
          address: fp.address || fp.location || '',
        } as MarkerData;
      })
      .filter((m): m is MarkerData => Boolean(m));

    if (selectedMarkers.length === 0) {
      alert('❌ Не найдено меток для переноса');
      return;
    }

    // Добавляем метки в routePointsFromContext, корректируя возможную путаницу lat/lon по границам РФ
    let addedCount = 0;
    let blockedCount = 0;
    for (const marker of selectedMarkers) {
      let lat = Number(marker.latitude);
      let lon = Number(marker.longitude);

      if (isNaN(lat) || isNaN(lon)) {
        console.warn('[Planner] Marker has invalid coordinates:', marker.id, lat, lon);
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
        description: undefined
      });
      if (added) {
        addedCount++;
      } else {
        blockedCount++;
      }
    }

    // Открываем настройки и показываем добавленные точки
    setSettingsOpen(true);
    if (blockedCount > 0) {
      alert(`⚠️ Добавлено ${addedCount} из ${selectedMarkers.length} меток. ${blockedCount} заблокировано (запретные зоны).`);
    } else {
      alert(`✅ ${addedCount} меток добавлено в маршрут`);
    }
  };

  const handleFavoriteToggle = useCallback((markerId: string) => {
    // TODO: Реализовать переключение избранного
  }, []);

  const handleLoadRoute = useCallback((routeId: string) => {
    // TODO: Реализовать загрузку маршрута из избранного
  }, []);

  const handleCoordinateSubmit = useCallback(async (lat: number, lon: number) => {
    const pointId = `marker-${Date.now()}`;
    const added = await addPointAndRender({
      id: pointId,
      latitude: lat,
      longitude: lon,
      title: `Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      description: undefined
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
          alert(`❌ Адрес "${address}" не найден`);
          return;
        }
      } catch (e) {
        alert(`❌ Ошибка поиска адреса: ${e}`);
        return;
      }
    }

    const added = await addPointAndRender({
      id: pointId,
      latitude: lat,
      longitude: lon,
      title: address,
      description: undefined
    });
    if (added) {
      setShowSearchForm(false);
    }
  }, [addPointAndRender]);

  // Перестановка точек маршрута из списка в настройках
  const handleReorderPoints = useCallback((newOrder: string[]) => {
    let reorderedLocal: MapMarker[] = [];
    setFacadeMarkers(prev => {
      const byId = new Map(prev.map(m => [m.id, m]));
      const reordered = newOrder.map(id => byId.get(id)).filter(Boolean) as MapMarker[];
      // добавим отсутствующие (если вдруг есть временные метки вне списка)
      prev.forEach(m => { if (m.id && !newOrder.includes(m.id)) reordered.push(m); });
      reorderedLocal = reordered;
      return reordered;
    });
    // Перестраиваем маршрут согласно новому порядку через buildAndSetRoute
    if (reorderedLocal.length >= 2) {
      const routePoints = reorderedLocal
        .filter(m => m.lat !== undefined && m.lon !== undefined)
        .map(m => [m.lat!, m.lon!]);
      buildAndSetRoute(routePoints);
    }
  }, [buildAndSetRoute]);


  return (
    <>
      <MirrorGradientContainer className="page-layout-container page-container planner-mode">
        <div className="page-main-area">
          <div className="page-content-wrapper">
            <div className="page-main-panel relative" style={{ background: 'transparent', borderRadius: 0 }}>
              {/* Старые кнопки удалены - теперь используется PlannerActionButtons */}

              {/* Основной контент */}
              <div className="h-full relative flex flex-col" style={{ width: '100%', height: '100%' }}>
                {/* Стеклянный блок с инструментами: RegionSelector + Запрещенные зоны
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

                  {/* Переключатель запрещенных зон — Layer 2 */}
                  <button
                    onClick={() => setShowZonesLayer(!showZonesLayer)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 glass-l2 ${showZonesLayer ? 'active' : ''}`}
                    style={{
                      ...(showZonesLayer ? {
                        background: 'rgba(76, 201, 240, 0.3)',
                        borderColor: 'rgba(76, 201, 240, 0.5)',
                        color: '#4cc9f0',
                      } : {}),
                    }}
                    title={showZonesLayer ? 'Скрыть запрещённые зоны' : 'Показать запрещённые зоны'}
                  >
                    <FaRoute className="w-4 h-4" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      {showZonesLayer ? 'Зоны' : 'Зоны'}
                    </span>
                  </button>
                </div>

                {/* Кнопки действий планировщика - в двухоконном режиме рендерим ВНЕ map-area чтобы избежать overflow: hidden */}
                {isTwoPanelMode && (
                  <PlannerActionButtons
                    onSettingsClick={() => setSettingsOpen(true)}
                    onFavoritesClick={() => setFavoritesOpen(true)}
                    favoritesCount={(favorites as any)?.favoritePlaces?.length || 0}
                    onLayersClick={() => setShowZonesLayer(!showZonesLayer)}
                    showZonesLayer={showZonesLayer}
                    onClearMapClick={handleClearAllClickMarkers}
                    onSaveRouteClick={() => openTitleModalAndSuggest()}
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
                          onFavoritesClick={() => setFavoritesOpen(true)}
                          favoritesCount={(favorites as any)?.favoritePlaces?.length || 0}
                          onLayersClick={() => setShowZonesLayer(!showZonesLayer)}
                          showZonesLayer={showZonesLayer}
                          onClearMapClick={handleClearAllClickMarkers}
                          onSaveRouteClick={() => openTitleModalAndSuggest()}
                          markersCount={facadeMarkers.length}
                          hasMarkersOrRoutes={facadeMarkers.length > 0 || facadeRoutes.length > 0}
                          isTwoPanelMode={false}
                        />
                      )}

                      {/* Карта: единая инициализация через projectManager */}
                      <div id="planner-map-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      {routeStats && (
                        <div
                          className="pointer-events-none glass-l2"
                          style={{
                            position: 'absolute', top: 12, right: 12,
                            padding: '6px 10px', borderRadius: 8,
                            fontSize: 14, zIndex: 1000
                          }}
                        >
                          {`${routeStats.distanceText} • ${routeStats.durationText}`}
                        </div>
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
                className={`planner-settings-panel${isDarkMode ? ' dark' : ''}`}
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
                      .map((m, index) => ({
                        id: m.id || `marker-${index}`,
                        title: m.title || '',
                        coordinates: [m.lat!, m.lon!],
                        source: 'click' as PointSource,
                        order: index,
                        isActive: true
                      }))}
                    onRemovePoint={(id) => handleRemoveMarker(id)}
                    onTogglePoint={(id) => handleFavoriteToggle(id)}
                    onReorderPoints={handleReorderPoints}
                    onAddCoordinatePoint={() => setShowCoordinateInput(true)}
                    onAddSearchPoint={() => setShowSearchForm(true)}
                    onAddSearchPointFromForm={handleSearchSubmit}
                    onAddFavoritePoint={() => setFavoritesOpen(true)}
                    onBuildRouteFromPoints={() => { }}
                    canBuildRoute={facadeMarkers.length >= 2}
                    isBuilding={false}
                    showSearchForm={showSearchForm}
                    onSearchFormClose={() => setShowSearchForm(false)}
                    routeStats={{
                      distance: 0,
                      duration: 0,
                      totalPoints: facadeMarkers.length,
                      estimatedDistance: 0,
                      estimatedDuration: 0,
                      canBuildRoute: facadeMarkers.length >= 2
                    }}
                  />
                </div>
              </GlassPanel>

              {/* Правая выдвигающаяся панель с избранным — используем готовый favorites из контекста (уже MarkerData[]) */}
              <FavoritesPanel
                favorites={(favorites as any)?.favorites || []}
                routes={(favorites?.favoriteRoutes || []).map((r: any) => ({
                  id: r.id,
                  title: r.title || '',
                  description: r.description || '',
                  points: Array.isArray(r.points) ? r.points.map((pt: any) => ({
                    id: pt.id || '',
                    latitude: pt.latitude,
                    longitude: pt.longitude,
                    title: pt.title || '',
                    description: pt.description || '',
                  })) : [],
                  tags: r.tags || [],
                  waypoints: r.waypoints || [],
                  createdAt: r.createdAt || r.created_at || '',
                  updatedAt: r.updatedAt || r.updated_at || '',
                  is_user_modified: r.is_user_modified || false,
                  used_in_blogs: r.used_in_blogs || false,
                }))}
                isVip={false}
                onRemove={(id) => {
                  (favorites as any)?.removeFavoritePlace?.(id);
                }}
                onClose={() => setFavoritesOpen(false)}
                onBuildRoute={(ids: string[]) => handleBuildRouteFromFavorites(ids && ids.length ? ids : selectedMarkerIds)}
                onMoveToPlanner={(ids: string[]) => handleMoveToPlanner(ids && ids.length ? ids : selectedMarkerIds)}
                onMoveToMap={() => { }}
                onLoadRoute={(route) => handleLoadRoute(route.id)}
                onRouteToggle={(route, checked) => handleRouteToggle(route, checked)}
                mode="planner"
                initialTab={favoritesTab}
                selectedMarkerIds={selectedMarkerIds}
                onSelectedMarkersChange={setSelectedMarkerIds}
                selectedRouteIds={selectedRouteIds}
                onSelectedRouteIdsChange={setSelectedRouteIds}
                isOpen={favoritesOpen}
                constrainToMapArea={isTwoPanelMode}
              />

              {/* Старые кнопки удалены - теперь в стеклянном меню PlannerActionButtons */}

              {/* Модальные окна */}
              {showCoordinateInput && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--glass-overlay)' }}>
                  <div className="glass-l1-strong" style={{ borderRadius: 16, padding: 24, width: 384 }}>
                    <h3 className="text-lg font-semibold mb-4">Ввод координат</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Широта</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="55.751244"
                          className="w-full p-2 border rounded"
                          id="lat-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Долгота</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="37.618423"
                          className="w-full p-2 border rounded"
                          id="lon-input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCoordinateInput(false)}
                          className="px-4 py-2 bg-gray-300 rounded"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => {
                            const lat = parseFloat((document.getElementById('lat-input') as HTMLInputElement)?.value || '0');
                            const lon = parseFloat((document.getElementById('lon-input') as HTMLInputElement)?.value || '0');
                            if (lat && lon) {
                              handleCoordinateSubmit(lat, lon);
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
                      id="planner-address-input"
                      type="text"
                      placeholder="Введите адрес..."
                      className="w-full p-2 border rounded mb-4"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const address = (e.target as HTMLInputElement).value;
                          if (address) {
                            // Геокодируем адрес через Яндекс Geocoder
                            handleSearchSubmit(address);
                          }
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const input = document.getElementById('planner-address-input') as HTMLInputElement;
                          if (input?.value) handleSearchSubmit(input.value);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Найти
                      </button>
                      <button
                        onClick={() => setShowSearchForm(false)}
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
                            (((favorites as any)?.favoritePlaces || []) as any[]).map((p: any) => String(p.id))
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
                            (((favorites as any)?.favoritePlaces || []) as any[]).map((p: any) => String(p.id))
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
              <div className={`page-overlay ${(settingsOpen || favoritesOpen) ? 'active' : ''}`} />
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