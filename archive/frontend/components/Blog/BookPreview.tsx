import React, { useState } from 'react';
import DynamicBookTemplate from './DynamicBookTemplate';
import { Palette, Type, Eye } from 'lucide-react';

interface BookPreviewProps {
  title: string;
  author: string;
  coverColor: string;
  spineColor: string;
  borderColor: string;
  cornerColor: string;
  textColor: string;
  onColorChange: (type: 'cover' | 'spine' | 'border' | 'corner' | 'text', color: string) => void;
  className?: string;
}

const BookPreview: React.FC<BookPreviewProps> = ({
  title,
  author,
  coverColor,
  spineColor,
  borderColor,
  cornerColor,
  textColor,
  onColorChange,
  className = ""
}) => {
  const [showColorPicker, setShowColorPicker] = useState<'cover' | 'spine' | 'border' | 'corner' | 'text' | null>(null);

  const predefinedColors = [
    { name: 'Классический', cover: '#92400e', spine: '#8b4513', border: '#8b4513', corner: '#fbbf24', text: '#ffffff' },
    { name: 'Синий', cover: '#1e40af', spine: '#1e3a8a', border: '#1e3a8a', corner: '#3b82f6', text: '#ffffff' },
    { name: 'Зеленый', cover: '#166534', spine: '#14532d', border: '#14532d', corner: '#22c55e', text: '#ffffff' },
    { name: 'Красный', cover: '#991b1b', spine: '#7f1d1d', border: '#7f1d1d', corner: '#ef4444', text: '#ffffff' },
    { name: 'Фиолетовый', cover: '#7c2d12', spine: '#581c87', border: '#581c87', corner: '#a855f7', text: '#ffffff' },
    { name: 'Серый', cover: '#374151', spine: '#1f2937', border: '#1f2937', corner: '#6b7280', text: '#ffffff' },
    { name: 'Черный', cover: '#000000', spine: '#111827', border: '#111827', corner: '#374151', text: '#ffffff' },
    { name: 'Белый', cover: '#f8fafc', spine: '#e2e8f0', border: '#e2e8f0', corner: '#cbd5e1', text: '#1f2937' }
  ];

  return (
    <div className={`bg-white rounded-lg p-6 shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Предпросмотр книги
        </h3>
        <button
          onClick={() => setShowColorPicker(showColorPicker ? null : 'cover')}
          className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Palette className="w-4 h-4" />
          Настроить
        </button>
      </div>

      <div className="flex gap-6">
        {/* Предпросмотр книги */}
        <div className="flex-shrink-0">
          <DynamicBookTemplate
            title={title}
            author={author}
            coverColor={coverColor}
            spineColor={spineColor}
            borderColor={borderColor}
            cornerColor={cornerColor}
            textColor={textColor}
            width={200}
            height={240}
            isInteractive={false}
          />
        </div>

        {/* Настройки цветов */}
        {showColorPicker && (
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Быстрые стили</h4>
              <div className="grid grid-cols-2 gap-2">
                {predefinedColors.map((style, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onColorChange('cover', style.cover);
                      onColorChange('spine', style.spine);
                      onColorChange('border', style.border);
                      onColorChange('corner', style.corner);
                      onColorChange('text', style.text);
                    }}
                    className="p-2 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет обложки
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={coverColor}
                    onChange={(e) => onColorChange('cover', e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={coverColor}
                    onChange={(e) => onColorChange('cover', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="#92400e"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет корешка
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={spineColor}
                    onChange={(e) => onColorChange('spine', e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={spineColor}
                    onChange={(e) => onColorChange('spine', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="#f59e0b"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет окантовки
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => onColorChange('border', e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => onColorChange('border', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="#8b4513"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет уголков
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cornerColor}
                    onChange={(e) => onColorChange('corner', e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cornerColor}
                    onChange={(e) => onColorChange('corner', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="#fbbf24"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет текста
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => onColorChange('text', e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => onColorChange('text', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookPreview;