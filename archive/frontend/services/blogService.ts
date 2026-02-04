import { Blog, BlogModule } from '../types/blog';

// Универсальный сервис для работы с блогами
// Поддерживает как простые, так и продвинутые функции (MVP 2.0)
export class BlogService {
  
  // === БАЗОВЫЕ ФУНКЦИИ (MVP 1.0) ===
  
  // Создание простого блога
  static createSimpleBlog(blogData: Partial<Blog>): Blog {
    return {
      id: blogData.id || this.generateId(),
      title: blogData.title || '',
      content: blogData.content || '',
      preview: blogData.preview || '',
      category: blogData.category || 'other',
      author: blogData.author || 'Текущий пользователь',
      author_name: blogData.author_name || 'Текущий пользователь',
      author_avatar: blogData.author_avatar || '',
      created_at: blogData.created_at || new Date().toISOString(),
      updated_at: blogData.updated_at || new Date().toISOString(),
      published_at: blogData.published_at || new Date().toISOString(),
      status: blogData.status || 'published',
      views_count: blogData.views_count || 0,
      likes_count: blogData.likes_count || 0,
      comments_count: blogData.comments_count || 0,
      reading_time: blogData.reading_time || 5,
      excerpt: blogData.preview || '',
      cover_image_url: blogData.cover_image_url || '',
      tags: blogData.tags || [],
      related_route_id: blogData.related_route_id || undefined,
      related_markers: blogData.related_markers || [],
      images: blogData.images || [],
      favoriteRouteId: blogData.favoriteRouteId || '',
      geoType: blogData.geoType || 'point',
      
      // Универсальные поля по умолчанию
      complexity_level: 1,
      value_weight: 1.0,
      is_auto_enhanced: false,
      is_original: true,
      version: 1,
      modules: [],
      primary_tags: blogData.category ? [blogData.category] : [],
      secondary_tags: [],
      temporal_data: {
        seasonal_relevance: [],
        time_periods: [],
        event_dates: []
      },
      ai_metadata: {
        content_summary: undefined,
        sentiment_analysis: 'neutral',
        key_topics: [],
        language_complexity: 'medium'
      }
    };
  }
  
  // === ПРОДВИНУТЫЕ ФУНКЦИИ (MVP 2.0) ===
  
  // Обновление уровня сложности блога
  static updateBlogComplexity(blog: Blog, newLevel: 1 | 2 | 3 | 4 | 5): Blog {
    const complexityMultipliers = {
      1: 1.0,   // Простой
      2: 1.5,   // Базовый
      3: 2.0,   // Расширенный
      4: 3.0,   // Профессиональный
      5: 5.0    // Экспертный
    };
    
    return {
      ...blog,
      complexity_level: newLevel,
      value_weight: complexityMultipliers[newLevel],
      updated_at: new Date().toISOString()
    };
  }
  
