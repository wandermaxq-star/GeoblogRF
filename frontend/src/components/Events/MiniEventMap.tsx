import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../../utils/leafletInit';
import L from 'leaflet';
import { OSMMapRenderer } from '../../services/map_facade/adapters/OSMMapRenderer';

interface MiniEventMapProps {
  height?: string;
  center?: [number, number];
  zoom?: number;
  markerPosition?: [number, number] | null;
  onMarkerPositionChange?: (position: [number, number]) => void;
  onMapClick?: (position: [number, number]) => void;
  className?: string;
}

const MiniEventMap: React.FC<MiniEventMapProps> = ({
  height = '250px',
  center = [55.7558, 37.6176], // Москва по умолчанию
  zoom = 10,
  markerPosition,
  onMarkerPositionChange,
  onMapClick,
  className = '',
}) => {
  // NOTE: mapRef is a DOM container for the small map — prefer facade API for map operations when possible.
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);
  const rendererRef = useRef<OSMMapRenderer | null>(null);

  // Refs for callback props so we don't re-init the map when handlers change
  const onMarkerPositionChangeRef = useRef(onMarkerPositionChange);
  const onMapClickRef = useRef(onMapClick);
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);

  useEffect(() => { onMarkerPositionChangeRef.current = onMarkerPositionChange; }, [onMarkerPositionChange]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let destroyed = false;

    const renderer = new OSMMapRenderer();
    rendererRef.current = renderer;

    const containerEl = mapRef.current;
    const containerId = containerEl.id || (containerEl.id = 'mini-event-map-' + Math.random().toString(36).slice(2, 9));

    const init = async () => {
      try {
        await renderer.init(containerId, { center, zoom });
        const map = renderer.getMap();
        mapInstanceRef.current = map;

        // Обработчик клика на карту через renderer
        const clickHandler = (e: any) => {
          try {
            const position: [number, number] = [e.latlng.lat, e.latlng.lng];

            // Обновляем позицию маркера
            if (markerRef.current) {
              try { markerRef.current.setLatLng(e.latlng); } catch (err) { }
            } else {
              // Создаем новый маркер локально
              const marker = L.marker(e.latlng, { draggable: true });
              if (map) {
                marker.addTo(map);
              } else {
                console.warn('[MiniEventMap] map is not available to add marker to yet');
              }

              marker.on('dragend', () => {
                try {
                  const pos = marker.getLatLng();
                  const newPosition: [number, number] = [pos.lat, pos.lng];
                  onMarkerPositionChangeRef.current?.(newPosition);
                } catch (err) { }
              });

              markerRef.current = marker;
            }

            onMarkerPositionChangeRef.current?.(position);
            onMapClickRef.current?.(position);
          } catch (err) { }
        };

        // Подписываемся на клики. Если рендерер не поддерживает onMapClick, используем L handler.
        try {
          if (typeof renderer.onMapClick === 'function') {
            renderer.onMapClick(clickHandler);
          } else if (map) {
            map.on('click', clickHandler);
          }
        } catch (e) {
          try { map?.on('click', clickHandler); } catch (_) { }
        }
        clickHandlerRef.current = clickHandler;
      } catch (err) {
        console.warn('[MiniEventMap] Failed to initialize renderer', err);
      }
    };

    init();

    return () => {
      destroyed = true;
      try {
        const clickHandler = clickHandlerRef.current;
        const map = mapInstanceRef.current;
        if (map && clickHandler) {
          try { map.off('click', clickHandler); } catch (e) { }
        }

        if (rendererRef.current) {
          try { rendererRef.current.destroy(); } catch (e) { }
          rendererRef.current = null;
        }

        mapInstanceRef.current = null;
        markerRef.current = null;
      } catch (e) { }
    };
  }, []);

  // Обновление позиции маркера при изменении пропса
  useEffect(() => {
    if (!mapInstanceRef.current || !markerPosition) return;

    const [lat, lng] = markerPosition;
    const latlng = L.latLng(lat, lng);

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      const marker = L.marker(latlng, { draggable: true });
      if (mapInstanceRef.current) {
        marker.addTo(mapInstanceRef.current);
      } else {
        console.warn('[MiniEventMap] mapInstance is not available to add marker to yet');
      }

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const newPosition: [number, number] = [pos.lat, pos.lng];
        onMarkerPositionChangeRef.current?.(newPosition);
      });

      markerRef.current = marker;
    }

    // Центрируем карту на маркере через рендерер
    const targetZoom = rendererRef.current?.getZoom?.() ?? mapInstanceRef.current?.getZoom?.() ?? 13;
    const safeZoom = Math.max(targetZoom, 13);
    try {
      rendererRef.current?.setView([lat, lng], safeZoom);
    } catch (e) {
      try { mapInstanceRef.current?.setView(latlng, safeZoom); } catch (err) { /* ignore */ }
    }
  }, [markerPosition, onMarkerPositionChange]);

  // Обновление центра карты
  useEffect(() => {
    try { rendererRef.current?.setView(center, zoom); } catch (e) { try { mapInstanceRef.current?.setView(center, zoom); } catch (err) { } }
  }, [center, zoom]);

  return (
    <div 
      className={`mini-event-map ${className}`}
      style={{ 
        width: '100%', 
        height,
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
      ref={mapRef}
    />
  );
};

export default MiniEventMap;

