import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGuest } from '../contexts/GuestContext';
import { useContentStore } from '../stores/contentStore';
import { useThemeStore } from '../stores/themeStore';
import { FaBell, FaNewspaper, FaUserPlus, FaSignInAlt, FaSun, FaMoon } from 'react-icons/fa';
import NotificationIcon from './Notifications/NotificationIcon';
import DynamicTitle from './DynamicTitle';

const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const guest = useGuest();
  const { user } = auth || { user: null };
  const isGuest = !user;
  const [activities] = React.useState<any[]>([]);
  const [postsCount] = React.useState<number>(0);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div 
      className="topbar-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '64px',
        zIndex: 1000
      }}
    >
      {/* Динамический заголовок над топбаром */}
      <DynamicTitle />
      
      {/* Верхняя панель - Glass-морфизм */}
      <div 
        className="h-[64px] flex items-center justify-between px-8" 
        style={{ 
          background: 'var(--glass-card-bg)',
          backdropFilter: 'var(--glass-blur-strong)',
          WebkitBackdropFilter: 'var(--glass-blur-strong)',
          borderBottom: 'none',
          boxShadow: 'var(--glass-shadow)',
          color: 'var(--glass-text)',
          width: '100%',
          height: '100%'
        }}
      >
        <div className="flex items-center">
          <div className="flex items-center mr-8">
            <i className="fas fa-compass text-2xl" style={{ color: 'var(--glass-text)' }}></i>
            <span className="ml-3 font-montserrat font-bold text-lg" style={{ color: 'var(--glass-text)' }}>
              ГеоБлог.рф
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          {/* Уведомления о модерации */}
          {user && <NotificationIcon />}
          
          {/* Лента активности */}
          <button 
            className="text-gray-600 hover:text-gray-800 transition-colors relative"
            onClick={() => {
              navigate('/activity');
            }}
            title="Лента активности"
            style={{ color: 'var(--glass-text)' }}
          >
            <FaBell className="text-xl" style={{ color: 'var(--glass-text)' }} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {activities?.length > 0 ? activities.length : 0}
            </span>
          </button>
          

          {/* Посты / обсуждения */}
          <button 
            className="text-gray-600 hover:text-gray-800 transition-colors relative"
            onClick={() => {
              navigate('/posts?posts=1');
            }}
            title="Посты и обсуждения"
            style={{ color: 'var(--glass-text)' }}
          >
            <FaNewspaper className="text-xl" style={{ color: 'var(--glass-text)' }} />
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full min-w-4 h-4 px-[2px] flex items-center justify-center">
              {postsCount > 99 ? '99+' : postsCount}
            </span>
          </button>

          {/* Переключатель темы light/dark */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
          >
            {theme === 'light' ? <FaMoon /> : <FaSun />}
          </button>

          {isGuest ? (
            <div className="flex items-center space-x-2">
              {/* Кнопка входа */}
              <button
                onClick={() => {
                  navigate('/login');
                }}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title="Войти в систему"
                style={{ color: 'var(--text-primary)' }}
              >
                <FaSignInAlt className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Войти</span>
              </button>
              
              {/* Кнопка регистрации */}
              <button
                onClick={() => {
                  navigate('/register');
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                title="Зарегистрироваться"
              >
                <FaUserPlus className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Регистрация</span>
              </button>
              
              {/* Индикатор гостевого контента */}
              {guest.hasGuestContent() && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Гость</span>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--glass-text)' }}
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <i className="fas fa-user text-lg" style={{ color: 'var(--glass-text)' }}></i>
                  )}
                </div>
                <span className="ml-3 font-medium" style={{ color: 'var(--glass-text)' }}>
                  {user.username}
                </span>
                <i className={`fas fa-chevron-down ml-2 text-xs transition-transform ${showUserMenu ? 'rotate-180' : ''}`}></i>
              </button>

              {/* Выпадающее меню пользователя */}
              {showUserMenu && (
                <>
                  {/* Overlay для закрытия меню при клике вне его */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg z-50" style={{ background: 'var(--glass-card-bg)', backdropFilter: 'var(--glass-blur-strong)', WebkitBackdropFilter: 'var(--glass-blur-strong)', border: '1px solid var(--glass-border-color)', boxShadow: 'var(--glass-shadow-container)', color: 'var(--glass-card-text)' }}>
                    {/* Информация о пользователе */}
                    <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border-color)' }}>
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {user?.avatar_url ? (
                            <img 
                              src={user.avatar_url} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <i className="fas fa-user text-xl"></i>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--glass-card-text)' }}>
                            {user?.username}
                          </p>
                          {user?.email && (
                            <p className="text-sm truncate" style={{ color: 'var(--glass-card-text-secondary)' }}>
                              {user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Меню действий */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          useContentStore.getState().setRightContent('profile');
                          setShowUserMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left transition-colors flex items-center topbar-dropdown-item"
                        style={{ color: 'var(--glass-card-text)' }}
                      >
                        <i className="fas fa-user-circle w-5 mr-3" style={{ color: 'var(--glass-card-text-muted)' }}></i>
                        Личный кабинет
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/login');
                        }}
                        className="w-full px-4 py-2 text-left transition-colors flex items-center topbar-dropdown-item"
                        style={{ color: 'var(--glass-card-text)' }}
                      >
                        <i className="fas fa-exchange-alt w-5 mr-3" style={{ color: 'var(--glass-card-text-muted)' }}></i>
                        Сменить аккаунт
                      </button>
                      
                      <div className="my-1" style={{ borderTop: '1px solid var(--glass-border-color)' }}></div>
                      
                      <button
                        onClick={() => {
                          auth?.logout();
                          setShowUserMenu(false);
                          window.location.href = '/';
                        }}
                        className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center"
                      >
                        <i className="fas fa-sign-out-alt w-5 mr-3"></i>
                        Выйти
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Topbar;

