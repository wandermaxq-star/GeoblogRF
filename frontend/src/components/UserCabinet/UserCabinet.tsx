import React, { useState } from 'react';
import { FaRoute, FaMapMarkerAlt, FaCog, FaChartBar, FaUser, FaSignOutAlt } from 'react-icons/fa';
import RouteManager from './RouteManager';
import MarkerManager from './MarkerManager';

interface UserCabinetProps {
  onLogout: () => void;
}

const UserCabinet: React.FC<UserCabinetProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'markers' | 'settings' | 'stats'>('routes');

  // Моковые данные для демонстрации
  const [routes] = useState([
    {
      id: '1',
      title: 'Прогулка по центру',
      description: 'Красивый маршрут по историческому центру',
      category: 'personal',
      visibility: 'private' as const,
      pointsCount: 5,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T15:30:00Z'
    },
    {
      id: '2',
      title: 'Гастрономический тур',
      description: 'Лучшие рестораны города',
      category: 'post',
      visibility: 'public' as const,
      pointsCount: 8,
      createdAt: '2024-01-10T14:00:00Z',
      updatedAt: '2024-01-18T12:00:00Z'
    },
    {
      id: '3',
      title: 'Семейный выходной',
      description: 'Маршрут для семей с детьми',
      category: 'event',
      visibility: 'friends' as const,
      pointsCount: 6,
      createdAt: '2024-01-05T09:00:00Z',
      updatedAt: '2024-01-12T16:45:00Z'
    }
  ]);

  const [markers] = useState([
    {
      id: '1',
      title: 'Красная площадь',
      description: 'Главная площадь Москвы',
      category: 'attraction',
      visibility: 'public' as const,
      latitude: 55.7539,
      longitude: 37.6208,
      address: 'Красная площадь, Москва',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T15:30:00Z'
    },
    {
      id: '2',
      title: 'Кафе "Уютное место"',
      description: 'Уютное кафе с домашней кухней',
      category: 'restaurant',
      visibility: 'private' as const,
      latitude: 55.7558,
      longitude: 37.6176,
      address: 'ул. Тверская, 15',
      createdAt: '2024-01-10T14:00:00Z',
      updatedAt: '2024-01-18T12:00:00Z'
    },
    {
      id: '3',
      title: 'Отель "Метрополь"',
      description: 'Роскошный отель в центре',
      category: 'hotel',
      visibility: 'friends' as const,
      latitude: 55.7600,
      longitude: 37.6200,
      address: 'Театральный проезд, 2',
      createdAt: '2024-01-05T09:00:00Z',
      updatedAt: '2024-01-12T16:45:00Z'
    }
  ]);

  const handleEditRoute = (route: any) => {
    console.log('Редактирование маршрута:', route);
    // Здесь будет логика редактирования маршрута
  };

  const handleDeleteRoute = (routeId: string) => {
    console.log('Удаление маршрута:', routeId);
    // Здесь будет логика удаления маршрута
  };

  const handleTransferRoute = (routeId: string, newCategory: string) => {
    console.log('Перенос маршрута:', routeId, 'в категорию:', newCategory);
    // Здесь будет логика переноса маршрута
  };

  const handleChangeRouteVisibility = (routeId: string, visibility: 'private' | 'public' | 'friends') => {
    console.log('Изменение видимости маршрута:', routeId, 'на:', visibility);
    // Здесь будет логика изменения видимости маршрута
  };

  const handleEditMarker = (marker: any) => {
    console.log('Редактирование метки:', marker);
    // Здесь будет логика редактирования метки
  };

  const handleDeleteMarker = (markerId: string) => {
    console.log('Удаление метки:', markerId);
    // Здесь будет логика удаления метки
  };

  const handleTransferMarker = (markerId: string, newCategory: string) => {
    console.log('Перенос метки:', markerId, 'в категорию:', newCategory);
    // Здесь будет логика переноса метки
  };

  const handleChangeMarkerVisibility = (markerId: string, visibility: 'private' | 'public' | 'friends') => {
    console.log('Изменение видимости метки:', markerId, 'на:', visibility);
    // Здесь будет логика изменения видимости метки
  };

  const tabs = [
    { id: 'routes', label: 'Маршруты', icon: FaRoute, count: routes.length },
    { id: 'markers', label: 'Метки', icon: FaMapMarkerAlt, count: markers.length },
    { id: 'stats', label: 'Статистика', icon: FaChartBar, count: null },
    { id: 'settings', label: 'Настройки', icon: FaCog, count: null }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Заголовок */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <FaUser className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Личный кабинет</h1>
                <p className="text-sm text-gray-500">Управление маршрутами и метками</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FaSignOutAlt />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Навигация по вкладкам */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Контент вкладок */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'routes' && (
            <div className="p-6">
              <RouteManager
                routes={routes}
                onEditRoute={handleEditRoute}
                onDeleteRoute={handleDeleteRoute}
                onTransferRoute={handleTransferRoute}
                onChangeVisibility={handleChangeRouteVisibility}
              />
            </div>
          )}

          {activeTab === 'markers' && (
            <div className="p-6">
              <MarkerManager
                markers={markers}
                onEditMarker={handleEditMarker}
                onDeleteMarker={handleDeleteMarker}
                onTransferMarker={handleTransferMarker}
                onChangeVisibility={handleChangeMarkerVisibility}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6">
              <div className="text-center py-12">
                <FaChartBar className="mx-auto text-4xl text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Статистика</h3>
                <p className="text-gray-500">Здесь будет отображаться статистика использования</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <div className="text-center py-12">
                <FaCog className="mx-auto text-4xl text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Настройки</h3>
                <p className="text-gray-500">Здесь будут настройки аккаунта</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCabinet;
