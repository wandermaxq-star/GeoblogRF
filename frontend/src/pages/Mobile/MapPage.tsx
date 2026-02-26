import React, { useEffect, useState, useCallback } from 'react';
import MobileMapSettings from '../../components/Mobile/MobileMapSettings';
import MobileFavoritesPanel from '../../components/Mobile/MobileFavoritesPanel';
import { Settings, Search } from 'lucide-react';
import { markerService } from '../../services/markerService';
import { projectManager } from '../../services/projectManager';
import { MarkerData } from '../../types/marker';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLocation } from 'react-router-dom';
import { useContentStore } from '../../stores/contentStore';

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
    // КРИТИЧНО: устанавливаем leftContent = 'map' чтобы Map.tsx считал карту интерактивной
    // (isMapInteractive = leftContent === 'map') — без этого клики, маркеры и попапы не работают
    useContentStore.getState().setLeftContent('map');
    return () => {
      // При уходе со страницы карты сбрасываем leftContent
      const current = useContentStore.getState().leftContent;
      if (current === 'map') {
        useContentStore.getState().setLeftContent(null);
      }
    };
  }, []);

  useEffect(() => {
    // Инициализация компонента
  }, [location.pathname]);

  // Загружаем метки
  useEffect(() => {
    let cancelled = false;

    const loadMarkers = async () => {
      try {
        setLoading(true);
        const response = await projectManager.loadAllMarkers();
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

  // Состояние режима добавления метки
  const [isAddingMarkerMode, setIsAddingMarkerMode] = useState(false);

  // Обработка query-параметра addMarker=true (из ActionButtons)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('addMarker') === 'true') {
      setIsAddingMarkerMode(true);
      // Убираем параметр из URL, чтобы не срабатывал повторно
      params.delete('addMarker');
      window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, [location.search, location.pathname]);

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
      categories: [] as string[],
      radiusOn: false,
      radius: 10,
      preset: null as string | null,
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
    <div className="relative w-full h-full">
      {/* MapComponent рендерится через createPortal в #global-map-root (body),
          поэтому здесь не нужен position:fixed — карта уже на уровне body с z-index: 1.
          UI-контроли ниже находятся в MobileLayout (z-index: 2), т.е. ВЫШЕ портала карты. */}
      
      {/* Индикатор загрузки — поверх всего */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-background/80" style={{ zIndex: 3, pointerEvents: 'auto' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка карты...</p>
          </div>
        </div>
      )}
      
      {/* Невидимый контейнер — MapComponent сам рисует через portal в body */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
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
          isAddingMarkerMode={isAddingMarkerMode}
          onAddMarkerModeChange={setIsAddingMarkerMode}
        />
      </div>
      
      {/* UI элементы: поиск и кнопки (ПОВЕРХ портала карты) */}
      <div 
        className="mobile-map-controls left-1/2 transform -translate-x-1/2 flex items-center gap-2"
        style={{ 
          top: 'calc(var(--action-buttons-height, 60px) + 3px)',
        }}
      >
        {/* Кнопка настроек */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="m-glass-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative"
          title="Настройки карты"
        >
          <Settings className="w-5 h-5 m-glass-icon" />
          <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Настройки</span>
        </button>
        
        {/* Поисковая строка */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 m-glass-text-muted" size={16} />
          <input
            type="text"
            placeholder="Поиск мест или меток..."
            className="m-glass-input rounded-full pl-10 pr-4 py-2 min-w-[200px]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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

