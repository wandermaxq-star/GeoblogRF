import React, { useEffect, useRef, useState } from 'react';
import FilterTabs from '../../components/Mobile/FilterTabs';
import MobileMapSettings from '../../components/Mobile/MobileMapSettings';
import MobileFavoritesPanel from '../../components/Mobile/MobileFavoritesPanel';
import CoordinateInput from '../../components/Planner/CoordinateInput';
import { Navigation, Settings, Search, X, MapPin, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { mapFacade, MapMarker, Route } from '../../services/map_facade/index';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useRoutePlanner } from '../../contexts/RoutePlannerContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { geocodingService, Place } from '../../services/geocodingService';

const PlannerPage: React.FC = () => {
  const location = useLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const provider = 'yandex'; // Используем Yandex Maps для построения маршрутов по дорогам
  const [loading, setLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [activeRouteType, setActiveRouteType] = useState<string>('standard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [showCoordinateInput, setShowCoordinateInput] = useState(false);
  const [openRouteSection, setOpenRouteSection] = useState<string>('');
  
  // Сбрасываем открытые разделы при открытии меню маршрутов
  useEffect(() => {
    if (routesOpen) {
      setOpenRouteSection('');
    }
  }, [routesOpen]);
  
  // Обработчики для работы с точками маршрута
  const handleRemovePoint = (pointId: string) => {
    routePlanner?.removeRoutePoint(pointId);
  };
  
  const handleReorderPoints = (index: number, direction: 'up' | 'down') => {
    if (!routePlanner?.routePoints) return;
    const points = [...routePlanner.routePoints];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < points.length) {
      [points[index], points[targetIndex]] = [points[targetIndex], points[index]];
      routePlanner.setRoutePoints(points);
    }
  };
  
  const handleAddPointFromSearch = (address: string, coordinates: [number, number]) => {
    routePlanner?.addRoutePoint({
      id: `point-${Date.now()}`,
      latitude: coordinates[0],
      longitude: coordinates[1],
      title: address,
    });
    setShowSearchForm(false);
  };
  
  const handleAddPointFromCoordinates = (data: { latitude: number; longitude: number; title: string }) => {
    routePlanner?.addRoutePoint({
      id: `point-${Date.now()}`,
      latitude: data.latitude,
      longitude: data.longitude,
      title: data.title,
    });
    setShowCoordinateInput(false);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [addedFavoriteMarkers, setAddedFavoriteMarkers] = useState<Set<string>>(new Set());
  const favorites = useFavorites();
  const routePlanner = useRoutePlanner();
  const navigate = useNavigate();
  // Состояние для хранения геометрии маршрута (для сохранения в постах)
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);

  // Фильтры и настройки карты (как в десктопной версии)
  const [draftFilters, setDraftFilters] = useState({
    categories: [] as string[],
    radiusOn: false,
    radius: 10,
    preset: null as string | null,
  });
  const [draftMapSettings, setDraftMapSettings] = useState({
    mapType: 'light',
    showTraffic: false,
    showBikeLanes: false,
    showHints: true,
    themeColor: 'green',
  });
  // Настройки маршрута
  const [draftRouteSettings, setDraftRouteSettings] = useState<{
    transportType: 'driving-car' | 'foot-walking' | 'cycling-regular' | 'driving-hgv' | 'driving-bus' | 'cycling-road' | 'cycling-mountain' | 'cycling-electric' | 'public-transport' | 'motorcycle' | 'scooter';
    optimization: 'fastest' | 'shortest' | 'balanced';
    avoidHighways: boolean;
    avoidTolls: boolean;
    showAlternatives: boolean;
  }>({
    transportType: 'driving-car',
    optimization: 'fastest',
    avoidHighways: false,
    avoidTolls: false,
    showAlternatives: false,
  });

  // Применённые (applied) — то, что реально отображается на карте
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [appliedMapSettings, setAppliedMapSettings] = useState(draftMapSettings);

  // Обработчики для применения и сброса фильтров
  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setAppliedMapSettings(draftMapSettings);
  };

  const handleReset = () => {
    const defaultFilters = {
      categories: [],
      radiusOn: false,
      radius: 10,
      preset: null,
    };
    const defaultMapSettings = {
      mapType: 'light',
      showTraffic: false,
      showBikeLanes: false,
      showHints: true,
      themeColor: 'green',
    };
    setDraftFilters(defaultFilters);
    setDraftMapSettings(defaultMapSettings);
    setAppliedFilters(defaultFilters);
    setAppliedMapSettings(defaultMapSettings);
  };

  useEffect(() => {
    // Инициализация компонента
  }, [location.pathname]);

  const tabs = [
    { id: 'standard', label: 'Стандартная', icon: <Navigation className="w-4 h-4" /> },
    { id: 'fast', label: 'Быстрая', icon: <Navigation className="w-4 h-4" /> },
    { id: 'short', label: 'Короткая', icon: <Navigation className="w-4 h-4" /> },
  ];

  // Yandex Maps загружается автоматически через фасад

  // Инициализация карты
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let attempts = 0;
    const maxAttempts = 20;

    const initializeMap = async () => {
      // Ждем, пока контейнер будет готов
      while ((!mapContainerRef.current || 
              mapContainerRef.current.offsetWidth === 0 || 
              mapContainerRef.current.offsetHeight === 0) && 
              attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!mapContainerRef.current) return;

      try {
        setLoading(true);
        // Инициализируем карту через Yandex Maps для построения маршрутов
        await mapFacade().initialize(mapContainerRef.current, {
          provider: provider,
          center: [55.7558, 37.6173], // Москва по умолчанию [lat, lon]
          zoom: 10,
        });

        // Подписываемся на клики по карте для добавления точек маршрута
        mapFacade().onClick((coords: [number, number]) => {
          if (routePlanner?.addRoutePoint) {
            routePlanner.addRoutePoint({
              id: `point-${Date.now()}`,
              latitude: coords[0],
              longitude: coords[1],
              title: `Точка ${(routePlanner.routePoints?.length || 0) + 1}`,
            });
          }
        });

        setIsMapReady(true);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    initializeMap();

    return () => {
      // Очистка будет выполнена автоматически при размонтировании
    };
  }, [provider, routePlanner]);

  // Подписка на геометрию маршрута от Yandex Maps (после готовности карты)
  useEffect(() => {
    if (!isMapReady) return;
    try {
      mapFacade().onRouteGeometry?.((coords: Array<[number, number]>) => {
        if (coords && Array.isArray(coords) && coords.length > 1) {
          setRouteGeometry(coords);
        } else {
          setRouteGeometry([]);
        }
      });
    } catch (err) {
    }
  }, [isMapReady]);

  // Добавляем точки маршрута на карту
  useEffect(() => {
    if (!isMapReady || !routePlanner?.routePoints || routePlanner.routePoints.length === 0) return;

    const updateMarkers = async () => {
      try {
        // Очищаем все метки
        mapFacade().clear();

        // Добавляем метки для точек маршрута
        const markers: MapMarker[] = routePlanner.routePoints.map((point: any, index: number) => ({
          id: `point-${index}`,
          position: { lat: Number(point.latitude), lon: Number(point.longitude) },
          title: point.title || `Точка ${index + 1}`,
          category: 'route-point',
        }));

        for (const marker of markers) {
          try {
            mapFacade().addMarker(marker);
          } catch (error) {
          }
        }

        // Если есть 2+ точки, строим маршрут через Yandex Maps
        // Yandex Maps сам построит маршрут по дорогам и передаст геометрию через callback
        if (routePlanner.routePoints.length >= 2) {
          try {
            const routePoints = routePlanner.routePoints.map((p: any) => ({ lat: Number(p.latitude), lon: Number(p.longitude) }));
            
            // Передаём маршрут в фасад - Yandex Maps построит его по дорогам
            const route: Route = {
              id: 'current-route',
              points: routePoints,
              distance: 0,
              duration: 0,
            }; 
            await mapFacade().drawRoute(route);
            // Геометрия будет получена через callback onRouteGeometry
          } catch (error) {
          }
        } else {
          // Очищаем геометрию, если точек меньше 2
          setRouteGeometry([]);
        }
      } catch (error) {
      }
    };

    updateMarkers();
  }, [isMapReady, routePlanner?.routePoints]);

  // Обработчик открытия настроек из TopBar (через query параметр)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('settings') === 'true') {
      setSettingsOpen(true);
    }
    if (params.get('favorites') === 'true') {
      setFavoritesOpen(true);
    }
  }, [location.search]);

  // Подписка на параметр marker - отображение метки на карте
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const markerId = params.get('marker');
    
    if (markerId && isMapReady && favorites?.favoritePlaces) {
      const place = favorites.favoritePlaces.find(p => p.id === markerId);
      if (place && place.latitude !== undefined && place.longitude !== undefined) {
        // Проверяем, не добавлена ли уже метка (чтобы не дублировать)
        if (!addedFavoriteMarkers.has(place.id)) {
          try {
            // Добавляем метку на карту
            mapFacade().addMarker({
              id: place.id,
              position: { lat: Number(place.latitude), lon: Number(place.longitude) },
              title: place.name || 'Место',
              category: 'favorite',
            });
            // Сохраняем ID добавленной метки
            setAddedFavoriteMarkers(prev => new Set(prev).add(place.id));
          } catch (err: any) {
          }
        }
        
        // Всегда центрируем карту на метке с зумом
        try {
            mapFacade().setView([place.latitude!, place.longitude!], 15);
        } catch (err) {
          // Если setView не поддерживается, используем setCenter
          try {
            mapFacade().setCenter([place.latitude!, place.longitude!], 15);
          } catch (e) {
          }
        }
      }
    } else if (!markerId) {
      // Если параметр marker удалён из URL, очищаем список добавленных меток из избранного
      // (но не удаляем их с карты, так как они могут быть нужны)
      // setAddedFavoriteMarkers(new Set());
    }
  }, [location.search, isMapReady, favorites, addedFavoriteMarkers]);

  // Обработка параметра marker - отображение метки на карте
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const markerId = params.get('marker');
    
    if (markerId && isMapReady && favorites?.favoritePlaces) {
      const place = favorites.favoritePlaces.find(p => p.id === markerId);
      if (place && place.latitude !== undefined && place.longitude !== undefined) {
        // Проверяем, не добавлена ли уже метка (чтобы не дублировать)
        if (!addedFavoriteMarkers.has(place.id)) {
          try {
            // Добавляем метку на карту
            mapFacade().addMarker({
              id: place.id,
              position: { lat: Number(place.latitude), lon: Number(place.longitude) },
              title: place.name || 'Место',
              category: 'favorite',
            });
            // Сохраняем ID добавленной метки
            setAddedFavoriteMarkers(prev => new Set(prev).add(place.id));
          } catch (err: any) {
          }
        }
        
        // Всегда центрируем карту на метке с зумом
        try {
          mapFacade().setView([place.latitude!, place.longitude!], 15);
        } catch (err) {
          // Если setView не поддерживается, используем setCenter
          try {
            mapFacade().setCenter([place.latitude!, place.longitude!], 15);
          } catch (e) {
          }
        }
      }
    } else if (!markerId) {
      // Если параметр marker удалён из URL, очищаем список добавленных меток из избранного
      // (но не удаляем их с карты, так как они могут быть нужны)
      // setAddedFavoriteMarkers(new Set());
    }
  }, [location.search, isMapReady, favorites, addedFavoriteMarkers]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Блок настроек, поиска и создания маршрута по центру сверху (отступ 3мм от ActionButtons) */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2"
        style={{ top: 'calc(var(--action-buttons-height) + 3px)' }}
      >
        {/* Кнопка настроек - такая же как кнопки быстрого выбора */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="bg-gray-100 text-gray-800 border border-gray-200 shadow-lg hover:shadow-xl hover:bg-gray-200 transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative active:scale-95"
          title="Настройки карты"
        >
          <Settings className="w-5 h-5 text-gray-800" />
          <span className="text-[10px] font-medium leading-tight text-center text-gray-800">Настройки</span>
        </button>
        
        {/* Поисковая строка */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск мест или меток..."
            className="bg-white rounded-full pl-10 pr-4 py-2 shadow-lg border-2 border-gray-300 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Кнопка "Маршруты" - открывает меню маршрутов */}
        <button
          onClick={() => setRoutesOpen(true)}
          className="bg-gray-100 text-gray-800 border border-gray-200 shadow-lg hover:shadow-xl hover:bg-gray-200 transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative active:scale-95"
          title="Маршруты"
        >
          <Navigation className="w-5 h-5 text-gray-800" />
          <span className="text-[10px] font-medium leading-tight text-center text-gray-800">Маршрут</span>
        </button>
      </div>
      
      {/* Карта занимает весь экран */}
      <div className="absolute inset-0 w-full h-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка карты...</p>
            </div>
          </div>
        )}
        <div 
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
      
      {/* Настройки карты */}
      <MobileMapSettings
        isOpen={settingsOpen}
        mode="planner"
        onClose={() => {
          setSettingsOpen(false);
          const params = new URLSearchParams(location.search);
          params.delete('settings');
          window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
        }}
        filters={draftFilters}
        onFiltersChange={setDraftFilters}
        mapSettings={draftMapSettings}
        onMapSettingsChange={setDraftMapSettings}
        routeSettings={draftRouteSettings}
        onRouteSettingsChange={(settings) => {
          if (settings) {
            setDraftRouteSettings(settings);
          }
        }}
        onApply={handleApply}
        onReset={handleReset}
      />
      
      {/* Меню маршрутов */}
      {routesOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setRoutesOpen(false)}
          />
          
          {/* Меню маршрутов */}
          <div
            className={cn(
              "fixed left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-[20px] shadow-[0_4px_24px_0_rgba(0,0,0,0.10)] border-2 border-[#7c7b7b91]",
              "max-w-[340px] min-w-[280px] w-[calc(100vw-32px)] max-h-[calc(100vh-200px)]",
              "overflow-hidden flex flex-col transition-all duration-300"
            )}
            style={{ top: 'calc(var(--action-buttons-height) + 40px + 70px + 40px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 text-white text-[1.1em] font-bold py-4 rounded-t-[20px] text-center relative flex items-center justify-center border-b border-gray-700 shadow-inner">
              <h2 className="text-base font-bold text-white">Маршруты</h2>
              <button
                onClick={() => setRoutesOpen(false)}
                className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-none border-none text-white cursor-pointer p-1 w-6 h-6 rounded-full transition-all hover:bg-white/20 flex items-center justify-center text-lg font-bold leading-none"
                title="Закрыть"
              >
                ×
              </button>
            </div>
            
            {/* Content - управление точками маршрута */}
            <div className="flex-1 overflow-y-auto bg-white">
              {/* Точки маршрута */}
              <div className="px-7 pb-4.5 border-b border-gray-200">
                <div
                  className={cn(
                    "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                    openRouteSection === 'points' 
                      ? "bg-[#22c55e] text-white" 
                      : "bg-white text-gray-800 hover:bg-gray-100"
                  )}
                  onClick={() => setOpenRouteSection(openRouteSection === 'points' ? '' : 'points')}
                >
                  <MapPin className="mr-2" style={{ width: 16, height: 16, color: openRouteSection === 'points' ? 'white' : '#22c55e' }} />
                  Точки маршрута
                  <span className="ml-auto">{openRouteSection === 'points' ? '▲' : '▼'}</span>
                </div>
                {openRouteSection === 'points' && (
                  <div className="pt-2 pl-8">
                    {routePlanner?.routePoints && routePlanner.routePoints.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {routePlanner.routePoints.map((point, index) => (
                          <div
                            key={point.id}
                            className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 w-4">{index + 1}</span>
                                <span className="text-sm font-medium text-gray-800 truncate">{point.title}</span>
                              </div>
                              <div className="text-xs text-gray-500 ml-6">
                                {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => handleReorderPoints(index, 'up')}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                title="Вверх"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleReorderPoints(index, 'down')}
                                disabled={index === routePlanner.routePoints.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                title="Вниз"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRemovePoint(point.id)}
                                className="p-1 text-red-400 hover:text-red-600"
                                title="Удалить"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Нет точек маршрута. Добавьте точки для построения маршрута.
                      </div>
                    )}
                    
                    {/* Кнопки добавления точек */}
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => {
                          setOpenRouteSection('search');
                          setShowSearchForm(true);
                        }}
                        className="w-full px-3 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Search className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">🔍 Поиск адреса</div>
                          <div className="text-xs text-gray-500">Найти место по названию</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setShowCoordinateInput(true)}
                        className="w-full px-3 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">📍 Ввод координат</div>
                          <div className="text-xs text-gray-500">Добавить по точным координатам</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setFavoritesOpen(true);
                          setRoutesOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Star className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-800">⭐ Из избранного</div>
                          <div className="text-xs text-gray-500">Выбрать из сохраненных мест</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Поиск адресов */}
              {showSearchForm && (
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openRouteSection === 'search' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => {
                      setOpenRouteSection(openRouteSection === 'search' ? '' : 'search');
                      if (openRouteSection === 'search') setShowSearchForm(false);
                    }}
                  >
                    <Search className="mr-2" style={{ width: 16, height: 16, color: openRouteSection === 'search' ? 'white' : '#22c55e' }} />
                    Поиск адресов
                    <span className="ml-auto">{openRouteSection === 'search' ? '▲' : '▼'}</span>
                  </div>
                  {openRouteSection === 'search' && (
                    <div className="pt-2 pl-8">
                      <RouteSearchForm onAddPoint={handleAddPointFromSearch} onClose={() => setShowSearchForm(false)} />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer с кнопками действий */}
            <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 flex flex-col items-center gap-3 py-4 rounded-b-[20px] border-t border-gray-700 shadow-inner">
              <div className="flex gap-3 px-5 w-full justify-center">
                <button
                  onClick={() => {
                    routePlanner?.clearRoutePoints();
                  }}
                  className="flex-1 px-4.5 py-2 border-none rounded-md cursor-pointer font-bold text-[15px] bg-white text-black hover:bg-gray-100 transition-all"
                >
                  Очистить
                </button>
                <button
                  onClick={() => {
                    routePlanner?.startRouteBuilding();
                    setRoutesOpen(false);
                  }}
                  className="flex-1 px-4.5 py-2 border-none rounded-md cursor-pointer font-bold text-[15px] bg-white text-black hover:bg-gray-100 transition-all"
                >
                  Создать
                </button>
              </div>
              {routePlanner?.routePoints && routePlanner.routePoints.length > 0 && (
                <div className="text-xs text-white/80 text-center">
                  Точек: {routePlanner.routePoints.length} {routePlanner.routePoints.length >= 2 && '✓ Готов к построению'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Меню избранного */}
      <MobileFavoritesPanel 
        isOpen={favoritesOpen} 
        onClose={() => {
          setFavoritesOpen(false);
          const params = new URLSearchParams(location.search);
          params.delete('favorites');
          window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
        }} 
      />
      
      {/* Модальное окно для ввода координат */}
      {showCoordinateInput && (
        <CoordinateInput
          onAdd={(data) => {
            handleAddPointFromCoordinates(data);
            setShowCoordinateInput(false);
          }}
          onClose={() => setShowCoordinateInput(false)}
        />
      )}
    </div>
  );
};

// Компонент формы поиска адресов для маршрута
const RouteSearchForm: React.FC<{
  onAddPoint: (address: string, coordinates: [number, number]) => void;
  onClose: () => void;
}> = ({ onAddPoint, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const places = await geocodingService.searchPlaces(query);
      setSearchResults(places);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (place: Place) => {
    if (place.coordinates && place.coordinates.length === 2) {
      onAddPoint(place.label, place.coordinates);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Введите адрес..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      {isSearching && (
        <div className="text-xs text-gray-500">Поиск...</div>
      )}
      {searchResults.length > 0 && (
        <div className="max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg">
          {searchResults.map((place, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectResult(place)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-gray-800">{place.label}</div>
              {(place as any).address && (
                <div className="text-xs text-gray-500">{(place as any).address}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlannerPage;

