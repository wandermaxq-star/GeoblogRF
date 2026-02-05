import React, { useState } from 'react';
import { X, Filter, Settings2, Layers, Crosshair, MapPin, Flame, Clock, CalendarCheck, Heart, Navigation, FileText, Check, Car, Clock as ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FaStar,
  FaUtensils,
  FaHotel,
  FaLeaf,
  FaLandmark,
  FaGem,
  FaBus,
  FaQuestion,
  FaWallet,
  FaUsers,
  FaHeart as FaHeartIcon,
  FaCar,
  FaWalking,
  FaBicycle,
} from 'react-icons/fa';

// Основные категории для легенды карты (как в MapFilters)
const LEGEND_CATEGORIES = [
  { key: "attraction", label: "Достопримечательность", icon: FaStar, color: "#3498db" },
  { key: "restaurant", label: "Ресторан", icon: FaUtensils, color: "#e74c3c" },
  { key: "hotel", label: "Отель", icon: FaHotel, color: "#8e44ad" },
  { key: "nature", label: "Природа", icon: FaLeaf, color: "#27ae60" },
  { key: "culture", label: "Культура", icon: FaLandmark, color: "#f1c40f" },
  { key: "entertainment", label: "Развлечения", icon: FaGem, color: "#f39c12" },
  { key: "transport", label: "Транспорт", icon: FaBus, color: "#16a085" },
  { key: "shopping", label: "Торговля", icon: FaWallet, color: "#e67e22" },
  { key: "healthcare", label: "Здравоохранение", icon: FaHeartIcon, color: "#e74c3c" },
  { key: "education", label: "Образование", icon: FaUsers, color: "#3498db" },
  { key: "service", label: "Сервис", icon: FaQuestion, color: "#34495e" },
  { key: "other", label: "Другое", icon: FaQuestion, color: "#7f8c8d" },
];

const presets = [
  { key: 'nearby', label: 'Рядом со мной', icon: Crosshair },
  { key: 'hot', label: 'Популярное сейчас', icon: Flame },
  { key: 'new', label: 'Новое на карте', icon: Clock },
  { key: 'events', label: 'Предстоящие события', icon: CalendarCheck },
  { key: 'interests', label: 'Мои интересы', icon: Heart },
  { key: 'routes', label: 'Маршруты', icon: Navigation },
  { key: 'blogs', label: 'Блоги', icon: FileText },
  { key: 'user_poi', label: 'Пользовательские метки', icon: MapPin },
];

interface MobileMapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  // Фильтры (черновики)
  filters: {
    categories: string[];
    radiusOn: boolean;
    radius: number;
    preset: string | null;
  };
  onFiltersChange: (filters: MobileMapSettingsProps['filters']) => void;
  // Настройки карты (черновики)
  mapSettings: {
    mapType: string;
    showTraffic: boolean;
    showBikeLanes: boolean;
    showHints: boolean;
    themeColor: string;
  };
  onMapSettingsChange: (settings: MobileMapSettingsProps['mapSettings']) => void;
  // Действия
  onApply: () => void;
  onReset: () => void;
  onShowAllMarkers?: () => void;
  // Режим загрузки
  useLazyLoading?: boolean;
  onLoadingModeToggle?: (useLazy: boolean) => void;
  mode?: 'map' | 'planner';
  // Настройки маршрута (для planner режима)
  routeSettings?: {
    transportType: 'driving-car' | 'foot-walking' | 'cycling-regular' | 'driving-hgv' | 'driving-bus' | 'cycling-road' | 'cycling-mountain' | 'cycling-electric' | 'public-transport' | 'motorcycle' | 'scooter';
    optimization: 'fastest' | 'shortest' | 'balanced';
    avoidHighways: boolean;
    avoidTolls: boolean;
    showAlternatives: boolean;
  };
  onRouteSettingsChange?: (settings: MobileMapSettingsProps['routeSettings']) => void;
}

