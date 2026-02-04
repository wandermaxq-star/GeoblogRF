import BlogList from './BlogList';
import BlogForm from './BlogForm';
import BlogView from './BlogView';
import BooksList from './BooksList';
import { Blog, Book } from '../../types/blog';
import { Route } from '../../types/route';
import apiClient from '../../api/apiClient';
import { bookService } from '../../services/bookService';
import { useState, useEffect } from 'react';

// Интерфейс для данных маршрута, передаваемых в блог
interface RouteDataForBlog {
  title: string;
  points: Array<{
    id: string;
    title: string;
    latitude: number;
    longitude: number;
    description?: string;
  }>;
  totalDistance?: number;
  estimatedDuration?: number;
  polyline?: [number, number][];
}

// Интерфейс для данных метки, передаваемых в блог
interface MarkerDataForBlog {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  category?: string;
  address?: string;
  hashtags?: string[];
  photoUrls?: string[];
}

export const handleCreateBlog = async (newBlog: Blog, setBlogs: any, setCurrentView: any) => {
  try {
    const response = await apiClient.post('/blogs', newBlog);
    setBlogs((prev: Blog[]) => [response.data, ...prev]);
    setCurrentView('list');
  } catch (error) {
    }
};

interface BlogSectionProps {
  blogs: Blog[];
  onViewBlog: (blog: Blog) => void;
  onCreateBlog?: (newBlog: Blog) => Promise<void>;
  selectedBlog?: Blog | null;
  currentView?: 'list' | 'view' | 'books';
  onBackToList?: () => void;
  favoriteRoutes?: Route[]; // Добавляем пропс для избранных маршрутов
  routeDataForBlog?: RouteDataForBlog | null; // Данные маршрута для создания блога
  markerDataForBlog?: MarkerDataForBlog | null; // Данные метки для создания блога
  onClearRouteData?: () => void; // Функция для очистки данных маршрута
  onClearMarkerData?: () => void; // Функция для очистки данных метки
}

const BlogSection = ({ 
  blogs, 
  onViewBlog, 
  selectedBlog, 
  currentView, 
  onBackToList,
  favoriteRoutes = [],
  routeDataForBlog,
  markerDataForBlog,
  onClearRouteData,
  onClearMarkerData
}: BlogSectionProps) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);

  // Загружаем книги
  useEffect(() => {
    const loadBooks = async () => {
      setBooksLoading(true);
      try {
        const booksData = await bookService.listMyBooks();
        setBooks(Array.isArray(booksData) ? booksData : []);
      } catch (error) {
        console.error('Ошибка загрузки книг:', error);
        setBooks([]);
      } finally {
        setBooksLoading(false);
      }
    };
    
    loadBooks();
  }, []);
  const renderCurrentView = () => {
    // Если есть данные маршрута, показываем форму создания блога
    if (routeDataForBlog) {
      return (
        <BlogForm
          onSave={(blog) => {
            // Здесь можно добавить логику сохранения блога
            if (onClearRouteData) {
              onClearRouteData();
            }
          }}
          onCancel={() => {
            // Очищаем данные маршрута и возвращаемся к списку
            if (onClearRouteData) {
              onClearRouteData();
            }
          }}
          selectedCategory="travel"
          selectedGeoTypes={['route']}
          selectedTools={[]}
        />
      );
    }
    
    // Если есть данные метки, показываем форму создания блога
    if (markerDataForBlog) {
      return (
        <BlogForm
          onSave={(blog) => {
            // Здесь можно добавить логику сохранения блога
            if (onClearMarkerData) {
              onClearMarkerData();
            }
          }}
          onCancel={() => {
            // Очищаем данные метки и возвращаемся к списку
            if (onClearMarkerData) {
              onClearMarkerData();
            }
          }}
          selectedCategory="travel"
          selectedGeoTypes={['point']}
          selectedTools={[]}
        />
      );
    }
    
    switch (currentView) {
      case 'view':
        return (
          <BlogView 
            blog={selectedBlog!}
            onBack={onBackToList || (() => {})}
          />
        );
      case 'books':
        return (
          <BooksList
            onBookOpen={(book) => {
              // Открываем книгу в режиме просмотра
              onViewBlog(book.blogs[0] || selectedBlog!);
            }}
            onBookCreate={() => {
              // Можно добавить логику создания новой книги
            }}
            onBookToggleFavorite={(bookId) => {
              // Можно добавить логику добавления в избранное
            }}
            title="Мои книги"
            showCreateButton={true}
          />
        );
      default:
        return (
          <BlogList 
            blogs={blogs}
            onViewBlog={onViewBlog}
          />
        );
    }
  };

  return (
    <div className="h-full bg-white">
      {renderCurrentView()}
    </div>
  );
};

export default BlogSection;
export { BlogForm };