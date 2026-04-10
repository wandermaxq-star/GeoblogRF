import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { AffiliateRefund } from '../../../types/AdminTypes';

const RefundsPanel: React.FC = () => {
  const [refunds, setRefunds] = useState<AffiliateRefund[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadRefunds();
  }, [filterStatus, page]);

  const loadRefunds = async () => {
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

      const response = await apiClient.get('/partners/admin/refunds', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setRefunds(response.data?.data || []);
      setTotal(response.data?.total || 0);
    } catch (err: any) {
      console.error('Ошибка загрузки возвратов:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки возвратов');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      await apiClient.patch(
        `/partners/admin/refunds/${refundId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Возврат одобрен!');
      loadRefunds();
    } catch (err: any) {
      console.error('Ошибка одобрения возврата:', err);
      alert(err.response?.data?.message || 'Ошибка одобрения возврата');
    }
  };

  const handleRejectRefund = async (refundId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      await apiClient.patch(
        `/partners/admin/refunds/${refundId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Возврат отклонён!');
      loadRefunds();
    } catch (err: any) {
      console.error('Ошибка отклонения возврата:', err);
      alert(err.response?.data?.message || 'Ошибка отклонения возврата');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statuses = [
    { value: 'all', label: 'Все возвраты' },
    { value: 'pending', label: 'Ожидание' },
    { value: 'approved', label: 'Одобренные' },
    { value: 'rejected', label: 'Отклонённые' },
  ];

  const totalAmount = refunds.reduce((s, r) => s + r.amount, 0);
  const pendingAmount = refunds
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0);
  const approvedAmount = refunds
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">↩️ Возвраты средств</h1>
        <p className="text-gray-500 mt-1">Управление запросами на возврат комиссий и доходов</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего возвратов</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Требуется решение</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            ₽{pendingAmount.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Одобрено</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            ₽{approvedAmount.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Общий объём</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            ₽{totalAmount.toLocaleString('ru-RU')}
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
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : refunds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Возвраты не найдены</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Партнёр ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Причина возврата
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Статус
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Дата запроса
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr
                  key={refund.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">
                    {refund.referrer_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{refund.reason}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        refund.status
                      )}`}
                    >
                      {refund.status === 'approved'
                        ? '✅ Одобрено'
                        : refund.status === 'pending'
                        ? '⏳ Ожидание'
                        : '❌ Отклонено'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-red-600">
                    -₽{refund.amount.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(refund.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {refund.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleApproveRefund(refund.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          ✅ Одобрить
                        </button>
                        <button
                          onClick={() => handleRejectRefund(refund.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                        >
                          ❌ Отклонить
                        </button>
                      </div>
                    )}
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

export default RefundsPanel;