// Конфигурация транспорта
const TRANSPORT_CONFIG = {
  'driving-car': { name: 'Автомобиль', icon: '🚗', speed: 50, unit: 'км/ч' },
  'driving-hgv': { name: 'Грузовик', icon: '🚛', speed: 40, unit: 'км/ч' },
  'driving-bus': { name: 'Автобус', icon: '🚌', speed: 35, unit: 'км/ч' },
  'motorcycle': { name: 'Мотоцикл', icon: '🏍️', speed: 60, unit: 'км/ч' },
  'scooter': { name: 'Скутер', icon: '🛵', speed: 30, unit: 'км/ч' },
  'foot-walking': { name: 'Пешком', icon: '🚶', speed: 5, unit: 'км/ч' },
  'cycling-regular': { name: 'Велосипед', icon: '🚴', speed: 15, unit: 'км/ч' },
  'cycling-road': { name: 'Шоссейный велосипед', icon: '🚴‍♂️', speed: 25, unit: 'км/ч' },
  'cycling-mountain': { name: 'Горный велосипед', icon: '🚵', speed: 12, unit: 'км/ч' },
  'cycling-electric': { name: 'Электровелосипед', icon: '🛴', speed: 20, unit: 'км/ч' },
  'public-transport': { name: 'Общественный транспорт', icon: '🚇', speed: 25, unit: 'км/ч' }
};

