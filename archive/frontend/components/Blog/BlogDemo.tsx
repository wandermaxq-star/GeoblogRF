import React, { useState } from 'react';
import { Blog } from '../../types/blog';
import { 
  Star,
  Bot
} from 'lucide-react';
import { BlogService } from '../../services/blogService';
import BlogStats from './BlogStats';

const BlogDemo: React.FC = () => {
  const [currentBlog, setCurrentBlog] = useState<Blog | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Создаем простой блог
  const createSimpleBlog = () => {
    const blog = BlogService.createSimpleBlog({
      title: 'Мой первый блог',
      content: 'Это простой блог без продвинутых функций. Он будет работать и в простом, и в продвинутом режиме.',
      category: 'travel',
      author: 'Демо пользователь'
    });
    setCurrentBlog(blog);
    setShowAdvanced(false);
  };

  // Создаем продвинутый блог
  const createAdvancedBlog = () => {
    const simpleBlog = BlogService.createSimpleBlog({
      title: 'Продвинутый блог с модулями',
      content: 'Этот блог демонстрирует продвинутые функции MVP 2.0: модули, автоматическое улучшение, сложность.',
      category: 'culture',
      author: 'Демо пользователь'
    });
    
    // Автоматически улучшаем блог
    const enhancedBlog = BlogService.autoEnhanceBlog(simpleBlog);
    setCurrentBlog(enhancedBlog);
    setShowAdvanced(true);
  };

  // Обновляем сложность блога
  const updateComplexity = (level: 1 | 2 | 3 | 4 | 5) => {
    if (currentBlog) {
      const updatedBlog = BlogService.updateBlogComplexity(currentBlog, level);
      setCurrentBlog(updatedBlog);
    }
  };

  // Добавляем модуль
  const addModule = () => {
    if (currentBlog) {
      const module = {
        type: 'quiz' as const,
        data: { 
          question: 'Что вы думаете об этом блоге?',
          options: ['Отлично!', 'Хорошо', 'Нормально', 'Плохо']
        },
        order_index: (currentBlog.modules?.length || 0) + 1,
        is_auto_generated: false,
        is_user_created: true,
        is_active: true
      };
      
      const updatedBlog = BlogService.addBlogModule(currentBlog, module);
      setCurrentBlog(updatedBlog);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Демонстрация универсальной системы блогов</h1>
      
      {/* Кнопки управления */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={createSimpleBlog}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Создать простой блог
          </button>
          <button
            onClick={createAdvancedBlog}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
          >
            Создать продвинутый блог
          </button>
        </div>
        
        {currentBlog && (
          <div className="flex gap-4">
            <button
              onClick={addModule}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
            >
              Добавить модуль
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
            >
              {showAdvanced ? 'Скрыть' : 'Показать'} продвинутые функции
            </button>
          </div>
        )}
      </div>

      {/* Отображение блога */}
      {currentBlog && (
        <div className="space-y-6">
          {/* Заголовок и основная информация */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{currentBlog.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span>Автор: {currentBlog.author}</span>
              <span>•</span>
              <span>Категория: {currentBlog.category}</span>
              <span>•</span>
              <span>Создан: {currentBlog.created_at ? new Date(currentBlog.created_at).toLocaleDateString('ru-RU') : 'Не указано'}</span>
            </div>
            <div className="text-gray-700 leading-relaxed">
              {currentBlog.content}
            </div>
          </div>

          {/* Статистика блога */}
          <BlogStats blog={currentBlog} showAdvanced={showAdvanced} />

          {/* Продвинутые функции (MVP 2.0) */}
          {showAdvanced && currentBlog.complexity_level && currentBlog.complexity_level > 1 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="text-yellow-500" />
                Продвинутые функции MVP 2.0
              </h3>
              
              {/* Управление сложностью */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-800 mb-3">Уровень сложности</h4>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => updateComplexity(level as 1 | 2 | 3 | 4 | 5)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        currentBlog.complexity_level === level
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Уровень {level}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Текущий уровень: {currentBlog.complexity_level} 
                  (вес в системе: x{currentBlog.value_weight})
                </p>
              </div>

              {/* Модули */}
              {currentBlog.modules && currentBlog.modules.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <Bot className="text-yellow-500" />
                    Модули блога ({currentBlog.modules.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentBlog.modules.map((module) => (
                      <div key={module.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">
                            {module.is_auto_generated ? '🤖 Автоматически' : '✏️ Пользователь'}
                          </span>
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {module.type}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {module.data?.description || `Модуль типа ${module.type}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Информация об улучшении */}
              {currentBlog.is_auto_enhanced && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <span className="text-lg">✨</span>
                    <span className="font-medium">Автоматически улучшен</span>
                  </div>
                  {currentBlog.auto_enhancement_date && (
                    <p className="text-sm text-green-600 mt-1">
                      Дата улучшения: {new Date(currentBlog.auto_enhancement_date).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Информация о совместимости */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-lg font-medium text-blue-800 mb-2">Совместимость</h4>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <div className={`w-3 h-3 rounded-full ${BlogService.isCompatibleWithCurrentVersion(currentBlog) ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>
                {BlogService.isCompatibleWithCurrentVersion(currentBlog) 
                  ? '✅ Полностью совместим с текущей версией' 
                  : '❌ Требует обновления'
                }
              </span>
            </div>
            <p className="text-sm text-blue-600 mt-2">
              Этот блог будет работать корректно как в MVP 1.0, так и в MVP 2.0 благодаря универсальной архитектуре.
            </p>
          </div>
        </div>
      )}

      {/* Инструкции */}
      {!currentBlog && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Как это работает</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>Простой блог</strong> - создается с базовыми полями, работает в MVP 1.0</p>
            <p>• <strong>Продвинутый блог</strong> - автоматически получает модули и повышенную сложность</p>
            <p>• <strong>Универсальность</strong> - все блоги совместимы между версиями</p>
            <p>• <strong>Обратная совместимость</strong> - старые блоги работают в новых версиях</p>
            <p>• <strong>Автоматическое улучшение</strong> - система сама добавляет модули на основе контента</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogDemo;
