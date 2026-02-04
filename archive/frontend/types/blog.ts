export interface Blog {
  id: string; // UUID из базы данных
  title: string;
  content: string;
  excerpt?: string; // Краткое описание
  cover_image_url?: string; // URL обложки
  status?: 'draft' | 'published';
  tags?: string[]; // Теги/категории
  related_route_id?: string | null; // ID связанного маршрута
  related_markers?: string[]; // ID связанных меток
  related_events?: string[]; // ID связанных событий
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  reading_time?: number;
  rating?: number; // Рейтинг блога (0-5)
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  // Дополнительные поля для совместимости с фронтендом
  author?: string;
  author_name?: string;
  author_avatar?: string;
  category?: string;
  preview?: string;
  date?: string;
  images?: string[];
  favoriteRouteId?: string; // Для совместимости
  geoType?: 'point' | 'route' | 'event'; // Тип гео-контента
  
  // === УНИВЕРСАЛЬНЫЕ ПОЛЯ ДЛЯ БУДУЩИХ ВЕРСИЙ ===
  // Эти поля будут использоваться в MVP 2.0, но не нарушают текущую работу
  
  // Система сложности и весов (MVP 2.0)
  complexity_level?: 1 | 2 | 3 | 4 | 5; // Уровень сложности блога
  value_weight?: number; // Вес блога в системе влияния
  is_auto_enhanced?: boolean; // Автоматически улучшен?
  auto_enhancement_date?: string; // Дата автоматического улучшения
  
  // Модули блогов (MVP 2.0)
  modules?: BlogModule[]; // Дополнительные модули
  
  // Система версий и форков (MVP 2.0)
  parent_blog_id?: string; // ID родительского блога (для форков)
  is_original?: boolean; // Оригинальный блог?
  version?: number; // Версия блога
  fork_description?: string; // Описание форка
  
  // Расширенная аналитика (MVP 2.0)
  engagement_score?: number; // Оценка вовлеченности
  quality_score?: number; // Оценка качества
  trending_score?: number; // Оценка трендовости
  
  // Система тегов и категорий (MVP 2.0)
  primary_tags?: string[]; // Основные теги
  secondary_tags?: string[]; // Вторичные теги
  topic_clusters?: string[]; // Кластеры тем
  
  // Географические данные (MVP 2.0)
  location_data?: {
    coordinates?: [number, number]; // Координаты центра
    radius?: number; // Радиус охвата
    regions?: string[]; // Регионы
    countries?: string[]; // Страны
  };
  
  // Временные данные (MVP 2.0)
  temporal_data?: {
    seasonal_relevance?: string[]; // Сезонная релевантность
    time_periods?: string[]; // Временные периоды
    event_dates?: string[]; // Даты событий
  };
  
  // Метаданные для AI (MVP 2.0)
  ai_metadata?: {
    content_summary?: string; // AI-резюме контента
    sentiment_analysis?: 'positive' | 'neutral' | 'negative'; // Анализ тональности
    key_topics?: string[]; // Ключевые темы
    language_complexity?: 'simple' | 'medium' | 'complex'; // Сложность языка
  };
  
  // Данные конструктора (для черновиков)
  constructor_data?: any;
  
  // Данные обложки блога
  cover_data?: {
    title: string;
    description: string;
    gradient: string;
    textColor: string;
    titleFont: string;
    descriptionFont: string;
  };
}

// Новый интерфейс для модулей блогов (MVP 2.0)
export interface BlogModule {
  id: string;
  type: 'map' | 'route' | 'event' | 'gallery' | 'ai_insights' | 'interactive_map' | 'timeline' | 'quiz' | 'poll';
  data: any; // Данные модуля
  order_index: number; // Порядок модуля
  is_auto_generated: boolean; // Автоматически создан?
  is_user_created: boolean; // Создан пользователем?
  created_at: string;
  is_active: boolean; // Активен ли модуль
}

export interface BlogFormData {
  title: string;
  author: string;
  category: string;
  content: string;
  preview: string;
  images: string[];
  favoriteRouteId?: string;
  related_markers?: string[]; // Обновляем для соответствия с базой данных
}

export const BLOG_CATEGORIES = {
  gastronomy: 'Гастрономия',
  nature: 'Природа и тропы',
  culture: 'Культура',
  adventure: 'Приключения',
  routes: 'Маршруты'
} as const;

export type BlogCategory = keyof typeof BLOG_CATEGORIES;

// === ТИПЫ ДЛЯ ИНТЕРАКТИВНЫХ БЛОКОВ (КОНСТРУКТОР ЖИВЫХ ПУТЕВОДИТЕЛЕЙ) ===

// Типы состояний для абзацев
export type StateType = 'marker' | 'route' | 'event' | null;

// Интерфейс для абзаца блога
export interface BlogParagraph {
  id: string;
  text: string;
  type?: 'text' | 'image' | 'content';
  state: {
    type: StateType;
    data: any; // Используем any для совместимости с разными типами
  };
  content?: any; // Связанный контент
  photos: string[];
  links: string[];
  order: number;
}

// Данные для метки
export interface MarkerData {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
  category?: string;
  images?: string[];
}

// Данные для маршрута
export interface RouteData {
  id: string;
  name: string;
  waypoints: Array<{
    coordinates: [number, number];
    name: string;
  }>;
  distance?: number;
  duration?: number;
  description?: string;
}

// Данные для события
export interface EventData {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  participants?: string[];
  
  // Новые поля для визуальных состояний:
  is_user_modified?: boolean; // Пользователь изменил (неоновый эффект)
  used_in_blogs?: boolean; // Используется в блогах (золотистая рамка)
}

// Конструктор блога
export interface BlogSegment {
  id: string;
  paragraphId: string;
  coordinates: number[][];
  highlight: string;
  title: string;
  description?: string;
}

export interface BlogConstructor {
  paragraphs: BlogParagraph[];
  photos: string[];
  links: string[];
  title: string;
  preview?: string;
  category?: string;
  geoType?: 'point' | 'route' | 'event';
  tools?: string[];
  segments?: BlogSegment[];
}

// === СИСТЕМА КНИГ ===

// Интерфейс для книги
export interface Book {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  category: BookCategory;
  blogs: Blog[];
  rating: number;
  ratings_count: number;
  views_count: number;
  likes_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published' | 'archived';
  
  // Пользовательская обложка книги (URL изображения)
  custom_cover_url?: string;
}

// Категории книг
export const BOOK_CATEGORIES = {
  attractions: 'Достопримечательности',
  events: 'События',
  mixed: 'Смешанная',
  routes: 'Маршруты',
  nature: 'Природа',
  culture: 'Культура',
  adventure: 'Приключения'
} as const;

export type BookCategory = keyof typeof BOOK_CATEGORIES;

// Интерфейс для рейтинга
export interface BookRating {
  id: string;
  book_id: string;
  user_id: string;
  rating: number; // 1-5 звезд
  comment?: string;
  created_at: string;
}

// Интерфейс для комментария
export interface BookComment {
  id: string;
  book_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
}