import React, { useEffect, useRef, useState, useCallback } from 'react';
import FilterTabs from '../../components/Mobile/FilterTabs';
import MobileMapSettings from '../../components/Mobile/MobileMapSettings';
import MobileFavoritesPanel from '../../components/Mobile/MobileFavoritesPanel';
import MobileSlidePanel from '../../components/Mobile/MobileSlidePanel';
import CoordinateInput from '../../components/Planner/CoordinateInput';
import RouteCategoryModal, { RouteCreationData } from '../../components/Planner/RouteCategoryModal';
import { Layers, Navigation, Settings, Search, X, MapPin, ArrowUp, ArrowDown, Star, Trash2, Save, Minimize2, Building2 } from 'lucide-react';
import { FaTrafficLight } from 'react-icons/fa';
import { cn } from '../../lib/utils';
import { mapFacade, MapMarker, Route } from '../../services/map_facade/index';
import { useMapFilters } from '../../hooks/useMapFilters';
import { useMapSearch } from '../../hooks/useMapSearch';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import SearchResultsDropdown from '../../components/Search/SearchResultsDropdown';
import { RoutePlannerProvider, useRoutePlanner } from '../../contexts/RoutePlannerContext';
import { useRouteBuilder } from '../../hooks/useRouteBuilder';
import { useMapStateStore, mapStateHelpers } from '../../stores/mapStateStore';
import { getYandexControl, getYandexMapFromPlannerContainer, toggleYandexControlExpanded } from '../../utils/yandexControls';
import { useLocation, useNavigate } from 'react-router-dom';
import { geocodingService, Place } from '../../services/geocodingService';
import { useContentStore } from '../../stores/contentStore';
import { useFavoritesPanel } from '../../hooks/useFavoritesPanel';
import { projectManager } from '../../services/projectManager';
import { useAuth } from '../../contexts/AuthContext';
import { createRoute, getRoutes } from '../../api/routes';
import { getAlternativeRoutes, RouteAlternative, RouteAlternativeId } from '../../services/routingService';
import type { MapConfig } from '../../services/map_facade/index';

const PlannerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const provider = 'yandex'; // Используем Yandex Maps для построения маршрутов по дорогам
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [showCoordinateInput, setShowCoordinateInput] = useState(false);
  const [openRouteSection, setOpenRouteSection] = useState<string>('');
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  const [flyToCoordinates, setFlyToCoordinates] = useState<[number, number] | null>(null);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedAltId, setSelectedAltId] = useState<RouteAlternativeId>('shortest');
  
  // Примечание: управление видимостью Leaflet портала (#global-map-root) 
  // теперь происходит в MobilePageLayer, а не здесь.
  // Это предотвращает race conditions при переключении между Map и Planner.

  // Сбрасываем открытые разделы при открытии меню маршрутов
  useEffect(() => {
    if (routesOpen) {
      setOpenRouteSection('');
    }
  }, [routesOpen]);

  // Получаем текущий контент для определения видимости страницы
  const leftContent = useContentStore((state) => state.leftContent);
  const isPlannerVisible = leftContent === 'planner';

  // === ИНИЦИАЛИЗАЦИЯ YANDEX MAP ===
  // Флаг инициализации карты — предотвращает повторную инициализацию
  const isMapInitializedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [facadeMarkers, setFacadeMarkers] = useState<any[]>([]);

  // Инициализация карты при mount и при изменении видимости
  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 30;

    const initializeMap = async () => {
      // Проверяем, была ли карта уже инициализирована
      if (isMapInitializedRef.current) {
        console.log('[PlannerPage Mobile] Map already initialized, skipping');
        setIsMapReady(true);
        return;
      }

      // Проверяем, видима ли страница
      if (!isPlannerVisible) {
        console.log('[PlannerPage Mobile] Page not visible, skipping initialization');
        return;
      }

      // Сбрасываем localStorage при каждой загрузке - доверяем useRef
      try { localStorage.removeItem('mobile_planner_map_initialized'); } catch {}

      let container = document.getElementById('planner-map-container');
      while ((!container || container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < maxAttempts && isMounted) {
        await new Promise(resolve => setTimeout(resolve, 100));
        container = document.getElementById('planner-map-container');
        attempts++;
      }
      if (!container || !isMounted) return;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;

      const savedState = mapStateHelpers.getCenterAndZoom('planner');
      const config: MapConfig = {
        provider: 'yandex',
        center: savedState.center,
        zoom: savedState.zoom,
        markers: [],
        routes: [],
        preserveState: true,
        context: 'planner',
      };

      try {
        await projectManager.initializeMap(container, config);
        if (isMounted) {
          // Сохраняем флаг инициализации в localStorage
          localStorage.setItem('mobile_planner_map_initialized', 'true');
          isMapInitializedRef.current = true;
          setIsMapReady(true);
          console.log('[PlannerPage Mobile] Map initialized successfully');

          // Нативные контролы Yandex будут добавлены внутри YandexPlannerRenderer,
          // так карта сама отвечает за свои собственные компоненты.
        }
      } catch (error) {
        console.error('[PlannerPage Mobile] Map initialization error:', error);
      }
    };

    initializeMap();
    return () => { isMounted = false; };
  }, [isPlannerVisible]); // Зависит от видимости страницы

  // Обновление размеров карты при изменении видимости
  useEffect(() => {
    if (!isMapReady || !isPlannerVisible) return;

    // Небольшая задержка, чтобы DOM обновился
    const timeoutId = setTimeout(() => {
      try {
        const mapApi = projectManager.getMapApi?.();
        const map = mapApi?.map || mapApi?.mapInstance;
        if (map && typeof map.container?.fitToViewport === 'function') {
          map.container.fitToViewport();
        } else if (map && typeof map.invalidateSize === 'function') {
          // Для Leaflet совместимости
          map.invalidateSize();
        }
        console.log('[PlannerPage Mobile] Map resized after visibility change');
      } catch (e) {
        console.warn('[PlannerPage Mobile] Failed to resize map:', e);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isMapReady, isPlannerVisible]);

  const renderMarkersOnMap = useCallback((markers: any[]) => {
    const resolveMarkerCategory = (source: string | undefined) => {
      if (source === 'favorites') return 'favorite';
      if (source === 'event') return 'event';
      if (source === 'click') return 'map-click';
      if (source === 'coordinates') return 'coordinates';
      if (source === 'search' || source === 'address') return 'address';
      return 'route-point';
    };

    const resolveMarkerColor = (category?: string) => {
      switch (category) {
        case 'favorite': return '#F59E0B';
        case 'event': return '#7C3AED';
        case 'map-click': return '#3B82F6';
        case 'coordinates': return '#10B981';
        case 'address': return '#EF4444';
        case 'route-point': return '#6366F1';
        default: return '#3B82F6';
      }
    };

    try {
      const mapApi = projectManager.getMapApi?.();
      if (!mapApi) return;

      // Вычисляем номера: последовательно только для АКТИВНЫХ маркеров
      let activeNum = 0;
      const numberedMarkers = markers.map(m => ({
        ...m,
        _num: (m as any).isActive !== false ? ++activeNum : undefined,
      }));

      if (typeof mapApi.renderMarkers === 'function') {
        mapApi.renderMarkers(numberedMarkers.map(m => ({
          id: m.id || `m-${Date.now()}`,
          coordinates: { lat: Number(m.lat ?? m.latitude), lon: Number(m.lon ?? m.longitude) },
          title: m.title || m.name || '',
          category: m.category || resolveMarkerCategory(m.source),
          number: (m as any)._num,
        })));
        return;
      }
      // Fallback: напрямую через Яндекс API
      const ymaps = (window as any).ymaps;
      const map = mapApi?.map || mapApi?.mapInstance;
      if (!map || !ymaps) return;
      const collection = new ymaps.GeoObjectCollection();
      numberedMarkers.forEach(m => {
        const lat = Number(m.lat ?? m.latitude);
        const lon = Number(m.lon ?? m.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const category = m.category || resolveMarkerCategory(m.source);
        const color = resolveMarkerColor(category);
        const num = (m as any)._num;
        const fs = num && String(num).length > 1 ? 9 : 11;
        const svgMarker = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C8.268 1 2 7.268 2 15c0 8.5 14 27 14 27s14-18.5 14-27C30 7.268 23.732 1 16 1z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/><circle cx="16" cy="14" r="9" fill="#fff"/>${num ? `<text x="16" y="14" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="${fs}" font-weight="bold" font-family="Arial,sans-serif">${num}</text>` : ''}</svg>`;
        collection.add(new ymaps.Placemark([lat, lon],
          { balloonContent: m.title || m.name || '', iconCaption: m.title || m.name || '' },
          { iconLayout: 'default#image', iconImageHref: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarker)}`, iconImageSize: [32, 42], iconImageOffset: [-16, -42] }
        ));
      });
      if ((window as any).__plannerMobileMarkersCollection) {
        try { map.geoObjects.remove((window as any).__plannerMobileMarkersCollection); } catch {}
      }
      map.geoObjects.add(collection);
      (window as any).__plannerMobileMarkersCollection = collection;
    } catch (e) {
      console.warn('[PlannerPage Mobile] renderMarkersOnMap error:', e);
    }
  }, []);

  // Re-render markers when they change
  useEffect(() => {
    if (!isMapReady || facadeMarkers.length === 0) return;
    renderMarkersOnMap(facadeMarkers);
  }, [isMapReady, facadeMarkers, renderMarkersOnMap]);

  // === РЕГИСТРАЦИЯ КЛИКА ПО КАРТЕ (идентично desktop Planner) ===
  const clickRegisteredRef = useRef(false);
  const handleMapClickRef = useRef<((coords: [number, number]) => void) | null>(null);

  useEffect(() => {
    if (!isMapReady || clickRegisteredRef.current) return;

    // Способ 1: через mapApi.onClick
    try {
      const mapApi = projectManager.getMapApi?.();
      if (mapApi && typeof mapApi.onClick === 'function') {
        mapApi.onClick((coords: [number, number]) => {
          handleMapClickRef.current?.(coords);
        });
        clickRegisteredRef.current = true;
      }
    } catch (e) { console.warn('[PlannerPage Mobile] mapApi.onClick failed:', e); }

    // Способ 2: через mapFacade
    if (!clickRegisteredRef.current) {
      try {
        const facade = mapFacade();
        if (facade && typeof facade.onClick === 'function') {
          facade.onClick((coords: [number, number]) => {
            handleMapClickRef.current?.(coords);
          });
          clickRegisteredRef.current = true;
        }
      } catch (e) { console.warn('[PlannerPage Mobile] facade.onClick failed:', e); }
    }

    // Способ 3: напрямую через Яндекс API
    if (!clickRegisteredRef.current) {
      try {
        const mapApi = projectManager.getMapApi?.();
        const map = mapApi?.map || mapApi?.mapInstance;
        if (map && map.events) {
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            if (coords && Array.isArray(coords)) {
              handleMapClickRef.current?.([coords[0], coords[1]]);
            }
          });
          clickRegisteredRef.current = true;
        }
      } catch (e) { console.warn('[PlannerPage Mobile] direct click failed:', e); }
    }
  }, [isMapReady]);
  
  // Обработчики для работы с точками маршрута (используем общий хук)
  const builder = useRouteBuilder();
  const routePoints = builder.activePoints;

  // === КРИТИЧНО: Синхронизация routePolyline → рендеринг маршрута на Яндекс карте ===
  // Идентично desktop Planner: рендерим полилинию, полученную из useRouteBuilder, на карте
  const renderedRouteIdRef = useRef<string>('');
  const lastPolylineKeyRef = useRef<string>('');

  const clearRenderedRouteOnMap = useCallback(() => {
    try {
      const mapApi = projectManager.getMapApi?.();
      if (renderedRouteIdRef.current && mapApi && typeof mapApi.removeRoute === 'function') {
        mapApi.removeRoute(renderedRouteIdRef.current);
      }
      const map = mapApi?.map || mapApi?.mapInstance;
      if ((window as any).__plannerMobileRouteGeom && map) {
        try { map.geoObjects.remove((window as any).__plannerMobileRouteGeom); } catch {}
        (window as any).__plannerMobileRouteGeom = null;
      }
    } catch {}
    renderedRouteIdRef.current = '';
    lastPolylineKeyRef.current = '';
  }, []);

  const renderRouteOnMap = useCallback((rawPolyline: Array<[number, number]>, routeId: string) => {
    // Фильтруем NaN-координаты перед передачей в Яндекс карту
    const polyline = rawPolyline.filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (!polyline || polyline.length < 2) return;
    
    try {
      const mapApi = projectManager.getMapApi?.();
      if (!mapApi) return;

      // Создаём ключ для сравнения (чтобы не перерисовывать идентичный маршрут)
      const polylineKey = polyline.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join('|');
      if (polylineKey === lastPolylineKeyRef.current) return;
      lastPolylineKeyRef.current = polylineKey;

      // Если есть предыдущий маршрут — удаляем его
      if (renderedRouteIdRef.current && typeof mapApi.removeRoute === 'function') {
        mapApi.removeRoute(renderedRouteIdRef.current);
      }

      // Рендерим новый маршрут
      if (typeof mapApi.renderRoute === 'function') {
        mapApi.renderRoute({
          id: routeId,
          geometry: polyline,
          color: '#3B82F6' // Синий маршрут как в desktop
        });
        renderedRouteIdRef.current = routeId;
        console.log('[PlannerPage Mobile] Route rendered:', polyline.length, 'points');
      } else {
        // Fallback: напрямую через Яндекс API
        const ymaps = (window as any).ymaps;
        const map = mapApi?.map || mapApi?.mapInstance;
        if (!map || !ymaps) return;

        // Удаляем предыдущую геометрию
        if ((window as any).__plannerMobileRouteGeom) {
          try { map.geoObjects.remove((window as any).__plannerMobileRouteGeom); } catch {}
        }

        // Создаём новую линию
        const lineString = new ymaps.GeoObjectCollection();
        const polylineObj = new ymaps.Polyline(
          polyline.map(([lat, lon]) => [lat, lon]),
          {},
          {
            strokeColor: '#3B82F6',
            strokeWidth: 4,
            strokeOpacity: 0.8,
          }
        );
        lineString.add(polylineObj);
        map.geoObjects.add(lineString);
        (window as any).__plannerMobileRouteGeom = lineString;
        renderedRouteIdRef.current = routeId;
        console.log('[PlannerPage Mobile] Route rendered via fallback:', polyline.length, 'points');
      }
    } catch (e) {
      console.warn('[PlannerPage Mobile] renderRouteOnMap error:', e);
    }
  }, []);

  // Синхронизируем routePolyline из builder с картой
  useEffect(() => {
    if (!isMapReady) return;
    if (routeAlternatives.length > 0) return;
    
    const { routePolyline, isBuilding } = builder.routeState;
    
    // Не рендерим если идёт построение
    if (isBuilding) return;
    
    // Очищаем маршрут если полилиния пуста
    if (!routePolyline || routePolyline.length < 2) {
      if (renderedRouteIdRef.current) {
        try {
          const mapApi = projectManager.getMapApi?.();
          if (mapApi && typeof mapApi.removeRoute === 'function') {
            mapApi.removeRoute(renderedRouteIdRef.current);
          }
        } catch {}
        renderedRouteIdRef.current = '';
        lastPolylineKeyRef.current = '';
      }
      return;
    }

    // Рендерим маршрут
    const routeId = 'mobile-route-auto';
    renderRouteOnMap(routePolyline, routeId);
    setRouteGeometry(routePolyline);
  }, [isMapReady, builder.routeState.routePolyline, builder.routeState.isBuilding, renderRouteOnMap, routeAlternatives.length]);

  // Рендерим альтернативы маршрута на карте так же, как в desktop Planner
  useEffect(() => {
    const mapApi = projectManager.getMapApi?.() as any;
    if (!isMapReady || !mapApi) return;

    if (routeAlternatives.length === 0) {
      if (typeof mapApi.clearAlternatives === 'function') {
        mapApi.clearAlternatives();
      }
      return;
    }

    clearRenderedRouteOnMap();

    if (typeof mapApi.renderAlternatives !== 'function') return;

    const displayAlts = routeAlternatives.map(alt => ({
      ...alt,
      isSelected: alt.id === selectedAltId,
    }));

    mapApi.renderAlternatives(displayAlts, (id: string) => {
      setSelectedAltId(id as RouteAlternativeId);
    });
  }, [isMapReady, routeAlternatives, selectedAltId, clearRenderedRouteOnMap]);

  // Выбранная альтернатива становится основным маршрутом для сохранения
  useEffect(() => {
    const selected = routeAlternatives.find(alt => alt.id === selectedAltId) ?? routeAlternatives[0];
    if (!selected) {
      setRouteGeometry([]);
      return;
    }
    setRouteGeometry(selected.polyline);
  }, [routeAlternatives, selectedAltId]);

  // Автоматическое построение маршрута при добавлении 2+ точек из избранного
  // (идентично desktop Planner с autoRoute debounce)
  const autoRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoRouteKeyRef = useRef<string>('');

  useEffect(() => {
    // Вычисляем активные маркеры и ключ здесь — реагируем на изменение порядка и состояния
    const activeMarkers = facadeMarkers.filter(m => (m as any).isActive !== false);
    if (!isMapReady || activeMarkers.length < 2) return;

    // Ключ из активных маркеров: реагирует на изменение порядка, включение/выключение, добавление/удаление
    const markersKey = activeMarkers.map(m => `${Number(m.lat).toFixed(6)},${Number(m.lon).toFixed(6)}`).join('|');
    if (markersKey === lastAutoRouteKeyRef.current) return;

    // Debounce 800ms
    if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
    autoRouteTimerRef.current = setTimeout(async () => {
      const activePts = activeMarkers
        .map(m => [Number(m.lat), Number(m.lon)] as [number, number])
        // Отсекаем NaN до отправки в маршрутизатор
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
      if (activePts.length < 2) return;

      lastAutoRouteKeyRef.current = markersKey;

      // Используем Яндекс маршрутизацию (как в десктопном Planner.tsx)
      // getAlternativeRoutes: shortest = Яндекс, highway/city = ORS
      try {
        const alts = await getAlternativeRoutes(activePts);
        const best = alts.find(a => a.id === 'shortest') ?? alts[0];
        if (best && best.polyline.length >= 2) {
          clearRenderedRouteOnMap();
          setRouteAlternatives(alts);
          setSelectedAltId(best.id);
        } else {
          setRouteAlternatives([]);
          setRouteGeometry([]);
        }
      } catch (err) {
        console.warn('[PlannerPage Mobile] autoRoute error:', err);
        setRouteAlternatives([]);
        setRouteGeometry([]);
      }
    }, 800);

    return () => {
      if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
    };
  }, [isMapReady, facadeMarkers]); // ← весь массив: реагирует на изменение порядка

  const addPointToFacade = (id: string, coords: [number, number], title: string, category: string) => {
    // useEffect([facadeMarkers]) уже вызовет renderMarkersOnMap при изменении состояния
    setFacadeMarkers(prev => [...prev, { id, lat: coords[0], lon: coords[1], title, category }]);
  };

  // Добавление точки + обновление facadeMarkers для рендера на Яндекс карте
  const addPointFromSearch = (address: string, coords: [number, number]) => {
    builder.pointManager.addSearchPoint(address, coords);
    addPointToFacade(`pt-${Date.now()}`, coords, address, 'address');
  };

  const addPointFromCoordinates = (data: { latitude: number; longitude: number; title: string }) => {
    builder.pointManager.addCoordinatePoint([data.latitude, data.longitude], data.title);
    addPointToFacade(`pt-${Date.now()}`, [data.latitude, data.longitude], data.title, 'coordinates');
  };
  const removePoint = builder.pointManager.removePoint;
  const clearPoints = builder.pointManager.clearRoute;
  const reorderPoints = builder.pointManager.reorderPoints;
  const startBuilding = () => {
    // Очищаем предыдущий маршрут перед построением нового
    clearRenderedRouteOnMap();
    // Используем Яндекс маршрутизацию (как в десктопном Planner.tsx)
    const activePts = facadeMarkers
      .filter(m => (m as any).isActive !== false)
      .map(m => [Number(m.lat), Number(m.lon)] as [number, number])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (activePts.length < 2) return;

    getAlternativeRoutes(activePts).then(alts => {
      const best = alts.find(a => a.id === 'shortest') ?? alts[0];
      if (best && best.polyline.length >= 2) {
        setRouteAlternatives(alts);
        setSelectedAltId(best.id);
      } else {
        setRouteAlternatives([]);
        setRouteGeometry([]);
      }
    }).catch(err => {
      console.warn('[PlannerPage Mobile] startBuilding route error:', err);
      setRouteAlternatives([]);
      setRouteGeometry([]);
    });
  };
  const setPoints = (pts: any[]) => {
    // the hook doesn't usually expose a setter, but we keep a shim for any
    // legacy code that calls setPoints.
    builder.pointManager.clearRoute();
    pts.forEach(p => builder.pointManager.addPoint(p));
  };
  
  const handleRemovePoint = (pointId: string) => {
    removePoint(pointId);
    // Удаляем из facadeMarkers (для маркеров добавленных не через избранное)
    setFacadeMarkers(prev => {
      const updated = prev.filter(m => m.id !== pointId);
      if (updated.length === prev.length) return prev;
      lastAutoRouteKeyRef.current = '';
      return updated;
    });
  };
  
  const handleClearAllPoints = () => {
    const hasAnything = (routePoints || []).length > 0 || facadeMarkers.length > 0;
    if (!hasAnything) {
      alert('На карте нет элементов для очистки');
      return;
    }
    if (confirm('Очистить карту? Будут удалены все точки и маршруты')) {
      try {
        clearPoints();
        setFacadeMarkers([]);
        setSelectedMarkerIds([]);
        setRouteAlternatives([]);
        setRouteGeometry([]);
        
        // Очищаем маршрут и маркеры на Яндекс карте
        try {
          const mapApi = projectManager.getMapApi?.() as any;
          if (typeof mapApi?.clearAlternatives === 'function') {
            mapApi.clearAlternatives();
          }
        } catch {}
        try {
          const mapApi = projectManager.getMapApi?.();
          if (mapApi && typeof mapApi.removeRoute === 'function' && renderedRouteIdRef.current) {
            mapApi.removeRoute(renderedRouteIdRef.current);
          }
          if (mapApi && typeof mapApi.renderMarkers === 'function') {
            mapApi.renderMarkers([]);
          }
          const map = mapApi?.map || mapApi?.mapInstance;
          if ((window as any).__plannerMobileRouteGeom && map) {
            try { map.geoObjects.remove((window as any).__plannerMobileRouteGeom); } catch {}
            (window as any).__plannerMobileRouteGeom = null;
          }
          if ((window as any).__plannerMobileMarkersCollection && map) {
            try { map.geoObjects.remove((window as any).__plannerMobileMarkersCollection); } catch {}
            (window as any).__plannerMobileMarkersCollection = null;
          }
        } catch {}
        renderedRouteIdRef.current = '';
        lastPolylineKeyRef.current = '';
        
        alert('✅ Маршрут очищен');
      } catch (error) {
        console.error('[PlannerPage] handleClearAllPoints error:', error);
        alert('❌ Ошибка при очистке маршрута');
      }
    }
  };

  // === МАРШРУТЫ: загружаем с API (как десктоп), чтобы данные совпадали ===
  const [apiFavoriteRoutes, setApiFavoriteRoutes] = useState<any[]>([]);
  useEffect(() => {
    getRoutes(token || undefined).then((loaded) => {
      if (loaded && loaded.length > 0) setApiFavoriteRoutes(loaded);
    }).catch(() => {});
  }, [token]);

  // toggle handler is provided by the shared hook; we only add
  // extra logging for debugging to mimic previous behaviour
  const { markerToggle, selectedMarkerIds, setSelectedMarkerIds, selectedEventIds, favorites } = useFavoritesPanel({
    onMarkerToggle: (place, checked) => {
      console.log('[PlannerPage] hook onMarkerToggle:', {
        placeId: place.id,
        placeName: place.name,
        checked,
        currentRoutePoints: routePoints.length
      });
    },
  });

  // Debug: log favorites and selected marker IDs (ensure they sync)
  useEffect(() => {
    console.log('[PlannerPage] favorites:', favorites?.favoritePlaces?.length ?? 'n/a',
      'selectedMarkerIds:', selectedMarkerIds?.length ?? 0);
  }, [favorites?.favoritePlaces?.length, selectedMarkerIds]);

  useEffect(() => {
    console.log('[PlannerPage] favoriteEvents:', favorites?.favoriteEvents?.length ?? 'n/a',
      'selectedEventIds:', selectedEventIds?.length ?? 0);
  }, [favorites?.favoriteEvents?.length, selectedEventIds]);

  // === МАРШРУТЫ ИЗ ИЗБРАННОГО: selectedRouteIds → рендер на Яндекс-карте ===
  // (портировано из десктопного Planner.tsx)
  const selectedRouteIds: string[] = (favorites as any)?.selectedRouteIds ?? [];
  const setSelectedRouteIds = (favorites as any)?.setSelectedRouteIds ?? (() => {});

  // Утилита: извлечь массив [lat, lon][] из объекта маршрута
  const extractRoutePoints = useCallback((route: any): [number, number][] => {
    try {
      let pts: any[] = [];
      if (Array.isArray(route?.points) && route.points.length > 0) {
        pts = route.points;
      } else if (route?.route_data) {
        const rd = typeof route.route_data === 'string' ? JSON.parse(route.route_data) : route.route_data;
        if (Array.isArray(rd?.points)) pts = rd.points;
      }
      if (pts.length === 0 && Array.isArray(route?.waypoints) && route.waypoints.length > 0) {
        const markersById = new Map(((favorites as any)?.favoritePlaces || []).map((m: any) => [m.id, m]));
        pts = route.waypoints
          .map((wp: any) => markersById.get(wp.marker_id))
          .filter(Boolean)
          .map((m: any) => ({ latitude: m.latitude ?? m.coordinates?.[0], longitude: m.longitude ?? m.coordinates?.[1] }));
      }
      return (pts || []).map((p: any) => {
        if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])] as [number, number];
        const a = Number(p?.latitude ?? p?.lat);
        const b = Number(p?.longitude ?? p?.lon ?? p?.lng);
        return Number.isFinite(a) && Number.isFinite(b) ? [a, b] as [number, number] : null;
      }).filter(Boolean) as [number, number][];
    } catch { return []; }
  }, [favorites]);

  // Утилита: извлечь точки с id/title для маркеров
  const extractRoutePointsFull = useCallback((route: any): Array<{ id: string; lat: number; lon: number; title: string }> => {
    try {
      let pts: any[] = [];
      if (Array.isArray(route?.points) && route.points.length > 0) pts = route.points;
      else if (route?.route_data) {
        const rd = typeof route.route_data === 'string' ? JSON.parse(route.route_data) : route.route_data;
        if (Array.isArray(rd?.points)) pts = rd.points;
      }
      if (pts.length === 0 && Array.isArray(route?.waypoints)) {
        const markersById = new Map(((favorites as any)?.favoritePlaces || []).map((m: any) => [m.id, m]));
        pts = route.waypoints.map((wp: any) => markersById.get(wp.marker_id)).filter(Boolean);
      }
      return (pts || []).map((p: any, idx: number) => {
        const lat = Number(p?.latitude ?? p?.lat ?? (Array.isArray(p) ? p[0] : NaN));
        const lon = Number(p?.longitude ?? p?.lon ?? p?.lng ?? (Array.isArray(p) ? p[1] : NaN));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { id: String(p?.id || p?.marker_id || `pt-${idx}`), lat, lon, title: p?.title || p?.name || `Точка ${idx + 1}` };
      }).filter(Boolean) as Array<{ id: string; lat: number; lon: number; title: string }>;
    } catch { return []; }
  }, [favorites]);

  // Синхронизация selectedRouteIds → рендер маршрутов на Яндекс-карте
  const prevSelectedRouteIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevSelectedRouteIdsRef.current;
    const currentIds = selectedRouteIds.map(String);
    const addedIds = currentIds.filter((id: string) => !prevIds.includes(id));
    const removedIds = prevIds.filter((id: string) => !currentIds.includes(id));
    prevSelectedRouteIdsRef.current = currentIds;
    if (addedIds.length === 0 && removedIds.length === 0) return;

    // Источник маршрутов: API (свежие) > IndexedDB (fallback)
    const favoriteRoutes = apiFavoriteRoutes.length > 0
      ? apiFavoriteRoutes
      : ((favorites as any)?.favoriteRoutes || []);

    // Рисуем добавленные маршруты
    addedIds.forEach((routeId: string) => {
      const route = favoriteRoutes.find((r: any) => String(r.id) === routeId);
      if (!route) return;
      const points = extractRoutePoints(route);
      if (points.length < 2) return;

      // Добавляем маркеры точек маршрута
      let markerPts = extractRoutePointsFull(route);
      if (markerPts.length === 0 && points.length > 0) {
        markerPts = points.map((p, idx) => ({ id: `pt-${idx}`, lat: p[0], lon: p[1], title: `Точка ${idx + 1}` }));
      }
      if (markerPts.length > 0) {
        setFacadeMarkers(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMarkers = markerPts
            .filter(p => !existingIds.has(`route-${routeId}-${p.id}`))
            .map(p => ({ id: `route-${routeId}-${p.id}`, lat: p.lat, lon: p.lon, title: p.title, category: 'saved-route', source: 'saved-route' }));
          const updated = [...prev, ...newMarkers];
          setTimeout(() => renderMarkersOnMap(updated), 0);
          return updated;
        });
      }
    });

    // Удаляем снятые маршруты
    removedIds.forEach((routeId: string) => {
      const mapApi = projectManager.getMapApi?.();
      if (mapApi && typeof mapApi.removeRoute === 'function') {
        mapApi.removeRoute(`fav-route-${routeId}`);
      }
      setFacadeMarkers(prev => prev.filter(m => !String(m.id).startsWith(`route-${routeId}-`)));
    });
  }, [selectedRouteIds, favorites, apiFavoriteRoutes, extractRoutePoints, extractRoutePointsFull, renderMarkersOnMap]);

  // === СИНХРОНИЗАЦИЯ: selectedMarkerIds → route builder ===
  // Когда пользователь ставит/снимает галочку в панели избранного,
  // добавляем/удаляем точку маршрута через builder (как в Planner.tsx desktop).
  const prevSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevSelectedIdsRef.current;
    const currentIds = selectedMarkerIds || [];
    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    prevSelectedIdsRef.current = currentIds;

    const rawPlaces: any[] = (favorites as any)?.favoritePlaces || [];

    removedIds.forEach(id => {
      builder.pointManager.removePointBySource('favorites', String(id));
    });

    addedIds.forEach(id => {
      const place = rawPlaces.find((p: any) => String(p.id) === String(id));
      if (!place) return;

      const lat = Number(place.latitude ?? (Array.isArray(place.coordinates) ? place.coordinates[0] : undefined));
      const lon = Number(place.longitude ?? (Array.isArray(place.coordinates) ? place.coordinates[1] : undefined));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      builder.pointManager.addFavoritePoint(String(place.id), place.name || 'Место', [lat, lon]);

      // Добавляем в facadeMarkers для рендера на Yandex карте (как desktop Planner)
      setFacadeMarkers(prev => {
        if (prev.some(m => m.id === String(place.id))) return prev;
        return [...prev, { id: String(place.id), lat, lon, title: place.name || 'Место', category: 'favorite' }];
      });
    });

    // Удаляем из facadeMarkers маркеры снятых чекбоксов
    if (removedIds.length > 0) {
      setFacadeMarkers(prev => prev.filter(m => !removedIds.includes(String(m.id))));
    }
  }, [selectedMarkerIds, favorites, renderMarkersOnMap]);

  const prevSelectedEventIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevSelectedEventIdsRef.current;
    const currentIds = selectedEventIds || [];
    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    prevSelectedEventIdsRef.current = currentIds;

    const rawEvents: any[] = (favorites as any)?.favoriteEvents || [];

    removedIds.forEach(id => {
      builder.pointManager.removePointBySource('event', String(id));
    });

    addedIds.forEach(id => {
      const event = rawEvents.find((item: any) => String(item.id) === String(id));
      if (!event) return;

      const lat = Number(event.latitude ?? (Array.isArray(event.coordinates) ? event.coordinates[0] : undefined));
      const lon = Number(event.longitude ?? (Array.isArray(event.coordinates) ? event.coordinates[1] : undefined));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      builder.pointManager.addEventPoint(String(event.id), event.title || 'Событие', [lat, lon]);

      setFacadeMarkers(prev => {
        const markerId = `event-${String(event.id)}`;
        if (prev.some(m => m.id === markerId)) return prev;
        return [...prev, { id: markerId, lat, lon, title: event.title || 'Событие', category: 'event', source: 'event' }];
      });
    });

    if (removedIds.length > 0) {
      const removedMarkerIds = new Set(removedIds.map(id => `event-${String(id)}`));
      setFacadeMarkers(prev => prev.filter(m => !removedMarkerIds.has(String(m.id))));
    }
  }, [selectedEventIds, favorites, renderMarkersOnMap]);

  useEffect(() => {
    const activeCount = facadeMarkers.filter(m => (m as any).isActive !== false).length;
    if (activeCount >= 2) return;

    setRouteAlternatives([]);
    setRouteGeometry([]);
    clearRenderedRouteOnMap();

    try {
      const mapApi = projectManager.getMapApi?.() as any;
      if (typeof mapApi?.clearAlternatives === 'function') {
        mapApi.clearAlternatives();
      }
    } catch {}
  }, [facadeMarkers, clearRenderedRouteOnMap]);

  // search bar at top uses same logic as maps
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    isLoading: isSearchLoading,
    isDropdownVisible,
    setIsDropdownVisible,
    places: geocodingResults,
    markers: filteredMarkersForSearch,
  } = useMapSearch((favorites?.favoritePlaces as any[]) || []);

  // note: selectedMarkerIds & setSelectedMarkerIds are now coming from hook/context
  // (they were already being pulled from favorites context earlier)
  
  const handleReorderPoints = (index: number, direction: 'up' | 'down') => {
    setFacadeMarkers(prev => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      // Сбрасываем кэш авто-маршрута — useEffect на facadeMarkers перестроит маршрут
      lastAutoRouteKeyRef.current = '';
      return updated;
    });
  };

  const handleTogglePoint = (id: string) => {
    setFacadeMarkers(prev => {
      lastAutoRouteKeyRef.current = '';
      return prev.map(m =>
        m.id === id ? { ...m, isActive: (m as any).isActive === false ? true : false } : m
      );
    });
  };

  const handleAddPointFromSearch = (address: string, coordinates: [number, number]) => {
    addPointFromSearch(address, coordinates);
    setShowSearchForm(false);
  };

  const handleAddPointFromCoordinates = (data: { latitude: number; longitude: number; title: string }) => {
    addPointFromCoordinates(data);
    setShowCoordinateInput(false);
  };

  const formatDistance = (distanceKm: number) => {
    return distanceKm >= 1 ? `${distanceKm.toFixed(1)} км` : `${Math.round(distanceKm * 1000)} м`;
  };

  const formatDuration = (durationMin: number) => {
    return durationMin >= 60
      ? `${Math.floor(durationMin / 60)} ч ${durationMin % 60} мин`
      : `${durationMin} мин`;
  };
  // Состояние для хранения геометрии маршрута (для сохранения в постах)
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);

  // Filters
  const {
    draft: draftFilters,
    applied: appliedFilters,
    setDraft: setDraftFilters,
    apply: applyFilters,
    reset: resetFilters,
    quickChange: handleQuickCategoryChange,
  } = useMapFilters();

  type MobilePlannerMapSettings = {
    mapType: 'light' | 'dark' | 'hybrid';
    showTraffic: boolean;
    showBikeLanes: boolean;
    showHints: boolean;
    themeColor: string;
  };

  const [draftMapSettings, setDraftMapSettings] = useState<MobilePlannerMapSettings>({
    mapType: 'light',
    showTraffic: false,
    showBikeLanes: false,
    showHints: true,
    themeColor: 'green',
  });
  // Настройки маршрута
  const [draftRouteSettings, setDraftRouteSettings] = useState<{
    transportType: 'driving-car' | 'foot-walking' | 'cycling-regular' | 'driving-hgv' | 'driving-bus' | 'cycling-road' | 'cycling-mountain' | 'cycling-electric' | 'public-transport' | 'motorcycle' | 'scooter';
    optimization: 'fastest' | 'shortest' | 'balanced';
    avoidHighways: boolean;
    avoidTolls: boolean;
    showAlternatives: boolean;
  }>({
    transportType: 'driving-car',
    optimization: 'fastest',
    avoidHighways: false,
    avoidTolls: false,
    showAlternatives: false,
  });

  // Ref для актуальных настроек маршрута — доступен в useEffect без добавления в deps
  const draftRouteSettingsRef = useRef(draftRouteSettings);
  useEffect(() => { draftRouteSettingsRef.current = draftRouteSettings; }, [draftRouteSettings]);

  // Маппинг optimization → ORS preference
  const getOrsPreference = (opt: string): 'fastest' | 'shortest' | 'recommended' => {
    if (opt === 'shortest') return 'shortest';
    if (opt === 'balanced') return 'recommended';
    return 'fastest';
  };

  const [appliedMapSettings, setAppliedMapSettings] = useState<MobilePlannerMapSettings>(draftMapSettings);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);

  // Маркеры (используем общий хук, чтобы иметь доступ к полному списку маркеров)
  const { allMarkers, loading: markersLoading } = useMapMarkers({
    categories: appliedFilters.categories,
    lazy: false,
    limit: 1000,
  });

  // filter handlers
  const handleApply = () => {
    applyFilters();
    setAppliedMapSettings(draftMapSettings);
  };

  const handleReset = () => {
    resetFilters();
    const defaultMapSettings: MobilePlannerMapSettings = {
      mapType: 'light',
      showTraffic: false,
      showBikeLanes: false,
      showHints: true,
      themeColor: 'green',
    };
    setDraftMapSettings(defaultMapSettings);
    setAppliedMapSettings(defaultMapSettings);
  };

  useEffect(() => {
    // Инициализация компонента
  }, [location.pathname]);

  const tabs = [
    { id: 'standard', label: 'Стандартная', icon: <Navigation className="w-4 h-4" /> },
    { id: 'fast', label: 'Быстрая', icon: <Navigation className="w-4 h-4" /> },
    { id: 'short', label: 'Короткая', icon: <Navigation className="w-4 h-4" /> },
  ];

  // MapComponent рендерится через портал - инициализация НЕ требуется
  // Карта управляется MapComponent напрямую с явными props

  // Отслеживание параметра marker из URL (аналог MapPage)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const markerId = params.get('marker');
    if (markerId) {
      setSelectedMarkerIdForPopup(markerId);
    } else {
      setSelectedMarkerIdForPopup(null);
    }
  }, [location.search]);

  const mapRouteSourceToCategory = (source: string | undefined): string => {
    if (source === 'favorites') return 'favorite';
    if (source === 'event') return 'event';
    if (source === 'click') return 'map-click';
    if (source === 'coordinates') return 'coordinates';
    if (source === 'search' || source === 'address') return 'address';
    return 'route-point';
  };

  // Рассчитываем маркеры для передачи в MapComponent
  // Route points + favorited places (если отмечены)
  const filteredMarkers = (() => {
    const markers: Array<any> = [];
    
    // Добавляем точки маршрута
    (routePoints || []).forEach((point: any, index: number) => {
      const [lat, lon] = point.coordinates || [0, 0];
      markers.push({
        id: `point-${index}`,
        latitude: lat,
        longitude: lon,
        title: point.title || `Точка ${index + 1}`,
        category: mapRouteSourceToCategory(point.source),
      });
    });
    
    // Добавляем избранные места (если отмечены)
    if (selectedMarkerIds && selectedMarkerIds.length > 0) {
      (favorites?.favoritePlaces || []).forEach((place: any) => {
        if (selectedMarkerIds.includes(String(place.id))) {
          markers.push({
            ...place,
            id: String(place.id),
            category: 'favorite',
          });
        }
      });
    }

    if (selectedEventIds && selectedEventIds.length > 0) {
      (favorites?.favoriteEvents || []).forEach((event: any) => {
        if (selectedEventIds.includes(String(event.id))) {
          const lat = Number(event.latitude ?? (Array.isArray(event.coordinates) ? event.coordinates[0] : undefined));
          const lon = Number(event.longitude ?? (Array.isArray(event.coordinates) ? event.coordinates[1] : undefined));
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

          markers.push({
            ...event,
            id: `event-${String(event.id)}`,
            latitude: lat,
            longitude: lon,
            title: event.title || 'Событие',
            category: 'event',
          });
        }
      });
    }
    
    return markers;
  })();

  // Обработчик открытия настроек из TopBar (через query параметр)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('settings') === 'true') {
      setSettingsOpen(true);
    }
    if (params.get('favorites') === 'true') {
      setFavoritesOpen(true);
    }
  }, [location.search]);

  // Обработка параметра marker из URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const markerId = params.get('marker');
    if (!markerId) return;

    // Ищем место в избранном
    const place = favorites?.favoritePlaces?.find(p => String(p.id) === markerId);
    if (!place) return;

    // Извлекаем координаты
    const coords: [number, number] | null = ((): [number, number] | null => {
      if (place.latitude !== undefined && place.longitude !== undefined) {
        const lat = Number(place.latitude);
        const lon = Number(place.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
      }
      if (Array.isArray(place.coordinates) && place.coordinates.length >= 2) {
        const lat = Number(place.coordinates[0]);
        const lon = Number(place.coordinates[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
      }
      return null;
    })();

    if (!coords) return;

    // Центрируем карту (через prop MapComponent)
    setFlyToCoordinates(coords);
    setSelectedMarkerIdForPopup(markerId);

    // Добавляем в selectedMarkerIds
    if (!(selectedMarkerIds as string[]).includes(String(place.id))) {
      setSelectedMarkerIds(prev => [...prev, String(place.id)]);
    }
  }, [location.search, favorites?.favoritePlaces, selectedMarkerIds]);

  // Обработка клика на карту - добавление точки
  const handleMapClick = useCallback((coords: [number, number]) => {
    const pointNumber = routePoints.length + 1;
    const title = `Точка ${pointNumber}`;
    builder.pointManager.addClickPoint(coords, title);
    addPointToFacade(`pt-${Date.now()}`, coords, title, 'map-click');
  }, [routePoints.length, builder.pointManager]);

  // Обновляем ref чтобы обработчик в useEffect всегда вызывал актуальный handleMapClick
  handleMapClickRef.current = handleMapClick;

  // Применение настроек карты к Yandex Maps
  useEffect(() => {
    if (!isMapReady) return;

    const mapContainer = document.getElementById('planner-map-container');
    const yMap = (mapContainer as any)?.__yandexMap;
    if (!yMap) return;

    try {

      const trafficControl = yMap.controls.get('trafficControl');
      if (trafficControl) {
        if (appliedMapSettings.showTraffic) {
          trafficControl.showTraffic();
        } else {
          trafficControl.hideTraffic();
        }
      }

      // Применяем велодорожки (через слой, если доступен)
      // Note: Yandex Maps API для велодорожек может быть ограничен
      // Велодорожки обычно доступны через TypeSelector или отдельный слой
      console.log('[PlannerPage Mobile] Applied map settings:', appliedMapSettings);
    } catch (error) {
      console.warn('[PlannerPage Mobile] Error applying map settings:', error);
    }
  }, [isMapReady, appliedMapSettings]);

  return (
    <div className="relative w-full h-full">
      {/* Настройки / поиск / маршруты — разделённая панель под топбаром */}
      <div
        className="mobile-map-controls planner-top-controls"
        style={{
          pointerEvents: 'auto',
        }}
      >
        <div className="planner-action-group">
          <button
            onClick={() => setSettingsOpen(true)}
            className="planner-settings-button m-glass-map-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-1"
            style={{ width: 62, height: 62, flex: '0 0 62px' }}
            title="Настройки карты"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Настройки</span>
          </button>

          <button
            onClick={() => setRoutesOpen(true)}
            className="m-glass-map-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-1"
            style={{ width: 62, height: 62, flex: '0 0 62px' }}
            title="Маршруты"
          >
            <Navigation className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Маршрут</span>
          </button>

          <button
            onClick={() => {
              if (facadeMarkers.length < 2) {
                alert('Добавьте минимум 2 точки маршрута для сохранения');
                return;
              }
              setSaveModalOpen(true);
            }}
            className={`m-glass-map-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-1${
              facadeMarkers.length < 2 ? ' opacity-50' : ''
            }`}
            style={{ width: 62, height: 62, flex: '0 0 62px' }}
            title="Сохранить маршрут"
          >
            <Save className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Сохранить</span>
          </button>

          <button
            onClick={handleClearAllPoints}
            className={`m-glass-map-btn m-glass-map-btn--danger transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-1${
              facadeMarkers.length === 0 && routePoints.length === 0 ? ' opacity-50' : ''
            }`}
            style={{ width: 62, height: 62, flex: '0 0 62px' }}
            title="Очистить карту"
          >
            <Trash2 className="w-5 h-5" style={{ color: 'rgb(248 113 113)' }} />
            <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Очистить</span>
          </button>

        </div>

        <div className="planner-search-row relative flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 m-glass-text-muted" size={18} />
            <input
              type="text"
              placeholder="Поиск мест или меток..."
              className="m-glass-input rounded-full pl-12 pr-4 py-3 w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {isDropdownVisible && (
              <div className="absolute w-full z-50">
                <SearchResultsDropdown
                  loading={isSearchLoading}
                  places={geocodingResults}
                  markers={filteredMarkersForSearch}
                  onPlaceSelect={(place) => {
                    addPointFromSearch(place.label, place.coordinates as [number, number]);
                    setSearchQuery('');
                  }}
                  onMarkerSelect={(marker) => {
                    if (Number.isFinite(marker.longitude) && Number.isFinite(marker.latitude)) {
                      addPointFromSearch(marker.title || '', [marker.latitude, marker.longitude]);
                    }
                    setSearchQuery('');
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${isLayerControlOpen ? 'bg-white text-black shadow-sm' : 'bg-white/10 text-white/80'}`}
              onClick={() => {
                try {
                  const mapContainer = document.getElementById('planner-map-container');
                  const yMap = getYandexMapFromPlannerContainer() ?? (mapContainer as any)?.__yandexMap;
                  const layerControl = getYandexControl(yMap);
                  if (layerControl) {
                    const expanded = toggleYandexControlExpanded(layerControl);
                    setIsLayerControlOpen(expanded);
                  }
                } catch (error) {
                  console.warn('[PlannerPage Mobile] Toggle layer control failed:', error);
                }
              }}
              title="Слои"
            >
              <Layers size={18} />
            </button>
            <button
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${appliedMapSettings.showTraffic ? 'bg-white text-black shadow-sm' : 'bg-white/10 text-white/80'}`}
              onClick={() => {
                const newSettings: MobilePlannerMapSettings = { ...appliedMapSettings, showTraffic: !appliedMapSettings.showTraffic };
                setAppliedMapSettings(newSettings);
                setDraftMapSettings(newSettings);
              }}
              title={appliedMapSettings.showTraffic ? 'Пробки включены' : 'Пробки отключены'}
            >
              <FaTrafficLight size={18} />
            </button>
          </div>
        </div>
      </div>

      {routeAlternatives.length > 0 && (
        <div
          className="absolute left-1/2 flex justify-center gap-2 overflow-x-auto px-1"
          style={{
            top: 'calc(var(--topbar-height, 64px) + 68px)',
            transform: 'translateX(-50%)',
            width: 'calc(100vw - 24px)',
            zIndex: 55,
            pointerEvents: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {routeAlternatives.map((alt) => {
            const isSelected = alt.id === selectedAltId;
            return (
              <button
                key={alt.id}
                onClick={() => setSelectedAltId(alt.id)}
                className="shrink-0 rounded-2xl px-3 py-2 text-left transition-all duration-200"
                style={{
                  minWidth: 132,
                  background: isSelected ? alt.colorActive : 'rgba(255,255,255,0.92)',
                  color: isSelected ? '#fff' : '#1e293b',
                  border: `2px solid ${isSelected ? alt.colorActive : 'rgba(15,23,42,0.08)'}`,
                  boxShadow: isSelected ? `0 10px 24px ${alt.colorActive}55` : '0 6px 16px rgba(15,23,42,0.12)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  opacity: isSelected ? 1 : 0.92,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold leading-none">
                  {alt.id === 'highway' && <Navigation size={13} />}
                  {alt.id === 'shortest' && <Minimize2 size={13} />}
                  {alt.id === 'city' && <Building2 size={13} />}
                  <span>{alt.label}</span>
                </div>
                <div className="mt-1 text-[11px] font-medium opacity-90">
                  {formatDistance(alt.distanceKm)} • {formatDuration(alt.durationMin)}
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {/* MapComponent рендерится через портал в body - полноэкранная карта */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-10" style={{pointerEvents: 'auto'}}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка карты...</p>
          </div>
        </div>
      )}

      {/* Невидимый контейнер — MapComponent рисует через portal в body */}
      {/* УДАЛЕНО - используем Yandex Map через projectManager как на desktop */}
      
      {/* Yandex Map контейнер - инициализируется через projectManager */}
      <div id="planner-map-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      
      {/* Модаль сохранения маршрута */}
      <RouteCategoryModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={async (routeData: RouteCreationData) => {
          if (!user || !token) { alert('Необходимо войти в систему'); return; }
          try {
            const activePoints = facadeMarkers.filter(m => m.lat !== undefined && m.lon !== undefined);
            await createRoute({
              title: routeData.title,
              description: routeData.description || '',
              tags: routeData.tags,
              is_public: routeData.visibility === 'public',
              route_data: { polyline: routeGeometry, category: routeData.category },
              waypoints: activePoints.map((m, idx) => ({
                marker_id: m.id || `pt-${idx}`,
                order_index: idx,
              })),
            }, token);
            setSaveModalOpen(false);
            alert('✅ Маршрут сохранён!');
          } catch (e) {
            console.error('[PlannerPage] save route error:', e);
            alert('❌ Ошибка при сохранении маршрута');
          }
        }}
        routeTitle={`Маршрут ${new Date().toLocaleDateString()}`}
        pointsCount={facadeMarkers.length}
        existingRoutes={(favorites as any)?.favoriteRoutes || []}
        isVip={false}
      />

      {/* Настройки карты */}
      <MobileMapSettings
        isOpen={settingsOpen}
        mode="planner"
        onClose={() => {
          setSettingsOpen(false);
          const params = new URLSearchParams(location.search);
          params.delete('settings');
          window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
        }}
        filters={draftFilters}
        onFiltersChange={setDraftFilters}
        mapSettings={draftMapSettings}
        onMapSettingsChange={(settings) => setDraftMapSettings(settings)}
        routeSettings={draftRouteSettings}
        onRouteSettingsChange={(settings) => {
          if (settings) {
            setDraftRouteSettings(settings);
          }
        }}
        onApply={handleApply}
        onReset={handleReset}
      />
      
      {/* Меню маршрутов */}
      {routesOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 m-glass-overlay z-40 transition-opacity"
            style={{ pointerEvents: 'none' }}
          />

          {/* Меню маршрутов */}
          <div
            className={cn(
              "fixed left-1/2 transform -translate-x-1/2 z-50 rounded-[20px]",
              "max-w-[340px] min-w-[280px] w-[calc(100vw-32px)]",
              "overflow-hidden flex flex-col transition-all duration-300"
            )}
            style={{
              top: 'calc(var(--topbar-height, 64px) + 86px)',
              bottom: '80px',
              background: 'var(--glass-l1-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-l1-border)',
              boxShadow: 'var(--glass-l1-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="m-glass-panel-hdr text-[1.1em] font-bold py-4 rounded-t-[20px] text-center relative flex items-center justify-center">
              <h2 className="text-base font-bold m-glass-text">Маршруты</h2>
              <button
                onClick={() => setRoutesOpen(false)}
                className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-none border-none m-glass-text cursor-pointer p-1 w-6 h-6 rounded-full transition-all hover:bg-white/20 flex items-center justify-center text-lg font-bold leading-none"
                title="Закрыть"
              >
                ×
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Точки маршрута */}
              <div className="px-7 pb-4.5 m-glass-accordion-section">
                <div
                  className={cn(
                    "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                    openRouteSection === 'points' 
                      ? "m-glass-accordion-header open" 
                      : "m-glass-accordion-header"
                  )}
                  onClick={() => setOpenRouteSection(openRouteSection === 'points' ? '' : 'points')}
                >
                  <MapPin className="mr-2" style={{ width: 16, height: 16, color: openRouteSection === 'points' ? 'white' : '#22c55e' }} />
                  Точки маршрута
                  <span className="ml-auto">{openRouteSection === 'points' ? '▲' : '▼'}</span>
                </div>
                {openRouteSection === 'points' && (
                  <div className="pt-2 pl-8">
                    {facadeMarkers && facadeMarkers.length > 0 ? (
                      <div className="space-y-2">
                        {(() => {
                          let activeIdx = 0;
                          return facadeMarkers.map((point, index) => {
                            const isActive = (point as any).isActive !== false;
                            if (isActive) activeIdx++;
                            const num = isActive ? activeIdx : null;
                            const catColor = { favorite: '#F59E0B', event: '#7C3AED', 'map-click': '#3B82F6', coordinates: '#10B981', address: '#EF4444' }[point.category as string] || '#3B82F6';
                            return (
                              <div
                                key={point.id}
                                className={`px-3 py-2 rounded-lg m-glass-card flex items-center justify-between ${!isActive ? 'opacity-50' : ''}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {/* Нумерованный кружок */}
                                    <span
                                      className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                      style={{ background: isActive ? catColor : '#9CA3AF', color: '#fff', fontSize: 10 }}
                                    >
                                      {num ?? '—'}
                                    </span>
                                    <span className="text-sm font-medium m-glass-text truncate">{point.title}</span>
                                  </div>
                                  <div className="text-xs m-glass-text-muted ml-7">
                                    {Number(point.lat).toFixed(4)}, {Number(point.lon).toFixed(4)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => handleReorderPoints(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1 m-glass-text-muted hover:m-glass-text disabled:opacity-30"
                                    title="Вверх"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleReorderPoints(index, 'down')}
                                    disabled={index === facadeMarkers.length - 1}
                                    className="p-1 m-glass-text-muted hover:m-glass-text disabled:opacity-30"
                                    title="Вниз"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  {/* Кнопка включить/исключить из маршрута */}
                                  <button
                                    onClick={() => handleTogglePoint(point.id)}
                                    className={`p-1 rounded ${isActive ? 'text-green-400 hover:text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                                    title={isActive ? 'Исключить из маршрута' : 'Включить в маршрут'}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                                  </button>
                                  <button
                                    onClick={() => handleRemovePoint(point.id)}
                                    className="p-1 text-red-400 hover:text-red-600"
                                    title="Удалить"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-4 m-glass-text-muted text-sm">
                        Нет точек маршрута. Добавьте точки для построения маршрута.
                      </div>
                    )}
                    
                    {/* Кнопки добавления точек */}
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => {
                          setOpenRouteSection('search');
                          setShowSearchForm(true);
                        }}
                        className="w-full px-3 py-2 text-left m-glass-card rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Search className="w-4 h-4 m-glass-icon-accent" />
                        <div>
                          <div className="text-sm font-medium m-glass-text">🔍 Поиск адреса</div>
                          <div className="text-xs m-glass-text-muted">Найти место по названию</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setShowCoordinateInput(true)}
                        className="w-full px-3 py-2 text-left m-glass-card rounded-lg transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 m-glass-icon-accent" />
                        <div>
                          <div className="text-sm font-medium m-glass-text">📍 Ввод координат</div>
                          <div className="text-xs m-glass-text-muted">Добавить по точным координатам</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setFavoritesOpen(true);
                          setRoutesOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left m-glass-card rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Star className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="text-sm font-medium m-glass-text">⭐ Из избранного</div>
                          <div className="text-xs m-glass-text-muted">Выбрать из сохраненных мест</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Поиск адресов */}
              {showSearchForm && (
                <div className="px-7 pb-4.5 m-glass-accordion-section">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openRouteSection === 'search' 
                        ? "m-glass-accordion-header open" 
                        : "m-glass-accordion-header"
                    )}
                    onClick={() => {
                      setOpenRouteSection(openRouteSection === 'search' ? '' : 'search');
                      if (openRouteSection === 'search') setShowSearchForm(false);
                    }}
                  >
                    <Search className="mr-2" style={{ width: 16, height: 16, color: openRouteSection === 'search' ? 'white' : '#22c55e' }} />
                    Поиск адресов
                    <span className="ml-auto">{openRouteSection === 'search' ? '▲' : '▼'}</span>
                  </div>
                  {openRouteSection === 'search' && (
                    <div className="pt-2 pl-8">
                      <RouteSearchForm onAddPoint={handleAddPointFromSearch} onClose={() => setShowSearchForm(false)} />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="m-glass-panel-ftr flex flex-col items-center gap-3 py-4 rounded-b-[20px]">
              <div className="flex gap-3 px-5 w-full justify-center">
                <button
                  onClick={() => clearPoints()}
                  className="flex-1 px-4.5 py-2 rounded-md cursor-pointer font-bold text-[15px] m-glass-btn transition-all"
                >
                  Очистить
                </button>
                <button
                  onClick={() => {
                    startBuilding();
                    setRoutesOpen(false);
                  }}
                  className="flex-1 px-4.5 py-2 rounded-md cursor-pointer font-bold text-[15px] m-glass-tab-active transition-all"
                >
                  Создать
                </button>
              </div>
              {routePoints && routePoints.length > 0 && (
                <div className="text-xs m-glass-text-secondary text-center">
                  Точек: {facadeMarkers.filter(m => (m as any).isActive !== false).length} активных из {facadeMarkers.length} {facadeMarkers.filter(m => (m as any).isActive !== false).length >= 2 && '✓ Готов к построению'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Меню избранного */}
      <MobileFavoritesPanel 
        isOpen={favoritesOpen}
        onMarkerToggle={markerToggle}
        onClose={() => {
          setFavoritesOpen(false);
          const params = new URLSearchParams(location.search);
          params.delete('favorites');
          window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
        }}
        // Allow scrolling + interaction with map under panel (prevents blocking touches)
        // but still keeps the panel visible.
        allowBackgroundInteraction={true}
      />
      
      {/* Модальное окно для ввода координат */}
      {showCoordinateInput && (
        <CoordinateInput
          onAdd={(data) => {
            handleAddPointFromCoordinates(data);
            setShowCoordinateInput(false);
          }}
          onClose={() => setShowCoordinateInput(false)}
        />
      )}
    </div>
  );
};

// Компонент формы поиска адресов для маршрута
const RouteSearchForm: React.FC<{
  onAddPoint: (address: string, coordinates: [number, number]) => void;
  onClose: () => void;
  glassStyles?: any;
}> = ({ onAddPoint, onClose, glassStyles }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const styles = glassStyles || {
    input: { background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#000' },
    text: { color: '#000' },
    textMuted: { color: 'rgba(0, 0, 0, 0.5)' },
    card: { background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' },
  };

  const handleSearch = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const places = await geocodingService.searchPlaces(query);
      setSearchResults(places);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (place: Place) => {
    if (place.coordinates && place.coordinates.length === 2) {
      onAddPoint(place.label, place.coordinates);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Введите адрес..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={styles.input}
      />
      {isSearching && (
        <div className="text-xs" style={styles.textMuted}>Поиск...</div>
      )}
      {searchResults.length > 0 && (
        <div className="max-h-[150px] overflow-y-auto rounded-lg" style={styles.card}>
          {searchResults.map((place, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectResult(place)}
              className="w-full px-3 py-2 text-left hover:bg-white/10 last:border-b-0"
              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <div className="text-sm font-medium" style={styles.text}>{place.label}</div>
              {(place as any).address && (
                <div className="text-xs" style={styles.textMuted}>{(place as any).address}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Оборачиваем в RoutePlannerProvider, т.к. он не включён в глобальное дерево
const PlannerPageWithProvider: React.FC = () => (
  <RoutePlannerProvider>
    <PlannerPage />
  </RoutePlannerProvider>
);

export default PlannerPageWithProvider;

