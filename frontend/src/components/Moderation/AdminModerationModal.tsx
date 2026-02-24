/**
 * Универсальный компонент модального окна модерации для админов
 * Отображается на всех страницах контента
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getAllPendingContent, 
  removePendingContent, 
  getPendingContentCounts,
  clearStuckPendingContent,
  PendingContent,
  ContentType 
} from '../../services/localModerationStorage';
import apiClient from '../../api/apiClient';
import ModerationBadge from './ModerationBadge';
import { listPosts } from '../../services/postsService';
import { getEvents } from '../../services/eventService';

interface AdminModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: ContentType;
  onContentApproved?: (contentId: string) => void;
  onContentRejected?: (contentId: string) => void;
  onTaskClick?: (content: PendingContent) => void; // Для центрирования карты и т.д.
}

const AdminModerationModal: React.FC<AdminModerationModalProps> = ({
  isOpen,
  onClose,
  contentType,
  onContentApproved,
  onContentRejected,
  onTaskClick,
}) => {
  const { user } = useAuth() || { user: null } as any;
  const isAdmin = user?.role === 'admin';
  const [pendingContent, setPendingContent] = useState<PendingContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<ContentType, number>>({
    marker: 0,
    post: 0,
    event: 0,
    complaint: 0,
    suggestion: 0,
    route: 0,
  });

  useEffect(() => {
    if (isOpen && isAdmin) {
      // Очищаем зависшие посты при открытии модального окна (старше 1 часа)
      try {
        clearStuckPendingContent(contentType, 3600000);
      } catch (error) {
        console.error('Ошибка очистки зависших постов:', error);
      }
      loadPendingContent();
      loadCounts();
    }
  }, [isOpen, isAdmin, contentType]);

  const loadPendingContent = async () => {
    setLoading(true);
    try {
      // Загружаем локальный контент
      const localContent = getAllPendingContent(contentType);
      
      // Загружаем контент из БД со статусом pending
      const dbContent: PendingContent[] = [];
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          if (contentType === 'post') {
            const response = await listPosts({ 
              limit: 100, 
              status: 'pending' 
            });
            const posts = response.data || [];
            // СТРОГАЯ фильтрация - ТОЛЬКО посты со статусом pending
            const pendingPosts = posts.filter((post: any) => {
              const status = post.status;
              const isPending = status === 'pending';
              if (!isPending && status) {
                console.warn(`🚫 Пост отфильтрован (статус: ${status}):`, {
                  id: post.id,
                  title: post.title?.substring(0, 30)
                });
              }
              return isPending;
            });
            console.log(`📊 Загружено ${pendingPosts.length} постов на модерацию из ${posts.length} всего`);
            dbContent.push(...pendingPosts.map((post: any) => ({
              id: post.id,
              type: 'post' as ContentType,
              data: {
                title: post.title,
                body: post.body,
                photo_urls: post.photo_urls,
                status: post.status || 'pending',
                ...post
              },
              created_at: post.created_at,
              author_id: post.author_id,
              author_name: post.author_name,
            })));
          } else if (contentType === 'marker') {
            const response = await apiClient.get('/markers', {
              params: { status: 'pending' },
              headers: { Authorization: `Bearer ${token}` }
            });
            const markers = response.data?.data || response.data || [];
            dbContent.push(...markers.map((marker: any) => ({
              id: marker.id,
              type: 'marker' as ContentType,
              data: {
                title: marker.title,
                description: marker.description,
                latitude: marker.latitude,
                longitude: marker.longitude,
                status: marker.status,
                ...marker
              },
              created_at: marker.created_at,
              author_id: marker.creator_id,
              author_name: marker.author_name,
            })));
          } else if (contentType === 'event') {
            const events = await getEvents();
            const pendingEvents = events.filter((e: any) => e.status === 'pending');
            dbContent.push(...pendingEvents.map((event: any) => ({
              id: event.id,
              type: 'event' as ContentType,
              data: {
                title: event.title,
                description: event.description,
                date: event.date,
                status: event.status,
                ...event
              },
              created_at: event.created_at,
              author_id: event.creator_id,
              author_name: event.author_name,
            })));
          }
        } catch (err) {
          console.error('Ошибка загрузки контента из БД:', err);
        }
      }
      
      // Объединяем локальный и БД контент
      const allContent = [...localContent, ...dbContent];
      
      // Убираем дубликаты по ID и фильтруем ТОЛЬКО pending контент
      const uniqueContent = allContent.reduce((acc, item) => {
        // Пропускаем дубликаты
        if (acc.find(i => i.id === item.id)) {
          return acc;
        }
        // Показываем только контент со статусом pending или без статуса (локальный)
        const itemStatus = item.data?.status || item.status;
        // СТРОГАЯ проверка - только pending или отсутствие статуса
        if (itemStatus === 'pending' || !itemStatus) {
          acc.push(item);
        } else {
          // Логируем отфильтрованные посты для отладки
          console.warn(`🚫 Контент отфильтрован (статус: ${itemStatus}):`, {
            id: item.id,
            title: item.data?.title || getContentTitle(item) || 'без названия',
            status: itemStatus
          });
        }
        return acc;
      }, [] as PendingContent[]);
      
      console.log(`✅ Загружено ${uniqueContent.length} постов на модерацию из ${allContent.length} всего`);
      setPendingContent(uniqueContent);
    } catch (err) {
      console.error('Ошибка загрузки контента:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = () => {
    const countsData = getPendingContentCounts();
    setCounts(countsData);
  };

  const handleApprove = async (content: PendingContent) => {
    if (!isAdmin) return;
    
    setProcessingId(content.id);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      let response;
      
      // Определяем, есть ли контент в БД
      // Пост в БД имеет числовой ID или UUID, не начинается с 'pending_', 'post:', 'marker:' и т.д.
      const isLocalId = content.id && (
        content.id.startsWith('pending_') || 
        content.id.startsWith('post:') || 
        content.id.startsWith('marker:') || 
        content.id.startsWith('event:') || 
        content.id.startsWith('route:')
      );
      
      const isInDatabase = content.id && !isLocalId && (
        !isNaN(Number(content.id)) || 
        (typeof content.id === 'string' && content.id.length > 10 && !content.id.includes(':'))
      );
      
      console.log('🔍 Проверка контента:', {
        id: content.id,
        isInDatabase,
        author_id: content.author_id,
        contentType
      });
      
      if (isInDatabase) {
        // Контент уже в БД - обновляем статус через API
        const apiContentTypeMap: Record<ContentType, string> = {
          'post': 'posts',
          'marker': 'markers',
          'event': 'events',
          'route': 'routes',
          'complaint': 'complaints',
          'suggestion': 'suggestions'
        };
        const apiContentType = apiContentTypeMap[contentType] || contentType;
        
        console.log(`📤 Одобряем контент в БД через /moderation/${apiContentType}/${content.id}/approve`);
        
        try {
          response = await apiClient.post(`/moderation/${apiContentType}/${content.id}/approve`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('✅ Контент одобрен в БД:', response.data);
          
          // Проверяем, что контент действительно обновлен
          if (!response.data?.content && !response.data?.message) {
            console.error('❌ ОШИБКА: Контент не обновлен в БД!', response.data);
            throw new Error('Контент не обновлен в БД');
          }
        } catch (error: any) {
          console.error('❌ Ошибка одобрения контента в БД:', error);
          console.error('Детали ошибки:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
          
          // Если контент не найден в БД, пытаемся создать через approve-local
          if (error.response?.status === 404) {
            console.log('⚠️ Контент не найден в БД, создаем через approve-local...');
            response = await apiClient.post(`/moderation/approve-local`, {
              content_type: contentType,
              local_id: content.id,
              content_data: content.data,
              author_id: content.author_id,
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Контент создан через approve-local:', response.data);
          } else {
            throw error;
          }
        }
      } else {
        // Локальный контент - создаем в БД через approve-local
        console.log('📤 Создаем локальный контент в БД через approve-local');
        
        response = await apiClient.post(`/moderation/approve-local`, {
          content_type: contentType,
          local_id: content.id,
          content_data: content.data,
          author_id: content.author_id,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Локальный контент создан в БД:', response.data);
        
        // Проверяем, что контент действительно создан
        if (!response.data?.content?.id && !response.data?.id) {
          console.error('❌ ОШИБКА: Контент не создан в БД!', response.data);
          throw new Error('Контент не создан в БД');
        }
      }
      
      // Проверяем, что контент действительно создан/обновлен в БД
      const approvedPostId = response.data?.content?.id || response.data?.id;
      const approvedPost = response.data?.content || response.data;
      
      if (!approvedPostId) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Контент не создан/обновлен в БД!', {
          response: response.data,
          status: response.status,
          contentType,
          contentId: content.id
        });
        alert('Ошибка: Контент не был сохранен в базу данных. Проверьте консоль для деталей.');
        setProcessingId(null);
        return;
      }
      
      console.log('✅ Контент успешно сохранен в БД:', {
        id: approvedPostId,
        status: approvedPost?.status || 'active',
        author_id: approvedPost?.author_id || content.author_id
      });
      
      // ВАЖНО: НЕ удаляем пост из localStorage пользователя!
      // Пост должен остаться в аккаунте пользователя, даже после одобрения
      // Удаляем только из локального хранилища модерации (pending content)
      removePendingContent(contentType, content.id);

      // Обновляем список модерации - удаляем одобренный контент из списка
      setPendingContent(prev => prev.filter(c => c.id !== content.id));
      
      // Отправляем событие для обновления постов на всех страницах
      const eventDetail = {
        contentType,
        contentId: approvedPostId,
        authorId: content.author_id,
        approvedPost: approvedPost // Передаем данные одобренного поста
      };
      
      console.log('📢 Отправляем событие content-approved с данными поста:', eventDetail);
      
      // Отправляем событие несколько раз для надежности
      window.dispatchEvent(new CustomEvent('content-approved', {
        detail: eventDetail
      }));
      
      // Также отправляем через setTimeout для надежности
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('content-approved', {
          detail: eventDetail
        }));
      }, 100);
      
      // Также отправляем глобальное событие для всех вкладок
      if (typeof window !== 'undefined' && window.localStorage) {
        const storageData = {
          ...eventDetail,
          timestamp: Date.now()
        };
        localStorage.setItem('last-approved-content', JSON.stringify(storageData));
        
        // Триггерим событие storage вручную
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'last-approved-content',
          newValue: JSON.stringify(storageData)
        }));
      }
      
      alert('Контент одобрен и опубликован!');
      
      loadPendingContent(); // Перезагружаем список модерации
      loadCounts();
      
      // Вызываем колбэк с данными одобренного поста
      onContentApproved && onContentApproved(approvedPostId);
    } catch (err: any) {
      console.error('Ошибка одобрения контента:', err);
      console.error('Детали ошибки:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        contentType,
        contentId: content.id
      });
      
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error ||
                          err.message || 
                          'Ошибка одобрения контента';
      
      alert(`Ошибка одобрения контента: ${errorMessage}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (content: PendingContent) => {
    if (!isAdmin) return;
    
    const reason = prompt('Причина отклонения:');
    if (reason === null || reason.trim().length === 0) {
      if (reason !== null) alert('Необходимо указать причину отклонения.');
      return;
    }

    setProcessingId(content.id);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      // Если контент уже в БД, отклоняем через API
      if (content.id && !content.id.startsWith('pending_')) {
        // Преобразуем contentType в множественное число для API
        const apiContentTypeMap: Record<ContentType, string> = {
          'post': 'posts',
          'marker': 'markers',
          'event': 'events',
          'route': 'routes',
          'complaint': 'complaints',
          'suggestion': 'suggestions'
        };
        const apiContentType = apiContentTypeMap[contentType] || contentType;
        
        await apiClient.post(`/moderation/${apiContentType}/${content.id}/reject`, {
          reason
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Удаляем из локального хранилища
      removePendingContent(contentType, content.id);

      // Обновляем список - удаляем отклонённый контент из списка
      setPendingContent(prev => prev.filter(c => c.id !== content.id));
      
      alert('Контент отклонён');
      loadPendingContent(); // Перезагружаем список
      loadCounts();
      onContentRejected && onContentRejected(content.id);
    } catch (err: any) {
      console.error('Ошибка отклонения контента:', err);
      alert('Ошибка отклонения контента');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevision = async (content: PendingContent) => {
    if (!isAdmin) return;
    
    const reason = prompt('Причина отправки на доработку:');
    if (reason === null || reason.trim().length === 0) return;

    setProcessingId(content.id);
    try {
      const token = localStorage.getItem('token');

      // Если контент в БД — вызываем API
      const isLocalId = content.id && (
        content.id.startsWith('pending_') ||
        content.id.startsWith('post:') ||
        content.id.startsWith('marker:') ||
        content.id.startsWith('event:') ||
        content.id.startsWith('route:')
      );

      if (!isLocalId && token) {
        const apiContentTypeMap: Record<ContentType, string> = {
          'post': 'posts', 'marker': 'markers', 'event': 'events',
          'route': 'routes', 'complaint': 'complaints', 'suggestion': 'suggestions',
        };
        const apiContentType = apiContentTypeMap[contentType] || contentType;

        await apiClient.post(`/moderation/${apiContentType}/${content.id}/revision`, {
          reason,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // Обновляем статус в локальном хранилище
      const updated: PendingContent = {
        ...content,
        data: {
          ...content.data,
          status: 'revision',
          moderation_reason: reason,
        },
      };
      const { savePendingContent } = await import('../../services/localModerationStorage');
      savePendingContent(updated);

      // Оптимистичное удаление из pending-списка
      setPendingContent(prev => prev.filter(c => c.id !== content.id));
      
      alert('Контент отправлен на доработку');
      loadPendingContent();
    } catch (err: any) {
      console.error('Ошибка отправки на доработку:', err);
      alert(err.response?.data?.message || 'Ошибка отправки на доработку');
    } finally {
      setProcessingId(null);
    }
  };

  const getContentTitle = (content: PendingContent): string => {
    const data = content.data;
    return data.title || data.name || data.description || 'Без названия';
  };

  const getContentDescription = (content: PendingContent): string => {
    const data = content.data;
    return data.description || data.body || data.content || '';
  };

  if (!isAdmin || !isOpen) return null;

  const contentTypeLabels: Record<ContentType, string> = {
    marker: 'Метки',
    post: 'Посты',
    event: 'События',
    complaint: 'Жалобы',
    suggestion: 'Предложения',
    route: 'Маршруты',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Модерация: {contentTypeLabels[contentType]}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              На модерации: {pendingContent.length} {pendingContent.length === 1 ? 'элемент' : 'элементов'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        {/* Список контента */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Загрузка...</div>
          ) : pendingContent.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              Нет контента на модерации
            </div>
          ) : (
            <div className="space-y-4">
              {pendingContent.map((content) => {
                // Проверяем статус контента - СТРОГАЯ проверка
                const contentStatus = content.data?.status || content.status;
                const isPending = contentStatus === 'pending' || !contentStatus;
                
                // Если контент не pending - не показываем его (должен быть отфильтрован ранее)
                if (!isPending) {
                  console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Контент со статусом ${contentStatus} попал в список модерации!`, {
                    id: content.id,
                    title: getContentTitle(content)
                  });
                  return null; // Не рендерим контент, который не должен быть здесь
                }
                
                // Контент точно pending, показываем его с кнопками
                return (
                  <div
                    key={content.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 
                        className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                        onClick={() => onTaskClick && onTaskClick(content)}
                      >
                        {getContentTitle(content)}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Автор: {content.author_name || 'Неизвестно'} • {new Date(content.created_at).toLocaleString()}
                      </p>
                    </div>
                    <ModerationBadge status="pending" />
                  </div>

                  {/* Описание контента */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {getContentDescription(content)}
                    </p>
                  </div>

                  {/* Фотографии поста (если есть) */}
                  {contentType === 'post' && content.data?.photo_urls && (() => {
                    const photoUrls: string[] = typeof content.data.photo_urls === 'string' 
                      ? content.data.photo_urls.split(',').map((u: string) => u.trim()).filter((u: string): u is string => !!u)
                      : Array.isArray(content.data.photo_urls) 
                        ? (content.data.photo_urls as (string | undefined | null)[]).filter((url): url is string => !!url)
                        : [];
                    
                    if (photoUrls.length === 0) return null;
                    
                    // Преобразуем относительные пути в полные URL
                    const fullUrls = photoUrls.map(url => {
                      // Если URL уже полный (начинается с http:// или https://), возвращаем как есть
                      if (url.startsWith('http://') || url.startsWith('https://')) {
                        return url;
                      }
                      // Если относительный путь (начинается с /), добавляем базовый URL
                      if (url.startsWith('/')) {
                        // Используем текущий origin или API URL
                        const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
                        return `${baseUrl}${url}`;
                      }
                      // Если путь без слэша, добавляем /uploads/
                      return `${window.location.origin}/uploads/${url}`;
                    });
                    
                    return (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Фотографии ({fullUrls.length}):</p>
                        <div className="grid grid-cols-2 gap-2">
                          {fullUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Фото ${idx + 1}`}
                              className="w-full h-32 object-cover rounded border border-gray-200"
                              onError={(e) => {
                                console.error(`Ошибка загрузки изображения ${idx + 1}:`, url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ИИ-рекомендация */}
                  {content.ai_analysis && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-semibold text-blue-900">🤖 ИИ-рекомендация:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                          content.ai_analysis.suggestion === 'approve' ? 'bg-green-100 text-green-800' :
                          content.ai_analysis.suggestion === 'reject' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {content.ai_analysis.suggestion === 'approve' ? 'Одобрить' :
                           content.ai_analysis.suggestion === 'reject' ? 'Отклонить' :
                           'Проверить'}
                        </span>
                        <span className="ml-2 text-xs text-gray-600">
                          (Уверенность: {Math.round(content.ai_analysis.confidence * 100)}%)
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">{content.ai_analysis.reason}</p>
                      {content.ai_analysis.issues && content.ai_analysis.issues.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-700">Проблемы:</p>
                          <ul className="text-xs text-gray-600 list-disc list-inside">
                            {content.ai_analysis.issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                    {/* Кнопки действий - все посты в списке уже pending */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApprove(content)}
                        disabled={processingId === content.id}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleRevision(content)}
                        disabled={processingId === content.id}
                        className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        На доработку
                      </button>
                      <button
                        onClick={() => handleReject(content)}
                        disabled={processingId === content.id}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminModerationModal;

