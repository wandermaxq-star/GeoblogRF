import apiClient from '../api/apiClient';
import { recordGuestAction } from './guestActionsService';
// gamificationHelper загружается динамически для уменьшения main bundle
import storageService from './storageService';

export interface PostReaction {
  emoji: string;
  count: number;
  user_reacted: boolean;
  users?: string[];
}

export interface PostDTO {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  // Реакции эмодзи
  reactions?: PostReaction[];
  route_id?: string;
  marker_id?: string;
  event_id?: string;
  photo_urls?: string | string[]; // Может быть строкой (через запятую) или массивом
  attached_snapshot?: MapSnapshot;
  is_draft?: boolean;
  // Тип контента: 'post' - обычный пост, 'guide' - путеводитель
  content_type?: 'post' | 'guide';
  // Данные конструктора для путеводителей (из блогов)
  constructor_data?: any;
  // Статус модерации
  status?: 'pending' | 'active' | 'rejected' | 'revision' | 'hidden';
}

export interface ReplyDTO {
  id: string;
  post_id: string;
  body: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
  route_id?: string;
  marker_id?: string;
  event_id?: string;
  payload?: {
    snapshot?: MapSnapshot;
  };
}

export interface MapSnapshot {
  id: string;
  center: [number, number];
  zoom: number;
  bounds: [[number, number], [number, number]];
  markers: Array<{
    id: string;
    coordinates: [number, number];
    title: string;
    description?: string;
  }>;
  routes: Array<{
    id: string;
    coordinates: [number, number][];
    title: string;
    description?: string;
  }>;
  events: Array<{
    id: string;
    coordinates: [number, number];
    title: string;
    description?: string;
    date: string;
    time?: string;
    location?: string;
  }>;
}

export interface CreatePostRequest {
  title?: string;
  body: string;
  route_id?: string;
  marker_id?: string;
  event_id?: string;
  photo_urls?: string; // Строка с URL через запятую или JSON массив
  template?: string;
  content_type?: 'post' | 'guide'; // Тип контента
  constructor_data?: any; // Данные конструктора для путеводителей
  payload?: {
    snapshot?: MapSnapshot;
  };
}

export interface CreateReplyRequest {
  post_id: string;
  body: string;
  route_id?: string;
  marker_id?: string;
  event_id?: string;
  payload?: {
    snapshot?: MapSnapshot;
  };
}

export interface ListPostsResponse {
  data: PostDTO[];
  total: number;
}

export interface ListRepliesResponse {
  data: ReplyDTO[];
  total: number;
}

export const listPosts = async (params: {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  content_type?: 'post' | 'guide' | 'all'; // Фильтр по типу контента
  status?: string; // Фильтр по статусу (для админа)
}): Promise<ListPostsResponse> => {
  console.log('📥 listPosts вызван с параметрами:', params);
  
  try {
    // Загружаем только посты (блоги удалены)
    console.log('🔗 Отправляем запрос к /api/posts...');
    const postsResponse = await apiClient.get('/posts', {
      params: {
        limit: params.limit || 50,
        offset: params.offset || 0,
        search: params.search,
        sort: params.sort,
        status: params.status // Передаём статус для админа
      }
    });

    console.log('✅ Ответ от API получен:', postsResponse.status, postsResponse.data);

    // Собираем посты
    const posts: PostDTO[] = (postsResponse.data?.data || postsResponse.data || []).map((post: any) => ({
      ...post,
      content_type: post.content_type || 'post' as const
    }));

    // Объединяем посты (только посты теперь)
    let allContent = [...posts];

    // Применяем фильтр по типу контента
    if (params.content_type && params.content_type !== 'all') {
      allContent = allContent.filter(item => item.content_type === params.content_type);
    }

    // Сортируем по дате создания (новые сначала)
    allContent.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // Применяем лимит
    const limitedContent = allContent.slice(0, params.limit || 50);

    console.log('✅ Посты успешно загружены:', limitedContent.length, 'постов');
    return {
      data: limitedContent,
      total: allContent.length
    };
  } catch (error) {
    console.error('❌ Ошибка при загрузке постов:', error);
    return {
      data: [],
      total: 0
    };
  }
};

