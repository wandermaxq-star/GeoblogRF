import React, { useState, useEffect } from 'react';
import { ROUTE_CATEGORIES, getCategoryById, checkCategoryLimit, getRemainingRoutes } from '../../types/routeCategories';
import { FavoriteRoute } from '../../contexts/FavoritesContext';

interface RouteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (routeData: RouteCreationData) => void;
  routeTitle: string;
  pointsCount: number;
  existingRoutes: FavoriteRoute[];
  isVip: boolean;
  onTitleChange?: (newTitle: string) => void;
}

export interface RouteCreationData {
  title: string;
  description?: string;
  category: string;
  purpose: 'personal' | 'post' | 'event';
  tags: string[];
  visibility: 'private' | 'public' | 'friends';
  isTemplate: boolean;
}

const RouteCategoryModal: React.FC<RouteCategoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  routeTitle,
  pointsCount,
  existingRoutes,
  isVip,
  onTitleChange
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('personal');
  const [title, setTitle] = useState<string>(routeTitle);
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState<string>('');
  const [visibility, setVisibility] = useState<'private' | 'public' | 'friends'>('private');
  const [isTemplate, setIsTemplate] = useState<boolean>(false);

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setTitle(routeTitle);
      setSelectedCategory('personal');
      setDescription('');
      setTags([]);
      setNewTag('');
      setVisibility('private');
      setIsTemplate(false);
    }
  }, [isOpen, routeTitle]);

  const handleConfirm = () => {
    const category = getCategoryById(selectedCategory);
    if (!category) return;

    // Если пользователь не ввел название, используем "Новый маршрут" вместо даты
    const finalTitle = title.trim() || 'Новый маршрут';
    
    const purposeValue: RouteCreationData['purpose'] = ['personal','post','event'].includes(category.purpose as any) ? category.purpose as RouteCreationData['purpose'] : 'personal';
    const routeData: RouteCreationData = {
      title: finalTitle,
      description: description.trim() || undefined,
      category: selectedCategory,
      purpose: purposeValue,
      tags: tags,
      visibility,
      isTemplate
    };

    console.log('RouteCategoryModal - creating route with title:', finalTitle);
    onConfirm(routeData);
    onClose();
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Подсчет маршрутов по категориям
  const getRoutesCountByCategory = (categoryId: string) => {
    return existingRoutes.filter(route => route.category === categoryId).length;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Настройка маршрута</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Информация о маршруте */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Информация о маршруте</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">
              Название маршрута
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onTitleChange?.(e.target.value);
              }}
              className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите название маршрута..."
            />
          </div>
          <p className="text-blue-700">
            <strong>Точек:</strong> {pointsCount}
          </p>
        </div>

        {/* Выбор категории */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Выберите категорию</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ROUTE_CATEGORIES.map(category => {
              const routesCount = getRoutesCountByCategory(category.id);
              const remaining = getRemainingRoutes(category.id, routesCount, isVip);
              const isLimitReached = !checkCategoryLimit(category.id, routesCount, isVip);
              
              return (
                <div
                  key={category.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedCategory === category.id
                      ? 'border-blue-500 bg-blue-50'
                      : isLimitReached
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => !isLimitReached && setSelectedCategory(category.id)}
                >
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">{category.icon}</span>
                    <div>
                      <h4 className="font-semibold text-gray-800">{category.name}</h4>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {routesCount}/{category.maxRoutes * (isVip ? 3 : 1)} маршрутов
                    {isLimitReached && <span className="text-red-500 ml-2">(Лимит достигнут)</span>}
                    {!isLimitReached && remaining > 0 && (
                      <span className="text-green-600 ml-2">(Осталось: {remaining})</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Описание */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Описание маршрута (необязательно)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Опишите особенности маршрута, что интересного можно увидеть..."
          />
        </div>

        {/* Теги */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Теги для поиска
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Добавить тег..."
            />
            <button
              onClick={handleAddTag}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Добавить
            </button>
          </div>
        </div>


        {/* Дополнительные опции */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="mr-3"
            />
            <span className="text-sm font-medium text-gray-700">
              📋 Сделать шаблоном (можно копировать для других маршрутов)
            </span>
          </label>
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Создать маршрут
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteCategoryModal;
