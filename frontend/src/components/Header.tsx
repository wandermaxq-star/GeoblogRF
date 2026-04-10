import './TopPanel.css';
import { Search, Settings, MessageCircle, Bell, MapPin, Users } from 'lucide-react';
import { useActivityStats } from '../hooks/useActivityStats';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = ({
  avatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%2329BFB5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='16'%3EA%3C/text%3E%3C/svg%3E",
  hasNewMessages = true,
  openSearch = () => {},
  openSettings = () => {},
  openChat = () => {},
  quickAddMarker = () => {},
  goToProfile = () => {},
  showUserTooltip = () => {}
}) => {
  const { stats } = useActivityStats();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const handleNotificationsClick = () => {
    navigate('/activity');
  };

  const handlePartnerClick = () => {
    navigate('/partner');
  };
  return (
    <header className="top-controls">
      <button className="icon-button" onClick={openSearch} aria-label="Поиск (/)">
        <Search size={20} strokeWidth={2.5} />
      </button>

      <button className="icon-button" onClick={openSettings} aria-label="Настройки">
        <Settings size={20} strokeWidth={2.5} />
      </button>

      <button className="icon-button" onClick={openChat} aria-label="Новые сообщения">
        <MessageCircle size={20} strokeWidth={2.5} />
        {hasNewMessages && <span className="pulse-badge" />}
      </button>

      <button className="icon-button" onClick={handleNotificationsClick} aria-label="Уведомления">
        <Bell size={20} strokeWidth={2.5} />
        {stats && stats.unread_activities > 0 && (
          <span className="alert-dot" title={`${stats.unread_activities} непрочитанных активностей`}>
            {stats.unread_activities > 99 ? '99+' : stats.unread_activities}
          </span>
        )}
      </button>

      {user?.role === 'partner' && (
        <button className="icon-button" onClick={handlePartnerClick} aria-label="Партнёрка">
          <Users size={20} strokeWidth={2.5} />
        </button>
      )}

      <button className="icon-button highlight" onClick={quickAddMarker} aria-label="Добавить метку">
        <MapPin size={20} strokeWidth={2.5} />
      </button>

      <div
        className="user-avatar"
        onClick={goToProfile}
        onMouseEnter={showUserTooltip}
        aria-label="Профиль"
      >
        <img src={avatar} alt="Профиль" className="avatar-image" />
        <div className="level-badge" title="До следующего уровня: 15 очков">🌟12</div>
      </div>
    </header>
  );
};

export default Header;