  // Добавление модуля к блогу
  static addBlogModule(blog: Blog, module: Omit<BlogModule, 'id' | 'created_at'>): Blog {
    const newModule: BlogModule = {
      ...module,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    
    return {
      ...blog,
      modules: [...(blog.modules || []), newModule],
      updated_at: new Date().toISOString()
    };
  }
  
  // Автоматическое улучшение блога (MVP 2.0)
  static autoEnhanceBlog(blog: Blog): Blog {
    // Анализируем контент и автоматически добавляем модули
    const enhancements: BlogModule[] = [];
    
    // Если есть связанные метки, добавляем модуль карты
    if (blog.related_markers && blog.related_markers.length > 0) {
      enhancements.push({
        id: this.generateId(),
        type: 'map',
        data: { 
          markers: blog.related_markers,
          description: 'Автоматически созданная карта связанных мест'
        },
        order_index: 1,
        is_auto_generated: true,
        is_user_created: false,
        created_at: new Date().toISOString(),
        is_active: true
      });
    }
    
    // Если есть связанный маршрут, добавляем модуль маршрута
    if (blog.related_route_id || blog.favoriteRouteId) {
      enhancements.push({
        id: this.generateId(),
        type: 'route',
        data: { 
          route_id: blog.related_route_id || blog.favoriteRouteId,
          description: 'Автоматически созданный модуль маршрута'
        },
        order_index: 2,
        is_auto_generated: true,
        is_user_created: false,
        created_at: new Date().toISOString(),
        is_active: true
      });
    }
    
    // Если есть изображения, добавляем модуль галереи
    if (blog.images && blog.images.length > 0) {
      enhancements.push({
        id: this.generateId(),
        type: 'gallery',
        data: { 
          images: blog.images,
          description: 'Автоматически созданная галерея изображений'
        },
        order_index: 3,
        is_auto_generated: true,
        is_user_created: false,
        created_at: new Date().toISOString(),
        is_active: true
      });
    }
    
    // Повышаем уровень сложности на основе количества модулей
    const newComplexityLevel = Math.min(5, 1 + Math.floor(enhancements.length / 2)) as 1 | 2 | 3 | 4 | 5;
    
    return {
      ...blog,
      modules: [...(blog.modules || []), ...enhancements],
      complexity_level: newComplexityLevel,
      value_weight: this.getComplexityMultiplier(newComplexityLevel),
      is_auto_enhanced: true,
      auto_enhancement_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  // Создание форка блога (MVP 2.0)
  static createBlogFork(originalBlog: Blog, forkData: Partial<Blog>): Blog {
    return {
      ...this.createSimpleBlog(forkData),
      parent_blog_id: originalBlog.id,
      is_original: false,
      version: (originalBlog.version || 1) + 1,
      fork_description: forkData.fork_description || 'Форк оригинального блога',
      complexity_level: 1, // Форк начинается с простого уровня
      value_weight: 1.0,
      modules: [], // Форк начинается без модулей
      is_auto_enhanced: false
    };
  }
  
  // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
  
  // Генерация уникального ID
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  // Получение множителя сложности
  private static getComplexityMultiplier(level: number): number {
    const multipliers = { 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0, 5: 5.0 };
    return multipliers[level as keyof typeof multipliers] || 1.0;
  }
  
  // Проверка совместимости блога с текущей версией
  static isCompatibleWithCurrentVersion(_blog: Blog): boolean {
    // Все блоги совместимы благодаря универсальным полям
    return true;
  }
  
  // Миграция старого блога к новой версии
  static migrateBlogToNewVersion(oldBlog: any): Blog {
    // Если блог уже в новом формате, возвращаем как есть
    if (oldBlog.complexity_level !== undefined) {
      return oldBlog as Blog;
    }
    
    // Мигрируем старый блог к новому формату
    return this.createSimpleBlog({
      ...oldBlog,
      complexity_level: 1,
      value_weight: 1.0,
      is_auto_enhanced: false,
      is_original: true,
      version: 1,
      modules: [],
      primary_tags: oldBlog.category ? [oldBlog.category] : [],
      secondary_tags: [],
      temporal_data: {
        seasonal_relevance: [],
        time_periods: [],
        event_dates: []
      },
      ai_metadata: {
        content_summary: undefined,
        sentiment_analysis: 'neutral',
        key_topics: [],
        language_complexity: 'medium'
      }
    });
  }
  
  // Получение статистики блога
  static getBlogStats(blog: Blog) {
    return {
      totalModules: blog.modules?.length || 0,
      autoGeneratedModules: blog.modules?.filter(m => m.is_auto_generated).length || 0,
      userCreatedModules: blog.modules?.filter(m => m.is_user_created).length || 0,
      complexityLevel: blog.complexity_level || 1,
      valueWeight: blog.value_weight || 1.0,
      isEnhanced: blog.is_auto_enhanced || false,
      enhancementDate: blog.auto_enhancement_date
    };
  }
}

export default BlogService;










