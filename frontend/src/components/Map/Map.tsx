// КРИТИЧНО: Инициализируем Leaflet в window ПЕРЕД импортом любых модулей,
// которые могут использовать window.L (mapFacade, projectManager, OSMMapRenderer)
import '../../utils/leafletInit';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { OSMMapRenderer } from '../../services/map_facade/adapters/OSMMapRenderer';
import CircularProgressBar from '../ui/CircularProgressBar';

// Leaflet и его стили инициализируются в `../../utils/leafletInit`.
// Используем `mapFacade` и глобальный `window.L` вместо прямых импортов.
// Все вызовы Leaflet API проходят через фасад MapContextFacade.
// (импорты 'leaflet', 'leaflet/dist/leaflet.css' и 'leaflet.markercluster' удалены)

import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useMapStyle } from '../../hooks/useMapStyle';
import { MapContainer, MapWrapper, LoadingOverlay, ErrorMessage, GlobalLeafletPopupStyles, GlobalMarkerStyles } from './Map.styles';

import { createPortal } from 'react-dom';
import MarkerPopup from './MarkerPopup';
import { MarkerData } from '../../types/marker';
import styled from 'styled-components';
import MapLegend from './MapLegend';
import { placeDiscoveryService, DiscoveredPlace } from '../../services/placeDiscoveryService';
import MiniMarkerPopup from './MiniMarkerPopup';
import EventMiniPopup from './EventMiniPopup';
import EventStagePopup from './EventStagePopup';
import { projectManager } from '../../services/projectManager';
import { activityService } from '../../services/activityService';
import { createEvent } from '../../services/eventService';
import { useRussiaRestrictions } from '../../hooks/useRussiaRestrictions';
import { canCreateMarker } from '../../services/zoneService';
import { useContentStore, ContentState } from '../../stores/contentStore';
import { useMapDisplayMode } from '../../hooks/useMapDisplayMode';
import { useIsMobile } from '../../hooks/use-mobile';
import { FEATURES } from '../../config/features';
import { getDistanceFromLatLonInKm } from '../../utils/russiaBounds';
import { getMarkerIconPath, getCategoryColor, getFontAwesomeIconName } from '../../constants/markerCategories';
import { mapFacade, INTERNAL } from '../../services/map_facade/index';
import ErrorBoundary from '../ErrorBoundary';
// Map Debug полностью исключён из визуализации и логики
// import { initMapDebug } from '../../utils/devMapDebug';
import type { MapConfig } from '../../services/map_facade/index';
import { useMapStateStore } from '../../stores/mapStateStore';
import { useEventsStore, EventsState } from '../../stores/eventsStore';
import { MockEvent } from '../TravelCalendar/mockEvents';
import { getCategoryById } from '../TravelCalendar/TravelCalendar';
import { markerService } from '../../services/markerService';
import * as MarkerCreationPanelModule from './MarkerCreationPanel';
import type { MarkerCreationPayload } from './MarkerCreationPanel';
import EventCreationPanel, { EventCreationPayload } from './EventCreationPanel';
import {
    getTileLayer,
    getAdditionalLayers,
    createLayerIndicator,
    markerCategoryStyles,
    latLngToContainerPoint,
    createMarkerIconHTML
} from './mapUtils';

const MarkerCreationPanel = ((MarkerCreationPanelModule as any).default ?? (MarkerCreationPanelModule as any).MarkerCreationPanel) as React.ComponentType<any>;

