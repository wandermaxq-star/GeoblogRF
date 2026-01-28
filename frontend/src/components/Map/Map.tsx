// КРИТИЧНО: Инициализируем Leaflet в window ПЕРЕД импортом любых модулей,
// которые могут использовать window.L (mapFacade, projectManager, OSMMapRenderer)
import '../../utils/leafletInit';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import CircularProgressBar from '../ui/CircularProgressBar';
import * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';

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
import { useContentStore } from '../../stores/contentStore';
import { useMapDisplayMode } from '../../hooks/useMapDisplayMode';
import { FEATURES } from '../../config/features';
import { getDistanceFromLatLonInKm } from '../../utils/russiaBounds';
import { getMarkerIconPath, getCategoryColor, getFontAwesomeIconName } from '../../constants/markerCategories';
import { mapFacade } from '../../services/map_facade/index';
import type { MapConfig } from '../../services/map_facade/index';
import { useMapStateStore } from '../../stores/mapStateStore';
import { useEventsStore } from '../../stores/eventsStore';
import { MockEvent } from '../TravelCalendar/mockEvents';
import { getCategoryById } from '../TravelCalendar/TravelCalendar';
import { markerService } from '../../services/markerService';
import {
    getTileLayer,
    getAdditionalLayers,
    createLayerIndicator,
    markerCategoryStyles
} from './mapUtils';

