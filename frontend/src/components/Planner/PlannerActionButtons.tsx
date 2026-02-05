import React, { useState } from 'react';
import { Settings, Heart, Layers, Trash2, Save } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/use-mobile';
import './PlannerActionButtons.css';

interface PlannerActionButtonsProps {
  onSettingsClick: () => void;
  onFavoritesClick: () => void;
  favoritesCount: number;
  onLayersClick: () => void;
  showZonesLayer: boolean;
  onClearMapClick: () => void;
  onSaveRouteClick: () => void;
  markersCount: number;
  hasMarkersOrRoutes: boolean;
  /** Двухоконный режим - кнопки должны быть слева от постов */
  isTwoPanelMode?: boolean;
}

const PlannerActionButtons: React.FC<PlannerActionButtonsProps> = ({
  onSettingsClick,
  onFavoritesClick,
  favoritesCount,
  onLayersClick,
  showZonesLayer,
  onClearMapClick,
  onSaveRouteClick,
  markersCount,
  hasMarkersOrRoutes,
  isTwoPanelMode = false,
}) => {
  const { isDarkMode } = useTheme();
  // const isMobile = useIsMobile();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // if (isMobile) return null;

  // const isMobile = useIsMobile();
  const buttons = [
    {
      id: 'settings',
      icon: Settings,
      label: 'Настройки планировщика',
      onClick: onSettingsClick,
      ariaLabel: 'Открыть настройки планировщика',
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
      id: 'layers',
      icon: Layers,
      label: showZonesLayer ? 'Скрыть зоны' : 'Показать зоны',
      onClick: onLayersClick,
      ariaLabel: showZonesLayer ? 'Скрыть зоны' : 'Показать зоны',
      isActive: showZonesLayer,
    },
  ];

  // Динамически добавляем кнопки в зависимости от состояния
  if (hasMarkersOrRoutes) {
    buttons.push({
      id: 'clear',
      icon: Trash2,
      label: 'Очистить карту',
      onClick: onClearMapClick,
      ariaLabel: 'Очистить карту',
    });
  }

  if (markersCount >= 2) {
    buttons.push({
      id: 'save',
      icon: Save,
      label: 'Сохранить маршрут',
      onClick: onSaveRouteClick,
      ariaLabel: 'Сохранить маршрут',
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
  // Центр = 64px + (100vh - 64px) / 2
  return (
    <div
      className={`planner-action-buttons-container ${isDarkMode ? 'dark' : ''} ${isTwoPanelMode ? 'two-panel-mode' : ''}`}
      role="toolbar"
      aria-label="Действия планировщика"
      style={isTwoPanelMode ? {
        position: 'fixed', // Фиксированное позиционирование относительно viewport
        right: 'calc(50% + 12px)', // Прижимаем к панели постов
        // Центр области контента: topbar=64px, bottom=0px
        top: 'calc(64px + (100vh - 64px) / 2)',
        transform: 'translateY(-50%)', // Центрируем по вертикали
        transition: 'right 0.3s ease-in-out'
      } : undefined}
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        const isHovered = hoveredButton === button.id;
        const isActive = button.isActive || false;

        return (
          <div
            key={button.id}
            className="planner-action-button-wrapper"
            onMouseEnter={() => setHoveredButton(button.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              className={`planner-action-button ${isDarkMode ? 'dark' : ''} ${isActive ? 'active' : ''}`}
              onClick={button.onClick}
              onKeyDown={(e) => handleKeyDown(e, button.onClick)}
              aria-label={button.ariaLabel}
              role="button"
              tabIndex={0}
            >
              <Icon size={20} />
              {button.badge && (
                <span className="planner-action-badge" aria-label={`${favoritesCount} избранных мест`}>
                  {button.badge}
                </span>
              )}
            </button>
            {isHovered && (
              <div className="planner-action-tooltip" role="tooltip">
                {button.label}
                {button.badge && ` (${button.badge})`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PlannerActionButtons;
