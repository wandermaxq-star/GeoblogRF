import React, { useState } from 'react';
import { Blog } from '../../types/blog';
import PaperCard from './PaperCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BlogsGridProps {
  blogs: Blog[];
  onViewBlog: (blog: Blog) => void;
  searchQuery: string;
  filterBy: string;
}

const BlogsGrid: React.FC<BlogsGridProps> = ({ blogs, onViewBlog, searchQuery, filterBy }) => {
  const [hoveredBlog, setHoveredBlog] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Фильтрация блогов
  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (blog.excerpt && blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterBy === 'rating') {
      // Простая проверка рейтинга без хука
      return blog.rating && blog.rating >= 4;
    }
    
    return matchesSearch;
  });

  // Пагинация - показываем по 9 блогов на странице
  const itemsPerPage = 9;
  const totalPages = Math.ceil(filteredBlogs.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBlogs = filteredBlogs.slice(startIndex, endIndex);

  // Функции для навигации
  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };


  return (
    <div className="flex-1 p-2 flex flex-col h-full">
      
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-3 gap-4 flex-1 ml-24">
          {currentBlogs.map((blog) => (
            <div
              key={blog.id}
              onMouseEnter={() => setHoveredBlog(blog.id)}
              onMouseLeave={() => setHoveredBlog(null)}
            >
              <PaperCard
                title={blog.title}
                rating={blog.rating || 0}
                isHovered={hoveredBlog === blog.id}
                onClick={() => onViewBlog(blog)}
                className="mx-auto"
                coverData={blog.cover_data}
              />
            </div>
          ))}
        </div>
        
        {currentBlogs.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Блоги не найдены
          </div>
        )}

        {/* Стильные кнопки навигации */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-3">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <ChevronLeft className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:-translate-x-0.5" />
              <span className="relative z-10 font-medium text-sm">Назад</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            </button>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-md border border-gray-200">
              <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">
                {currentPage + 1} / {totalPages}
              </span>
            </div>
            
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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

export default BlogsGrid;
