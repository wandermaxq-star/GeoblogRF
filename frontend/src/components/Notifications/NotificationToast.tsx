import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { ModerationNotification } from '../../services/moderationNotificationsService';

const ToastContainer = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 10000;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px 20px;
  min-width: 320px;
  max-width: 480px;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transform: ${props => props.$isVisible ? 'translateX(0)' : 'translateX(400px)'};
  transition: all 0.3s ease;
  pointer-events: ${props => props.$isVisible ? 'auto' : 'none'};
`;

const ToastHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const ToastTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.4;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;

  &:hover {
    color: #1a1a1a;
  }
`;

const ToastDescription = styled.div<{ $hasReason?: boolean }>`
  font-size: 13px;
  color: #444;
  line-height: 1.5;
  margin-bottom: ${props => props.$hasReason ? '8px' : '0'};
`;

const ToastReason = styled.div`
  font-size: 13px;
  color: #666;
  font-style: italic;
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
`;

interface NotificationToastProps {
  notification: ModerationNotification | null;
  onClose: () => void;
  onClick?: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onClick
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Ждём завершения анимации
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification, onClose]);

  if (!notification) return null;

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
      pending: 'На модерации'
    };
    return labels[status] || status;
  };

  const getDescription = () => {
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
      
      case 'pending':
        return `${title} отправлен на проверку.`;
      
      default:
        return '';
    }
  };

  return (
    <ToastContainer
      $isVisible={isVisible}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <ToastHeader>
        <ToastTitle>
          {getContentTypeLabel(notification.contentType)} · {getStatusLabel(notification.status)}
        </ToastTitle>
        <CloseButton onClick={(e) => { e.stopPropagation(); onClose(); }}>
          ×
        </CloseButton>
      </ToastHeader>
      <ToastDescription $hasReason={!!notification.reason}>
        {getDescription()}
      </ToastDescription>
      {notification.reason && (
        <ToastReason>
          Причина: {notification.reason}
        </ToastReason>
      )}
    </ToastContainer>
  );
};

export default NotificationToast;

