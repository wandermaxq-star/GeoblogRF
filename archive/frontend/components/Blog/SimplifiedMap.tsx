import { projectManager } from '../../services/projectManager';
import { mapFacade } from '../../services/map_facade/index';
import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { MapPin } from 'lucide-react';
import { useFavorites } from '../../contexts/FavoritesContext';
import { MarkerData } from '../../types/marker';
import MarkerPopup from '../Map/MarkerPopup';
import { createRoot } from 'react-dom/client';
interface SimplifiedMapProps {
  markerId?: string;
  className?: string;
}

const MapContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
`;

const MapWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-radius: 8px;
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ffebee;
  color: #c62828;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  z-index: 1000;
`;

const SimplifiedMap: React.FC<SimplifiedMapProps> = ({ 
  markerId, 
  className 
}) => {
  // NOTE: mapRef is only the DOM container for ephemeral maps. Use `mapFacade()` for map API interactions.
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allMarkers, setAllMarkers] = useState<MarkerData[]>([]);
  const { favoritePlaces } = useFavorites() || { favoritePlaces: [] };

  // Загружаем все маркеры с API
  useEffect(() => {
    const loadMarkers = async () => {
      try {
        const markers = await projectManager.getMarkers();
        setAllMarkers(markers);
      } catch (error) {
        // Используем тестовые данные как fallback
        const testMarkers: MarkerData[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            title: 'Золотые ворота',
            description: 'Исторический памятник Владимира',
            latitude: 56.1286,
            longitude: 40.4066,
            category: 'monument',
            rating: 4.8,
            rating_count: 12,
            photo_urls: [],
            hashtags: ['владимир', 'история'],
            is_verified: false,
            creator_id: 'test-user',
            author_name: 'Тестовый автор',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            likes_count: 0,
            comments_count: 0,
            shares_count: 0,
            visibility: 'public',
            marker_type: 'standard' as const,
            is_active: true,
            metadata: {},
            views_count: 0,
            used_in_blogs: false,
            is_user_modified: false,
            address: 'Владимир, ул. Большая Московская, 1',
            subcategory: 'архитектура'
          }
        ];
        setAllMarkers(testMarkers);
      }
    };
    loadMarkers();
  }, []);

  // Находим выбранную метку сначала в API маркерах, потом в избранном
  
  const selectedApiMarker = allMarkers.find((m: MarkerData) => m.id === markerId);
  const selectedPlace = favoritePlaces.find((m: any) => m.id === markerId);
  
  // Преобразуем найденную метку в MarkerData для совместимости
  const selectedMarker = selectedApiMarker || (selectedPlace ? {
    id: selectedPlace.id,
    latitude: selectedPlace.coordinates[0],
    longitude: selectedPlace.coordinates[1],
    title: selectedPlace.name,
    description: selectedPlace.location,
    address: selectedPlace.location,
    category: selectedPlace.type,
    subcategory: '',
    rating: selectedPlace.rating,
    rating_count: 0,
    photo_urls: [],
    hashtags: [],
    is_verified: false,
    creator_id: '',
    author_name: 'Пользователь',
    created_at: selectedPlace.addedAt.toISOString(),
    updated_at: selectedPlace.addedAt.toISOString(),
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    visibility: 'public',
    marker_type: 'standard' as const,
    is_active: true,
    metadata: {},
    views_count: 0,
    used_in_blogs: false,
    is_user_modified: false
  } : null) || (markerId ? {
    // Fallback: создаем тестовый маркер для Владимира, если маркер не найден
    id: markerId,
    latitude: 56.1286,
    longitude: 40.4066,
    title: 'Золотые ворота (тестовый)',
    description: 'Исторический памятник Владимира',
    address: 'Владимир, ул. Большая Московская, 1',
    category: 'monument',
    subcategory: 'архитектура',
    rating: 4.8,
    rating_count: 12,
    photo_urls: [],
    hashtags: ['владимир', 'история'],
    is_verified: false,
    creator_id: 'test-user',
    author_name: 'Тестовый автор',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    visibility: 'public',
    marker_type: 'standard' as const,
    is_active: true,
    metadata: {},
    views_count: 0,
    used_in_blogs: false,
    is_user_modified: false
  } : null);

  useEffect(() => {
    if (!mapRef.current || !selectedMarker) {
      if (!selectedMarker) {
        setError(`Метка не найдена (ID: ${markerId})`);
        setIsLoading(false);
      }
      return;
    }
    const init = async () => {
      try {
        setIsLoading(true);

        // Prepare a small center/zoom
        const center: [number, number] = [selectedMarker.latitude, selectedMarker.longitude];
        const cfg = {
          provider: 'leaflet' as const,
          center,
          zoom: 14,
          markers: [] as any
        };

        // Инициализация фасада
        await projectManager.initializeMap(mapRef.current!, cfg);

        // Create popup DOM and render MarkerPopup into it
        const popupContent = document.createElement('div');
        const popupRoot = createRoot(popupContent);
        popupRoot.render(
          <MarkerPopup
            marker={selectedMarker}
            onClose={() => {}}
            onMarkerUpdate={() => {}}
            onAddToFavorites={() => {}}
            isFavorite={false}
          />
        );

        // Add marker via facade using createMarker and bind popup (avoids direct map API usage)
        try {
          const icon = mapFacade().createDivIcon({ className: 'simplified-marker-icon', html: '<div class="simplified-marker" />', iconSize: [34, 44], iconAnchor: [17, 44] });
          const marker = mapFacade().createMarker([selectedMarker.latitude, selectedMarker.longitude], { icon });
          try { marker.bindPopup?.(popupContent); } catch (e) { }
        } catch (e) { }

        // Center the view via facade
        try { mapFacade().setView([selectedMarker.latitude, selectedMarker.longitude], 15); } catch {}

        setIsLoading(false);
      } catch (err) {
        setError('Не удалось загрузить карту');
        setIsLoading(false);
      }
    };

    const timer = setTimeout(init, 100);

    return () => {
      clearTimeout(timer);
      // clear map instance via facade (forceful destroy for this ephemeral map)
      try { mapFacade().clear({ force: true }); } catch {}
      markersRef.current = [];
    };
  }, [selectedMarker, markerId, allMarkers]);

  if (!selectedMarker) {
    return (
      <MapContainer className={className}>
        <ErrorMessage>
          <MapPin size={48} color="#c62828" />
          <p>Метка не найдена</p>
        </ErrorMessage>
      </MapContainer>
    );
  }

  return (
    <MapContainer className={className}>
      <MapWrapper ref={mapRef} />
      {isLoading && (
        <LoadingOverlay>
          <div>
            <MapPin size={48} color="#1976d2" />
            <p>Загрузка карты...</p>
          </div>
        </LoadingOverlay>
      )}
      {error && (
        <ErrorMessage>
          <p>{error}</p>
        </ErrorMessage>
      )}
    </MapContainer>
  );
};

export default SimplifiedMap;
