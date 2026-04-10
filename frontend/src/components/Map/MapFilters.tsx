import React, { useState } from 'react';
import './MapFilters.css';
import { GlassAccordion, GlassButton, GlassHeader } from '../Glass';
import { CATEGORIES } from '../../constants/categories';
import {
  FaCrosshairs,
  FaFire,
  FaClock,
  FaCalendarCheck,
  FaHeart,
  FaRoute,
  FaBlog,
  FaMapPin,
  FaLeaf,
  FaMap as FaMapIcon,
  FaStar,
  FaUtensils,
  FaHotel,
  FaLandmark,
  FaGem,
  FaBus,
  FaQuestion,
  FaWallet,
  FaUsers,
  FaMusic,
  FaImage,
  FaTrophy,
  FaFlag,
  FaCamera,
  FaPlane,
  FaBed
} from 'react-icons/fa';

// Основные категории для легенды карты
const LEGEND_CATEGORIES = [
  { key: "attraction", label: "Достопримечательность", icon: FaStar, color: "#3498db" },
  { key: "restaurant", label: "Ресторан", icon: FaUtensils, color: "#e74c3c" },
  { key: "hotel", label: "Отель", icon: FaHotel, color: "#8e44ad" },
  { key: "nature", label: "Природа", icon: FaLeaf, color: "#27ae60" },
  { key: "culture", label: "Культура", icon: FaLandmark, color: "#f1c40f" },
  { key: "entertainment", label: "Развлечения", icon: FaGem, color: "#f39c12" },
  { key: "transport", label: "Транспорт", icon: FaBus, color: "#16a085" },
  { key: "shopping", label: "Торговля", icon: FaWallet, color: "#e67e22" },
  { key: "healthcare", label: "Здравоохранение", icon: FaHeart, color: "#e74c3c" },
  { key: "education", label: "Образование", icon: FaUsers, color: "#3498db" },
  { key: "service", label: "Сервис", icon: FaQuestion, color: "#34495e" },
  { key: "other", label: "Другое", icon: FaQuestion, color: "#7f8c8d" },
];

// Категории событий для фильтрации
const EVENT_CATEGORIES = [
  { key: "festival", label: "Фестиваль", icon: FaFlag, color: "#d946ef" },
  { key: "concert", label: "Концерт", icon: FaMusic, color: "#6366f1" },
  { key: "exhibition", label: "Выставка", icon: FaImage, color: "#a855f7" },
  { key: "sport", label: "Спорт", icon: FaTrophy, color: "#84cc16" },
  { key: "holiday", label: "Праздник", icon: FaFlag, color: "#ec4899" },
  { key: "attractions", label: "Достопримечательности", icon: FaCamera, color: "#0ea5e9" },
  { key: "restaurants", label: "Рестораны", icon: FaUtensils, color: "#10b981" },
  { key: "transport", label: "Транспорт", icon: FaBus, color: "#8b5cf6" },
  { key: "hotels", label: "Отели", icon: FaBed, color: "#f97316" },
  { key: "flights", label: "Авиабилеты", icon: FaPlane, color: "#ef4444" },
];

const presets = [
  { key: 'nearby', label: 'Рядом со мной', icon: <FaCrosshairs /> },
  { key: 'hot', label: 'Популярное сейчас', icon: <FaFire /> },
  { key: 'new', label: 'Новое на карте', icon: <FaClock /> },
  { key: 'events', label: 'Предстоящие события', icon: <FaCalendarCheck /> },
  { key: 'interests', label: 'Мои интересы', icon: <FaHeart /> },
  { key: 'routes', label: 'Маршруты', icon: <FaRoute /> },
  { key: 'blogs', label: 'Блоги', icon: <FaBlog /> },
  { key: 'user_poi', label: 'Пользовательские метки', icon: <FaMapPin /> },
];

interface MapFiltersProps {
  filters: {
    categories: string[];
    eventCategories: string[];
    radiusOn: boolean;
    radius: number;
    preset: string | null;
  };
  onFiltersChange: (filters: MapFiltersProps['filters']) => void;
  mapSettings: {
    mapType: string;
    showTraffic: boolean;
    showBikeLanes: boolean;
    showHints: boolean;
    themeColor: string;
  };
  onMapSettingsChange: (settings: MapFiltersProps['mapSettings']) => void;
  onApply: () => void;
  onReset: () => void;
  onShowAllMarkers?: () => void;
  onClose?: () => void;
  // Новые пропсы для ленивой загрузки
  useLazyLoading?: boolean;
  onLoadingModeToggle?: (useLazy: boolean) => void;
}

