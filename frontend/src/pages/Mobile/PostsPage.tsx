/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
// TODO: temporary — relax lint rules in large files while we migrate types (follow-up task)
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/Mobile/TopBar';
import FilterTabs from '../../components/Mobile/FilterTabs';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import OptimizedImage from '../../components/ui/OptimizedImage';
import { Plus, Heart, MessageCircle, Share2, MapPin, TrendingUp, Clock, Star, Navigation, Calendar } from 'lucide-react';
import { listPosts, PostDTO, createPost } from '../../services/postsService';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getPostImage, getPostLocation } from '../../utils/postUtils';

// Lazy load тяжелых компонентов
const LazyPostConstructor = lazy(() => import('../../components/Posts/PostConstructor'));
const MiniMapMarker = lazy(() => import('../../components/Posts/MiniMapMarker'));
const MiniMapRoute = lazy(() => import('../../components/Posts/MiniMapRoute'));
const MiniEventCard = lazy(() => import('../../components/Posts/MiniEventCard'));

type ContentFilter = 'all' | 'post' | 'guide';
type SortFilter = 'trending' | 'recent' | 'favorites';

const PostsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('recent');
  const [showPostConstructor, setShowPostConstructor] = useState(false);

  // Предзагружаем MapsGL при загрузке страницы постов
  // НЕ предзагружаем MapsGL - загрузится только когда пользователь увидит карту в посте

  // Проверяем query параметр для открытия конструктора поста
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowPostConstructor(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Загружаем посты
  useEffect(() => {
    let cancelled = false;
    
    const loadPosts = async () => {
      try {
        setLoading(true);
        const response = await listPosts({ 
          limit: 50,
          content_type: contentFilter === 'all' ? 'all' : contentFilter
        });
        if (!cancelled) {
          setPosts(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPosts();
    
    return () => {
      cancelled = true;
    };
  }, [contentFilter]);

  const handleLike = async (postId: string) => {
    try {
      // TODO: Implement API call for like/unlike
      // For now, just update local state
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, is_liked: !post.is_liked, likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1 }
          : post
      ));
    } catch (error) {
    }
  };

  const handlePostClick = (post: PostDTO) => {
    navigate(`/posts/${post.id}`);
  };

  const handlePostCreated = (newPost: PostDTO) => {
    setPosts(prev => {
      const filtered = prev.filter(p => p.id !== newPost.id);
      return [newPost, ...filtered];
    });
    
    // Перезагружаем список постов для получения актуальных данных
    const loadPosts = async () => {
      try {
        const response = await listPosts({ limit: 50 });
        const uniquePosts = Array.from(
          new Map([newPost, ...response.data].map(post => [post.id, post])).values()
        );
        setPosts(uniquePosts);
      } catch (error) {
        // Тихая ошибка
      }
    };
    
    setTimeout(loadPosts, 1000);
  };

  const handlePostConstructorSave = async (postData: any) => {
    try {
      const body = postData.description || postData.body || '';
      
      let photoUrls: string | undefined;
      if (postData.photoUrls) {
        photoUrls = postData.photoUrls;
      } else if (postData.images?.items) {
        const urls = postData.images.items
          .filter((img: any) => img.src && !img.src.startsWith('blob:') && !img.src.startsWith('data:'))
          .map((img: any) => img.src);
        photoUrls = urls.length > 0 ? urls.join(',') : undefined;
      }
      
      let marker_id: string | undefined;
      let route_id: string | undefined;
      let event_id: string | undefined;
      
      if (postData.map?.elements) {
        if (postData.map.elements.markers && Array.isArray(postData.map.elements.markers) && postData.map.elements.markers.length > 0) {
          const firstMarker = postData.map.elements.markers[0];
          marker_id = firstMarker.id || firstMarker.marker_id || firstMarker.markerId;
        }
        
        if (postData.map.elements.routes && Array.isArray(postData.map.elements.routes) && postData.map.elements.routes.length > 0) {
          const firstRoute = postData.map.elements.routes[0];
          route_id = firstRoute.id || firstRoute.route_id || firstRoute.routeId;
        }
        
        if (postData.map.elements.events && Array.isArray(postData.map.elements.events) && postData.map.elements.events.length > 0) {
          const firstEvent = postData.map.elements.events[0];
          event_id = firstEvent.id || firstEvent.event_id || firstEvent.eventId;
        }
      }
      
      if (!postData.title && !body.trim()) {
        alert('❌ Добавьте заголовок или описание поста');
        return;
      }
      
      const created = await createPost({
        title: postData.title?.trim() || undefined,
        body: body.trim() || undefined,
        photo_urls: photoUrls,
        marker_id: marker_id,
        route_id: route_id,
        event_id: event_id,
        template: 'mobile'
      });
      
      handlePostCreated(created);
      setShowPostConstructor(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`❌ Не удалось сохранить пост:\n${errorMessage}`);
    }
  };

  const tabs = [
    { id: 'trending', label: 'Популярное', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'recent', label: 'Новое', icon: <Clock className="w-4 h-4" /> },
    { id: 'favorites', label: 'Избранное', icon: <Star className="w-4 h-4" /> },
  ];

  const contentTabs = [
    { id: 'all', label: 'Все' },
    { id: 'post', label: 'Посты' },
    { id: 'guide', label: 'Путеводители' },
  ];

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortFilter === 'trending') {
      return (b.likes_count || 0) - (a.likes_count || 0);
    }
    if (sortFilter === 'recent') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });

  // Если открыт конструктор постов, показываем его
  if (showPostConstructor) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <Suspense fallback={<div className="flex items-center justify-center h-full">Загрузка конструктора...</div>}>
          <LazyPostConstructor
            onSave={handlePostConstructorSave}
            onClose={() => setShowPostConstructor(false)}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <FilterTabs 
        tabs={tabs} 
        defaultTab={sortFilter}
        onTabChange={(value) => setSortFilter(value as SortFilter)}
      />
      
      <div className="flex-1 overflow-y-auto pb-bottom-nav m-glass-page">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="text-muted-foreground text-center">
              Пока нет постов
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {sortedPosts.map((post) => {
              const imageUrl = getPostImage(post);
              const location = getPostLocation(post);
              
              return (
                <Card 
                  key={post.id} 
                  className="m-glass-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handlePostClick(post)}
                >
                  {/* Post Image */}
                  {imageUrl && (
                    <div className="relative h-48 overflow-hidden">
                      <OptimizedImage
                        src={imageUrl}
                        alt={post.title || 'Post image'}
                        width={400}
                        height={192}
                        quality={75}
                        className="w-full h-full"
                        lazy={true}
                      />
                      {location && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-secondary text-secondary-foreground shadow-md">
                            <MapPin className="w-3 h-3 mr-1" />
                            {location}
                          </Badge>
                        </div>
                      )}
                      {post.content_type === 'guide' && (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-gradient-primary text-primary-foreground shadow-md">
                            Путеводитель
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {post.author_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-foreground mb-1 line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {post.author_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ru })}
                        </p>
                      </div>
                    </div>

                    {/* Post Body Preview */}
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
                          handleLike(post.id);
                        }}
                      >
                        <Heart 
                          className={`w-4 h-4 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`} 
                        />
                        <span className="text-sm">{post.likes_count || 0}</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostClick(post);
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

export default PostsPage;

