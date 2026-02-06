// КРИТИЧНО: Инициализируем Leaflet в window ПЕРЕД импортом любых модулей,
// которые могут использовать window.L (mapFacade, projectManager, OSMMapRenderer)
import '../../utils/leafletInit';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { OSMMapRenderer } from '../../services/map_facade/adapters/OSMMapRenderer';
import CircularProgressBar from '../ui/CircularProgressBar';

// Leaflet и его стили инициализируются в `../../utils/leafletInit`.
// Используем `mapFacade` и глобальный `window.L` вместо прямых импортов.
// (импорты 'leaflet', 'leaflet/dist/leaflet.css' и 'leaflet.markercluster' удалены)

// Объявляем L как глобальную переменную (устанавливается в leafletInit.ts)
declare const L: any;

import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useMapStyle } from '../../hooks/useMapStyle';
import { MapContainer, MapWrapper, LoadingOverlay, ErrorMessage, GlobalLeafletPopupStyles } from './Map.styles';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import MarkerPopup from './MarkerPopup';
import { MarkerData } from '../../types/marker';
import styled from 'styled-components';
import MapLegend from './MapLegend';
import { ElegantAccordionForm } from './ElegantAccordionForm';
import { placeDiscoveryService, DiscoveredPlace } from '../../services/placeDiscoveryService';
import { GlassPanel } from '../Glass';
import MiniMarkerPopup from './MiniMarkerPopup';
import EventMiniPopup from './EventMiniPopup';
import { projectManager } from '../../services/projectManager';
import { activityService } from '../../services/activityService';
import { useRussiaRestrictions } from '../../hooks/useRussiaRestrictions';
import { canCreateMarker } from '../../services/zoneService';
import { useContentStore, ContentState } from '../../stores/contentStore';
import { useMapDisplayMode } from '../../hooks/useMapDisplayMode';
import { FEATURES } from '../../config/features';
import { getDistanceFromLatLonInKm } from '../../utils/russiaBounds';
import { getMarkerIconPath, getCategoryColor, getFontAwesomeIconName } from '../../constants/markerCategories';
import { mapFacade, INTERNAL } from '../../services/map_facade/index';
import ErrorBoundary from '../ErrorBoundary';
import { initMapDebug } from '../../utils/devMapDebug';
import type { MapConfig } from '../../services/map_facade/index';
import { useMapStateStore } from '../../stores/mapStateStore';
import { useEventsStore, EventsState } from '../../stores/eventsStore';
import { MockEvent } from '../TravelCalendar/mockEvents';
import { getCategoryById } from '../TravelCalendar/TravelCalendar';
import { markerService } from '../../services/markerService';
import {
    getTileLayer,
    getAdditionalLayers,
    createLayerIndicator,
    markerCategoryStyles,
    latLngToContainerPoint
} from './mapUtils';

const MapMessage = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--glass-bg-dark);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  font-size: 1.2em;
  z-index: 999;
  pointer-events: none;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
