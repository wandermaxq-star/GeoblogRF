import { useCallback } from 'react';

// КРИТИЧНО: Кэш для предзагруженных маршрутов - предотвращает повторную загрузку
const preloadedRoutes = new Set<string>();

export const usePreload = () => {
  const preloadRoute = useCallback((route: string) => {
    // Если уже предзагружено - не загружаем снова
    if (preloadedRoutes.has(route)) {
      return;
    }
    
    
    // Preload route components
    switch (route) {
      case '/map':
        import('../pages/Map').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      case '/planner':
        import('../pages/Planner').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      // Блоги объединены с постами в единую ленту
      // case '/blog':
      //   import('../pages/Blog');
      //   break;
      case '/calendar':
        // /calendar теперь redirect → /map, preload не нужен
        break;
      case '/chat':
// Чаты отключены фичефлагом
        break;
      case '/activity':
        import('../pages/Activity').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      case '/friends':
        import('../pages/Friends').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      // Профиль как отдельная страница удалён
      case '/admin/moderation':
        import('../pages/ModerationPage').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      case '/legal/user-agreement':
        import('../pages/UserAgreement').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      case '/legal/privacy-policy':
        import('../pages/PrivacyPolicy').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      case '/centre':
        import('../pages/CentrePage').then(() => {
          preloadedRoutes.add(route);
        });
        break;
      // Posts теперь загружается статически (не лениво), предзагрузка не нужна
      // case '/posts':
      //   import('../pages/Posts');
      //   break;
      // Профиль не нужно предзагружать - он уже статически импортируется в Sidebar.tsx
      // case '/profile':
      //   import('../components/ProfilePanel');
      //   break;
    }
  }, []);

  const preloadOnIdle = useCallback(() => {
    // Preload critical components when idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloadRoute('/map');
        // preloadRoute('/blog');
        preloadRoute('/planner');
      });
    } else {
      setTimeout(() => {
        preloadRoute('/map');
        // preloadRoute('/blog');
        preloadRoute('/planner');
      }, 100);
    }
  }, [preloadRoute]);

  return {
    preloadRoute,
    preloadOnIdle
  };
};
