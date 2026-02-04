import React, { useState } from 'react';
import { CalendarPlus, Settings, HelpCircle } from 'lucide-react';

interface CalendarActionButtonsProps {
  onAddEventClick: () => void;
  onSearchClick: () => void;
  onLegendClick: () => void;
}

const CalendarActionButtons: React.FC<CalendarActionButtonsProps> = ({
  onAddEventClick,
  onSearchClick,
  onLegendClick,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const buttons = [
    {
      id: 'add-event',
      icon: CalendarPlus,
      label: 'Добавить событие',
      onClick: onAddEventClick,
    },
    {
      id: 'search-events',
      icon: Settings,
      label: 'Поиск и настройки событий',
      onClick: onSearchClick,
    },
    {
      id: 'legend',
      icon: HelpCircle,
      label: 'Легенда календаря',
      onClick: onLegendClick,
    },
  ];

  return (
    <div className="calendar-action-buttons-container" role="toolbar" aria-label="Действия календаря">
      {buttons.map(({ id, icon: Icon, label, onClick }) => (
        <div
          key={id}
          className="calendar-action-button-wrapper"
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            type="button"
            className="btn btn-glass btn-circle"
            onClick={onClick}
            aria-label={label}
          >
            <Icon size={20} />
          </button>
          {hovered === id && <div className="calendar-action-tooltip">{label}</div>}
        </div>
      ))}
    </div>
  );
};

export default CalendarActionButtons;

