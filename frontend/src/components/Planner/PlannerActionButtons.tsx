import React, { useState } from 'react';
import { Settings, MapPin, Trash2, Save, Edit3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import './PlannerActionButtons.css';

interface PlannerActionButtonsProps {
  onSettingsClick: () => void;
  onLayersClick: () => void;
  showZonesLayer: boolean;
  onClearMapClick: () => void;
  onSaveRouteClick: () => void;
  onEditRouteClick: () => void;
  isRouteEditing?: boolean;
  markersCount: number;
  hasMarkersOrRoutes: boolean;
  /** Двухоконный режим - кнопки должны быть слева от постов */
  isTwoPanelMode?: boolean;
}

const PlannerActionButtons: React.FC<PlannerActionButtonsProps> = ({
  onSettingsClick,
  onLayersClick,
  showZonesLayer,
  onClearMapClick,
  onSaveRouteClick,
  onEditRouteClick,
  isRouteEditing = false,
  markersCount,
  hasMarkersOrRoutes,
  isTwoPanelMode = false,
}) => {
  const { isDarkMode } = useTheme();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, onClick: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const staticButtons = [
    {
      id: 'settings',
      icon: Settings,
      label: 'Настройки планировщика',
      onClick: onSettingsClick,
      ariaLabel: 'Открыть настройки планировщика',
      isActive: false,
    },
    {
      id: 'layers',
      icon: MapPin,
      label: showZonesLayer ? 'Скрыть зоны' : 'Показать зоны',
      onClick: onLayersClick,
      ariaLabel: showZonesLayer ? 'Скрыть зоны' : 'Показать зоны',
      isActive: showZonesLayer,
    },
  ];

  const dynamicButtons = [];
  if (hasMarkersOrRoutes) {
    dynamicButtons.push({
      id: 'clear',
      icon: Trash2,
      label: 'Очистить карту',
      onClick: onClearMapClick,
      ariaLabel: 'Очистить карту',
      isActive: false,
    });
  }
  if (markersCount >= 2) {
    dynamicButtons.push({
      id: 'edit',
      icon: Edit3,
      label: isRouteEditing ? 'Выключить редактирование' : 'Редактировать маршрут',
      onClick: onEditRouteClick,
      ariaLabel: isRouteEditing ? 'Выключить редактирование маршрута' : 'Редактировать маршрут',
      isActive: isRouteEditing ?? false,
    });
    dynamicButtons.push({
      id: 'save',
      icon: Save,
      label: 'Сохранить маршрут',
      onClick: onSaveRouteClick,
      ariaLabel: 'Сохранить маршрут',
      isActive: false,
    });
  }

  const allButtons = [...staticButtons, ...dynamicButtons];

  return (
    <div
      className={`planner-action-buttons-container ${isDarkMode ? 'dark' : ''} ${isTwoPanelMode ? 'two-panel-mode' : ''}`}
      role="toolbar"
      aria-label="Действия планировщика"
      style={isTwoPanelMode ? {
        position: 'fixed',
        right: 'calc(50% + 12px)',
        top: 'calc(64px + (100vh - 64px) / 2)',
        transform: 'translateY(-50%)',
        transition: 'right 0.3s ease-in-out',
      } : undefined}
    >
      {allButtons.map((button) => {
        const Icon = button.icon;
        const isHovered = hoveredButton === button.id;

        return (
          <div
            key={button.id}
            className="planner-action-button-wrapper"
            onMouseEnter={() => setHoveredButton(button.id)}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <button
              className={`planner-action-button ${isDarkMode ? 'dark' : ''} ${button.isActive ? 'active' : ''}`}
              onClick={button.onClick}
              onKeyDown={(e) => handleKeyDown(e, button.onClick)}
              aria-label={button.ariaLabel}
              role="button"
              tabIndex={0}
            >
              <Icon size={20} />
            </button>
            {isHovered && (
              <div className="planner-action-tooltip" role="tooltip">
                {button.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PlannerActionButtons;