export const createPost = async (data: CreatePostRequest): Promise<PostDTO> => {
  try {
    // Проверяем токен и его валидность
    const token = storageService.getItem('token');
    let isValidToken = false;
    
    if (token) {
      try {
        // Парсим токен и проверяем, не истёк ли он
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        
        // Проверяем срок действия токена
        if (payload.exp && payload.exp >= now) {
          isValidToken = true;
        } else {
          // Токен истёк, удаляем его
          console.warn('⚠️ Токен истёк при создании поста, удаляем из storageService');
          storageService.removeItem('token');
          storageService.removeItem('user');
        }
      } catch (error) {
        // Токен невалидный, удаляем его
        console.warn('⚠️ Токен невалидный при создании поста, удаляем из storageService:', error);
        storageService.removeItem('token');
        storageService.removeItem('user');
      }
    }
    
    // Если токена нет или он невалидный, создаём как гость
    if (!token || !isValidToken) {
      const { saveDraft } = await import('./guestDrafts');
      const draft = saveDraft('post', data);
      
      // Отслеживаем действие гостя
      recordGuestAction({
        actionType: 'post',
        contentId: draft.id,
        contentData: data,
        approved: false,
        metadata: {
          hasPhoto: !!(data.photo_urls && (Array.isArray(data.photo_urls) ? data.photo_urls.length > 0 : data.photo_urls)),
          hasMarker: !!data.marker_id,
        },
      });
      
      return {
        id: `draft:${draft.id}`,
        title: data.title || 'Без заголовка',
        body: data.body || '',
        author_id: 'guest',
        author_name: 'Гость',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    likes_count: 0,
    comments_count: 0,
    is_liked: false,
    reactions: [],
    route_id: data.route_id,
    marker_id: data.marker_id,
    event_id: data.event_id,
        photo_urls: data.photo_urls,
        attached_snapshot: data.payload?.snapshot as any,
        is_draft: true,
  };
    }

    // Проверяем, является ли пользователь админом
    let isAdmin = false;
    try {
      const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        isAdmin = user?.role === 'admin';
      }
    } catch (e) {
      // Игнорируем ошибку парсинга
    }

    // Для не-админов сохраняем локально на модерацию
    if (!isAdmin) {
      const { savePendingContent } = await import('./localModerationStorage');
      const { analyzeContentWithAI } = await import('./aiModerationService');
      
      const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const authorName = (() => {
        try {
          const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user?.username || user?.email || 'Пользователь';
          }
        } catch {}
        return 'Пользователь';
      })();
      
      const authorId = (() => {
        try {
          const userStr = storageService.getItem('user') || sessionStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user?.id;
          }
        } catch {}
        return undefined;
      })();

      // Сохраняем локально
      savePendingContent({
        id: pendingId,
        type: 'post',
        data: {
          title: data.title,
          body: data.body,
          route_id: data.route_id,
          marker_id: data.marker_id,
          event_id: data.event_id,
          photo_urls: data.photo_urls,
          template: data.template,
          content_type: data.content_type,
          constructor_data: data.constructor_data,
          payload: data.payload,
        },
        created_at: new Date().toISOString(),
        author_id: authorId,
        author_name: authorName,
      });

      // Запускаем ИИ-анализ асинхронно
      analyzeContentWithAI('post', pendingId, {
        title: data.title,
        body: data.body,
        photo_urls: data.photo_urls,
      }).catch(err => 
        console.error('Ошибка ИИ-анализа поста:', err)
      );

      // Возвращаем пост с флагом "на модерации"
      const pendingPost: PostDTO = {
        id: pendingId,
        title: data.title || 'Без заголовка',
        body: data.body || '',
        author_id: authorId || 'unknown',
        author_name: authorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        reactions: [],
        route_id: data.route_id,
        marker_id: data.marker_id,
        event_id: data.event_id,
        photo_urls: data.photo_urls,
        attached_snapshot: data.payload?.snapshot as any,
        status: 'pending' as const, // Статус "на модерации"
        content_type: data.content_type,
        constructor_data: data.constructor_data,
      };
      
      // Non-blocking notification: emit content-pending event so UI/notifications handle it
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('content-pending', { detail: { contentType: 'post', contentId: pendingId, title: data.title || 'Пост', showOnce: true } }));
        }
      } catch (e) { /* ignore */ }
      
      return pendingPost;
    }

    // Для админов сохраняем сразу в БД
    // Backend сам определит статус (active для админов)
    const response = await apiClient.post('/posts', {
      title: data.title,
      body: data.body,
      route_id: data.route_id,
      marker_id: data.marker_id,
      event_id: data.event_id,
      photo_urls: data.photo_urls,
      template: data.template,
      content_type: data.content_type,
      constructor_data: data.constructor_data,
      payload: data.payload
    });

    // Если ответ пустой (401) - сохраняем как черновик локально
    if (!response.data) {
      const { saveDraft } = await import('./guestDrafts');
      const draft = saveDraft('post', data);
      return {
        id: `draft:${draft.id}`,
        title: data.title || 'Без заголовка',
        body: data.body || '',
        author_id: 'guest',
        author_name: 'Гость',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        reactions: [],
        route_id: data.route_id,
        marker_id: data.marker_id,
        event_id: data.event_id,
        photo_urls: data.photo_urls,
        attached_snapshot: data.payload?.snapshot as any,
        is_draft: true,
      };
    }

    const post = response.data;
    
    // Интеграция геймификации (асинхронно, не блокируем ответ)
    if (post?.id) {
      // Используем setTimeout для асинхронного выполнения без блокировки
      setTimeout(() => {
        // Получаем userId из токена или из ответа API
        const token = storageService.getItem('token');
        let userId = post.author_id || undefined;
        
        // Если userId нет в ответе, пытаемся получить из токена (упрощённо)
        if (!userId && token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.userId || payload.id || undefined;
          } catch (e) {
            // Игнорируем ошибку парсинга токена
          }
        }
        
        if (userId) {
          import('../utils/gamificationHelper').then(({ addXPForPost }) => {
            addXPForPost(post.id, {
              hasPhoto: !!(data.photo_urls && (Array.isArray(data.photo_urls) ? data.photo_urls.length > 0 : data.photo_urls)),
              hasMarker: !!data.marker_id,
              userId,
            }).catch(() => {});
          }).catch(() => {});
        }
      }, 0);
    }

    return post;
  } catch (error) {
    throw error;
  }
};

