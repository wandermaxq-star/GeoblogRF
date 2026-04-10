import React, { useState, useEffect } from 'react';
import FilterTabs from '../../components/Mobile/FilterTabs';
import { Card } from '../../components/ui/card';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Users, TrendingUp, Award } from 'lucide-react';
import { activityService, ActivityItem } from '../../services/activityService';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

type ActivityFilter = 'feed' | 'trending' | 'achievements';

const ActivityPage: React.FC = () => {
  const { token } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('feed');

  useEffect(() => {
    // ← КРИТИЧНО: Не загружаем активность для гостей
    if (!token) {
      setActivities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    
    const loadActivities = async () => {
      try {
        setLoading(true);
        const response = await activityService.getActivityFeed({ limit: 50 });
        if (!cancelled) {
          setActivities(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          setActivities([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadActivities();
    
    return () => {
      cancelled = true;
    };
  }, [token]);

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'post_created':
      case 'blog_created':
        return 'bg-primary/10 text-primary';
      case 'marker_created':
        return 'bg-secondary/10 text-secondary';
      case 'route_created':
      case 'route_shared':
        return 'bg-accent/10 text-accent';
      case 'achievement_earned':
      case 'level_up':
        return 'bg-gradient-primary text-primary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'post_created':
      case 'blog_created':
        return '📝';
      case 'marker_created':
        return '📍';
      case 'route_created':
      case 'route_shared':
        return '🗺️';
      case 'achievement_earned':
      case 'level_up':
        return '🏆';
      default:
        return '📌';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'post_created':
        return 'Пост';
      case 'blog_created':
        return 'Блог';
      case 'marker_created':
        return 'Метка';
      case 'route_created':
      case 'route_shared':
        return 'Маршрут';
      case 'achievement_earned':
        return 'Достижение';
      case 'level_up':
        return 'Уровень';
      default:
        return 'Событие';
    }
  };

  const tabs = [
    { id: 'feed', label: 'Лента', icon: <Users className="w-4 h-4" /> },
    { id: 'trending', label: 'Тренды', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'achievements', label: 'Достижения', icon: <Award className="w-4 h-4" /> },
  ];

  const filteredActivities = activities.filter(activity => {
    if (filter === 'achievements') {
      return activity.activity_type === 'achievement_earned' || activity.activity_type === 'level_up';
    }
    if (filter === 'trending') {
      // TODO: Implement trending filter
      return true;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-screen">
      <FilterTabs 
        tabs={tabs} 
        defaultTab={filter}
        onTabChange={(value) => setFilter(value as ActivityFilter)}
      />
      
      <div className="flex-1 overflow-y-auto pb-bottom-nav m-glass-page">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="text-muted-foreground text-center">
              Пока нет активности
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredActivities.map((activity) => {
              const activityType = activity.activity_type || 'other';
              const userName = activity.username || activity.user_id || 'Пользователь';
              const userInitials = userName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'U';

              return (
                <Card key={activity.id} className="m-glass-card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className={getActivityColor(activityType)}>
                        {getActivityIcon(activityType)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">
                            {userName}
                          </span>
                          <span className="text-muted-foreground">
                            {' '}
                            {activity.metadata?.description || activity.activity_type || 'выполнил действие'}
                          </span>
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {activity.created_at
                            ? formatDistanceToNow(new Date(activity.created_at), { 
                                addSuffix: true, 
                                locale: ru 
                              })
                            : ''}
                        </span>
                      </div>

                      {activity.metadata?.title && (
                        <p className="text-sm font-medium text-foreground mb-2">
                          {activity.metadata.title}
                        </p>
                      )}

                      <Badge variant="outline" className="text-xs">
                        {getActivityLabel(activityType)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;

