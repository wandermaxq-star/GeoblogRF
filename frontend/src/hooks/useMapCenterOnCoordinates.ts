import { useEffect } from 'react';
import { projectManager } from '../services/projectManager';
import { mapFacade } from '../services/map_facade';
import { isWithinRussiaBounds } from '../utils/russiaBounds';

export interface UseMapCenterOnCoordinatesOptions {
  isMapReady: boolean;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  isTwoPanelMode?: boolean;
  animate?: boolean;
  duration?: number;
}

/**
 * Хук для центрирования карты на указанных координатах.
 * Автоматически обрабатывает двухоконный режим и fallback для разных провайдеров.
 */
export const useMapCenterOnCoordinates = ({
  isMapReady,
  latitude,
  longitude,
  zoom = 13,
  isTwoPanelMode = false,
  animate = true,
  duration = 1.2,
}: UseMapCenterOnCoordinatesOptions) => {
  useEffect(() => {
    if (!isMapReady || latitude == null || longitude == null) return;

    if (isNaN(latitude) || isNaN(longitude)) return;

    if (!isWithinRussiaBounds(latitude, longitude)) return;

    const timer = setTimeout(() => {
      try {
        const mapApi = projectManager.getMapApi();
        const map = mapApi.map || mapApi.mapInstance;

        if (map) {
          const mapSize = map.getSize();
          if (isTwoPanelMode && mapSize.x > 0) {
            // Центрируем в левой части при двухоконном режиме
            const projected = map.project([latitude, longitude], zoom);
            const targetScreenX = mapSize.x * 0.25;
            const dx = targetScreenX - mapSize.x / 2;
            const offsetPoint = mapFacade().point(projected.x - dx, projected.y);
            const offsetCenter = map.unproject(offsetPoint, zoom);
            map.flyTo(offsetCenter, zoom, { animate, duration });
          } else {
            // Стандартное центрирование
            map.flyTo([latitude, longitude], zoom, { animate, duration });
          }
        } else {
          // Fallback для других провайдеров
          const provider = mapApi.providers?.[mapApi.currentProvider];
          if (provider && typeof provider.setCenter === 'function') {
            provider.setCenter([latitude, longitude], zoom);
          } else {
            mapApi.setCenter([latitude, longitude]);
          }
        }
      } catch (err) {
        console.warn('[useMapCenterOnCoordinates] Failed to center map:', err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isMapReady, latitude, longitude, zoom, isTwoPanelMode, animate, duration]);
};
