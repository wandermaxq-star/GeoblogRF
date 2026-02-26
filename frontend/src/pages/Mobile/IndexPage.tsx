import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import OptimizedImage from '../../components/ui/OptimizedImage';
import { Heart, MessageCircle, Share2, MapPin, Navigation, Calendar } from 'lucide-react';
import { listPosts, PostDTO } from '../../services/postsService';
import { activityService, ActivityItem } from '../../services/activityService';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getPostImage, getPostLocation } from '../../utils/postUtils';

// Lazy load тяжелых компонентов карт - загружаются только когда нужны
const MiniMapMarker = lazy(() => import('../../components/Posts/MiniMapMarker'));
const MiniMapRoute = lazy(() => import('../../components/Posts/MiniMapRoute'));
const MiniEventCard = lazy(() => import('../../components/Posts/MiniEventCard'));

const IndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true); // Отдельное состояние для постов
  const [activitiesLoading, setActivitiesLoading] = useState(true); // Отдельное состояние для активности

  // НЕ предзагружаем MapsGL - загрузится только когда пользователь увидит карту в посте

  // Загружаем посты СРАЗУ - это критично для быстрой загрузки
  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        setPostsLoading(true);
        const response = await listPosts({ limit: 10 });
        
        if (!cancelled) {
          setPosts(response.data || []);
          setPostsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setPosts([]);
          setPostsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Загружаем активность ПОСЛЕ постов или параллельно, но не блокируем отображение постов
  useEffect(() => {
    let cancelled = false;

    const loadActivities = async () => {
      try {
        setActivitiesLoading(true);
        
        // Загружаем активность параллельно с постами, но не блокируем отображение постов
        const response = await activityService.getActivityFeed({ limit: 10 }).catch(err => {
          // Игнорируем 401 ошибки для activity - это нормально для гостевого режима
          if (err?.response?.status === 401) {
            return { data: [], pagination: { limit: 10, offset: 0, hasMore: false } };
          }
          throw err;
        });

        if (!cancelled) {
          setActivities(response.data || []);
          setActivitiesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setActivities([]);
          setActivitiesLoading(false);
        }
      }
    };

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <div className="flex flex-col h-full">
      {/* Лента активности */}
      <div className="px-4 py-3 m-glass-accordion-section m-glass-topbar">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold m-glass-text">Лента активности</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => navigate('/activity')}
          >
            Все
          </Button>
        </div>

        {activitiesLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Загрузка активности...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Пока нет активности
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 3).map((activity) => {
              const userName = activity.username || activity.user_id || 'Пользователь';
              const userInitials = userName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'U';

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{userName}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        {activity.metadata?.description || activity.activity_type || 'выполнил действие'}
                      </span>
                    </p>
                    {activity.metadata?.title && (
                      <p className="text-sm font-medium text-foreground mt-1">
                        {activity.metadata.title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.created_at
                        ? formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })
                        : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Посты */}
      <div className="flex-1 overflow-y-auto pb-bottom-nav m-glass-page">
        {postsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <div className="text-muted-foreground text-sm">Загрузка постов...</div>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="text-muted-foreground text-center">
              Пока нет постов
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {posts.map((post) => {
              const imageUrl = getPostImage(post);

              return (
                <Card
                  key={post.id}
                  className="m-glass-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  {/* Post Header */}
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                            {post.author_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {post.author_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), {
                              addSuffix: true,
                              locale: ru,
                            })}
                          </p>
                        </div>
                      </div>
                      {post.content_type === 'guide' && (
                        <Badge className="bg-orange-500 text-white">Путешествие</Badge>
                      )}
                    </div>
                  </div>

                  {/* Post Image */}
                  {imageUrl && (
                    <div className="relative h-64 overflow-hidden">
                      <OptimizedImage
                        src={imageUrl}
                        alt={post.title || 'Post image'}
                        width={400}
                        height={256}
                        quality={75}
                        className="w-full h-full"
                        lazy={true}
                      />
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-4">
                    {post.title && (
                      <h3 className="text-base font-bold text-foreground mb-2">
                        {post.title}
                      </h3>
                    )}
                    {post.body && (
                      <p className="text-sm text-foreground mb-3 line-clamp-3">
                        {post.body}
                      </p>
                    )}

                    {/* Interactive Content - Maps */}
                    {post.route_id && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-border">
                        <div className="bg-primary/10 px-3 py-2 flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-primary" />
                          <span className="text-xs font-medium text-primary">Маршрут</span>
                        </div>
                        <div className="h-48">
                          <Suspense fallback={
                            <div className="h-full flex items-center justify-center bg-muted">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-xs text-muted-foreground">Загрузка карты...</p>
                              </div>
                            </div>
                          }>
                            <MiniMapRoute routeId={post.route_id} height="192px" />
                          </Suspense>
                        </div>
                      </div>
                    )}

                    {post.marker_id && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-border">
                        <div className="bg-secondary/10 px-3 py-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-secondary" />
                          <span className="text-xs font-medium text-secondary">Место</span>
                        </div>
                        <div className="h-48">
                          <Suspense fallback={
                            <div className="h-full flex items-center justify-center bg-muted">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-xs text-muted-foreground">Загрузка карты...</p>
                              </div>
                            </div>
                          }>
                            <MiniMapMarker markerId={post.marker_id} height="192px" />
                          </Suspense>
                        </div>
                      </div>
                    )}

                    {post.event_id && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-border">
                        <div className="bg-accent/10 px-3 py-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-accent" />
                          <span className="text-xs font-medium text-accent">Событие</span>
                        </div>
                        <div className="h-48">
                          <Suspense fallback={
                            <div className="h-full flex items-center justify-center bg-muted">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-xs text-muted-foreground">Загрузка события...</p>
                              </div>
                            </div>
                          }>
                            <MiniEventCard eventId={post.event_id} height="192px" />
                          </Suspense>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 pt-3 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement like
                        }}
                      >
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">{post.likes_count || 0}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/posts/${post.id}`);
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">{post.comments_count || 0}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement share
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
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

export default IndexPage;

