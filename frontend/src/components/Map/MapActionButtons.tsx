import React, { useState } from 'react';
import { Settings, Heart, Layers, MapPin, Search, Navigation } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MapActionButtonsProps {
  onSettingsClick: () => void;
  onFavoritesClick: () => void;
  favoritesCount: number;
  onLegendClick: () => void;
  onAddMarkerClick: () => void;
  isAddingMarkerMode: boolean;
  onSearchClick?: () => void;
  onRecordTrackClick?: () => void;
  isRecording?: boolean;
  /** Двухоконный режим - кнопки должны быть слева от постов */
  isTwoPanelMode?: boolean;
}

const MapActionButtons: React.FC<MapActionButtonsProps> = ({
  onSettingsClick,
  onFavoritesClick,
  favoritesCount,
  onLegendClick,
  onAddMarkerClick,
  isAddingMarkerMode,
  onSearchClick,
  onRecordTrackClick,
  isRecording,
  isTwoPanelMode = false,
}) => {
  const { isDarkMode } = useTheme();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const buttons = [
    {
      id: 'settings',
      icon: Settings,
      label: 'Настройки карты',
      onClick: onSettingsClick,
      ariaLabel: 'Открыть настройки карты',
    },
    {
      id: 'favorites',
      icon: Heart,
      label: 'Избранное',
      onClick: onFavoritesClick,
      ariaLabel: 'Открыть избранное',
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    {
      id: 'legend',
      icon: Layers,
      label: 'Легенда карты',
      onClick: onLegendClick,
      ariaLabel: 'Открыть легенду карты',
    },
    {
      id: 'add-marker',
      icon: MapPin,
      label: 'Добавить метку на карту',
      onClick: onAddMarkerClick,
      ariaLabel: 'Добавить метку на карту',
      isActive: isAddingMarkerMode,
    },
    {
      id: 'record-track',
      icon: Navigation,
      label: isRecording ? 'Остановить запись трека' : 'Записать трек',
      onClick: onRecordTrackClick ?? (() => { }),
      ariaLabel: 'Записать GPS-трек',
      isActive: isRecording,
    },
  ];

  // Добавляем поиск, если передан обработчик
  if (onSearchClick) {
    buttons.push({
      id: 'search',
      icon: Search,
      label: 'Поиск мест или меток',
      onClick: onSearchClick,
      ariaLabel: 'Открыть поиск',
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent, onClick: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Расчёт центра области контента постов:
  // Панель постов: top: 64px (под topbar), bottom: 0px
  // Центр контента = 64px + (100vh - 64px) / 2
  // = 64px + 50vh - 32px = 50vh + 32px
  // Но так как transform: translateY(-50%) центрирует элемент,
  // нам нужен центр области = 64 + (высота области / 2)
  return (
    <div
      className={`map-action-buttons-container ${isDarkMode ? 'dark' : ''} ${isTwoPanelMode ? 'two-panel-mode' : ''}`}
      role="toolbar"
      aria-label="Действия на карте"
      style={isTwoPanelMode ? {
        position: 'fixed', // Фиксированное позиционирование относительно viewport
        right: 'calc(50% + 12px)', // Прижимаем к панели постов
        // Центр области контента: topbar=64px, bottom=0px
        // top = 64px + (100vh - 64px) / 2 = 64px + 50vh - 32px = 50vh + 32px
        top: 'calc(64px + (100vh - 64px) / 2)',
        transform: 'translateY(-50%)', // Центрируем по вертикали
        transition: 'right 0.3s ease-in-out'
      } : undefined}
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        const isActive = button.isActive || false;
        const isHovered = hoveredButton === button.id;

        return (
          <div
            key={button.id}
            className="map-action-button-wrapper"
            onMouseEnter={() => setHoveredButton(button.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              className={`btn btn-glass btn-circle ${isDarkMode ? 'btn-dark' : ''} ${isActive ? 'btn-active' : ''}`}
              onClick={button.onClick}
              onKeyDown={(e) => handleKeyDown(e, button.onClick)}
              aria-label={button.ariaLabel}
              role="button"
              tabIndex={0}
            >
              <Icon size={20} />
              {button.badge && (
                <span className="btn-badge" aria-label={`${favoritesCount} избранных мест`}>
                  {button.badge}
                </span>
              )}
            </button>
            {isHovered && (
              <div className="map-action-tooltip" role="tooltip">
                {button.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MapActionButtons;


