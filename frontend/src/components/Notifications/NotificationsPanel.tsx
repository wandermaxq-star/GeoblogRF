import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaTimes, FaTrash } from 'react-icons/fa';
import {
  moderationNotificationsService,
  ModerationNotification
} from '../../services/moderationNotificationsService';

const PanelOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const PanelContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PanelTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f0f0f0;
  }
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #666;
`;

const NotificationGroup = styled.div`
  margin-bottom: 32px;
`;

const GroupTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const NotificationItem = styled.div<{ read: boolean }>`
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
  background: ${props => props.read ? 'transparent' : '#f8f9fa'};
  border: 1px solid ${props => props.read ? '#e0e0e0' : '#d0d0d0'};

  &:hover {
    background: #f0f0f0;
  }
`;

const NotificationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const NotificationTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
`;

const NotificationTime = styled.div`
  font-size: 12px;
  color: #999;
`;

const NotificationDescription = styled.div<{ hasReason?: boolean }>`
  font-size: 13px;
  color: #444;
  line-height: 1.5;
  margin-bottom: ${props => props.hasReason ? '8px' : '0'};
`;

const NotificationReason = styled.div`
  font-size: 13px;
  color: #666;
  font-style: italic;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
`;

const PanelFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ClearButton = styled.button`
  background: none;
  border: none;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;

  &:hover {
    background: #f0f0f0;
  }
`;

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<ModerationNotification[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = () => {
    const history = moderationNotificationsService.getHistory();
    setNotifications(history);
  };

  const handleNotificationClick = (notification: ModerationNotification) => {
    // Отмечаем как прочитанное
    moderationNotificationsService.markAsRead(notification.id);
    loadNotifications();

    // Переход к контенту
    const { contentType, contentId, status } = notification;
    
    if (status === 'approved') {
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
      // TODO: Открыть форму редактирования
      console.log('Открыть форму редактирования для', contentType, contentId);
    }

    onClose();
  };

  const handleClearHistory = () => {
    if (confirm('Очистить всю историю уведомлений?')) {
      moderationNotificationsService.clearHistory();
      loadNotifications();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Сегодня';
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      return `${days} дней назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
  };

  const groupNotifications = () => {
    const groups: Record<string, ModerationNotification[]> = {
      today: [],
      yesterday: [],
      earlier: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifications.forEach(notif => {
      const notifDate = new Date(notif.timestamp);
      if (notifDate >= today) {
        groups.today.push(notif);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(notif);
      } else {
        groups.earlier.push(notif);
      }
    });

    return groups;
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      post: 'Пост',
      marker: 'Метка',
      route: 'Маршрут',
      event: 'Событие'
    };
    return labels[type] || 'Контент';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      approved: 'Одобрено',
      rejected: 'Отклонён',
      revision: 'На доработку',
      pending: 'На модерации'
    };
    return labels[status] || status;
  };

  const getDescription = (notification: ModerationNotification) => {
    const title = notification.contentTitle ? `«${notification.contentTitle}»` : 'Ваш контент';
    
    switch (notification.status) {
      case 'approved':
        if (notification.contentType === 'post') {
          return `${title} теперь виден всем.`;
        } else if (notification.contentType === 'marker') {
          return `${title} добавлена на карту.`;
        } else if (notification.contentType === 'route') {
          return `${title} доступен в планировщике.`;
        } else if (notification.contentType === 'event') {
          return `${title} отображается в календаре.`;
        }
        return `${title} опубликован.`;
      
      case 'rejected':
        return `${title} не прошёл модерацию.`;
      
      case 'revision':
        return `${title} отправлен на доработку.`;
      
      case 'pending':
        return `${title} отправлен на проверку.`;
      
      default:
        return '';
    }
  };

  const groups = groupNotifications();

  if (!isOpen) return null;

  return (
    <PanelOverlay isOpen={isOpen} onClick={onClose}>
      <PanelContainer onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle>Уведомления</PanelTitle>
          <CloseButton onClick={onClose}>
            <FaTimes />
          </CloseButton>
        </PanelHeader>

        <PanelContent>
          {notifications.length === 0 ? (
            <EmptyState>
              <p>Нет уведомлений</p>
            </EmptyState>
          ) : (
            <>
              {groups.today.length > 0 && (
                <NotificationGroup>
                  <GroupTitle>Сегодня</GroupTitle>
                  {groups.today.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      read={notif.read}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <NotificationHeader>
                        <NotificationTitle>
                          {getContentTypeLabel(notif.contentType)} · {getStatusLabel(notif.status)}
                        </NotificationTitle>
                        <NotificationTime>{formatTime(notif.timestamp)}</NotificationTime>
                      </NotificationHeader>
                      <NotificationDescription hasReason={!!notif.reason}>
                        {getDescription(notif)}
                      </NotificationDescription>
                      {notif.reason && (
                        <NotificationReason>
                          Причина: {notif.reason}
                        </NotificationReason>
                      )}
                    </NotificationItem>
                  ))}
                </NotificationGroup>
              )}

              {groups.yesterday.length > 0 && (
                <NotificationGroup>
                  <GroupTitle>Вчера</GroupTitle>
                  {groups.yesterday.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      read={notif.read}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <NotificationHeader>
                        <NotificationTitle>
                          {getContentTypeLabel(notif.contentType)} · {getStatusLabel(notif.status)}
                        </NotificationTitle>
                        <NotificationTime>{formatTime(notif.timestamp)}</NotificationTime>
                      </NotificationHeader>
                      <NotificationDescription hasReason={!!notif.reason}>
                        {getDescription(notif)}
                      </NotificationDescription>
                      {notif.reason && (
                        <NotificationReason>
                          Причина: {notif.reason}
                        </NotificationReason>
                      )}
                    </NotificationItem>
                  ))}
                </NotificationGroup>
              )}

              {groups.earlier.length > 0 && (
                <NotificationGroup>
                  <GroupTitle>Ранее</GroupTitle>
                  {groups.earlier.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      read={notif.read}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <NotificationHeader>
                        <NotificationTitle>
                          {getContentTypeLabel(notif.contentType)} · {getStatusLabel(notif.status)}
                        </NotificationTitle>
                        <NotificationTime>{formatTime(notif.timestamp)}</NotificationTime>
                      </NotificationHeader>
                      <NotificationDescription hasReason={!!notif.reason}>
                        {getDescription(notif)}
                      </NotificationDescription>
                      {notif.reason && (
                        <NotificationReason>
                          Причина: {notif.reason}
                        </NotificationReason>
                      )}
                    </NotificationItem>
                  ))}
                </NotificationGroup>
              )}
            </>
          )}
        </PanelContent>

        {notifications.length > 0 && (
          <PanelFooter>
            <ClearButton onClick={handleClearHistory}>
              <FaTrash size={14} />
              Очистить всё
            </ClearButton>
          </PanelFooter>
        )}
      </PanelContainer>
    </PanelOverlay>
  );
};

export default NotificationsPanel;

