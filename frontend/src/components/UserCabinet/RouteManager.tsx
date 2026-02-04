import React, { useState } from 'react';
import { FaEdit, FaTrash, FaEye, FaEyeSlash, FaUsers, FaGlobe, FaLock, FaArrowRight, FaSearch, FaFilter, FaBook, FaCalendarAlt, FaShareAlt, FaFileAlt } from 'react-icons/fa';

interface Route {
  id: string;
  title: string;
  description?: string;
  category: string;
  visibility: 'private' | 'public' | 'friends';
  pointsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RouteManagerProps {
  routes: Route[];
  onEditRoute: (route: Route) => void;
  onDeleteRoute: (routeId: string) => void;
  onTransferRoute: (routeId: string, newCategory: string) => void;
  onChangeVisibility: (routeId: string, visibility: 'private' | 'public' | 'friends') => void;
}

const CATEGORIES = [
  { id: 'personal', name: 'Личная коллекция', icon: <FaBook className="text-gray-600" size={16} />, color: 'blue' },
  { id: 'post', name: 'Для поста', icon: <FaEdit className="text-gray-600" size={16} />, color: 'purple' },
  { id: 'event', name: 'Для события', icon: <FaCalendarAlt className="text-gray-600" size={16} />, color: 'purple' },
  { id: 'draft', name: 'Черновик', icon: <FaFileAlt className="text-gray-600" size={16} />, color: 'gray' }
];

const RouteManager: React.FC<RouteManagerProps> = ({
  routes,
  onEditRoute,
  onDeleteRoute,
  onTransferRoute,
  onChangeVisibility
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVisibility, setSelectedVisibility] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt'>('updatedAt');

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'private': return <FaLock className="text-gray-500" />;
      case 'public': return <FaGlobe className="text-blue-500" />;
      case 'friends': return <FaUsers className="text-green-500" />;
      default: return <FaLock className="text-gray-500" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'private': return 'Приватный';
      case 'public': return 'Публичный';
      case 'friends': return 'Для друзей';
      default: return 'Приватный';
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(cat => cat.id === categoryId) || CATEGORIES[0];
  };

  const filteredRoutes = routes.filter(route => {
    const matchesSearch = route.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         route.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || route.category === selectedCategory;
    const matchesVisibility = selectedVisibility === 'all' || route.visibility === selectedVisibility;
    
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updatedAt':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Управление маршрутами</h2>
        <div className="text-sm text-gray-500">
          {sortedRoutes.length} из {routes.length} маршрутов
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Поиск */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск маршрутов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Фильтр по категории */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Все категории</option>
            {CATEGORIES.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {/* Фильтр по видимости */}
          <select
            value={selectedVisibility}
            onChange={(e) => setSelectedVisibility(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Вся видимость</option>
            <option value="private">Приватные</option>
            <option value="friends">Для друзей</option>
            <option value="public">Публичные</option>
          </select>

          {/* Сортировка */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="updatedAt">По дате обновления</option>
            <option value="createdAt">По дате создания</option>
            <option value="title">По названию</option>
          </select>
        </div>
      </div>

      {/* Список маршрутов */}
      <div className="space-y-3">
        {sortedRoutes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaFilter className="mx-auto text-4xl mb-4 text-gray-300" />
            <p>Маршруты не найдены</p>
            <p className="text-sm">Попробуйте изменить фильтры поиска</p>
          </div>
        ) : (
          sortedRoutes.map(route => {
            const categoryInfo = getCategoryInfo(route.category);
            return (
              <div
                key={route.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
                        {categoryInfo.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{route.title}</h3>
                        <p className="text-sm text-gray-600">{categoryInfo.name}</p>
                      </div>
                    </div>
                    
                    {route.description && (
                      <p className="text-sm text-gray-600 mb-2">{route.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>📍 {route.pointsCount} точек</span>
                      <span>📅 {new Date(route.updatedAt).toLocaleDateString()}</span>
                      <div className="flex items-center space-x-1">
                        {getVisibilityIcon(route.visibility)}
                        <span>{getVisibilityLabel(route.visibility)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Изменение видимости */}
                    <select
                      value={route.visibility}
                      onChange={(e) => onChangeVisibility(route.id, e.target.value as any)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="private">Приватный</option>
                      <option value="friends">Для друзей</option>
                      <option value="public">Публичный</option>
                    </select>

                    {/* Перенос в другую категорию */}
                    <select
                      onChange={(e) => onTransferRoute(route.id, e.target.value)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Перенести в...</option>
                      {CATEGORIES.filter(cat => cat.id !== route.category).map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    {/* Кнопки действий */}
                    <button
                      onClick={() => onEditRoute(route)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <FaEdit size={14} />
                    </button>
                    
                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RouteManager;
