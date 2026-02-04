import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaRoute, FaCalendarAlt, FaTimes, FaPlus } from 'react-icons/fa';
import { EventData } from '../../types/blog';
import { MarkerData } from '../../types/marker';
import { Route as RouteData } from '../../types/route';

interface ContentAddMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMarker: (marker: MarkerData) => void;
  onAddRoute: (route: RouteData) => void;
  onAddEvent: (event: EventData) => void;
  availableMarkers?: MarkerData[];
  availableRoutes?: any[];
  availableEvents?: EventData[];
  initialTab?: 'markers' | 'routes' | 'events'; // Добавляем проп для начальной вкладки
}

const ContentAddMenu: React.FC<ContentAddMenuProps> = ({
  isOpen,
  onClose,
  onAddMarker,
  onAddRoute,
  onAddEvent,
  availableMarkers = [],
  availableRoutes = [],
  availableEvents = [],
  initialTab = 'markers'
}) => {
  const [activeTab, setActiveTab] = useState<'markers' | 'routes' | 'events'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Обновляем активную вкладку при изменении initialTab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const filteredMarkers = availableMarkers.filter(marker =>
    marker.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    marker.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRoutes = availableRoutes.filter(route =>
    route.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = availableEvents.filter(event =>
    event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMarker = (marker: MarkerData) => {
    onAddMarker(marker);
    onClose();
  };

  const handleAddRoute = (route: RouteData) => {
    onAddRoute(route);
    onClose();
  };

  const handleAddEvent = (event: EventData) => {
    onAddEvent(event);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Добавить контент в блог</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('markers')}
            className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
              activeTab === 'markers'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaMapMarkerAlt className="inline mr-2" />
            Метки ({filteredMarkers.length})
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
              activeTab === 'routes'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaRoute className="inline mr-2" />
            Маршруты ({filteredRoutes.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
              activeTab === 'events'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaCalendarAlt className="inline mr-2" />
            События ({filteredEvents.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === 'markers' && (
            <div className="space-y-3">
              {filteredMarkers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaMapMarkerAlt size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Нет доступных меток</p>
                </div>
              ) : (
                filteredMarkers.map((marker) => (
                  <div
                    key={marker.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{marker.title}</h3>
                      {marker.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {marker.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {marker.category}
                        </span>
                        {marker.address && (
                          <span className="ml-2">📍 {marker.address}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMarker(marker)}
                      className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <FaPlus size={12} className="mr-1" />
                      Добавить
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-3">
              {filteredRoutes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaRoute size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Нет доступных маршрутов</p>
                </div>
              ) : (
                filteredRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{route.title}</h3>
                      {route.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {route.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <span>📏 {route.totalDistance || 0} км</span>
                        {route.points && (
                          <span className="ml-2">📍 {route.points.length} точек</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddRoute(route)}
                      className="ml-4 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                    >
                      <FaPlus size={12} className="mr-1" />
                      Добавить
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaCalendarAlt size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Нет доступных событий</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <span>📅 {(() => {
                          const dateValue: any = event.date;
                          if (!dateValue) return 'Не указано';
                          if (typeof dateValue === 'string') return dateValue;
                          if (dateValue instanceof Date) return dateValue.toLocaleDateString('ru-RU');
                          return String(dateValue);
                        })()}</span>
                        {event.location && (
                          <span className="ml-2">📍 {event.location}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddEvent(event)}
                      className="ml-4 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center"
                    >
                      <FaPlus size={12} className="mr-1" />
                      Добавить
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentAddMenu;

