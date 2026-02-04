import React, { useState, useEffect } from 'react';
import { Book } from '../../types/blog';
import { bookService } from '../../services/bookService';
import BookCard from './BookCard';
import DynamicBookTemplate from './DynamicBookTemplate';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BooksGridProps {
  onBookOpen: (book: Book) => void;
  searchQuery: string;
  filterBy: string;
}

const BooksGrid: React.FC<BooksGridProps> = ({ onBookOpen, searchQuery, filterBy }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    loadBooks();
    
    // Слушаем событие обновления книг
    const handleBooksUpdate = () => {
      loadBooks();
    };
    
    window.addEventListener('booksUpdated', handleBooksUpdate);
    
    return () => {
      window.removeEventListener('booksUpdated', handleBooksUpdate);
    };
  }, []);

  // Функция для создания правильного объекта книги
  const createTestBook = (id: string, title: string, author_name: string, category: 'routes' | 'events' | 'attractions' | 'mixed' | 'nature' | 'culture' | 'adventure', rating: number, views_count: number, likes_count: number) => ({
    id,
    title,
    author_name,
    category,
    rating,
    views_count,
    likes_count,
    created_at: new Date().toISOString(),
    cover_image_url: undefined,
    author_id: `test-author-${id}`,
    blogs: [],
    ratings_count: Math.floor(Math.random() * 50) + 10,
    is_favorite: false,
    updated_at: new Date().toISOString(),
    status: 'published' as const
  });

  const loadBooks = async () => {
    try {
      setLoading(true);
      console.log('📚 BooksGrid: Загружаем книги...');
      
      // Сначала показываем тестовые данные для мгновенной загрузки (27 книг для 3 страниц)
      const testBooks = [
        // Страница 1
        createTestBook('1', 'Путешествие по Золотому кольцу', 'Анна Иванова', 'attractions', 4.8, 1250, 89),
        createTestBook('2', 'История древних городов', 'Петр Сидоров', 'culture', 4.6, 980, 67),
        createTestBook('3', 'Природные достопримечательности', 'Мария Козлова', 'nature', 4.9, 2100, 156),
        createTestBook('4', 'Культурные события России', 'Алексей Петров', 'events', 4.4, 750, 45),
        createTestBook('5', 'Приключения в глубинке', 'Елена Смирнова', 'adventure', 4.7, 1100, 78),
        createTestBook('6', 'Смешанные маршруты', 'Дмитрий Волков', 'mixed', 4.5, 890, 52),
        createTestBook('7', 'Религиозные памятники', 'Ольга Новикова', 'culture', 4.3, 650, 38),
        createTestBook('8', 'Гастрономические туры', 'Игорь Морозов', 'attractions', 4.6, 1200, 84),
        createTestBook('9', 'Семейные путешествия', 'Татьяна Лебедева', 'mixed', 4.8, 1500, 112),
        // Страница 2
        createTestBook('10', 'Северные города России', 'Андрей Соколов', 'attractions', 4.7, 980, 73),
        createTestBook('11', 'Великий Новгород', 'Светлана Морозова', 'culture', 4.5, 850, 61),
        createTestBook('12', 'Псковская земля', 'Михаил Волков', 'attractions', 4.4, 720, 48),
        createTestBook('13', 'Изборск и Печоры', 'Екатерина Новикова', 'culture', 4.2, 680, 42),
        createTestBook('14', 'Валдайские просторы', 'Денис Козлов', 'nature', 4.6, 920, 67),
        createTestBook('15', 'Старая Русса', 'Анна Петрова', 'attractions', 4.1, 580, 35),
        createTestBook('16', 'Боровичи и окрестности', 'Сергей Морозов', 'mixed', 3.9, 450, 28),
        createTestBook('17', 'Окуловка', 'Марина Соколова', 'attractions', 3.8, 380, 22),
        createTestBook('18', 'Малая Вишера', 'Александр Волков', 'nature', 3.7, 320, 18),
        // Страница 3
        createTestBook('19', 'Центральная Россия', 'Наталья Козлова', 'mixed', 4.8, 1400, 98),
        createTestBook('20', 'Московская область', 'Владимир Петров', 'attractions', 4.6, 1100, 76),
        createTestBook('21', 'Сергиев Посад', 'Ирина Морозова', 'culture', 4.7, 980, 69),
        createTestBook('22', 'Александров', 'Павел Соколов', 'attractions', 4.3, 750, 51),
        createTestBook('23', 'Углич', 'Ольга Волкова', 'culture', 4.4, 820, 58),
        createTestBook('24', 'Мышкин', 'Андрей Новиков', 'attractions', 4.2, 680, 44),
        createTestBook('25', 'Тутаев', 'Елена Козлова', 'mixed', 4.0, 590, 37),
        createTestBook('26', 'Рыбинск', 'Дмитрий Петров', 'attractions', 3.9, 520, 31),
        createTestBook('27', 'Калязин', 'Светлана Морозова', 'culture', 3.8, 480, 26)
      ];
      
      // Сначала показываем тестовые данные
      console.log('📚 BooksGrid: Показываем тестовые данные:', testBooks.length, 'книг');
      setBooks(testBooks);
      setLoading(false);
      
      // Затем в фоне загружаем реальные данные
      try {
        const booksData = await bookService.listMyBooks();
        console.log('📚 BooksGrid: Получены данные книг:', booksData);
        if (Array.isArray(booksData) && booksData.length > 0) {
          // Объединяем тестовые данные с реальными данными
          setBooks([...testBooks, ...booksData]);
        } else {
          console.log('📚 BooksGrid: API вернул пустой массив, оставляем тестовые данные');
          // Оставляем тестовые данные, если API не работает или возвращает пустой массив
        }
      } catch (apiError) {
        console.error('❌ BooksGrid: Ошибка загрузки книг с API:', apiError);
        console.log('📚 BooksGrid: Оставляем тестовые данные из-за ошибки API');
        // Оставляем тестовые данные, если API не работает
      }
      
    } catch (error) {
      console.error('❌ BooksGrid: Общая ошибка загрузки книг:', error);
      // В случае общей ошибки показываем тестовые данные
      const fallbackBooks = [
        createTestBook('fallback1', 'Путешествие по Золотому кольцу', 'Анна Иванова', 'attractions', 4.8, 1250, 89)
      ];
      setBooks(fallbackBooks);
      setLoading(false);
    }
  };

  // Используем только книги из состояния (уже включают тестовые данные)
  const allBooks = books;

  // Фильтрация книг
  const filteredBooks = allBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (book.description && book.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterBy === 'rating') {
      // Простая проверка рейтинга без хука
      return book.rating && book.rating >= 4;
    }
    
    return matchesSearch;
  });

  // Пагинация - показываем по 9 книг на странице
  const itemsPerPage = 9;
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBooks = filteredBooks.slice(startIndex, endIndex);
  
  console.log('📚 BooksGrid: Рендер - всего книг:', allBooks.length, 'отфильтровано:', filteredBooks.length, 'на странице:', currentBooks.length, 'страница:', currentPage + 1, 'из', totalPages);

  // Функции для навигации
  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">КНИГИ</h2>
          <div className="text-sm text-gray-600">
            ПОИСК/ОТБОР ПО РЕЙТИНГУ/ДАТЕ ДОБАВЛЕНИЯ
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка книг...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-2 flex flex-col h-full">
      
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-3 gap-4 flex-1">
          {currentBooks.map((book) => {
            // Определяем цвета на основе категории книги
            const getBookColors = (category: string) => {
              switch (category) {
                case 'attractions':
                  return { cover: '#92400e', spine: '#8b4513', border: '#8b4513', corner: '#fbbf24', text: '#ffffff' };
                case 'events':
                  return { cover: '#1e40af', spine: '#1e3a8a', border: '#1e3a8a', corner: '#3b82f6', text: '#ffffff' };
                case 'mixed':
                  return { cover: '#166534', spine: '#14532d', border: '#14532d', corner: '#22c55e', text: '#ffffff' };
                case 'routes':
                  return { cover: '#7c2d12', spine: '#5c1a0a', border: '#5c1a0a', corner: '#ea580c', text: '#ffffff' };
                case 'nature':
                  return { cover: '#059669', spine: '#047857', border: '#047857', corner: '#10b981', text: '#ffffff' };
                case 'culture':
                  return { cover: '#7c2d12', spine: '#5c1a0a', border: '#5c1a0a', corner: '#dc2626', text: '#ffffff' };
                case 'adventure':
                  return { cover: '#7c2d12', spine: '#5c1a0a', border: '#5c1a0a', corner: '#f59e0b', text: '#ffffff' };
                default:
                  return { cover: '#92400e', spine: '#8b4513', border: '#8b4513', corner: '#fbbf24', text: '#ffffff' };
              }
            };

            const colors = getBookColors(book.category);
            
            return (
          <div
            key={book.id}
            onMouseEnter={() => setHoveredBook(book.id)}
            onMouseLeave={() => setHoveredBook(null)}
                className="flex flex-col items-center"
          >
                <DynamicBookTemplate
              title={book.title}
                  author={book.author_name || "Автор"}
                  coverColor={colors.cover}
                  spineColor={colors.spine}
                  borderColor={colors.border}
                  cornerColor={colors.corner}
                  textColor={colors.text}
                  width={120}
                  height={144}
              onClick={() => onBookOpen(book as Book)}
                  isInteractive={true}
                  className="mb-2"
                />
                
                {/* Информация о книге */}
                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-800 mb-1 truncate max-w-[120px]">
                    {book.title}
                  </h3>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs text-yellow-500">★</span>
                    <span className="text-xs text-gray-600">{book.rating?.toFixed(1) || '0.0'}</span>
                    <span className="text-xs text-gray-500">({book.ratings_count || 0})</span>
                  </div>
                </div>
          </div>
            );
          })}
      </div>
      
        {currentBooks.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Книги не найдены
        </div>
      )}

        {/* Стильные кнопки навигации */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-3">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <ChevronLeft className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:-translate-x-0.5" />
              <span className="relative z-10 font-medium text-sm">Назад</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            </button>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-md border border-gray-200">
              <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">
                {currentPage + 1} / {totalPages}
              </span>
            </div>
            
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10 font-medium text-sm">Вперед</span>
              <ChevronRight className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:translate-x-0.5" />
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BooksGrid;
