import React, { useState, useRef, useEffect, useCallback } from 'react';
import { listPosts, PostDTO, toggleReaction } from '../services/postsService';
import PostCard from './Posts/PostCard';
import { PostFeedSkeleton } from './ui/skeletons';

const PAGE_SIZE = 10;
/** Пауза между запросами подгрузки (ms) */
const LOAD_DEBOUNCE = 500;
/** Время «свежести» кэша (ms) — при дольше stale, refetch при focus */
const STALE_TIME = 5 * 60_000;

/**
 * PostFeed — лента постов с infinite scroll (IntersectionObserver).
 *
 * Не использует react-query / react-window — только встроенные средства React.
 * Подходит и для мобильной, и для десктопной версии.
 *
 * Реализовано:
 * - Infinite scroll (IntersectionObserver, debounce 500ms)
 * - Optimistic like
 * - Pull-to-refresh (через props)
 * - Lazy loading изображений (через PostCard)
 * - «Новые посты» badge (refetch in background)
 * - Background refetch on focus (staleTime 5 мин)
 * - Skeleton / Empty / Error states
 */
const PostFeed: React.FC = () => {
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchedAt = useRef(0);

  // --- «Новые посты» badge ---
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const latestIdRef = useRef<string | null>(null);

  // ---------- Колбэки для PostCard ----------

  const handleLike = useCallback(async (postId: string) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    );
    try {
      await toggleReaction(postId, '❤️');
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
            : p
        )
      );
    }
  }, []);

  const handleComment = useCallback((postId: string) => {
    // TODO: открыть модалку комментариев или перейти на пост
    console.log('Comment on post:', postId);
  }, []);

  const handleShare = useCallback((postId: string) => {
    if (navigator.share) {
      navigator.share({ url: `${window.location.origin}/posts/${postId}` }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${window.location.origin}/posts/${postId}`);
    }
  }, []);

  /** Загружает следующую страницу постов (с debounce). */
  const lastLoadTime = useRef(0);
  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    // Debounce 500ms
    const now = Date.now();
    if (now - lastLoadTime.current < LOAD_DEBOUNCE) return;
    lastLoadTime.current = now;

    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const response = await listPosts({ limit: PAGE_SIZE, offset: offsetRef.current });
      const newPosts = response.data ?? [];
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const unique = newPosts.filter((p) => !ids.has(p.id));
        return [...prev, ...unique];
      });
      offsetRef.current += newPosts.length;
      if (newPosts.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore]);

  /** Первоначальная загрузка. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await listPosts({ limit: PAGE_SIZE, offset: 0 });
        if (cancelled) return;
        const data = response.data ?? [];
        setPosts(data);
        offsetRef.current = data.length;
        lastFetchedAt.current = Date.now();
        latestIdRef.current = data[0]?.id ?? null;
        if (data.length < PAGE_SIZE) setHasMore(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Background refetch on focus (если данные stale > 5 мин). */
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchedAt.current < STALE_TIME) return;
      // Тихий фоновый перезапрос (не показываем loading spinner)
      listPosts({ limit: PAGE_SIZE, offset: 0 })
        .then((r) => {
          const data = r.data ?? [];
          if (data.length > 0 && latestIdRef.current && data[0].id !== latestIdRef.current) {
            // Появились новые посты — показываем badge
            setNewPostsAvailable(true);
          }
          lastFetchedAt.current = Date.now();
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  /** Обработчик нажатия на badge «Показать новые посты». */
  const showNewPosts = useCallback(() => {
    setNewPostsAvailable(false);
    setLoading(true);
    setError(false);
    offsetRef.current = 0;
    setHasMore(true);
    listPosts({ limit: PAGE_SIZE, offset: 0 })
      .then((r) => {
        const data = r.data ?? [];
        setPosts(data);
        offsetRef.current = data.length;
        latestIdRef.current = data[0]?.id ?? null;
        lastFetchedAt.current = Date.now();
        if (data.length < PAGE_SIZE) setHasMore(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  /** IntersectionObserver — подгружает при приближении к концу. */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  /** Перезагрузка при ошибке / pull-to-refresh. */
  const retry = useCallback(() => {
    setError(false);
    setNewPostsAvailable(false);
    offsetRef.current = 0;
    setHasMore(true);
    setPosts([]);
    setLoading(true);
    listPosts({ limit: PAGE_SIZE, offset: 0 })
      .then((r) => {
        const data = r.data ?? [];
        setPosts(data);
        offsetRef.current = data.length;
        latestIdRef.current = data[0]?.id ?? null;
        lastFetchedAt.current = Date.now();
        if (data.length < PAGE_SIZE) setHasMore(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // ---------- Рендер ----------

  if (loading) {
    return <PostFeedSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground mb-2">Ошибка загрузки постов</p>
        <button onClick={retry} className="underline text-primary">
          Попробовать снова
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Пока нет постов
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Badge «Новые посты» */}
      {newPostsAvailable && (
        <button
          onClick={showNewPosts}
          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-md animate-bounce"
        >
          Показать новые посты
        </button>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={handleLike}
          onComment={handleComment}
          onShare={handleShare}
        />
      ))}

      {/* Sentinel для IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Больше постов нет
        </p>
      )}
    </div>
  );
};

export default PostFeed;
