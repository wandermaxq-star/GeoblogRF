/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
// TODO: temporary — relax lint rules in large files while we migrate types (follow-up task)
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { useLayoutState } from '../contexts/LayoutContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import PageLayout from '../components/PageLayout';
import { listPosts, createPost, PostDTO, toggleReaction } from '../services/postsService';
import { FaPlus, FaCog, FaEdit, FaFileAlt, FaCloud, FaTimes } from 'react-icons/fa';
import { useContentStore } from '../stores/contentStore';
import '../styles/PageLayout.css';
import CreatePostModal from '../components/Posts/CreatePostModal';
import PostCard from '../components/Posts/PostCard';
import { useAuth } from '../contexts/AuthContext';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
import { getPendingContentCounts } from '../services/localModerationStorage';
import OfflineDraftsPanel from '../components/Posts/OfflineDraftsPanel';
import { offlinePostsStorage } from '../services/offlinePostsStorage';
import { offlineContentStorage } from '../services/offlineContentStorage';
import { moderationNotifications } from '../services/moderationNotifications';
import { useThemeStore } from '../stores/themeStore';

// Ленивая загрузка тяжелых компонентов
const LazyPostConstructor = lazy(() => import('../components/Posts/PostConstructor'));
const LazyInteractivePostView = lazy(() => import('../components/Posts/InteractivePostView'));
const LazyPostDetail = lazy(() => import('./Posts/PostDetail'));

type ContentFilter = 'all' | 'post' | 'guide';
type StatusFilter = 'all' | 'pending' | 'active';

