import React, { useState, useEffect } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminContent from './AdminContent';
import apiClient from '../../api/apiClient';
import {
  AdminMenuItemType,
  AdminNotifications,
} from '../../types/AdminTypes';

const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('moderation');
  const [activeItem, setActiveItem] = useState<string>('moderation-overview');
  const [notifications, setNotifications] = useState<AdminNotifications>({
    moderation: {
      posts: 0,
      events: 0,
      markers: 0,
      routes: 0,
      comments: 0,
      markerComments: 0,
    },
    partners: {
      applications: 0,
      payouts_pending: 0,
      refunds_pending: 0,
    },
    feedback: {
      new_complaints: 0,
      new_suggestions: 0,
    },
    analytics: 0,
    hub: {
      packs_pending: 0,
    },
  });
  const [loading, setLoading] = useState(false);

  // Загрузка счётчиков при монтировании
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Обновляем каждые 30 секунд
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      // Загружаем счётчики модерации
      const moderationRes = await apiClient.get('/moderation/tasks-count', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Загружаем счётчики партнёров
      const partnersRes = await apiClient
        .get('/partners/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => ({ data: { applications: 0, payouts_pending: 0, refunds_pending: 0 } }));

      // Загружаем счётчики обратной связи
      const feedbackRes = await apiClient
        .get('/feedback/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => ({ data: { new_complaints: 0, new_suggestions: 0 } }));

      // Загружаем счётчик ожидающих паков сообщества
      const hubPacksRes = await apiClient
        .get('/admin/pack-submissions?count=true', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => ({ data: { count: 0 } }));

      setNotifications({
        moderation: {
          posts: moderationRes.data?.posts || 0,
          events: moderationRes.data?.events || 0,
          markers: moderationRes.data?.markers || 0,
          routes: moderationRes.data?.routes || 0,
          comments: moderationRes.data?.comments || 0,
          markerComments: moderationRes.data?.markerComments || 0,
        },
        partners: {
          applications: partnersRes.data?.applications || 0,
          payouts_pending: partnersRes.data?.payouts_pending || 0,
          refunds_pending: partnersRes.data?.refunds_pending || 0,
        },
        feedback: {
          new_complaints: feedbackRes.data?.new_complaints || 0,
          new_suggestions: feedbackRes.data?.new_suggestions || 0,
        },
        analytics: 0,
        hub: {
          packs_pending: hubPacksRes.data?.count || 0,
        },
      });
    } catch (err: any) {
      console.error('Ошибка загрузки счётчиков:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item: AdminMenuItemType) => {
    setActiveSection(item.section);
    setActiveItem(item.id);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Левая сайдбар */}
      <AdminSidebar
        activeSection={activeSection}
        activeItem={activeItem}
        onSelectItem={handleSelectItem}
        notifications={notifications}
      />

      {/* Основной контент */}
      <AdminContent activeItem={activeItem} />
    </div>
  );
};

export default AdminDashboard;
