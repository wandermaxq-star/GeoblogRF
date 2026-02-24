import React, { useState, useEffect } from 'react';
import ModerationHistoryPanel from './ModerationHistoryPanel';
import AnalyticsDashboard from '../../analytics/dashboard/pages/AnalyticsDashboard';
import apiClient from '../../api/apiClient';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'moderation' | 'analytics'>('moderation');
  const [taskCounts, setTaskCounts] = useState<{
    markers: number;
    events: number;
    posts: number;
  }>({ markers: 0, events: 0, posts: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTaskCounts();
  }, []);

  const loadTaskCounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiClient.get('/moderation/tasks-count', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        setTaskCounts(response.data);
      }
    } catch (err: any) {
      console.error('Ошибка загрузки счётчиков:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Навигация по вкладкам */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'moderation'
                ? 'bg-orange-600 text-white border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Модерация
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            📊 Аналитика
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'moderation' && (
        <>
          {/* Счётчики задач модерации */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">Метки</div>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? '...' : taskCounts.markers}
              </div>
              <div className="text-xs text-gray-500 mt-1">на модерации</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">События</div>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? '...' : taskCounts.events}
              </div>
              <div className="text-xs text-gray-500 mt-1">на модерации</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">Посты</div>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? '...' : taskCounts.posts}
              </div>
              <div className="text-xs text-gray-500 mt-1">на модерации</div>
            </div>
          </div>

          {/* Панель модерации */}
          <ModerationHistoryPanel />
        </>
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard />
      )}
    </div>
  );
};

export default AdminDashboard;
