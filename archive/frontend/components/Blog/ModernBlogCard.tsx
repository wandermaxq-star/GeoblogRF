import React from 'react';
import { motion } from 'framer-motion';
import { Star, Calendar, User, Eye } from 'lucide-react';

interface ModernBlogCardProps {
  blog: {
    id: string;
    title: string;
    excerpt?: string;
    author_name?: string;
    created_at?: string;
    rating?: number;
    ratings_count?: number;
    views_count?: number;
  };
  isHovered: boolean;
  onHover: (isHovered: boolean) => void;
  onClick: () => void;
}

const ModernBlogCard: React.FC<ModernBlogCardProps> = ({ 
  blog, 
  isHovered, 
  onHover, 
  onClick 
}) => {
  const rating = blog.rating || 0;
  const ratingCount = blog.ratings_count || 0;
  const views = blog.views_count || 0;

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-yellow-500';
    if (rating >= 4.0) return 'text-orange-500';
    if (rating >= 3.0) return 'text-blue-500';
    if (rating >= 2.0) return 'text-green-500';
    return 'text-gray-400';
  };

  const getRatingBgColor = (rating: number) => {
    if (rating >= 4.5) return 'bg-yellow-50 border-yellow-200';
    if (rating >= 4.0) return 'bg-orange-50 border-orange-200';
    if (rating >= 3.0) return 'bg-blue-50 border-blue-200';
    if (rating >= 2.0) return 'bg-green-50 border-green-200';
    return 'bg-gray-50 border-gray-200';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Неизвестно';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <motion.div
      className={`relative cursor-pointer transition-all duration-300 ${
        isHovered ? 'transform scale-105 z-10' : 'transform scale-100'
      }`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className={`
        w-full h-24 rounded-xl border-2 p-3
        ${getRatingBgColor(rating)}
        ${isHovered ? 'shadow-lg' : 'shadow-sm'}
        transition-all duration-300
      `}>
        {/* Заголовок */}
        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
          {blog.title}
        </h3>
        
        {/* Описание */}
        {blog.excerpt && (
          <p className="text-xs text-gray-600 mb-2 truncate">
            {blog.excerpt}
          </p>
        )}
        
        {/* Нижняя панель с информацией */}
        <div className="flex items-center justify-between text-xs">
          {/* Рейтинг */}
          <div className="flex items-center space-x-1">
            <Star className={`w-3 h-3 ${getRatingColor(rating)}`} />
            <span className={`font-medium ${getRatingColor(rating)}`}>
              {rating > 0 ? rating.toFixed(1) : '—'}
            </span>
            {ratingCount > 0 && (
              <span className="text-gray-500">({ratingCount})</span>
            )}
          </div>
          
          {/* Автор */}
          <div className="flex items-center space-x-1 text-gray-500">
            <User className="w-3 h-3" />
            <span className="truncate max-w-16">
              {blog.author_name || 'Неизвестно'}
            </span>
          </div>
        </div>
        
        {/* Дополнительная информация */}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(blog.created_at)}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{views}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ModernBlogCard;
