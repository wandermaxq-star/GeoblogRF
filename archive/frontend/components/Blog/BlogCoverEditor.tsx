import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Palette, Type, Save, RotateCcw } from 'lucide-react';

interface BlogCoverEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (coverData: BlogCoverData) => void;
  initialData?: BlogCoverData;
}

interface BlogCoverData {
  title: string;
  description: string;
  gradient: string;
  textColor: string;
  titleFont: string;
  descriptionFont: string;
}

const BlogCoverEditor: React.FC<BlogCoverEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [coverData, setCoverData] = useState<BlogCoverData>({
    title: initialData?.title || 'Название блога',
    description: initialData?.description || 'Краткое описание блога',
    gradient: initialData?.gradient || 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    textColor: initialData?.textColor || '#FFFFFF',
    titleFont: initialData?.titleFont || 'bold',
    descriptionFont: initialData?.descriptionFont || 'normal'
  });

  const [activeTab, setActiveTab] = useState<'design' | 'text'>('design');

  // Предустановленные градиенты
  const gradients = [
    { name: 'Фиолетовый', value: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
    { name: 'Синий', value: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
    { name: 'Зеленый', value: 'linear-gradient(135deg, #10B981, #059669)' },
    { name: 'Розовый', value: 'linear-gradient(135deg, #EC4899, #DB2777)' },
    { name: 'Оранжевый', value: 'linear-gradient(135deg, #F59E0B, #D97706)' },
    { name: 'Красный', value: 'linear-gradient(135deg, #EF4444, #DC2626)' },
    { name: 'Серый', value: 'linear-gradient(135deg, #6B7280, #4B5563)' },
    { name: 'Темный', value: 'linear-gradient(135deg, #374151, #1F2937)' }
  ];

  const textColors = [
    { name: 'Белый', value: '#FFFFFF' },
    { name: 'Черный', value: '#000000' },
    { name: 'Серый', value: '#6B7280' },
    { name: 'Светло-серый', value: '#D1D5DB' }
  ];

  const fonts = [
    { name: 'Обычный', value: 'normal' },
    { name: 'Жирный', value: 'bold' },
    { name: 'Тонкий', value: '300' }
  ];

  const updateCoverData = (field: keyof BlogCoverData, value: string) => {
    setCoverData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(coverData);
    onClose();
  };

  const handleReset = () => {
    setCoverData({
      title: 'Название блога',
      description: 'Краткое описание блога',
      gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      textColor: '#FFFFFF',
      titleFont: 'bold',
      descriptionFont: 'normal'
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden"
      >
        {/* Левая панель - редактор */}
        <div className="w-1/3 bg-gray-50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Редактор обложки блога</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Вкладки */}
          <div className="flex mb-6 bg-white rounded-lg p-1">
            <button
              onClick={() => setActiveTab('design')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                activeTab === 'design' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Palette className="w-4 h-4" />
              Дизайн
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                activeTab === 'text' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Type className="w-4 h-4" />
              Текст
            </button>
          </div>

          {/* Содержимое вкладок */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'design' && (
              <div className="space-y-6">
                {/* Градиенты */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Цветовая схема</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {gradients.map((gradient) => (
                      <button
                        key={gradient.value}
                        onClick={() => updateCoverData('gradient', gradient.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          coverData.gradient === gradient.value
                            ? 'border-indigo-500 ring-2 ring-indigo-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="w-full h-8 rounded mb-2"
                          style={{ background: gradient.value }}
                        />
                        <span className="text-xs text-gray-600">{gradient.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Цвет текста */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Цвет текста</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {textColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => updateCoverData('textColor', color.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          coverData.textColor === color.value
                            ? 'border-indigo-500 ring-2 ring-indigo-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="w-full h-6 rounded mb-2"
                          style={{ backgroundColor: color.value }}
                        />
                        <span className="text-xs text-gray-600">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-6">
                {/* Название */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Название блога
                  </label>
                  <input
                    type="text"
                    value={coverData.title}
                    onChange={(e) => updateCoverData('title', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Введите название блога"
                  />
                </div>

                {/* Описание */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={coverData.description}
                    onChange={(e) => updateCoverData('description', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-20 resize-none"
                    placeholder="Краткое описание блога"
                  />
                </div>

                {/* Шрифт названия */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Шрифт названия
                  </label>
                  <select
                    value={coverData.titleFont}
                    onChange={(e) => updateCoverData('titleFont', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {fonts.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Шрифт описания */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Шрифт описания
                  </label>
                  <select
                    value={coverData.descriptionFont}
                    onChange={(e) => updateCoverData('descriptionFont', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {fonts.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>

        {/* Правая панель - превью */}
        <div className="flex-1 p-6 flex items-center justify-center bg-gray-100">
          <div className="w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">Превью</h3>
            
            {/* Превью карточки */}
            <div 
              className="relative w-full h-48 rounded-lg overflow-hidden shadow-lg"
              style={{ background: coverData.gradient }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <h3 
                  className="text-lg font-bold text-center leading-tight mb-3"
                  style={{ 
                    color: coverData.textColor,
                    fontWeight: coverData.titleFont
                  }}
                >
                  {coverData.title}
                </h3>
                
                <p 
                  className="text-sm text-center opacity-90"
                  style={{ 
                    color: coverData.textColor,
                    fontWeight: coverData.descriptionFont
                  }}
                >
                  {coverData.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BlogCoverEditor;