`;

interface MapProps {
    center: [number, number];
    zoom: number;
    markers: MarkerData[];
    onMapClick?: (coordinates: [number, number]) => void;
    onHashtagClickFromPopup?: (hashtag: string) => void;
    flyToCoordinates?: [number, number] | null;
    selectedMarkerIdForPopup?: string | null;
    setSelectedMarkerIdForPopup: (id: string | null) => void;
    onAddToFavorites: (marker: MarkerData) => void;
    onRemoveFromFavorites?: (id: string) => void;
    setSelectedMarkerIds?: React.Dispatch<React.SetStateAction<string[]>> | ((ids: string[]) => void);
    onAddToBlog?: (marker: MarkerData) => void;
    onFavoritesClick?: () => void;
    favoritesCount?: number;
    onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
    radius: number;
    isAddingMarkerMode?: boolean;
    onAddMarkerModeChange?: (enabled: boolean) => void;
    legendOpen?: boolean;
    onLegendOpenChange?: (open: boolean) => void;
    isFavorite: (marker: MarkerData) => boolean;
    mapSettings: {
        mapType: string;
        showTraffic: boolean;
        showBikeLanes: boolean;
        showHints: boolean;
        themeColor: string;
    };
    filters: {
        categories: string[];
        radiusOn: boolean;
        radius: number;
        preset: string | null;
    };
    searchRadiusCenter: [number, number];
    onSearchRadiusCenterChange: (center: [number, number]) => void;
    selectedMarkerIds?: string[];
    zones?: Array<{ severity?: string; polygons: number[][][]; name?: string; type?: string }>;
    routeData?: {
        id: string;
        title: string;
        polyline: [number, number][];
        markers: any[];
    } | null;
}

const Map: React.FC<MapProps> = ({
    center, zoom, markers, onMapClick, onHashtagClickFromPopup,
    flyToCoordinates, selectedMarkerIdForPopup, setSelectedMarkerIdForPopup, onAddToFavorites, onAddToBlog, isFavorite,
    onFavoritesClick, favoritesCount, mapSettings, filters, searchRadiusCenter, onSearchRadiusCenterChange, selectedMarkerIds, onBoundsChange, zones = [], routeData, isAddingMarkerMode: externalIsAddingMarkerMode, onAddMarkerModeChange, legendOpen: externalLegendOpen, onLegendOpenChange,
    onRemoveFromFavorites, setSelectedMarkerIds
}) => {

    // --- СОСТОЯНИЕ ДЛЯ МАРКЕРОВ ---
    const [localMarkers, setLocalMarkers] = useState<MarkerData[]>([]);

    const markersData = useMemo(() => {
        const propsMarkers = markers || [];
        const localOnly = localMarkers.filter(lm => !propsMarkers.some(pm => pm.id === lm.id));
        return [...propsMarkers, ...localOnly];
    }, [markers, localMarkers]);

    const setMarkersData = useCallback((newMarkers: MarkerData[] | ((prev: MarkerData[]) => MarkerData[])) => {
        if (typeof newMarkers === 'function') {
            setLocalMarkers(prev => {
                const result = newMarkers(prev);
                return result.filter(m => !(markers || []).some(pm => pm.id === m.id));
            });
        } else {
            const newOnly = newMarkers.filter(m => !(markers || []).some(pm => pm.id === m.id));
            setLocalMarkers(newOnly);
        }
    }, [markers]);

    // --- REFS ---
    // Use `any` for internal Leaflet instances to avoid direct Leaflet types in components
    const mapRef = useRef<any | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const activePopupRoots = useRef<Record<string, Root>>({});
    const tempMarkerRef = useRef<any | null>(null);
    const markerClusterGroupRef = useRef<any | null>(null);
    const tileLayerRef = useRef<any | null>(null);
    const isAddingMarkerModeRef = useRef(false);
    const initRetryRef = useRef<number>(0);
    // Сохраняем исходный центр карты, чтобы восстановить при выходе из двухоконного режима
    const originalCenterRef = useRef<[number, number] | null>(null);

    // Helper: safely add a Leaflet layer to the map when mapRef may be not ready yet.
    const safeAddTo = (layer: any, attempt = 0) => {
      if (!layer) {
        if (process.env.NODE_ENV === 'development') console.warn('[Map] safeAddTo: layer is null or undefined', new Error().stack);
        return;
      }
      if (typeof layer.addTo !== 'function') {
        if (process.env.NODE_ENV === 'development') console.warn('[Map] safeAddTo: layer.addTo is not a function', layer);
        return;
      }
      const map = mapRef.current;
      if (map) {
        try {
          layer.addTo(map);
        } catch (e) {
          console.warn('[Map] safeAddTo failed to add layer:', e);
        }
        return;
      }
      // Retry a few times with backoff
      if (attempt < 6) {
        const delay = 100 * (attempt + 1);
        setTimeout(() => safeAddTo(layer, attempt + 1), delay);
      } else {
        console.warn('[Map] safeAddTo: mapRef not ready after retries. Layer not added.');
      }
    }; 

    // --- PORTAL ---
    const [portalEl] = useState<HTMLElement | null>(() => {
        if (typeof document !== 'undefined') {
            let el = document.getElementById('global-map-root') as HTMLElement | null;
            if (!el) {
                el = document.createElement('div');
                el.id = 'global-map-root';
                document.body.appendChild(el);
            }
            return el;
        }
        return null;
    });

    // --- HOOKS ---
    const { t } = useTranslation();
    const { isDarkMode } = useTheme();
    const mapStyle = useMapStyle();
    const russiaRestrictions = useRussiaRestrictions();
    const leftContent = useContentStore((state: ContentState) => state.leftContent);
    const rightContent = useContentStore((state: ContentState) => state.rightContent);
    const isTwoPanelMode = rightContent !== null;
    const openEvents = useEventsStore((state: EventsState) => state.openEvents);
    const selectedEvent = useEventsStore((state: EventsState) => state.selectedEvent);
    const setSelectedEvent = useEventsStore((state: EventsState) => state.setSelectedEvent);
    const mapDisplayMode = useMapDisplayMode();

    // --- STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [coordsForNewMarker, setCoordsForNewMarker] = useState<[number, number] | null>(null);
    const [tempMarker, setTempMarker] = useState<any | null>(null);
    const [mapMessage, setMapMessage] = useState<string | null>(null);
    const [showCultureMessage, setShowCultureMessage] = useState<boolean>(true);
    const [discoveredPlace, setDiscoveredPlace] = useState<DiscoveredPlace | null>(null);
    const [isDiscoveringPlace, setIsDiscoveringPlace] = useState(false);
    const [miniPopup, setMiniPopup] = useState<{
        marker: MarkerData;
        position: { x: number; y: number };
    } | null>(null);
    const [eventMiniPopup, setEventMiniPopup] = useState<{
        event: MockEvent;
        position: { x: number; y: number };
    } | null>(null);

    // --- LEGEND STATE ---
    const [internalLegendOpen, setInternalLegendOpen] = useState(false);
    const legendOpen = externalLegendOpen !== undefined ? externalLegendOpen : internalLegendOpen;
    const setLegendOpen = useCallback((open: boolean) => {
        if (onLegendOpenChange) {
            onLegendOpenChange(open);
        } else {
            setInternalLegendOpen(open);
        }
    }, [onLegendOpenChange]);

    // --- ADD MARKER MODE STATE ---
    const [internalIsAddingMarkerMode, setInternalIsAddingMarkerMode] = useState(false);
    const isAddingMarkerMode = externalIsAddingMarkerMode !== undefined
        ? externalIsAddingMarkerMode
        : internalIsAddingMarkerMode;
    const setIsAddingMarkerMode = useCallback((enabled: boolean) => {
        if (onAddMarkerModeChange) {
            onAddMarkerModeChange(enabled);
        } else {
            setInternalIsAddingMarkerMode(enabled);
        }
        if (enabled) {
            setMapMessage('🎯 Кликните на карту, чтобы добавить метку');
        } else {
            setMapMessage(null);
        }
    }, [onAddMarkerModeChange]);

    // --- REFS SYNC ---
    useEffect(() => {
        isAddingMarkerModeRef.current = isAddingMarkerMode;
    }, [isAddingMarkerMode]);

    useEffect(() => {
        tempMarkerRef.current = tempMarker;
    }, [tempMarker]);

    // --- PORTAL VISIBILITY ---
    useEffect(() => {
        if (!portalEl) return;
        // ИСПРАВЛЕНО: Портал показывается всегда когда карта активна (leftContent === 'map'),
        // или когда shouldShowFullscreen === true, или когда левая панель не задана (карта по умолчанию).
        const shouldShowPortal = leftContent === 'map' || rightContent === 'map' || leftContent === null || mapDisplayMode.shouldShowFullscreen;
        if (!shouldShowPortal) {
            portalEl.style.display = 'none';
            portalEl.style.visibility = 'hidden';
            portalEl.style.pointerEvents = 'none';
        } else {
            portalEl.style.display = 'block';
            portalEl.style.visibility = 'visible';
            portalEl.style.pointerEvents = 'auto';
            // Когда портал снова показан, даём Leaflet немного времени и инвалидируем размер
            setTimeout(() => {
                try { mapRef.current?.invalidateSize(); } catch (e) { }
            }, 150);
        }
    }, [leftContent, rightContent, portalEl, mapDisplayMode.shouldShowFullscreen]);

    // Dev helper: add a debug toggle to disable overlays and bring map forward for inspection
    useEffect(() => {
      const cleanup = initMapDebug?.();
      return () => { try { cleanup && cleanup(); } catch (e) {} };
    }, []);

    // --- FACADE MAP TOP OFFSET ---

    // Динамическое управление видимостью и классом контейнера карты
    useEffect(() => {
        const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
        const facadeMapRoot = document.querySelector('.facade-map-root') as HTMLElement | null;
        
        if (mapContainer) {
            // ИСПРАВЛЕНО: Карта всегда видима и интерактивна когда shouldShowFullscreen === true
            // (что теперь включает случай leftContent === 'map')
            if (mapDisplayMode.shouldShowFullscreen) {
                mapContainer.style.display = 'block';
                mapContainer.style.visibility = 'visible';
                mapContainer.style.pointerEvents = 'auto';
                mapContainer.style.zIndex = '1';
            } else {
                // Скрываем карту ТОЛЬКО когда она действительно не нужна
                // (когда leftContent !== 'map' и нет фонового режима)
                mapContainer.style.display = 'none';
                mapContainer.style.visibility = 'hidden';
                mapContainer.style.pointerEvents = 'none';
            }
        }
        
        // Добавляем класс для стилизации в зависимости от режима
        if (facadeMapRoot) {
            facadeMapRoot.classList.remove('two-panel-mode', 'single-panel-mode', 'map-hidden');
            if (!mapDisplayMode.shouldShowFullscreen) {
                facadeMapRoot.classList.add('map-hidden');
            } else if (mapDisplayMode.isTwoPanelMode) {
                facadeMapRoot.classList.add('two-panel-mode');
            } else {
                facadeMapRoot.classList.add('single-panel-mode');
            }
        }
        
        // Инвалидируем размер карты при изменении режима
        if (mapRef.current && mapDisplayMode.shouldShowFullscreen) {
            // Двойной invalidateSize для надёжности при переключении режимов
            setTimeout(() => {
                try {
                    mapRef.current?.invalidateSize();
                } catch (e) {}
            }, 100);
            setTimeout(() => {
                try {
                    mapRef.current?.invalidateSize();
                } catch (e) {}
            }, 350);
        }
    }, [mapDisplayMode.shouldShowFullscreen, mapDisplayMode.isTwoPanelMode, mapDisplayMode.isOnlyPostsAndActivity, leftContent]);

    useEffect(() => {
        // On resize, invalidate Leaflet size when map is visible — don't set CSS vars here (MainLayout manages --facade-map-top)
        const handler = () => {
          try {
            if (mapRef.current && mapDisplayMode.shouldShowFullscreen) {
              setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch (e) {} }, 120);
            }
          } catch (e) {}
        };

        handler();
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [mapDisplayMode.shouldShowFullscreen]);

    // Смещение центра карты для двухоконного режима — центрируем вид в левой части экрана (25%)
    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;

        try {
            const map = mapRef.current;
            const zoom = map.getZoom();
            const mapSize = map.getSize();
            const currentCenter = map.getCenter();
            const projected = map.project(currentCenter, zoom);

            const targetScreenX = isTwoPanelMode ? mapSize.x * 0.25 : mapSize.x * 0.5;
            const dx = targetScreenX - (mapSize.x / 2);

            const targetPoint = mapFacade().point(projected.x + dx, projected.y);
            const targetCenterLatLng = map.unproject(targetPoint, zoom);

            if (isTwoPanelMode) {
                if (!originalCenterRef.current) {
                    originalCenterRef.current = [currentCenter.lat, currentCenter.lng];
                }
                try { map.setView(targetCenterLatLng, zoom, { animate: true }); } catch (e) { }
            } else {
                if (originalCenterRef.current) {
                    try { map.setView(originalCenterRef.current, zoom, { animate: true }); } catch (e) { }
                    originalCenterRef.current = null;
                }
            }

            setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch (e) {} }, 120);
        } catch (e) {
            // best-effort
        }
    }, [isTwoPanelMode, isMapReady]);

    // --- CENTER/ZOOM FROM PROPS (only if no saved state) ---
    useEffect(() => {
        if (!mapRef.current) return;

        const savedState = useMapStateStore.getState().contexts.osm;
        if (savedState.initialized) {
            try {
                mapRef.current.setView(savedState.center, savedState.zoom, { animate: false });
            } catch (e) { }
            return;
        }

        try {
            mapRef.current.setView(center, zoom, { animate: false });
        } catch (e) { }
    }, [center, zoom]);

    // --- UNIFIED RESIZE HANDLER ---
    useEffect(() => {
        if (!mapRef.current) return;

        let timeoutId: NodeJS.Timeout | null = null;

        const handleResize = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                try {
                    mapRef.current?.invalidateSize();
                } catch (e) { }
            }, 350);
        };

        try {
            mapRef.current.invalidateSize();
        } catch (e) { }

        handleResize();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [leftContent, rightContent, isTwoPanelMode]);

    // --- INTERSECTION OBSERVER FOR VISIBILITY ---
    useEffect(() => {
        if (!mapRef.current || !mapContainerRef.current) return;

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && entry.intersectionRatio > 0) {
                            setTimeout(() => {
                                try {
                                    mapRef.current?.invalidateSize();
                                } catch (e) { }
                            }, 100);
                        }
                    });
                },
                { threshold: [0, 0.1, 0.5, 1.0], rootMargin: '0px' }
            );

            observer.observe(mapContainerRef.current);
            return () => observer.disconnect();
        }
    }, []);

    const [forceReinit, setForceReinit] = useState(false);

    // recovery helper — попытка аккуратно восстановить карту при ошибках
    const handleRecoverMap = async () => {
        console.warn('[Map] Attempting map recovery...');
        setError(null);
        setIsLoading(true);
        try {
            // Destroy facade and project manager state
            try { projectManager.reset(); } catch (e) { console.warn('projectManager.reset failed', e); }
            // Destroy map instance if present
            try {
                if (mapRef.current && typeof mapRef.current.remove === 'function') {
                    mapRef.current.remove();
                }
            } catch (e) { console.warn('mapRef.remove failed', e); }
            mapRef.current = null;
            // Toggle force reinit to trigger effect
            setTimeout(() => setForceReinit(f => !f), 50);
        } finally {
            setIsLoading(false);
        }
    };

    // --- MAP INITIALIZATION (main effect) ---
    useEffect(() => {
        const container = mapContainerRef.current || document.getElementById('map');
        const isContainerVisible = (() => {
            if (!container) return false;
            try {
                const style = window.getComputedStyle(container as Element);
                return style.visibility !== 'hidden' && style.display !== 'none' && (container as HTMLElement).offsetWidth > 0 && (container as HTMLElement).offsetHeight > 0;
            } catch (e) {
                return false;
            }
        })();

        if (mapRef.current) {
            setError(null);
            return;
        }

        // ИСПРАВЛЕНО: Не выходим из init если контейнер существует но ещё невидим —
        // при портальном рендере контейнер может быть ещё не примонтирован.
        // Вместо раннего выхода, позволяем initMapAndLoadMarkers
        // самостоятельно ждать пока контейнер станет видимым.
        if (!container) {
            setError(null);
            setIsLoading(false);
            return;
        }

        const checkVisibility = (element: HTMLElement): boolean => {
            const style = window.getComputedStyle(element);
            return style.visibility !== 'hidden' && style.display !== 'none' &&
                element.offsetWidth > 0 && element.offsetHeight > 0;
        };

        const initMapAndLoadMarkers = async () => {
            setIsLoading(true);
            setError(null);

            try {
                let mapContainer = mapContainerRef.current || document.getElementById('map');
                if (!mapContainer) {
                    let attempts = 0;
                    while (!mapContainer && attempts < 20) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        mapContainer = mapContainerRef.current || document.getElementById('map');
                        attempts++;
                    }
                }

                if (!mapContainer) {
                    throw new Error('Контейнер карты #map не найден в DOM после ожидания');
                }

                let sizeAttempts = 0;
                while (!checkVisibility(mapContainer) && sizeAttempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    sizeAttempts++;
                }

                if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
                    if (initRetryRef.current < 5) {
                        initRetryRef.current += 1;
                        setTimeout(() => {
                            try { initMapAndLoadMarkers(); } catch (e) { }
                        }, 300);
                        return;
                    }
                    setIsLoading(false);
                    return;
                }

                const config: MapConfig = {
                    provider: 'leaflet',
                    center,
                    zoom,
                    markers: []
                };

                let initResult: any = null;
                try {
                    const registeredApi = typeof mapFacade().getRegisteredApi === 'function' ? mapFacade().getRegisteredApi() : (INTERNAL as any)?.api;
                    if (registeredApi && (registeredApi.map || registeredApi.mapInstance)) {
                        initResult = registeredApi;
                    }
                } catch (e) { }

                if (!initResult) {
                    let initAttempts = 0;
                    const maxInitAttempts = 3;
                    while (initAttempts < maxInitAttempts) {
                        try {
                            initResult = await projectManager.initializeMap(mapContainer, { ...config, preserveState: true } as any);
                            break;
                        } catch (err) {
                            initAttempts++;
                            if (initAttempts >= maxInitAttempts) {
                                throw err;
                            }
                            await new Promise(resolve => setTimeout(resolve, 300 * initAttempts));
                        }
                    }
                }

                const facadeApi = (INTERNAL as any)?.api || initResult || {};
                if (facadeApi && (facadeApi as any).map) {
                    mapRef.current = (facadeApi as any).map as any;
                } else if (facadeApi && (facadeApi as any).mapInstance) {
                    mapRef.current = (facadeApi as any).mapInstance as any;
                } else {
                    // FACADE: Используем OSMMapRenderer вместо прямого вызова L.map
                    try {
                        const mapRenderer = new OSMMapRenderer();
                        await mapRenderer.init('map', config);

                        // Получаем инстанс карты Leaflet
                        mapRef.current = mapRenderer.getMap();
                    } catch (e) {
                        console.error("Ошибка инициализации OSMMapRenderer", e);
                    }
                }

                // КРИТИЧНО: Всегда регистрируем карту в фасаде, чтобы
                // mapFacade().createMarker() и другие helper-методы работали
                // независимо от того, каким путём получен инстанс карты.
                if (mapRef.current) {
                    mapFacade().registerBackgroundApi(
                        { map: mapRef.current, mapInstance: mapRef.current, containerId: 'map' },
                        'map'
                    );
                }

                if (!mapRef.current) {
                    throw new Error('Фасад не вернул карту после инициализации.');
                }

                if (mapRef.current && typeof (mapRef.current as any).addLayer !== 'function') {
                    const possibleInner = (facadeApi as any)?.map || (facadeApi as any)?.mapInstance || (initResult && (initResult as any).map);
                    if (possibleInner && typeof possibleInner.addLayer === 'function') {
                        mapRef.current = possibleInner as any;
                    }
                }

                const map = mapRef.current;
                const tileLayerInfo = getTileLayer(mapSettings.mapType);
                let hasTileLayer = false;
                if (map && typeof (map as any).eachLayer === 'function') {
                    (map as any).eachLayer((layer: any) => {
                        // Avoid direct instanceof check against Leaflet classes; rely on layer properties instead
                        if ((layer as any)?._url === 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png') {
                            hasTileLayer = true;
                            tileLayerRef.current = layer;
                        }
                    });
                }

                if (!hasTileLayer) {
                    // Use facade to add tile layer so we keep Leaflet usage centralized
                    const tileLayer = mapFacade().addTileLayer(tileLayerInfo.url, {
                        attribution: tileLayerInfo.attribution,
                        maxZoom: 19,
                        subdomains: 'abc',
                    });
                    tileLayerRef.current = tileLayer;
                }

                const additionalLayers = getAdditionalLayers(mapSettings.showTraffic, mapSettings.showBikeLanes);
                additionalLayers.forEach(layer => {
                    // layers may be L.TileLayer instances, add them using facade when map is managed by facade
                    if (!layer) return;
                    try {
                        if (map && typeof (layer as any).addTo === 'function') {
                            (layer as any).addTo(map);
                        } else {
                            // If map not ready, schedule safe add
                            safeAddTo(layer);
                        }
                    } catch (e) {
                        // Fallback to safe add with retry
                        try { safeAddTo(layer); } catch (e2) { }
                    }
                });

                if (!map.zoomControl) {
                    mapFacade().setZoomControl('bottomright');
                }

                setTimeout(() => {
                    if (mapRef.current) {
                        try { mapRef.current.invalidateSize(); } catch (e) { }
                    }
                }, 100);

                mapRef.current?.eachLayer((layer: any) => {
                    if (layer && typeof layer.getLayers === 'function' && layer !== markerClusterGroupRef.current) {
                        try { mapRef.current?.removeLayer(layer); } catch (e) { }
                    }
                });

                mapRef.current?.on('moveend', () => {
                    if (onBoundsChange && mapRef.current) {
                        const bounds = mapRef.current.getBounds();
                        if (bounds && typeof bounds.getNorth === 'function') {
                            onBoundsChange({
                                north: bounds.getNorth(),
                                south: bounds.getSouth(),
                                east: bounds.getEast(),
                                west: bounds.getWest()
                            });
                        }
                    }
                });

                mapRef.current?.on('click', async (e: any) => {
                    if (!mapRef.current) return; // Guard to avoid crashes if map is gone
                    if (isAddingMarkerModeRef.current) {
                        if (tempMarkerRef.current) {
                            try { mapRef.current.removeLayer(tempMarkerRef.current); } catch (err) { }
                        }

                        const clickedLatLng = e.latlng;
                        const zoom = mapRef.current.getZoom();
                        const mapSize = mapRef.current.getSize();
                        const targetScreenY = mapSize.y * 0.25;
                        const screenCenterY = mapSize.y / 2;
                        const offsetY = targetScreenY - screenCenterY;
                        const projectedClick = mapRef.current.project(clickedLatLng, zoom);
                        const targetCenterPoint = mapFacade().point(projectedClick.x, projectedClick.y - offsetY);
                        const targetCenterLatLng = mapRef.current.unproject(targetCenterPoint, zoom);
                        try { mapRef.current.setView(targetCenterLatLng, zoom, { animate: true }); } catch (err) { }

                        const tempIcon = mapFacade().createDivIcon({
                            className: 'temp-marker-icon',
                            html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 3000;"></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10],
                        });

                        let newTempMarker = mapFacade().createMarker([clickedLatLng.lat, clickedLatLng.lng], { icon: tempIcon });
                        if (!newTempMarker && L && mapRef.current) {
                            try { newTempMarker = L.marker([clickedLatLng.lat, clickedLatLng.lng], { icon: tempIcon }).addTo(mapRef.current); } catch (_) {}
                        }
                        setTempMarker(newTempMarker);

                        const placeFound = await handlePlaceDiscovery(clickedLatLng.lat, clickedLatLng.lng);
                        setCoordsForNewMarker([clickedLatLng.lat, clickedLatLng.lng]);

                        if (!placeFound) {
                            setMapMessage('ℹ️ Место не найдено, можно добавить вручную');
                            setTimeout(() => setMapMessage(null), 3000);
                        }

                        setIsAddingMarkerMode(false);
                        setMapMessage(null);
                    } else if (onMapClick) {
                        onMapClick([e.latlng.lat, e.latlng.lng]);
                    }
                });

                setIsLoading(false);
                setIsMapReady(true);

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                const isNonCriticalError =
                    errMsg.includes('runtime.lastError') ||
                    errMsg.includes('message port closed') ||
                    errMsg.includes('CORS') ||
                    errMsg.includes('Failed to fetch') ||
                    errMsg.includes('NetworkError');

                if (isNonCriticalError && mapRef.current) {
                    setIsLoading(false);
                    setError(null);
                    return;
                }

                if (!isNonCriticalError && !mapRef.current) {
                    setError(t('map.error.initialization') || 'Ошибка инициализации карты');
                } else {
                    setError(null);
                }
                setIsLoading(false);
            }
        };

        initMapAndLoadMarkers();

        return () => {
            if (mapRef.current) {
                Object.values(activePopupRoots.current).forEach((root) => {
                    try { root.unmount(); } catch (err) { }
                });
                activePopupRoots.current = {};

                if (tempMarkerRef.current) {
                    try { mapRef.current.removeLayer(tempMarkerRef.current); } catch (e) { }
                    tempMarkerRef.current = null;
                }
            }
        };
    }, [leftContent, rightContent, center, zoom, mapSettings.mapType, onBoundsChange, onMapClick, mapDisplayMode.shouldShowFullscreen, forceReinit]);

    // --- MAP STATE SAVING ---
    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;

        const map = mapRef.current;

        const saveState = () => {
            try {
                const currentCenter = map.getCenter();
                const currentZoom = map.getZoom();
                useMapStateStore.getState().saveCurrentState('osm', [currentCenter.lat, currentCenter.lng], currentZoom);
            } catch (e) { }
        };

        map.on('moveend', saveState);
        map.on('zoomend', saveState);
        saveState();

        return () => {
            try {
                map.off('moveend', saveState);
                map.off('zoomend', saveState);
            } catch (e) { }
        };
    }, [isMapReady]);

    // --- MAP TYPE CHANGE ---
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const tileLayerInfo = getTileLayer(mapSettings.mapType);

        if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
        }

        const newTileLayer = mapFacade().addTileLayer(tileLayerInfo.url, {
            attribution: tileLayerInfo.attribution,
            maxZoom: 19,
            subdomains: 'abc',
        });
        tileLayerRef.current = newTileLayer;
    }, [mapSettings.mapType]);

    // --- TRAFFIC & BIKE LANES ---
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        if (map && typeof (map as any).eachLayer === 'function') {
            (map as any).eachLayer((layer: any) => {
                // Avoid instanceof checks against Leaflet classes; rely on properties instead
                const containerClass = (layer as any).getContainer?.()?.className || '';
                if (((layer as any)?._url || containerClass.includes('traffic-layer') || containerClass.includes('bike-lanes-layer'))) {
                    try { map.removeLayer(layer); } catch (e) { }
                }
            });
        }

        document.querySelectorAll('.layer-indicator').forEach(indicator => indicator.remove());

        if (L) {
            const additionalLayers = getAdditionalLayers(mapSettings.showTraffic, mapSettings.showBikeLanes);
            additionalLayers.forEach((layer) => {
                if (!layer) return;
                try {
                    if (map && typeof (layer as any).addTo === 'function') {
                        (layer as any).addTo(map);
                        const layerType = (layer as any).getContainer?.()?.className?.includes('traffic-layer') ? 'traffic' : 'bike';
                        const indicator = createLayerIndicator(layerType);
                        map.getContainer().appendChild(indicator);
                    } else {
                        // Map not ready; use safeAddTo and append indicator later
                        safeAddTo(layer);
                        setTimeout(() => {
                            try {
                                if (mapRef.current && typeof (layer as any).addTo === 'function') {
                                    (layer as any).addTo(mapRef.current);
                                    const layerType = (layer as any).getContainer?.()?.className?.includes('traffic-layer') ? 'traffic' : 'bike';
                                    const indicator = createLayerIndicator(layerType);
                                    mapRef.current.getContainer().appendChild(indicator);
                                }
                            } catch (e) { }
                        }, 300);
                    }
                } catch (e) {
                    // fallback
                    safeAddTo(layer);
                }
            });
        }
    }, [mapSettings.showTraffic, mapSettings.showBikeLanes]);

    // --- MARKERS RENDER ---
    useEffect(() => {
        if (!mapRef.current || !L) return;
        if (!isMapReady) return; // Ждём пока карта полностью инициализирована
        if (!markersData || markersData.length === 0) return;

        const { radiusOn, radius } = filters;
        const { themeColor, showHints } = mapSettings;
        const [searchRadiusCenterLat, searchRadiusCenterLng] = searchRadiusCenter;

        if (markerClusterGroupRef.current) {
            mapRef.current.removeLayer(markerClusterGroupRef.current);
            markerClusterGroupRef.current = null;
        }

        if (mapRef.current && typeof (mapRef.current as any).eachLayer === 'function') {
            (mapRef.current as any).eachLayer((layer: any) => {
                // Avoid direct instanceof checks; remove layers that look like markers and aren't the temp marker
                if (layer && (layer as any).markerData && layer !== tempMarkerRef.current) {
                    try { mapRef.current?.removeLayer(layer); } catch (e) { }
                }
            });
        }

        // Create a marker cluster group via the facade (keeps Leaflet usage centralized)
        if (!mapFacade().createMarkerClusterGroup) return;

        const markerClusterGroup = mapFacade().createMarkerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            animate: true,
            iconCreateFunction: function (cluster: any) {
                const count = cluster.getChildCount();
                return mapFacade().createDivIcon({
                    html: `<div class="marker-cluster"><span>${count}</span></div>`,
                    className: 'marker-cluster-custom',
                    iconSize: [40, 40]
                });
            }
        });

        // markerClusterGroup может быть null если плагин markercluster не загружен
        if (!markerClusterGroup) {
            console.warn('[Map] createMarkerClusterGroup returned null — markercluster plugin not loaded');
            return;
        }

        markersData.forEach((markerData) => {
            const lat = parseFloat(markerData.latitude as any);
            const lng = parseFloat(markerData.longitude as any);

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                const markerCategory = markerData.category || 'other';
                const isHot = (markerData.rating || 0) >= 4.5;
                const isPending = markerData.status === 'pending' || (markerData as any).is_pending || false;

                const isInRadius = radiusOn
                    ? getDistanceFromLatLonInKm(searchRadiusCenterLat, searchRadiusCenterLng, markerData.latitude, markerData.longitude) <= radius
                    : false;

                const [iconWidth, iconHeight] = isInRadius ? [44, 58] : [34, 44];
                const markerIconUrl = getMarkerIconPath(markerCategory);
                const markerCategoryStyle = markerCategoryStyles[markerCategory] || markerCategoryStyles.default;
                const iconColor = isPending ? '#ff9800' : (isInRadius ? themeColor : (getCategoryColor(markerCategory) || markerCategoryStyle.color));
                const faIconName = getFontAwesomeIconName(markerCategory);

                const customIcon = mapFacade().createIcon({
                    iconUrl: markerIconUrl,
                    iconSize: [iconWidth, iconHeight],
                    iconAnchor: [iconWidth / 2, iconHeight],
                    popupAnchor: [0, -iconHeight],
                    className: `marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}${markerCategory === 'user_poi' ? ' marker-user-poi' : ''}${isPending ? ' marker-pending' : ''}`,
                });

                let leafletMarker = mapFacade().createMarker([lat, lng], { icon: customIcon });
                if (!leafletMarker) {
                    console.warn('[Map] createMarker returned null for marker', markerData?.id);
                    return;
                }

                const img = new Image();
                img.onerror = () => {
                    const divIcon = mapFacade().createDivIcon({
                        className: `marker-icon marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}`,
                        html: `<div class="marker-base" style="background-color: ${iconColor};"><i class="fas ${faIconName}"></i></div>`,
                        iconSize: [iconWidth, iconHeight],
                        iconAnchor: [iconWidth / 2, iconHeight],
                    });
                    try { leafletMarker.setIcon(divIcon); } catch (err) { console.debug('[Map] setIcon failed on fallback divIcon:', err); }
                };
                img.src = markerIconUrl;
                try { (leafletMarker as any).markerData = markerData; } catch (err) { console.debug('[Map] Failed to set markerData on leafletMarker:', err); }

                const popupOptions = {
                    className: `custom-marker-popup ${isDarkMode ? 'dark' : 'light'}`,
                    autoPan: true,
                    autoPanPadding: [50, 50],
                    closeButton: false,
                    maxWidth: 441,
                    maxHeight: 312,
                    offset: mapFacade().point(0, -10),
                };

                leafletMarker.bindPopup('', popupOptions);

                leafletMarker.on('popupopen', (e: any) => {
                    try {
                        if (!mapRef.current) {
                            setTimeout(() => {
                                if (leafletMarker.getPopup() && leafletMarker.isPopupOpen()) {
                                    leafletMarker.openPopup();
                                }
                            }, 100);
                            return;
                        }

                        let hasTileLayer = false;
                        mapRef.current.eachLayer((layer: any) => {
                            // Avoid instanceof checks; assume presence of _url means a tile layer
                            if ((layer as any)?._url) hasTileLayer = true;
                        });

                        if (!hasTileLayer) {
                            setTimeout(() => {
                                if (leafletMarker.getPopup() && leafletMarker.isPopupOpen()) {
                                    leafletMarker.openPopup();
                                }
                            }, 200);
                            return;
                        }

                        const popupElement = e.popup?.getElement();
                        if (!popupElement) return;

                        const popupContentDiv = popupElement.querySelector('.leaflet-popup-content');
                        if (!popupContentDiv || !popupContentDiv.parentElement || !document.body.contains(popupElement)) {
                            return;
                        }

                        let root = activePopupRoots.current[markerData.id];
                        if (!root) {
                            try {
                                root = createRoot(popupContentDiv);
                                activePopupRoots.current[markerData.id] = root;
                            } catch (err) { return; }
                        }

                        const fullMarkerData: MarkerData = markerData;
                        const isSelected = !!(selectedMarkerIdForPopup && selectedMarkerIdForPopup === markerData.id);
                        const shouldShowSelected = isSelected && isFavorite(markerData) && Array.isArray(selectedMarkerIds) && selectedMarkerIds.includes(markerData.id);

                        if (shouldShowSelected) {
                            popupElement.classList.add('selected');
                        } else {
                            popupElement.classList.remove('selected');
                        }

                        try {
                            root.render(
                                <MarkerPopup
                                    key={markerData.id}
                                    marker={fullMarkerData}
                                    onClose={() => {
                                        try {
                                            if (leafletMarker.getPopup()) {
                                                leafletMarker.closePopup();
                                            }
                                        } catch (err) { }
                                    }}
                                    onHashtagClick={onHashtagClickFromPopup}
                                    onMarkerUpdate={() => { }}
                                    onAddToFavorites={onAddToFavorites}
                                    onRemoveFromFavorites={onRemoveFromFavorites}
                                    setSelectedMarkerIds={setSelectedMarkerIds}
                                    onAddToBlog={onAddToBlog}
                                    isFavorite={isFavorite(markerData)}
                                    isSelected={shouldShowSelected}
                                />
                            );
                        } catch (err) {
                            popupContentDiv.innerHTML = '<div style="padding: 10px;">Ошибка загрузки попапа</div>';
                        }
                    } catch (err) { }
                });

                leafletMarker.on('popupclose', () => {
                    const root = activePopupRoots.current[markerData.id];
                    if (root) {
                        root.unmount();
                        delete activePopupRoots.current[markerData.id];
                    }
                });

                leafletMarker.on('mouseover', () => {
                    setMiniPopup({
                        marker: markerData,
                        position: latLngToContainerPoint(mapFacade(), mapFacade().latLng(Number(markerData.latitude), Number(markerData.longitude)))
                    });
                });

                leafletMarker.on('click', (e: any) => {
                    e.originalEvent.stopPropagation();
                    setMiniPopup(null);
                    setSelectedMarkerIdForPopup(markerData.id);
                });

                if (showHints) {
                    leafletMarker.bindTooltip(markerData.title, { direction: 'top', offset: [0, -10] });
                }

                if (markerClusterGroup) markerClusterGroup.addLayer(leafletMarker);
            }
        });

        // Event markers
        const isEventPanelMode = leftContent && rightContent;
        const shouldShowEventMarkers = isEventPanelMode && selectedEvent !== null;

        if (shouldShowEventMarkers) {
            openEvents.forEach((event: MockEvent) => {
                const lat = event.latitude;
                const lng = event.longitude;

                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    const category = getCategoryById(event.categoryId);
                    const colorMap: { [key: string]: string } = {
                        'bg-red-500': '#ef4444', 'bg-orange-500': '#f97316', 'bg-sky-500': '#0ea5e9',
                        'bg-emerald-500': '#10b981', 'bg-violet-500': '#8b5cf6', 'bg-amber-500': '#f59e0b',
                        'bg-pink-500': '#ec4899', 'bg-fuchsia-500': '#d946ef', 'bg-indigo-500': '#6366f1',
                        'bg-lime-500': '#84cc16', 'bg-cyan-500': '#06b6d4', 'bg-yellow-400': '#facc15',
                        'bg-rose-500': '#f43f5e', 'bg-purple-600': '#9333ea', 'bg-purple-500': '#a855f7',
                        'bg-orange-400': '#fb923c', 'bg-teal-500': '#14b8a6', 'bg-blue-400': '#60a5fa',
                        'bg-neutral-800': '#262626'
                    };
                    const categoryColor = category?.color ? (colorMap[category.color] || '#6b7280') : '#6b7280';

                    const categoryIconMap: { [key: string]: string } = {
                        'festival': 'fa-bullhorn', 'concert': 'fa-music', 'exhibition': 'fa-image',
                        'sport': 'fa-trophy', 'market': 'fa-store', 'holiday': 'fa-gift',
                        'fishing': 'fa-fish', 'oktoberfest': 'fa-beer', 'parade': 'fa-flag',
                        'theater': 'fa-theater-masks', 'heritage': 'fa-landmark', 'kids': 'fa-child',
                        'nightlife': 'fa-moon'
                    };
                    const categoryIcon = categoryIconMap[event.categoryId] || 'fa-calendar';

                    const isSelected = selectedEvent?.id === event.id;
                    const iconSize = isSelected ? 50 : 40;

                    const eventIcon = mapFacade().createDivIcon({
                        className: `event-marker-icon ${isSelected ? 'event-marker-selected' : ''}`,
                        html: `<div class="event-marker-base" style="width: ${iconSize}px; height: ${iconSize}px; background-color: ${categoryColor}; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); ${isSelected ? 'animation: eventMarkerPulse 2s ease-in-out infinite;' : ''}"><i class="fas ${categoryIcon}" style="color: #ffffff; font-size: ${iconSize * 0.4}px;"></i></div>`,
                        iconSize: [iconSize, iconSize],
                        iconAnchor: [iconSize / 2, iconSize],
                        popupAnchor: [0, -iconSize],
                    });

                    let eventMarker = mapFacade().createMarker([lat, lng], { icon: eventIcon });
                    if (!eventMarker) return;
                    (eventMarker as any).eventData = event;

                    eventMarker.on('click', (e: any) => {
                        e.originalEvent.stopPropagation();
                        setSelectedEvent(event);
                    });

                    eventMarker.on('mouseover', () => {
                        setEventMiniPopup({
                            event: event,
                            position: latLngToContainerPoint(mapFacade(), mapFacade().latLng(lat, lng))
                        });
                    });

                    eventMarker.on('click', (e: any) => {
                        e.originalEvent.stopPropagation();
                        setEventMiniPopup(null);
                        setSelectedEvent(event);
                    });

                    if (markerClusterGroup) markerClusterGroup.addLayer(eventMarker);
                }
            });
        }

        // Динамический цвет кластера (зависит от themeColor из настроек)
        const clusterColorStyle = document.createElement('style');
        clusterColorStyle.setAttribute('data-cluster-theme', 'true');
        clusterColorStyle.innerHTML = `.marker-cluster-custom { background: ${themeColor} !important; }`;
        document.head.appendChild(clusterColorStyle);

        // Добавляем кластерную группу на карту
        safeAddTo(markerClusterGroup);
        markerClusterGroupRef.current = markerClusterGroup;

        return () => {
            if (clusterColorStyle && document.head.contains(clusterColorStyle)) document.head.removeChild(clusterColorStyle);
        };
    }, [markersData, isDarkMode, filters, searchRadiusCenter, mapSettings, openEvents, selectedEvent, leftContent, rightContent, isMapReady]);

    // --- UNIFIED POPUP HANDLER ---
    useEffect(() => {
        if (!markerClusterGroupRef.current) return;

        markerClusterGroupRef.current.eachLayer((layer: any) => {
            if (!layer.markerData) return;

            const markerId = String(layer.markerData.id);
            const isSelected = selectedMarkerIds?.includes(markerId) || false;
            const shouldClose = (selectedMarkerIdForPopup && selectedMarkerIdForPopup === markerId) || 
                (isSelected && (selectedMarkerIds?.length || 0) > 0);

            if (shouldClose && typeof layer.closePopup === 'function') {
                try { layer.closePopup(); } catch (e) { }
            }

            const popup = layer.getPopup?.();
            if (popup) {
                const element = popup.getElement();
                if (element) {
                    if (isSelected && selectedMarkerIdForPopup === markerId) {
                        element.classList.add('selected');
                    } else {
                        element.classList.remove('selected');
                    }
                }
            }
        });
    }, [selectedMarkerIdForPopup, selectedMarkerIds, markersData]);

    // --- EVENT MARKER CENTERING ---
    useEffect(() => {
        if (!mapRef.current || !selectedEvent) return;
        if (selectedEvent.latitude == null || selectedEvent.longitude == null) return;

        const lat = selectedEvent.latitude;
        const lng = selectedEvent.longitude;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        try {
            mapRef.current.setView([lat, lng], 14, { animate: true, duration: 0.5 });
        } catch (error) { }
    }, [selectedEvent]);

    // --- ROUTE RENDER ---
    useEffect(() => {
        if (!mapRef.current || !routeData) return;

        mapRef.current.eachLayer((layer: any) => {
            if ((layer as any).isRouteLayer) {
                try { mapRef.current?.removeLayer(layer); } catch (e) { }
            }
        });

        let routePolyline: any = null;
        let allLatLngs: any[] = [];

        const hasPolyline = routeData.polyline && Array.isArray(routeData.polyline) && routeData.polyline.length > 1;
        if (hasPolyline) {
            const validPolyline = routeData.polyline.filter(point =>
                Array.isArray(point) && point.length === 2 &&
                typeof point[0] === 'number' && typeof point[1] === 'number' &&
                !isNaN(point[0]) && !isNaN(point[1])
            );

            if (validPolyline.length >= 2) {
                routePolyline = mapFacade().createPolyline(validPolyline, {
                    color: '#ff3b3b',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '12, 12',
                    className: 'route-polyline'
                });
                if (routePolyline) {
                    (routePolyline as any).isRouteLayer = true;
                }
                allLatLngs = validPolyline.map(([lat, lng]) => mapFacade().latLng(lat, lng));
            }
        }

        if (!routePolyline && routeData.markers && Array.isArray(routeData.markers) && routeData.markers.length > 1) {
            const fallback = routeData.markers
                .map((m: any) => [Number(m.latitude), Number(m.longitude)] as [number, number])
                .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
            if (fallback.length > 1) {
                routePolyline = mapFacade().createPolyline(fallback, {
                    color: '#ff3b3b',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '12, 12',
                    className: 'route-polyline'
                });
                if (routePolyline) {
                    (routePolyline as any).isRouteLayer = true;
                }
                allLatLngs = fallback.map(([lat, lng]) => mapFacade().latLng(lat, lng));
            }
        }

        const routeStyle = document.createElement('style');
        routeStyle.innerHTML = `.route-polyline { stroke-dasharray: 12, 12 !important; animation: route-dash 2s linear infinite; } @keyframes route-dash { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 24; } }`;
        document.head.appendChild(routeStyle);

        if (routeData.markers && Array.isArray(routeData.markers)) {
            routeData.markers.forEach((marker: any, index: number) => {
                if (!marker || typeof marker !== 'object') return;
                const lat = parseFloat(marker.latitude);
                const lng = parseFloat(marker.longitude);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    const routeIcon = mapFacade().createDivIcon({
                        className: 'route-marker-icon',
                        html: `<div class="route-marker-base"><div class="route-marker-number">${index + 1}</div><div class="route-marker-icon-inner"><i class="fas fa-route"></i></div></div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    });
                    let routeMarker = mapFacade().createMarker([lat, lng], { icon: routeIcon });
                    if (routeMarker) (routeMarker as any).isRouteLayer = true;
                }
            });
        }

        if (mapRef.current && allLatLngs.length > 0) {
            const bounds = mapFacade().latLngBounds(allLatLngs);
            mapFacade().fitBounds(bounds, { padding: [60, 60] });
        }

        let zoomHandler: any;
        if (mapRef.current && routePolyline) {
            const updateStyle = () => {
                const z = mapRef.current?.getZoom() ?? 0;
                const weight = z <= 5 ? 8 : z <= 8 ? 6 : z <= 12 ? 5 : 4;
                routePolyline!.setStyle({ weight });
            };
            updateStyle();
            zoomHandler = () => updateStyle();
            mapRef.current.on('zoomend', zoomHandler);
        }

        const routeStyles = document.createElement('style');
        routeStyles.innerHTML = `.route-marker-icon { background: transparent !important; border: none !important; } .route-marker-base { position: relative; width: 40px; height: 40px; background: linear-gradient(135deg, #ff6b35, #f7931e); border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4); display: flex; align-items: center; justify-content: center; animation: route-pulse 2s ease-in-out infinite; } .route-marker-number { position: absolute; top: -8px; right: -8px; background: #fff; color: #ff6b35; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid #ff6b35; } @keyframes route-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`;
        document.head.appendChild(routeStyles);

        return () => {
            if (mapRef.current) {
                mapRef.current.eachLayer((layer: L.Layer) => {
                    if ((layer as any).isRouteLayer) {
                        mapRef.current?.removeLayer(layer);
                    }
                });
                if (zoomHandler) {
                    mapRef.current.off('zoomend', zoomHandler);
                }
            }
            document.querySelectorAll('style').forEach(s => {
                if (s.innerHTML.includes('route-marker') || s.innerHTML.includes('route-polyline')) {
                    document.head.removeChild(s);
                }
            });
        };
    }, [routeData]);

    // --- ZONES RENDER ---
    useEffect(() => {
        if (!mapRef.current) return;

        mapRef.current.eachLayer((layer: any) => {
            if ((layer as any)?.isZoneLayer) {
                try { mapRef.current?.removeLayer(layer); } catch (e) { }
            }
        });

        zones.forEach(zone => {
            const color = (zone.severity === 'critical') ? '#EF4444' : (zone.severity === 'warning') ? '#F59E0B' : '#FB923C';

            zone.polygons.forEach(ring => {
                const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
                const polygon = mapFacade().createPolygon(latLngs, {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    weight: 2,
                });

                // ИСПРАВЛЕНИЕ: Добавляем полигон на карту и помечаем его
                if (polygon && mapRef.current && typeof (polygon as any).addTo === 'function') {
                    safeAddTo(polygon);
                    (polygon as any).isZoneLayer = true;
                }
            });
        });
    }, [zones]);

    // --- FLY TO ---
    useEffect(() => {
        if (flyToCoordinates && mapRef.current) {
            mapRef.current.flyTo(flyToCoordinates, mapRef.current.getZoom(), { animate: true, duration: 1.2 });
        }
    }, [flyToCoordinates]);

    // --- SEARCH RADIUS CIRCLE ---
    useEffect(() => {
        if (!mapRef.current) return;
        let radiusCircle: any = null;

        if (filters.radiusOn) {
            radiusCircle = mapFacade().createCircle(searchRadiusCenter, {
                radius: filters.radius * 1000,
                color: mapSettings.themeColor,
                fillColor: mapSettings.themeColor,
                fillOpacity: 0.15,
                weight: 2,
                interactive: true,
            });

            if (radiusCircle) {
                radiusCircle.on('mousedown', function (_: any) {
                    mapRef.current?.dragging?.disable();
                    const onMove = (ev: any) => {
                        if (radiusCircle) radiusCircle.setLatLng(ev.latlng);
                    };
                    const onUp = (ev: any) => {
                        onSearchRadiusCenterChange([ev.latlng.lat, ev.latlng.lng]);
                        mapRef.current?.off('mousemove', onMove);
                        mapRef.current?.off('mouseup', onUp);
                        mapRef.current?.dragging?.enable();
                    };
                    mapRef.current?.on('mousemove', onMove);
                    mapRef.current?.on('mouseup', onUp);
                });
            }
        }

        return () => { if (radiusCircle) radiusCircle.remove(); };
    }, [filters.radiusOn, filters.radius, searchRadiusCenter, mapSettings.themeColor]);

    // --- MINI POPUP CLOSE ON MOVE ---
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const closeMiniPopup = () => {
            setMiniPopup(null);
            setEventMiniPopup(null);
        };

        map.on('movestart', closeMiniPopup);
        map.on('zoomstart', closeMiniPopup);

        return () => {
            map.off('movestart', closeMiniPopup);
            map.off('zoomstart', closeMiniPopup);
        };
    }, []);

    // --- PLACE DISCOVERY ---
    const handlePlaceDiscovery = async (latitude: number, longitude: number) => {
        try {
            setIsDiscoveringPlace(true);
            setMapMessage('🔍 Ищем информацию об этом месте...');

            const hasExistingMarker = await placeDiscoveryService.checkExistingMarker(latitude, longitude);
            if (hasExistingMarker) {
                setMapMessage('⚠️ Здесь уже есть метка');
                setTimeout(() => setMapMessage(null), 3000);
                setIsDiscoveringPlace(false);
                return false;
            }

            const searchResult = await placeDiscoveryService.discoverPlace(latitude, longitude);

            if (searchResult.places.length > 0 && searchResult.bestMatch) {
                setDiscoveredPlace(searchResult.bestMatch);
                setMapMessage(null);
                setIsDiscoveringPlace(false);
                return true;
            } else {
                setMapMessage('ℹ️ Место не найдено, можно добавить вручную');
                setTimeout(() => setMapMessage(null), 3000);
                setIsDiscoveringPlace(false);
                return false;
            }
        } catch (error) {
            setMapMessage('❌ Ошибка при поиске места');
            setTimeout(() => setMapMessage(null), 3000);
            setIsDiscoveringPlace(false);
            return false;
        }
    };

    // --- ADD MARKER ---
    const handleAddMarker = async (data: any) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setMapMessage('Ошибка: необходимо авторизоваться');
                setTimeout(() => setMapMessage(null), 3000);
                return;
            }

            if (FEATURES.GEOGRAPHIC_RESTRICTIONS_ENABLED) {
                const coordinateCheck = russiaRestrictions.checkCoordinates(data.latitude, data.longitude);
                if (!coordinateCheck.isValid) {
                    setMapMessage(`Ошибка: ${coordinateCheck.errorMessage}`);
                    setTimeout(() => setMapMessage(null), 5000);
                    return;
                }

                const zoneCheck = await canCreateMarker(data.latitude, data.longitude);
                if (!zoneCheck.allowed) {
                    setMapMessage(`Ошибка: ${zoneCheck.reason}`);
                    setTimeout(() => setMapMessage(null), 5000);
                    return;
                }
            }

            const markerData = {
                title: data.title,
                description: data.description,
                latitude: data.latitude,
                longitude: data.longitude,
                category: data.category,
                hashtags: data.hashtags || '',
                photoUrls: data.photoUrls || '',
                address: data.address || ''
            };

            const newMarker = await markerService.createMarker(markerData);

            await activityService.createActivityHelper(
                'marker_created',
                'marker',
                newMarker.id,
                { title: newMarker.title, category: newMarker.category, coordinates: [newMarker.latitude, newMarker.longitude] }
            );

            setMarkersData(prev => [...prev, newMarker]);
            setMapMessage('Метка успешно добавлена!');
            setTimeout(() => setMapMessage(null), 3000);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            setMapMessage(`Ошибка при добавлении метки: ${errorMessage}`);
            setTimeout(() => setMapMessage(null), 5000);
        }
    };

    // --- SYNC EXTERNAL ADD MARKER MODE ---
    useEffect(() => {
        if (externalIsAddingMarkerMode !== undefined) {
            if (externalIsAddingMarkerMode) {
                setMapMessage('🎯 Кликните на карту, чтобы добавить метку');
            } else {
                setMapMessage(null);
            }
        }
    }, [externalIsAddingMarkerMode]);

    // --- HELPER FUNCTIONS ---
    // NOTE: use `latLngToContainerPoint` from `mapUtils` which uses facade to avoid leaking map instance
    // Local helper removed — use exported `latLngToContainerPoint(mapFacade, latlng)` instead.

    // --- MAP READY CHECK ---
    const isMapReadyCheck = isMapReady || mapRef.current || ((mapFacade() as any)?.INTERNAL?.api?.map);

    // --- SELECTED MARKER POPUP ---
    const selectedMarkerPopup = useMemo(() => {
        if (!selectedMarkerIdForPopup) return null;
        const marker = markersData.find(m => m.id === selectedMarkerIdForPopup);
        if (!marker) return null;

        const markerPosition = latLngToContainerPoint(mapFacade(), mapFacade().latLng(Number(marker.latitude), Number(marker.longitude)));

        return (
            <div
                key={`popup-${selectedMarkerIdForPopup}`}
                style={{
                    position: 'absolute',
                    left: markerPosition.x,
                    top: markerPosition.y,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 1300,
                }}
                className="popup-card-fixed"
            >
                <MarkerPopup
                    marker={marker}
                    onClose={() => setSelectedMarkerIdForPopup(null)}
                    onHashtagClick={onHashtagClickFromPopup}
                    onMarkerUpdate={() => { }}
                    onAddToFavorites={onAddToFavorites}
                    isFavorite={isFavorite(marker)}
                    isSelected={Boolean(isFavorite(marker) && Array.isArray(selectedMarkerIds) && selectedMarkerIds.includes(marker.id))}
                />
            </div>
        );
    }, [selectedMarkerIdForPopup, markersData, selectedMarkerIds]);

    // --- EVENT MINI POPUP ---
    const eventPopup = eventMiniPopup && eventMiniPopup.position && (
        <div
            style={{
                position: 'absolute',
                left: eventMiniPopup.position.x,
                top: eventMiniPopup.position.y,
                transform: 'translate(-50%, -100%)',
                marginBottom: '10px',
                zIndex: 9999,
                pointerEvents: 'auto'
            }}
            onMouseLeave={() => { setEventMiniPopup(null); }}
        >
            <EventMiniPopup
                event={eventMiniPopup.event}
                onOpenFull={() => {
                    setEventMiniPopup(null);
                    setSelectedEvent(eventMiniPopup.event);
                }}
                isSelected={selectedEvent?.id === eventMiniPopup.event.id}
                showGoButton={true}
            />
        </div>
    );

    // --- MAIN MINI POPUP ---
    const miniPopupElement = miniPopup && (
        <div
            style={{
                position: 'absolute',
                left: miniPopup.position.x,
                top: miniPopup.position.y,
                zIndex: 1200,
                transform: 'translate(-50%, -100%)',
            }}
            onMouseLeave={() => { setMiniPopup(null); }}
        >
            <MiniMarkerPopup
                marker={miniPopup.marker}
                onOpenFull={() => {
                    const markerId = miniPopup?.marker?.id;
                    setMiniPopup(null);
                    if (markerId) {
                        setSelectedMarkerIdForPopup(markerId);
                    }
                }}
                isSelected={false}
            />
        </div>
    );

    // --- SELECTED MARKERS MINI POPUPS ---
    const selectedMarkerPopups = selectedMarkerIds?.map((markerId: string) => {
        const marker = markersData.find(m => m.id === markerId) || markers?.find(m => m.id === markerId);
        if (!marker) return null;

        if (selectedMarkerIdForPopup === markerId || (miniPopup && miniPopup.marker.id === markerId)) {
            return null;
        }

        return (
            <div
                key={`selected-${markerId}`}
                style={{
                    position: 'absolute',
                    left: latLngToContainerPoint(mapFacade(), mapFacade().latLng(Number(marker.latitude), Number(marker.longitude))).x,
                    top: latLngToContainerPoint(mapFacade(), mapFacade().latLng(Number(marker.latitude), Number(marker.longitude))).y,
                    zIndex: 1199,
                    transform: 'translate(-50%, -100%)',
                }}
            >
                <MiniMarkerPopup
                    marker={marker}
                    onOpenFull={() => {
                        setMiniPopup(null);
                        setSelectedMarkerIdForPopup(markerId);
                    }}
                    isSelected={true}
                />
            </div>
        );
    });

    // --- JSX RENDER ---
    const mapContent = (
        <MapContainer>
            {isLoading && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 2000, transform: 'translate(-50%, -50%)' }}>
                    <CircularProgressBar value={progress} size={90} />
                </div>
            )}
            <GlobalLeafletPopupStyles />

            <MapWrapper
                id="map"
                className="facade-map-root"
                ref={mapContainerRef}
                style={{
                    ...mapStyle,
                    transform: isTwoPanelMode ? 'translateX(-20%)' : 'none',
                    width: isTwoPanelMode ? '140%' : '100%',
                    transition: 'transform 0.3s ease, width 0.3s ease',
                }}
            >
            {/* Error boundary wrapping map internals — allows graceful recovery */}
            <ErrorBoundary
                fallback={(
                    <div style={{ padding: 24, textAlign: 'center' }}>
                        <h3>Ошибка карты</h3>
                        <p>Попробуйте восстановить карту или обновить страницу.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={() => handleRecoverMap()}>Восстановить карту</button>
                            <button className="btn" onClick={() => window.location.reload()}>Обновить страницу</button>
                        </div>
                    </div>
                )}
                onError={(err) => {
                    console.error('[Map] ErrorBoundary caught error:', err);
                    // Попытка восстановления
                    handleRecoverMap();
                }}
            >
                {coordsForNewMarker && showCultureMessage && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, calc(-50% - 20vh - 60px))',
                            zIndex: 2001,
                            maxWidth: '220px',
                            width: '220px',
                        }}
                        className="culture-info-panel"
                    >
                        <GlassPanel
                            isOpen={true}
                            onClose={() => { }}
                            position="center"
                            width="220px"
                            closeOnOverlayClick={false}
                            showCloseButton={false}
                            className="culture-info-glass"
                        >
                            <div className="glass-panel-culture">
                                <div className="glass-panel-culture-header">
                                    🎯 Культура меток
                                </div>
                                <div style={{ opacity: 0.9 }}>
                                    Добавляйте места с уважением к реальности. Название должно быть достоверным и понятным для всех путешественников.
                                </div>
                            </div>
                        </GlassPanel>
                    </div>
                )}

                {coordsForNewMarker && (
                    <ElegantAccordionForm
                        coords={coordsForNewMarker}
                        showCultureMessage={false}
                        onSubmit={async (data: any) => {
                            if (mapRef.current && tempMarkerRef.current) {
                                mapRef.current.removeLayer(tempMarkerRef.current);
                                setTempMarker(null);
                            }
                            const markerDataWithCoords = {
                                ...data,
                                latitude: coordsForNewMarker![0],
                                longitude: coordsForNewMarker![1]
                            };
                            await handleAddMarker(markerDataWithCoords);
                            setCoordsForNewMarker(null);
                            setDiscoveredPlace(null);
                        }}
                        onCancel={() => {
                            if (mapRef.current && tempMarkerRef.current) {
                                mapRef.current.removeLayer(tempMarkerRef.current);
                                setTempMarker(null);
                            }
                            setCoordsForNewMarker(null);
                            setDiscoveredPlace(null);
                            setShowCultureMessage(true);
                        }}
                        discoveredPlace={discoveredPlace}
                        onCultureMessageClose={() => setShowCultureMessage(false)}
                    />
                )}

                {selectedMarkerPopup}
                {eventPopup}
                {mapMessage && <MapMessage>{mapMessage}</MapMessage>}

                {isDiscoveringPlace && (
                    <div className="map-overlay-loading">
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid #e2e8f0',
                            borderTop: '4px solid #4299e1',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <div style={{ color: '#2d3748', fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>
                            🔍 Ищем место...
                        </div>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                </ErrorBoundary>
            </MapWrapper>

            {isLoading && (
                <LoadingOverlay>
                    <div className="loading-content">
                        <div className="spinner" />
                        <p>{t('map.loading')}</p>
                    </div>
                </LoadingOverlay>
            )}

            {error && !isMapReadyCheck && (
                <ErrorMessage>
                    <p>{error}</p>
                    <button onClick={async () => {
                        try {
                            setError(null);
                            setIsLoading(true);
                            // Используем projectManager.reinitializeMap — если контейнер/конфиг уже сохранены, он переинициализирует карту
                            const container = mapContainerRef.current || document.getElementById('map');
                            const config = { provider: 'leaflet', center, zoom, markers: [] } as any;
                            try {
                                const api = await projectManager.reinitializeMap(container as HTMLElement, config);
                                const facadeApi = (api as any) || ((window as any).INTERNAL && (window as any).INTERNAL.api) || null;
                                if (facadeApi) {
                                    if (facadeApi.map) mapRef.current = facadeApi.map;
                                    else if (facadeApi.mapInstance) mapRef.current = facadeApi.mapInstance;
                                }
                                setIsMapReady(true);
                                setError(null);
                            } catch (err2) {
                                console.error('Retry initialization failed', err2);
                                setError(t('map.error.initialization') || 'Ошибка инициализации карты');
                            }
                        } finally {
                            setIsLoading(false);
                        }
                    }}>
                        {t('map.error.retry')}
                    </button>
                </ErrorMessage>
            )}

            {legendOpen && (
                <MapLegend
                    onClose={() => {
                        if (onLegendOpenChange) {
                            onLegendOpenChange(false);
                        } else {
                            setLegendOpen(false);
                        }
                    }}
                    mapSettings={mapSettings}
                />
            )}

            {miniPopupElement}
            {selectedMarkerPopups}
        </MapContainer>
    );

    if (portalEl) {
        return createPortal(mapContent, portalEl);
    }

    return mapContent;
}

export default Map;
























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































