import React, { useState, useEffect } from 'react';
import { analyticsOrchestrator } from '../../services/analyticsOrchestrator';
import { ComprehensiveMetrics, TimeRange } from '../../types/analytics.types';
import MetricCard from './MetricCard';

const TechnicalDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ComprehensiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await analyticsOrchestrator.getComprehensiveMetrics(timeRange);
      setMetrics(data);
    } catch (error) {
      console.error('Ошибка загрузки данных дашборда:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-gray-500">Загрузка метрик...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Не удалось загрузить данные</div>
      </div>
    );
  }

  const { moderation, contentStats, users } = metrics;

  // Подсчёт контента по статусам модерации
  const totalPending = (moderation?.posts?.pending ?? 0) + (moderation?.markers?.pending ?? 0) + (moderation?.events?.pending ?? 0) + (moderation?.routes?.pending ?? 0);
  const totalRejected = (moderation?.posts?.rejected ?? 0) + (moderation?.markers?.rejected ?? 0) + (moderation?.events?.rejected ?? 0) + (moderation?.routes?.rejected ?? 0);

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Технический дашборд</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="24h">Последние 24 часа</option>
          <option value="7d">Последние 7 дней</option>
          <option value="30d">Последние 30 дней</option>
          <option value="90d">Последние 90 дней</option>
        </select>
      </div>

      {/* ИИ-модерация */}
      {moderation && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🤖 ИИ-модерация</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <MetricCard
              title="Точность ИИ"
              value={`${moderation.ai.accuracy_pct}%`}
              subtitle={`${moderation.ai.reviewed} проверено`}
              color={moderation.ai.accuracy_pct >= 80 ? 'green' : moderation.ai.accuracy_pct >= 50 ? 'orange' : 'red'}
              icon="🎯"
            />
            <MetricCard
              title="Ожидают модерации"
              value={totalPending}
              color={totalPending > 10 ? 'red' : totalPending > 0 ? 'orange' : 'green'}
              icon="⏳"
            />
            <MetricCard
              title="Отклонено"
              value={totalRejected}
              subtitle="всего"
              color="red"
              icon="❌"
            />
          </div>

          {/* Детальная разбивка по типам */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Статусы контента по типам:</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 text-gray-600 font-medium">Тип</th>
                    <th className="text-right py-2 px-2 text-green-600 font-medium">Одобрено</th>
                    <th className="text-right py-2 px-2 text-yellow-600 font-medium">На модерации</th>
                    <th className="text-right py-2 px-2 text-red-600 font-medium">Отклонено</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Посты', data: moderation.posts },
                    { name: 'Метки', data: moderation.markers },
                    { name: 'События', data: moderation.events },
                    { name: 'Маршруты', data: moderation.routes },
                  ].map(({ name, data }) => (
                    <tr key={name} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-700">{name}</td>
                      <td className="text-right py-2 px-2 text-green-700">{data.approved ?? 0}</td>
                      <td className="text-right py-2 px-2 text-yellow-700">{data.pending ?? 0}</td>
                      <td className="text-right py-2 px-2 text-red-700">{data.rejected ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Статистика контента */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Общая статистика</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Контент (всего в системе):</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600">Постов</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.totals.posts ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Меток</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.totals.markers ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Событий</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.totals.events ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Маршрутов</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.totals.routes ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Комментариев</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.totals.comments ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Постов с фото</div>
                <div className="text-xl font-semibold text-gray-900">{contentStats?.posts_with_photos_pct ?? 0}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Пользователи:</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600">Всего</div>
                <div className="text-xl font-semibold text-gray-900">{users?.total ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Активных(контент)</div>
                <div className="text-xl font-semibold text-gray-900">{users?.active_authors ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Новых за период</div>
                <div className="text-xl font-semibold text-green-600">+{users?.new_users ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Рост</div>
                <div className="text-xl font-semibold text-gray-900">{users?.growth_rate ?? 0}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Посты по дням (график) */}
      {contentStats && contentStats.posts_by_day.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Посты по дням</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-end gap-1 h-32">
              {contentStats.posts_by_day.map((d, idx) => {
                const max = Math.max(...contentStats.posts_by_day.map(x => x.count), 1);
                const height = (d.count / max) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center flex-1" title={`${d.day}: ${d.count}`}>
                    <div className="text-xs text-gray-500 mb-1">{d.count}</div>
                    <div
                      className="w-full bg-blue-500 rounded-t-sm min-h-[2px]"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {contentStats.posts_by_day.map((d, idx) => (
                <div key={idx} className="flex-1 text-center text-[10px] text-gray-400 truncate">
                  {new Date(d.day).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalDashboard;

