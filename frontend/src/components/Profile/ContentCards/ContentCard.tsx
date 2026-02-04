import React from 'react';
import { FaMapMarkedAlt, FaBlog, FaStar, FaTrophy, FaUsers, FaCamera, FaHeart, FaComment, FaShare, FaEye, FaCalendarAlt, FaMapPin, FaRoute, FaEdit, FaTrash } from 'react-icons/fa';

// Типы данных
export interface ContentCardData {
  id: string;
  type: 'post' | 'route' | 'place' | 'event' | 'achievement' | 'photo';
  title: string;
  preview: string;
  thumbnail?: string;
  mapData?: {
    lat: number;
    lng: number;
    zoom: number;
  };
  rating?: number;
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    category: string;
    tags: string[];
  };
  interactive: {
    canRead: boolean;
    canEdit: boolean;
    canShare: boolean;
  };
}

interface ContentCardProps {
  content: ContentCardData;
  onEdit?: (content: ContentCardData) => void;
  onDelete?: (content: ContentCardData) => void;
  onRead?: (content: ContentCardData) => void;
  onShare?: (content: ContentCardData) => void;
  compact?: boolean;
}

const ContentCard: React.FC<ContentCardProps> = ({ 
  content, 
  onEdit, 
  onDelete, 
  onRead, 
  onShare,
  compact = false 
}) => {
  const getTypeIcon = (type: string) => {
    const icons = {
      blog: FaBlog,
      post: FaBlog,
      route: FaMapMarkedAlt,
      place: FaMapPin,
      event: FaCalendarAlt,
      achievement: FaTrophy,
      photo: FaCamera
    };
    const IconComponent = icons[type as keyof typeof icons] || FaStar;
    return <IconComponent className="w-5 h-5" />;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      blog: 'from-green-500 to-green-600',
      post: 'from-blue-500 to-blue-600',
      route: 'from-purple-500 to-purple-600',
      place: 'from-orange-500 to-orange-600',
      event: 'from-red-500 to-red-600',
      achievement: 'from-yellow-500 to-yellow-600',
      photo: 'from-pink-500 to-pink-600'
    };
    return colors[type as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      blog: 'Блог',
      post: 'Пост',
      route: 'Маршрут',
      place: 'Место',
      event: 'Событие',
      achievement: 'Достижение',
      photo: 'Фото'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatDate = (date: Date) => {
    return new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 ${
      compact ? 'p-3' : 'p-4'
    }`}>
      <div className="flex items-start space-x-4">
        {/* Иконка типа */}
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${getTypeColor(content.type)} flex items-center justify-center text-white flex-shrink-0`}>
          {getTypeIcon(content.type)}
        </div>
        
        {/* Основной контент */}
        <div className="flex-1 min-w-0">
          {/* Заголовок и рейтинг */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {getTypeLabel(content.type)}
                </span>
                {content.metadata.category && (
                  <span className="text-xs text-gray-400">•</span>
                )}
                {content.metadata.category && (
                  <span className="text-xs text-gray-500 capitalize">
                    {content.metadata.category}
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-gray-800 truncate">{content.title}</h4>
            </div>
            {content.rating && (
              <div className="flex items-center space-x-1 text-yellow-500 ml-2 flex-shrink-0">
                <span className="text-sm">⭐</span>
                <span className="text-sm font-medium">{content.rating}</span>
              </div>
            )}
          </div>
          
          {/* Превью контента */}
          <p className={`text-gray-600 mb-3 ${compact ? 'text-sm line-clamp-1' : 'text-sm line-clamp-2'}`}>
            {content.preview}
          </p>
          
          {/* Мини-карта для постов и мест */}
          {content.mapData && (content.type === 'post' || content.type === 'place') && (
            <div className="mb-3">
              <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FaMapPin className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-xs">Карта</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Статистика */}
          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
            <div className="flex items-center space-x-1">
              <FaEye className="w-4 h-4" />
              <span>{content.stats.views}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaHeart className="w-4 h-4" />
              <span>{content.stats.likes}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaComment className="w-4 h-4" />
              <span>{content.stats.comments}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaShare className="w-4 h-4" />
              <span>{content.stats.shares}</span>
            </div>
          </div>
          
          {/* Теги */}
          {content.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {content.metadata.tags.slice(0, compact ? 2 : 3).map((tag, index) => (
                <span
                  key={index}
                  className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {content.metadata.tags.length > (compact ? 2 : 3) && (
                <span className="text-gray-400 text-xs px-2 py-1">
                  +{content.metadata.tags.length - (compact ? 2 : 3)}
                </span>
              )}
            </div>
          )}
          
          {/* Действия */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {formatDate(content.metadata.createdAt)}
            </div>
            
            <div className="flex items-center space-x-2">
              {content.interactive.canRead && onRead && (
                <button
                  onClick={() => onRead(content)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                >
                  Читать
                </button>
              )}
              
              {content.interactive.canEdit && onEdit && (
                <button
                  onClick={() => onEdit(content)}
                  className="text-gray-600 hover:text-gray-700 p-1 rounded transition-colors"
                  title="Редактировать"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
              )}
              
              {content.interactive.canShare && onShare && (
                <button
                  onClick={() => onShare(content)}
                  className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                  title="Поделиться"
                >
                  <FaShare className="w-4 h-4" />
                </button>
              )}
              
              {onDelete && (
                <button
                  onClick={() => onDelete(content)}
                  className="text-red-600 hover:text-red-700 p-1 rounded transition-colors"
                  title="Удалить"
                >
                  <FaTrash className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCard;
