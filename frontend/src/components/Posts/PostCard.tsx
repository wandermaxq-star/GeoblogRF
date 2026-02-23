import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import styled from 'styled-components';
import { 
  Heart, 
  MessageCircle, 
  Share, 
  MoreHorizontal,
  MapPin,
  Navigation,
  Calendar,
  Clock,
  User,
  Map
} from 'lucide-react';
import { PostDTO, PostReaction } from '../../types/post';
import { MiniMapMarker, MiniMapRoute, MiniEventCard } from './LazyMiniComponents';
import { isGuidePost, getSimplePostText } from '../../utils/postUtils';
import GuideInline from './GuideInline';
import PostReactions, { PostReactionComponent } from './PostReactions';
import { toggleReaction } from '../../services/postsService';
import { useAuth } from '../../contexts/AuthContext';
import ModerationBadge from '../Moderation/ModerationBadge';
import { GeoBadgeList, GeoRef } from '../Geo/GeoBadge';
import { useGeoFocusStore } from '../../stores/geoFocusStore';
import { useContentStore } from '../../stores/contentStore';
import { useThemeStore } from '../../stores/themeStore';

const PostComments = lazy(() => import('./PostComments'));

interface PostCardProps {
  post: PostDTO;
  onClick?: () => void;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onReaction?: (postId: string, emoji: string) => void;
  template?: 'mobile' | 'desktop' | 'article' | 'focus';
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const PostContainer = styled.div<{ template?: string; $isGuide?: boolean; $dark?: boolean }>`
  /* Layer 2 — карточка внутри glass-контейнера, БЕЗ собственного backdrop-filter */
  background: var(--glass-l2-bg);
  color: var(--glass-card-text);
  border-radius: 20px;
  box-shadow: var(--glass-l2-shadow);
  border: 1px solid var(--glass-l2-border);
  margin-bottom: 20px;
  padding: 14px;
  overflow: visible;
  transition: transform 220ms cubic-bezier(.22,.9,.32,1), box-shadow 220ms ease, background 220ms ease, border-color 220ms ease;
  cursor: pointer;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  &:hover {
    background: var(--glass-l2-bg-hover);
    border-color: var(--glass-l2-border-hover);
    box-shadow: var(--glass-l2-shadow);
    transform: translateY(-2px);
  }

  ${props => {
    switch (props.template) {
      case 'desktop':
        return `
          display: flex;
          flex-direction: row;
          min-height: 300px;
        `;
      case 'article':
        return `
          display: flex;
          flex-direction: column;
        `;
      case 'focus':
        return `
          position: relative;
          min-height: 400px;
          background: linear-gradient(135deg, #4a6fa5 0%, #6b8cae 100%);
          color: white;
        `;
      default:
        return `
          display: flex;
          flex-direction: column;
        `;
    }
  }}
`;

const PostHeader = styled.div<{ $isGuide?: boolean }>`
  padding: ${props => props.$isGuide ? '8px 16px 6px' : '8px 16px 6px'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  background: transparent;
  color: inherit;
  text-align: left;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
`;

const UserDetails = styled.div`
  flex: 1;
`;

const UserName = styled.div<{ $dark?: boolean }>`
  font-weight: 600;
  font-size: 14px;
  color: var(--glass-card-text);
  margin-bottom: 2px;
`;

const PostTime = styled.div<{ $dark?: boolean }>`
  font-size: 12px;
  color: var(--glass-card-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MoreButton = styled.button<{ $dark?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--glass-card-text-muted);

  &:hover {
    background: var(--glass-bg-hover);    color: var(--glass-card-text);
  }
`;

const PostContent = styled.div<{ $isGuide?: boolean }>`
  padding: 0 20px 16px;
`;

const PostTitle = styled.h3<{ $isGuide?: boolean; $dark?: boolean }>`
  font-size: 16px;
  font-weight: 600;
  color: var(--glass-card-text);
  margin-bottom: 4px;
  line-height: 1.28;
  text-shadow: none;
`;

const PostMeta = styled.div<{ $isGuide?: boolean; $dark?: boolean }>`
  display: flex;
  justify-content: center;
  gap: 16px;
  opacity: 0.9;
  font-size: 12px;
  margin-top: 0;
  color: var(--glass-card-text-muted);
  
  span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const XpBadge = styled.span<{ $dark?: boolean }>`
  background: ${p => p.$dark ? 'rgba(76, 175, 80, 0.18)' : 'rgba(76, 201, 240, 0.15)'};
  color: ${p => p.$dark ? '#43a047' : '#0ea5e9'};
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
`;

const PostText = styled.p<{ $isGuide?: boolean; $dark?: boolean }>`
  font-size: ${props => props.$isGuide ? '1.1rem' : '15px'};
  color: var(--glass-card-text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
  text-align: ${props => props.$isGuide ? 'justify' : 'left'};
`;

const InteractiveContent = styled.div`
  margin: 16px 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const InteractiveLabel = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PostActions = styled.div<{ $dark?: boolean }>`
  padding: 12px 20px;
  border-top: 1px solid var(--glass-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const ActionButton = styled.button<{ $liked?: boolean; $active?: boolean; $dark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  color: ${p => p.$liked ? '#ff3040' : p.$active ? '#6366f1' : 'var(--glass-card-text-muted)'};

  &:hover {
    background: ${p => p.$liked ? 'rgba(255,48,64,0.10)' : p.$active ? 'rgba(99,102,241,0.12)' : 'var(--glass-bg-hover)'};
    color: ${p => p.$liked ? '#ff3040' : p.$active ? '#6366f1' : 'var(--glass-card-text)'};
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const Stats = styled.div<{ $dark?: boolean }>`
  font-size: 12px;
  color: var(--glass-card-text-muted);
  font-weight: 500;
`;

const PostCard: React.FC<PostCardProps> = ({
  post,
  onClick,
  onLike,
  onComment,
  onShare,
  onReaction,
  template = 'mobile',
  expanded = false,
  onToggleExpand
}) => {
  const { theme } = useThemeStore();
  const dk = theme === 'dark';
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [reactions, setReactions] = useState<PostReaction[]>(post.reactions || []);
  const [showComments, setShowComments] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.comments_count ?? 0);
  // Собираем гео-ссылки из полей поста
  const geoRefs = useMemo<GeoRef[]>(() => {
    const refs: GeoRef[] = [];
    if (post.marker_id) refs.push({ type: 'marker', id: post.marker_id, title: post.title || 'Место' });
    if (post.route_id) refs.push({ type: 'route', id: post.route_id, title: post.title || 'Маршрут' });
    if (post.event_id) refs.push({ type: 'event', id: post.event_id, title: post.title || 'Событие' });
    return refs;
  }, [post.marker_id, post.route_id, post.event_id, post.title]);

  // Клик по гео-иконке → открываем карту слева, посты остаются справа
  const handleGeoOpen = useCallback((ref: GeoRef) => {
    useGeoFocusStore.getState().setFocus({ type: ref.type, id: ref.id, title: ref.title });
    useContentStore.getState().setLeftContent('map');
    useContentStore.getState().setRightContent('posts');
  }, []);

  // Преобразуем реакции в формат для компонента
  const reactionsForComponent = useMemo((): PostReactionComponent[] => {
    return reactions.map(r => ({
      emoji: r.emoji,
      count: r.count,
      userReacted: r.user_reacted,
      users: r.users
    }));
  }, [reactions]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike(post.id);
  };

  const handleReactionClick = async (emoji: string) => {
    try {
      // Оптимистичное обновление
      const existingReaction = reactions.find(r => r.emoji === emoji);
      const updatedReactions = [...reactions];
      
      if (existingReaction) {
        if (existingReaction.user_reacted) {
          // Убираем реакцию
          existingReaction.count = Math.max(0, existingReaction.count - 1);
          existingReaction.user_reacted = false;
          if (existingReaction.count === 0) {
            // Удаляем реакцию, если счётчик ноль
            const index = updatedReactions.findIndex(r => r.emoji === emoji);
            if (index >= 0) updatedReactions.splice(index, 1);
          }
        } else {
          // Добавляем реакцию
          existingReaction.count += 1;
          existingReaction.user_reacted = true;
        }
      } else {
        // Новая реакция
        updatedReactions.push({
          emoji,
          count: 1,
          user_reacted: true,
          users: []
        });
      }
      
      setReactions(updatedReactions);
      
      // Вызываем API
      if (onReaction) {
        onReaction(post.id, emoji);
      } else {
        await toggleReaction(post.id, emoji);
      }
    } catch (error) {
      console.error('Ошибка при добавлении реакции:', error);
      // Откатываем изменения при ошибке
      setReactions(post.reactions || []);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(prev => !prev);
    onComment(post.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(post.id);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours}ч`;
    if (hours < 48) return 'вчера';
    return date.toLocaleDateString('ru-RU');
  };

  const getInitials = (name?: string | null) => {
    const safe = (name || '').trim();
    if (!safe) return '??';
    return safe
      .split(/\s+/)
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderInteractiveContent = () => {
    if (post.route_id) {
      return (
        <InteractiveContent>
          <InteractiveLabel>
            <Navigation size={14} />
            Маршрут
          </InteractiveLabel>
          <MiniMapRoute routeId={post.route_id} height="200px" />
        </InteractiveContent>
      );
    }
    
    if (post.marker_id) {
      return (
        <InteractiveContent>
          <InteractiveLabel>
            <MapPin size={14} />
            Место
          </InteractiveLabel>
          <MiniMapMarker markerId={post.marker_id} height="314px" />
        </InteractiveContent>
      );
    }
    
    if (post.event_id) {
      return (
        <InteractiveContent>
          <InteractiveLabel>
            <Calendar size={14} />
            Событие
          </InteractiveLabel>
          <MiniEventCard eventId={post.event_id} height="200px" />
        </InteractiveContent>
      );
    }
    
    return null;
  };

  const { user } = useAuth() || { user: null } as any;
  const isAdmin = user?.role === 'admin';
  
  const guidePost = isGuidePost(post);
  const displayText = guidePost ? getSimplePostText(post) : (post.body || '');
  
  // Для постов с заголовком применяем градиентную шапку (как в примере)
  const hasTitle = !!post.title && post.title.trim().length > 0;
  const useGradientHeader = hasTitle || guidePost;

  const handleCardClick = () => {
    if (onToggleExpand) onToggleExpand();
    else if (onClick) onClick();
  };

  const getStatusBadge = () => {
    // Показываем бейдж статуса для админа и для автора поста (если статус не active)
    if (!post.status || post.status === 'active') return null;
    
    // Для админа показываем всегда, для автора - только если пост на модерации или отклонен
    const isAuthor = user?.id === post.author_id;
    if (!isAdmin && !isAuthor) return null;
    
    return (
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10
      }}>
        <ModerationBadge status={post.status as 'pending' | 'active' | 'rejected' | 'revision'} />
      </div>
    );
  };

