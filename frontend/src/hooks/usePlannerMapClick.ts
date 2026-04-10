import { useEffect, useRef } from 'react';
import { projectManager } from '../services/projectManager';
import { mapFacade } from '../services/map_facade';

type ClickCoords = 
  | [number, number] 
  | { get: (key: string) => [number, number]; lngLat?: [number, number]; coordinates?: [number, number]; latLng?: { lat: number; lng: number } };

export interface UsePlannerMapClickOptions {
  isMapReady: boolean;
  onMapClick: (lat: number, lon: number) => void;
}

export const usePlannerMapClick = ({ isMapReady, onMapClick }: UsePlannerMapClickOptions) => {
  const clickRegisteredRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!isMapReady || clickRegisteredRef.current) return;

    const handleClickEvent = (coords: ClickCoords) => {
      try {
        if (!coords) return;
        let lat: number | undefined;
        let lon: number | undefined;

        if (Array.isArray(coords)) {
          [lat, lon] = coords;
        } else if (coords && typeof coords === 'object') {
          if (Array.isArray(coords.get?.('coords'))) {
            const c = coords.get('coords');
            lat = c[0];
            lon = c[1];
          } else if (coords.lngLat) {
            [lon, lat] = coords.lngLat;
          } else if (coords.coordinates) {
            [lat, lon] = coords.coordinates;
          } else if (coords.latLng) {
            lat = coords.latLng.lat;
            lon = coords.latLng.lng;
          }
        }

        if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
          onMapClickRef.current(lat, lon);
        }
      } catch {
        // ignore
      }
    };

    const registerClick = () => {
      try {
        const mapApi = projectManager.getMapApi?.();
        if (mapApi && typeof (mapApi as any).onClick === 'function') {
          (mapApi as any).onClick((coords: [number, number]) => handleClickEvent(coords));
          clickRegisteredRef.current = true;
          return;
        }
      } catch {
        // ignore
      }

      try {
        const mapApi = projectManager.getMapApi?.();
        if (mapApi && typeof mapApi.on === 'function' && typeof mapApi.off === 'function') {
          mapApi.on('click', (event: any) => handleClickEvent(event));
          clickRegisteredRef.current = true;
          return;
        }
      } catch {
        // ignore
      }

      try {
        const mapApi = projectManager.getMapApi?.();
        if (mapApi && typeof mapApi.onMapClick === 'function') {
          mapApi.onMapClick((event: any) => handleClickEvent(event));
          clickRegisteredRef.current = true;
          return;
        }
      } catch {
        // ignore
      }

      try {
        const facade = mapFacade();
        if (facade && typeof facade.onClick === 'function') {
          facade.onClick((coords: [number, number]) => handleClickEvent(coords));
          clickRegisteredRef.current = true;
          return;
        }
      } catch {
        // ignore
      }

      try {
        const mapApi = projectManager.getMapApi?.();
        const rawMap = (mapApi as any)?.map || (mapApi as any)?.mapInstance;
        if (rawMap && rawMap.events && typeof rawMap.events.add === 'function') {
          rawMap.events.add('click', (event: any) => {
            handleClickEvent(event);
          });
          clickRegisteredRef.current = true;
          return;
        }
      } catch {
        // ignore
      }
    };

    registerClick();
  }, [isMapReady]);
};
