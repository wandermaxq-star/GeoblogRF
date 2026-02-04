// Система категорий маршрутов
export interface RouteCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  purpose: 'personal' | 'event' | 'shared' | 'draft' | 'post';
  maxRoutes: number; // Лимит для категории
  description: string;
  isDefault?: boolean;
}

export const ROUTE_CATEGORIES: RouteCategory[] = [
  {
    id: 'personal',
    name: 'Личные маршруты',
    icon: '●',
    color: '#4ECDC4',
    purpose: 'personal',
    maxRoutes: 20,
    description: 'Ваши личные маршруты для путешествий и прогулок',
    isDefault: true
  },

  {
    id: 'post',
    name: 'Для постов',
    icon: '●',
    color: '#3B82F6',
    purpose: 'post',
    maxRoutes: 30,
    description: 'Маршруты для создания постов'
  },
  {
    id: 'event',
    name: 'События',
    icon: '●',
    color: '#FF6B6B',
    purpose: 'event',
    maxRoutes: 30,
    description: 'Маршруты для мероприятий и встреч'
  }
];

// Получить категорию по ID
export const getCategoryById = (id: string): RouteCategory | undefined => {
  return ROUTE_CATEGORIES.find(cat => cat.id === id);
};

// Получить категорию по назначению
export const getCategoryByPurpose = (purpose: string): RouteCategory | undefined => {
  return ROUTE_CATEGORIES.find(cat => cat.purpose === purpose);
};

// Получить все категории для определенного назначения
export const getCategoriesByPurpose = (purpose: string): RouteCategory[] => {
  return ROUTE_CATEGORIES.filter(cat => cat.purpose === purpose);
};

// Проверить лимит категории
export const checkCategoryLimit = (categoryId: string, currentCount: number, isVip: boolean = false): boolean => {
  const category = getCategoryById(categoryId);
  if (!category) return false;
  
  // VIP пользователи имеют увеличенные лимиты
  const limit = isVip ? category.maxRoutes * 3 : category.maxRoutes;
  return currentCount < limit;
};

// Получить оставшееся количество маршрутов в категории
export const getRemainingRoutes = (categoryId: string, currentCount: number, isVip: boolean = false): number => {
  const category = getCategoryById(categoryId);
  if (!category) return 0;
  
  const limit = isVip ? category.maxRoutes * 3 : category.maxRoutes;
  return Math.max(0, limit - currentCount);
};
