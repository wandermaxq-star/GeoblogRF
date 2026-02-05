import React, { useEffect, useState, useCallback } from 'react';
import MobileMapSettings from '../../components/Mobile/MobileMapSettings';
import MobileFavoritesPanel from '../../components/Mobile/MobileFavoritesPanel';
import { Settings, Search } from 'lucide-react';
import { markerService } from '../../services/markerService';
import { projectManager } from '../../services/projectManager';
import { MarkerData } from '../../types/marker';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLocation } from 'react-router-dom';

// Прямой импорт MapComponent (как в десктопной версии) - убираем двойную lazy загрузку
import MapComponent from '../../components/Map/Map';

const MapPage: React.FC = () => {
  const location = useLocation();
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  const [flyToCoordinates, setFlyToCoordinates] = useState<[number, number] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const favorites = useFavorites();

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

  // Применённые (applied) — то, что реально отображается на карте
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [appliedMapSettings, setAppliedMapSettings] = useState(draftMapSettings);

  useEffect(() => {
    // Инициализация компонента
  }, [location.pathname]);

  // Загружаем метки
  useEffect(() => {
    let cancelled = false;

    const loadMarkers = async () => {
      try {
        setLoading(true);
        const response = await projectManager.getMarkers();
        if (!cancelled) {
          setMarkers(response || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMarkers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMarkers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Объединяем метки с избранными
  const allMarkers = React.useMemo(() => {
    const favoriteMarkers: MarkerData[] = (favorites?.favoritePlaces || [])
      .filter(place => {
        const hasLatLon = place.latitude !== undefined && place.longitude !== undefined;
        const notInMarkers = !markers.some(m => m.id === place.id);
        return hasLatLon && notInMarkers;
      })
      .map(place => ({
        id: place.id,
        latitude: place.latitude!,
        longitude: place.longitude!,
        title: place.name || '',
        category: (place as any).category || (place as any).type || 'default',
        description: (place as any).description || place.location || undefined,
        rating: 0,
        rating_count: 0,
        photo_urls: [],
        hashtags: [],
        author_name: 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
      } as MarkerData));

    return [...markers, ...favoriteMarkers];
  }, [markers, favorites]);

  const handleAddToFavorites = useCallback((marker: MarkerData) => {
    if (favorites?.addToFavorites) {
      favorites.addToFavorites(marker);
    }
  }, [favorites]);

  const handleMapClick = useCallback((coords: [number, number]) => {
    // Обработка клика по карте
  }, []);

  // Фильтруем метки в зависимости от применённых фильтров
  const filteredMarkers = React.useMemo(() => {
    let filtered = allMarkers;

    // Фильтр по категориям
    if (appliedFilters.categories.length > 0) {
      filtered = filtered.filter(marker =>
        appliedFilters.categories.includes(marker.category || 'other')
      );
    }

    // Фильтр по пресету
    if (appliedFilters.preset === 'user_poi') {
      // Пользовательские метки
      filtered = filtered.filter(marker => marker.category === 'user_poi');
    }
    // TODO: Реализовать другие пресеты (nearby, hot, new, events, interests, routes, blogs)

    return filtered;
  }, [allMarkers, appliedFilters]);

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

  // Обработка параметра marker - открытие попапа метки и центрирование карты
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const markerId = params.get('marker');
    
    if (markerId) {
      // Ищем метку в загруженных метках или избранных
      const marker = allMarkers.find(m => m.id === markerId);
      if (marker) {
        setSelectedMarkerIdForPopup(markerId);
        // Центрируем карту на метке
        setFlyToCoordinates([marker.latitude, marker.longitude]);
      }
    } else {
      // Если параметр marker удалён из URL, закрываем попап
      setSelectedMarkerIdForPopup(null);
      setFlyToCoordinates(null);
    }
  }, [location.search, allMarkers]);

  return (
    <div className="relative w-full h-full" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {/* Карта занимает весь экран - должна быть ПОЗАДИ UI элементов */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 100, pointerEvents: 'auto' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10" style={{ pointerEvents: 'auto' }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка карты...</p>
            </div>
          </div>
        )}
        <MapComponent
          center={[55.7558, 37.6173]}
          zoom={10}
          markers={filteredMarkers}
          onMapClick={handleMapClick}
          selectedMarkerIdForPopup={selectedMarkerIdForPopup}
          setSelectedMarkerIdForPopup={setSelectedMarkerIdForPopup}
          flyToCoordinates={flyToCoordinates}
          onAddToFavorites={handleAddToFavorites}
          isFavorite={(marker: MarkerData) => {
            return favorites?.favoritePlaces?.some(p => p.id === marker.id) || false;
          }}
          radius={appliedFilters.radiusOn ? appliedFilters.radius : 0}
          mapSettings={appliedMapSettings}
          filters={appliedFilters}
          searchRadiusCenter={[55.7558, 37.6173]}
          onSearchRadiusCenterChange={() => {}}
          onHashtagClickFromPopup={() => {}}
          onAddToBlog={() => {}}
          onBoundsChange={() => {}}
          favoritesCount={favorites?.favoritePlaces?.length || 0}
          selectedMarkerIds={[]}
          zones={[]}
        />
      </div>
      
      {/* UI элементы: поиск и кнопки (ПОВЕРХ карты, только на нужной площади) */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 pointer-events-auto"
        style={{ 
          top: 'calc(var(--action-buttons-height, 60px) + 3px)',
          zIndex: 1200,
          pointerEvents: 'auto'
        }}
      >
        {/* Кнопка настроек */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="bg-gray-100 text-gray-800 border border-gray-200 shadow-lg hover:shadow-xl hover:bg-gray-200 transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative active:scale-95"
          title="Настройки карты"
          style={{ pointerEvents: 'auto' }}
        >
          <Settings className="w-5 h-5 text-gray-800" />
          <span className="text-[10px] font-medium leading-tight text-center text-gray-800">Настройки</span>
        </button>
        
        {/* Поисковая строка */}
        <div className="relative" style={{ pointerEvents: 'auto' }}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск мест или меток..."
            className="bg-white rounded-full pl-10 pr-4 py-2 shadow-lg border-2 border-gray-300 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ pointerEvents: 'auto' }}
          />
        </div>
      </div>
      
      {/* Настройки карты */}
      <MobileMapSettings
        isOpen={settingsOpen}
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
        onApply={handleApply}
        onReset={handleReset}
      />
      
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
    </div>
  );
};

export default MapPage;

