import React from 'react';
import styled from 'styled-components';
import { 
  TrendingUp, 
  Heart, 
  MessageCircle, 
  Eye, 
  Clock,
  MapPin,
  Compass,
  Calendar,
  Plane,
  Utensils,
  Building2,
  TreePine,
  Mountain,
  Building,
  BookOpen,
  FileText
} from 'lucide-react';
import { Blog } from '../../types/blog';

interface PopularBlogsPanelProps {
  blogs?: Blog[];
  onBlogClick?: (blog: Blog) => void;
  onClose?: () => void;
}

// Стили в едином стиле с другими панелями
const Wrapper = styled.div`
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
  border: 2px solid #bcbcbc;
  width: 100%;
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  font-size: 15px;
  overflow: hidden;
  min-width: 0;
`;

const Header = styled.div`
  background: #dadada;
  color: #222;
  font-size: 1.08em;
  font-weight: bold;
  padding: 12px 0;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  letter-spacing: 0.01em;
  text-align: center;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
`;

const BlogCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    border-color: #007bff;
  }
`;

const BlogTitle = styled.h3`
  font-size: 1.1em;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.3;
`;

const BlogPreview = styled.p`
  color: #666;
  font-size: 0.9em;
  line-height: 1.4;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const BlogMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.8em;
  color: #888;
  margin-bottom: 12px;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const CategoryBadge = styled.span<{ category: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 500;
  background: ${({ category }) => {
    switch (category) {
      case 'travel': return '#e3f2fd';
      case 'food': return '#fff3e0';
      case 'culture': return '#f3e5f5';
      case 'nature': return '#e8f5e8';
      case 'adventure': return '#fff8e1';
      case 'city': return '#fce4ec';
      case 'history': return '#f1f8e9';
      default: return '#f5f5f5';
    }
  }};
  color: ${({ category }) => {
    switch (category) {
      case 'travel': return '#1976d2';
      case 'food': return '#f57c00';
      case 'culture': return '#7b1fa2';
      case 'nature': return '#388e3c';
      case 'adventure': return '#fbc02d';
      case 'city': return '#c2185b';
      case 'history': return '#689f38';
      default: return '#757575';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666;
`;

const EmptyIcon = styled.div`
  font-size: 3em;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const PopularBlogsPanel: React.FC<PopularBlogsPanelProps> = ({
  blogs = [],
  onBlogClick,
  onClose
}) => {
  // Примеры популярных блогов
  const popularBlogs: Blog[] = blogs.length > 0 ? blogs : [
    {
      id: 'blog_1',
      title: 'Ресторан в горах: незабываемый ужин на высоте',
      preview: 'Как я нашел удивительный ресторан в горах с потрясающим видом и невероятной кухней. История о том, как случайная поездка превратилась в незабываемое гастрономическое приключение.',
      content: 'Полный текст блога...',
      category: 'food',
      geoType: 'point',
      author: 'Анна Петрова',
      views_count: 1247,
      likes_count: 89,
      comments_count: 23,
      reading_time: 5,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      favoriteRouteId: '',
      related_markers: []
    },
    {
      id: 'blog_2',
      title: 'Шоу фейерверков в Костроме: магия огня над Волгой',
      preview: 'Путешествие в Кострому на фестиваль фейерверков. Как мы планировали поездку, где остановились и какие эмоции испытали, глядя на огненное шоу над рекой.',
      content: 'Полный текст блога...',
      category: 'travel',
      geoType: 'event',
      author: 'Михаил Соколов',
      views_count: 2156,
      likes_count: 156,
      comments_count: 34,
      reading_time: 8,
      created_at: '2024-01-10T14:20:00Z',
      updated_at: '2024-01-10T14:20:00Z',
      favoriteRouteId: '',
      related_markers: []
    },
    {
      id: 'blog_3',
      title: 'Тихий уголок для души: секретное место в лесу',
      preview: 'Открытие удивительного места в лесу, где можно побыть наедине с собой. Как я нашел этот уголок и почему он стал моим любимым местом для медитации.',
      content: 'Полный текст блога...',
      category: 'nature',
      geoType: 'point',
      author: 'Елена Волкова',
      views_count: 892,
      likes_count: 67,
      comments_count: 18,
      reading_time: 4,
      created_at: '2024-01-08T09:15:00Z',
      updated_at: '2024-01-08T09:15:00Z',
      favoriteRouteId: '',
      related_markers: []
    },
    {
      id: 'blog_4',
      title: 'Маршрут выходного дня: от музея до парка',
      preview: 'Идеальный маршрут для выходного дня в городе. Посещение интересных музеев, прогулка по парку и завершение дня в уютном кафе.',
      content: 'Полный текст блога...',
      category: 'city',
      geoType: 'route',
      author: 'Дмитрий Иванов',
      views_count: 1567,
      likes_count: 112,
      comments_count: 29,
      reading_time: 6,
      created_at: '2024-01-05T16:45:00Z',
      updated_at: '2024-01-05T16:45:00Z',
      favoriteRouteId: '',
      related_markers: []
    }
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'travel': return Plane;
      case 'food': return Utensils;
      case 'culture': return Building2;
      case 'nature': return TreePine;
      case 'adventure': return Mountain;
      case 'city': return Building;
      case 'history': return BookOpen;
      default: return FileText;
    }
  };

  const getGeoTypeIcon = (geoType: string) => {
    switch (geoType) {
      case 'point': return MapPin;
      case 'route': return Compass;
      case 'event': return Calendar;
      default: return MapPin;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <Wrapper>
      <Header>
        <TrendingUp className="w-5 h-5 mr-2" />
        Популярные блоги
        {onClose && (
          <TrendingUp 
            className="w-4 h-4 absolute right-4 cursor-pointer hover:text-red-600 transition-colors rotate-180"
            onClick={onClose}
          />
        )}
      </Header>
      
      <Content>
        {popularBlogs.length === 0 ? (
          <EmptyState>
            <EmptyIcon>📝</EmptyIcon>
            <p>Пока нет популярных блогов</p>
            <p className="text-sm mt-2">Будьте первым, кто поделится своей историей!</p>
          </EmptyState>
        ) : (
          popularBlogs.map(blog => {
                         const CategoryIcon = getCategoryIcon(blog.category || 'other');
             const GeoTypeIcon = getGeoTypeIcon(blog.geoType || 'point');
            
                         return (
               <BlogCard key={blog.id} onClick={() => onBlogClick?.(blog)}>
                 <BlogTitle>{blog.title}</BlogTitle>
                 <BlogPreview>{blog.preview}</BlogPreview>
                 
                 <BlogMeta>
                   <MetaItem>
                     <Eye className="w-3 h-3" />
                     {blog.views_count || 0}
                   </MetaItem>
                   <MetaItem>
                     <Heart className="w-3 h-3" />
                     {blog.likes_count || 0}
                   </MetaItem>
                   <MetaItem>
                     <MessageCircle className="w-3 h-3" />
                     {blog.comments_count || 0}
                   </MetaItem>
                   <MetaItem>
                     <Clock className="w-3 h-3" />
                     {blog.reading_time || 0} мин
                   </MetaItem>
                 </BlogMeta>
                 
                 <div className="flex items-center justify-between">
                   <CategoryBadge category={blog.category || 'other'}>
                     <CategoryIcon className="w-3 h-3" />
                     {blog.category === 'travel' && 'Путешествия'}
                     {blog.category === 'food' && 'Еда'}
                     {blog.category === 'culture' && 'Культура'}
                     {blog.category === 'nature' && 'Природа'}
                     {blog.category === 'adventure' && 'Приключения'}
                     {blog.category === 'city' && 'Город'}
                     {blog.category === 'history' && 'История'}
                     {blog.category === 'other' && 'Другое'}
                   </CategoryBadge>
                   
                   <div className="flex items-center gap-2 text-xs text-gray-500">
                     <GeoTypeIcon className="w-3 h-3" />
                     {blog.geoType === 'point' && 'Место'}
                     {blog.geoType === 'route' && 'Маршрут'}
                     {blog.geoType === 'event' && 'Событие'}
                   </div>
                 </div>
                 
                 <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                   <div className="flex items-center justify-between">
                     <span>{blog.author || 'Автор'}</span>
                     <span>{blog.created_at ? formatDate(blog.created_at) : 'Не указано'}</span>
                   </div>
                 </div>
               </BlogCard>
             );
          })
        )}
      </Content>
    </Wrapper>
  );
};

export default PopularBlogsPanel;
