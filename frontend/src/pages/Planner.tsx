import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { FaStar, FaRoute, FaHeart, FaCog } from 'react-icons/fa';
import FivePointStar from '../components/Map/FivePointStar';
import PlannerActionButtons from '../components/Planner/PlannerActionButtons';
import { getAllZones, checkRoute } from '../services/zoneService';
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
import { useRussiaRestrictions } from '../hooks/useRussiaRestrictions';
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
      // Автоматически добавляем событие в маршрут
      addRoutePoint({
        id: currentEventId,
        latitude: selectedEvent.latitude,
        longitude: selectedEvent.longitude,
        title: selectedEvent.title,
        description: selectedEvent.description || undefined
      });
    }
  }, [selectedEvent, routePointsFromContext, removeRoutePoint, addRoutePoint]);

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
  const handleAddEventToRoute = useCallback((event: MockEvent) => {
    // Проверяем на null/undefined, а не на falsy значения (0 - валидная координата)
    if (event.latitude == null || event.longitude == null || isNaN(event.latitude) || isNaN(event.longitude)) {
      alert('❌ У события нет координат для добавления в маршрут');
      return;
    }

    // Добавляем событие как точку маршрута в контекст
    // useEffect автоматически синхронизирует routePointsFromContext с facadeMarkers
    addRoutePoint({
      id: `event-${event.id}`,
      latitude: event.latitude,
      longitude: event.longitude,
      title: event.title,
      description: event.description || undefined
    });

    // Открываем настройки маршрута, чтобы пользователь увидел добавленную точку
    setSettingsOpen(true);

    alert(`✅ Событие "${event.title}" добавлено в маршрут!`);
  }, [addRoutePoint]);

  // УБРАНО: Маркеры событий теперь добавляются через синхронизацию routePointsFromContext с facadeMarkers
  // FacadeMap автоматически отрисовывает маркеры из facadeMarkers, поэтому не нужно добавлять их напрямую через mapFacade

  // Очистка при смене провайдера - убрано, так как только Яндекс

  // Стабильный обработчик клика по карте (без зависимости от состояния)
  const handleMapClick = useCallback((coordinates: [number, number]) => {
    // Добавляем точку в routePointsFromContext - useEffect синхронизирует с facadeMarkers
    const pointId = `marker-${Date.now()}`;
    addRoutePoint({
      id: pointId,
      latitude: coordinates[0],
      longitude: coordinates[1],
      title: `Точка ${(routePointsFromContext?.length || 0) + 1}`,
      description: undefined
    });
  }, [addRoutePoint, routePointsFromContext]);

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
      // Удаляем из состояния и принудительно перерисовываем карту
      setFacadeRoutes(prev => prev.filter(r => r.id !== `fav-route-${rid}`));
      try {
        const mapApi = projectManager.getMapApi();
        mapApi.clear({ force: true });
      } catch { }
      // Принудительный ре-инициализатор для FacadeMap
      setMapResetKey(k => k + 1);
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

      // Для routing service нужен формат [lon, lat]
      const orsPoints = normalized.map(([lat, lon]) => [lon, lat] as [number, number]);

      // Попытка запросить маршрут через routing-сервис
      let builtPolyline: [number, number][] | null = null;
      try {
        const result = await getRoutePolyline(orsPoints, 'driving-car');
        if (Array.isArray(result) && result.length >= 2) {
          builtPolyline = normalizePolyline(result);
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
        id: `route-${Date.now()}`,
        points: builtPolyline,
        color: '#3B82F6'
      };

      // Добавляем маршрут в состояние - FacadeMap отрисует его через props
      setFacadeRoutes(prev => {
        // Удаляем старые авто-маршруты
        const filtered = prev.filter(r => !r.id?.startsWith('auto-route-'));
        return [...filtered, route];
      });

      // Сохраняем точки в контекст планировщика
      setRoutePoints?.(normalized.map((p, idx) => ({
        id: String(idx + 1),
        latitude: p[0],
        longitude: p[1],
        title: `Точка ${idx + 1}`
      })));

      return route;
    } catch {
      return null;
    } finally {
      setIsBuilding(false);
    }
  }, [setRoutePoints, setFacadeRoutes]);

  const handleBuildRouteFromFavorites = useCallback(async (markerIds: string[]) => {
    const selectedMarkers = markerIds
      .map(id => (favorites as any)?.favoritePlaces?.find((m: any) => m.id === id))
      .filter((m): m is MarkerData => Boolean(m));

    if (selectedMarkers.length < 2) {
      alert('❌ Для построения маршрута нужно минимум 2 точки');
      return;
    }

    // Используем единую функцию buildAndSetRoute
    const routePoints = selectedMarkers.map(m => [Number(m.latitude), Number(m.longitude)]);
    const route = await buildAndSetRoute(routePoints);

    if (route) {
      alert(`✅ Маршрут построен из ${selectedMarkers.length} точек!`);
    }
  }, [favorites, buildAndSetRoute]);

  const handleClearAllClickMarkers = useCallback(() => {
    try {
      const mapApi = projectManager.getMapApi();
      if (mapApi && mapApi.clear) {
        mapApi.clear();
      }
    } catch {
      // Игнорируем ошибки
    }
    setFacadeMarkers([]);
    setFacadeRoutes([]);
    alert('✅ Карта очищена');
  }, []);

  const handleFinalSaveRoute = useCallback(async (routeData: RouteCreationData) => {

    if (!user || !token) {
      alert('❌ Необходимо войти в систему');
      return;
    }

    try {
      // Обеспечиваем валидные marker_id: создаем отсутствующие маркеры на бэке
      const isUuid = (s: string | undefined) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      let ensuredMarkerIds: string[] = [];
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
    setFacadeMarkers(prev => prev.filter(m => m.id !== markerId));
    // Также удаляем из routePoints контекста, если это точка маршрута
    if (removeRoutePoint) {
      removeRoutePoint(markerId);
    }
  };

  const handleMoveToPlanner = async (ids: string[]) => {

    // Получаем метки из избранного
    const favoritePlaces = (favorites as any)?.favoritePlaces || [];
    const selectedMarkers = ids
      .map(id => favoritePlaces.find((m: any) => m.id === id))
      .filter((m): m is MarkerData => Boolean(m));


    if (selectedMarkers.length === 0) {
      alert('❌ Не найдено меток для переноса');
      return;
    }

    // Добавляем метки в routePointsFromContext, корректируя возможную путаницу lat/lon по границам РФ
    selectedMarkers.forEach(marker => {
      let lat = Number(marker.latitude);
      let lon = Number(marker.longitude);

      if (isNaN(lat) || isNaN(lon)) {
        return;
      }

      // Если пара (lat, lon) вне РФ, а (lon, lat) внутри РФ — считаем, что была путаница местами
      if (!isWithinRussiaBounds(lat, lon) && isWithinRussiaBounds(lon, lat)) {
        const tmp = lat; lat = lon; lon = tmp;
      }

      // Добавляем точку в routePointsFromContext - useEffect синхронизирует с facadeMarkers
      addRoutePoint({
        id: marker.id,
        latitude: lat,
        longitude: lon,
        title: marker.title || 'Место из избранного',
        description: undefined
      });
    });

    // Маршрут будет построен автоматически через useEffect, который следит за facadeMarkers

    // Открываем настройки и показываем добавленные точки
    setSettingsOpen(true);
    alert(`✅ ${selectedMarkers.length} меток добавлено в маршрут`);
  };

  const handleFavoriteToggle = useCallback((markerId: string) => {
    // TODO: Реализовать переключение избранного
  }, []);

  const handleLoadRoute = useCallback((routeId: string) => {
    // TODO: Реализовать загрузку маршрута из избранного
  }, []);

  const handleCoordinateSubmit = useCallback((lat: number, lon: number) => {
    // Добавляем точку в routePointsFromContext - useEffect синхронизирует с facadeMarkers
    const pointId = `marker-${Date.now()}`;
    addRoutePoint({
      id: pointId,
      latitude: lat,
      longitude: lon,
      title: `Точка ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      description: undefined
    });
    setShowCoordinateInput(false);
  }, [addRoutePoint]);

  const handleSearchSubmit = useCallback((address: string, coordinates: [number, number]) => {
    // Добавляем точку в routePointsFromContext - useEffect синхронизирует с facadeMarkers
    const pointId = `marker-${Date.now()}`;
    addRoutePoint({
      id: pointId,
      latitude: coordinates[0],
      longitude: coordinates[1],
      title: address,
      description: undefined
    });
    setShowSearchForm(false);
  }, [addRoutePoint]);

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
                  className="absolute flex items-center gap-3"
                  style={{
                    // Отступ сверху - больше в двухоконном режиме
                    top: isTwoPanelMode ? '80px' : '16px',
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
                    zIndex: 9999,
                    // Включаем события мыши для этого блока
                    pointerEvents: 'auto'
                  }}
                >
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
                        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Загрузка карты...</p>
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
                          className="pointer-events-none"
                          style={{
                            position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.85)',
                            padding: '6px 10px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            fontSize: 14, color: '#111827', zIndex: 1000
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
                className="planner-settings-panel"
                constrainToMapArea={isTwoPanelMode}
              >
                <GlassHeader
                  title="Настройки маршрута"
                  onClose={() => setSettingsOpen(false)}
                  showCloseButton={true}
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

              {/* Правая выдвигающаяся панель с избранным - использует GlassPanel внутри */}
              <FavoritesPanel
                favorites={(favorites?.favoritePlaces || []).map((p: any) => ({
                  id: p.id,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  title: p.title || '',
                  description: p.description || '',
                  address: p.address || '',
                  category: p.category || '',
                  subcategory: p.subcategory || '',
                  rating: p.rating || 0,
                  rating_count: p.rating_count || 0,
                  photo_urls: p.photo_urls || [],
                  hashtags: p.hashtags || [],
                  is_verified: p.is_verified || false,
                  creator_id: p.creator_id || '',
                  author_name: p.author_name || '',
                  created_at: p.created_at || '',
                  updated_at: p.updated_at || '',
                  likes_count: p.likes_count || 0,
                  comments_count: p.comments_count || 0,
                  shares_count: p.shares_count || 0,
                  visibility: p.visibility || '',
                  marker_type: p.marker_type || 'standard',
                  is_active: p.is_active || false,
                  metadata: p.metadata || {},
                  views_count: p.views_count || 0,
                  subcategory_id: p.subcategory_id || '',
                  content_id: p.content_id || '',
                  content_type: p.content_type || '',
                  used_in_blogs: p.used_in_blogs || false,
                  is_user_modified: p.is_user_modified || false,
                  completeness_score: p.completeness_score || 0,
                  completenessScore: p.completenessScore || 0,
                  is_draft: p.is_draft || false,
                  status: p.status || 'active',
                  is_pending: p.is_pending || false,
                }))}
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
                mode="map"
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg w-96">
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg w-96">
                    <h3 className="text-lg font-semibold mb-4">Поиск адреса</h3>
                    <input
                      type="text"
                      placeholder="Введите адрес..."
                      className="w-full p-2 border rounded mb-4"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const address = (e.target as HTMLInputElement).value;
                          if (address) {
                            // Упрощенный поиск - используем координаты Москвы
                            handleSearchSubmit(address, [55.751244, 37.618423]);
                          }
                        }
                      }}
                    />
                    <div className="flex gap-2">
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg w-[480px] max-w-[92vw]">
                    <h3 className="text-lg font-semibold mb-3">Название маршрута</h3>
                    <p className="text-sm text-gray-600 mb-3">Выберите предложенный вариант или введите свой.</p>
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
                    <div className="mt-3 text-sm text-gray-600">
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