const MapMessage = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
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
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const activePopupRoots = useRef<Record<string, Root>>({});
    const tempMarkerRef = useRef<L.Marker | null>(null);
    const markerClusterGroupRef = useRef<any | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const isAddingMarkerModeRef = useRef(false);
    const initRetryRef = useRef<number>(0);

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
    const leftContent = useContentStore((state) => state.leftContent);
    const rightContent = useContentStore((state) => state.rightContent);
    const isTwoPanelMode = rightContent !== null;
    const openEvents = useEventsStore((state) => state.openEvents);
    const selectedEvent = useEventsStore((state) => state.selectedEvent);
    const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent);

    // --- STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [coordsForNewMarker, setCoordsForNewMarker] = useState<[number, number] | null>(null);
    const [tempMarker, setTempMarker] = useState<L.Marker | null>(null);
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
        if (portalEl) {
            if (leftContent !== 'map' && leftContent !== null) {
                portalEl.style.display = 'none';
                portalEl.style.visibility = 'hidden';
                portalEl.style.pointerEvents = 'none';
            } else {
                portalEl.style.display = 'block';
                portalEl.style.visibility = 'visible';
                portalEl.style.pointerEvents = 'auto';
            }
        }
    }, [leftContent, portalEl]);

    // --- FACADE MAP TOP OFFSET ---
    const mapDisplayMode = useMapDisplayMode();

    // Динамическое управление видимостью и классом контейнера карты
    useEffect(() => {
        const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null;
        const facadeMapRoot = document.querySelector('.facade-map-root') as HTMLElement | null;
        
        if (mapContainer) {
            // Управляем видимостью на основе режима отображения
            if (mapDisplayMode.shouldShowFullscreen) {
                mapContainer.style.display = 'block';
                mapContainer.style.visibility = 'visible';
                mapContainer.style.pointerEvents = 'auto';
            } else {
                // Скрываем карту когда открыты только Posts + Activity
                mapContainer.style.display = 'none';
                mapContainer.style.visibility = 'hidden';
                mapContainer.style.pointerEvents = 'none';
            }
        }
        
        // Обновляем CSS переменную для правильного позиционирования
        const headerEl = document.querySelector('.page-header') || document.querySelector('header');
        const headerHeight = headerEl ? (headerEl as HTMLElement).offsetHeight : 0;
        document.documentElement.style.setProperty('--facade-map-top', `${headerHeight}px`);
        
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
            setTimeout(() => {
                try {
                    mapRef.current?.invalidateSize();
                } catch (e) {}
            }, 100);
        }
    }, [mapDisplayMode.shouldShowFullscreen, mapDisplayMode.isTwoPanelMode, mapDisplayMode.isOnlyPostsAndActivity]);

    useEffect(() => {
        const setFacadeMapTop = () => {
            try {
                const headerEl = document.querySelector('.page-header') || document.querySelector('header');
                const h = headerEl ? (headerEl as HTMLElement).offsetHeight : 0;
                
                // Используем значение из хука режима отображения карты
                const topValue = mapDisplayMode.shouldShowFullscreen ? `${h}px` : `${h}px`;
                document.documentElement.style.setProperty('--facade-map-top', topValue);
                
                if (mapRef.current) {
                    setTimeout(() => {
                        try {
                            mapRef.current?.invalidateSize();
                        } catch (e) { }
                    }, 120);
                }
            } catch (e) { }
        };

        setFacadeMapTop();
        window.addEventListener('resize', setFacadeMapTop);
        return () => window.removeEventListener('resize', setFacadeMapTop);
    }, [mapDisplayMode.shouldShowFullscreen]);

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

        if (!isContainerVisible) {
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
                    const registeredApi = (mapFacade as any).getRegisteredApi ? (mapFacade as any).getRegisteredApi() : (mapFacade as any).INTERNAL?.api;
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

                const facadeApi = (mapFacade as any)?.INTERNAL?.api || initResult || {};
                if (facadeApi && (facadeApi as any).map) {
                    mapRef.current = (facadeApi as any).map as L.Map;
                } else if (facadeApi && (facadeApi as any).mapInstance) {
                    mapRef.current = (facadeApi as any).mapInstance as L.Map;
                } else if (initResult && (initResult as any).map) {
                    mapRef.current = (initResult as any).map as L.Map;
                } else if ((window as any).L) {
                    try {
                        const maybeMap = (window as any).L.map(mapContainer, { center, zoom });
                        (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(maybeMap);
                        mapRef.current = maybeMap;
                        try {
                            (mapFacade as any).INTERNAL = (mapFacade as any).INTERNAL || {};
                            (mapFacade as any).INTERNAL.api = (mapFacade as any).INTERNAL.api || {};
                            (mapFacade as any).INTERNAL.api.map = maybeMap;
                        } catch (e) { }
                    } catch (err) { }
                }

                if (!mapRef.current) {
                    throw new Error('Фасад не вернул карту после инициализации.');
                }

                const map = mapRef.current;

                if (mapRef.current && typeof (mapRef.current as any).addLayer !== 'function') {
                    const possibleInner = (facadeApi as any)?.map || (facadeApi as any)?.mapInstance || (initResult && (initResult as any).map);
                    if (possibleInner && typeof possibleInner.addLayer === 'function') {
                        mapRef.current = possibleInner as L.Map;
                    }
                }

                const tileLayerInfo = getTileLayer(mapSettings.mapType);
                let hasTileLayer = false;
                map.eachLayer((layer: any) => {
                    if (layer instanceof L.TileLayer && layer._url === 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png') {
                        hasTileLayer = true;
                        tileLayerRef.current = layer;
                    }
                });

                if (!hasTileLayer) {
                    const tileLayer = L.tileLayer(tileLayerInfo.url, {
                        attribution: tileLayerInfo.attribution,
                        maxZoom: 19,
                        subdomains: 'abc',
                    }).addTo(map);
                    tileLayerRef.current = tileLayer;
                }

                const additionalLayers = getAdditionalLayers(mapSettings.showTraffic, mapSettings.showBikeLanes);
                additionalLayers.forEach(layer => layer.addTo(map));

                if (!map.zoomControl) {
                    L.control.zoom({ position: 'bottomright' }).addTo(map);
                }

                setTimeout(() => {
                    if (mapRef.current) {
                        try { mapRef.current.invalidateSize(); } catch (e) { }
                    }
                }, 100);

                mapRef.current!.eachLayer((layer: any) => {
                    if (layer && typeof layer.getLayers === 'function' && layer !== markerClusterGroupRef.current) {
                        try { mapRef.current!.removeLayer(layer); } catch (e) { }
                    }
                });

                mapRef.current!.on('moveend', () => {
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

                mapRef.current!.on('click', async (e: L.LeafletMouseEvent) => {
                    if (isAddingMarkerModeRef.current) {
                        if (tempMarkerRef.current) {
                            mapRef.current!.removeLayer(tempMarkerRef.current);
                        }

                        const clickedLatLng = e.latlng;
                        const zoom = mapRef.current!.getZoom();
                        const mapSize = mapRef.current!.getSize();
                        const targetScreenY = mapSize.y * 0.25;
                        const screenCenterY = mapSize.y / 2;
                        const offsetY = targetScreenY - screenCenterY;
                        const projectedClick = mapRef.current!.project(clickedLatLng, zoom);
                        const targetCenterPoint = L.point(projectedClick.x, projectedClick.y - offsetY);
                        const targetCenterLatLng = mapRef.current!.unproject(targetCenterPoint, zoom);
                        mapRef.current!.setView(targetCenterLatLng, zoom, { animate: true });

                        const tempIcon = L.divIcon({
                            className: 'temp-marker-icon',
                            html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 3000;"></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10],
                        });

                        const newTempMarker = L.marker(clickedLatLng, { icon: tempIcon }).addTo(mapRef.current!);
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
    }, [leftContent, center, zoom, mapSettings.mapType, onBoundsChange, onMapClick]);

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

        const newTileLayer = L.tileLayer(tileLayerInfo.url, {
            attribution: tileLayerInfo.attribution,
            maxZoom: 19,
            subdomains: 'abc',
        }).addTo(map);
        tileLayerRef.current = newTileLayer;
    }, [mapSettings.mapType]);

    // --- TRAFFIC & BIKE LANES ---
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        map.eachLayer((layer: any) => {
            if (layer instanceof L.TileLayer &&
                ((layer as any).getContainer?.()?.className?.includes('traffic-layer') ||
                    (layer as any).getContainer?.()?.className?.includes('bike-lanes-layer'))) {
                map.removeLayer(layer);
            }
        });

        document.querySelectorAll('.layer-indicator').forEach(indicator => indicator.remove());

        if (L) {
            const additionalLayers = getAdditionalLayers(mapSettings.showTraffic, mapSettings.showBikeLanes);
            additionalLayers.forEach((layer) => {
                layer.addTo(map);
                const layerType = (layer as any).getContainer?.()?.className?.includes('traffic-layer') ? 'traffic' : 'bike';
                const indicator = createLayerIndicator(layerType);
                map.getContainer().appendChild(indicator);
            });
        }
    }, [mapSettings.showTraffic, mapSettings.showBikeLanes]);

    // --- MARKERS RENDER ---
    useEffect(() => {
        if (!mapRef.current || !L) return;
        if (!markersData || markersData.length === 0) return;

        const { radiusOn, radius } = filters;
        const { themeColor, showHints } = mapSettings;
        const [searchRadiusCenterLat, searchRadiusCenterLng] = searchRadiusCenter;

        if (markerClusterGroupRef.current) {
            mapRef.current.removeLayer(markerClusterGroupRef.current);
            markerClusterGroupRef.current = null;
        }

        mapRef.current.eachLayer((layer: any) => {
            if (L && layer instanceof L.Marker && layer !== tempMarkerRef.current) {
                mapRef.current?.removeLayer(layer);
            }
        });

        if (!(L as any).markerClusterGroup) return;

        const markerClusterGroup = (L as any).markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            animate: true,
            iconCreateFunction: function (cluster: any) {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="marker-cluster"><span>${count}</span></div>`,
                    className: 'marker-cluster-custom',
                    iconSize: [40, 40]
                });
            }
        });

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

                const customIcon = new L.Icon({
                    iconUrl: markerIconUrl,
                    iconSize: [iconWidth, iconHeight],
                    iconAnchor: [iconWidth / 2, iconHeight],
                    popupAnchor: [0, -iconHeight],
                    className: `marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}${markerCategory === 'user_poi' ? ' marker-user-poi' : ''}${isPending ? ' marker-pending' : ''}`,
                });

                const leafletMarker = L.marker([lat, lng], { icon: customIcon });

                const img = new Image();
                img.onerror = () => {
                    const divIcon = L.divIcon({
                        className: `marker-icon marker-category-${markerCategory}${isHot ? ' marker-hot' : ''}`,
                        html: `<div class="marker-base" style="background-color: ${iconColor};"><i class="fas ${faIconName}"></i></div>`,
                        iconSize: [iconWidth, iconHeight],
                        iconAnchor: [iconWidth / 2, iconHeight],
                    });
                    leafletMarker.setIcon(divIcon);
                };
                img.src = markerIconUrl;
                (leafletMarker as any).markerData = markerData;

                const popupOptions = {
                    className: `custom-marker-popup ${isDarkMode ? 'dark' : 'light'}`,
                    autoPan: true,
                    autoPanPadding: [50, 50],
                    closeButton: false,
                    maxWidth: 441,
                    maxHeight: 312,
                    offset: L.point(0, -10),
                };

                leafletMarker.bindPopup('', popupOptions);

                leafletMarker.on('popupopen', (e: L.PopupEvent) => {
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
                            if (layer instanceof L.TileLayer) hasTileLayer = true;
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
                        position: latLngToContainerPoint(L.latLng(Number(markerData.latitude), Number(markerData.longitude)))
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

                markerClusterGroup.addLayer(leafletMarker);
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

                    const eventIcon = L.divIcon({
                        className: `event-marker-icon ${isSelected ? 'event-marker-selected' : ''}`,
                        html: `<div class="event-marker-base" style="width: ${iconSize}px; height: ${iconSize}px; background-color: ${categoryColor}; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); ${isSelected ? 'animation: eventMarkerPulse 2s ease-in-out infinite;' : ''}"><i class="fas ${categoryIcon}" style="color: #ffffff; font-size: ${iconSize * 0.4}px;"></i></div>`,
                        iconSize: [iconSize, iconSize],
                        iconAnchor: [iconSize / 2, iconSize],
                        popupAnchor: [0, -iconSize],
                    });

                    const eventMarker = L.marker([lat, lng], { icon: eventIcon });
                    (eventMarker as any).eventData = event;

                    eventMarker.on('click', (e: any) => {
                        e.originalEvent.stopPropagation();
                        setSelectedEvent(event);
                    });

                    eventMarker.on('mouseover', () => {
                        setEventMiniPopup({
                            event: event,
                            position: latLngToContainerPoint(L.latLng(lat, lng))
                        });
                    });

                    eventMarker.on('click', (e: any) => {
                        e.originalEvent.stopPropagation();
                        setEventMiniPopup(null);
                        setSelectedEvent(event);
                    });

                    markerClusterGroup.addLayer(eventMarker);
                }
            });
        }

        // Cluster styles
        const style = document.createElement('style');
        style.innerHTML = `
      .marker-cluster-custom { background: ${themeColor} !important; color: #fff !important; border: 2px solid #fff; border-radius: 50% !important; width: 40px !important; height: 40px !important; display: flex !important; align-items: center; justify-content: center; }
      .marker-cluster-custom span { color: #fff !important; font-size: 1.2em; }
      .leaflet-popup-content-wrapper, .leaflet-popup-content, .leaflet-popup-tip { border-radius: 8px !important; overflow: hidden !important; }
      .event-marker-base { transition: transform 0.2s ease; }
      .event-marker-selected .event-marker-base { transform: scale(1.1); }
      @keyframes eventMarkerPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    `;
        document.head.appendChild(style);

        let hasTileLayer = false;
        mapRef.current.eachLayer((layer: any) => {
            if (layer instanceof L.TileLayer) hasTileLayer = true;
        });

        if (!hasTileLayer) {
            setTimeout(() => {
                if (mapRef.current && !markerClusterGroupRef.current) {
                    markerClusterGroup.addTo(mapRef.current);
                    markerClusterGroupRef.current = markerClusterGroup;
                }
            }, 100);
        } else {
            markerClusterGroup.addTo(mapRef.current);
            markerClusterGroupRef.current = markerClusterGroup;
        }

        const highPriorityStyle = document.createElement('style');
        highPriorityStyle.setAttribute('data-high-priority', 'true');
        highPriorityStyle.innerHTML = `.leaflet-popup-content-wrapper, .leaflet-popup-content, .leaflet-popup-tip { border-radius: 8px !important; overflow: hidden !important; }`;
        document.head.appendChild(highPriorityStyle);

        return () => {
            if (style && document.head.contains(style)) document.head.removeChild(style);
            if (highPriorityStyle && document.head.contains(highPriorityStyle)) document.head.removeChild(highPriorityStyle);
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

        mapRef.current.eachLayer((layer: L.Layer) => {
            if ((layer as any).isRouteLayer) {
                mapRef.current?.removeLayer(layer);
            }
        });

        let routePolyline: L.Polyline | null = null;
        let allLatLngs: L.LatLng[] = [];

        const hasPolyline = routeData.polyline && Array.isArray(routeData.polyline) && routeData.polyline.length > 1;
        if (hasPolyline) {
            const validPolyline = routeData.polyline.filter(point =>
                Array.isArray(point) && point.length === 2 &&
                typeof point[0] === 'number' && typeof point[1] === 'number' &&
                !isNaN(point[0]) && !isNaN(point[1])
            );

            if (validPolyline.length >= 2) {
                routePolyline = L.polyline(validPolyline, {
                    color: '#ff3b3b',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '12, 12',
                    className: 'route-polyline'
                });
                if (routePolyline) {
                    (routePolyline as any).isRouteLayer = true;
                    routePolyline.addTo(mapRef.current);
                }
                allLatLngs = validPolyline.map(([lat, lng]) => L.latLng(lat, lng));
            }
        }

        if (!routePolyline && routeData.markers && Array.isArray(routeData.markers) && routeData.markers.length > 1) {
            const fallback = routeData.markers
                .map((m: any) => [Number(m.latitude), Number(m.longitude)] as [number, number])
                .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
            if (fallback.length > 1) {
                routePolyline = L.polyline(fallback, {
                    color: '#ff3b3b',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '12, 12',
                    className: 'route-polyline'
                });
                if (routePolyline) {
                    (routePolyline as any).isRouteLayer = true;
                    routePolyline.addTo(mapRef.current);
                }
                allLatLngs = fallback.map(([lat, lng]) => L.latLng(lat, lng));
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
                    const routeIcon = L.divIcon({
                        className: 'route-marker-icon',
                        html: `<div class="route-marker-base"><div class="route-marker-number">${index + 1}</div><div class="route-marker-icon-inner"><i class="fas fa-route"></i></div></div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    });
                    const routeMarker = L.marker([lat, lng], { icon: routeIcon });
                    (routeMarker as any).isRouteLayer = true;
                    routeMarker.addTo(mapRef.current!);
                }
            });
        }

        if (mapRef.current && allLatLngs.length > 0) {
            const bounds = L.latLngBounds(allLatLngs);
            mapRef.current.fitBounds(bounds, { padding: [60, 60] });
        }

        let zoomHandler: any;
        if (mapRef.current && routePolyline) {
            const updateStyle = () => {
                const z = mapRef.current!.getZoom();
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

        mapRef.current.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Polygon && (layer as any).isZoneLayer) {
                mapRef.current?.removeLayer(layer);
            }
        });

        zones.forEach(zone => {
            const color = (zone.severity === 'critical') ? '#EF4444' : (zone.severity === 'warning') ? '#F59E0B' : '#FB923C';

            zone.polygons.forEach(ring => {
                const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
                const polygon = L.polygon(latLngs, {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    weight: 2,
                });
                (polygon as any).isZoneLayer = true;
                polygon.addTo(mapRef.current!);
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
        let radiusCircle: L.Circle | null = null;

        if (filters.radiusOn) {
            radiusCircle = L.circle(searchRadiusCenter, {
                radius: filters.radius * 1000,
                color: mapSettings.themeColor,
                fillColor: mapSettings.themeColor,
                fillOpacity: 0.15,
                weight: 2,
                interactive: true,
            }).addTo(mapRef.current);

            if (radiusCircle) {
                radiusCircle.on('mousedown', function (_) {
                    mapRef.current!.dragging.disable();
                    const onMove = (ev: any) => {
                        if (radiusCircle) radiusCircle.setLatLng(ev.latlng);
                    };
                    const onUp = (ev: any) => {
                        onSearchRadiusCenterChange([ev.latlng.lat, ev.latlng.lng]);
                        mapRef.current!.off('mousemove', onMove);
                        mapRef.current!.off('mouseup', onUp);
                        mapRef.current!.dragging.enable();
                    };
                    mapRef.current!.on('mousemove', onMove);
                    mapRef.current!.on('mouseup', onUp);
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
    function latLngToContainerPoint(latlng: L.LatLng): { x: number; y: number } {
        if (!mapRef.current) return { x: 0, y: 0 };
        const point = mapRef.current.latLngToContainerPoint(latlng);
        return { x: point.x, y: point.y };
    }

    // --- MAP READY CHECK ---
    const isMapReadyCheck = isMapReady || mapRef.current || ((mapFacade() as any)?.INTERNAL?.api?.map);

    // --- SELECTED MARKER POPUP ---
    const selectedMarkerPopup = useMemo(() => {
        if (!selectedMarkerIdForPopup) return null;
        const marker = markersData.find(m => m.id === selectedMarkerIdForPopup);
        if (!marker) return null;

        const markerPosition = latLngToContainerPoint(L.latLng(Number(marker.latitude), Number(marker.longitude)));

        return (
            <div
                key={`popup-${selectedMarkerIdForPopup}`}
                style={{
                    position: 'absolute',
                    left: markerPosition.x,
                    top: markerPosition.y,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 1300,
                    width: '205px',
                    height: '285px',
                }}
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
                    left: latLngToContainerPoint(L.latLng(Number(marker.latitude), Number(marker.longitude))).x,
                    top: latLngToContainerPoint(L.latLng(Number(marker.latitude), Number(marker.longitude))).y,
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
                            <div style={{
                                padding: '8px 12px',
                                textAlign: 'center',
                                background: 'linear-gradient(135deg, rgba(232, 245, 232, 0.9), rgba(240, 248, 240, 0.9))',
                                backdropFilter: 'blur(10px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                                border: '1px solid rgba(195, 230, 195, 0.5)',
                                borderRadius: '12px',
                                color: '#2d5a2d',
                                fontSize: '11px',
                                lineHeight: '1.4',
                            }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        minWidth: '200px'
                    }}>
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
                    <button onClick={() => window.location.reload()}>
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
























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