export const FiltersAndSettingsCard: React.FC<MapFiltersProps> = ({
  filters, onFiltersChange, mapSettings, onMapSettingsChange, onApply, onReset, onShowAllMarkers, onClose,
  useLazyLoading = false, onLoadingModeToggle
}) => {
  // Вместо локального состояния используем пропсы
  const selectedCategories = filters.categories;
  const setSelectedCategories = (cats: string[]) => onFiltersChange({ ...filters, categories: cats });

  const selectedEventCategories = filters.eventCategories;
  const setSelectedEventCategories = (cats: string[]) => onFiltersChange({ ...filters, eventCategories: cats });

  const isRadiusOn = filters.radiusOn;
  const setIsRadiusOn = (val: boolean) => onFiltersChange({ ...filters, radiusOn: val });

  const radius = filters.radius;
  const setRadius = (val: number) => onFiltersChange({ ...filters, radius: val });

  const mapType = mapSettings.mapType;
  const setMapType = (val: string) => onMapSettingsChange({ ...mapSettings, mapType: val });

  const selectedPreset = filters.preset;
  const setSelectedPreset = (val: string | null) => onFiltersChange({ ...filters, preset: val });

  const showTraffic = mapSettings.showTraffic;
  const setShowTraffic = (val: boolean) => onMapSettingsChange({ ...mapSettings, showTraffic: val });

  const showBikeLanes = mapSettings.showBikeLanes;
  const setShowBikeLanes = (val: boolean) => onMapSettingsChange({ ...mapSettings, showBikeLanes: val });

  const showHints = mapSettings.showHints;
  const setShowHints = (val: boolean) => onMapSettingsChange({ ...mapSettings, showHints: val });

  const themeColor = mapSettings.themeColor;
  const setThemeColor = (val: string) => onMapSettingsChange({ ...mapSettings, themeColor: val });

  const [openSection, setOpenSection] = useState<string>('categories');

  return (
    <div className="map-filters-glass">
      <GlassHeader
        title="Фильтры и настройки"
        onClose={onClose}
        showCloseButton={!!onClose}
      />

      {(selectedCategories.length > 0 || selectedEventCategories.length > 0 || selectedPreset || isRadiusOn) ? (
        <div className="map-filters-selected">
          {selectedCategories.map(catKey => (
            <button key={catKey} className="chip selected">
              {LEGEND_CATEGORIES.find((cat) => cat.key === catKey)?.label || catKey}
            </button>
          ))}
          {selectedEventCategories.map(catKey => (
            <button key={`event-${catKey}`} className="chip selected" style={{ background: EVENT_CATEGORIES.find(c => c.key === catKey)?.color, color: '#fff' }}>
              {EVENT_CATEGORIES.find((cat) => cat.key === catKey)?.label || catKey}
            </button>
          ))}
          {selectedPreset && (
            <button className="chip selected">
              {presets.find(p => p.key === selectedPreset)?.label}
            </button>
          )}
          {isRadiusOn && (
            <button className="chip selected">Радиус: {radius} км</button>
          )}
        </div>
      ) : (
        <div className="map-filters-selected" style={{ color: '#bbb', fontSize: 14 }}>
          Выберите фильтры для поиска мест...
        </div>
      )}

      {/* Категории и хэштеги */}
      <GlassAccordion
        title="Категории и хэштеги"
        defaultOpen={openSection === 'categories'}
        onToggle={(isOpen) => setOpenSection(isOpen ? 'categories' : '')}
      >
            <div className="category-chips">
              {LEGEND_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={selectedCategories.includes(cat.key) ? "chip selected" : "chip"}
                  onClick={() =>
                    setSelectedCategories(selectedCategories.includes(cat.key)
                      ? selectedCategories.filter(k => k !== cat.key)
                      : [...selectedCategories, cat.key]
                    )
                  }
                >
                  <cat.icon className="category-icon" />
                  {cat.label}
                </button>
              ))}
            </div>
      </GlassAccordion>

      {/* Категории событий */}
      <GlassAccordion
        title="Категории событий"
        defaultOpen={openSection === 'eventCategories'}
        onToggle={(isOpen) => setOpenSection(isOpen ? 'eventCategories' : '')}
      >
            <div className="category-chips">
              {EVENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={selectedEventCategories.includes(cat.key) ? "chip selected" : "chip"}
                  style={{ borderColor: selectedEventCategories.includes(cat.key) ? cat.color : undefined }}
                  onClick={() =>
                    setSelectedEventCategories(selectedEventCategories.includes(cat.key)
                      ? selectedEventCategories.filter(k => k !== cat.key)
                      : [...selectedEventCategories, cat.key]
                    )
                  }
                >
                  <cat.icon className="category-icon" style={{ color: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
      </GlassAccordion>

      {/* Радиус поиска */}
      <GlassAccordion
        title="Радиус поиска"
        defaultOpen={openSection === 'radius'}
        onToggle={(isOpen) => setOpenSection(isOpen ? 'radius' : '')}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={isRadiusOn}
                onChange={e => setIsRadiusOn(e.target.checked)}
                />
                <span>Включить радиус поиска</span>
            </label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
            <input
              type="range"
              min={1}
              max={20}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              disabled={!isRadiusOn}
                  style={{ flex: 1, maxWidth: '200px', opacity: isRadiusOn ? 1 : 0.5 }}
            />
                <span style={{ minWidth: 40, textAlign: 'center', color: '#555', fontWeight: '600' }}>{radius} км</span>
          </div>
      </div>
      </GlassAccordion>

      {/* Предустановленные сценарии */}
      <GlassAccordion
        title="Предустановленные сценарии"
        defaultOpen={openSection === 'presets'}
        onToggle={(isOpen) => setOpenSection(isOpen ? 'presets' : '')}
      >
            <div className="preset-chips">
              {presets.map(preset => (
                <button
                  key={preset.key}
                  className={`chip${selectedPreset === preset.key ? ' selected' : ''}`}
                  onClick={() => setSelectedPreset(preset.key)}
                >
                  {preset.icon} {preset.label}
                </button>
              ))}
            </div>
      </GlassAccordion>

      {/* Режим загрузки маркеров */}
      {onLoadingModeToggle && (
        <GlassAccordion
          title="Режим загрузки"
          defaultOpen={openSection === 'loading'}
          onToggle={(isOpen) => setOpenSection(isOpen ? 'loading' : '')}
        >
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <input
                    type="radio"
                    name="loadingMode"
                    checked={useLazyLoading}
                    onChange={() => onLoadingModeToggle(true)}
                    style={{ marginRight: 8 }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Ленивая загрузка</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Загружаем только видимые маркеры (быстрее, меньше трафика)
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="loadingMode"
                    checked={!useLazyLoading}
                    onChange={() => onLoadingModeToggle(false)}
                    style={{ marginRight: 8 }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Полная загрузка</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Загружаем все маркеры сразу (быстрый поиск)
                    </div>
                  </div>
                </label>
              </div>
        </GlassAccordion>
      )}

      {/* Настройки карты */}
      <GlassAccordion
        title="Настройки карты"
        defaultOpen={openSection === 'map'}
        onToggle={(isOpen) => setOpenSection(isOpen ? 'map' : '')}
      >
            <div style={{ marginBottom: 10 }}>
              <b>Вид карты:</b>
              <select
                value={mapType}
                onChange={e => setMapType(e.target.value)}
                style={{ marginLeft: 8, borderRadius: 6, padding: '2px 8px' }}
              >
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
                <option value="satellite">Спутник</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showTraffic}
                  onChange={e => setShowTraffic(e.target.checked)}
                />{' '}
                Показывать пробки
              </label>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showBikeLanes}
                  onChange={e => setShowBikeLanes(e.target.checked)}
                />{' '}
                Показывать велодорожки
              </label>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={e => setShowHints(e.target.checked)}
                />{' '}
                Подсказки
              </label>
            </div>
            <div>
              <b>Цветовая схема:</b>
              <select
                value={themeColor}
                onChange={e => setThemeColor(e.target.value)}
                style={{ marginLeft: 8, borderRadius: 6, padding: '2px 8px' }}
              >
                <option value="green">Зелёная</option>
                <option value="blue">Синяя</option>
                <option value="custom">Своя</option>
              </select>
            </div>
      </GlassAccordion>

      <div className="map-filters-footer-glass" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
        {onShowAllMarkers && (
          <div className="show-all-markers-checkbox" style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                onChange={onShowAllMarkers}
                style={{ marginRight: '8px' }}
              />
              Показать все метки
            </label>
          </div>
        )}
        <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
          <GlassButton variant="secondary" onClick={onReset} fullWidth>Сбросить</GlassButton>
          <GlassButton variant="primary" onClick={onApply} fullWidth>Применить</GlassButton>
        </div>
      </div>
    </div>
  );
};

export default FiltersAndSettingsCard;
