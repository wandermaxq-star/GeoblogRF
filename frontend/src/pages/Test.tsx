import { useState, useEffect } from 'react';
import { FaComments, FaBars, FaTimes, FaStar } from 'react-icons/fa';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { markerService } from '../services/markerService';
import { routeService } from '../services/routeService';
import { externalEventsService } from '../services/externalEventsService';

import StarRating from '../components/ui/StarRating';
import { useRating } from '../hooks/useRating';
import '../styles/GlobalStyles.css';
import './ChatNew.css';
import { projectManager } from '../services/projectManager';

interface RatedItem {
  id: string;
  type: 'marker' | 'route' | 'event';
  title: string;
  description?: string;
  author: string;
  authorAvatar?: string;
  createdAt: string;
  imageUrl?: string;
  rating: number;
  ratingCount: number;
  location?: string;
  category?: string;
}

const TestPage = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [ratedItems, setRatedItems] = useState<RatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'markers' | 'routes' | 'events'>('all');
  
  // Регистрируем панели при монтировании компонента
  useEffect(() => {
    registerPanel(); // Основная панель теста
    registerPanel(); // Левая панель настроек
    return () => {
      unregisterPanel(); // Основная панель
      unregisterPanel(); // Левая панель
    };
  }, [registerPanel, unregisterPanel]);

  useEffect(() => {
    loadRatedItems();
  }, []);

  const loadRatedItems = async () => {
    try {
      setLoading(true);
      
      const [markers, routes, events] = await Promise.all([
        (() => { try { return projectManager.getMarkers(); } catch { return []; } })(),
        routeService.getAllRoutes().catch(() => []),
        externalEventsService.searchEvents({}).catch(() => [])
      ]);

      // Фильтруем только элементы с рейтингом
      const ratedItems: RatedItem[] = [
        ...markers
          .filter((marker: any) => marker.rating && marker.rating > 0)
          .map((marker: any) => ({
            id: marker.id,
            type: 'marker' as const,
            title: marker.title,
            description: marker.description,
            author: marker.author_name || 'Неизвестно',
            authorAvatar: marker.author_avatar,
            createdAt: marker.created_at,
            imageUrl: marker.photo_urls?.[0],
            rating: marker.rating || 0,
            ratingCount: marker.rating_count || 0,
            location: marker.address,
            category: marker.category
          })),
        ...routes
          .filter((route: any) => route.rating && route.rating > 0)
          .map((route: any) => ({
            id: route.id,
            type: 'route' as const,
            title: route.title || route.name || 'Без названия',
            description: route.description,
            author: route.author_name || 'Неизвестно',
            authorAvatar: route.author_avatar,
            createdAt: route.created_at || route.createdAt,
            imageUrl: route.cover_image_url,
            rating: route.rating || 0,
            ratingCount: route.rating_count || 0,
            location: route.start_location,
            category: route.category
          })),
        ...events
          .filter((event: any) => event.rating && event.rating > 0)
          .map((event: any) => ({
            id: event.id,
            type: 'event' as const,
            title: event.title,
            description: event.description,
            author: event.organizer || 'Неизвестно',
            authorAvatar: event.organizer_avatar,
            createdAt: event.start_date,
            imageUrl: event.image_url,
            rating: event.rating || 0,
            ratingCount: event.rating_count || 0,
            location: event.location?.address,
            category: event.category
          })),

      ];

      // Сортируем по рейтингу (высокие рейтинги сверху)
      ratedItems.sort((a, b) => b.rating - a.rating);
      setRatedItems(ratedItems);
      
    } catch (error) {
      console.error('Ошибка загрузки рейтинговых элементов:', error);
      setRatedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'marker': return '📍';
      case 'route': return '🛣️';
      case 'event': return '📅';
      case 'book': return '📚';
      default: return '⭐';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'marker': return 'Метка';
      case 'route': return 'Маршрут';
      case 'event': return 'Событие';
      case 'book': return 'Книга';
      default: return 'Элемент';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Только что';
    if (diffInHours < 24) return `${diffInHours}ч назад`;
    if (diffInHours < 48) return 'Вчера';
    return date.toLocaleDateString('ru-RU');
  };

  const filteredItems = ratedItems.filter(item => 
    activeTab === 'all' || item.type === activeTab.replace('s', '') as 'marker' | 'route' | 'event' | 'book'
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <MirrorGradientContainer className="chat-container">
      <div className="chat-main-area">
        <div className="chat-content-wrapper">
          <div className="chat-main-panel relative">
            <button
              className="chat-side-button left"
              onClick={() => setSidebarOpen(true)}
              title="Настройки рейтингов"
            >
              <FaBars className="text-gray-600" size={20} />
            </button>

            <div className="h-full relative">
              <div className="flex-1 flex flex-col bg-white">
                <div className="bg-white border-b border-slate-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <FaStar className="w-5 h-5 text-yellow-500" />
                        <h1 className="text-xl font-semibold text-slate-800">Рейтинговые элементы</h1>
                      </div>
                      <span className="text-slate-500 text-sm">• Лучшие метки, маршруты и события по рейтингу</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      {/* Фильтры */}
                      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <div className="flex space-x-1">
                          {[
                            { key: 'all', label: 'Все', count: ratedItems.length },
                            { key: 'markers', label: 'Метки', count: ratedItems.filter(a => a.type === 'marker').length },
                            { key: 'routes', label: 'Маршруты', count: ratedItems.filter(a => a.type === 'route').length },
                            { key: 'events', label: 'События', count: ratedItems.filter(a => a.type === 'event').length },

                          ].map(tab => (
                            <button
                              key={tab.key}
                              onClick={() => setActiveTab(tab.key as any)}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                activeTab === tab.key
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {tab.label} ({tab.count})
                            </button>
                          ))}
                    </div>
                  </div>

                      {/* Список элементов */}
                      <div className="flex-1 overflow-y-auto">
                        {filteredItems.length === 0 ? (
                          <div className="flex items-center justify-center h-64 text-gray-500">
                            <div className="text-center">
                              <div className="text-4xl mb-2">⭐</div>
                              <p>Нет рейтинговых элементов</p>
                    </div>
                  </div>
                        ) : (
                          <div className="space-y-3 p-4">
                            {filteredItems.map(item => (
                              <RatedItemCard key={`${item.type}-${item.id}`} item={item} />
                            ))}
                    </div>
                        )}
                    </div>
                  </div>
                  )}
                    </div>
                  </div>

              {/* Левая выдвигающаяся панель */}
              <div className={`chat-slide-panel left ${sidebarOpen ? 'open' : ''}`}>
                <div className="chat-slide-panel-header left">
                  <h2 className="text-xl font-semibold">Настройки рейтингов</h2>
                  <button
                    className="chat-slide-panel-close"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
                <div className="chat-slide-panel-content">
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Фильтры рейтинга</h3>
                    <p className="text-gray-600 mb-4">
                      Здесь можно настроить параметры отображения рейтинговых элементов.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-100 rounded">
                        <p className="font-medium">Минимальный рейтинг</p>
                        <p className="text-sm text-gray-600">Показывать элементы с рейтингом выше 3.0</p>
                      </div>
                      <div className="p-3 bg-gray-100 rounded">
                        <p className="font-medium">Количество оценок</p>
                        <p className="text-sm text-gray-600">Минимум 5 оценок для отображения</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`chat-overlay ${sidebarOpen ? 'active' : ''}`} />
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  )
}

