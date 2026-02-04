import React, { useState } from 'react';
import { FaTimes, FaCheck, FaEye, FaEyeSlash, FaUsers, FaGlobe, FaLock, FaBook, FaEdit, FaCalendarAlt, FaShareAlt, FaFileAlt } from 'react-icons/fa';

interface CategoryOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  purpose: 'personal' | 'post' | 'event' | 'shared' | 'draft';
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'personal',
    name: 'Личная коллекция',
    description: 'Для личного использования',
    icon: <FaBook className="text-gray-600" size={20} />,
    color: 'blue',
    purpose: 'personal'
  },

  {
    id: 'post',
    name: 'Для поста',
    description: 'Маршрут для публикации в посте',
    icon: <FaEdit className="text-gray-600" size={20} />,
    color: 'purple',
    purpose: 'post'
  },
  {
    id: 'event',
    name: 'Для события',
    description: 'Маршрут для мероприятия',
    icon: <FaCalendarAlt className="text-gray-600" size={20} />,
    color: 'purple',
    purpose: 'event'
  },
  {
    id: 'draft',
    name: 'Черновик',
    description: 'Сохранить как черновик',
    icon: <FaFileAlt className="text-gray-600" size={20} />,
    color: 'gray',
    purpose: 'draft'
  }
];

interface RouteCategorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (category: CategoryOption, visibility: 'private' | 'public' | 'friends') => void;
  routeTitle: string;
  pointsCount: number;
}

const RouteCategorySelector: React.FC<RouteCategorySelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  routeTitle,
  pointsCount
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public' | 'friends'>('private');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedCategory) {
      onSelect(selectedCategory, visibility);
    }
  };

  const getVisibilityIcon = (type: string) => {
    switch (type) {
      case 'private': return <FaLock className="text-gray-500" />;
      case 'public': return <FaGlobe className="text-blue-500" />;
      case 'friends': return <FaUsers className="text-green-500" />;
      default: return <FaLock className="text-gray-500" />;
    }
  };

  const getVisibilityLabel = (type: string) => {
    switch (type) {
      case 'private': return 'Приватный';
      case 'public': return 'Публичный';
      case 'friends': return 'Для друзей';
      default: return 'Приватный';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Создать маршрут</h2>
              <p className="text-blue-100 text-sm mt-1">
                {routeTitle} • {pointsCount} точек
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="p-6">
          {/* Выбор категории */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Выберите раздел</h3>
            <div className="space-y-2">
              {CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedCategory?.id === category.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-2">
                      {category.icon}
                    </div>
                    <h4 className="font-semibold text-gray-800 text-base">{category.name}</h4>
                    {selectedCategory?.id === category.id && (
                      <div className="mt-1">
                        <FaCheck className="text-blue-500 mx-auto" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>


          {/* Кнопки действий */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCategory}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteCategorySelector;
