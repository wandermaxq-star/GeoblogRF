import { useState } from 'react';

interface PresetDropdownProps {
  onPresetSelect: (key: string) => void;
  activePreset: string | null;
}

const presets = [
  { key: 'all', label: 'Все метки', icon: 'fa-map-marker-alt' },
  { key: 'events', label: 'События', icon: 'fa-calendar-check' },
  { key: 'posts', label: 'Посты', icon: 'fa-edit' },
  { key: 'routes', label: 'Маршруты', icon: 'fa-route' },
  { key: 'user_poi', label: 'Пользовательские', icon: 'fa-map-pin' },
  { key: 'chat_rooms', label: 'Активные чаты', icon: 'fa-comments' },
  { key: 'hot', label: 'Популярное', icon: 'fa-fire' },
  { key: 'new', label: 'Новое', icon: 'fa-clock' },
  { key: 'nearby', label: 'Рядом со мной', icon: 'fa-crosshairs' },
  { key: 'interests', label: 'Мои интересы', icon: 'fa-heart' },
];

export default function PresetDropdown({ onPresetSelect, activePreset }: PresetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-gradient-to-r from-blue-400 to-blue-600 text-white font-semibold px-6 h-12 flex items-center justify-center rounded-lg shadow hover:from-blue-500 hover:to-blue-700 transition-all duration-200 w-52"
      >
        <i className="fas fa-layer-group mr-2"></i> Слои
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          {presets.map((preset) => (
            <button
              key={preset.key}
              className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${
                activePreset === preset.key ? 'bg-blue-100 font-bold' : ''
              }`}
              onClick={() => {
                onPresetSelect(preset.key);
                setIsOpen(false);
              }}
            >
              <i className={`fas ${preset.icon}`}></i> {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
