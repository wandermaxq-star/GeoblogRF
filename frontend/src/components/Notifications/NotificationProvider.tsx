import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NotificationToast from './NotificationToast';
import apiClient from '../../api/apiClient';
import {
  moderationNotificationsService,
  ModerationNotification
} from '../../services/moderationNotificationsService';

interface NotificationContextType {
  currentNotification: ModerationNotification | null;
  showNotification: (notification: ModerationNotification) => void;
  hideNotification: () => void;
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [currentNotification, setCurrentNotification] = useState<ModerationNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const showNotification = useCallback((notification: ModerationNotification) => {
    setCurrentNotification(notification);
  }, []);

  const hideNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  // Загружаем счётчик с сервера + localStorage
  const refreshUnreadCount = useCallback(async () => {
    const localCount = moderationNotificationsService.getUnreadCount();
    setUnreadCount(localCount);

    // Параллельно запрашиваем серверные уведомления
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiClient.get('/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const serverCount = response.data?.count || 0;

      // Если на сервере есть непрочитанные — загружаем и показываем
      if (serverCount > 0) {
        const listResponse = await apiClient.get('/notifications', {
          params: { unreadOnly: 'true', limit: 10 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const serverNotifs = listResponse.data?.notifications || [];
        
        // Синхронизируем серверные уведомления в localStorage
        for (const sn of serverNotifs) {
          const contentTypeMap: Record<string, any> = {
            posts: 'post', events: 'event', routes: 'route', markers: 'marker',
          };
          moderationNotificationsService.notify({
            contentType: contentTypeMap[sn.content_type] || 'post',
            contentId: sn.content_id || '',
            contentTitle: sn.title,
            status: sn.metadata?.action === 'approved' ? 'approved'
              : sn.metadata?.action === 'rejected' ? 'rejected'
              : sn.metadata?.action === 'revision' ? 'revision' : 'pending',
            message: sn.message,
            reason: sn.metadata?.reason,
          });

          // Отмечаем как прочитанное на сервере (уже перенесли в localStorage)
          try {
            await apiClient.post(`/notifications/${sn.id}/read`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch { /* ignore */ }
        }
      }

      setUnreadCount(moderationNotificationsService.getUnreadCount());
    } catch {
      // Сервер недоступен — используем только localStorage
    }
  }, []);

  const handleNotificationClick = useCallback(() => {
    if (currentNotification) {
      // Переход к контенту или форме редактирования
      const { contentType, contentId, status } = currentNotification;
      
      if (status === 'approved') {
        // Переход к опубликованному контенту
        if (contentType === 'post') {
          window.location.href = `/posts/${contentId}`;
        } else if (contentType === 'marker') {
          window.location.href = `/map?marker=${contentId}`;
        } else if (contentType === 'route') {
          window.location.href = `/planner?route=${contentId}`;
        } else if (contentType === 'event') {
          window.location.href = `/calendar?event=${contentId}`;
        }
      } else if (status === 'rejected') {
        // Открытие формы редактирования
        // TODO: Реализовать открытие формы редактирования с подсвеченной ошибкой
        console.log('Открыть форму редактирования для', contentType, contentId);
      }
      
      hideNotification();
    }
  }, [currentNotification, hideNotification]);

  useEffect(() => {
    // Подписываемся на уведомления
    const unsubscribe = moderationNotificationsService.onNotification((notification) => {
      showNotification(notification);
      refreshUnreadCount();
    });

    // Загружаем начальное количество непрочитанных
    refreshUnreadCount();

    return () => {
      unsubscribe();
    };
  }, [showNotification, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        currentNotification,
        showNotification,
        hideNotification,
        unreadCount,
        refreshUnreadCount
      }}
    >
      {children}
      <NotificationToast
        notification={currentNotification}
        onClose={hideNotification}
        onClick={handleNotificationClick}
      />
    </NotificationContext.Provider>
  );
};

