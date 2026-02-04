import { lazy } from 'react';

// Lazy loading для основных страниц
export const LazyHomePage = lazy(() => import('../pages/HomePage'));
export const LazyHome = lazy(() => import('../pages/Home'));
export const LazyMap = lazy(() => import('../pages/Map'));
export const LazyPlanner = lazy(() => {
  return import('../pages/Planner').then((module) => {
    return module;
  }).catch((error) => {
    throw error;
  });
});
export const LazyCalendar = lazy(() => import('../pages/Calendar'));
// Posts загружается СТАТИЧЕСКИ в PageLayer.tsx для немедленной загрузки при открытии проекта
// export const LazyPosts = lazy(() => import('../pages/Posts')); // УДАЛЕНО: теперь статический импорт
// Blog page removed — export harmless placeholder
export const LazyBlog = lazy(() => Promise.resolve({ default: () => null }));
export const LazyChat = lazy(() => import('../pages/ChatDisabled'));
export const LazyActivity = lazy(() => import('../pages/Activity'));
export const LazyCentrePage = lazy(() => import('../pages/CentrePage'));
export const LazyFriends = lazy(() => import('../pages/Friends'));
export const LazyTest = lazy(() => import('../pages/Test'));
// Удалён статический профиль (Анна Петрова). Используем модальный ProfilePanel.

// Lazy loading для аналитики
export const LazyAnalyticsDashboard = lazy(() => import('../analytics/dashboard/pages/AnalyticsDashboard'));

// Lazy loading для административных страниц
export const LazyModerationPage = lazy(() => import('../pages/ModerationPage'));
// Админ - подписки
export const LazyAdminSubscriptionsPage = lazy(() => import('../pages/AdminSubscriptionsPage'));

// Lazy loading для правовых страниц
export const LazyUserAgreement = lazy(() => import('../pages/UserAgreement'));
export const LazyPrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'));

// Lazy loading для тяжелых компонентов
// Blog/Book components were removed — provide harmless placeholders to avoid import errors.
export const LazyBlogConstructor = lazy(() => Promise.resolve({ default: () => null }));
export const LazyBlogEditor = lazy(() => Promise.resolve({ default: () => null }));
export const LazyBookView = lazy(() => Promise.resolve({ default: () => null }));
export const LazyTravelCalendar = lazy(() => import('../components/TravelCalendar/TravelCalendar'));
export const LazyPerformanceMonitor = lazy(() => import('../components/PerformanceMonitor'));

// Lazy loading для модерации
export const LazyModerationPanel = lazy(() => import('../components/Admin/ModerationPanel'));
export const LazyContentModerator = lazy(() => import('../components/Moderation/ContentModerator'));
export const LazyModerationWrapper = lazy(() => import('../components/Moderation/ModerationWrapper'));
export const LazyModerationStats = lazy(() => import('../components/Moderation/ModerationStats'));

// Lazy loading для карты
export const LazyMapComponent = lazy(() => import('../components/Map/Map'));
// MarkerPopup загружается статически в Map.tsx и PostMap.tsx, поэтому ленивая загрузка не нужна
// export const LazyMarkerPopup = lazy(() => import('../components/Map/MarkerPopup'));
export const LazyMapFilters = lazy(() => import('../components/Map/MapFilters'));

// Lazy loading для планировщика
export const LazyRoutePlanner = lazy(() => import('../components/RoutePlanner/RoutePlanner'));

// Lazy loading для чата
export const LazyChatWindows = lazy(() => import('../components/ChatWindows'));

// Lazy loading для активности (используем правильный путь с маленькой буквы)
export const LazyActivityFeed = lazy(() => import('../components/activity/ActivityFeed'));
export const LazyActivityCard = lazy(() => import('../components/activity/ActivityCard'));
export const LazyActivityStats = lazy(() => import('../components/activity/ActivityStats'));
