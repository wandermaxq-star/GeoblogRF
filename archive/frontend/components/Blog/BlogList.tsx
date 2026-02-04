import React, { useState } from 'react';
import BlogCard from './BlogCard';
import { Blog } from '../../types/blog';

interface BlogListProps {
  blogs: Blog[];
  onCreateNew?: () => void;
  onViewBlog: (blog: Blog) => void;
}

const BlogList: React.FC<BlogListProps> = ({ blogs, onCreateNew, onViewBlog }) => {
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { value: 'all', label: 'Все категории' },
    { value: 'gastronomy', label: 'Гастрономия' },
    { value: 'nature', label: 'Природа и тропы' },
    { value: 'culture', label: 'Культура' },
    { value: 'adventure', label: 'Приключения' },
    { value: 'routes', label: 'Маршруты' }
  ];

  const filteredBlogs = blogs.filter(blog => {
    const matchesCategory = filterCategory === 'all' || blog.category === filterCategory;
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (blog.author || blog.author_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Блоги и отзывы о путешествиях</h2>
          {onCreateNew && (
            <button 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={onCreateNew}
            >
              Создать блог
            </button>
          )}
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Поиск по названию или автору..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.length > 0 ? (
            filteredBlogs.map(blog => (
              <BlogCard 
                key={blog.id} 
                blog={blog} 
                onClick={() => onViewBlog(blog)}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">Блоги не найдены</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogList; 