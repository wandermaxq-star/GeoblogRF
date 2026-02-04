import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoutes } from '../api/routes';
import { listPosts } from '../services/postsService';
import { ContentCardData } from '../components/Profile/ContentCards/ContentCard';

interface UserData {
  posts: ContentCardData[];
  routes: ContentCardData[];
  places: ContentCardData[];
  loading: boolean;
  error: string | null;
}

export const useUserData = (userId?: string): UserData => {
  const auth = useAuth();
  const [data, setData] = useState<UserData>({
    posts: [],
    routes: [],
    places: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.token) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      setData(prev => ({ ...prev, loading: true, error: null }));

      // Если это профиль друга (не текущего пользователя), используем тестовые данные
      if (userId && userId !== auth.user?.id) {
        setData({
          posts: generateTestPosts(userId),
          routes: generateTestRoutes(userId),
          places: generateTestPlaces(userId),
          loading: false,
          error: null
        });
        return;
      }

      try {
        // Загружаем данные параллельно (без блогов)
        const [routesData, postsData] = await Promise.allSettled([
          getRoutes(),
          listPosts({ limit: 50 })
        ]);


        // Обрабатываем маршруты
        const routes: ContentCardData[] = routesData.status === 'fulfilled'
          ? routesData.value.map(route => ({
              id: route.id.toString(),
              type: 'route' as const,
              title: (route as any).name || route.title,
              preview: route.description || 'Описание маршрута...',
              rating: (route as any).rating || 0,
              stats: {
                views: (route as any).views || 0,
                likes: (route as any).likes || 0,
                comments: 0,
                shares: 0
              },
              metadata: {
                createdAt: new Date((route as any).created_at || route.createdAt || new Date()),
                updatedAt: new Date((route as any).updated_at || route.updatedAt || new Date()),
                category: (route as any).category || 'путешествие',
                tags: (route as any).tags || []
              },
              interactive: {
                canRead: true,
                canEdit: true,
                canShare: true
              }
            }))
          : [];

        // Обрабатываем посты
        const posts: ContentCardData[] = postsData.status === 'fulfilled'
          ? postsData.value.data.map(post => ({
              id: post.id.toString(),
              type: 'post' as const,
              title: post.title || 'Без заголовка',
              preview: post.body.substring(0, 100) + '...',
              rating: 0, // Посты пока не имеют рейтинга
              stats: {
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0
              },
              metadata: {
                createdAt: new Date(post.created_at),
                updatedAt: new Date(post.updated_at),
                category: 'пост',
                tags: []
              },
              interactive: {
                canRead: true,
                canEdit: true,
                canShare: true
              }
            }))
          : [];

        // Пока что места - пустой массив (нужно будет добавить API)
        const places: ContentCardData[] = [];

        setData({
          posts,
          routes,
          places,
          loading: false,
          error: null
        });

      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Ошибка загрузки данных'
        }));
      }
    };

    loadUserData();
  }, [auth.token, userId]);

  return data;
};

// Функции для генерации тестовых данных друзей
const generateTestPosts = (userId: string): ContentCardData[] => {
  const userNames = {
    '1': 'Алексей_Путешественник',
    '2': 'Мария_Фотограф', 
    '3': 'Дмитрий_Эксперт',
    '4': 'Анна_Блогер',
    '5': 'Сергей_Картограф'
  };
  
  const userName = userNames[userId as keyof typeof userNames] || 'Друг';
  
  return [
    {
      id: `${userId}_post_1`,
      type: 'post' as const,
      title: `В Париже дождик!`,
      preview: 'Неожиданно пошел дождь, но это не испортило настроение...',
      rating: 4.2,
      stats: { views: 45, likes: 12, comments: 3, shares: 1 },
      metadata: {
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        category: 'путешествие',
        tags: ['#париж', '#дождь', '#настроение']
      },
      interactive: { canRead: true, canEdit: false, canShare: true }
    },
    {
      id: `${userId}_post_2`,
      type: 'post' as const,
      title: `В Альпах красота`,
      preview: 'Горы просто завораживают своей красотой...',
      rating: 4.8,
      stats: { views: 78, likes: 23, comments: 7, shares: 4 },
      metadata: {
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        category: 'природа',
        tags: ['#альпы', '#горы', '#красота']
      },
      interactive: { canRead: true, canEdit: false, canShare: true }
    }
  ];
};


const generateTestRoutes = (userId: string): ContentCardData[] => {
  const userNames = {
    '1': 'Алексей_Путешественник',
    '2': 'Мария_Фотограф', 
    '3': 'Дмитрий_Эксперт',
    '4': 'Анна_Блогер',
    '5': 'Сергей_Картограф'
  };
  
  const userName = userNames[userId as keyof typeof userNames] || 'Друг';
  
  return [
    {
      id: `${userId}_route_1`,
      type: 'route' as const,
      title: `Дорога хорошая`,
      preview: 'Отличный маршрут для автомобильного путешествия...',
      rating: 4.4,
      stats: { views: 89, likes: 18, comments: 5, shares: 2 },
      metadata: {
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        category: 'автопутешествие',
        tags: ['#дорога', '#авто', '#путешествие']
      },
      interactive: { canRead: true, canEdit: false, canShare: true }
    }
  ];
};

const generateTestPlaces = (userId: string): ContentCardData[] => {
  const userNames = {
    '1': 'Алексей_Путешественник',
    '2': 'Мария_Фотограф', 
    '3': 'Дмитрий_Эксперт',
    '4': 'Анна_Блогер',
    '5': 'Сергей_Картограф'
  };
  
  const userName = userNames[userId as keyof typeof userNames] || 'Друг';
  
  return [
    {
      id: `${userId}_place_1`,
      type: 'place' as const,
      title: `Секретное место в горах`,
      preview: 'Нашел удивительное место с потрясающим видом...',
      rating: 4.9,
      stats: { views: 67, likes: 28, comments: 9, shares: 6 },
      metadata: {
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        category: 'природа',
        tags: ['#горы', '#вид', '#секрет']
      },
      interactive: { canRead: true, canEdit: false, canShare: true }
    }
  ];
};
