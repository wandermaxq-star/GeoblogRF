import React, { useState, useEffect } from 'react';
import { analyticsOrchestrator } from '../../services/analyticsOrchestrator';
import { ComprehensiveMetrics, TimeRange } from '../../types/analytics.types';
import MetricCard from './MetricCard';

const ProductTeamDashboard: React.FC = () => {
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

  const { gamification, contentStats, gamificationExtended } = metrics;

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Дашборд команды продукта</h2>
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

      {/* Геймификация */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🎮 Геймификация</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard
            title="Активность сегодня"
            value={`${gamification.daily_goals_completion}%`}
            subtitle="получали XP сегодня"
            color="green"
          />
          <MetricCard
            title="Вовлечение за период"
            value={`${gamification.achievement_unlock_rate}%`}
            subtitle="получали XP за период"
            color="purple"
          />
          <MetricCard
            title="Средний уровень"
            value={gamificationExtended?.avg_level ?? 0}
            subtitle={`макс: ${gamificationExtended?.max_level ?? 0}`}
            color="blue"
          />
        </div>
        
        {/* XP по источникам */}
        {gamification.xp_sources.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Источники XP за период:</div>
            <div className="space-y-2">
              {gamification.xp_sources.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{source.source}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${source.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-20 text-right">
                      {source.total_xp} XP ({source.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Распределение по уровням */}
        {gamification.level_distribution.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Распределение по уровням:</div>
            <div className="flex flex-wrap gap-2">
              {gamification.level_distribution.map((l, idx) => (
                <div key={idx} className="px-3 py-2 bg-gray-50 rounded-lg text-center min-w-[60px]">
                  <div className="text-xs text-gray-500">Ур. {l.level}</div>
                  <div className="text-sm font-semibold text-gray-800">{l.user_count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Топ пользователей */}
        {gamificationExtended && gamificationExtended.top_users.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-3">🏆 Топ-10 по XP:</div>
            <div className="space-y-2">
              {gamificationExtended.top_users.map((u, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    <span className="font-medium text-gray-400 mr-2">#{idx + 1}</span>
                    {u.username}
                  </span>
                  <span className="text-gray-700">{u.total_xp} XP · Ур. {u.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gamification.problem_areas.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm font-medium text-yellow-800 mb-2">⚠️ Проблемные места:</div>
            <ul className="space-y-1">
              {gamification.problem_areas.map((area, idx) => (
                <li key={idx} className="text-sm text-yellow-700">
                  • {area.issue} ({area.affected_users_percentage}% пользователей)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Контент */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📝 Контент</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard
            title="Постов с фото"
            value={`${contentStats?.posts_with_photos_pct ?? 0}%`}
            subtitle="от всех постов"
            color="green"
          />
          <MetricCard
            title="Комментариев/пост"
            value={contentStats?.avg_comments_per_post ?? 0}
            subtitle="в среднем"
            color="orange"
          />
          <MetricCard
            title="Лайков за период"
            value={contentStats?.total_likes_period ?? 0}
            color="red"
          />
        </div>

        {/* Топ авторов */}
        {contentStats && contentStats.top_authors.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-3">✍️ Топ авторов за период:</div>
            <div className="space-y-2">
              {contentStats.top_authors.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{a.username}</span>
                  <span className="text-gray-700 font-medium">{a.post_count} постов</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTeamDashboard;

