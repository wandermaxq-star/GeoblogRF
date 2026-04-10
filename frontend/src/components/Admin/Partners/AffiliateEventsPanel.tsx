import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { AffiliateEvent } from '../../../types/AdminTypes';

const AffiliateEventsPanel: React.FC = () => {
  const [events, setEvents] = useState<AffiliateEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadEvents();
  }, [filterStatus, filterType, page]);

  const loadEvents = async () => {
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
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterType !== 'all') params.event_type = filterType;

      const response = await apiClient.get('/partners/admin/events', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setEvents(response.data?.data || []);
      setTotal(response.data?.total || 0);
    } catch (err: any) {
      console.error('Ошибка загрузки событий:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки событий');
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'paid_premium_referral':
        return 'bg-purple-100 text-purple-800';
      case 'paid_pack':
        return 'bg-blue-100 text-blue-800';
      case 'first_subscription':
        return 'bg-green-100 text-green-800';
      case 'signup':
        return 'bg-yellow-100 text-yellow-800';
      case 'curated_pack_sale':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'paid_premium_referral':
        return 'Оплачено: Премиум реферал';
      case 'paid_pack':
        return 'Оплачено: Pro Pack';
      case 'first_subscription':
        return 'Первая подписка';
      case 'signup':
        return 'Регистрация';
      case 'curated_pack_sale':
        return 'Продажа кураторского пака';
      default:
        return type;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const eventTypes = [
    { value: 'all', label: 'Все события' },
    { value: 'signup', label: 'Регистрация' },
    { value: 'first_subscription', label: 'Первая подписка' },
    { value: 'paid_premium_referral', label: 'Опл. премиум реферал' },
    { value: 'paid_pack', label: 'Опл. Pro Pack' },
    { value: 'curated_pack_sale', label: 'Продажа пака' },
  ];

  const statuses = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидание' },
    { value: 'paid', label: 'Выплачено' },
    { value: 'rejected', label: 'Отклонено' },
  ];

  const totalAmount = events.reduce((s, e) => s + e.commission_due, 0);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">💰 События доходов</h1>
        <p className="text-gray-500 mt-1">Отслеживание всех событий, генерирующих доход партнёрам</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего событий</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">На этой странице</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{events.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего комиссии</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            ₽{totalAmount.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Ожидание выплаты</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            ₽
            {events
              .filter((e) => e.status === 'pending')
              .reduce((s, e) => s + e.commission_due, 0)
              .toLocaleString('ru-RU')}
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип события
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              {eventTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Статус
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">События не найдены</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Тип события
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Статус
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Сумма
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Комиссия
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(event.created_at).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEventTypeBadgeColor(
                        event.event_type
                      )}`}
                    >
                      {getEventTypeLabel(event.event_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        event.status
                      )}`}
                    >
                      {event.status === 'paid'
                        ? '✅ Выплачено'
                        : event.status === 'pending'
                        ? '⏳ Ожидание'
                        : '❌ Отклонено'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ₽{event.amount.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">
                    ₽{event.commission_due.toLocaleString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагинация */}
      {total > limit && (
        <div className="flex justify-between items-center">
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
  );
};

export default AffiliateEventsPanel;
