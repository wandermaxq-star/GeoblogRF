import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { PartnerApplication } from '../../../types/AdminTypes';

const PartnersApplicationsPanel: React.FC = () => {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('new');
  const [selectedApp, setSelectedApp] = useState<PartnerApplication | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);
  const [reviewingAction, setReviewingAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    loadApplications();
  }, [filterStatus]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Требуется авторизация');
        return;
      }

      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;

      const response = await apiClient.get('/partners/admin/applications', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setApplications(response.data?.data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки заявок:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewApplication = async (
    appId: string,
    action: 'approve' | 'reject'
  ) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      const response = await apiClient.patch(
        `/partners/admin/review/${appId}`,
        {
          action,
          note: reviewNote,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert(`Заявка ${action === 'approve' ? 'одобрена' : 'отклонена'}`);
      setSelectedApp(null);
      setReviewNote('');
      setReviewingAppId(null);
      setReviewingAction(null);
      loadApplications();
    } catch (err: any) {
      console.error('Ошибка обработки заявки:', err);
      alert(err.response?.data?.message || 'Ошибка обработки заявки');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'new':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statuses = [
    { value: 'all', label: 'Все заявки' },
    { value: 'new', label: 'Новые' },
    { value: 'approved', label: 'Одобренные' },
    { value: 'rejected', label: 'Отклонённые' },
  ];

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📋 Заявки Pro Guide</h1>
        <p className="text-gray-500 mt-1">Рассмотрение заявок на становление профессиональным гидом</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего заявок</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {applications.length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Новые</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            {applications.filter((a) => a.status === 'new').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Одобрено</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {applications.filter((a) => a.status === 'approved').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Отклонено</div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {applications.filter((a) => a.status === 'rejected').length}
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Фильтр по статусу
        </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Список заявок */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая часть — список */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Загрузка...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Заявки не найдены</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedApp?.id === app.id
                        ? 'bg-purple-50 border-l-4 border-purple-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{app.name}</div>
                        <div className="text-sm text-gray-500">{app.email}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(app.created_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                          app.status
                        )}`}
                      >
                        {app.status === 'approved'
                          ? '✅ Одобрено'
                          : app.status === 'rejected'
                          ? '❌ Отклонено'
                          : '⏳ Новая'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Правая часть — детали */}
        {selectedApp && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Детали заявки</h2>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Имя
                </label>
                <div className="text-sm text-gray-900">{selectedApp.name}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email
                </label>
                <div className="text-sm text-gray-900">{selectedApp.email}</div>
              </div>

              {selectedApp.city && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Город
                  </label>
                  <div className="text-sm text-gray-900">{selectedApp.city}</div>
                </div>
              )}

              {selectedApp.phone && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Телефон
                  </label>
                  <div className="text-sm text-gray-900">{selectedApp.phone}</div>
                </div>
              )}

              {selectedApp.audience_url && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Аудитория (URL)
                  </label>
                  <div className="text-sm text-blue-600 break-all">
                    <a
                      href={selectedApp.audience_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedApp.audience_url}
                    </a>
                  </div>
                </div>
              )}

              {selectedApp.audience_size && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Размер аудитории
                  </label>
                  <div className="text-sm text-gray-900">
                    {selectedApp.audience_size.toLocaleString('ru-RU')}
                  </div>
                </div>
              )}

              {selectedApp.experience_years && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Опыт (лет)
                  </label>
                  <div className="text-sm text-gray-900">{selectedApp.experience_years}</div>
                </div>
              )}

              {selectedApp.motivation && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Мотивация
                  </label>
                  <div className="text-sm text-gray-900">{selectedApp.motivation}</div>
                </div>
              )}

              {selectedApp.reviewer_note && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Комментарий администратора
                  </label>
                  <div className="text-sm text-gray-900 bg-blue-50 p-2 rounded">
                    {selectedApp.reviewer_note}
                  </div>
                </div>
              )}
            </div>

            {/* Кнопки действия */}
            {selectedApp.status === 'new' && (
              <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Комментарий администратора..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleReviewApplication(selectedApp.id, 'approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    ✅ Одобрить
                  </button>
                  <button
                    onClick={() => handleReviewApplication(selectedApp.id, 'reject')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnersApplicationsPanel;
