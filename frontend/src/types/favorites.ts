export interface FavoritePlace {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  coordinates: [number, number];
  type: string;
  rating: number;
  addedAt: Date;
  created_at: string;
  updated_at: string;
  
  // НОВОЕ: Категории вместо purpose
  categories: {
    personal: boolean;  // Всегда true (избранное)
    post: boolean;     // [ ] Посты
    event: boolean;    // [ ] События
  };
  
  // СТАРОЕ: оставляем для совместимости, но помечаем как deprecated
  /** @deprecated Используйте categories вместо purpose */
  purpose?: 'personal' | 'post' | 'event' | 'shared' | 'draft';
  category?: string; // Оставляем для совместимости
  
  tags: string[];
  visibility: 'private' | 'public' | 'friends';
  lastUsed?: Date;
  usageCount: number;
  relatedContent?: {
    events?: string[];
    posts?: string[];
  }; 
}

export interface FavoriteRoute {
  id: string;
  title: string;
  description?: string;
  waypoints?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    name?: string;
    description?: string;
    order: number;
  }>;
  
  // НОВОЕ: Категории вместо purpose
  categories: {
    personal: boolean;  // Всегда true (избранное)
    post: boolean;     // [ ] Посты
    event: boolean;    // [ ] События
  };
  
  // СТАРОЕ: оставляем для совместимости, но помечаем как deprecated
  /** @deprecated Используйте categories вместо purpose */
  purpose?: 'personal' | 'post' | 'event' | 'shared' | 'draft';
  category?: string; // Оставляем для совместимости
  
  created_at: string;
  updated_at: string;
}

export interface FavoriteEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location?: string;
  latitude: number;
  longitude: number;
  participants?: string;
  category: string;
  purpose: 'personal' | 'post' | 'event' | 'shared' | 'draft';
  created_at: string;
  updated_at: string;
}