const MobileMapSettings: React.FC<MobileMapSettingsProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  mapSettings,
  onMapSettingsChange,
  onApply,
  onReset,
  onShowAllMarkers,
  useLazyLoading = false,
  onLoadingModeToggle,
  mode = 'map',
  routeSettings,
  onRouteSettingsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'settings'>('filters');
  const [openSection, setOpenSection] = useState<string>('');

  // Сбрасываем открытые разделы при открытии меню
  React.useEffect(() => {
    if (isOpen) {
      setOpenSection('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Обработчики для фильтров
  const selectedCategories = filters.categories;
  const setSelectedCategories = (cats: string[]) => {
    onFiltersChange({ ...filters, categories: cats });
  };

  const isRadiusOn = filters.radiusOn;
  const setIsRadiusOn = (val: boolean) => {
    onFiltersChange({ ...filters, radiusOn: val });
  };

  const radius = filters.radius;
  const setRadius = (val: number) => {
    onFiltersChange({ ...filters, radius: val });
  };

  const selectedPreset = filters.preset;
  const setSelectedPreset = (val: string | null) => {
    onFiltersChange({ ...filters, preset: val });
  };

  // Обработчики для настроек карты
  const mapType = mapSettings.mapType;
  const setMapType = (val: string) => {
    onMapSettingsChange({ ...mapSettings, mapType: val });
  };

  const showTraffic = mapSettings.showTraffic;
  const setShowTraffic = (val: boolean) => {
    onMapSettingsChange({ ...mapSettings, showTraffic: val });
  };

  const showBikeLanes = mapSettings.showBikeLanes;
  const setShowBikeLanes = (val: boolean) => {
    onMapSettingsChange({ ...mapSettings, showBikeLanes: val });
  };

  const showHints = mapSettings.showHints;
  const setShowHints = (val: boolean) => {
    onMapSettingsChange({ ...mapSettings, showHints: val });
  };

  const themeColor = mapSettings.themeColor;
  const setThemeColor = (val: string) => {
    onMapSettingsChange({ ...mapSettings, themeColor: val });
  };

  // Обработчики для настроек маршрута (для planner режима)
  const defaultRouteSettings = {
    transportType: 'driving-car' as const,
    optimization: 'fastest' as const,
    avoidHighways: false,
    avoidTolls: false,
    showAlternatives: false,
  };
  const currentRouteSettings = routeSettings || defaultRouteSettings;
  
  const setRouteSetting = (key: keyof typeof currentRouteSettings, value: any) => {
    if (onRouteSettingsChange) {
      onRouteSettingsChange({ ...currentRouteSettings, [key]: value });
    }
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
      <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          style={{ pointerEvents: 'auto' }}
        onClick={onClose}
      />
      )}
      
      {/* Settings Panel - компактное аккордеонное окно как в браузерной версии */}
      <div
        className={cn(
          "fixed left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-[20px] shadow-[0_4px_24px_0_rgba(0,0,0,0.10)] border-2 border-[#7c7b7b91]",
          "max-w-[340px] min-w-[280px] w-[calc(100vw-32px)] max-h-[calc(100vh-200px)]",
          "overflow-hidden flex flex-col transition-all duration-300",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[-20px] pointer-events-none"
        )}
        style={{ top: 'calc(var(--action-buttons-height) + 40px + 70px + 40px)', pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - стальной градиент */}
        <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 text-white text-[1.1em] font-bold py-4 rounded-t-[20px] text-center relative flex items-center justify-center border-b border-gray-700 shadow-inner">
          <h2 className="text-base font-bold text-white">
            {mode === 'map' ? 'Фильтры и настройки' : 'Настройки маршрута'}
            </h2>
          <button
              onClick={onClose}
            className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-none border-none text-white cursor-pointer p-1 w-6 h-6 rounded-full transition-all hover:bg-white/20 flex items-center justify-center text-lg font-bold leading-none"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Selected filters indicator - только для режима map */}
        {mode === 'map' && (
          (selectedCategories.length > 0 || selectedPreset || isRadiusOn) ? (
            <div className="min-h-[36px] flex flex-wrap gap-1.5 items-center mx-7 mt-2">
              {selectedCategories.map(catKey => (
                <button key={catKey} className="bg-[#22c55e] text-white border-none rounded-2xl px-3.5 py-1.5 text-[13px] cursor-pointer transition-all flex items-center gap-1.5">
                  {LEGEND_CATEGORIES.find((cat) => cat.key === catKey)?.label || catKey}
                </button>
              ))}
              {selectedPreset && (
                <button className="bg-[#22c55e] text-white border-none rounded-2xl px-3.5 py-1.5 text-[13px] cursor-pointer">
                  {presets.find(p => p.key === selectedPreset)?.label}
                </button>
              )}
              {isRadiusOn && (
                <button className="bg-[#22c55e] text-white border-none rounded-2xl px-3.5 py-1.5 text-[13px] cursor-pointer">
                  Радиус: {radius} км
                </button>
              )}
            </div>
          ) : (
            <div className="min-h-[36px] flex flex-wrap gap-1.5 items-center mx-7 mt-2 text-gray-400 text-sm">
              Выберите фильтры для поиска мест...
            </div>
          )
        )}

        {/* Tabs - белый фон с зелеными активными */}
        {mode === 'planner' ? (
          <div className="flex gap-2 px-4 py-2 border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('filters')}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold transition-all rounded-lg",
                activeTab === 'filters'
                  ? "bg-[#22c55e] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Navigation className="w-4 h-4 inline mr-2" />
              Маршрут
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold transition-all rounded-lg",
                activeTab === 'settings'
                  ? "bg-[#22c55e] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Settings2 className="w-4 h-4 inline mr-2" />
              Карта
            </button>
          </div>
        ) : (
          <div className="flex gap-2 px-4 py-2 border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('filters')}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold transition-all rounded-lg",
                activeTab === 'filters'
                  ? "bg-[#22c55e] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Фильтры
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "flex-1 px-3 py-2 text-sm font-semibold transition-all rounded-lg",
                activeTab === 'settings'
                  ? "bg-[#22c55e] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Settings2 className="w-4 h-4 inline mr-2" />
              Настройки
            </button>
          </div>
        )}

        {/* Content - аккордеон с белым фоном и зелеными активными разделами */}
        <div className="flex-1 overflow-y-auto bg-white">
            {/* Для режима planner показываем настройки маршрута (транспорт, оптимизация, опции) */}
            {activeTab === 'filters' && mode === 'planner' && (
              <div>
                {/* Тип транспорта */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'transport' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'transport' ? '' : 'transport')}
                  >
                    <Car className="mr-2" style={{ width: 16, height: 16, color: openSection === 'transport' ? 'white' : '#22c55e' }} />
                    Тип транспорта
                    <span className="ml-auto">{openSection === 'transport' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'transport' && (
                    <div className="pt-2 pl-8 max-h-[200px] overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(TRANSPORT_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => setRouteSetting('transportType', key)}
                            className={cn(
                              "w-full p-2 rounded-lg border-2 transition-colors text-left flex items-center gap-2",
                              currentRouteSettings.transportType === key
                                ? "border-[#22c55e] bg-green-50"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <span className="text-lg">{config.icon}</span>
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-800">{config.name}</div>
                              <div className="text-xs text-gray-500">{config.speed} {config.unit}</div>
                            </div>
                            {currentRouteSettings.transportType === key && (
                              <Check className="w-4 h-4 text-[#22c55e]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Оптимизация маршрута */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'optimization' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'optimization' ? '' : 'optimization')}
                  >
                    <Navigation className="mr-2" style={{ width: 16, height: 16, color: openSection === 'optimization' ? 'white' : '#22c55e' }} />
                    Оптимизация маршрута
                    <span className="ml-auto">{openSection === 'optimization' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'optimization' && (
                    <div className="pt-2 pl-8">
                      <select
                        value={currentRouteSettings.optimization}
                        onChange={e => setRouteSetting('optimization', e.target.value)}
                        className="w-full rounded-md px-2 py-2 border border-gray-300 bg-white text-gray-900 text-sm"
                      >
                        <option value="fastest">⚡ Самый быстрый</option>
                        <option value="shortest">📏 Самый короткий</option>
                        <option value="balanced">⚖️ Сбалансированный</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Дополнительные опции */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'routeOptions' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'routeOptions' ? '' : 'routeOptions')}
                  >
                    <Settings2 className="mr-2" style={{ width: 16, height: 16, color: openSection === 'routeOptions' ? 'white' : '#22c55e' }} />
                    Дополнительные опции
                    <span className="ml-auto">{openSection === 'routeOptions' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'routeOptions' && (
                    <div className="pt-2 pl-8 space-y-2.5">
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={currentRouteSettings.avoidHighways}
                          onChange={e => setRouteSetting('avoidHighways', e.target.checked)}
                          className="w-4 h-4 accent-[#22c55e]"
                        />
                        Избегать автомагистрали
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={currentRouteSettings.avoidTolls}
                          onChange={e => setRouteSetting('avoidTolls', e.target.checked)}
                          className="w-4 h-4 accent-[#22c55e]"
                        />
                        Избегать платные дороги
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={currentRouteSettings.showAlternatives}
                          onChange={e => setRouteSetting('showAlternatives', e.target.checked)}
                          className="w-4 h-4 accent-[#22c55e]"
                        />
                        Показать альтернативы
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'filters' && mode === 'map' && (
              <div>
                {/* Категории и хэштеги */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'categories' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'categories' ? '' : 'categories')}
                  >
                    <FaLeaf className="mr-2" style={{ width: 16, height: 16, color: openSection === 'categories' ? 'white' : '#22c55e' }} />
                      Категории и хэштеги
                    <span className="ml-auto">{openSection === 'categories' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'categories' && (
                    <div className="pt-2 pl-8 max-h-[140px] overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                      {LEGEND_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategories.includes(cat.key);
                        return (
                          <button
                            key={cat.key}
                            onClick={() =>
                              setSelectedCategories(
                                isSelected
                                  ? selectedCategories.filter(k => k !== cat.key)
                                  : [...selectedCategories, cat.key]
                              )
                            }
                            className={cn(
                                "border-none rounded-2xl px-3.5 py-1.5 text-[13px] cursor-pointer transition-all flex items-center gap-1.5",
                              isSelected
                                  ? "bg-[#22c55e] text-white" 
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                          >
                              <Icon className="category-icon" style={{ width: 14, height: 14, color: isSelected ? 'white' : cat.color }} />
                              {cat.label}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Радиус поиска */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'radius' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'radius' ? '' : 'radius')}
                  >
                    <Crosshair className="mr-2" style={{ width: 16, height: 16, color: openSection === 'radius' ? 'white' : '#22c55e' }} />
                      Радиус поиска
                    <span className="ml-auto">{openSection === 'radius' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'radius' && (
                    <div className="pt-2 pl-8">
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={isRadiusOn}
                          onChange={e => setIsRadiusOn(e.target.checked)}
                          className="w-4 h-4 accent-[#22c55e]"
                        />
                        Включить радиус поиска
                      </label>
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="range"
                          min={1}
                          max={20}
                          value={radius}
                          onChange={e => setRadius(Number(e.target.value))}
                          disabled={!isRadiusOn}
                          style={{ width: 100, opacity: isRadiusOn ? 1 : 0.5 }}
                          className="flex-1 accent-[#22c55e]"
                        />
                        <span className="min-w-[40px] text-right text-gray-800 text-sm">{radius} км</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Предустановленные сценарии */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'presets' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'presets' ? '' : 'presets')}
                  >
                    <Flame className="mr-2" style={{ width: 16, height: 16, color: openSection === 'presets' ? 'white' : '#22c55e' }} />
                      Предустановленные сценарии
                    <span className="ml-auto">{openSection === 'presets' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'presets' && (
                    <div className="pt-2 pl-8 max-h-[140px] overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                      {presets.map((preset) => {
                        const Icon = preset.icon;
                        const isSelected = selectedPreset === preset.key;
                        return (
                          <button
                            key={preset.key}
                            onClick={() => setSelectedPreset(isSelected ? null : preset.key)}
                            className={cn(
                                "border-none rounded-2xl px-3.5 py-1.5 text-[13px] cursor-pointer transition-all flex items-center gap-1.5",
                              isSelected
                                  ? "bg-[#22c55e] text-white" 
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                          >
                              <Icon className="w-3.5 h-3.5" />
                              {preset.label}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Режим загрузки маркеров */}
                {onLoadingModeToggle && (
                  <div className="px-7 pb-4.5 border-b border-gray-200">
                    <div
                      className={cn(
                        "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                        openSection === 'loading' 
                          ? "bg-[#22c55e] text-white" 
                          : "bg-white text-gray-800 hover:bg-gray-100"
                      )}
                      onClick={() => setOpenSection(openSection === 'loading' ? '' : 'loading')}
                    >
                      <Layers className="mr-2" style={{ width: 16, height: 16, color: openSection === 'loading' ? 'white' : '#22c55e' }} />
                        Режим загрузки
                      <span className="ml-auto">{openSection === 'loading' ? '▲' : '▼'}</span>
                    </div>
                    {openSection === 'loading' && (
                      <div className="pt-2 pl-8">
                        <div className="space-y-3">
                          <label className="flex items-start gap-2 text-sm text-gray-800">
                          <input
                            type="radio"
                            name="loadingMode"
                            checked={useLazyLoading}
                            onChange={() => onLoadingModeToggle(true)}
                              className="w-4 h-4 mt-0.5 accent-[#22c55e]"
                          />
                          <div>
                              <div className="font-bold text-gray-900">Ленивая загрузка</div>
                            <div className="text-xs text-gray-600">
                              Загружаем только видимые маркеры (быстрее, меньше трафика)
                            </div>
                          </div>
                        </label>
                          <label className="flex items-start gap-2 text-sm text-gray-800">
                          <input
                            type="radio"
                            name="loadingMode"
                            checked={!useLazyLoading}
                            onChange={() => onLoadingModeToggle(false)}
                              className="w-4 h-4 mt-0.5 accent-[#22c55e]"
                          />
                          <div>
                              <div className="font-bold text-gray-900">Полная загрузка</div>
                            <div className="text-xs text-gray-600">
                              Загружаем все маркеры сразу (быстрый поиск)
                            </div>
                          </div>
                        </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(activeTab === 'settings' || mode === 'planner') && (
              <div>
                {/* Настройки карты */}
                <div className="px-7 pb-4.5 border-b border-gray-200">
                  <div
                    className={cn(
                      "text-base font-semibold cursor-pointer py-2.5 rounded-lg flex items-center transition-colors",
                      openSection === 'map' 
                        ? "bg-[#22c55e] text-white" 
                        : "bg-white text-gray-800 hover:bg-gray-100"
                    )}
                    onClick={() => setOpenSection(openSection === 'map' ? '' : 'map')}
                  >
                    <Layers className="mr-2" style={{ width: 16, height: 16, color: openSection === 'map' ? 'white' : '#22c55e' }} />
                      Настройки карты
                    <span className="ml-auto">{openSection === 'map' ? '▲' : '▼'}</span>
                  </div>
                  {openSection === 'map' && (
                    <div className="pt-2 pl-8">
                      <div className="mb-2.5">
                        <b className="text-gray-900">Вид карты:</b>
                        <select
                          value={mapType}
                          onChange={e => setMapType(e.target.value)}
                          className="ml-2 rounded-md px-2 py-0.5 border border-gray-300 bg-white text-gray-900"
                        >
                          <option value="light">Светлая</option>
                          <option value="dark">Тёмная</option>
                          <option value="satellite">Спутник</option>
                        </select>
                      </div>
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={showTraffic}
                            onChange={e => setShowTraffic(e.target.checked)}
                            className="w-4 h-4 accent-[#22c55e]"
                          />
                          Показывать пробки
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={showBikeLanes}
                            onChange={e => setShowBikeLanes(e.target.checked)}
                            className="w-4 h-4 accent-[#22c55e]"
                          />
                          Показывать велодорожки
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={showHints}
                            onChange={e => setShowHints(e.target.checked)}
                            className="w-4 h-4 accent-[#22c55e]"
                          />
                          Подсказки
                        </label>
                      </div>
                      <div className="mt-2.5">
                        <b className="text-gray-900">Цветовая схема:</b>
                        <select
                          value={themeColor}
                          onChange={e => setThemeColor(e.target.value)}
                          className="ml-2 rounded-md px-2 py-0.5 border border-gray-300 bg-white text-gray-900"
                        >
                          <option value="green">Зелёная</option>
                          <option value="blue">Синяя</option>
                          <option value="custom">Своя</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        {/* Footer с кнопками действий - стальной градиент, белые кнопки с черным текстом */}
        <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 flex flex-col items-center gap-3 py-4 rounded-b-[20px] border-t border-gray-700 shadow-inner">
            {onShowAllMarkers && (
              <div className="w-full px-5 text-left">
                <label className="flex items-center cursor-pointer font-medium text-white">
                <input
                  type="checkbox"
                  onChange={onShowAllMarkers}
                    className="mr-2 accent-[#22c55e]"
                />
                Показать все метки
              </label>
              </div>
            )}
            <div className="flex gap-3 px-5 w-full justify-center">
              <button
                onClick={handleReset}
                className="flex-1 px-4.5 py-2 border-none rounded-md cursor-pointer font-bold text-[15px] bg-white text-black hover:bg-gray-100 transition-all"
              >
                Сбросить
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-4.5 py-2 border-none rounded-md cursor-pointer font-bold text-[15px] bg-white text-black hover:bg-gray-100 transition-all"
              >
                Применить
              </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMapSettings;
