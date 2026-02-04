import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Navigation, Clock, MapPin, Map } from 'lucide-react';
import LazyYandexMap from '../YandexMap/LazyYandexMap';
import { useFavorites } from '../../contexts/FavoritesContext';
import { FavoriteRoute } from '../../contexts/FavoritesContext';
import { routeService } from '../../services/routeService';
import { Route as RouteData } from '../../types/route';

interface SimplifiedPlannerProps {
  routeId?: string;
  className?: string;
  segments?: Array<{
    id: string;
    coordinates: number[][];
    highlight: string;
    title: string;
    description?: string;
  }>;
}

const PlannerContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
`;

const PlannerFrame = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
  display: flex;
  flex-direction: column;
  color: #2e7d32;
  padding: 16px;
`;

const RouteHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
`;

const RouteIcon = styled.div`
  width: 48px;
  height: 48px;
  background: #2e7d32;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
`;

const RouteInfo = styled.div`
  flex: 1;
`;

const RouteTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #2e7d32;
`;

const RouteDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
`;

const RouteStats = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #2e7d32;
`;

const StatIcon = styled.div`
  margin-right: 6px;
  display: flex;
  align-items: center;
`;

const RoutePoints = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 12px;
  overflow-y: auto;
`;

const PointsTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2e7d32;
  display: flex;
  align-items: center;
`;

