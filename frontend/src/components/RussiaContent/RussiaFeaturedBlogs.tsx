/**
 * Компонент с избранными блогами и постами о местах России
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FeaturedBlog {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  author: string;
  type: 'post';
  description: string;
  icon: string;
}

// Пока используем статический контент. В будущем будет динамически загружаться из API
const FEATURED_BLOGS: FeaturedBlog[] = [
  {
    id: '1',
    title: 'Путешествие по Эрмитажу',
    location: 'Санкт-Петербург',
    lat: 59.9398,
    lng: 30.3146,
    author: 'Анна Петрова',
    type: 'post',
    description: 'Уникальная коллекция мирового искусства и истории',
    icon: 'fa-university'
  },
  {
    id: '2',
    title: 'Исследование Красной площади',
    location: 'Москва',
    lat: 55.7539,
    lng: 37.6208,
    author: 'Иван Сидоров',
    type: 'post',
    description: 'Историческое сердце столицы и её главные достопримечательности',
    icon: 'fa-monument'
  },

  {
    id: '3',
    title: 'Тайны Московского Кремля',
    location: 'Москва',
    lat: 55.7520,
    lng: 37.6173,
    author: 'Мария Иванова',
    type: 'post',
    description: 'Фоторепортаж о древних стенах и соборах',
    icon: 'fa-fort-awesome'
  },
  {
    id: '4',
    title: 'Зимний дворец: история и искусство',
    location: 'Санкт-Петербург',
    lat: 59.9390,
    lng: 30.3150,
    author: 'Пётр Волков',
    type: 'post',
    description: 'Сокровища императорской коллекции',
    icon: 'fa-crown'
  }
];

interface RussiaFeaturedBlogsProps {
  maxItems?: number;
}

const RussiaFeaturedBlogs: React.FC<RussiaFeaturedBlogsProps> = ({ 
  maxItems = 4 
}) => {
  const navigate = useNavigate();

  const handleBlogClick = (blog: FeaturedBlog) => {
    // Переходим на карту с фокусом на это место
    navigate('/map', { 
      state: { 
        focusLocation: { 
          lat: blog.lat, 
          lng: blog.lng, 
          zoom: 15,
          title: blog.title 
        } 
      } 
    });
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          📚 Популярные посты
        </h2>
        <p className="text-gray-600">
          Читайте о путешествиях других пользователей
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURED_BLOGS.slice(0, maxItems).map((blog) => (
          <div
            key={blog.id}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer group"
            onClick={() => handleBlogClick(blog)}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <i className={`fas ${blog.icon} text-2xl text-white`}></i>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                {blog.title}
              </h3>
              
              <p className="text-sm text-gray-500 mb-2">
                {blog.location}
              </p>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {blog.description}
              </p>

              <div className="flex items-center justify-center text-xs text-gray-500">
                <i className="fas fa-user-circle mr-1"></i>
                <span>{blog.author}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
                  <i className={`fas fa-edit mr-1`}></i>
                  Пост
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {maxItems < FEATURED_BLOGS.length && (
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/posts')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
          >
            Посмотреть все посты
          </button>
        </div>
      )}
    </div>
  );
};

export default RussiaFeaturedBlogs;



