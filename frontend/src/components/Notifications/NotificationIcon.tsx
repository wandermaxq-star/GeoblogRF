import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaBell } from 'react-icons/fa';
import { useNotifications } from './NotificationProvider';
import NotificationsPanel from './NotificationsPanel';

const IconButton = styled.button`
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: color 0.2s;
  border-radius: 4px;

  &:hover {
    color: #1a1a1a;
    background: rgba(0, 0, 0, 0.05);
  }
`;

const Badge = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  background: #e74c3c;
  color: white;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border: 2px solid white;
`;

const NotificationIcon: React.FC = () => {
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Обновляем счётчик при монтировании и периодически
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000); // Каждые 30 секунд
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isPanelOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <IconButton
        onClick={() => setIsPanelOpen((open) => !open)}
        title="Уведомления"
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <Badge>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </IconButton>
      <NotificationsPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          refreshUnreadCount();
        }}
      />
    </div>
  );
};

export default NotificationIcon;

