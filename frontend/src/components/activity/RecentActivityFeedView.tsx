import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Calendar, 
  BookOpen, 
  User, 
  Heart, 
  MessageCircle, 
  Eye
} from 'lucide-react';
import StarRating from '../ui/StarRating';
import { useRating } from '../../hooks/useRating';
import { markerService } from '../../services/markerService';
import { routeService } from '../../services/routeService';
import { externalEventsService } from '../../services/externalEventsService';
import { projectManager } from '../../services/projectManager';

interface ActivityItem {
  id: string;
  type: 'marker' | 'route' | 'event' | 'post';
  title: string;
  description?: string;
  author: string;
  authorAvatar?: string;
  createdAt: string;
  imageUrl?: string;
  stats: {
    views?: number;
    likes?: number;
    comments?: number;
    rating?: number;
    ratingCount?: number;
  };
  location?: string;
  category?: string;
}

const RecentActivityFeedView: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'markers' | 'routes' | 'events' | 'posts'>('all');

  useEffect(() => {
    loadRecentActivities();
  }, []);

  const loadRecentActivities = async () => {
    try {
      setLoading(true);
      
      const testActivities: ActivityItem[] = [
        { id: '1', type: 'marker', title: 'Золотые ворота Владимира', description: 'Памятник архитектуры XII века, символ города Владимир', author: 'Иван Петров', createdAt: new Date().toISOString(), imageUrl: 'https://via.placeholder.com/80x80?text=Золотые+ворота', stats: { views: 1250, likes: 89, comments: 23, rating: 4.8, ratingCount: 45 }, location: 'Владимир, ул. Большая Московская, 1', category: 'Достопримечательность' },
        { id: '2', type: 'route', title: 'Исторический центр Владимира', description: 'Пешеходный маршрут по историческому центру города', author: 'Мария Сидорова', createdAt: new Date(Date.now() - 3600000).toISOString(), imageUrl: 'https://via.placeholder.com/80x80?text=Маршрут', stats: { views: 890, likes: 67, comments: 15, rating: 4.6, ratingCount: 32 }, location: 'Владимир, центр города', category: 'Пешеходный маршрут' },
        { id: '3', type: 'event', title: 'Фестиваль "Владимирская весна"', description: 'Ежегодный фестиваль народного творчества и ремесел', author: 'Культурный центр', createdAt: new Date(Date.now() - 7200000).toISOString(), imageUrl: 'https://via.placeholder.com/80x80?text=Фестиваль', stats: { views: 2100, likes: 156, comments: 42, rating: 4.9, ratingCount: 78 }, location: 'Владимир, парк Пушкина', category: 'Культурное событие' },
        { id: '4', type: 'post', title: 'Путешествие по Золотому кольцу', description: 'Подробный отчет о поездке по городам Золотого кольца России', author: 'Алексей Туристов', createdAt: new Date(Date.now() - 10800000).toISOString(), imageUrl: 'https://via.placeholder.com/80x80?text=Пост', stats: { views: 3400, likes: 234, comments: 67, rating: 4.7, ratingCount: 89 }, location: 'Золотое кольцо России', category: 'Путешествия' }
      ];
      setActivities(testActivities);

      try {
        const [markers, routes, events] = await Promise.all([
          (() => { try { return projectManager.getMarkers(); } catch { return []; } })(),
          routeService.getAllRoutes().catch(() => []),
          externalEventsService.searchEvents({}).catch(() => [])
        ]);

        const blogs: any[] = [];

        const realActivities: ActivityItem[] = [
          ...markers.map((m: any) => ({ id: m.id, type: 'marker' as const, title: m.title, description: m.description, author: m.author_name || 'Неизвестно', authorAvatar: m.author_avatar, createdAt: m.created_at, imageUrl: m.photo_urls?.[0], stats: { views: m.views_count || 0, likes: m.likes_count || 0, comments: m.comments_count || 0, rating: m.rating || 0, ratingCount: m.rating_count || 0 }, location: m.address, category: m.category })),
          ...routes.map((r: any) => ({ id: r.id, type: 'route' as const, title: r.title || r.name || 'Без названия', description: r.description, author: r.author_name || 'Неизвестно', authorAvatar: r.author_avatar, createdAt: r.created_at || r.createdAt, imageUrl: r.cover_image_url, stats: { views: r.views_count || 0, likes: r.likes_count || 0, comments: r.comments_count || 0, rating: r.rating || 0, ratingCount: r.rating_count || 0 }, location: r.start_location, category: r.category })),
          ...events.map((e: any) => ({ id: e.id, type: 'event' as const, title: e.title, description: e.description, author: e.organizer || 'Неизвестно', authorAvatar: e.organizer_avatar, createdAt: e.start_date, imageUrl: e.image_url, stats: { views: e.views_count || 0, likes: e.likes_count || 0, comments: e.comments_count || 0, rating: e.rating || 0, ratingCount: e.rating_count || 0 }, location: e.location?.address, category: e.category })),

        ];

        if (realActivities.length > 0) {
          realActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setActivities(realActivities);
        }
      } catch {}
    } catch (error) {
      console.error('Ошибка загрузки активностей:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'marker': return <MapPin className="w-4 h-4" />;
      case 'route': return <Navigation className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'post': return <BookOpen className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'marker': return 'text-blue-500 bg-blue-50';
      case 'route': return 'text-green-500 bg-green-50';
      case 'event': return 'text-purple-500 bg-purple-50';
      case 'post': return 'text-orange-500 bg-orange-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'marker': return 'Метка';
      case 'route': return 'Маршрут';
      case 'event': return 'Событие';
      case 'post': return 'Пост';
      default: return 'Активность';
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

  const filteredActivities = activities.filter(activity => 
    activeTab === 'all' || activity.type === (activeTab.replace('s', '') as 'marker' | 'route' | 'event' | 'post')
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Последние активности</h2>
          <div className="text-sm text-gray-500">{activities.length} элементов</div>
        </div>
      </div>

      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'Все', count: activities.length },
            { key: 'markers', label: 'Метки', count: activities.filter(a => a.type === 'marker').length },
            { key: 'routes', label: 'Маршруты', count: activities.filter(a => a.type === 'route').length },
            { key: 'events', label: 'События', count: activities.filter(a => a.type === 'event').length },
            { key: 'posts', label: 'Посты', count: activities.filter(a => a.type === 'post').length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📭</div>
              <p>Нет активностей для отображения</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {filteredActivities.map(activity => (
              <ActivityItem key={`${activity.type}-${activity.id}`} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityItem: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  const { summary, handleRate } = useRating(activity.type, activity.id);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {activity.imageUrl ? (
            <img src={activity.imageUrl} alt={activity.title} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(activity.type)}`}>{getTypeIcon(activity.type)}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(activity.type)}`}>
                  {getTypeIcon(activity.type)}
                  <span className="ml-1">{getTypeLabel(activity.type)}</span>
                </span>
                <span className="text-xs text-gray-500">{formatDate(activity.createdAt)}</span>
              </div>
              <h3 className="font-medium text-gray-900 line-clamp-1 mb-1">{activity.title}</h3>
              {activity.description && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{activity.description}</p>}
              <div className="flex items-center space-x-2 mb-2">
                <StarRating value={summary.avg || 0} count={summary.count} interactive onChange={handleRate} />
                {summary.count > 0 && <span className="text-xs text-gray-500">({summary.count} оценок)</span>}
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-20">{activity.author}</span>
                </div>
                {activity.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-24">{activity.location}</span>
                  </div>
                )}
                {activity.stats.views !== undefined && (
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>{activity.stats.views}</span>
                  </div>
                )}
                {activity.stats.likes !== undefined && (
                  <div className="flex items-center space-x-1">
                    <Heart className="w-3 h-3" />
                    <span>{activity.stats.likes}</span>
                  </div>
                )}
                {activity.stats.comments !== undefined && (
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{activity.stats.comments}</span>
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

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'marker': return <MapPin className="w-4 h-4" />;
    case 'route': return <Navigation className="w-4 h-4" />;
    case 'event': return <Calendar className="w-4 h-4" />;
    case 'post': return <BookOpen className="w-4 h-4" />;
    default: return <BookOpen className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'marker': return 'text-blue-500 bg-blue-50';
    case 'route': return 'text-green-500 bg-green-50';
    case 'event': return 'text-purple-500 bg-purple-50';
    case 'post': return 'text-orange-500 bg-orange-50';
    default: return 'text-gray-500 bg-gray-50';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'marker': return 'Метка';
    case 'route': return 'Маршрут';
    case 'event': return 'Событие';
    case 'post': return 'Пост';
    default: return 'Активность';
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

export default RecentActivityFeedView;
export { RecentActivityFeedView };



