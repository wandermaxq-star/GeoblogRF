import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Filter } from 'lucide-react';
import { Book } from '../../types/blog';
import BookCard from './BookCard';
import { bookService } from '../../services/bookService';

interface BooksListProps {
  onBookOpen: (book: Book) => void;
  onBookCreate: () => void;
  onBookToggleFavorite?: (bookId: string) => void;
  title?: string;
  showCreateButton?: boolean;
}

const BooksList: React.FC<BooksListProps> = ({
  onBookOpen,
  onBookCreate,
  onBookToggleFavorite,
  title = "Мои книги",
  showCreateButton = true
}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const booksData = await bookService.listMyBooks();
      setBooks(Array.isArray(booksData) ? booksData : []);
    } catch (error) {
      console.error('Ошибка загрузки книг:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.author_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || book.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { key: 'all', label: 'Все категории' },
    { key: 'attractions', label: 'Достопримечательности' },
    { key: 'events', label: 'События' },
    { key: 'mixed', label: 'Смешанная' },
    { key: 'routes', label: 'Маршруты' },
    { key: 'nature', label: 'Природа' },
    { key: 'culture', label: 'Культура' },
    { key: 'adventure', label: 'Приключения' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка книг...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок и кнопка создания */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <span className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full">
            {books.length}
          </span>
        </div>
        
        {showCreateButton && (
          <button
            onClick={onBookCreate}
            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Создать книгу</span>
          </button>
        )}
      </div>

      {/* Поиск и фильтры */}
      <div className="flex space-x-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
              type="text"
            placeholder="Поиск по названию, автору или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
          >
            {categories.map(category => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Список книг */}
        {filteredBooks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || filterCategory !== 'all' ? 'Книги не найдены' : 'Нет книг'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || filterCategory !== 'all' 
                ? 'Попробуйте изменить поисковый запрос или фильтр'
                : 'Создайте свою первую книгу, объединив несколько блогов'
              }
            </p>
            {showCreateButton && (
              <button
                onClick={onBookCreate}
                className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Создать книгу</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map(book => (
                <BookCard
                  key={book.id}
                  title={book.title}
                  coverImage={book.cover_image_url}
                  rating={book.rating || 0}
                  onClick={() => onBookOpen(book)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BooksList;
