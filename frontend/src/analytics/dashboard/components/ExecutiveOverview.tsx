import React, { useState, useEffect } from 'react';
import { analyticsOrchestrator } from '../../services/analyticsOrchestrator';
import { ComprehensiveMetrics, TimeRange } from '../../types/analytics.types';
import MetricCard from './MetricCard';

const ExecutiveOverview: React.FC = () => {
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
        <div className="text-gray-500 mb-4">Не удалось загрузить данные</div>
        <button 
          onClick={() => loadDashboardData()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  const { users, contentStats, moderation, geography, notifications, gamificationExtended } = metrics;

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Обзор для руководства</h2>
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

      {/* Пользователи */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Пользователи</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Всего пользователей"
            value={users?.total ?? 0}
            icon="👥"
            color="blue"
          />
          <MetricCard
            title="Новых за период"
            value={`+${users?.new_users ?? 0}`}
            subtitle={`рост ${users?.growth_rate ?? 0}%`}
            trend={users?.growth_rate ? { value: users.growth_rate, direction: users.growth_rate >= 0 ? 'up' : 'down' } : undefined}
            icon="📈"
            color="green"
          />
          <MetricCard
            title="Активных авторов"
            value={users?.active_authors ?? 0}
            subtitle="создавали контент"
            icon="✍️"
            color="purple"
          />
          <MetricCard
            title="Средний уровень"
            value={gamificationExtended?.avg_level ?? 0}
            subtitle={`макс: ${gamificationExtended?.max_level ?? 0}`}
            icon="🎮"
            color="orange"
          />
        </div>
      </div>

      {/* Контент */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📝 Контент за период</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard title="Посты" value={contentStats?.period.posts ?? 0} subtitle={`всего: ${contentStats?.totals.posts ?? 0}`} icon="📄" color="blue" />
          <MetricCard title="Метки" value={contentStats?.period.markers ?? 0} subtitle={`всего: ${contentStats?.totals.markers ?? 0}`} icon="📍" color="red" />
          <MetricCard title="События" value={contentStats?.period.events ?? 0} subtitle={`всего: ${contentStats?.totals.events ?? 0}`} icon="📅" color="green" />
          <MetricCard title="Маршруты" value={contentStats?.period.routes ?? 0} subtitle={`всего: ${contentStats?.totals.routes ?? 0}`} icon="🗺️" color="purple" />
          <MetricCard title="Комментарии" value={contentStats?.period.comments ?? 0} subtitle={`всего: ${contentStats?.totals.comments ?? 0}`} icon="💬" color="orange" />
        </div>
      </div>

      {/* География */}
      {geography && geography.top_regions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🗺️ География меток</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">Топ регионов:</div>
                <div className="space-y-2">
                  {geography.top_regions.slice(0, 8).map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{r.region}</span>
                      <span className="text-sm font-medium text-gray-800">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">По категориям:</div>
                <div className="space-y-2">
                  {geography.by_category.slice(0, 8).map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{c.category}</span>
                      <span className="text-sm font-medium text-gray-800">{c.count}</span>
                    </div>
                  ))}
                </div>
                {geography.markers_without_coords > 0 && (
                  <div className="mt-3 text-xs text-amber-600">
                    ⚠️ {geography.markers_without_coords} меток без координат
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модерация и уведомления */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {moderation && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🛡️ Модерация</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-3">
                {[
                  { label: 'Посты', data: moderation.posts },
                  { label: 'Метки', data: moderation.markers },
                  { label: 'События', data: moderation.events },
                ].map(({ label, data }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <div className="flex gap-2">
                      {data.approved != null && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">✅ {data.approved ?? 0}</span>}
                      {data.pending != null && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">⏳ {data.pending ?? 0}</span>}
                      {data.rejected != null && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">❌ {data.rejected ?? 0}</span>}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-sm text-gray-600">ИИ-модерация: точность <span className="font-semibold text-gray-900">{moderation.ai.accuracy_pct}%</span> ({moderation.ai.reviewed} проверено)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {notifications && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔔 Уведомления за период</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-600">Отправлено</div>
                  <div className="text-2xl font-semibold text-gray-900">{notifications.total}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Прочитано</div>
                  <div className="text-2xl font-semibold text-green-600">{notifications.read_rate_pct}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Прочитано</div>
                  <div className="text-lg font-semibold text-gray-900">{notifications.read}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Непрочитано</div>
                  <div className="text-lg font-semibold text-orange-600">{notifications.unread}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveOverview;