const MapMessage = styled.div`
  position: absolute;
  top: 150px;
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
        eventCategories: string[];
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
    /** Режим добавления события: по клику на карте открывает форму события с предзаполненными координатами */
    isAddingEventMode?: boolean;
    onAddingEventModeChange?: (enabled: boolean) => void;
    onCreationPanelVisibilityChange?: (visible: boolean) => void;
}

const Map: React.FC<MapProps> = ({
    center, zoom, markers, onMapClick, onHashtagClickFromPopup,
    flyToCoordinates, selectedMarkerIdForPopup, setSelectedMarkerIdForPopup, onAddToFavorites, onAddToBlog, isFavorite,
    onFavoritesClick, favoritesCount, mapSettings, filters, searchRadiusCenter, onSearchRadiusCenterChange, selectedMarkerIds, onBoundsChange, zones = [], routeData, isAddingMarkerMode: externalIsAddingMarkerMode, onAddMarkerModeChange, legendOpen: externalLegendOpen, onLegendOpenChange,
    onRemoveFromFavorites, setSelectedMarkerIds,
    isAddingEventMode: externalIsAddingEventMode, onAddingEventModeChange,
    onCreationPanelVisibilityChange,
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
    const tempMarkerRef = useRef<any | null>(null);
    const markerClusterGroupRef = useRef<any | null>(null);
    const tileLayerRef = useRef<any | null>(null);
    const isAddingMarkerModeRef = useRef(false);
    const isAddingEventModeRef = useRef(false);
    const initRetryRef = useRef<number>(0);
    // Сохраняем исходный центр карты, чтобы восстановить при выходе из двухоконного режима
    const originalCenterRef = useRef<[number, number] | null>(null);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const onMapClickRef = useRef(onMapClick);
    const rightContentRef = useRef<string | null>(null);

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
    const isMobile = useIsMobile();
    const isTwoPanelMode = rightContent !== null && !isMobile;
    // Карта "живая" (с маркерами, попапами, кликами) только когда она является активным контентом левой панели.
    // В остальных случаях (posts/activity на фоне) карта — статичная декорация.
    const isMapInteractive = leftContent === 'map';
    const openEvents = useEventsStore((state: EventsState) => state.openEvents);
    const selectedEvent = useEventsStore((state: EventsState) => state.selectedEvent);
    const setSelectedEvent = useEventsStore((state: EventsState) => state.setSelectedEvent);
    const addOpenEvent = useEventsStore((state: EventsState) => state.addOpenEvent);
    const isPickingEventLocation = useEventsStore((state: EventsState) => state.isPickingEventLocation);
    const setPickedEventLocation = useEventsStore((state: EventsState) => state.setPickedEventLocation);
    const eventLocationMarker = useEventsStore((state: EventsState) => state.eventLocationMarker);
    const setEventLocationMarker = useEventsStore((state: EventsState) => state.setEventLocationMarker);
    const focusEvent = useEventsStore((state: EventsState) => state.focusEvent);
    const setFocusEvent = useEventsStore((state: EventsState) => state.setFocusEvent);
    const isPickingEventLocationRef = useRef(false);
    const mapDisplayMode = useMapDisplayMode();

    useEffect(() => {
        onBoundsChangeRef.current = onBoundsChange;
    }, [onBoundsChange]);

    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
        rightContentRef.current = rightContent;
    }, [rightContent]);

    // Sync picking ref + crosshair cursor
    useEffect(() => {
        isPickingEventLocationRef.current = isPickingEventLocation;
        if (isPickingEventLocation) {
            setMapMessage(null);
        }
        // Crosshair cursor on map container
        const container = mapRef.current?.getContainer?.();
        if (container) {
            if (isPickingEventLocation) {
                container.style.cursor = 'crosshair';
            } else {
                container.style.cursor = '';
            }
        }
    }, [isPickingEventLocation]);

    // --- STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [coordsForNewMarker, setCoordsForNewMarker] = useState<[number, number] | null>(null);
    const [coordsForNewEvent, setCoordsForNewEvent] = useState<[number, number] | null>(null);
    const [tempMarker, setTempMarker] = useState<any | null>(null);
    const [mapMessage, setMapMessage] = useState<string | null>(null);
    const [discoveredPlace, setDiscoveredPlace] = useState<DiscoveredPlace | null>(null);
    const [discoveredEventPlace, setDiscoveredEventPlace] = useState<DiscoveredPlace | null>(null);
    const [isDiscoveringPlace, setIsDiscoveringPlace] = useState(false);
    const [miniPopup, setMiniPopup] = useState<{
        marker: MarkerData;
        position: { x: number; y: number };
        layer?: any;
    } | null>(null);
    const [eventMiniPopup, setEventMiniPopup] = useState<{
        event: MockEvent;
        position: { x: number; y: number };
    } | null>(null);
    const [eventStagePopup, setEventStagePopup] = useState<{
        event: MockEvent;
        position: { x: number; y: number };
    } | null>(null);

    // Счётчик для принудительного пересчёта позиций selectedMarkerPopups при движении/зуме карты
    const [mapMoveVersion, setMapMoveVersion] = useState(0);

    useEffect(() => {
        onCreationPanelVisibilityChange?.(Boolean(coordsForNewMarker || coordsForNewEvent));
    }, [coordsForNewMarker, coordsForNewEvent, onCreationPanelVisibilityChange]);

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
            // При включении режима — очищаем предыдущую temp метку и форму
            if (tempMarkerRef.current && mapRef.current) {
                try { mapRef.current.removeLayer(tempMarkerRef.current); } catch (e) { }
                tempMarkerRef.current = null;
                setTempMarker(null);
            }
            setCoordsForNewMarker(null);
            setCoordsForNewEvent(null);
            setDiscoveredPlace(null);
            setDiscoveredEventPlace(null);
            setMapMessage('🎯 Кликните на карту, чтобы добавить метку');
        } else if (!tempMarkerRef.current) {
            // Очищаем сообщение только если нет временной метки
            // (если метка есть, сообщение управляется обработчиком метки)
            setMapMessage(null);
        }
    }, [onAddMarkerModeChange]);

    // --- REFS SYNC ---
    useEffect(() => {
        console.log('[Map] isAddingMarkerModeRef sync:', isAddingMarkerMode);
        isAddingMarkerModeRef.current = isAddingMarkerMode;
    }, [isAddingMarkerMode]);

    useEffect(() => {
        console.log('[Map] isAddingEventModeRef sync:', externalIsAddingEventMode);
        isAddingEventModeRef.current = externalIsAddingEventMode ?? false;
    }, [externalIsAddingEventMode]);

    // Показываем баннер и сбрасываем форму когда режим включается через внешний проп
    useEffect(() => {
        if (!isAddingMarkerMode) return;
        setCoordsForNewMarker(null);
        setDiscoveredPlace(null);
        setMapMessage('🎯 Кликните на карту, чтобы добавить метку');
    }, [isAddingMarkerMode]);

    useEffect(() => {
        if (!externalIsAddingEventMode) return;
        setCoordsForNewEvent(null);
        setDiscoveredEventPlace(null);
        setMapMessage('🖱️ Кликните по карте для выбора места события');
    }, [externalIsAddingEventMode]);

    // Если пользователь вошёл в режим добавления метки, гарантируем что карта активна
    // (иногда leftContent/фон карты могут быть переключены другими панелями).
    useEffect(() => {
        if (!isAddingMarkerMode) return;
        const contentStore = useContentStore.getState();
        if (contentStore.leftContent !== 'map') {
            contentStore.setLeftContent('map');
        }
        if (!contentStore.showBackgroundMap) {
            contentStore.setShowBackgroundMap(true);
        }
    }, [isAddingMarkerMode]);

    useEffect(() => {
        tempMarkerRef.current = tempMarker;
    }, [tempMarker]);

    // --- PORTAL VISIBILITY ---
    // --- PORTAL VISIBILITY ---
    useEffect(() => {
        if (!portalEl) return;
        const shouldShowPortal = leftContent === 'map' || rightContent === 'map' || leftContent === null || mapDisplayMode.shouldShowFullscreen;
        if (!shouldShowPortal) {
            portalEl.style.display = 'none';
            portalEl.style.visibility = 'hidden';
            portalEl.style.pointerEvents = 'none';
        } else {
            portalEl.style.display = 'block';
            portalEl.style.visibility = 'visible';
            portalEl.style.pointerEvents = 'auto';
            setTimeout(() => {
                try { mapRef.current?.invalidateSize(); } catch (e) { }
            }, 150);
        }
    }, [leftContent, rightContent, portalEl, mapDisplayMode.shouldShowFullscreen]);

    // Очищаем попапы и интерактивные элементы когда карта становится фоновой (не активной)
    useEffect(() => {
        if (!isMapInteractive) {
            setMiniPopup(null);
            setEventMiniPopup(null);
            setEventStagePopup(null);
            setSelectedMarkerIdForPopup(null);
            return;
        }

        // После возврата из planner фасад может оставаться в yandex/planner контексте.
        // Сам Leaflet-инстанс ещё жив в mapRef.current, но рендер маркеров идёт через facade,
        // поэтому явно возвращаем activeContext в osm и регистрируем живую карту обратно.
        try {
            mapFacade().setActiveContext('osm');
            if (mapRef.current) {
                mapFacade().registerBackgroundApi(
                    { map: mapRef.current, mapInstance: mapRef.current, containerId: 'map' },
                    'map'
                );
            }
        } catch (e) {
            console.debug('[Map] Failed to restore osm context on activation:', e);
        }
    }, [isMapInteractive]);

    // Map Debug полностью исключён — кнопка и логика отладки убраны
    // useEffect(() => {
    //   const cleanup = initMapDebug?.();
    //   return () => { try { cleanup && cleanup(); } catch (e) {} };
    // }, []);

    // --- FACADE MAP TOP OFFSET ---

    // Динамическое управление видимостью и классом контейнера карты
    useEffect(() => {
        const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
        // Используем mapContainerRef (#map) вместо .facade-map-root — класс facade-map-root
        // убран с MapWrapper чтобы исключить конфликты CSS (position:fixed + pointer-events:none)
        const mapWrapperEl = mapContainerRef.current;
        
        if (mapContainer) {
            if (mapDisplayMode.shouldShowFullscreen) {
                mapContainer.style.display = 'block';
                mapContainer.style.visibility = 'visible';
                // Интерактивность только когда Map — активная левая панель.
                // В фоновом режиме (посты, активность и т.д.) карта декоративна:
                // pointer-events: none, чтобы не перехватывать клики с контента.
                // При isPlannerActive shouldShowFullscreen уже false (см. useMapDisplayMode),
                // поэтому дополнительная проверка не нужна.
                mapContainer.style.pointerEvents = isMapInteractive ? 'auto' : 'none';
                mapContainer.style.zIndex = '1';
            } else {
                // Скрываем карту когда она не нужна (Planner активен или фон отключён)
                mapContainer.style.display = 'none';
                mapContainer.style.visibility = 'hidden';
                mapContainer.style.pointerEvents = 'none';
            }
        }
        
        // Добавляем класс для стилизации в зависимости от режима (на #map wrapper)
        if (mapWrapperEl) {
            mapWrapperEl.classList.remove('two-panel-mode', 'single-panel-mode', 'map-hidden');
            if (!mapDisplayMode.shouldShowFullscreen) {
                mapWrapperEl.classList.add('map-hidden');
            } else if (mapDisplayMode.isTwoPanelMode) {
                mapWrapperEl.classList.add('two-panel-mode');
            } else {
                mapWrapperEl.classList.add('single-panel-mode');
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
    }, [mapDisplayMode.shouldShowFullscreen, mapDisplayMode.isTwoPanelMode, leftContent, isMapInteractive]);

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

            // invalidateSize ПОСЛЕ завершения CSS transition (300ms) — иначе Leaflet считает неправильный размер
            setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch (e) {} }, 350);
            setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch (e) {} }, 600);
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
                    // Переиспользуем registeredApi ТОЛЬКО если он принадлежит Leaflet-контейнеру '#map'.
                    // После инициализации Planner INTERNAL.api содержит Yandex-карту
                    // (containerId = 'planner-map-container'). Если мы её подставим как Leaflet —
                    // mapRef.current получит Yandex-экземпляр, Leaflet никогда не создастся в #map,
                    // и карта не отображается (critical bug для мобильной версии где MapComponent re-mountится).
                    const mapInst = registeredApi?.map || registeredApi?.mapInstance;
                    const isLeafletContainer = registeredApi?.containerId === 'map' || !registeredApi?.containerId;
                    const isConnectedToDOM = mapInst?.getContainer?.()?.isConnected !== false;
                    if (registeredApi && mapInst && isLeafletContainer && isConnectedToDOM) {
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

                // После вызова projectManager.initializeMap, INTERNAL.api обновляется внутри facade.
                // Для разрешения конфликта после Planner-сессии: берём initResult первым
                // (он уже из правильного OSM контекста), и лишь как fallback — INTERNAL.api.
                const internalApi = (INTERNAL as any)?.api;
                const internalIsLeaflet = (internalApi?.containerId === 'map' || !internalApi?.containerId)
                    && (internalApi?.map || internalApi?.mapInstance);
                const facadeApi = initResult || (internalIsLeaflet ? internalApi : null) || {};
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

                // Гарантируем, что mapRef — это реальный Leaflet instance с .on()
                if (mapRef.current && typeof mapRef.current.on !== 'function') {
                    const candidates = [
                        mapRef.current?.map, mapRef.current?.mapInstance,
                        (facadeApi as any)?.map, (facadeApi as any)?.mapInstance,
                        initResult?.map, initResult?.mapInstance
                    ];
                    for (const c of candidates) {
                        if (c && typeof c.on === 'function' && typeof c.addLayer === 'function') {
                            mapRef.current = c;
                            break;
                        }
                    }
                }

                // Перерегистрируем в фасаде после unwrap, чтобы фасад тоже
                // ссылался на реальный Leaflet instance
                if (mapRef.current && typeof mapRef.current.on === 'function') {
                    mapFacade().registerBackgroundApi(
                        { map: mapRef.current, mapInstance: mapRef.current, containerId: 'map' },
                        'map'
                    );
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

                if (mapRef.current && typeof mapRef.current.eachLayer === 'function') {
                    mapRef.current.eachLayer((layer: any) => {
                        if (layer && typeof layer.getLayers === 'function' && layer !== markerClusterGroupRef.current) {
                            try { mapRef.current?.removeLayer(layer); } catch (e) { }
                        }
                    });
                }

                if (mapRef.current && typeof mapRef.current.on === 'function') {
                    mapRef.current.on('moveend', () => {
                        if (onBoundsChangeRef.current && mapRef.current) {
                            const bounds = mapRef.current.getBounds();
                            if (bounds && typeof bounds.getNorth === 'function') {
                                onBoundsChangeRef.current({
                                    north: bounds.getNorth(),
                                    south: bounds.getSouth(),
                                    east: bounds.getEast(),
                                    west: bounds.getWest()
                                });
                            }
                        }
                    });
                }

                if (mapRef.current && typeof mapRef.current.on === 'function') {
                    mapRef.current.on('click', async (e: any) => {
                    if (!mapRef.current) return; // Guard to avoid crashes if map is gone

                    console.log('[Map click] isAddingMarkerMode:', isAddingMarkerModeRef.current, 'isAddingEventMode:', isAddingEventModeRef.current, 'isPicking:', isPickingEventLocationRef.current, 'latlng:', e.latlng?.lat, e.latlng?.lng);

                    // --- Pick event location mode ---
                    if (isPickingEventLocationRef.current) {
                        const clickedLatLng = e.latlng;
                        setMapMessage('🔍 Ищем информацию об этом месте...');

                        // Сразу ставим маркер через store (он будет жить пока форма открыта)
                        setEventLocationMarker({ lat: clickedLatLng.lat, lng: clickedLatLng.lng });

                        // Полноценное обнаружение места через placeDiscoveryService (как в «Добавить метку»)
                        let pickedName = '';
                        let pickedAddress = '';
                        let pickedCategory = '';
                        let pickedType = '';

                        try {
                            const searchResult = await placeDiscoveryService.discoverPlace(clickedLatLng.lat, clickedLatLng.lng);
                            if (searchResult.places.length > 0 && searchResult.bestMatch) {
                                const best = searchResult.bestMatch;
                                pickedName = best.name || '';
                                pickedAddress = best.address || '';
                                pickedCategory = best.category || '';
                                pickedType = best.type || '';
                            }
                        } catch (_) { /* placeDiscovery мог упасть, fallback на Nominatim */ }

                        setPickedEventLocation({
                            lat: clickedLatLng.lat,
                            lng: clickedLatLng.lng,
                            address: pickedAddress,
                            name: pickedName,
                            category: pickedCategory,
                            type: pickedType,
                        });
                        setMapMessage(null);
                        return;
                    }

                    // --- Режим добавления события ---
                    if (isAddingEventModeRef.current) {
                        const clickedLatLng = e.latlng;

                        // Ставим фиолетовую временную метку события
                        clearTempMarker();
                        setCoordsForNewEvent(null);
                        setDiscoveredEventPlace(null);

                        const zoom = mapRef.current.getZoom();
                        const mapSize = mapRef.current.getSize();
                        const projectedClick = mapRef.current.project(clickedLatLng, zoom);
                        const isTwoPanel = !isMobile && rightContentRef.current !== null;
                        let targetX = projectedClick.x;
                        if (isTwoPanel) {
                            const leftHalfCenterX = mapSize.x * 0.25;
                            const screenCenterX = mapSize.x / 2;
                            const offsetX = leftHalfCenterX - screenCenterX;
                            targetX = projectedClick.x - offsetX;
                        }

                        const targetCenterPoint = mapFacade().point(targetX, projectedClick.y);
                        const targetCenterLatLng = mapRef.current.unproject(targetCenterPoint, zoom);
                        try { mapRef.current.setView(targetCenterLatLng, zoom, { animate: true }); } catch (err) { }

                        const eventIcon = mapFacade().createDivIcon({
                            className: 'temp-event-marker-icon',
                            html: '<div style="background:linear-gradient(135deg,#8b5cf6,#ec4899);width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 14px rgba(139,92,246,0.6),0 0 0 4px rgba(139,92,246,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;"></div>',
                            iconSize: [28, 28],
                            iconAnchor: [14, 14],
                        });
                        const tempEventMarker = createLiveMarker(clickedLatLng.lat, clickedLatLng.lng, { icon: eventIcon, bubblingMouseEvents: false });
                        if (tempEventMarker) {
                            setTempMarker(tempEventMarker);
                            // Выключаем режим — временная точка уже поставлена
                            onAddingEventModeChange?.(false);
                            setMapMessage('📍 Нажмите на метку, чтобы подтвердить место события');

                            tempEventMarker.on('click', async (markerEvent: any) => {
                                if (markerEvent.originalEvent) {
                                    markerEvent.originalEvent.stopPropagation();
                                }

                                const map = mapRef.current;
                                if (map) {
                                    const currentZoom = map.getZoom();
                                    const currentMapSize = map.getSize();
                                    const markerProjected = map.project(clickedLatLng, currentZoom);
                                    const targetY = currentMapSize.y * (isMobile ? 0.20 : 0.30);
                                    const centerY = currentMapSize.y / 2;
                                    const panOffsetY = targetY - centerY;
                                    let panTargetX = markerProjected.x;
                                    if (isTwoPanel) {
                                        const leftCenterX = currentMapSize.x * 0.25;
                                        const centerX = currentMapSize.x / 2;
                                        panTargetX = markerProjected.x - (leftCenterX - centerX);
                                    }

                                    const panTarget = mapFacade().point(panTargetX, markerProjected.y - panOffsetY);
                                    const panLatLng = map.unproject(panTarget, currentZoom);
                                    try { map.setView(panLatLng, currentZoom, { animate: true }); } catch (err) { }
                                }

                                setMapMessage('🔍 Ищем информацию о месте события...');
                                const foundPlace = await discoverEventPlace(clickedLatLng.lat, clickedLatLng.lng);
                                setCoordsForNewEvent([clickedLatLng.lat, clickedLatLng.lng]);
                                setDiscoveredEventPlace(foundPlace);
                                setMapMessage(null);
                            });
                        }
                        return;
                    }

                    if (isAddingMarkerModeRef.current) {
                        // --- ШАГ 1: Первый клик — ставим временную красную метку ---
                        clearTempMarker();
                        // Сбрасываем форму если была открыта
                        setCoordsForNewMarker(null);
                        setDiscoveredPlace(null);

                        const clickedLatLng = e.latlng;

                        // Панорамируем карту: метка по центру экрана (учитываем двухоконный режим)
                        const zoom = mapRef.current.getZoom();
                        const mapSize = mapRef.current.getSize();
                        const projectedClick = mapRef.current.project(clickedLatLng, zoom);

                        // В двухоконном режиме смещаем фокус влево (центр левой половины карты)
                        const isTwoPanel = !isMobile && rightContentRef.current !== null;
                        let targetX = projectedClick.x;
                        if (isTwoPanel) {
                            // Смещаем вид так, чтобы метка оказалась в центре левой половины экрана
                            const leftHalfCenterX = mapSize.x * 0.25;
                            const screenCenterX = mapSize.x / 2;
                            const offsetX = leftHalfCenterX - screenCenterX;
                            targetX = projectedClick.x - offsetX;
                        }

                        const targetCenterPoint = mapFacade().point(targetX, projectedClick.y);
                        const targetCenterLatLng = mapRef.current.unproject(targetCenterPoint, zoom);
                        try { mapRef.current.setView(targetCenterLatLng, zoom, { animate: true }); } catch (err) { }

                        // Создаём красную временную метку
                        const tempIcon = mapFacade().createDivIcon({
                            className: 'temp-marker-icon',
                            html: '<div style="background-color: red; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 12px rgba(255,0,0,0.5), 0 0 0 4px rgba(255,0,0,0.2); z-index: 3000; cursor: pointer; animation: pulse-temp-marker 1.5s ease-in-out infinite;"></div>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12],
                        });

                            let newTempMarker = createLiveMarker(clickedLatLng.lat, clickedLatLng.lng, { icon: tempIcon, bubblingMouseEvents: false });
                        if (!newTempMarker) return;

                        setTempMarker(newTempMarker);

                        // Выключаем режим добавления (метка поставлена)
                        setIsAddingMarkerMode(false);
                        setMapMessage('📍 Нажмите на метку для подтверждения места');

                        // --- ШАГ 2: Навешиваем обработчик клика на временную метку ---
                        newTempMarker.on('click', async (markerEvent: any) => {
                            // Предотвращаем всплытие клика на карту
                            if (markerEvent.originalEvent) {
                                markerEvent.originalEvent.stopPropagation();
                            }

                            setMapMessage('🔍 Ищем информацию об этом месте...');

                            // Панорамируем карту: метка вверху, форма снизу
                            const map = mapRef.current;
                            if (map) {
                                const currentZoom = map.getZoom();
                                const currentMapSize = map.getSize();
                                const markerProjected = map.project(clickedLatLng, currentZoom);

                                // Метка на 30% сверху экрана, форма будет ниже
                                const targetY = currentMapSize.y * (isMobile ? 0.20 : 0.30);
                                const centerY = currentMapSize.y / 2;
                                const panOffsetY = targetY - centerY;

                                // В двухоконном режиме — смещаем влево; на мобильных (isTwoPanel=false) центруем по X
                                let panTargetX = markerProjected.x;
                                if (isTwoPanel) {
                                    const leftCenterX = currentMapSize.x * 0.25;
                                    const centerX = currentMapSize.x / 2;
                                    panTargetX = markerProjected.x - (leftCenterX - centerX);
                                }

                                const panTarget = mapFacade().point(panTargetX, markerProjected.y - panOffsetY);
                                const panLatLng = map.unproject(panTarget, currentZoom);
                                try { map.setView(panLatLng, currentZoom, { animate: true }); } catch (err) { }
                            }

                            // Запускаем геокодинг
                            const placeFound = await handlePlaceDiscovery(clickedLatLng.lat, clickedLatLng.lng);
                            setCoordsForNewMarker([clickedLatLng.lat, clickedLatLng.lng]);

                            if (!placeFound) {
                                setMapMessage('ℹ️ Место не найдено, можно добавить вручную');
                                setTimeout(() => setMapMessage(null), 3000);
                            } else {
                                setMapMessage(null);
                            }
                        });
                    } else {
                        // Клик по пустому месту карты — закрываем попап маркера
                        setSelectedMarkerIdForPopup(null);
                        if (onMapClickRef.current) {
                            onMapClickRef.current([e.latlng.lat, e.latlng.lng]);
                        }
                    }
                });
                }

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
            // КРИТИЧНО: Правильный cleanup при размонтировании компонента
            // Удаляем временный маркер
            if (mapRef.current && tempMarkerRef.current) {
                try { mapRef.current.removeLayer(tempMarkerRef.current); } catch (e) { }
                tempMarkerRef.current = null;
            }
            
            // НЕ удаляем карту здесь! Сохраняем её для возможного переиспользования
            // Очистка фасада происходит на уровне страницы (MapPage/PlannerPage)
        };
    }, [forceReinit]);

    // --- MAP STATE SAVING ---
    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;

        const map = mapRef.current;
        if (typeof map.on !== 'function') return;

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

        if (mapFacade().getMap()) {
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
        if (!mapRef.current) return;
        if (!isMapReady) return; // Ждём пока карта полностью инициализирована

        if (isMapInteractive) {
            try {
                mapFacade().setActiveContext('osm');
                mapFacade().registerBackgroundApi(
                    { map: mapRef.current, mapInstance: mapRef.current, containerId: 'map' },
                    'map'
                );
            } catch (e) {
                console.debug('[Map] Failed to rebind osm context before markers render:', e);
            }
        }

        // Если карта не является активным контентом (фон для posts/activity) — убираем маркеры
        if (!isMapInteractive) {
            if (markerClusterGroupRef.current) {
                try {
                    if (mapRef.current && typeof (mapRef.current as any).removeLayer === 'function') {
                        (mapRef.current as any).removeLayer(markerClusterGroupRef.current);
                    }
                } catch (e) { }
                markerClusterGroupRef.current = null;
            }
            return;
        }

        const hasRegularMarkers = markersData && markersData.length > 0;

        const { radiusOn, radius } = filters;
        const { themeColor, showHints } = mapSettings;
        const [searchRadiusCenterLat, searchRadiusCenterLng] = searchRadiusCenter;

        if (markerClusterGroupRef.current) {
            try {
                if (mapRef.current && typeof (mapRef.current as any).removeLayer === 'function') {
                    (mapRef.current as any).removeLayer(markerClusterGroupRef.current);
                }
            } catch (e) { }
            markerClusterGroupRef.current = null;
        }

        if (mapRef.current && typeof (mapRef.current as any).eachLayer === 'function') {
            // Collect layers first to avoid modifying collection during iteration
            const layersToRemove: any[] = [];
            (mapRef.current as any).eachLayer((layer: any) => {
                if (layer && (layer as any).markerData && layer !== tempMarkerRef.current) {
                    layersToRemove.push(layer);
                }
            });
            for (const layer of layersToRemove) {
                try {
                    if (typeof (mapRef.current as any).removeLayer === 'function') {
                        (mapRef.current as any).removeLayer(layer);
                    }
                } catch (e) { }
            }
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
                    iconSize: [34, 34]
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

                const [iconWidth, iconHeight] = isInRadius ? [35, 46] : [27, 35];
                const markerIconUrl = getMarkerIconPath(markerCategory);
                const markerCategoryStyle = markerCategoryStyles[markerCategory] || markerCategoryStyles.default;
                // forbid pure black as icon color – it looks like an "empty" marker
                let iconColor = isPending ? '#ff9800' : null;
                if (!iconColor) {
                  if (isInRadius) {
                    // if themeColor is a default/placeholder black, ignore it
                    iconColor = (themeColor && themeColor.toLowerCase() !== 'black' && themeColor !== '#000' && themeColor !== '#000000')
                      ? themeColor
                      : (getCategoryColor(markerCategory) || markerCategoryStyle.color);
                  } else {
                    iconColor = getCategoryColor(markerCategory) || markerCategoryStyle.color;
                  }
                }
                const faIconName = getFontAwesomeIconName(markerCategory);

                const customIcon = mapFacade().createIcon({
                    iconUrl: markerIconUrl,
                    iconSize: [iconWidth, iconHeight],
                    iconAnchor: [iconWidth / 2, iconHeight],
                    popupAnchor: [0, -iconHeight],
                    className: `marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}${markerCategory === 'user_poi' ? ' marker-user-poi' : ''}${isPending ? ' marker-pending' : ''}`,
                });

                const Leaflet = (window as any).L;
                let leafletMarker = Leaflet?.marker
                    ? Leaflet.marker([lat, lng], { icon: customIcon })
                    : mapFacade().createMarker([lat, lng], { icon: customIcon });
                if (!leafletMarker) {
                    console.warn('[Map] createMarker returned null for marker', markerData?.id);
                    return;
                }

                // PNG иконки не существуют — сразу используем каплевидные HTML-маркеры
                const teardropSize = Math.max(iconWidth, iconHeight);
                const divIcon = mapFacade().createDivIcon({
                    className: `marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}${isPending ? ' marker-pending' : ''}`,
                    html: createMarkerIconHTML(markerCategory, iconColor, teardropSize),
                    iconSize: [teardropSize, teardropSize],
                    iconAnchor: [teardropSize / 2, teardropSize],
                    popupAnchor: [0, -teardropSize],
                });
                try { leafletMarker.setIcon(divIcon); } catch (err) { console.debug('[Map] setIcon failed on divIcon:', err); }
                try { (leafletMarker as any).markerData = markerData; } catch (err) { console.debug('[Map] Failed to set markerData on leafletMarker:', err); }

                leafletMarker.on('mouseover', () => {
                    setMiniPopup({
                        marker: markerData,
                            position: getLiveContainerPoint(Number(markerData.latitude), Number(markerData.longitude)),
                        layer: leafletMarker
                    });
                });

                leafletMarker.on('click', (e: any) => {
                    e?.originalEvent?.stopPropagation?.();
                    setMiniPopup(null);
                    setSelectedMarkerIdForPopup(markerData.id);
                });

                if (showHints) {
                    leafletMarker.bindTooltip(markerData.title, { direction: 'top', offset: [0, -10] });
                }

                if (markerClusterGroup) markerClusterGroup.addLayer(leafletMarker);
            }
        });

        // Event markers — show whenever calendar is paired with map OR 'event' category selected
        // Важно: если openEvents не удалось загрузить из API (500),
        // всё равно показываем выбранное/сфокусированное событие.
        const calendarIsActive = (leftContent as string) === 'calendar'
            || (rightContent as string) === 'calendar'
            || (filters.categories && filters.categories.includes('event'));
        const eventMarkersSource: MockEvent[] = calendarIsActive
            ? (() => {
                const byId = new globalThis.Map<string, MockEvent>();
                openEvents.forEach((event: MockEvent) => {
                    byId.set(String(event.id), event);
                });

                const pushCandidate = (event: MockEvent | null | undefined) => {
                    if (!event) return;
                    const id = String(event.id);
                    if (!byId.has(id)) {
                        byId.set(id, event);
                    }
                };

                pushCandidate(selectedEvent as MockEvent | null);
                pushCandidate(focusEvent as MockEvent | null);

                // Фильтрация по категориям событий
                let events = Array.from(byId.values());
                if (filters.eventCategories && filters.eventCategories.length > 0) {
                    events = events.filter(event => 
                        filters.eventCategories.includes(event.categoryId)
                    );
                }
                return events;
            })()
            : [];

        if (eventMarkersSource.length > 0) {
            eventMarkersSource.forEach((event: MockEvent) => {
                const lat = event.latitude;
                const lng = event.longitude;

                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    const category = getCategoryById(event.categoryId);

                    const categoryIconMap: { [key: string]: string } = {
                        'festival': 'fa-bullhorn', 'concert': 'fa-music', 'exhibition': 'fa-image',
                        'sport': 'fa-trophy', 'market': 'fa-store', 'holiday': 'fa-gift',
                        'fishing': 'fa-fish', 'oktoberfest': 'fa-beer', 'parade': 'fa-flag',
                        'theater': 'fa-theater-masks', 'heritage': 'fa-landmark', 'kids': 'fa-child',
                        'nightlife': 'fa-moon'
                    };
                    const categoryIcon = categoryIconMap[event.categoryId] || 'fa-calendar';

                    // Фиолетовый базовый цвет для всех маркеров событий
                    const eventBaseColor = '#7c3aed';
                    const eventSelectedColor = '#a855f7';

                    const isSelected = selectedEvent?.id === event.id;
                    const iconSize = isSelected ? 44 : 34;

                    const eventIcon = mapFacade().createDivIcon({
                        className: `event-marker-icon ${isSelected ? 'event-marker-selected' : ''}`,
                        html: `<div class="event-marker-base" style="width: ${iconSize}px; height: ${iconSize}px; background: linear-gradient(135deg, ${isSelected ? eventSelectedColor : eventBaseColor}, ${isSelected ? '#c084fc' : '#6d28d9'}); border: 2.5px solid rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(124,58,237,0.45), 0 0 0 ${isSelected ? '4px' : '0px'} rgba(168,85,247,0.35); ${isSelected ? 'animation: eventMarkerPulse 2s ease-in-out infinite;' : ''} transition: all 0.3s ease;"><i class="fa ${categoryIcon}" style="color: #ffffff; font-size: ${iconSize * 0.38}px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></i></div>`,
                        iconSize: [iconSize, iconSize],
                        iconAnchor: [iconSize / 2, iconSize],
                        popupAnchor: [0, -iconSize],
                    });

                    const Leaflet = (window as any).L;
                    let eventMarker = Leaflet?.marker
                        ? Leaflet.marker([lat, lng], { icon: eventIcon })
                        : mapFacade().createMarker([lat, lng], { icon: eventIcon });
                    if (!eventMarker) return;
                    (eventMarker as any).eventData = event;

                    eventMarker.on('mouseover', () => {
                        setEventMiniPopup({
                            event: event,
                            position: getLiveContainerPoint(lat, lng)
                        });
                    });

                    eventMarker.on('click', (e: any) => {
                        e?.originalEvent?.stopPropagation?.();

                        if (isMobile) {
                            setEventStagePopup(null);
                            setEventMiniPopup({
                                event,
                                position: getLiveContainerPoint(lat, lng)
                            });
                            return;
                        }

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
    }, [markersData, isDarkMode, filters, searchRadiusCenter, mapSettings, openEvents, selectedEvent, focusEvent, leftContent, rightContent, isMapReady, isMapInteractive]);

    // --- UNIFIED POPUP HANDLER ---
    useEffect(() => {
        if (!markerClusterGroupRef.current) return;

        markerClusterGroupRef.current.eachLayer((layer: any) => {
            if (!layer.markerData) return;

            const markerId = String(layer.markerData.id);
            const isSelected = selectedMarkerIds?.includes(markerId) || false;

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
            const map = mapRef.current;
            const targetZoom = 14;
            const mapSize = map.getSize();

            if (isTwoPanelMode && mapSize.x > 0) {
                const projected = map.project([lat, lng], targetZoom);
                const targetScreenX = mapSize.x * 0.25;
                const dx = targetScreenX - (mapSize.x / 2);
                const offsetPoint = mapFacade().point(projected.x - dx, projected.y);
                const offsetCenter = map.unproject(offsetPoint, targetZoom);
                map.setView(offsetCenter, targetZoom, { animate: true, duration: 0.5 });
            } else {
                map.setView([lat, lng], targetZoom, { animate: true, duration: 0.5 });
            }
        } catch (error) { }
    }, [selectedEvent, isTwoPanelMode]);

    // --- ROUTE RENDER ---
    useEffect(() => {
        if (!mapRef.current || !routeData) return;

        if (typeof mapRef.current.eachLayer === 'function') {
            mapRef.current.eachLayer((layer: any) => {
                if ((layer as any).isRouteLayer) {
                    try { mapRef.current?.removeLayer(layer); } catch (e) { }
                }
            });
        }

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
                        html: `<div class="route-marker-base"><div class="route-marker-number">${index + 1}</div><div class="route-marker-icon-inner"><i class="fa fa-route"></i></div></div>`,
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
        if (mapRef.current && routePolyline && typeof mapRef.current.on === 'function') {
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
                if (typeof mapRef.current.eachLayer === 'function') {
                    mapRef.current.eachLayer((layer: any) => {
                        if ((layer as any).isRouteLayer) {
                            mapRef.current?.removeLayer(layer);
                        }
                    });
                }
                if (zoomHandler && typeof mapRef.current.off === 'function') {
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
        // when the layer is hidden we still need to clear existing polygons
        if (mapRef.current && typeof mapRef.current.eachLayer === 'function') {
            mapRef.current.eachLayer((layer: any) => {
                if ((layer as any)?.isZoneLayer) {
                    try { mapRef.current?.removeLayer(layer); } catch (e) { }
                }
            });
        }

        // remove any previous zone layers first
        if (typeof mapRef.current.eachLayer === 'function') {
            mapRef.current.eachLayer((layer: any) => {
                if ((layer as any)?.isZoneLayer) {
                    try { mapRef.current?.removeLayer(layer); } catch (e) { }
                }
            });
        }

        // draw in small batches so we yield to the browser
        const BATCH_SIZE = 500;
        let idx = 0;
        const zonesCopy = [...zones];

        const drawBatch = () => {
            const end = Math.min(idx + BATCH_SIZE, zonesCopy.length);
            for (; idx < end; idx++) {
                const zone = zonesCopy[idx];
                const color = (zone.severity === 'critical') ? '#EF4444' : (zone.severity === 'warning') ? '#F59E0B' : '#FB923C';

                zone.polygons.forEach(ring => {
                    const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
                    const polygon = mapFacade().createPolygon(latLngs, {
                        color: color,
                        fillColor: color,
                        fillOpacity: 0.2,
                        weight: 2,
                    });

                    if (polygon && mapRef.current && typeof (polygon as any).addTo === 'function') {
                        safeAddTo(polygon);
                        (polygon as any).isZoneLayer = true;
                    }
                });
            }
            if (idx < zonesCopy.length) {
                // give priority back to browser
                setTimeout(drawBatch, 0);
            }
        };
        drawBatch();
    }, [zones]);

    // --- FLY TO ---
    useEffect(() => {
        console.log('[Map] flyTo effect triggered, flyToCoordinates:', flyToCoordinates);
        if (flyToCoordinates && mapRef.current) {
            // Проверяем, что flyToCoordinates — массив длины 2
            if (!Array.isArray(flyToCoordinates) || flyToCoordinates.length !== 2) {
                console.warn('[Map] flyTo skipped — invalid coordinates format:', flyToCoordinates);
                return;
            }
            const [lat, lng] = flyToCoordinates;
            // Проверяем, что координаты являются числами, не NaN, не Infinity и в допустимых пределах
            const isValid = typeof lat === 'number' && typeof lng === 'number' &&
                !isNaN(lat) && !isNaN(lng) &&
                isFinite(lat) && isFinite(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180;
            console.log('[Map] Coordinates validation result:', isValid, 'lat:', lat, 'lng:', lng);
            if (isValid) {
                const map = mapRef.current;
                const currentZoom = map.getZoom();
                console.log('[Map] Flying to coordinates with zoom:', currentZoom);
                const mapSize = map.getSize();

                // В двухоконном режиме смещаем центр, чтобы точка оказалась в видимой части
                if (isTwoPanelMode && mapSize.x > 0) {
                    const projected = map.project(flyToCoordinates, currentZoom);
                    // Проверяем, что projected.x и projected.y валидны
                    if (!isFinite(projected.x) || !isFinite(projected.y)) {
                        console.warn('[Map] flyTo skipped — projected coordinates invalid:', projected);
                        return;
                    }
                    const targetScreenX = mapSize.x * 0.25;
                    const dx = targetScreenX - (mapSize.x / 2);
                    const offsetPoint = mapFacade().point(projected.x - dx, projected.y);
                    const offsetCenter = map.unproject(offsetPoint, currentZoom);
                    map.flyTo(offsetCenter, currentZoom, { animate: true, duration: 1.2 });
                } else {
                    map.flyTo(flyToCoordinates, currentZoom, { animate: true, duration: 1.2 });
                }
            } else {
                console.warn('[Map] flyTo skipped — invalid coordinates:', flyToCoordinates);
            }
        }
    }, [flyToCoordinates, isTwoPanelMode]);

    // --- CENTER/ZOOM WHEN SELECTED MARKERS CHANGE ---
    useEffect(() => {
        if (!mapRef.current || !Array.isArray(selectedMarkerIds) || selectedMarkerIds.length === 0) return;
        // собираем координаты существующих меток по id
        const pts = selectedMarkerIds
            .map(id => markersData.find(m => m.id === id) || markers?.find(m => m.id === id))
            .filter((m): m is MarkerData => !!m && m.latitude != null && m.longitude != null);
        if (pts.length === 0) return;

        try {
            if (pts.length === 1) {
                const [lat, lng] = [Number(pts[0].latitude), Number(pts[0].longitude)];
                if (!isNaN(lat) && !isNaN(lng)) {
                    const map = mapRef.current;
                    const currentZoom = map.getZoom();
                    map.flyTo([lat, lng], currentZoom, { animate: true, duration: 1.2 });
                }
            } else {
                const latLngs = pts.map(p => mapFacade().latLng(Number(p.latitude), Number(p.longitude)));
                const bounds = mapFacade().latLngBounds(latLngs);
                mapFacade().fitBounds(bounds, { padding: [60, 60] });
            }
        } catch (e) {
            console.warn('[Map] failed to adjust view for selectedMarkerIds', e);
        }
    }, [selectedMarkerIds, markersData]);

    // --- FLY TO FOCUSED EVENT ---
    useEffect(() => {
        if (focusEvent && mapRef.current) {
            const lat = focusEvent.latitude;
            const lng = focusEvent.longitude;
            if (Number.isFinite(lat) && Number.isFinite(lng) && !isNaN(lat) && !isNaN(lng)) {
                const map = mapRef.current;
                const targetZoom = 13;
                const mapSize = map.getSize();

                // В двухоконном режиме смещаем центр карты влево (на 25% ширины),
                // чтобы маркер оказался посередине видимой части карты, а не под правой панелью
                if (isTwoPanelMode && mapSize.x > 0) {
                    const projected = map.project([lat, lng], targetZoom);
                    const targetScreenX = mapSize.x * 0.25;
                    const dx = targetScreenX - (mapSize.x / 2);
                    const offsetPoint = mapFacade().point(projected.x - dx, projected.y);
                    const offsetCenter = map.unproject(offsetPoint, targetZoom);
                    map.flyTo(offsetCenter, targetZoom, { animate: true, duration: 1.2 });
                } else {
                    map.flyTo([lat, lng], targetZoom, { animate: true, duration: 1.2 });
                }
            }
            // Сбрасываем после полёта
            setTimeout(() => setFocusEvent(null), 1500);
        }
    }, [focusEvent, setFocusEvent, isTwoPanelMode]);

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
                        if (typeof mapRef.current?.off === 'function') {
                            mapRef.current.off('mousemove', onMove);
                            mapRef.current.off('mouseup', onUp);
                        }
                        mapRef.current?.dragging?.enable();
                    };
                    if (typeof mapRef.current?.on === 'function') {
                        mapRef.current.on('mousemove', onMove);
                        mapRef.current.on('mouseup', onUp);
                    }
                });
            }
        }

        return () => { if (radiusCircle) radiusCircle.remove(); };
    }, [filters.radiusOn, filters.radius, searchRadiusCenter, mapSettings.themeColor]);

    // --- MINI POPUP CLOSE ON MOVE ---
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        if (typeof map.on !== 'function') return;

        const closeMiniPopup = () => {
            setMiniPopup(null);
            setEventMiniPopup(null);
            setEventStagePopup(null);
        };

        map.on('movestart', closeMiniPopup);
        map.on('zoomstart', closeMiniPopup);

        // Обновляем позиции selectedMarkerPopups при завершении движения/зума
        const updatePopupPositions = () => {
            setMapMoveVersion(v => v + 1);
        };
        map.on('moveend', updatePopupPositions);
        map.on('zoomend', updatePopupPositions);

        return () => {
            map.off('movestart', closeMiniPopup);
            map.off('zoomstart', closeMiniPopup);
            map.off('moveend', updatePopupPositions);
            map.off('zoomend', updatePopupPositions);
        };
    }, []);

    const buildOsmFallbackName = (data: any): string => {
        return (
            data?.name ||
            data?.namedetails?.name ||
            data?.address?.attraction ||
            data?.address?.tourism ||
            data?.address?.amenity ||
            data?.address?.building ||
            data?.address?.leisure ||
            data?.address?.historic ||
            data?.address?.shop ||
            data?.address?.road ||
            data?.address?.pedestrian ||
            data?.address?.neighbourhood ||
            data?.address?.suburb ||
            data?.address?.village ||
            data?.address?.hamlet ||
            ''
        );
    };

    const buildDiscoveredPlaceFallbackName = (place: Partial<DiscoveredPlace> | null | undefined): string => {
        return (
            place?.name ||
            place?.address?.split(',').map(part => part.trim()).find(Boolean) ||
            place?.type ||
            place?.category ||
            'Выбранная точка'
        );
    };

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
                const bestMatch = {
                    ...searchResult.bestMatch,
                    name: searchResult.bestMatch.name?.trim() || buildDiscoveredPlaceFallbackName(searchResult.bestMatch),
                };

                setDiscoveredPlace(bestMatch);
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

    const clearTempMarker = useCallback(() => {
        if (mapRef.current && tempMarkerRef.current) {
            try {
                mapRef.current.removeLayer(tempMarkerRef.current);
            } catch (e) { }
        }

        tempMarkerRef.current = null;
        setTempMarker(null);
    }, []);

    const discoverEventPlace = useCallback(async (latitude: number, longitude: number): Promise<DiscoveredPlace | null> => {
        try {
            const searchResult = await placeDiscoveryService.discoverPlace(latitude, longitude);
            if (searchResult.places.length > 0 && searchResult.bestMatch) {
                return {
                    ...searchResult.bestMatch,
                    name: searchResult.bestMatch.name?.trim() || buildDiscoveredPlaceFallbackName(searchResult.bestMatch),
                };
            }
        } catch (e) { }

        return null;
    }, []);

    // --- ADD MARKER ---
    const handleAddMarker = async (data: MarkerCreationPayload & { latitude: number; longitude: number }) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setMapMessage('Ошибка: необходимо авторизоваться');
                setTimeout(() => setMapMessage(null), 3000);
                throw new Error('Необходимо авторизоваться');
            }

            if (FEATURES.GEOGRAPHIC_RESTRICTIONS_ENABLED) {
                const coordinateCheck = russiaRestrictions.checkCoordinates(data.latitude, data.longitude);
                if (!coordinateCheck.isValid) {
                    setMapMessage(`Ошибка: ${coordinateCheck.errorMessage}`);
                    setTimeout(() => setMapMessage(null), 5000);
                    throw new Error(coordinateCheck.errorMessage || 'Координаты вне допустимой зоны');
                }
            }

            // ОБЯЗАТЕЛЬНАЯ проверка запретных зон — всегда активна, не зависит от флага
            const zoneCheck = await canCreateMarker(data.latitude, data.longitude);
            if (!zoneCheck.allowed) {
                setMapMessage(`🚫 ${zoneCheck.reason}`);
                setTimeout(() => setMapMessage(null), 5000);
                throw new Error(zoneCheck.reason || 'Создание метки в этой зоне запрещено');
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
            return newMarker;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            setMapMessage(`Ошибка при добавлении метки: ${errorMessage}`);
            setTimeout(() => setMapMessage(null), 5000);
            throw error instanceof Error ? error : new Error(errorMessage);
        }
    };

    const handleAddEvent = async (data: EventCreationPayload & { latitude: number; longitude: number }) => {
        try {
            const created = await createEvent({
                title: data.title,
                description: data.description || undefined,
                start_date: data.startDate,
                end_date: data.endDate || undefined,
                location: data.location || undefined,
                category: data.category,
                latitude: data.latitude,
                longitude: data.longitude,
                is_public: true,
            });

            addOpenEvent({
                id: Number(created.id) || Date.now(),
                title: created.title,
                description: created.description || '',
                date: data.startDate,
                endDate: data.endDate || undefined,
                categoryId: data.category,
                hashtags: Array.isArray((created as any).hashtags) ? (created as any).hashtags : [],
                location: data.location,
                latitude: data.latitude,
                longitude: data.longitude,
            });

            setMapMessage('Событие отправлено на модерацию');
            setTimeout(() => setMapMessage(null), 3000);
            return created;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            setMapMessage(`Ошибка при добавлении события: ${errorMessage}`);
            setTimeout(() => setMapMessage(null), 5000);
            throw error instanceof Error ? error : new Error(errorMessage);
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

    const getLiveLatLng = useCallback((lat: number, lng: number) => {
        const Leaflet = (window as any).L;
        if (Leaflet?.latLng) {
            return Leaflet.latLng(lat, lng);
        }
        return { lat, lng };
    }, []);

    const getLiveContainerPoint = useCallback((lat: number, lng: number) => {
        if (!mapRef.current || typeof mapRef.current.latLngToContainerPoint !== 'function') {
            return { x: 0, y: 0 };
        }

        return latLngToContainerPoint(mapRef.current, getLiveLatLng(lat, lng));
    }, [getLiveLatLng]);

    const createLiveMarker = useCallback((lat: number, lng: number, opts?: any) => {
        const map = mapRef.current;
        const Leaflet = (window as any).L;

        if (map && Leaflet?.marker) {
            return Leaflet.marker([lat, lng], opts || {}).addTo(map);
        }

        return mapFacade().createMarker([lat, lng], opts);
    }, []);

    // --- MAP READY CHECK ---
    const isMapReadyCheck = isMapReady || mapRef.current || ((mapFacade() as any)?.INTERNAL?.api?.map);

    // --- SELECTED MARKER POPUP ---
    const selectedMarkerPopup = useMemo(() => {
        if (!isMapInteractive) return null;
        if (!selectedMarkerIdForPopup) return null;
        const marker = markersData.find(m => m.id === selectedMarkerIdForPopup);
        if (!marker) return null;

        const markerPosition = getLiveContainerPoint(Number(marker.latitude), Number(marker.longitude));

        return (
            <div
                key={`popup-${selectedMarkerIdForPopup}`}
                ref={(el) => {
                    if (el) {
                        mapFacade().disableClickPropagation(el);
                        mapFacade().disableScrollPropagation(el);
                    }
                }}
                style={{
                    position: 'absolute',
                    left: markerPosition.x,
                    top: markerPosition.y,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 10000,
                    pointerEvents: 'auto',
                }}
                className="popup-card-fixed"
            >
                <MarkerPopup
                    marker={marker}
                    onClose={() => setSelectedMarkerIdForPopup(null)}
                    onHashtagClick={onHashtagClickFromPopup}
                    onMarkerUpdate={() => { }}
                    onAddToFavorites={onAddToFavorites}
                    onRemoveFromFavorites={onRemoveFromFavorites}
                    setSelectedMarkerIds={setSelectedMarkerIds}
                    isFavorite={isFavorite(marker)}
                    isSelected={Boolean(isFavorite(marker) && Array.isArray(selectedMarkerIds) && selectedMarkerIds.includes(marker.id))}
                />
            </div>
        );
    }, [selectedMarkerIdForPopup, markersData, selectedMarkerIds, mapMoveVersion, getLiveContainerPoint]);

    // --- EVENT MINI POPUP ---
    const eventPopup = isMapInteractive && eventMiniPopup && eventMiniPopup.position && (
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
                    setEventStagePopup({
                        event: eventMiniPopup.event,
                        position: eventMiniPopup.position,
                    });
                }}
                isSelected={selectedEvent?.id === eventMiniPopup.event.id}
                showGoButton={true}
            />
        </div>
    );

    const eventStagePopupElement = isMapInteractive && eventStagePopup && eventStagePopup.position && (
        <div
            style={{
                position: 'absolute',
                left: eventStagePopup.position.x,
                top: eventStagePopup.position.y,
                transform: 'translate(-50%, -100%)',
                marginTop: '-12px',
                zIndex: 10000,
                pointerEvents: 'auto'
            }}
        >
            <EventStagePopup
                event={eventStagePopup.event}
                onClose={() => setEventStagePopup(null)}
                onOpenDetails={() => {
                    setEventStagePopup(null);
                    setSelectedEvent(eventStagePopup.event);
                }}
            />
        </div>
    );

    // --- MAIN MINI POPUP ---
    const miniPopupElement = isMapInteractive && miniPopup && (
        <div
            style={{
                position: 'absolute',
                left: miniPopup.position.x,
                top: miniPopup.position.y,
                zIndex: 9999,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'auto',
            }}
            ref={(el) => {
                // Останавливаем перехват кликов Leaflet'ом на этом div'е
                if (el) {
                    mapFacade().disableClickPropagation(el);
                    mapFacade().disableScrollPropagation(el);
                }
            }}
            onMouseLeave={() => {
                setTimeout(() => { setMiniPopup(prev => prev === miniPopup ? null : prev); }, 150);
            }}
        >
            <MiniMarkerPopup
                marker={miniPopup.marker}
                onOpenFull={() => {
                    const markerId = miniPopup?.marker?.id;
                    setMiniPopup(null);
                    if (markerId) setSelectedMarkerIdForPopup(markerId);
                }}
                isSelected={false}
            />
        </div>
    );

    // --- SELECTED MARKERS MINI POPUPS ---
    // mapMoveVersion обеспечивает пересчёт позиций при движении/зуме карты
    const selectedMarkerPopups = useMemo(() => !isMapInteractive ? null : selectedMarkerIds?.map((markerId: string) => {
        const marker = markersData.find(m => m.id === markerId) || markers?.find(m => m.id === markerId);
        if (!marker) return null;

        if (selectedMarkerIdForPopup === markerId || (miniPopup && miniPopup.marker.id === markerId)) {
            return null;
        }

        const pos = getLiveContainerPoint(Number(marker.latitude), Number(marker.longitude));

        return (
            <div
                key={`selected-${markerId}`}
                style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
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
    }), [selectedMarkerIds, markersData, markers, selectedMarkerIdForPopup, miniPopup, mapMoveVersion, getLiveContainerPoint]);

    // --- JSX RENDER ---
    const mapContent = (
        <MapContainer>
            {isLoading && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 2000, transform: 'translate(-50%, -50%)' }}>
                    <CircularProgressBar value={progress} size={90} />
                </div>
            )}
            <GlobalLeafletPopupStyles />
            <GlobalMarkerStyles />

            <MapWrapper
                id="map"
                className="leaflet-map-wrapper"
                ref={mapContainerRef}
                style={{
                    ...mapStyle,
                    width: '100%',
                    height: '100%',
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
                {coordsForNewMarker && (
                    <MarkerCreationPanel
                        coords={coordsForNewMarker}
                        discoveredPlace={discoveredPlace}
                        isMobile={isMobile}
                        isTwoPanelMode={isTwoPanelMode}
                        onSubmit={async (data: MarkerCreationPayload) => {
                            const markerDataWithCoords = {
                                ...data,
                                latitude: coordsForNewMarker![0],
                                longitude: coordsForNewMarker![1]
                            };
                            await handleAddMarker(markerDataWithCoords);
                            clearTempMarker();
                            setCoordsForNewMarker(null);
                            setDiscoveredPlace(null);
                            setMapMessage(null);
                        }}
                        onCancel={() => {
                            clearTempMarker();
                            setCoordsForNewMarker(null);
                            setDiscoveredPlace(null);
                            setMapMessage(null);
                            // Оставляем режим «добавления метки» активным, чтобы можно было сразу кликнуть ещё раз.
                            setIsAddingMarkerMode(true);
                        }}
                    />
                )}

                {coordsForNewEvent && (
                    <EventCreationPanel
                        coords={coordsForNewEvent}
                        discoveredPlace={discoveredEventPlace}
                        isMobile={isMobile}
                        isTwoPanelMode={isTwoPanelMode}
                        onSubmit={async (data: EventCreationPayload) => {
                            await handleAddEvent({
                                ...data,
                                latitude: coordsForNewEvent[0],
                                longitude: coordsForNewEvent[1],
                            });
                            clearTempMarker();
                            setCoordsForNewEvent(null);
                            setDiscoveredEventPlace(null);
                            setMapMessage(null);
                        }}
                        onCancel={() => {
                            clearTempMarker();
                            setCoordsForNewEvent(null);
                            setDiscoveredEventPlace(null);
                            setMapMessage(null);
                            onAddingEventModeChange?.(true);
                        }}
                    />
                )}

                {eventPopup}
                {eventStagePopupElement}
                {mapMessage && <MapMessage>{mapMessage}</MapMessage>}

                {/* Фиолетовый баннер режима выбора места события */}
                {isPickingEventLocation && (
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: '0.95em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                        pointerEvents: 'auto',
                        whiteSpace: 'nowrap',
                    }}>
                        <span style={{ animation: 'pickBannerPulse 2s ease-in-out infinite', display: 'inline-block' }}>📍</span>
                        Кликните по карте для выбора места
                        <button
                            onClick={() => useEventsStore.getState().stopPickingLocation()}
                            style={{ marginLeft: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85em' }}
                        >
                            Отмена
                        </button>
                        <style>{`@keyframes pickBannerPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } } @keyframes pickMarkerPulse { 0%,100% { box-shadow: 0 0 20px 6px rgba(124,58,237,0.5); } 50% { box-shadow: 0 0 30px 10px rgba(124,58,237,0.8); } }`}</style>
                    </div>
                )}

                {/* Баннер режима добавления события */}
                {externalIsAddingEventMode && (
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: '0.95em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
                        pointerEvents: 'auto',
                        whiteSpace: 'nowrap',
                    }}>
                        <span>📅</span>
                        Кликните по карте для выбора места события
                        <button
                            onClick={() => onAddingEventModeChange?.(false)}
                            style={{ marginLeft: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85em' }}
                        >
                            Отмена
                        </button>
                    </div>
                )}

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
                                    // Unwrap если mapRef не настоящий Leaflet
                                    if (mapRef.current && typeof mapRef.current.on !== 'function') {
                                        const inner = mapRef.current.map || mapRef.current.mapInstance;
                                        if (inner && typeof inner.on === 'function') mapRef.current = inner;
                                    }
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

            {selectedMarkerPopup}
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
























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