const PostsPage: React.FC = () => {
  const { user } = useAuth() || { user: null } as any;
  const isAdmin = user?.role === 'admin';
  const layout = useLayoutState();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostConstructor, setShowPostConstructor] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostDTO | null>(null);
  const [showInteractivePost, setShowInteractivePost] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [draftsCount, setDraftsCount] = useState(0);
  // Интеграция с глобальной системой тем: data-theme управляет вариантом стекла
  const { theme } = useThemeStore();
  const glassVariant = theme; // 'light' | 'dark' — мапится на CSS-классы glass-light / glass-dark

  // Оверлей больше не нужен — glass L1/L2 автоматически переключается через CSS vars
  const overlayStyle: React.CSSProperties = {};

  // Проверяем двухоконный режим - есть ли левая панель (карта/планировщик)
  const leftContent = useContentStore((state) => state.leftContent);
  const isTwoPanelMode = leftContent !== null;

  // Функция закрытия правой панели (постов) в двухоконном режиме
  const handleClosePanel = useCallback(() => {
    const store = useContentStore.getState();
    store.setRightContent(null);
  }, []);

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  // Примечание: Обработка ошибок расширений браузера теперь централизована в main.tsx

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        setLoading(true);
        const params: any = {
          limit: 100, // Увеличиваем лимит, чтобы получить больше постов для фильтрации
          content_type: contentFilter === 'all' ? 'all' : contentFilter
        };

        // Для админа: показываем ВСЕ посты (включая pending) для визуального предпросмотра
        // Посты со статусом pending должны отображаться сразу после создания
        if (isAdmin) {
          // Если админ выбрал конкретный статус - фильтруем по нему
          if (statusFilter && statusFilter !== 'all') {
            params.status = statusFilter;
          }
          // Если админ выбрал 'all' - НЕ устанавливаем статус, чтобы показать ВСЕ посты (pending, active, rejected и т.д.)
          // Это позволяет админу видеть посты сразу после создания, до модерации
        } else {
          // Для обычных пользователей: НЕ устанавливаем статус, чтобы получить все посты
          // Затем отфильтруем на фронтенде: покажем активные посты всех пользователей + свои посты на модерации
        }

        const response = await listPosts(params);
        if (!cancelled) {
          let postsData = response.data || [];

          // Для обычных пользователей фильтруем посты:
          // - Показываем активные посты всех пользователей
          // - Показываем свои посты со статусом 'pending' (на модерации)
          if (!isAdmin && user?.id) {
            postsData = postsData.filter((post: PostDTO) => {
              // Посты без статуса (мок-данные, черновики) — показываем
              if (!post.status) {
                return true;
              }
              // Показываем активные посты всех пользователей
              if (post.status === 'active') {
                return true;
              }
              // Показываем свои посты на модерации
              if (post.status === 'pending' && post.author_id === user.id) {
                return true;
              }
              // Остальные посты не показываем
              return false;
            });
          }

          setPosts(postsData);
          console.log('✅ Посты загружены:', postsData.length, 'постов');
          if (postsData.length > 0) {
            console.log('📝 Первые 3 поста:', postsData.slice(0, 3).map(p => ({
              id: p.id,
              title: p.title?.substring(0, 30),
              status: p.status,
              author: p.author_name,
              isMyPost: p.author_id === user?.id
            })));
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPosts([]);
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [contentFilter, statusFilter, isAdmin, user?.id]);

  // Загружаем счётчик модерации
  useEffect(() => {
    if (isAdmin) {
      const counts = getPendingContentCounts();
      setModerationCount(counts.post);
    }
  }, [isAdmin]);

  // Загружаем счётчик черновиков
  useEffect(() => {
    const loadDraftsCount = async () => {
      try {
        await offlineContentStorage.init();
        const count = await offlineContentStorage.getDraftsCount();
        setDraftsCount(count);
      } catch (error) {
        console.error('Ошибка загрузки счётчика черновиков:', error);
      }
    };

    loadDraftsCount();

    // Обновляем счётчик каждые 60 секунд (было 5 — слишком агрессивно)
    const interval = setInterval(loadDraftsCount, 60000);

    return () => clearInterval(interval);
  }, []);

  // Функция для перезагрузки постов
  const reloadPosts = useCallback(async () => {
    try {
      const params: any = {
        limit: 50,
        content_type: contentFilter === 'all' ? 'all' : contentFilter
      };

      // Для админа добавляем фильтр по статусу
      if (isAdmin) {
        // Если админ выбрал конкретный статус - фильтруем по нему
        if (statusFilter && statusFilter !== 'all') {
          params.status = statusFilter;
        }
        // Если админ выбрал 'all' или статус не указан - НЕ устанавливаем статус, чтобы показать все посты
      } else {
        // Для обычных пользователей показываем активные посты И свои посты на модерации
        // Не устанавливаем params.status, чтобы получить все посты, затем отфильтруем на фронтенде
        // Это позволит пользователю видеть свои посты со статусом 'pending'
      }

      console.log('📥 Загружаем посты с параметрами:', params);
      const response = await listPosts(params);
      if (response.data) {
        setPosts(response.data);
        console.log('✅ Посты обновлены:', response.data.length, 'постов');
        console.log('📝 Обновленные посты:', response.data.map(p => ({
          id: p.id,
          title: p.title?.substring(0, 30),
          status: p.status,
          author: p.author_name
        })));
      } else {
        console.warn('⚠️ Ответ не содержит data:', response);
      }
    } catch (error) {
      console.error('❌ Ошибка обновления постов:', error);
    }
  }, [contentFilter, statusFilter, isAdmin]);

  // Слушаем событие одобрения контента для обновления постов
  useEffect(() => {
    const handleContentApproved = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { contentType, contentId, authorId } = customEvent.detail || {};

      console.log('📨 Получено событие content-approved:', { contentType, contentId, authorId });

      // Если это пост, обновляем список для ВСЕХ пользователей
      if (contentType === 'post') {
        console.log('🔄 Событие одобрения поста получено:', contentId, 'автор:', authorId);

        // ПРИНУДИТЕЛЬНО загружаем активные посты несколько раз для надежности
        const forceReloadActivePosts = async (attempt: number = 1) => {
          try {
            const params: any = {
              limit: 50,
              content_type: contentFilter === 'all' ? 'all' : contentFilter
            };

            // ВАЖНО: После одобрения показываем активные посты для ВСЕХ (включая админа)
            // Если админ выбрал 'all', временно переключаемся на 'active' для обновления
            if (isAdmin && statusFilter === 'all') {
              // Для админа при 'all' показываем все посты, но после одобрения - активные
              params.status = 'active';
            } else if (isAdmin && statusFilter !== 'all') {
              params.status = statusFilter;
            } else {
              params.status = 'active';
            }

            console.log(`🔄 Попытка ${attempt}: Принудительная загрузка постов:`, params);
            const response = await listPosts(params);
            if (response.data) {
              setPosts(response.data);
              console.log(`✅ Посты загружены (попытка ${attempt}):`, response.data.length, 'постов');
              console.log('📝 Загруженные посты:', response.data.map(p => ({
                id: p.id,
                title: p.title?.substring(0, 30),
                status: p.status,
                author: p.author_name
              })));

              // Проверяем, есть ли одобренный пост в списке
              const approvedPost = response.data.find(p =>
                p.id === contentId ||
                p.id?.toString() === contentId?.toString() ||
                p.id === `post:${contentId}` ||
                p.id === contentId?.toString()
              );

              if (approvedPost) {
                console.log('✅ Одобренный пост найден в списке!', approvedPost.id);
                // Если админ выбрал 'all', перезагружаем все посты
                if (isAdmin && statusFilter === 'all') {
                  setTimeout(() => reloadPosts(), 500);
                }
              } else if (attempt < 5) {
                console.warn(`⚠️ Пост не найден, повторная попытка ${attempt + 1}...`);
                setTimeout(() => forceReloadActivePosts(attempt + 1), 1000);
              } else {
                console.warn('⚠️ Пост не найден после 5 попыток, перезагружаем все посты');
                // Последняя попытка - загружаем все посты (для админа)
                if (isAdmin && statusFilter === 'all') {
                  reloadPosts();
                }
              }
            }
          } catch (error) {
            console.error(`❌ Ошибка при попытке ${attempt}:`, error);
            if (attempt < 5) {
              setTimeout(() => forceReloadActivePosts(attempt + 1), 1000);
            }
          }
        };

        // Множественные попытки с разными задержками
        setTimeout(() => forceReloadActivePosts(1), 500);
        setTimeout(() => forceReloadActivePosts(2), 1200);
        setTimeout(() => forceReloadActivePosts(3), 2000);
        setTimeout(() => forceReloadActivePosts(4), 3000);
        setTimeout(() => forceReloadActivePosts(5), 4500);

        // Также обновляем через reloadPosts для надежности
        setTimeout(() => {
          console.log('🔄 Дополнительное обновление через reloadPosts');
          reloadPosts();
        }, 2000);
      } else {
        console.log('⚠️ Событие не для поста, пропускаем:', contentType);
      }
    };

    // Обработчик изменения localStorage (для обновления между вкладками)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'last-approved-content' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          console.log('📦 Обновление из localStorage:', data);
          if (data.contentType === 'post') {
            console.log('🔄 Обновляем посты из localStorage:', data);
            setTimeout(() => {
              reloadPosts();
            }, 1000);
          }
        } catch (err) {
          console.error('Ошибка парсинга данных из localStorage:', err);
        }
      }
    };

    console.log('👂 Регистрируем обработчики событий для обновления постов');
    window.addEventListener('content-approved', handleContentApproved);
    window.addEventListener('storage', handleStorageChange);

    // Подписываемся на уведомления о модерации
    const unsubscribe = moderationNotifications.onNotification((notification) => {
      // Показываем уведомление только для текущего пользователя
      if (user && notification.status === 'approved') {
        // Создаём визуальное уведомление
        const notificationElement = document.createElement('div');
        notificationElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
        notificationElement.style.animation = 'slideInRight 0.3s ease-out';
        notificationElement.innerHTML = `
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="font-semibold">Контент одобрен!</div>
              <div class="text-sm">${notification.message || 'Ваш контент был опубликован'}</div>
            </div>
          </div>
        `;
        document.body.appendChild(notificationElement);

        // Удаляем через 5 секунд
        setTimeout(() => {
          notificationElement.style.opacity = '0';
          notificationElement.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            if (document.body.contains(notificationElement)) {
              document.body.removeChild(notificationElement);
            }
          }, 300);
        }, 5000);
      } else if (user && (notification.status === 'rejected' || notification.status === 'revision')) {
        // Уведомление об отклонении или доработке
        const notificationElement = document.createElement('div');
        notificationElement.className = `fixed top-4 right-4 ${notification.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'} text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3`;
        notificationElement.style.animation = 'slideInRight 0.3s ease-out';
        notificationElement.innerHTML = `
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${notification.status === 'rejected'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>'
          }
            </svg>
            <div>
              <div class="font-semibold">${notification.status === 'rejected' ? 'Контент отклонён' : 'Требуется доработка'}</div>
              <div class="text-sm">${notification.message || 'Проверьте комментарии модератора'}</div>
            </div>
          </div>
        `;
        document.body.appendChild(notificationElement);

        // Удаляем через 7 секунд (дольше для важных уведомлений)
        setTimeout(() => {
          notificationElement.style.opacity = '0';
          notificationElement.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            if (document.body.contains(notificationElement)) {
              document.body.removeChild(notificationElement);
            }
          }, 300);
        }, 7000);
      }
    });

    return () => {
      window.removeEventListener('content-approved', handleContentApproved);
      window.removeEventListener('storage', handleStorageChange);
      unsubscribe();
    };

    return () => {
      console.log('🔇 Удаляем обработчики событий');
      window.removeEventListener('content-approved', handleContentApproved);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [reloadPosts]);

  const handlePostCreated = (newPost: PostDTO) => {
    // Добавляем пост в начало списка
    setPosts(prev => {
      // Убираем дубликаты (на случай если пост уже есть)
      const filtered = prev.filter(p => p.id !== newPost.id);
      return [newPost, ...filtered];
    });

    // Перезагружаем список постов для получения актуальных данных
    const loadPosts = async () => {
      try {
        const response = await listPosts({ limit: 50 });
        // Убираем дубликаты
        const uniquePosts = Array.from(
          new Map([newPost, ...response.data].map(post => [post.id, post])).values()
        );
        setPosts(uniquePosts);
      } catch (error) {
        // Тихая ошибка - не показываем пользователю
      }
    };

    // Небольшая задержка перед перезагрузкой, чтобы дать серверу время сохранить
    setTimeout(loadPosts, 1000);
  };

  // Проверяем, есть ли интерактивный контент в посте
  const hasInteractiveContent = (post: PostDTO) => {
    return !!(post.route_id || post.marker_id || post.event_id);
  };

  const handlePostClick = (post: PostDTO) => {
    // Всегда инлайн-раскрытие, как VK
    setExpandedPosts(prev => ({ ...prev, [post.id]: !prev[post.id] }));
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    setShowInteractivePost(false);
  };

  const handleCloseInteractivePost = () => {
    setShowInteractivePost(false);
    setSelectedPost(null);
  };

  const handlePostConstructorSave = async (postData: any) => {
    try {
      // Формируем тело поста
      const body = postData.description || postData.body || '';

      // Извлекаем фото URL
      let photoUrls: string | undefined;
      if (postData.photoUrls) {
        photoUrls = postData.photoUrls;
      } else if (postData.images?.items) {
        // Альтернативный путь - извлекаем из images.items
        const urls = postData.images.items
          .filter((img: any) => img.src && !img.src.startsWith('blob:') && !img.src.startsWith('data:') && !img.src.startsWith('http://localhost:5173'))
          .map((img: any) => img.src);
        photoUrls = urls.length > 0 ? urls.join(',') : undefined;
      }

      // Извлекаем данные карты (крючки)
      let marker_id: string | undefined;
      let route_id: string | undefined;
      let event_id: string | undefined;

      if (postData.map?.elements) {
        // Берем первый маркер, если есть
        if (postData.map.elements.markers && Array.isArray(postData.map.elements.markers) && postData.map.elements.markers.length > 0) {
          const firstMarker = postData.map.elements.markers[0];
          marker_id = firstMarker.id || firstMarker.marker_id || firstMarker.markerId;
          if (!marker_id || typeof marker_id !== 'string' || marker_id.length === 0) {
            marker_id = undefined;
          }
        }

        // Берем первый маршрут, если есть
        if (postData.map.elements.routes && Array.isArray(postData.map.elements.routes) && postData.map.elements.routes.length > 0) {
          const firstRoute = postData.map.elements.routes[0];
          route_id = firstRoute.id || firstRoute.route_id || firstRoute.routeId;
          if (!route_id || typeof route_id !== 'string' || route_id.length === 0) {
            route_id = undefined;
          }
        }

        // Берем первое событие, если есть
        if (postData.map.elements.events && Array.isArray(postData.map.elements.events) && postData.map.elements.events.length > 0) {
          const firstEvent = postData.map.elements.events[0];
          event_id = firstEvent.id || firstEvent.event_id || firstEvent.eventId;
          if (!event_id || typeof event_id !== 'string' || event_id.length === 0) {
            event_id = undefined;
          }
        }
      }

      // Валидация: убеждаемся, что есть хотя бы заголовок или описание
      if (!postData.title && !body.trim()) {
        alert('❌ Добавьте заголовок или описание поста');
        return;
      }

      // Показываем информацию о том, что сохраняем
      const infoMessage = [
        `📝 Заголовок: ${postData.title || 'нет'}`,
        `📄 Описание: ${body.trim() ? 'есть' : 'нет'}`,
        `📸 Фото: ${photoUrls ? photoUrls.split(',').length + ' шт.' : 'нет'}`,
        `📍 Маркер: ${marker_id ? 'есть' : 'нет'}`,
        `🗺️ Маршрут: ${route_id ? 'есть' : 'нет'}`,
        `📅 Событие: ${event_id ? 'есть' : 'нет'}`
      ].join('\n');

      // Создаем пост через API
      const createPostData = {
        title: postData.title?.trim() || undefined,
        body: body.trim() || undefined,
        photo_urls: photoUrls,
        marker_id: marker_id,
        route_id: route_id,
        event_id: event_id,
        template: 'mobile'
      };

      const created = await createPost(createPostData);

      // Показываем успех
      alert(`✅ Пост успешно создан!\n\n${infoMessage}`);

      // Добавляем пост в список
      handlePostCreated(created);

      // Закрываем конструктор
      setShowPostConstructor(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`❌ Не удалось сохранить пост:\n${errorMessage}`);
    }
  };


  // Если открыт конструктор постов, показываем его
  if (showPostConstructor) {
    return (
      <MirrorGradientContainer className={`page-layout-container page-container posts-mode glass-${glassVariant}`}>
        <div className="page-main-area" style={overlayStyle}>
          <div className="page-content-wrapper">
            <div className="page-main-panel relative">
              <Suspense fallback={<div className="text-center p-8">Загрузка конструктора...</div>}>
                <LazyPostConstructor
                  onSave={handlePostConstructorSave}
                  onClose={() => setShowPostConstructor(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </MirrorGradientContainer>
    );
  }

  // Если открыт пост с интерактивным контентом, показываем полноэкранный режим
  if (showInteractivePost && selectedPost) {
    return (
      <Suspense fallback={<div className="text-center p-8">Загрузка интерактивного просмотра...</div>}>
        <LazyInteractivePostView
          post={selectedPost}
          onClose={handleCloseInteractivePost}
          onReaction={async (postId: string, emoji: string) => {
            try {
              await toggleReaction(postId, emoji);
              // Обновляем локально после успешного ответа
            } catch (error) {
            }
          }}
          onLike={(postId) => {
            // TODO: Реализовать лайк
          }}
          onComment={(postId) => {
            // TODO: Реализовать комментарии
          }}
          onShare={(postId) => {
            // TODO: Реализовать поделиться
          }}
        />
      </Suspense>
    );
  }

  // Если открыт пост без интерактивного контента, показываем обычный режим
  if (selectedPost && !showInteractivePost) {
    return (
      <MirrorGradientContainer className={`page-layout-container page-container posts-mode glass-${glassVariant}`}>
        <div className="page-main-area" style={overlayStyle}>
          <div className="page-content-wrapper">
            <div className="page-main-panel relative">
              <Suspense fallback={<div className="text-center p-8">Загрузка деталей поста...</div>}>
                <LazyPostDetail post={selectedPost} onBack={handleBackToList} />
              </Suspense>
            </div>
          </div>
        </div>
      </MirrorGradientContainer>
    );
  }

  return (
    <MirrorGradientContainer className={`page-layout-container page-container posts-mode glass-${glassVariant}`}>
      <div className="page-main-area" style={overlayStyle}>
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* СТАТИЧНЫЙ ЗАГОЛОВОК */}
            <div className="posts-static-header">
              <div className="posts-title-row">
                <h1 className="posts-main-title">Лента контента</h1>
              </div>

              {/* Фильтры и кнопки */}
              <div className="posts-controls-row">
                <div className="posts-filter-group">
                  <button
                    onClick={() => setContentFilter('all')}
                    className={`filter-btn ${contentFilter === 'all' ? 'active blue' : ''}`}
                  >
                    Вся лента
                  </button>
                  <button
                    onClick={() => setContentFilter('post')}
                    className={`filter-btn ${contentFilter === 'post' ? 'active blue' : ''}`}
                  >
                    Посты
                  </button>
                  <button
                    onClick={() => setContentFilter('guide')}
                    className={`filter-btn ${contentFilter === 'guide' ? 'active orange' : ''}`}
                  >
                    Путеводители
                  </button>
                </div>

                <div className="posts-action-group">
                  {draftsCount > 0 && (
                    <button
                      onClick={() => setShowDraftsPanel(true)}
                      className="btn-drafts"
                      title="Офлайн черновики"
                    >
                      <FaCloud className="w-4 h-4" />
                      <span>Черновики</span>
                      <span className="drafts-badge">{draftsCount}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-create-post"
                    title="Создать новый пост"
                  >
                    <FaPlus className="w-4 h-4" />
                    <span>Создать пост</span>
                  </button>
                </div>

                {/* Переключатель варианта стекла управляется глобальной темой (кнопка в Topbar) */}

              </div>
            </div>

            {/* СКРОЛЛЬНАЯ ОБЛАСТЬ - только посты */}
            <div className="posts-scroll-area">
              <div className="posts-content-centered">
                {/* Inline-форма создания поста */}
                {showCreateModal && (
                  <div className="mb-4">
                    <CreatePostModal
                      isOpen={showCreateModal}
                      onClose={() => setShowCreateModal(false)}
                      onPostCreated={handlePostCreated}
                      inline={true}
                    />
                  </div>
                )}

                {/* Список постов */}
                <div className="space-y-4">
                  {loading ? (
                    <div className="posts-state-view">
                      <div className="posts-state-icon-wrapper">
                        <FaFileAlt className="posts-state-icon animate-pulse" />
                      </div>
                      <h3 className="posts-state-title">Загрузка постов...</h3>
                    </div>
                  ) : posts.length > 0 ? (
                    posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        expanded={!!expandedPosts[post.id]}
                        onToggleExpand={() => handlePostClick(post)}
                        onReaction={async (postId: string, emoji: string) => {
                          try {
                            await toggleReaction(postId, emoji);
                            // Обновляем локальный список постов
                            setPosts(prev => prev.map(p =>
                              p.id === postId
                                ? { ...p, reactions: p.reactions || [] } // Обновление будет через API
                                : p
                            ));
                          } catch (error) {
                          }
                        }}
                        onLike={(postId: string) => {
                          // TODO: Реализовать лайк
                        }}
                        onComment={(postId: string) => {
                          // TODO: Реализовать комментарии
                        }}
                        onShare={(postId: string) => {
                          // TODO: Реализовать шаринг
                        }}
                      />
                    ))
                  ) : (
                    <div className="posts-state-view">
                      <div className="posts-state-icon-wrapper">
                        <FaEdit className="posts-state-icon" />
                      </div>
                      <h3 className="posts-state-title">Пока нет постов</h3>
                      <p className="posts-state-subtitle">Создайте первый пост, нажав кнопку выше</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Форма создания поста теперь встроена в скролл-область */}

      {/* Панель офлайн черновиков */}
      <OfflineDraftsPanel
        isOpen={showDraftsPanel}
        onClose={() => {
          setShowDraftsPanel(false);
          // Обновляем счётчик после закрытия
          offlinePostsStorage.getDraftsCount().then(setDraftsCount);
        }}
      />

      {/* Модальное окно конструктора постов */}


      {/* Кнопка модерации для админа */}
      {isAdmin && !showModerationModal && (
        <button
          onClick={() => setShowModerationModal(true)}
          className="fixed right-4 top-20 z-40 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          title="Модерация постов"
        >
          <span>📋</span>
          <span>Модерация</span>
          {moderationCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {moderationCount}
            </span>
          )}
        </button>
      )}

      {/* Модальное окно модерации */}
      {isAdmin && (
        <AdminModerationModal
          isOpen={showModerationModal}
          onClose={() => setShowModerationModal(false)}
          contentType="post"
          onContentApproved={async (contentId) => {
            console.log('✅ Контент одобрен через onContentApproved, ПРИНУДИТЕЛЬНО обновляем посты...', contentId);

            // ПРИНУДИТЕЛЬНО перезагружаем посты СРАЗУ и несколько раз для надежности
            const forceReloadPosts = async (attempt: number = 1) => {
              try {
                const params: any = {
                  limit: 50,
                  content_type: contentFilter === 'all' ? 'all' : contentFilter,
                  status: 'active' // ВСЕГДА показываем активные посты после одобрения
                };

                console.log(`🔄 Попытка ${attempt}: Принудительная перезагрузка активных постов:`, params);
                const response = await listPosts(params);
                if (response.data) {
                  setPosts(response.data);
                  console.log(`✅ Посты обновлены (попытка ${attempt}):`, response.data.length, 'постов');
                  console.log('📝 Обновленные посты:', response.data.map(p => ({
                    id: p.id,
                    title: p.title?.substring(0, 30),
                    status: p.status,
                    author: p.author_name
                  })));

                  // Проверяем, есть ли одобренный пост в списке
                  const foundPost = response.data.find(p =>
                    p.id === contentId ||
                    p.id?.toString() === contentId?.toString() ||
                    p.id === `post:${contentId}` ||
                    p.id === contentId?.toString()
                  );

                  if (foundPost) {
                    console.log('✅ Одобренный пост найден в списке!', foundPost.id);
                  } else if (attempt < 5) {
                    // Если пост не найден, повторяем попытку
                    console.log(`⚠️ Пост не найден, повторная попытка ${attempt + 1}...`);
                    setTimeout(() => forceReloadPosts(attempt + 1), 1000);
                  } else {
                    console.warn('⚠️ Пост не найден после 5 попыток');
                  }
                }
              } catch (error) {
                console.error(`❌ Ошибка при попытке ${attempt}:`, error);
                if (attempt < 5) {
                  setTimeout(() => forceReloadPosts(attempt + 1), 1000);
                }
              }
            };

            // Первая попытка сразу
            forceReloadPosts(1);

            // Дополнительные попытки с задержками
            setTimeout(() => forceReloadPosts(2), 800);
            setTimeout(() => forceReloadPosts(3), 1500);
            setTimeout(() => forceReloadPosts(4), 2500);
            setTimeout(() => forceReloadPosts(5), 4000);

            // Обновляем счётчик
            const counts = getPendingContentCounts();
            setModerationCount(counts.post);
          }}
          onContentRejected={(contentId) => {
            // Обновляем счётчик после отклонения
            const counts = getPendingContentCounts();
            setModerationCount(counts.post);
          }}
          onTaskClick={(content) => {
            // Можно открыть пост для просмотра
            // setSelectedPost(content.data);
          }}
        />
      )}
    </MirrorGradientContainer>
  );
};

export default PostsPage;