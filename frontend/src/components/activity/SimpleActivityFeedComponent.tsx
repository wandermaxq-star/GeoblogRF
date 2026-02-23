import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { activityService, ActivityItem, ActivityFilters as ActivityFiltersType } from '../../services/activityService';
import ActivityCard from './ActivityCard';
import { useAuth } from '../../contexts/AuthContext';

// ============================================================
// MOCK_ACTIVITIES — тестовые данные для визуальной проверки ленты
// TODO: Удалить после завершения тестирования
// ============================================================
const MOCK_ACTIVITIES: ActivityItem[] = [
  // ── Метки ──
  {
    id: 'mock-marker-1',
    user_id: 'u1',
    activity_type: 'marker_created',
    target_type: 'marker',
    target_id: 'marker-101',
    metadata: { title: 'Смотровая площадка Воробьёвы горы', category: 'Достопримечательность' },
    is_public: true,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    username: 'Алексей',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-marker-2',
    user_id: 'u2',
    activity_type: 'marker_rated',
    target_type: 'marker',
    target_id: 'marker-102',
    metadata: { title: 'Фонтан Дружба народов', rating: 5 },
    is_public: true,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    username: 'Мария',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-marker-3',
    user_id: 'u3',
    activity_type: 'marker_commented',
    target_type: 'marker',
    target_id: 'marker-103',
    metadata: { title: 'Парк Горького', description: 'Отличное место для прогулки!' },
    is_public: true,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    username: 'Иван',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-marker-4',
    user_id: 'u4',
    activity_type: 'marker_visited',
    target_type: 'marker',
    target_id: 'marker-104',
    metadata: { title: 'Москва-Сити' },
    is_public: true,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    username: 'Елена',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-marker-5',
    user_id: 'u5',
    activity_type: 'marker_favorited',
    target_type: 'marker',
    target_id: 'marker-105',
    metadata: { title: 'Красная площадь' },
    is_public: true,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    username: 'Дмитрий',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-marker-6',
    user_id: 'u6',
    activity_type: 'marker_updated',
    target_type: 'marker',
    target_id: 'marker-106',
    metadata: { title: 'Третьяковская галерея', description: 'Обновлено расписание работы' },
    is_public: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    username: 'Ольга',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Маршруты ──
  {
    id: 'mock-route-1',
    user_id: 'u7',
    activity_type: 'route_created',
    target_type: 'route',
    target_id: 'route-201',
    metadata: { title: 'Золотое кольцо — выходной маршрут', distance: '240 км' },
    is_public: true,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    username: 'Сергей',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-route-2',
    user_id: 'u8',
    activity_type: 'route_shared',
    target_type: 'route',
    target_id: 'route-202',
    metadata: { title: 'Прогулка по Арбату' },
    is_public: true,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    username: 'Наталья',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-route-3',
    user_id: 'u9',
    activity_type: 'route_rated',
    target_type: 'route',
    target_id: 'route-203',
    metadata: { title: 'Байкал — восточный берег', rating: 5 },
    is_public: true,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    username: 'Андрей',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-route-4',
    user_id: 'u10',
    activity_type: 'route_commented',
    target_type: 'route',
    target_id: 'route-204',
    metadata: { title: 'Велотрек по набережной', description: 'Супер! Особенно вечером' },
    is_public: true,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    username: 'Катерина',
    avatar_url: undefined,
    is_read: true,
  },

  // ── События ──
  {
    id: 'mock-event-1',
    user_id: 'u11',
    activity_type: 'event_created',
    target_type: 'event',
    target_id: 'event-301',
    metadata: { title: 'Субботник в парке Сокольники', date: '2026-03-01' },
    is_public: true,
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    username: 'Администрация',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-event-2',
    user_id: 'u12',
    activity_type: 'event_joined',
    target_type: 'event',
    target_id: 'event-302',
    metadata: { title: 'Фестиваль еды на ВДНХ' },
    is_public: true,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    username: 'Василий',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-event-3',
    user_id: 'u13',
    activity_type: 'event_completed',
    target_type: 'event',
    target_id: 'event-303',
    metadata: { title: 'Марафон «Белые ночи»' },
    is_public: true,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    username: 'Организатор',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-event-4',
    user_id: 'u14',
    activity_type: 'event_cancelled',
    target_type: 'event',
    target_id: 'event-304',
    metadata: { title: 'Открытая лекция в музее', description: 'Отменено из-за погоды' },
    is_public: true,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    username: 'Модератор',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Достижения и геймификация ──
  {
    id: 'mock-ach-1',
    user_id: 'u15',
    activity_type: 'achievement_earned',
    target_type: 'achievement',
    target_id: 'ach-401',
    metadata: { title: 'Первооткрыватель', description: 'Добавлено 10 новых меток!' },
    is_public: true,
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    username: 'Вася Пупкин',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-ach-2',
    user_id: 'u16',
    activity_type: 'level_up',
    target_type: 'user',
    target_id: 'u16',
    metadata: { title: 'Уровень 5 — Путешественник', description: 'Поздравляем с новым уровнем!' },
    is_public: true,
    created_at: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    username: 'Геннадий',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-ach-3',
    user_id: 'u17',
    activity_type: 'badge_earned',
    target_type: 'badge',
    target_id: 'badge-501',
    metadata: { title: 'Золотой обозреватель', description: 'Оставлено 100 отзывов' },
    is_public: true,
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    username: 'Анастасия',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-ach-4',
    user_id: 'u18',
    activity_type: 'challenge_completed',
    target_type: 'challenge',
    target_id: 'challenge-601',
    metadata: { title: 'Челлендж «Посети 5 парков»' },
    is_public: true,
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    username: 'Павел',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-ach-5',
    user_id: 'u19',
    activity_type: 'streak_started',
    target_type: 'user',
    target_id: 'u19',
    metadata: { title: 'Серия: 7 дней подряд', description: '7 дней активности без перерыва!' },
    is_public: true,
    created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    username: 'Михаил',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-ach-6',
    user_id: 'u20',
    activity_type: 'achievement_progress',
    target_type: 'achievement',
    target_id: 'ach-402',
    metadata: { title: 'Метка №1000 — прогресс 87%', description: 'До 1000 оценок осталось совсем чуть-чуть!' },
    is_public: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    username: 'Людмила',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Социальные ──
  {
    id: 'mock-social-1',
    user_id: 'u21',
    activity_type: 'friend_added',
    target_type: 'user',
    target_id: 'u22',
    metadata: { name: 'Екатерина С.' },
    is_public: true,
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    username: 'Роман',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-social-2',
    user_id: 'u23',
    activity_type: 'friend_request_accepted',
    target_type: 'user',
    target_id: 'u24',
    metadata: { name: 'Максим Д.' },
    is_public: true,
    created_at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    username: 'Светлана',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-social-3',
    user_id: 'u25',
    activity_type: 'profile_updated',
    target_type: 'user',
    target_id: 'u25',
    metadata: { description: 'Обновил аватар и описание профиля' },
    is_public: true,
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    username: 'Артём',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Системные ──
  {
    id: 'mock-sys-1',
    user_id: 'system',
    activity_type: 'system_announcement',
    target_type: 'system',
    target_id: undefined,
    metadata: { title: 'Обновление платформы v2.5', description: 'Добавлен тёмный режим карты и новые фильтры' },
    is_public: true,
    created_at: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    username: 'Система',
    avatar_url: undefined,
    is_read: false,
  },
  {
    id: 'mock-sys-2',
    user_id: 'system',
    activity_type: 'system_feature_added',
    target_type: 'system',
    target_id: undefined,
    metadata: { title: 'Новая функция: Оффлайн-карты', description: 'Теперь можно скачивать карты для работы без интернета' },
    is_public: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    username: 'Система',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-sys-3',
    user_id: 'system',
    activity_type: 'system_maintenance',
    target_type: 'system',
    target_id: undefined,
    metadata: { title: 'Плановое обслуживание', description: 'Сервер будет недоступен 25 февраля с 3:00 до 5:00' },
    is_public: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    username: 'Система',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Модерация ──
  {
    id: 'mock-mod-1',
    user_id: 'system',
    activity_type: 'content_approved',
    target_type: 'marker',
    target_id: 'marker-107',
    metadata: { title: 'Ваша метка «Озеро Селигер» одобрена' },
    is_public: true,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    username: 'Модератор',
    avatar_url: undefined,
    is_read: true,
  },
  {
    id: 'mock-mod-2',
    user_id: 'system',
    activity_type: 'content_published',
    target_type: 'route',
    target_id: 'route-205',
    metadata: { title: 'Маршрут «По Неве» опубликован' },
    is_public: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    username: 'Модератор',
    avatar_url: undefined,
    is_read: true,
  },

  // ── Milestone (метка достигла 1000 оценок) ──
  {
    id: 'mock-milestone-1',
    user_id: 'system',
    activity_type: 'level_milestone',
    target_type: 'marker',
    target_id: 'marker-108',
    metadata: { title: '🎉 Метка «Эрмитаж» набрала 1000 оценок!', description: 'Это одна из самых популярных меток на платформе' },
    is_public: true,
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    username: 'Система',
    avatar_url: undefined,
    is_read: false,
  },
];

const FeedContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
`;

const FeedContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ActivitiesList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LoadMoreButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin: 16px;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 16px;
  color: #666;
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: #c33;
  padding: 12px;
  margin: 16px;
  border-radius: 8px;
  border: 1px solid #fcc;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #999;
`;

interface SimpleActivityFeedProps {
  className?: string;
  filters?: ActivityFiltersType;
  compact?: boolean;
}

const SimpleActivityFeedComponent: React.FC<SimpleActivityFeedProps> = ({ 
  className, 
  filters = {},
  compact = false,
}) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Фильтрация моковых данных: убираем blog_ / chat_ типы
  const filteredMock = useMemo(() => {
    return MOCK_ACTIVITIES.filter(a =>
      !a.activity_type.startsWith('blog_') &&
      !a.activity_type.startsWith('chat_') &&
      a.activity_type !== 'post_published'
    );
  }, []);

  const loadActivities = useCallback(async (reset = false) => {
    // Убираем проверку user - гости тоже могут видеть активность
    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : activities.length;
      const limit = filters.limit ?? 20;
      const currentFilters = { ...filters, offset, limit };

      let realData: ActivityItem[] = [];
      try {
        const response = await activityService.getActivityFeed(currentFilters);
        // Фильтруем blog/chat из реальных данных тоже
        realData = (response.data || []).filter(a =>
          !a.activity_type.startsWith('blog_') &&
          !a.activity_type.startsWith('chat_') &&
          a.activity_type !== 'post_published'
        );
      } catch {
        // API недоступен — используем только моки
      }

      // Если реальных данных нет — показываем тестовые
      const dataToUse = realData.length > 0 ? realData : (reset ? filteredMock : []);

      if (reset) {
        setActivities(dataToUse);
      } else {
        setActivities(prev => [...prev, ...dataToUse]);
      }
      
      setHasMore(realData.length === currentFilters.limit);
    } catch (err) {
      console.error('Ошибка загрузки активности:', err);
      // При ошибке всё равно показываем моки
      if (activities.length === 0) {
        setActivities(filteredMock);
      }
      setError(null); // Не показываем ошибку — есть моки
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, activities.length, filteredMock]);

  const markAsRead = useCallback(async (activityId: string) => {
    try {
      await activityService.markAsRead(activityId);
      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId
            ? { ...activity, is_read: true, read_at: new Date().toISOString() }
            : activity
        )
      );
    } catch (err) {
      console.error('Ошибка отметки активности как прочитанной:', err);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadActivities(false);
    }
  }, [loadingMore, hasMore, loadActivities]);

  useEffect(() => {
    // Гости тоже могут видеть активность
    loadActivities(true);
  }, [loadActivities]);

  useEffect(() => {
    // Автообновление только для авторизованных пользователей
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const newFilters = { ...filters, offset: 0, limit: 5 };
        const response = await activityService.getActivityFeed(newFilters);
        if (response.data.length > 0) {
          setActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newActivities = response.data.filter(a => !existingIds.has(a.id));
            return [...newActivities, ...prev];
          });
        }
      } catch {
        // silently ignore periodic refresh errors
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, filters]);

  // Флаг: показываем ли мы моковые данные
  const isMockData = useMemo(() => {
    return activities.length > 0 && activities.some(a => a.id.startsWith('mock-'));
  }, [activities]);

  return (
    <FeedContainer className={className}>
      <FeedContent>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        {/* Заметка о тестовых данных */}
        {isMockData && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,193,7,0.15), rgba(255,152,0,0.10))',
            border: '1px solid rgba(255,193,7,0.3)',
            borderRadius: 10,
            padding: '10px 16px',
            margin: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#b8860b',
          }}>
            <span style={{ fontSize: 18 }}>🧪</span>
            <span><b>Тестовый режим.</b> Показаны примеры всех типов активности. Реальные данные появятся при создании контента.</span>
          </div>
        )}

        {loading ? (
          <LoadingSpinner>Загрузка активности...</LoadingSpinner>
        ) : activities.length === 0 ? (
          <EmptyState>
            <EmptyIcon>{'📭'}</EmptyIcon>
            <EmptyTitle>Нет активности</EmptyTitle>
            <EmptyText>Пока нет новых событий в сообществе</EmptyText>
          </EmptyState>
        ) : (
          <>
            <ActivitiesList style={{ padding: compact ? 8 : 16 }}>
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onMarkAsRead={user ? markAsRead : undefined}
                />
              ))}
            </ActivitiesList>
            
            {hasMore && (
              <LoadMoreButton 
                onClick={loadMore} 
                disabled={loadingMore}
              >
                {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
              </LoadMoreButton>
            )}
          </>
        )}
      </FeedContent>
    </FeedContainer>
  );
};

export default SimpleActivityFeedComponent;