const PointItem = styled.div<{ isStart?: boolean; isEnd?: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px;
  margin-bottom: 8px;
  background: ${props => 
    props.isStart ? '#c8e6c9' : 
    props.isEnd ? '#ffcdd2' : 
    'rgba(255, 255, 255, 0.9)'
  };
  border-radius: 6px;
  border-left: 4px solid ${props => 
    props.isStart ? '#4caf50' : 
    props.isEnd ? '#f44336' : 
    '#2196f3'
  };
`;

const PointIcon = styled.div<{ isStart?: boolean; isEnd?: boolean }>`
  width: 32px;
  height: 32px;
  background: ${props => 
    props.isStart ? '#4caf50' : 
    props.isEnd ? '#f44336' : 
    '#2196f3'
  };
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
`;

const PointInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PointName = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
`;

const PointCoords = styled.div`
  font-size: 12px;
  color: #666;
`;

const SimplifiedPlanner: React.FC<SimplifiedPlannerProps> = ({ 
  routeId, 
  className,
  segments = []
}) => {
  const { favoriteRoutes } = useFavorites() || { favoriteRoutes: [] };
  const [selectedRoute, setSelectedRoute] = useState<FavoriteRoute | null>(null);
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([56.1286, 40.4064]); // Широта, долгота для YandexMap
  const [mapZoom, setMapZoom] = useState(15);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [markers, setMarkers] = useState<Array<{
    id: string;
    coordinates: [number, number];
    title: string;
    description?: string;
  }>>([]);
  const [mockPoints, setMockPoints] = useState<Array<{
    latitude: number;
    longitude: number;
    name: string;
  }>>([]);

  // Функция для расчета расстояния между двумя точками в км
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Функция для ограничения карты 5 км от точек маршрута
  const calculateMapBounds = (points: Array<{latitude: number, longitude: number}>) => {
    if (points.length === 0) return null;

    // Находим центр всех точек
    const centerLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
    const centerLon = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;

    // Находим максимальное расстояние от центра до любой точки
    let maxDistance = 0;
    points.forEach(point => {
      const distance = calculateDistance(centerLat, centerLon, point.latitude, point.longitude);
      maxDistance = Math.max(maxDistance, distance);
    });

    // Ограничиваем максимальное расстояние 5 км
    const limitedDistance = Math.min(maxDistance, 5);
    
    // Конвертируем расстояние в градусы (приблизительно)
    const latDegree = limitedDistance / 111; // 1 градус широты ≈ 111 км
    const lonDegree = limitedDistance / (111 * Math.cos(centerLat * Math.PI / 180));

    return {
      center: [centerLat, centerLon] as [number, number], // Широта, долгота для YandexMap
      bounds: [
        [centerLat - latDegree, centerLon - lonDegree], // Широта, долгота
        [centerLat + latDegree, centerLon + lonDegree]  // Широта, долгота
      ] as [[number, number], [number, number]],
      zoom: Math.max(10, Math.min(18, 15 - Math.log2(limitedDistance)))
    };
  };

  // Загружаем все маршруты с API
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const routes = await routeService.getAllRoutes();
        setAllRoutes(routes);
      } catch (error) {
        console.log('🗺️ SimplifiedPlanner: Ошибка загрузки маршрутов с API:', error);
        console.log('🗺️ SimplifiedPlanner: Используем тестовые данные как fallback');
        // Используем тестовые данные как fallback
        const testRoutes: RouteData[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Исторический центр Владимира',
            description: 'Пешеходный маршрут по историческому центру Владимира',
            points: [
              { id: 'point-1', title: 'Золотые ворота', latitude: 56.1286, longitude: 40.4066 },
              { id: 'point-2', title: 'Успенский собор', latitude: 56.1290, longitude: 40.4070 },
              { id: 'point-3', title: 'Дмитриевский собор', latitude: 56.1300, longitude: 40.4100 },
              { id: 'point-4', title: 'Водонапорная башня', latitude: 56.1310, longitude: 40.4120 },
              { id: 'point-5', title: 'Парк Липки', latitude: 56.1320, longitude: 40.4140 }
            ],
            waypoints: [
              { marker_id: '550e8400-e29b-41d4-a716-446655440002', order_index: 0, notes: 'Золотые ворота' },
              { marker_id: '550e8400-e29b-41d4-a716-446655440003', order_index: 1, notes: 'Успенский собор' }
            ],
            totalDistance: 1.2,
            estimatedDuration: 30,
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            difficulty: 'easy',
            tags: ['владимир', 'история'],
            is_user_modified: false,
            used_in_blogs: false
          }
        ];
        setAllRoutes(testRoutes);
      }
    };
    loadRoutes();
  }, []);

  // Обрабатываем сегменты, если они переданы
  useEffect(() => {
    if (segments.length > 0) {
      // Создаем виртуальный маршрут из сегментов
      const virtualRoute: FavoriteRoute = {
        id: 'segments-route',
        title: 'Маршрут по отрезкам',
        distance: segments.reduce((total, seg) => total + seg.coordinates.length, 0) * 0.1, // Примерное расстояние
        duration: segments.length * 15, // Примерное время
        rating: 4.5,
        addedAt: new Date(),
        likes: 0,
        isOriginal: true,
        // Новые обязательные поля
        categories: {
          personal: true,
          post: false,
          blog: false,
          event: false
        },
        category: 'personal',
        purpose: 'personal',
        tags: [],
        visibility: 'private',
        usageCount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSelectedRoute(virtualRoute);

      // Объединяем все координаты из сегментов
      const allPoints = segments.flatMap(segment => 
        segment.coordinates.map((coord, index) => ({
          latitude: coord[0],
          longitude: coord[1],
          name: `${segment.title} - точка ${index + 1}`
        }))
      );

      setMockPoints(allPoints);

      // Рассчитываем границы карты с ограничением 5 км
      const mapBounds = calculateMapBounds(allPoints);
      if (mapBounds) {
        setMapCenter(mapBounds.center);
        setMapZoom(mapBounds.zoom);
      }

        // Создаем маркеры для всех точек сегментов
        // ВАЖНО: YandexMap ожидает [широта, долгота] для всех элементов
        const segmentMarkers = segments.flatMap((segment, segmentIndex) =>
          segment.coordinates.map((coord, pointIndex) => ({
            id: `${segment.id}-point-${pointIndex}`,
            coordinates: [coord[0], coord[1]] as [number, number], // Широта, долгота
            title: `${segment.title} - точка ${pointIndex + 1}`,
            description: segment.description || `Координаты: ${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}`
          }))
        );

      setMarkers(segmentMarkers);

        // Создаем линии для каждого сегмента
        // Создаем линии сегментов
        // ВАЖНО: YandexMap ожидает [широта, долгота] для линий
        const segmentLines = segments.map(segment => 
          segment.coordinates.map(coord => [coord[0], coord[1]] as [number, number]) // Широта, долгота для YandexMap
        );

        // Пока используем первую линию сегмента для отображения
        if (segmentLines.length > 0) {
          setRouteLine(segmentLines[0]);
        }

      return;
    }
  }, [segments]);

  // Находим выбранный маршрут
  useEffect(() => {
    if (routeId && segments.length === 0) {
      // Сначала ищем в API маршрутах
      const apiRoute = allRoutes.find((r: RouteData) => r.id === routeId);
      if (apiRoute) {
        // Преобразуем RouteData в FavoriteRoute
        const favoriteRoute: FavoriteRoute = {
          id: apiRoute.id,
          title: apiRoute.title,
          distance: apiRoute.totalDistance || 0,
          duration: apiRoute.estimatedDuration || 0,
          rating: 4.5,
          addedAt: new Date(apiRoute.createdAt || new Date()),
          likes: 0,
          isOriginal: true,
          // Новые обязательные поля
          categories: {
            personal: true,
            post: false,
            blog: false,
            event: false
          },
          category: 'personal',
          purpose: 'personal',
          tags: [],
          visibility: 'private',
          usageCount: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setSelectedRoute(favoriteRoute);
        
        // Используем реальные данные маршрута из points
        const points = apiRoute.points?.map((point: any) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          name: point.title || `Точка ${point.id}`
        })) || [
          { latitude: 56.1286, longitude: 40.4064, name: 'Начальная точка' },
          { latitude: 56.1292, longitude: 40.4081, name: 'Промежуточная точка' },
          { latitude: 56.1300, longitude: 40.4100, name: 'Конечная точка' }
        ];
        setMockPoints(points);
        
        // Рассчитываем границы карты с ограничением 5 км
        const mapBounds = calculateMapBounds(points);
        if (mapBounds) {
          setMapCenter(mapBounds.center);
          setMapZoom(mapBounds.zoom);
        }
        
        // Создаем маркеры для точек маршрута
        // ВАЖНО: YandexMap ожидает [широта, долгота] для всех элементов
        const routeMarkers = points.map((point: any, index: number) => ({
          id: `${apiRoute.id}-point-${index}`,
          coordinates: [point.latitude, point.longitude] as [number, number], // Широта, долгота
          title: point.name || `Точка ${index + 1}`,
          description: `Координаты: ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`
        }));
        
        setMarkers(routeMarkers);
        
        // Создаем линию маршрута
        // ВАЖНО: YandexMap ожидает [широта, долгота]
        const line = points.map((p: any) => [p.latitude, p.longitude] as [number, number]); // Широта, долгота для YandexMap
        setRouteLine(line);
        return;
      }
      
      // Если не найден в API, ищем в избранном
      if (favoriteRoutes.length > 0) {
      const route = favoriteRoutes.find((r: FavoriteRoute) => r.id === routeId);
      if (route) {
        setSelectedRoute(route);
        
        // Для FavoriteRoute используем моковые данные, так как у него нет points
        // В реальном приложении нужно будет получать полные данные маршрута по ID
        // Тестовые точки с большим расстоянием для проверки ограничения 5 км
        const points = [
          { latitude: 56.1286, longitude: 40.4064, name: 'Золотые ворота' },
          { latitude: 56.1292, longitude: 40.4081, name: 'Успенский собор' },
          { latitude: 56.1300, longitude: 40.4100, name: 'Дмитриевский собор' },
          { latitude: 56.1310, longitude: 40.4120, name: 'Водонапорная башня' },
          { latitude: 56.1320, longitude: 40.4140, name: 'Парк Липки' }
        ];
        setMockPoints(points);
        
        // Рассчитываем границы карты с ограничением 5 км
        const mapBounds = calculateMapBounds(points);
        if (mapBounds) {
          setMapCenter(mapBounds.center);
          setMapZoom(mapBounds.zoom);
        }
        
        // Создаем маркеры для точек маршрута
        // ВАЖНО: YandexMap ожидает [широта, долгота] для всех элементов
        const routeMarkers = points.map((point: any, index: number) => ({
          id: `${route.id}-point-${index}`,
          coordinates: [point.latitude, point.longitude] as [number, number], // Широта, долгота
          title: point.name || `Точка ${index + 1}`,
          description: `Координаты: ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`
        }));
        
        setMarkers(routeMarkers);
        
        // Создаем линию маршрута
        // ВАЖНО: YandexMap ожидает [широта, долгота]
        const line = points.map((p: any) => [p.latitude, p.longitude] as [number, number]); // Широта, долгота для YandexMap
        setRouteLine(line);
      }
      }
    }
  }, [routeId, allRoutes, favoriteRoutes, segments]);

  if (!selectedRoute) {
    return (
      <PlannerContainer className={className}>
        <PlannerFrame>
          <RouteHeader>
            <RouteIcon>
              <Navigation size={24} color="white" />
            </RouteIcon>
            <RouteInfo>
              <RouteTitle>Маршрут не найден</RouteTitle>
              <RouteDescription>Выберите маршрут для просмотра</RouteDescription>
            </RouteInfo>
          </RouteHeader>
        </PlannerFrame>
      </PlannerContainer>
    );
  }

  return (
    <PlannerContainer className={className}>
      <PlannerFrame>
        {/* Информация о маршруте */}
        <RouteHeader>
          <RouteIcon>
            <Navigation size={24} color="white" />
          </RouteIcon>
          <RouteInfo>
            <RouteTitle>{selectedRoute.title}</RouteTitle>
            <RouteDescription>Маршрут</RouteDescription>
          </RouteInfo>
        </RouteHeader>

        {/* Статистика маршрута */}
        <RouteStats>
          <StatItem>
            <StatIcon>
              <MapPin size={16} />
            </StatIcon>
            {selectedRoute.distance} км
          </StatItem>
          <StatItem>
            <StatIcon>
              <Clock size={16} />
            </StatIcon>
            {selectedRoute.duration} мин
          </StatItem>
        </RouteStats>

        {/* Карта с маршрутом */}
        <div style={{ flex: 1, minHeight: 0, marginBottom: '16px' }}>
          <LazyYandexMap
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            routeLine={routeLine}
            onMapReady={() => {}}
            autoFitBounds={true}
          />
        </div>

        {/* Точки маршрута */}
        <RoutePoints>
          <PointsTitle>
            <Map size={16} style={{ marginRight: '8px' }} />
            {segments.length > 0 ? 'Отрезки маршрута' : 'Точки маршрута'}
          </PointsTitle>
          {segments.length > 0 ? (
            // Отображаем сегменты
            segments.map((segment, segmentIndex) => (
              <div key={segment.id} style={{ marginBottom: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '8px',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${segment.highlight}`
                }}>
                  <div 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: segment.highlight,
                      marginRight: '8px'
                    }} 
                  />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
                      {segment.title}
                    </div>
                    {segment.description && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {segment.description}
                      </div>
                    )}
                  </div>
                </div>
                {segment.coordinates.map((coord, pointIndex) => (
                  <PointItem 
                    key={`${segment.id}-${pointIndex}`}
                    isStart={pointIndex === 0}
                    isEnd={pointIndex === segment.coordinates.length - 1}
                  >
                    <PointIcon 
                      isStart={pointIndex === 0}
                      isEnd={pointIndex === segment.coordinates.length - 1}
                    >
                      {pointIndex === 0 ? (
                        <MapPin size={16} color="white" />
                      ) : pointIndex === segment.coordinates.length - 1 ? (
                        <Navigation size={16} color="white" />
                      ) : (
                        <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }} />
                      )}
                    </PointIcon>
                    <PointInfo>
                      <PointName>
                        Точка {pointIndex + 1}
                      </PointName>
                      <PointCoords>
                        {coord[0].toFixed(4)}, {coord[1].toFixed(4)}
                      </PointCoords>
                    </PointInfo>
                  </PointItem>
                ))}
              </div>
            ))
          ) : (
            // Отображаем обычные точки маршрута
            mockPoints.map((point, index) => (
            <PointItem 
              key={index}
              isStart={index === 0}
              isEnd={index === mockPoints.length - 1}
            >
              <PointIcon 
                isStart={index === 0}
                isEnd={index === mockPoints.length - 1}
              >
                {index === 0 ? (
                  <MapPin size={16} color="white" />
                ) : index === mockPoints.length - 1 ? (
                  <Navigation size={16} color="white" />
                ) : (
                  <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }} />
                )}
              </PointIcon>
              <PointInfo>
                <PointName>
                  {point.name || `Точка ${index + 1}`}
                </PointName>
                <PointCoords>
                  {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                </PointCoords>
              </PointInfo>
            </PointItem>
            ))
          )}
        </RoutePoints>
      </PlannerFrame>
    </PlannerContainer>
  );
};

export default SimplifiedPlanner;
