/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
// TODO: temporary — relax lint rules in large files while we migrate types (follow-up task)
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/Mobile/TopBar';
import FilterTabs from '../../components/Mobile/FilterTabs';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import OptimizedImage from '../../components/ui/OptimizedImage';
import { Plus, Heart, MessageCircle, Share2, MapPin, TrendingUp, Clock, Star, Navigation, Calendar, Search, X } from 'lucide-react';
import { listPosts, PostDTO } from '../../services/postsService';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getPostImage, getPostLocation } from '../../utils/postUtils';
import { useFavorites } from '../../contexts/FavoritesContext';

// Lazy load тяжелых компонентов
const MiniMapMarker = lazy(() => import('../../components/Posts/MiniMapMarker'));
const MiniMapRoute = lazy(() => import('../../components/Posts/MiniMapRoute'));
const MiniEventCard = lazy(() => import('../../components/Posts/MiniEventCard'));

type ContentFilter = 'all' | 'post' | 'guide';
type SortFilter = 'trending' | 'recent' | 'favorites';

const PostsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const favorites = useFavorites() as any;
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Предзагружаем MapsGL при загрузке страницы постов
  // НЕ предзагружаем MapsGL - загрузится только когда пользователь увидит карту в посте

  // Проверяем query параметр для открытия поиска
  useEffect(() => {
    if (searchParams.get('search') === 'open') {
      setSearchVisible(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('search');
      setSearchParams(nextParams, { replace: true });
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

  const tabs = [
    { id: 'trending', label: 'Популярное', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'recent', label: 'Новое', icon: <Clock className="w-4 h-4" /> },
    { id: 'favorites', label: 'Избранное', icon: <Star className="w-4 h-4" /> },
  ];

  const favoritePostIds = useMemo(() => {
    const favoritePosts = favorites?.favoritePosts || [];
    return new Set<string>(favoritePosts.map((post: any) => post.id).filter(Boolean));
  }, [favorites]);

  const visiblePosts = useMemo(() => {
    let result = [...posts];

    if (sortFilter === 'favorites') {
      result = result.filter((post) => favoritePostIds.has(post.id));
    } else {
      if (sortFilter === 'trending') {
        result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      } else if (sortFilter === 'recent') {
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((post) => {
        const title = (post.title || '').toLowerCase();
        const body = (post.body || '').toLowerCase();
        const author = (post.author_name || '').toLowerCase();
        const location = (getPostLocation(post) || '').toLowerCase();
        return [title, body, author, location].some((field) => field.includes(term));
      });
    }

    return result;
  }, [favoritePostIds, posts, searchTerm, sortFilter]);

  const handleSearchClose = () => {
    setSearchVisible(false);
    setSearchTerm('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <FilterTabs 
        tabs={tabs} 
        defaultTab={sortFilter}
        onTabChange={(value) => setSortFilter(value as SortFilter)}
      />

      {searchVisible && (
        <div className="px-3 pb-2 pt-1">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/70 backdrop-blur px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              placeholder="Поиск по постам, авторам и местам"
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Очистить поиск"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSearchClose}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Закрыть
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground px-1">
            {searchTerm
              ? `Найдено ${visiblePosts.length} из ${posts.length}`
              : `Введите запрос для поиска по ${posts.length} постам`}
          </div>
        </div>
      )}
      
      <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(var(--bottom-nav-height,56px)+1rem)] m-glass-page">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="text-muted-foreground text-center">
              {sortFilter === 'favorites' && favoritePostIds.size === 0
                ? 'В избранном пока нет постов'
                : searchTerm
                  ? 'Ничего не найдено'
                  : 'Пока нет постов'}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {visiblePosts.map((post) => {
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

