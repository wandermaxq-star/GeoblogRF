import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '../../api/apiClient';

interface User {
  id: number;
  email: string;
  name?: string | null;
}

interface SubscriptionAdmin {
  id: number;
  plan: string;
  status: 'active' | 'inactive' | 'cancelled' | string;
  currentPeriodEnd: string | null;
  user: User;
}

type SortKey = 'user.email' | 'plan' | 'status' | 'currentPeriodEnd';
type SortDir = 'asc' | 'desc';

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('currentPeriodEnd');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let isMounted = true;

    const fetchSubscriptions = async () => {
      try {
        const res = await apiClient.get<SubscriptionAdmin[]>('/api/admin/subscriptions');
        if (isMounted) {
          setSubscriptions(res.data ?? []);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || 'Не удалось загрузить подписки');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSubscriptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAndSorted = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = subscriptions.filter((s) => {
      const matchesSearch =
        !normalizedSearch ||
        s.user.email.toLowerCase().includes(normalizedSearch) ||
        (s.user.name ?? '').toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      const getVal = (obj: SubscriptionAdmin, key: SortKey) => {
        switch (key) {
          case 'user.email':
            return obj.user.email.toLowerCase();
          case 'plan':
            return (obj.plan || '').toLowerCase();
          case 'status':
            return (obj.status || '').toLowerCase();
          case 'currentPeriodEnd':
            return obj.currentPeriodEnd ? new Date(obj.currentPeriodEnd).getTime() : 0;
          default:
            return 0;
        }
      };

      const aVal = getVal(a, sortKey);
      const bVal = getVal(b, sortKey);

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [subscriptions, search, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'inactive':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Подписки пользователей</h1>
        <div className="p-4 rounded bg-red-50 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Подписки пользователей</h1>
        <div className="text-sm text-gray-500">
          Всего: {filteredAndSorted.length}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по email или имени"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
          <option value="cancelled">Отменённые</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="px-3 py-2 rounded border"
          >
            Сбросить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-500">Загрузка...</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-6 text-center text-gray-500">Нет данных</div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="py-2 px-4 border-b cursor-pointer select-none text-left hover:bg-gray-100"
                  onClick={() => handleSort('user.email')}
                >
                  Пользователь {sortKey === 'user.email' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="py-2 px-4 border-b cursor-pointer select-none text-left hover:bg-gray-100"
                  onClick={() => handleSort('plan')}
                >
                  План {sortKey === 'plan' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="py-2 px-4 border-b cursor-pointer select-none text-left hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  Статус {sortKey === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="py-2 px-4 border-b cursor-pointer select-none text-left hover:bg-gray-100"
                  onClick={() => handleSort('currentPeriodEnd')}
                >
                  Окончание {sortKey === 'currentPeriodEnd' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">
                    <div className="font-medium">{sub.user.email}</div>
                    {sub.user.name && (
                      <div className="text-xs text-gray-500">{sub.user.name}</div>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b capitalize">{sub.plan}</td>
                  <td className="py-2 px-4 border-b">
                    <span
                      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(
                        sub.status
                      )}`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {sub.currentPeriodEnd
                      ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}