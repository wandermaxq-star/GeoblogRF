import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { Partner } from '../../../types/AdminTypes';

const PartnersListPanel: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPartners();
  }, [filterStatus, filterRole, searchQuery]);

  const loadPartners = async () => {
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
      if (filterRole !== 'all') params.role = filterRole;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await apiClient.get('/partners/admin/list', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setPartners(response.data?.data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки партнёров:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки партнёров');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'expert':
        return 'bg-purple-100 text-purple-800';
      case 'ambassador':
        return 'bg-blue-100 text-blue-800';
      case 'novice':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'pro_guide':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statuses = [
    { value: 'all', label: 'Все статусы' },
    { value: 'pro_guide', label: 'Pro Guide' },
    { value: 'expert', label: 'Эксперт' },
    { value: 'ambassador', label: 'Амбассадор' },
    { value: 'novice', label: 'Новичок' },
    { value: 'pending', label: 'На рассмотрении' },
  ];

  const roles = [
    { value: 'all', label: 'Все роли' },
    { value: 'pro_guide', label: 'Pro Guide' },
    { value: 'simple', label: 'Простой автор' },
  ];

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">👥 Партнёры</h1>
        <p className="text-gray-500 mt-1">Управление партнёрской программой</p>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Всего партнёров</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {partners.length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Pro Guide</div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {partners.filter((p) => p.partner_role === 'pro_guide').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Эксперты</div>
          <div className="text-2xl font-bold text-purple-600 mt-2">
            {partners.filter((p) => p.partner_status === 'expert').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Общий доход</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            ₽{partners.reduce((s, p) => s + p.total_earned, 0).toLocaleString('ru-RU')}
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Статус
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Роль
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Поиск
            </label>
            <input
              type="text"
              placeholder="Имя или email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              &nbsp;
            </label>
            <button
              onClick={loadPartners}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : partners.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Партнёры не найдены</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Партнёр
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Роль
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Рефералы
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  Доход
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                  К-во %
                </th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{partner.name}</div>
                      <div className="text-sm text-gray-500">{partner.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        partner.partner_status
                      )}`}
                    >
                      {partner.partner_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {partner.partner_role === 'pro_guide'
                      ? '🎯 Pro Guide'
                      : '👤 Автор'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-700">
                    {partner.total_referrals}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ₽{partner.total_earned.toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {partner.commission_rate}%
                    </span>
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

export default PartnersListPanel;
