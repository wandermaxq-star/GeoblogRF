import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/apiClient';
import { getAllPendingContent, PendingContent, removePendingContent } from '../../services/localModerationStorage';

type ContentType = 'events' | 'posts' | 'routes' | 'markers' | 'comments' | 'marker_comments';
type StatusFilter = 'all' | 'pending' | 'active' | 'rejected' | 'hidden' | 'revision';

interface StatusCounts {
  all: number;
  pending: number;
  active: number;
  rejected: number;
  hidden: number;
  revision: number;
}

interface HistoryItem {
  id: string;
  title?: string;
  description?: string;
  body?: string;
  content?: string;
  author_id?: string;
  author_name?: string;
  author_email?: string;
  created_at: string;
  updated_at: string;
  status: string;
  photo_urls?: string;
  ai_decision_id?: string;
  ai_suggestion?: 'approve' | 'reject' | 'hide' | 'review';
  ai_confidence?: number;
  ai_reason?: string;
  ai_category?: string;
  ai_issues?: string[];
  admin_verdict?: 'correct' | 'incorrect' | 'pending' | null;
  admin_feedback?: string;
  reviewed_at?: string;
  ai_analyzed_at?: string;
  [key: string]: any;
}

interface ModerationHistoryPanelProps {
  defaultContentType?: ContentType;
}

const ModerationHistoryPanel: React.FC<ModerationHistoryPanelProps> = ({ 
  defaultContentType = 'posts' 
}) => {
  const [contentType, setContentType] = useState<ContentType>(defaultContentType);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [photoVerified, setPhotoVerified] = useState(false); // ⚠️ Проверил все фотографии
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0, pending: 0, active: 0, rejected: 0, hidden: 0, revision: 0,
  });
  const limit = 20;

  // Загрузка счётчиков по статусам для текущего типа контента
  const loadStatusCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // ===== 1. Загружаем счётчики из БД =====
      const statuses: (keyof Omit<StatusCounts, 'all'>)[] = ['pending', 'active', 'rejected', 'hidden', 'revision'];
      const promises = statuses.map(s =>
        apiClient.get(`/moderation/history/${contentType}`, {
          params: { status: s, limit: 1, offset: 0 },
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => ({ status: s, count: r.data?.total ?? 0 }))
          .catch(() => ({ status: s, count: 0 }))
      );
      const results = await Promise.all(promises);
      
      // ===== 2. Добавляем счётчики локального контента =====
      const localTypeKey = contentType.endsWith('s') ? contentType.slice(0, -1) : contentType;
      const localPending = getAllPendingContent();
      const localContentForType = localPending.filter((p: PendingContent) => p.type === localTypeKey);
      
      // Локальный контент всегда в статусе 'pending'
      const localPendingCount = localContentForType.length;
      
      const counts: StatusCounts = { all: 0, pending: 0, active: 0, rejected: 0, hidden: 0, revision: 0 };
      for (const r of results) {
        counts[r.status] = r.count;
        counts.all += r.count;
      }
      
      // Добавляем локальный контент к pending счётчику
      counts.pending += localPendingCount;
      counts.all += localPendingCount;
      
      setStatusCounts(counts);
      console.log(`📊 Счётчики обновлены для ${contentType}: ${counts.all} всего (локального pending: ${localPendingCount})`);
    } catch {
      // не критично
    }
  }, [contentType]);

  useEffect(() => {
    loadStatusCounts();
  }, [loadStatusCounts]);

  useEffect(() => {
    loadHistory();
  }, [contentType, statusFilter, searchQuery, page]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Требуется авторизация');
        return;
      }

      // ===== 1. Загружаем локальный контент из localStorage =====
      let localContent: HistoryItem[] = [];
      try {
        const localPending = getAllPendingContent();
        
        // Фильтруем по типу контента
        // Маппируем тип: 'post' -> 'posts', 'marker' -> 'markers', 'event' -> 'events'
        const localTypeKey = contentType.endsWith('s') ? contentType.slice(0, -1) : contentType;
        const filteredLocal = localPending.filter((p: PendingContent) => p.type === localTypeKey);
        
        // Конвертируем в HistoryItem
        localContent = filteredLocal.map((p: PendingContent) => ({
          id: p.id,
          title: p.data?.title || 'Без заголовка',
          body: p.data?.body || p.data?.description || '',
          description: p.data?.description,
          content: p.data?.content,
          author_id: p.author_id,
          author_name: p.author_name || 'Пользователь',
          created_at: p.created_at,
          updated_at: p.created_at,
          status: 'pending',
          photo_urls: p.data?.photo_urls,
          ai_reason: p.ai_analysis?.reason,
          ai_suggestion: p.ai_analysis?.suggestion,
          ai_confidence: p.ai_analysis?.confidence,
          ai_category: p.ai_analysis?.category,
          ai_issues: p.ai_analysis?.issues,
          _isLocal: true, // маркер локального контента
        }));
        
        console.log(`📦 Загружено ${localContent.length} локальных ${contentType} на модерации`);
      } catch (err) {
        console.warn('Ошибка загрузки локального контента:', err);
      }

      // ===== 2. Загружаем контент из БД =====
      let dbContent: HistoryItem[] = [];
      try {
        const params: any = {
          limit: 100, // загружаем больше для объединения
          offset: 0,
          sort: 'created_at DESC'
        };

        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }

        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        const response = await apiClient.get(`/moderation/history/${contentType}`, {
          params,
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        dbContent = response.data?.data || [];
        console.log(`🗄️  Загружено ${dbContent.length} ${contentType} из БД`);
      } catch (err) {
        console.warn('Ошибка загрузки контента из БД:', err);
      }

      // ===== 3. Объединяем локальный и БД контент =====
      const combinedContent = [...localContent, ...dbContent];
      
      // Убираем дубликаты по ID
      const uniqueContent = Array.from(
        new Map(combinedContent.map(item => [item.id, item])).values()
      );

      // ===== 4. Фильтруем по статусу =====
      let filteredContent = uniqueContent;
      if (statusFilter !== 'all') {
        filteredContent = uniqueContent.filter(item => item.status === statusFilter);
      }

      // ===== 5. Фильтруем по поиску =====
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredContent = filteredContent.filter(item =>
          (item.title?.toLowerCase() || '').includes(q) ||
          (item.body?.toLowerCase() || '').includes(q) ||
          (item.author_name?.toLowerCase() || '').includes(q)
        );
      }

      // ===== 6. Сортируем по дате (новые сначала) =====
      filteredContent.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // ===== 7. Применяем пагинацию =====
      const paginatedContent = filteredContent.slice(
        (page - 1) * limit,
        page * limit
      );

      setHistory(paginatedContent);
      setTotal(filteredContent.length);
      
      console.log(`✅ Итого на модерации: ${filteredContent.length} ${contentType} (страница ${page})`);
    } catch (err: any) {
      console.error('Ошибка загрузки истории:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка загрузки истории');
      setHistory([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (itemId: string, action: 'approve' | 'reject' | 'revision') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      const item = history.find(h => h.id === itemId);
      if (!item) return;

      // ⚠️ КРИТИЧЕСКАЯ ПРОВЕРКА: если есть фото, необходимо явное подтверждение
      const hasPhotos = parsePhotoUrls(item.photo_urls || details?.content?.photo_urls).length > 0;
      if (action === 'approve' && hasPhotos) {
        if (!photoVerified) {
          alert('⚠️ ТРЕБУЕТСЯ ЯВНОЕ ПОДТВЕРЖДЕНИЕ:\n\n' +
            '❌ Вы не подтвердили, что проверили ВСЕ фотографии.\n\n' +
            '✅ Поставьте чекбокс "Я проверил все фотографии на безопасность" перед одобрением.\n\n' +
            'ЭТО КРИТИЧНО ДЛЯ БЕЗОПАСНОСТИ ПЛАТФОРМЫ');
          return;
        }
      }

      const isLocal = item._isLocal || String(itemId).startsWith('pending_');
      let endpoint = '';
      let body: Record<string, any> = {};

      if (isLocal) {
        // ===== ЛОКАЛЬНЫЙ КОНТЕНТ — СНАЧАЛА УДАЛЯЕМ ИЗ ХРАНИЛИЩА =====
        const localTypeKey = contentType.endsWith('s') ? contentType.slice(0, -1) : contentType;
        removePendingContent(localTypeKey as any, itemId);
        console.log(`🗑️  Удалён из localStorage: ${itemId}`);
        
        // Теперь определяем действие
        if (action === 'approve') {
          // Локальный контент: отправляем на backend для публикации
          endpoint = `/moderation/approve-local`;
          
          // Парсим тип контента для backend
          const typeMap: Record<string, string> = {
            'posts': 'post',
            'post': 'post',
            'markers': 'marker',
            'marker': 'marker',
            'events': 'event',
            'event': 'event',
          };
          
          const backendType = typeMap[contentType] || contentType;
          
          body = { 
            content_type: backendType,
            content_data: {
              title: item.title,
              body: item.body,
              description: item.body,
              content: item.body,
              photo_urls: parsePhotoUrls(item.photo_urls),
              status: 'pending',
            },
            author_id: item.author_id,
          };
        } else if (action === 'reject') {
          const reason = prompt('Укажите причину отклонения:');
          if (!reason || reason.trim().length === 0) {
            alert('Необходимо указать причину отклонения');
            return;
          }
          console.log(`🗑️  Отклонён локальный контент ${itemId}: ${reason}`);
          alert('Локальный контент отклонён');
        } else if (action === 'revision') {
          const reason = prompt('Укажите причину доработки:');
          if (!reason || reason.trim().length === 0) {
            alert('Необходимо указать причину доработки');
            return;
          }
          console.log(`✏️  На доработку локальный контент ${itemId}: ${reason}`);
          alert('Отправлено автору на доработку (локально)');
        }

        // Для approve локального контента
        if (action === 'approve') {
          try {
            const res = await apiClient.post(endpoint, body, {
              headers: { Authorization: `Bearer ${token}` }
            });
            alert('✅ Контент одобрен и опубликован!');
            // Уже удалили из localStorage выше в начале блока if (isLocal)
          } catch (err: any) {
            console.error('Ошибка при одобрении локального контента:', err);
            alert(err.response?.data?.message || 'Контент одобрен локально (offline mode)');
          }
        }
      } else {
        // ===== КОНТЕНТ ИЗ БД =====
        if (action === 'approve') {
          endpoint = `/moderation/${contentType}/${itemId}/approve`;
        } else if (action === 'reject') {
          const reason = prompt('Укажите причину отклонения:');
          if (!reason || reason.trim().length === 0) {
            alert('Необходимо указать причину отклонения');
            return;
          }
          endpoint = `/moderation/${contentType}/${itemId}/reject`;
          body = { reason: reason.trim() };
        } else if (action === 'revision') {
          const reason = prompt('Укажите причину доработки:');
          endpoint = `/moderation/${contentType}/${itemId}/revision`;
          if (reason && reason.trim().length > 0) {
            body = { reason: reason.trim() };
          }
        }

        await apiClient.post(endpoint, body, {
          headers: { Authorization: `Bearer ${token}` }
        });

        alert(action === 'approve' ? 'Контент одобрен и опубликован!' : action === 'reject' ? 'Контент отклонён' : 'Контент отправлен на доработку');
      }
      
      // ===== ОБНОВЛЯЕМ СПИСОК ПОСЛЕ ДЕЙСТВИЯ =====
      
      // 0. ЗАКРЫВАЕМ И ОЧИЩАЕМ панель деталей
      setSelectedItem(null);
      setPhotoVerified(false);
      
      // 1. Удаляем контент из текущего списка НЕМЕДЛЕННО
      setHistory(prev => prev.filter(h => h.id !== itemId));
      setTotal(prev => Math.max(0, prev - 1));
      
      // 2. Обновляем счётчики (но НЕ перезагружаем весь список)
      // Перезагрузка полного списка может вернуть контент назад если статус на сервере не обновился
      loadStatusCounts();
      
    } catch (err: any) {
      console.error('Ошибка модерации:', err);
      alert(err.response?.data?.message || 'Ошибка модерации');
    }
  };

  const loadDetails = async (item: HistoryItem) => {
    try {
      setSelectedItem(item);
      setPhotoVerified(false); // ⚠️ ВСЕГДА сбрасываем при загрузке нового контента
      const token = localStorage.getItem('token');
      if (!token) return;

      // ===== ДЛЯ ЛОКАЛЬНОГО КОНТЕНТА =====
      if (item._isLocal || String(item.id)?.startsWith('pending_')) {
        // Локальный контент — данные уже есть в item
        console.log(`📦 Откупываю локальный контент: ${item.id}`);
        const authorName = item.author_name && item.author_name !== 'Гость' ? item.author_name : 'Пользователь (локальный)';
        setDetails({
          content: {
            id: item.id,
            title: item.title,
            body: item.body,
            description: item.body,
            content: item.body,
            status: item.status || 'pending',
            author_name: authorName,
            author_id: item.author_id,
            created_at: item.created_at,
            updated_at: item.updated_at || item.created_at,
            photo_urls: item.photo_urls,
          },
          aiDecision: item.ai_analysis ? {
            ai_reason: item.ai_reason,
            ai_suggestion: item.ai_suggestion,
            ai_confidence: item.ai_confidence,
            ai_category: item.ai_category,
            ai_issues: item.ai_issues,
          } : null,
          _isLocal: true,
        });
        return;
      }

      // ===== ДЛЯ КОНТЕНТА ИЗ БД =====
      try {
        const response = await apiClient.get(`/moderation/${contentType}/${item.id}/details`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setDetails(response.data);
      } catch (err: any) {
        // Если 404 или ошибка — используем данные из item
        console.warn(`Детали контента не найдены на backend (${err.response?.status}), используем доступные данные:`, err);
        const authorName = item.author_name && item.author_name !== 'Гость' ? item.author_name : 'Пользователь';
        setDetails({
          content: {
            id: item.id,
            title: item.title,
            body: item.body,
            description: item.body,
            content: item.body,
            status: item.status || 'pending',
            author_name: authorName,
            author_id: item.author_id,
            created_at: item.created_at,
            updated_at: item.updated_at || item.created_at,
            photo_urls: item.photo_urls,
          },
          aiDecision: item.ai_analysis ? {
            ai_reason: item.ai_reason,
            ai_suggestion: item.ai_suggestion,
            ai_confidence: item.ai_confidence,
            ai_category: item.ai_category,
            ai_issues: item.ai_issues,
          } : null,
        });
      }
    } catch (err: any) {
      console.error('Ошибка загрузки деталей:', err);
      // Не показываем alert для локального контента — детали загружены из item
      if (!selectedItem?._isLocal && !selectedItem?.id?.startsWith('pending_')) {
        alert('Ошибка загрузки деталей контента');
      }
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return 'На модерации';
      case 'active': return 'Одобрено';
      case 'rejected': return 'Отклонено';
      case 'hidden': return 'Скрыто';
      case 'revision': return 'На доработке';
      default: return status;
    }
  };

  // ===== HELPER: Парсим photo_urls в массив =====
  const parsePhotoUrls = (urls: any): string[] => {
    if (!urls) return [];
    if (Array.isArray(urls)) return urls.filter(u => u);
    if (typeof urls === 'string') {
      return urls.split(',').map(u => u.trim()).filter(u => u);
    }
    return [];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'hidden': return 'bg-yellow-100 text-yellow-800';
      case 'revision': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuggestionLabel = (suggestion?: string): string => {
    switch (suggestion) {
      case 'approve': return 'Одобрить';
      case 'reject': return 'Отклонить';
      case 'hide': return 'Скрыть';
      case 'review': return 'На проверку';
      default: return 'Нет рекомендации';
    }
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) {
      return '—';
    }
    try {
      const date = new Date(dateString);
      // Проверяем, что дата валидна
      if (isNaN(date.getTime())) {
        return '—';
      }
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  const contentTypeLabels: Record<ContentType, string> = {
    events: 'События',
    posts: 'Посты',
    routes: 'Маршруты',
    markers: 'Метки',
    comments: 'Комментарии',
    marker_comments: 'Комментарии метак',
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Панель модерации</h2>
        <p className="text-gray-600">Управление контентом по статусам</p>
      </div>

      {/* Тип контента */}
      <div className="mb-4 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(contentTypeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setContentType(key as ContentType); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                contentType === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Вкладки по статусам */}
      <div className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {([
            { key: 'pending' as const, label: '📋 На модерации', color: 'orange' },
            { key: 'active' as const, label: '✅ Одобрено', color: 'green' },
            { key: 'rejected' as const, label: '❌ Отклонено', color: 'red' },
            { key: 'revision' as const, label: '🔄 На доработке', color: 'purple' },
            { key: 'hidden' as const, label: '👁 Скрыто', color: 'yellow' },
            { key: 'all' as const, label: '📁 Все', color: 'gray' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors relative ${
                statusFilter === tab.key
                  ? `text-${tab.color}-700 bg-${tab.color}-50 border-b-2 border-${tab.color}-500`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div>{tab.label}</div>
              <div className={`text-lg font-bold mt-1 ${
                statusFilter === tab.key ? `text-${tab.color}-600` : 'text-gray-400'
              }`}>
                {statusCounts[tab.key]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Поиск */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          placeholder="🔍 Поиск по тексту контента..."
          className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Список истории */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-800 font-semibold mb-2">Ошибка</div>
          <div className="text-red-600">{error}</div>
          <button
            onClick={loadHistory}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Попробовать снова
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-xl font-semibold text-gray-800 mb-2">История пуста</div>
          <div className="text-gray-600">
            Нет контента с выбранными фильтрами.
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Найдено: {total} {total === 1 ? 'запись' : total < 5 ? 'записи' : 'записей'}
          </div>

          <div className="space-y-4 mb-6 max-h-[600px] overflow-y-auto pr-2">
            {history.map((item) => {
              const title = item.title || item.description || item.body || item.content || 'Без названия';
              const text = item.description || item.body || item.content || '';
              
              return (
                <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        <div>Автор: {item.author_name || item.author_id || 'Гость'}</div>
                        {/* Источник комментария */}
                        {contentType === 'comments' && item.source_title && (
                          <div className="flex items-center gap-1">
                            <span>💬 К посту:</span>
                            <span className="font-medium text-blue-700">«{item.source_title}»</span>
                          </div>
                        )}
                        <div>Создано: {formatDate(item.created_at)}</div>
                        {item.ai_analyzed_at && (
                          <div>ИИ проанализировал: {formatDate(item.ai_analyzed_at)}</div>
                        )}
                        {item.reviewed_at && (
                          <div>Проверено: {formatDate(item.reviewed_at)}</div>
                        )}
                      </div>

                    {/* Модерация причина (если есть) */}
                    {item.moderation_reason && (
                      <div className="mb-3 p-3 bg-red-50 rounded-md border border-red-200">
                        <div className="text-sm font-semibold text-red-900 mb-1">Причина модерации:</div>
                        <div className="text-sm text-red-700">{item.moderation_reason}</div>
                      </div>
                    )}

                    {/* Рекомендации ИИ */}
                      {item.ai_suggestion && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                          <div className="text-sm font-semibold text-blue-900 mb-1">
                            Рекомендация ИИ:
                          </div>
                          <div className="text-sm text-blue-800 space-y-1">
                            <div>
                              <span className="font-medium">Предложение:</span> {getSuggestionLabel(item.ai_suggestion)}
                            </div>
                            {item.ai_confidence && (
                              <div>
                                <span className="font-medium">Уверенность:</span> {Math.round(item.ai_confidence * 100)}%
                              </div>
                            )}
                            {item.ai_category && (
                              <div>
                                <span className="font-medium">Категория:</span> {item.ai_category}
                              </div>
                            )}
                            {item.ai_reason && (
                              <div className="mt-2 text-xs text-blue-700">
                                {item.ai_reason}
                              </div>
                            )}
                            {item.admin_verdict && (
                              <div className="mt-2">
                                <span className="font-medium">Вердикт админа:</span>{' '}
                                {item.admin_verdict === 'correct' ? '✅ Правильно' : '❌ Неправильно'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {text && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-md">
                          <div className="text-sm text-gray-700 line-clamp-3">
                            {text}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <button
                      onClick={() => loadDetails(item)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Подробнее
                    </button>
                    
                    {/* Статус для уже промодерированных постов - по центру */}
                    {item.status !== 'pending' && (
                      <div className="flex-1 text-center">
                        <span className={`inline-block px-4 py-2 rounded-lg font-semibold ${getStatusColor(item.status)}`}>
                          {item.status === 'active' ? '✅ Опубликовано' :
                           item.status === 'rejected' ? '❌ Отклонено' :
                           item.status === 'revision' ? '⚠️ На доработке' :
                           getStatusLabel(item.status)}
                        </span>
                      </div>
                    )}
                    
                    {/* Кнопки управления ТОЛЬКО для элементов на модерации */}
                    {item.status === 'pending' && (
                      <div className="space-y-3">
                        {/* ⚠️ ЕСЛИ ЕСТЬ ФОТО — требуем явное подтверждение */}
                        {(() => {
                          const hasPhotos = parsePhotoUrls(item.photo_urls || details?.content?.photo_urls).length > 0;
                          return hasPhotos ? (
                            <div className="p-3 bg-red-100 border border-red-300 rounded-md">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={photoVerified}
                                  onChange={(e) => setPhotoVerified(e.target.checked)}
                                  className="mt-1 w-4 h-4 text-red-600"
                                />
                                <span className="text-sm font-medium text-red-800">
                                  ✓ Я проверил все фотографии на небезопасный контент (реклама, порно, насилие и т.д.) и подтверждаю их соответствие правилам платформы
                                </span>
                              </label>
                            </div>
                          ) : null;
                        })()}

                        <div className="flex space-x-2">
                          <button
                            onClick={async () => {
                              await handleModerate(item.id, 'approve');
                            }}
                            disabled={(item.photo_urls || details?.content?.photo_urls) && !photoVerified}
                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            ✓ Одобрить
                          </button>
                          <button
                            onClick={async () => {
                              await handleModerate(item.id, 'revision');
                            }}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                          >
                            На доработку
                          </button>
                          <button
                            onClick={async () => {
                              await handleModerate(item.id, 'reject');
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                          >
                            ✗ Отклонить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Назад
              </button>
              <span className="text-sm text-gray-600">
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Вперёд
              </button>
            </div>
          )}
        </>
      )}

      {/* Модальное окно с деталями */}
      {selectedItem && details && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {contentType === 'marker_comments' 
                    ? `Комментарий к маркеру: ${details.content?.marker_id || 'N/A'}`
                    : (details.content?.title || details.content?.description || 'Детали контента')
                  }
                </h3>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setDetails(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Полная информация о контенте */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Информация о контенте:</div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>ID: {details.content?.id}</div>
                    <div>Статус: <span className={getStatusColor(details.content?.status)}>{getStatusLabel(details.content?.status)}</span></div>
                    <div>Автор: {details.content?.author_name || details.content?.author_id || 'Гость'}</div>
                    <div>Создано: {formatDate(details.content?.created_at)}</div>
                    <div>Обновлено: {formatDate(details.content?.updated_at)}</div>
                    {contentType === 'marker_comments' && details.content?.marker_id && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="font-semibold">📍 Маркер:</div>
                        <div>ID маркера: {details.content?.marker_id}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ⚠️ ФОТОГРАФИИ — КРИТИЧЕСКАЯ ПРОВЕРКА БЕЗОПАСНОСТИ */}
                {(() => {
                  const photoArray = parsePhotoUrls(details.content?.photo_urls);
                  return photoArray.length > 0 ? (
                    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-md">
                      <div className="text-sm font-bold text-red-900 mb-3">
                        🚨 ВНИМАНИЕ: Фотографии для модерации ({photoArray.length})
                      </div>
                      <div className="text-xs text-red-800 mb-4 p-2 bg-red-100 rounded">
                        Проверьте все фотографии перед одобрением. ИИ анализировал эти изображения.
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {photoArray.map((url: string, idx: number) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={url} 
                              alt={`Фото ${idx + 1}`}
                              className="w-full h-40 object-cover rounded border-2 border-red-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" font-size="12" fill="%23999"%3EОшибка фото%3C/text%3E%3C/svg%3E';
                              }}
                            />
                            <div className="absolute top-1 right-1 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                              {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="text-sm text-yellow-800">
                        ℹ️ Контент без фотографий
                      </div>
                    </div>
                  );
                })()}

                {/* Полный текст контента */}
                {(details.content?.body || details.content?.description || details.content?.content) && (
                  <div className="p-4 bg-white border border-gray-200 rounded-md">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      {contentType === 'comments' ? '💬 Текст комментария:' : contentType === 'marker_comments' ? '💭 Текст комментария к маркеру:' : 'Текст контента:'}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {details.content?.body || details.content?.description || details.content?.content}
                    </div>
                  </div>
                )}

                {/* Пост, на который оставлен комментарий */}
                {contentType === 'comments' && details.content?.post_id && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-md">
                    <div className="text-sm font-semibold text-blue-900 mb-3">📄 Пост, на который оставлен комментарий:</div>
                    <div className="space-y-2">
                      <div className="p-3 bg-white rounded border border-blue-200">
                        <div className="text-sm font-bold text-blue-900 mb-2">
                          {details.content?.post_title || 'Пост без названия'}
                        </div>
                        {details.content?.post_body && (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-5">
                            {details.content.post_body}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Маркер, на который оставлен комментарий */}
                {contentType === 'marker_comments' && details.content?.marker_id && (
                  <div className="p-4 bg-green-50 border-2 border-green-300 rounded-md">
                    <div className="text-sm font-semibold text-green-900 mb-3">📍 Маркер, на который оставлен комментарий:</div>
                    <div className="space-y-2">
                      <div className="p-3 bg-white rounded border border-green-200">
                        <div className="text-sm font-bold text-green-900 mb-2">
                          ID маркера: {details.content?.marker_id}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Заголовок:</strong> {details.content?.marker_title || 'Без названия'}
                        </div>
                        {details.content?.marker_description && (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3 mt-2">
                            {details.content.marker_description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Рекомендации ИИ */}
                {details.aiDecision && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm font-semibold text-blue-900 mb-2">Рекомендации ИИ-помощника:</div>
                    <div className="text-sm text-blue-800 space-y-2">
                      <div>
                        <span className="font-medium">Предложение:</span> {getSuggestionLabel(details.aiDecision.ai_suggestion)}
                      </div>
                      {details.aiDecision.ai_confidence && (
                        <div>
                          <span className="font-medium">Уверенность:</span> {Math.round(details.aiDecision.ai_confidence * 100)}%
                        </div>
                      )}
                      {details.aiDecision.ai_category && (
                        <div>
                          <span className="font-medium">Категория:</span> {details.aiDecision.ai_category}
                        </div>
                      )}
                      {details.aiDecision.ai_reason && (
                        <div className="mt-2 p-2 bg-blue-100 rounded">
                          <div className="font-medium mb-1">Развёрнутая рекомендация:</div>
                          <div className="text-xs">{details.aiDecision.ai_reason}</div>
                        </div>
                      )}
                      {details.aiDecision.ai_issues && details.aiDecision.ai_issues.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium mb-1">Обнаруженные проблемы:</div>
                          <ul className="list-disc list-inside text-xs space-y-1">
                            {details.aiDecision.ai_issues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {details.aiDecision.admin_verdict && (
                        <div className="mt-2">
                          <span className="font-medium">Вердикт админа:</span>{' '}
                          {details.aiDecision.admin_verdict === 'correct' ? '✅ Правильно' : '❌ Неправильно'}
                        </div>
                      )}
                      {details.aiDecision.admin_feedback && (
                        <div className="mt-2">
                          <span className="font-medium">Комментарий админа:</span>{' '}
                          <div className="text-xs mt-1">{details.aiDecision.admin_feedback}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* История модерации */}
                {details.moderationHistory && details.moderationHistory.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm font-semibold text-yellow-900 mb-2">История модерации:</div>
                    <div className="text-sm text-yellow-800 space-y-2">
                      {details.moderationHistory.map((historyItem: any, idx: number) => (
                        <div key={idx} className="p-2 bg-yellow-100 rounded">
                          <div>Действие: {historyItem.action}</div>
                          {historyItem.reason && <div>Причина: {historyItem.reason}</div>}
                          {historyItem.moderated_at && <div>Дата: {formatDate(historyItem.moderated_at)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModerationHistoryPanel;

