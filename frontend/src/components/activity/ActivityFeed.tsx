import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { activityService, ActivityItem, ActivityStats as ActivityStatsType, ActivityFilters as ActivityFiltersType } from '../../services/activityService';
import ActivityCard from './ActivityCard';
import ActivityFiltersComponent from './ActivityFilters';
import ActivityStatsComponent from './ActivityStats';
import { useAuth } from '../../contexts/AuthContext';

const FeedContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255,255,255,0.06);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.08);
`;

const FeedHeader = styled.div`
  background: transparent;
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
`;

const FeedTitle = styled.h1`
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FeedSubtitle = styled.p`
  margin: 0;
  color: #7f8c8d;
  font-size: 16px;
`;

const FeedContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const FeedMain = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const FeedSidebar = styled.div`
  width: 300px;
  background: rgba(255,255,255,0.06);
  -webkit-backdrop-filter: blur(10px) saturate(150%);
  backdrop-filter: blur(10px) saturate(150%);
  border-left: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
`;

const ActivitiesList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #7f8c8d;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #7f8c8d;
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #2c3e50;
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: 16px;
`;

const LoadMoreButton = styled.button`
  margin: 20px auto;
  padding: 12px 24px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #2980b9;
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  background: #e74c3c;
  color: white;
  padding: 16px;
  margin: 20px;
  border-radius: 8px;
  text-align: center;
`;

interface ActivityFeedProps {
  className?: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ className }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<ActivityStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<ActivityFiltersType>({
    limit: 20,
    offset: 0
  });

  // Загрузка ленты активности
  const loadActivities = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setActivities([]);
        setFilters(prev => ({ ...prev, offset: 0 }));
      } else {
        setLoadingMore(true);
      }

      const currentFilters = reset ? { ...filters, offset: 0 } : filters;
      const response = await activityService.getActivityFeed(currentFilters);
      
      if (reset) {
        setActivities(response.data);
      } else {
        setActivities(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить ленту активности');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  // Загрузка статистики
  const loadStats = useCallback(async () => {
    try {
      const statsData = await activityService.getActivityStats();
      setStats(statsData);
    } catch (err) {
      }
  }, []);

  // Отметка активности как прочитанной
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
      
      // Обновляем статистику
      if (stats) {
        setStats(prev => prev ? { ...prev, unread_activities: Math.max(0, prev.unread_activities - 1) } : null);
      }
    } catch (err) {
      }
  }, [stats]);

  // Отметка всех как прочитанных
  const markAllAsRead = useCallback(async () => {
    try {
      await activityService.markAllAsRead();
      setActivities(prev => 
        prev.map(activity => ({ ...activity, is_read: true, read_at: new Date().toISOString() }))
      );
      setStats(prev => prev ? { ...prev, unread_activities: 0 } : null);
    } catch (err) {
      }
  }, []);

  // Загрузка дополнительных активностей
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 20) }));
    }
  }, [loadingMore, hasMore]);

  // Обновление фильтров
  const updateFilters = useCallback((newFilters: Partial<ActivityFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
  }, []);

  // Загрузка при изменении фильтров
  // ВАЖНО: loadActivities и loadStats намеренно не в deps — они объявлены через useCallback
  // и стабильны. Включение их вызовет бесконечный цикл т.к. filters входит в их deps.
  useEffect(() => {
    if (user) {
      loadActivities(true);
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filters.limit, filters.activity_types, filters.target_types]);

  // Автообновление каждые 30 секунд
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      loadStats();
      // Загружаем только новые активности
      const newFilters = { ...filters, offset: 0, limit: 5 };
      activityService.getActivityFeed(newFilters)
        .then(response => {
          if (response.data.length > 0) {
            setActivities(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const newActivities = response.data.filter(a => !existingIds.has(a.id));
              return [...newActivities, ...prev];
            });
          }
        })
        .catch(() => {
          // Handle error silently in production
        });
    }, 30000);

    return () => clearInterval(interval);
  }, [user, filters, loadStats]);

  if (!user) {
    return (
      <FeedContainer className={className}>
        <EmptyState>
          <EmptyIcon>🔐</EmptyIcon>
          <EmptyTitle>Требуется авторизация</EmptyTitle>
          <EmptyText>Войдите в систему для просмотра ленты активности</EmptyText>
        </EmptyState>
      </FeedContainer>
    );
  }

  return (
    <FeedContainer className={className}>
      <FeedHeader>
        <FeedTitle>
          📊 Активность
        </FeedTitle>
        <FeedSubtitle>
          Отслеживайте все события в реальном времени
        </FeedSubtitle>
      </FeedHeader>

      <FeedContent>
        <FeedMain>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          
          {loading ? (
            <LoadingSpinner>Загрузка активности...</LoadingSpinner>
          ) : activities.length === 0 ? (
            <EmptyState>
              <EmptyIcon>📭</EmptyIcon>
              <EmptyTitle>Нет активности</EmptyTitle>
              <EmptyText>Пока нет новых событий в сообществе</EmptyText>
            </EmptyState>
          ) : (
            <>
              <ActivitiesList>
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onMarkAsRead={markAsRead}
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
        </FeedMain>

        <FeedSidebar>
          {stats && (
            <ActivityStatsComponent 
              stats={stats} 
              onMarkAllAsRead={markAllAsRead}
            />
          )}
          
          <ActivityFiltersComponent 
            filters={filters}
            onFiltersChange={updateFilters}
          />
        </FeedSidebar>
      </FeedContent>
    </FeedContainer>
  );
};

export default ActivityFeed;