  return (
    <PostContainer className="post-item" template={template} $isGuide={guidePost || hasTitle} $dark={dk} onClick={handleCardClick} style={{ position: 'relative' }}>
      {getStatusBadge()}
      {/* Хедер поста */}
      <PostHeader $isGuide={useGradientHeader}>
        {useGradientHeader ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {post.title && <PostTitle $isGuide={useGradientHeader} $dark={dk}>{post.title}</PostTitle>}
              <GeoBadgeList geoRefs={geoRefs} onOpen={handleGeoOpen} />
            </div>
            <PostMeta $isGuide={useGradientHeader} $dark={dk}>
              <span>
                <User size={16} />
                {post.author_name || 'ГеоБлог.рф'}
              </span>
              <span>
                <Clock size={16} />
                {new Date(post.created_at).toLocaleDateString('ru-RU')}
              </span>
              <span>
                <XpBadge $dark={dk}>
                  XP {Math.max(0, (post.likes_count || 0) * 2 + (post.comments_count || 0) * 3)}
                </XpBadge>
              </span>
            </PostMeta>
          </>
        ) : (
          <>
            <UserInfo>
              <Avatar>
                {getInitials(post.author_name)}
              </Avatar>
              <UserDetails>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UserName $dark={dk}>{post.author_name}</UserName>
                  <GeoBadgeList geoRefs={geoRefs} onOpen={handleGeoOpen} />
                </div>
                <PostTime $dark={dk}>
                  <Clock size={12} />
                  {formatTime(post.created_at)}
                </PostTime>
              </UserDetails>
            </UserInfo>
            <MoreButton $dark={dk}>
              <MoreHorizontal size={16} />
            </MoreButton>
          </>
        )}
      </PostHeader>

