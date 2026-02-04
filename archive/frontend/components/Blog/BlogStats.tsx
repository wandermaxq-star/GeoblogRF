import React from 'react';
import { Blog } from '../../types/blog';
import BlogService from '../../services/blogService';
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Clock, 
  Star, 
  Lightbulb, 
  TrendingUp, 
  CheckCircle,
  BarChart3,
  Zap,
  PenTool
} from 'lucide-react';

interface BlogStatsProps {
  blog: Blog;
  showAdvanced?: boolean; // Показывать ли продвинутые метрики
}

const BlogStats: React.FC<BlogStatsProps> = ({ blog, showAdvanced = false }) => {
  const stats = BlogService.getBlogStats(blog);
  
  // Базовые метрики (всегда показываем)
  const basicMetrics = [
    { 
      icon: Eye, 
      label: 'Просмотры', 
      value: blog.views_count || 0, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    { 
      icon: Heart, 
      label: 'Лайки', 
      value: blog.likes_count || 0, 
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    { 
      icon: MessageCircle, 
      label: 'Комментарии', 
      value: blog.comments_count || 0, 
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    { 
      icon: Clock, 
      label: 'Время чтения', 
      value: `${blog.reading_time || 5} мин`, 
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    }
  ];
  
  // Продвинутые метрики (только для MVP 2.0)
  const advancedMetrics = [
    { 
      icon: Star, 
      label: 'Уровень сложности', 
      value: stats.complexityLevel, 
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    { 
      icon: Lightbulb, 
      label: 'Модули', 
      value: stats.totalModules, 
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    },
    { 
      icon: TrendingUp, 
      label: 'Вес в системе', 
      value: `x${stats.valueWeight}`, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];
  
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
          <BarChart3 className="w-6 h-6 text-blue-600" />
        </div>
        Статистика блога
      </h3>
      
      {/* Базовые метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {basicMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div 
              key={index} 
              className={`group p-4 rounded-xl border-2 ${metric.bgColor} ${metric.borderColor} hover:shadow-md transition-all duration-300 transform hover:scale-105 cursor-pointer`}
            >
              <div className="text-center">
                <div className={`text-3xl font-bold ${metric.color} mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  {metric.value}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Icon size={16} className={`${metric.color} group-hover:scale-110 transition-transform duration-300`} />
                  <span className="font-medium">{metric.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Продвинутые метрики (MVP 2.0) */}
      {showAdvanced && stats.complexityLevel > 1 && (
        <>
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              Продвинутые метрики
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {advancedMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div 
                    key={index} 
                    className={`group p-4 rounded-xl border-2 ${metric.bgColor} ${metric.borderColor} hover:shadow-md transition-all duration-300 transform hover:scale-105 cursor-pointer`}
                  >
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${metric.color} mb-2 group-hover:scale-110 transition-transform duration-300`}>
                        {metric.value}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <Icon size={14} className={`${metric.color} group-hover:scale-110 transition-transform duration-300`} />
                        <span className="font-medium">{metric.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Дополнительная информация */}
          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium text-gray-700">Автоматически улучшен:</span>
                <span className={`ml-2 font-semibold ${stats.isEnhanced ? 'text-green-600' : 'text-gray-500'}`}>
                  {stats.isEnhanced ? 'Да' : 'Нет'}
                </span>
              </div>
              {stats.isEnhanced && stats.enhancementDate && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-700">Дата улучшения:</span>
                  <span className="ml-2 text-blue-600 font-semibold">
                    {new Date(stats.enhancementDate).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-700">Автоматические модули:</span>
                <span className="ml-2 text-blue-600 font-semibold">{stats.autoGeneratedModules}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <PenTool className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-gray-700">Пользовательские модули:</span>
                <span className="ml-2 text-indigo-600 font-semibold">{stats.userCreatedModules}</span>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Индикатор совместимости */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <div className={`w-3 h-3 rounded-full ${BlogService.isCompatibleWithCurrentVersion(blog) ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-green-700">
            {BlogService.isCompatibleWithCurrentVersion(blog) 
              ? '✅ Полностью совместим с текущей версией' 
              : '❌ Требует обновления'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default BlogStats;
