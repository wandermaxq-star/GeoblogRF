import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import MobileMapSettings, { MobileMapSettingsState } from '../../components/Mobile/MobileMapSettings';
import MobileFavoritesPanel from '../../components/Mobile/MobileFavoritesPanel';
import { Settings, Search, Crosshair, MapPin } from 'lucide-react';
import CategoryQuickFilter from '../../components/Map/CategoryQuickFilter';
import { MarkerData } from '../../types/marker';
import { useEventsStore } from '../../stores/eventsStore';
import { getEvents } from '../../services/eventService';
import { mockEvents } from '../../components/TravelCalendar/mockEvents';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useLocation } from 'react-router-dom';
import { useContentStore } from '../../stores/contentStore';
import { mapFacade } from '../../services/map_facade/index';
import SearchResultsDropdown from '../../components/Search/SearchResultsDropdown';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import { useMapFilters } from '../../hooks/useMapFilters';
import { useMapSearch } from '../../hooks/useMapSearch';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useLocationMode } from '../../hooks/useLocationMode';
import { mapStateHelpers } from '../../stores/mapStateStore';
import MapAddSelector, { MapAddMode } from '../../components/Map/MapAddSelector';

// Прямой импорт MapComponent (как в десктопной версии) - убираем двойную lazy загрузку
import MapComponent from '../../components/Map/Map';

const LazyEventDetailPage = lazy(() =>
  import('../../components/Events/EventDetailPage').then((m) => ({ default: m.EventDetailPage }))
);