export const listReplies = async (postId: string, params: {
  limit?: number;
  offset?: number;
}): Promise<ListRepliesResponse> => {
  try {
    const response = await apiClient.get(`/posts/${postId}/replies`, {
      params: {
        limit: params.limit || 50,
        offset: params.offset || 0
      }
    });
    return {
      data: response.data?.data || response.data || [],
      total: response.data?.total || 0
    };
  } catch (error) {
    console.error('❌ Ошибка загрузки ответов:', error);
    return { data: [], total: 0 };
  }
};

export const createReply = async (data: CreateReplyRequest): Promise<ReplyDTO> => {
  const response = await apiClient.post(`/posts/${data.post_id}/replies`, {
    body: data.body
  });
  return response.data;
};

// Добавить/удалить реакцию на пост
export const toggleReaction = async (postId: string, emoji: string): Promise<PostDTO> => {
  try {
    const response = await apiClient.post(`/posts/${postId}/reactions`, { emoji });
    return response.data;
  } catch (error) {
    // В случае ошибки просто логируем, оптимистичное обновление уже сделано
    throw error;
  }
};

// Получить реакции поста (для модерации)
export const getPostReactions = async (postId: string): Promise<PostReaction[]> => {
  try {
    const response = await apiClient.get(`/posts/${postId}/reactions`);
    return response.data?.reactions || [];
  } catch (error) {
    return [];
  }
};
