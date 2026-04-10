import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { AffiliatePayout } from '../../../types/AdminTypes';

const PayoutsPanel: React.FC = () => {
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [creatingPayout, setCreatingPayout] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadPayouts();
  }, [filterStatus]);

  const loadPayouts = async () => {
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

      const response = await apiClient.get('/partners/admin/payouts', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setPayouts(response.data?.data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки выплат:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки выплат');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      setCreatingPayout(true);
      await apiClient.post(
        '/partners/admin/payouts/calculate',
        payoutForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Выплаты рассчитаны и созданы!');
      setPayoutForm({
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
      });
      loadPayouts();
    } catch (err: any) {
      console.error('Ошибка создания выплат:', err);
      alert(err.response?.data?.message || 'Ошибка создания выплат');
    } finally {
      setCreatingPayout(false);
    }
  };

  const handleProcessPayout = async (payoutId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация');
        return;
      }

      await apiClient.patch(
        `/partners/admin/payouts/${payoutId}/process`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert('Выплата отправлена!');
      loadPayouts();
    } catch (err: any) {
      console.error('Ошибка обработки выплаты:', err);
      alert(err.response?.data?.message || 'Ошибка обработки выплаты');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'calculated':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statuses = [
    { value: 'all', label: 'Все выплаты' },
    { value: 'calculated', label: 'Рассчитаны' },
    { value: 'sent', label: 'Отправлены' },
    { value: 'paid', label: 'Выплачены' },
  ];

  const totalAmount = payouts.reduce((s, p) => s + p.total_amount, 0);
  const pendingAmount = payouts
    .filter((p) => p.status === 'calculated')
    .reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">💸 Управление выплатами</h1>
        <p className="text-gray-500 mt-1">Расчёт, отправка и отслеживание выплат партнёрам</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего выплат</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{payouts.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Общая сумма</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            ₽{totalAmount.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">К выплате</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            ₽{pendingAmount.toLocaleString('ru-RU')}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Уже выплачено</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            ₽
            {payouts
              .filter((p) => p.status === 'paid')
              .reduce((s, p) => s + p.total_amount, 0)
              .toLocaleString('ru-RU')}
          </div>
        </div>
      </div>

      {/* Создание новых выплат */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Рассчитать выплаты за период</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Начало периода
            </label>
            <input
              type="date"
              value={payoutForm.period_start}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, period_start: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Конец периода
            </label>
            <input
              type="date"
              value={payoutForm.period_end}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, period_end: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreatePayout}
              disabled={creatingPayout}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50"
            >
              {creatingPayout ? '⏳ Расчёт...' : '📊 Рассчитать'}
            </button>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Выплаты не найдены</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Период
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Статус
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Создана
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr
                  key={payout.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {new Date(payout.period_start).toLocaleDateString('ru-RU')} -{' '}
                      {new Date(payout.period_end).toLocaleDateString('ru-RU')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        payout.status
                      )}`}
                    >
                      {payout.status === 'calculated'
                        ? '⏳ Рассчитана'
                        : payout.status === 'sent'
                        ? '📤 Отправлена'
                        : '✅ Выплачена'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">
                    ₽{payout.total_amount.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(payout.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {payout.status === 'calculated' && (
                      <button
                        onClick={() => handleProcessPayout(payout.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        📤 Отправить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PayoutsPanel;
