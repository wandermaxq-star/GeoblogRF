import React, { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { mapFacade } from '../../services/map_facade';
import MarkerPopup from './MarkerPopup';
import { MarkerData } from '../../types/marker';
import { latLngToContainerPoint, markerCategoryStyles } from './mapUtils';
import { getDistanceFromLatLonInKm } from '../../utils/russiaBounds';

interface UseMapMarkersOptions {
  mapRef: React.MutableRefObject<any | null>;
  markerClusterGroupRef: React.MutableRefObject<any | null>;
  tileLayerRef: React.MutableRefObject<any | null>;
  markersData: MarkerData[];
  isDarkMode: boolean;
  filters: { radiusOn: boolean; radius: number };
  searchRadiusCenter: [number, number];
  mapSettings: { themeColor: string; showHints: boolean };
  openEvents: any[];
  selectedEvent: any | null;
  leftContent: any;
  rightContent: any;
  isMapReady: boolean;
  setMiniPopup: (v: any) => void;
  setEventMiniPopup: (v: any) => void;
  setSelectedMarkerIdForPopup: (id: string | null) => void;
  setSelectedMarkerIds?: (ids: string[]) => void;
  isFavorite?: (m: MarkerData) => boolean;
  onHashtagClickFromPopup?: (tag: string) => void;
  onAddToFavorites?: (m: MarkerData) => void;
  onRemoveFromFavorites?: (id: string) => void;
  onAddToBlog?: (m: MarkerData) => void;
}

export function useMapMarkers(opts: UseMapMarkersOptions) {
  const { mapRef, markerClusterGroupRef, markersData, isDarkMode, filters, searchRadiusCenter, mapSettings, openEvents, selectedEvent, leftContent, rightContent, isMapReady, setMiniPopup, setEventMiniPopup } = opts as any;

  const activePopupRoots = useRef<Record<string, Root>>({});

  useEffect(() => {
    try {
      const map = mapFacade().getMap?.();
      if (!map) return;

      // Remove existing cluster group if any
      if (markerClusterGroupRef.current) {
        try { mapFacade().removeLayer(markerClusterGroupRef.current); } catch (e) { }
        markerClusterGroupRef.current = null;
      }

      if (!mapFacade().createMarkerClusterGroup) return;
      // ВОССТАНОВЛЕНО: настройки кластеризации
      const markerClusterGroup = mapFacade().createMarkerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        animate: true,
        iconCreateFunction: (cluster: any) => {
          return mapFacade().createDivIcon({
            className: 'marker-cluster-custom',
            html: '<span>' + cluster.getChildCount() + '</span>',
            iconSize: [40, 40]
          });
        }
      });

      // Create markers
      markersData.forEach((markerData: any) => {
        try {
          const lat = Number(markerData.latitude);
          const lng = Number(markerData.longitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const markerCategory = markerData.category || 'other';
          const markerCategoryStyle = markerCategoryStyles[markerCategory] || markerCategoryStyles.default;
          const isPending = markerData.status === 'pending';

          const [searchRadiusCenterLat, searchRadiusCenterLng] = searchRadiusCenter;
          const isInRadius = filters.radiusOn
            ? getDistanceFromLatLonInKm(searchRadiusCenterLat, searchRadiusCenterLng, Number(markerData.latitude), Number(markerData.longitude)) <= filters.radius
            : true;

          const iconColor = isPending ? '#ff9800' : (isInRadius ? mapSettings.themeColor : (markerCategoryStyle.color || '#666'));

          const icon = mapFacade().createDivIcon({
            className: 'event-marker ' + (isPending ? 'pending' : ''),
            html: '<div style="background-color: ' + iconColor + '; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; display:flex; align-items:center; justify-content:center;"><i class="fas fa-map-marker-alt" style="color:#fff"></i></div>',

            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });

          const leafletMarker = mapFacade().createMarker([lat, lng], { icon });
          (leafletMarker as any).markerData = markerData;

          if (mapSettings.showHints) {
            try { leafletMarker.bindTooltip(markerData.title || ''); } catch (e) { }
          }

          // Hover behavior: show mini-popup on mouseover, hide on mouseout
          leafletMarker.on?.('mouseover', (e: any) => {
            try {
              const pos = latLngToContainerPoint(mapFacade(), mapFacade().latLng(lat, lng));
              setMiniPopup({ marker: markerData, position: { x: pos.x, y: pos.y } });
            } catch (err) { }
          });

          leafletMarker.on?.('mouseout', () => {
            try { setMiniPopup(null); } catch (err) { }
          });

          // Mobile/tap support: show mini popup on click (but do NOT open full popup)
          leafletMarker.on?.('click', (e: any) => {
            try {
              const pos = latLngToContainerPoint(mapFacade(), mapFacade().latLng(lat, lng));
              setMiniPopup({ marker: markerData, position: { x: pos.x, y: pos.y } });
              e?.originalEvent?.stopPropagation?.();
            } catch (err) { }
          });

          leafletMarker.on?.('popupopen', (e: any) => {
            try {
              const popupEl = e?.popup?.getElement?.();
              if (!popupEl) return;
              const popupContentDiv = popupEl.querySelector('.leaflet-popup-content');
              if (!popupContentDiv) return;

              let root = activePopupRoots.current[String(markerData.id)];
              if (!root) {
                root = createRoot(popupContentDiv);
                activePopupRoots.current[String(markerData.id)] = root;
              }

              root.render(
                <MarkerPopup
                  key={markerData.id}
                  marker={markerData}
                  onClose={() => {
                    try { if (leafletMarker.getPopup()) leafletMarker.closePopup(); } catch (err) {}
                  }}
                  onHashtagClick={opts.onHashtagClickFromPopup}
                  onMarkerUpdate={() => {}}
                  onAddToFavorites={opts.onAddToFavorites || (() => {})}
                  onRemoveFromFavorites={opts.onRemoveFromFavorites}
                  setSelectedMarkerIds={opts.setSelectedMarkerIds}
                  onAddToBlog={opts.onAddToBlog}
                  isFavorite={opts.isFavorite ? opts.isFavorite(markerData) : false}
                  isSelected={false}
                />
              );
            } catch (err) { }
          });

          leafletMarker.on?.('popupclose', () => {
            try {
              const root = activePopupRoots.current[String(markerData.id)];
              if (root) {
                root.unmount();
                delete activePopupRoots.current[String(markerData.id)];
              }
            } catch (err) { }
          });

          markerClusterGroup.addLayer(leafletMarker);
        } catch (err) { }
      });

      // Event markers
      const isEventPanelMode = leftContent && rightContent;
      const shouldShowEventMarkers = isEventPanelMode && selectedEvent !== null;

      if (shouldShowEventMarkers) {
        openEvents.forEach((event: any) => {
          const lat = event.latitude;
          const lng = event.longitude;

          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const categoryColor = '#6b7280';
            const isSelected = selectedEvent?.id === event.id;
            const iconSize = isSelected ? 50 : 40;

            const eventIcon = mapFacade().createDivIcon({
              className: 'event-marker-icon ' + (isSelected ? 'event-marker-selected' : ''),
              html: '<div class="event-marker-base" style="width: ' + iconSize + 'px; height: ' + iconSize + 'px; background-color: ' + categoryColor + '; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); ' + (isSelected ? 'animation: eventMarkerPulse 2s ease-in-out infinite;' : '') + '"><i class="fas fa-calendar" style="color: #ffffff; font-size: ' + (iconSize * 0.4) + 'px;"></i></div>',
              iconSize: [iconSize, iconSize],
              iconAnchor: [iconSize / 2, iconSize],
              popupAnchor: [0, -iconSize],
            });

            const eventMarker = mapFacade().createMarker([lat, lng], { icon: eventIcon });
            (eventMarker as any).eventData = event;

            eventMarker.on?.('click', (e: any) => {
              e?.originalEvent?.stopPropagation?.();
            });

            eventMarker.on?.('mouseover', () => {
              setEventMiniPopup({ event, position: latLngToContainerPoint(mapFacade(), mapFacade().latLng(lat, lng)) });
            });

            markerClusterGroup.addLayer(eventMarker);
          }
        });
      }

      // Attach marker cluster group to map
      try {
        markerClusterGroup.addTo(map);
        markerClusterGroupRef.current = markerClusterGroup;
      } catch (e) {
        // Fallback: attempt to add later if map not ready
        setTimeout(() => {
          try { markerClusterGroup.addTo(map); markerClusterGroupRef.current = markerClusterGroup; } catch (err) { }
        }, 100);
      }

      return () => {
        try {
          Object.values(activePopupRoots.current).forEach(root => { try { root.unmount(); } catch (e) { } });
          activePopupRoots.current = {};
        } catch (e) { }

        try { if (markerClusterGroupRef.current) { try { mapFacade().removeLayer(markerClusterGroupRef.current); } catch (e) { } markerClusterGroupRef.current = null; } } catch (e) { }
      };

    } catch (err) {
      console.error('[useMapMarkers] markers render error', err);
      return undefined;
    }

  }, [markersData, isDarkMode, filters, searchRadiusCenter, mapSettings, openEvents, selectedEvent, leftContent, rightContent, isMapReady, opts.onHashtagClickFromPopup, opts.onAddToFavorites, opts.onRemoveFromFavorites, opts.onAddToBlog, opts.setSelectedMarkerIds, opts.isFavorite]);
}