      {/* Контент поста */}
      <PostContent $isGuide={guidePost}>
        {guidePost && expanded ? (
          <GuideInline post={post} />
        ) : guidePost ? (
          <div style={{ padding: '0 40px' }}>
            <PostText $isGuide={guidePost} $dark={dk}>{displayText}</PostText>
          </div>
        ) : (
          <>
            {displayText && (
              <PostText
                $isGuide={guidePost}
                $dark={dk}
                style={!expanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
              >
                {displayText}
              </PostText>
            )}

            {/* Галерея фото (как в VK: крупный первый кадр + мини-превью) */}
            {post.photo_urls && (() => {
              const photos: string[] = typeof post.photo_urls === 'string' 
                ? post.photo_urls.split(',').map((u) => u.trim()).filter((u): u is string => !!u)
                : Array.isArray(post.photo_urls) 
                  ? (post.photo_urls as (string | undefined | null)[]).filter((url): url is string => !!url)
                  : [];
              
              if (photos.length === 0) return null;
              
              const first = photos[0];
              const rest = photos.slice(1);

              return (
                <div style={{ marginTop: 12 }}>
                  {/* Крупный первый кадр */}
                  <img
                    src={first}
                    alt="Фото 1"
                    style={{ width: '100%', height: '420px', objectFit: 'cover', borderRadius: 12, display: 'block' }}
                    onClick={(e) => { e.stopPropagation(); }}
                  />
                  {/* Превью оставшихся */}
                  {rest.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto' }}>
                      {rest.map((url: string, idx: number) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Фото ${idx + 2}`}
                          style={{ width: 110, height: 84, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }}
                          onClick={(e) => { e.stopPropagation(); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Мини‑карта / интерактив сразу под фото */}
            {renderInteractiveContent()}
            {!expanded && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand && onToggleExpand(); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: dk ? '#818cf8' : '#3b82f6',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 600
                  }}
                >Показать полностью</button>
              </div>
            )}
          </>
        )}
      </PostContent>

      {/* Действия */}
      <PostActions $dark={dk}>
        <ActionButtons>
          <ActionButton $liked={isLiked} $dark={dk} onClick={handleLike}>
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            {likesCount}
          </ActionButton>
          
          <ActionButton onClick={handleComment} $active={showComments} $dark={dk}>
            <MessageCircle size={18} fill={showComments ? 'currentColor' : 'none'} />
            {localCommentsCount}
          </ActionButton>
          
          <ActionButton onClick={handleShare} $dark={dk}>
            <Share size={18} />
          </ActionButton>
        </ActionButtons>
        
        {/* Реакции эмодзи */}
        {reactionsForComponent.length > 0 && (
          <div style={{ marginTop: '12px', marginBottom: '8px' }}>
            <PostReactions
              reactions={reactionsForComponent}
              onReactionClick={handleReactionClick}
            />
          </div>
        )}
        
        {/* Кнопка добавления реакции, если их ещё нет */}
        {reactionsForComponent.length === 0 && (
          <div style={{ marginTop: '12px', marginBottom: '8px' }}>
            <PostReactions
              reactions={[]}
              onReactionClick={handleReactionClick}
            />
          </div>
        )}
        
        <Stats $dark={dk}>
          {post.likes_count} лайков • {localCommentsCount} комментариев
        </Stats>
      </PostActions>

      {/* Раздел комментариев — stopPropagation чтобы клики внутри не триггерили handleCardClick */}
      {showComments && (
        <div onClick={e => e.stopPropagation()}>
          <Suspense fallback={null}>
            <PostComments
              postId={post.id}
              commentsCount={localCommentsCount}
              onCountChange={delta => setLocalCommentsCount(prev => Math.max(0, prev + delta))}
              isDark={dk}
            />
          </Suspense>
        </div>
      )}
    </PostContainer>
  );
};

export default PostCard;
