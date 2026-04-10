import { useEffect, useRef } from 'react';
import { projectManager } from '../services/projectManager';
import { mapFacade } from '../services/map_facade';

export type PlannerMapClickHandler = (coordinates: [number, number]) => void;

export interface UsePlannerMapEventsOptions {
  isMapReady: boolean;
  onMapClick: PlannerMapClickHandler;
}

export const usePlannerMapEvents = ({ isMapReady, onMapClick }: UsePlannerMapEventsOptions) => {
  const clickRegisteredRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!isMapReady || clickRegisteredRef.current) return;

    const registerMapClick = () => {
      try {
        const mapApi = projectManager.getMapApi?.();
        if (mapApi && typeof mapApi.onClick === 'function') {
          mapApi.onClick((coords: [number, number]) => onMapClickRef.current(coords));
          clickRegisteredRef.current = true;
          return;
        }
      } catch (error) {
        console.warn('[usePlannerMapEvents] mapApi.onClick failed:', error);
      }

      try {
        const facade = mapFacade();
        if (facade && typeof facade.onClick === 'function') {
          facade.onClick((coords: [number, number]) => onMapClickRef.current(coords));
          clickRegisteredRef.current = true;
          return;
        }
      } catch (error) {
        console.warn('[usePlannerMapEvents] facade.onClick failed:', error);
      }

      try {
        const mapApi = projectManager.getMapApi?.();
        const rawMap = mapApi?.map || mapApi?.mapInstance;
        if (rawMap && rawMap.events && typeof rawMap.events.add === 'function') {
          rawMap.events.add('click', (event: any) => {
            const coords = event.get('coords');
            if (Array.isArray(coords)) {
              onMapClickRef.current([coords[0], coords[1]]);
            }
          });
          clickRegisteredRef.current = true;
          return;
        }
      } catch (error) {
        console.warn('[usePlannerMapEvents] direct Yandex click registration failed:', error);
      }
    };

    registerMapClick();
  }, [isMapReady]);
};