const MapPage: React.FC = () => {
  const location = useLocation();
  // markers state moved into reusable hook
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  const [flyToCoordinates, setFlyToCoordinates] = useState<[number, number] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const favorites = useFavorites();
  const selectedEvent = useEventsStore((state) => state.selectedEvent);
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent);
  const setOpenEvents = useEventsStore((state) => state.setOpenEvents);
  const isEventSheetOpen = useEventsStore((state) => state.isEventSheetOpen);

  // Фильтры/настройки карты управляются общим хуком
  const {
    draft: draftFilters,
    applied: appliedFilters,
    setDraft: setDraftFilters,
    apply: applyFilters,
    reset: resetFilters,
    quickChange: handleQuickCategoryChange,
  } = useMapFilters();

  const [draftMapSettings, setDraftMapSettings] = useState<MobileMapSettingsState>({
    mapType: 'light',
    showTraffic: false,
    showBikeLanes: false,
    showHints: true,
    themeColor: 'green',
  });

  const [appliedMapSettings, setAppliedMapSettings] = useState<MobileMapSettingsState>(draftMapSettings);

  // use shared hook for loading and merging markers
  const markerApiCategories = useMemo(
    () => appliedFilters.categories.filter((category) => category !== 'event'),
    [appliedFilters.categories]
  );

  const { allMarkers, loading: markersLoading, loadMarkers, reloadMarkers } = useMapMarkers({
    categories: markerApiCategories,
    // mobile currently performs a full download rather than lazy boundaries
    lazy: false,
    limit: 1000,
  });

  // search hook (depends on allMarkers)
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    isLoading: isSearchLoading,
    isDropdownVisible,
    setIsDropdownVisible,
    places: geocodingResults,
    markers: filteredMarkersForSearch,
  } = useMapSearch(allMarkers);

  // Геолокация и режим геолокации
  const { location: userLocation, refreshLocation } = useUserLocation();
  const { mode: locationMode, toggleMode: toggleLocationMode } = useLocationMode();

  // Автоматическое центрирование карты на местоположении пользователя
  useEffect(() => {
    console.log('[MapPage] locationMode:', locationMode, 'userLocation:', userLocation);
    if (locationMode === 'auto' && userLocation &&
        Number.isFinite(userLocation.latitude) &&
        Number.isFinite(userLocation.longitude)) {
      console.log('[MapPage] Setting flyToCoordinates:', userLocation.latitude, userLocation.longitude);
      setFlyToCoordinates([userLocation.latitude, userLocation.longitude]);
    } else {
      console.log('[MapPage] Skipping flyTo - invalid condition');
    }
  }, [locationMode, userLocation]);

  // Обработчик клика по кнопке геолокации
  const handleGeolocationClick = () => {
    const newMode = locationMode === 'auto' ? 'manual' : 'auto';
    console.log('[MapPage] Geolocation button clicked, switching to mode:', newMode);
    toggleLocationMode();
    if (newMode === 'auto') {
      // Запросить актуальное местоположение
      refreshLocation().catch(err => console.warn('[MapPage] refreshLocation failed:', err));
    }
  };

  // Центр поиска/радиуса - зависит от режима геолокации
  const [manualSearchRadiusCenter, setManualSearchRadiusCenter] = useState<[number, number]>(() => {
    // Используем сохранённое состояние карты или дефолт на Владимирскую область
    const savedState = mapStateHelpers.getCenterAndZoom('osm');
    return savedState.center;
  });
  
  // Начальный центр карты - из store или дефолт
  const initialCenter = useMemo<[number, number]>(() => {
    const savedState = mapStateHelpers.getCenterAndZoom('osm');
    return savedState.center;
  }, []);

  // Вычисляем searchRadiusCenter на основе режима
  const searchRadiusCenter = useMemo<[number, number]>(() => {
    if (locationMode === 'auto' && userLocation) {
      return [userLocation.latitude, userLocation.longitude];
    }
    return manualSearchRadiusCenter;
  }, [locationMode, userLocation, manualSearchRadiusCenter]);

  // Обновляем manualSearchRadiusCenter когда пользователь перемещает карту в ручном режиме
  const handleSearchRadiusCenterChange = useCallback((newCenter: [number, number]) => {
    if (locationMode === 'manual') {
      setManualSearchRadiusCenter(newCenter);
    }
  }, [locationMode]);

  const selectedEventForDetail = useMemo(() => {
    const ev = selectedEvent;
    if (!ev) return null;
    return {
      id: String(ev.id),
      title: ev.title,
      description: ev.description || '',
      start_date: ev.date,
      end_date: ev.endDate ?? ev.date,
      location: {
        address: ev.location || '',
        latitude: Number.isFinite(ev.latitude) ? ev.latitude : undefined,
        longitude: Number.isFinite(ev.longitude) ? ev.longitude : undefined,
      },
      source: 'local' as const,
      category: ev.categoryId,
      url: '',
      image_url: '',
    };
  }, [selectedEvent?.id]);

  useEffect(() => {
    // Логирование для отладки - страница смонтирована
    console.log('[MobileMapPage] mounted');
    
    // Примечание: leftContent теперь управляется MobilePageLayer + MobileLayout
    // Не устанавливаем и не сбрасываем leftContent здесь - это вызывает race condition
  }, []);

  useEffect(() => {
    // Инициализация компонента
  }, [location.pathname]);

  useEffect(() => {
    if (!appliedFilters.categories.includes('event')) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await getEvents();
        if (cancelled) return;

        const mapped = data
          .filter((event: any) => event.latitude != null && event.longitude != null)
          .map((event: any) => ({
            id: Number(event.id) || 0,
            title: event.title,
            description: event.description || '',
            date: (event.start_datetime || '').split('T')[0],
            endDate: event.end_datetime ? event.end_datetime.split('T')[0] : undefined,
            categoryId: event.category || event.event_type || 'festival',
            hashtags: Array.isArray(event.hashtags) ? event.hashtags : [],
            location: event.location || '',
            latitude: Number(event.latitude),
            longitude: Number(event.longitude),
          }));

        const allEvents = [...mapped, ...mockEvents].filter(
          (event) => !isNaN(event.latitude) && !isNaN(event.longitude) && event.latitude !== 0 && event.longitude !== 0
        );

        setOpenEvents(allEvents);
      } catch (_error) {
        const validMockEvents = mockEvents.filter(
          (event) => !isNaN(event.latitude) && !isNaN(event.longitude)
        );

        if (!cancelled) {
          setOpenEvents(validMockEvents);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters.categories, setOpenEvents]);

  // Загружаем метки
  // Marker loading and merging is handled by useMapMarkers hook above; no local effect needed

  // note: mobile does not track map bounds separately; reloadMarkers can be
  // called manually from UI if needed. the lazy hook will fetch when invoked.

  // Convenience alias (same as from hook)
  // allMarkers available directly from hook


  const handleAddToFavorites = useCallback((marker: MarkerData) => {
    if (favorites?.addToFavorites) {
      favorites.addToFavorites(marker);
    }
  }, [favorites]);

  // Режимы добавления объектов
  const [isAddingMarkerMode, setIsAddingMarkerMode] = useState(false);
  const [isAddingEventMode, setIsAddingEventMode] = useState(false);
  const [addSelectorOpen, setAddSelectorOpen] = useState(false);
  const [isCreationPanelOpen, setIsCreationPanelOpen] = useState(false);

  // Обработка query-параметра addSelector=true (открыть предвыборный попап)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('addSelector') === 'true') {
      setAddSelectorOpen(true);
      params.delete('addSelector');
      window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
    if (params.get('addMarker') === 'true') {
      setIsAddingMarkerMode(true);
      params.delete('addMarker');
      window.history.replaceState({}, '', `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, [location.search, location.pathname]);

  const handleAddModeSelect = (mode: MapAddMode) => {
    setAddSelectorOpen(false);
    if (mode === 'marker') {
      setIsAddingMarkerMode(true);
      setIsAddingEventMode(false);
    } else {
      setIsAddingEventMode(true);
      setIsAddingMarkerMode(false);
    }
  };

  const handleMapClick = useCallback((coords: [number, number]) => {
    // Обработка клика по карте - временно выводим координаты в консоль
    console.log('[Mobile Map] click at', coords);
    // можно расширить: добавить метку/открыть конструктора и т.д.
  }, []);

  // Фильтруем метки в зависимости от применённых фильтров
  const filteredMarkers = React.useMemo(() => {
    // Защитная проверка: убеждаемся что allMarkers это массив
    const markers = Array.isArray(allMarkers) ? allMarkers : [];
    let filtered = markers;

    // Фильтр по категориям
    if (appliedFilters.categories.length > 0) {
      filtered = filtered.filter(marker =>
        appliedFilters.categories.includes(marker.category || 'other')
      );
    }

    // Фильтр по пресету
    if (appliedFilters.preset === 'user_poi') {
      filtered = filtered.filter(marker => marker.category === 'user_poi');
    }
    // TODO: остальные пресеты

    return filtered;
  }, [allMarkers, appliedFilters]);

  // handlers are now provided by the map filters hook
  const handleApply = () => {
    applyFilters();
    setAppliedMapSettings(draftMapSettings);
  };

  // quick-change alias imported via hook earlier (handleQuickCategoryChange)

  const handleReset = () => {
    resetFilters();
    const defaultMapSettings: MobileMapSettingsState = {
      mapType: 'light',
      showTraffic: false,
      showBikeLanes: false,
      showHints: true,
      themeColor: 'green',
    };
    setDraftMapSettings(defaultMapSettings);
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
      
      {/* Индикатор загрузки маркеров */}
      {markersLoading && (
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
          center={initialCenter}
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
          searchRadiusCenter={searchRadiusCenter}
          onSearchRadiusCenterChange={handleSearchRadiusCenterChange}
          onHashtagClickFromPopup={() => {}}
          onAddToBlog={() => {}}
          onBoundsChange={() => {}}
          favoritesCount={favorites?.favoritePlaces?.length || 0}
          selectedMarkerIds={favorites?.selectedMarkerIds || []}
          setSelectedMarkerIds={favorites?.setSelectedMarkerIds || (() => {})}
          zones={[]}
          isAddingMarkerMode={isAddingMarkerMode}
          onAddMarkerModeChange={setIsAddingMarkerMode}
          isAddingEventMode={isAddingEventMode}
          onAddingEventModeChange={setIsAddingEventMode}
          onCreationPanelVisibilityChange={setIsCreationPanelOpen}
        />
      </div>

      {/* Предвыбор типа объекта (через портал — работает вне pointer-events: none) */}
      <MapAddSelector
        isOpen={addSelectorOpen}
        onSelect={handleAddModeSelect}
        onClose={() => setAddSelectorOpen(false)}
      />

      {/* UI элементы: поиск и кнопки (ПОВЕРХ портала карты) */}
      {/* быстрый фильтр категорий (по аналогии с десктопом) */}
      {!(isAddingMarkerMode || isAddingEventMode || addSelectorOpen || isCreationPanelOpen) && (
        <CategoryQuickFilter
          selectedCategories={appliedFilters.categories}
          onCategoriesChange={handleQuickCategoryChange}
        />
      )}
      <div 
        className="mobile-map-controls left-1/2 transform -translate-x-1/2 flex items-center gap-2"
        style={{ 
          top: 'calc(var(--topbar-height, 64px) + 4px)',
          pointerEvents: 'auto',
        }}
      >
        {/* Кнопка геолокации */}
        <button
          onClick={handleGeolocationClick}
          className={`m-glass-map-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative ${
            locationMode === 'auto' ? 'ring-2 ring-green-400 ring-opacity-60' : ''
          }`}
          title={locationMode === 'auto' ? 'Геолокация включена' : 'Ручной режим'}
          style={locationMode === 'auto' ? { background: 'rgba(34, 197, 94, 0.2)' } : {}}
        >
          {locationMode === 'auto' ? (
            <Crosshair className="w-5 h-5 text-green-500" />
          ) : (
            <MapPin className="w-5 h-5" />
          )}
          <span className="text-[10px] font-medium leading-tight text-center m-glass-text">
            {locationMode === 'auto' ? 'Моё место' : 'Ручной'}
          </span>
        </button>
        
        {/* Кнопка настроек */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="m-glass-map-btn transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 min-w-[70px] max-w-[70px] h-[70px] relative"
          title="Настройки карты"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight text-center m-glass-text">Настройки</span>
        </button>
        
        {/* Поисковая строка */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 m-glass-text-muted" size={16} />
          <input
            type="text"
            placeholder="Поиск объектов"
            className="m-glass-input rounded-full pl-10 pr-4 py-2 min-w-[200px]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ color: '#000' }}
          />
          {isDropdownVisible && (
            <div className="absolute w-full z-50">
              <SearchResultsDropdown
                loading={isSearchLoading}
                places={geocodingResults}
                markers={filteredMarkersForSearch}
                onPlaceSelect={(place) => {
                  setFlyToCoordinates(place.coordinates);
                  setSearchQuery('');
                }}
                onMarkerSelect={(marker) => {
                  if (Number.isFinite(marker.longitude) && Number.isFinite(marker.latitude)) {
                    setFlyToCoordinates([marker.latitude, marker.longitude]);
                  }
                  setSelectedMarkerIdForPopup(marker.id);
                  setSearchQuery('');
                }}
              />
            </div>
          )}
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
        onApply={() => {
          applyFilters();
          setAppliedMapSettings(draftMapSettings);
        }}
        onReset={() => {
          resetFilters();
          const defaultMapSettings: MobileMapSettingsState = {
            mapType: 'light',
            showTraffic: false,
            showBikeLanes: false,
            showHints: true,
            themeColor: 'green',
          };
          setDraftMapSettings(defaultMapSettings);
          setAppliedMapSettings(defaultMapSettings);
        }}
      />

      {selectedEventForDetail && !isEventSheetOpen && (
        <div
          className="fixed left-0 right-0 flex items-center justify-center"
          style={{
            top: 'calc(var(--topbar-height, 64px) + 8px)',
            bottom: 'calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + 24px)',
            zIndex: 1900,
            padding: '8px 12px',
            pointerEvents: 'auto',
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="relative w-full h-full"
            style={{
              maxWidth: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full h-full">
              <Suspense fallback={<div style={{ padding: 24, color: '#fff' }}>Загрузка...</div>}>
                <LazyEventDetailPage
                  event={selectedEventForDetail}
                  onClose={() => setSelectedEvent(null)}
                  onBack={() => setSelectedEvent(null)}
                  standalone={true}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;

