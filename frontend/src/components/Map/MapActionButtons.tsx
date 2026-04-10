import React, { useState } from 'react';
import { Settings, Info, Plus, Search, Navigation, Crosshair, MapPin, LucideIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MapActionButtonsProps {
  onSettingsClick: () => void;
  onLegendClick: () => void;
  /** Единая кнопка добавления — открывает MapAddSelector */
  onAddClick: () => void;
  /** Активен если выбран режим добавления (метка или событие) */
  isAddingMode: boolean;
  onSearchClick?: () => void;
  onRecordTrackClick?: () => void;
  isRecording?: boolean;
  /** Двухоконный режим - кнопки должны быть слева от постов */
  isTwoPanelMode?: boolean;
  /** Режим геолокации */
  locationMode?: 'auto' | 'manual';
  onLocationModeToggle?: () => void;
}

const MapActionButtons: React.FC<MapActionButtonsProps> = ({
  onSettingsClick,
  onLegendClick,
  onAddClick,
  isAddingMode,
  onSearchClick,
  onRecordTrackClick,
  isRecording,
  isTwoPanelMode = false,
  locationMode = 'auto',
  onLocationModeToggle,
}) => {
  const { isDarkMode } = useTheme();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const buttons: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    ariaLabel: string;
    isActive?: boolean;
    isPrimary?: boolean;
  }> = [
    // Кнопка геолокации - всегда первая
    {
      id: 'location',
      icon: locationMode === 'auto' ? Crosshair : MapPin,
      label: locationMode === 'auto' ? 'Геолокация включена' : 'Ручной режим',
      onClick: onLocationModeToggle ?? (() => { }),
      ariaLabel: locationMode === 'auto' ? 'Отключить геолокацию' : 'Включить геолокацию',
      isActive: locationMode === 'auto',
      isPrimary: true,
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Настройки карты',
      onClick: onSettingsClick,
      ariaLabel: 'Открыть настройки карты',
    },
    {
      id: 'legend',
      icon: Info,
      label: 'Легенда карты',
      onClick: onLegendClick,
      ariaLabel: 'Открыть легенду карты',
    },
    {
      id: 'add',
      icon: Plus,
      label: isAddingMode ? 'Отменить добавление' : 'Добавить метку или событие',
      onClick: onAddClick,
      ariaLabel: 'Добавить метку или событие',
      isActive: isAddingMode,
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

  return (
    <div
      className={`map-action-buttons-container ${isDarkMode ? 'dark' : ''} ${isTwoPanelMode ? 'two-panel-mode' : ''}`}
      role="toolbar"
      aria-label="Действия на карте"
      style={{ pointerEvents: 'none' }}
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        const isActive = button.isActive || false;
        const isHovered = hoveredButton === button.id;
        const isPrimary = button.isPrimary || false;

        return (
          <div
            key={button.id}
            className="map-action-button-wrapper"
            onMouseEnter={() => setHoveredButton(button.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              className={`btn btn-glass btn-circle ${isDarkMode ? 'btn-dark' : ''} ${isActive ? 'btn-active' : ''} ${isPrimary && isActive ? 'btn-primary-active' : ''}`}
              onClick={button.onClick}
              onKeyDown={(e) => handleKeyDown(e, button.onClick)}
              aria-label={button.ariaLabel}
              role="button"
              tabIndex={0}
            >
              <Icon size={20} />
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

