import React from 'react';

export type ContentType = 'map' | 'calendar' | 'planner' | 'chat' | 'feed' | 'posts';

interface ContentSelectorProps {
  position: 'left' | 'right';
  currentContent: ContentType;
  onSelect: (content: ContentType) => void;
}

const ContentSelector: React.FC<ContentSelectorProps> = ({
  position,
  currentContent,
  onSelect,
}) => {
  // Определяем, какие опции доступны для каждой колонки
  const options: { value: ContentType; label: string; icon: string }[] =
    position === 'left'
      ? [
          { value: 'map', label: 'Карта', icon: 'fa-map-location-dot' },
          { value: 'calendar', label: 'Календарь', icon: 'fa-calendar' },
          { value: 'planner', label: 'Планировщик', icon: 'fa-route' },
        ]
      : [
          { value: 'chat', label: 'Чат', icon: 'fa-comments' },
          { value: 'feed', label: 'Лента', icon: 'fa-stream' },
          { value: 'posts', label: 'Посты', icon: 'fa-edit' },
        ];

  return (
    <div className="flex gap-2 p-2 bg-white rounded-lg shadow-soft">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
            currentContent === option.value
              ? 'bg-primary text-white'
              : 'hover:bg-light-gray text-gray-600'
          }`}
        >
          <i className={`fas ${option.icon} mr-2`}></i>
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default ContentSelector; 