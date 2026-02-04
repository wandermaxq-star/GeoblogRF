import React from 'react';
import { Blog, BLOG_CATEGORIES } from '../../types/blog';
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Clock, 
  User, 
  Calendar,
  MapPin,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import ReportButton from '../Moderation/ReportButton';
import StarRating from '../ui/StarRating';
import { useRating } from '../../hooks/useRating';

interface BlogCardProps {
  blog: Blog;
  onClick: () => void;
}

const BlogCard: React.FC<BlogCardProps> = ({ blog, onClick }) => {
  const getCategoryLabel = (category: string) => {
    return BLOG_CATEGORIES[category as keyof typeof BLOG_CATEGORIES] || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      gastronomy: 'from-orange-500 to-red-500',
      nature: 'from-green-500 to-emerald-500',
      culture: 'from-purple-500 to-indigo-500',
      adventure: 'from-blue-500 to-cyan-500',
      routes: 'from-indigo-500 to-purple-500',
      other: 'from-gray-500 to-slate-500'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const BlogRating: React.FC<{ blogId: string | number }> = ({ blogId }) => {
    const { summary, handleRate } = useRating('blog', blogId);
    return (
      <div className="mb-3">
        <StarRating value={summary.avg || 0} count={summary.count} interactive onChange={handleRate} />
      </div>
    );
  };

  return (
    <div 
      className="group bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] relative"
      onClick={onClick}
    >
      {/* Кнопка жалоб */}
      <div 
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <ReportButton
          contentId={blog.id}
          contentType="blog"
          contentTitle={blog.title}
          variant="icon"
          size="sm"
        />
      </div>

      {/* Изображение */}
      {blog.images && blog.images.length > 0 ? (
        <div className="h-48 overflow-hidden relative">
          <img 
            src={blog.images[0]} 
            alt={blog.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Категория поверх изображения */}
          <div className="absolute top-3 left-3">
            <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${getCategoryColor(blog.category || 'other')} text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg`}>
              <BookOpen className="w-3 h-3" />
              {getCategoryLabel(blog.category || 'other')}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
          <BookOpen className="w-16 h-16 text-gray-300" />
          
          {/* Категория для блогов без изображений */}
          <div className="absolute top-3 left-3">
            <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${getCategoryColor(blog.category || 'other')} text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg`}>
              <BookOpen className="w-3 h-3" />
              {getCategoryLabel(blog.category || 'other')}
            </div>
          </div>
        </div>
      )}
      
      {/* Содержимое карточки */}
      <div className="p-6">
        {/* Рейтинг */}
        {blog.id && (
          <BlogRating blogId={blog.id} />
        )}
        {/* Заголовок */}
        <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300">
          {blog.title}
        </h3>
        
        {/* Краткое описание */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
          {blog.preview || blog.excerpt || 'Описание отсутствует'}
        </p>
        
        {/* Статистика */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-blue-500" />
            <span>{blog.views_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-500" />
            <span>{blog.likes_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-green-500" />
            <span>{blog.comments_count || 0}</span>
          </div>
          {blog.reading_time && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-500" />
              <span>{blog.reading_time} мин</span>
            </div>
          )}
        </div>
        
        {/* Мета-информация */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-gray-400" />
            <span className="truncate max-w-24">
              {blog.author || blog.author_name || 'Неизвестно'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
          <span>{formatDate(blog.date || blog.created_at || '')}</span>
          </div>
        </div>

        {/* Географическая привязка */}
        {(blog.favoriteRouteId || (blog.related_markers && blog.related_markers.length > 0)) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded-lg">
            <MapPin className="w-3 h-3 text-blue-500" />
            <span>
              {blog.favoriteRouteId ? 'Связан с маршрутом' : `${blog.related_markers?.length || 0} связанных мест`}
            </span>
          </div>
        )}
        
        {/* Кнопка "Читать далее" */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Нажмите для чтения
          </div>
          <div className="group-hover:translate-x-1 transition-transform duration-300">
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogCard;