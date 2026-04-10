import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { Feedback } from '../../types/AdminTypes';

interface FeedbackPanelProps {
  filterType?: 'complaint' | 'suggestion';
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ filterType: initialFilterType }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>(initialFilterType || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('new');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadFeedbacks();
  }, [filterType, filterStatus, filterCategory, filterPriority, page]);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Требуется авторизация');
        return;
      }

      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterCategory !== 'all') params.category = filterCategory;

      const response = await apiClient.get('/feedback/admin/list', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setFeedbacks(response.data?.data || []);
      setTotal(response.data?.total || 0);
    } catch (err: any) {
      console.error('Ошибка загрузки feedback:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (feedbackId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      await apiClient.patch(
        `/feedback/admin/${feedbackId}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Статус обновлён!');
      loadFeedbacks();
      setSelectedFeedback(null);
    } catch (err: any) {
      console.error('Ошибка обновления статуса:', err);
      alert(err.response?.data?.message || 'Ошибка обновления статуса');
    }
  };

  const handleRespondToFeedback = async (feedbackId: string) => {
    try {
      if (!adminResponse.trim()) {
        alert('Пожалуйста, напишите ответ');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      await apiClient.patch(
        `/feedback/admin/${feedbackId}/status`,
        { 
          status: 'in_review',
          admin_response: adminResponse 
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Ответ отправлен!');
      setAdminResponse('');
      setRespondingId(null);
      loadFeedbacks();
      if (selectedFeedback) {
        setSelectedFeedback({ ...selectedFeedback, admin_response: adminResponse });
      }
    } catch (err: any) {
      console.error('Ошибка отправки ответа:', err);
      alert(err.response?.data?.message || 'Ошибка отправки ответа');
    }
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'complaint' 
      ? 'bg-red-100 text-red-800'
      : 'bg-blue-100 text-blue-800';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_review':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const types = [
    { value: 'all', label: 'Все типы' },
    { value: 'complaint', label: 'Жалобы' },
    { value: 'suggestion', label: 'Предложения' },
  ];

  const statuses = [
    { value: 'all', label: 'Все статусы' },
    { value: 'new', label: 'Новые' },
    { value: 'in_review', label: 'На рассмотрении' },
    { value: 'resolved', label: 'Решённые' },
    { value: 'dismissed', label: 'Отклонённые' },
  ];

  const categories = [
    { value: 'all', label: 'Все категории' },
    { value: 'content', label: 'Контент' },
    { value: 'bug', label: 'Баг' },
    { value: 'feature', label: 'Фича' },
    { value: 'other', label: 'Другое' },
  ];

  const newFeedbackCount = feedbacks.filter((f) => f.status === 'new').length;
  const complaintCount = feedbacks.filter((f) => f.type === 'complaint').length;
  const suggestionCount = feedbacks.filter((f) => f.type === 'suggestion').length;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">💬 Жалобы и предложения</h1>
        <p className="text-gray-500 mt-1">Управление обратной связью от пользователей</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Новых</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">{newFeedbackCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Жалоб</div>
          <div className="text-2xl font-bold text-red-600 mt-2">{complaintCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Предложений</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">{suggestionCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{total}</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Тип</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Приоритет</label>
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="all">Все</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
            <button
              onClick={() => {
                setFilterType('all');
                setFilterStatus('new');
                setFilterCategory('all');
                setFilterPriority('all');
                setSearchQuery('');
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Очистить
            </button>
          </div>
        </div>
      </div>

      {/* Список + детали */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая часть — список */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Загрузка...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : feedbacks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Feedback не найден</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    onClick={() => setSelectedFeedback(feedback)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedFeedback?.id === feedback.id
                        ? 'bg-purple-50 border-l-4 border-purple-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 line-clamp-2">
                          {feedback.content_title || feedback.message}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          От: {feedback.user_name} ({feedback.user_email})
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 flex-shrink-0 ${getStatusBadgeColor(
                          feedback.status
                        )}`}
                      >
                        {feedback.status === 'new'
                          ? '🆕 Новое'
                          : feedback.status === 'in_review'
                          ? '👀 Рассмотрение'
                          : feedback.status === 'resolved'
                          ? '✅ Решено'
                          : '❌ Отклонено'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(feedback.type)}`}>
                        {feedback.type === 'complaint' ? '🚨 Жалоба' : '💡 Предложение'}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(feedback.priority)}`}>
                        {feedback.priority === 'high'
                          ? '🔴 Высокий'
                          : feedback.priority === 'medium'
                          ? '🟠 Средний'
                          : '🟢 Низкий'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(feedback.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Пагинация */}
          {total > limit && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 hover:bg-gray-300 transition-colors"
              >
                ← Предыдущая
              </button>
              <span className="text-sm text-gray-600">
                Страница {page} из {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage(Math.min(Math.ceil(total / limit), page + 1))}
                disabled={page >= Math.ceil(total / limit)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 hover:bg-gray-300 transition-colors"
              >
                Следующая →
              </button>
            </div>
          )}
        </div>

        {/* Правая часть — детали */}
        {selectedFeedback && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Детали</h2>

            <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                <div className="text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(
                      selectedFeedback.type
                    )}`}
                  >
                    {selectedFeedback.type === 'complaint' ? '🚨 Жалоба' : '💡 Предложение'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Статус</label>
                <div className="text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                      selectedFeedback.status
                    )}`}
                  >
                    {selectedFeedback.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Приоритет</label>
                <div className="text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeColor(
                      selectedFeedback.priority
                    )}`}
                  >
                    {selectedFeedback.priority}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">От</label>
                <div className="text-sm text-gray-700">
                  {selectedFeedback.user_name}
                  <br />
                  {selectedFeedback.user_email}
                </div>
              </div>

              {selectedFeedback.content_title && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Относится к
                  </label>
                  <div className="text-sm text-gray-700">
                    {selectedFeedback.content_type}: {selectedFeedback.content_title}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Сообщение</label>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                  {selectedFeedback.message}
                </div>
              </div>

              {selectedFeedback.admin_response && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ответ администратора
                  </label>
                  <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded max-h-32 overflow-y-auto">
                    {selectedFeedback.admin_response}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Создано</label>
                <div className="text-xs text-gray-600">
                  {new Date(selectedFeedback.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
            </div>

            {/* Кнопки действия */}
            {selectedFeedback.status === 'new' && (
              <div className="space-y-3 border-t border-gray-200 pt-4">
                {respondingId === selectedFeedback.id ? (
                  <>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Ваш ответ..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      rows={3}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleRespondToFeedback(selectedFeedback.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        💬 Ответить
                      </button>
                      <button
                        onClick={() => {
                          setRespondingId(null);
                          setAdminResponse('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setRespondingId(selectedFeedback.id)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      💬 Ответить
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'in_review')}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
                    >
                      👀 На рассмотрении
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'resolved')}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      ✅ Решено
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'dismissed')}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      ❌ Отклонить
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPanel;
