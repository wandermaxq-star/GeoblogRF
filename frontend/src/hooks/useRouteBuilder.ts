import { useState, useCallback, useMemo } from 'react';
import { RoutePoint, RouteState, RoutePointManager, PointSource } from '../types/routeBuilder';
import { getRoutePolyline } from '../services/routingService';

/**
 * Хук для управления единым состоянием построения маршрутов
 * Объединяет все источники точек в одном месте
 */
export const useRouteBuilder = () => {
  const [routeState, setRouteState] = useState<RouteState>({
    activePoints: [],
    routePolyline: [],
    isBuilding: false,
    lastBuiltKey: '',
    totalDistance: undefined,
    totalDuration: undefined
  });

  // Генерация уникального ID для точки
  const generatePointId = useCallback((source: PointSource, index?: number) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${source}-${timestamp}-${random}`;
  }, []);

  // Добавление точки в маршрут
  const addPoint = useCallback((point: Omit<RoutePoint, 'id' | 'order' | 'isActive'>) => {
    setRouteState(prev => {
      // Проверяем дублирование по sourceId (для меток из избранного)
      if (point.sourceId) {
        const existingPoint = prev.activePoints.find(p => p.sourceId === point.sourceId);
        if (existingPoint) {
          // console.log('🔧 Пропускаем дублирование метки с sourceId:', point.sourceId);
          return prev; // Не добавляем дубликат
        }
      }
      
      const newPoint: RoutePoint = {
        ...point,
        id: generatePointId(point.source),
        order: prev.activePoints.length,
        isActive: true
      };
      
      return {
        ...prev,
        activePoints: [...prev.activePoints, newPoint]
      };
    });
  }, [generatePointId]);

  // Добавление точки из поиска
  const addSearchPoint = useCallback((address: string, coordinates: [number, number]) => {
    addPoint({
      coordinates,
      title: address,
      address,
      source: 'search',
      description: 'Добавлено через поиск'
    });
  }, [addPoint]);

  // Добавление точки из избранного
  const addFavoritePoint = useCallback((favoriteId: string, title: string, coordinates: [number, number]) => {
    addPoint({
      coordinates,
      title,
      source: 'favorites',
      sourceId: favoriteId,
      description: 'Из избранного'
    });
  }, [addPoint]);

  const addEventPoint = useCallback((eventId: string, title: string, coordinates: [number, number]) => {
    addPoint({
      coordinates,
      title,
      source: 'event',
      sourceId: eventId,
      description: 'Событие из избранного'
    });
  }, [addPoint]);

  // Добавление точки кликом на карту
  const addClickPoint = useCallback((coordinates: [number, number], title?: string) => {
    setRouteState(prev => {
      const newPoint: RoutePoint = {
        coordinates,
        title: title || `Точка ${prev.activePoints.length + 1}`,
        source: 'click', // ВАЖНО: оставляем 'click', а не 'map-click' для совместимости
        description: 'Добавлено кликом на карту',
        id: generatePointId('click'),
        order: prev.activePoints.length,
        isActive: true
      };
      
      return {
        ...prev,
        activePoints: [...prev.activePoints, newPoint]
      };
    });
  }, [generatePointId]);

  // Добавление точки по координатам
  const addCoordinatePoint = useCallback((coordinates: [number, number], title: string) => {
    setRouteState(prev => {
      const newPoint: RoutePoint = {
        coordinates,
        title,
        source: 'coordinates',
        description: 'Добавлено по координатам',
        id: generatePointId('coordinates'),
        order: prev.activePoints.length,
        isActive: true
      };
      
      return {
        ...prev,
        activePoints: [...prev.activePoints, newPoint]
      };
    });
  }, [generatePointId]);

  // Удаление точки
  const removePoint = useCallback((pointId: string) => {
    setRouteState(prev => {
      const newActivePoints = prev.activePoints.filter(point => point.id !== pointId);
      
      // Если точек стало меньше 2, очищаем маршрут
      if (newActivePoints.length < 2) {
        return {
          ...prev,
          activePoints: newActivePoints,
          routePolyline: [],
          totalDistance: undefined,
          totalDuration: undefined,
          lastBuiltKey: ''
        };
      }
      
      return {
        ...prev,
        activePoints: newActivePoints
      };
    });
  }, []);

  // Удаление точки по источнику и исходному ID
  const removePointBySource = useCallback((source: PointSource, sourceId: string) => {
    setRouteState(prev => {
      const newActivePoints = prev.activePoints.filter(point => !(point.source === source && point.sourceId === sourceId));
      
      // Если точек стало меньше 2, очищаем маршрут
      if (newActivePoints.length < 2) {
        return {
          ...prev,
          activePoints: newActivePoints,
          routePolyline: [],
          totalDistance: undefined,
          totalDuration: undefined,
          lastBuiltKey: ''
        };
      }
      
      return {
        ...prev,
        activePoints: newActivePoints
      };
    });
  }, []);

  // Обновление точки
  const updatePoint = useCallback((pointId: string, updates: Partial<RoutePoint>) => {
    setRouteState(prev => ({
      ...prev,
      activePoints: prev.activePoints.map(point => 
        point.id === pointId ? { ...point, ...updates } : point
      )
    }));
  }, []);

  // Изменение порядка точек
  const reorderPoints = useCallback((newOrder: string[]) => {
    setRouteState(prev => {
      const reorderedPoints = newOrder
        .map(id => prev.activePoints.find(point => point.id === id))
        .filter(Boolean) as RoutePoint[];
      
      return {
        ...prev,
        activePoints: reorderedPoints.map((point, index) => ({
          ...point,
          order: index
        }))
      };
    });
  }, []);

  // Переключение активности точки
  const togglePoint = useCallback((pointId: string) => {
    setRouteState(prev => ({
      ...prev,
      activePoints: prev.activePoints.map(point => 
        point.id === pointId ? { ...point, isActive: !point.isActive } : point
      )
    }));
  }, []);

  // Построение маршрута
  const buildRoute = useCallback(async (options?: { profile?: string; preference?: 'fastest' | 'shortest' | 'recommended' }) => {
    const profileToUse = options?.profile || 'driving-car';
    const preferenceToUse = options?.preference || 'fastest';

    setRouteState(prev => {
      const activePoints = prev.activePoints.filter(point => point.isActive);
      
      if (activePoints.length < 2) {
        throw new Error('Недостаточно активных точек для построения маршрута');
      }

      // Сортируем точки по порядку
      const sortedPoints = activePoints.sort((a, b) => a.order - b.order);
      
      // ВАЖНО: point.coordinates хранятся в формате [lat, lng] (широта, долгота)
      // getRoutePolyline ожидает [lat, lng] (широта, долгота) - тот же формат!
      // НЕ конвертируем формат координат - используем как есть
      const orsPoints: [number, number][] = sortedPoints.map(point => [
        point.coordinates[0], // широта (первый элемент) → первым
        point.coordinates[1]  // долгота (второй элемент) → вторым
      ]);

      // Создаем ключ для текущего маршрута
      const routeKey = sortedPoints.map(p => p.id).sort().join('|');

      // Асинхронно получаем полилинию
      getRoutePolyline(orsPoints, profileToUse, preferenceToUse)
        .then(polyline => {
          setRouteState(currentState => ({
            ...currentState,
            routePolyline: polyline,
            lastBuiltKey: routeKey,
            isBuilding: false
          }));
        })
        .catch(error => {
          setRouteState(currentState => ({ 
            ...currentState, 
            isBuilding: false 
          }));
        });

      return { ...prev, isBuilding: true };
    });
  }, []);

  // Перестроение маршрута
  const rebuildRoute = useCallback(async (options?: { profile?: string; preference?: 'fastest' | 'shortest' | 'recommended' }) => {
    setRouteState(prev => ({ ...prev, lastBuiltKey: '' }));
    await buildRoute(options);
  }, [buildRoute]);

  // Очистка маршрута
  const clearRoute = useCallback(() => {
    setRouteState({
      activePoints: [],
      routePolyline: [],
      isBuilding: false,
      lastBuiltKey: '',
      totalDistance: undefined,
      totalDuration: undefined
    });
  }, []);

  // Получение активных точек
  const getActivePoints = useCallback(() => {
    return routeState.activePoints.filter(point => point.isActive);
  }, [routeState.activePoints]);

  // Получение статистики маршрута
  const getRouteStats = useCallback(() => {
    const activePoints = getActivePoints();
    return {
      distance: routeState.totalDistance || 0,
      duration: routeState.totalDuration || 0,
      pointsCount: activePoints.length
    };
  }, [getActivePoints, routeState.totalDistance, routeState.totalDuration]);

  // Проверка возможности построения маршрута
  const canBuildRoute = useCallback(() => {
    const activePoints = getActivePoints();
    return activePoints.length >= 2;
  }, [getActivePoints]);

  // Менеджер точек
  const pointManager: RoutePointManager = useMemo(() => ({
    addPoint,
    addSearchPoint,
    addFavoritePoint,
    addEventPoint,
    addClickPoint,
    addCoordinatePoint,
    removePoint,
    removePointBySource,
    updatePoint,
    reorderPoints,
    togglePoint,
    buildRoute,
    rebuildRoute,
    clearRoute,
    getActivePoints,
    getRouteStats,
    canBuildRoute
  }), [
    addPoint,
    addSearchPoint,
    addFavoritePoint,
    addEventPoint,
    addClickPoint,
    addCoordinatePoint,
    removePoint,
    removePointBySource,
    updatePoint,
    reorderPoints,
    togglePoint,
    buildRoute,
    rebuildRoute,
    clearRoute,
    getActivePoints,
    getRouteStats,
    canBuildRoute
  ]);

  return {
    routeState,
    pointManager,
    // Удобные геттеры
    activePoints: routeState.activePoints,
    routePolyline: routeState.routePolyline,
    isBuilding: routeState.isBuilding,
    canBuild: canBuildRoute(),
    stats: getRouteStats()
  };
};