const RatedItemCard: React.FC<{ item: RatedItem }> = ({ item }) => {
  const { summary, handleRate } = useRating(item.type, item.id);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
              <span className="text-2xl">{getTypeIcon(item.type)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getTypeIcon(item.type)}
                  <span className="ml-1">{getTypeLabel(item.type)}</span>
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              
              <h3 className="font-medium text-gray-900 line-clamp-1 mb-1">
                {item.title}
              </h3>
              
              {item.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {item.description}
                </p>
              )}

              {/* Рейтинг */}
              <div className="flex items-center space-x-2 mb-2">
                <StarRating 
                  value={summary.avg || 0} 
                  count={summary.count} 
                  interactive 
                  onChange={handleRate}
                />
                <span className="text-sm font-medium text-gray-700">
                  {item.rating.toFixed(1)} ⭐
                </span>
                <span className="text-xs text-gray-500">
                  ({item.ratingCount} оценок)
                </span>
              </div>

              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <span>👤</span>
                  <span className="truncate max-w-20">{item.author}</span>
                </div>
                
                {item.location && (
                  <div className="flex items-center space-x-1">
                    <span>📍</span>
                    <span className="truncate max-w-24">{item.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные функции
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'marker': return '📍';
    case 'route': return '🛣️';
    case 'event': return '📅';
    case 'book': return '📚';
    default: return '⭐';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'marker': return 'Метка';
    case 'route': return 'Маршрут';
    case 'event': return 'Событие';
    case 'book': return 'Книга';
    default: return 'Элемент';
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Только что';
  if (diffInHours < 24) return `${diffInHours}ч назад`;
  if (diffInHours < 48) return 'Вчера';
  return date.toLocaleDateString('ru-RU');
};

export default TestPage;
