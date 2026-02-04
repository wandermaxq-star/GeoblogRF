import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore, ContentType } from '../stores/contentStore';
import { useAuth } from '../contexts/AuthContext';
import { useGuest } from '../contexts/GuestContext';
import { logFrontend } from '../api/apiClient';
import ProfilePanel from './ProfilePanel';
import AuthGate from './AuthGate';
import { FaBell, FaNewspaper, FaUserPlus, FaSignInAlt } from 'react-icons/fa';
import { usePreload } from '../hooks/usePreload';
import NotificationIcon from './Notifications/NotificationIcon';
import DynamicTitle from './DynamicTitle';

interface NavGroup {
  title: string;
  items: {
    id: string;
    icon: string;
    label: string;
    type: 'left' | 'right' | 'page';
    path?: string;
    adminOnly?: boolean;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Навигация',
    items: [
      { id: 'map', icon: 'fa-map-location-dot', label: 'Карта', type: 'left' },
      { id: 'planner', icon: 'fa-route', label: 'Планировщик', type: 'left' },
      { id: 'calendar', icon: 'fa-calendar', label: 'Календарь', type: 'left' },
    ],
  },
  {
    title: 'Общение',
    items: [
      { id: 'feed', icon: 'fa-stream', label: 'Лента', type: 'right' },
      { id: 'posts', icon: 'fa-newspaper', label: 'Посты', type: 'right' },
      { id: 'test', icon: 'fa-flask', label: 'Тест', type: 'page', path: '/test' },
    ],
  },
  {
    title: 'Дополнительно',
    items: [
      { id: 'profile', icon: 'fa-user', label: 'Личный кабинет', type: 'right' },
      { id: 'pro', icon: 'fa-crown', label: 'PRO Аккаунт', type: 'page', path: '/pro' },
      { id: 'influence', icon: 'fa-users', label: 'Центр влияния', type: 'page', path: '/centre' },
      { id: 'partners', icon: 'fa-handshake', label: 'Партнёры', type: 'page', path: '/partners' },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      { id: 'admin', icon: 'fa-gauge', label: 'Админ‑панель', type: 'page', path: '/admin', adminOnly: true },
      { id: 'user-agreement', icon: 'fa-file-contract', label: 'Пользовательское соглашение', type: 'page', path: '/legal/user-agreement' },
      { id: 'privacy-policy', icon: 'fa-lock', label: 'Политика конфиденциальности', type: 'page', path: '/legal/privacy-policy' },
      { id: 'analytics', icon: 'fa-chart-line', label: 'Аналитика', type: 'page', path: '/analytics', adminOnly: true },
    ],
  },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const layoutContext = useLayoutState();
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);

  const auth = useAuth();
  const guest = useGuest();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateType, setAuthGateType] = useState<'marker' | 'route' | 'event' | 'post'>('marker');
  const [isExpanded, setIsExpanded] = useState(false);
  const { preloadRoute } = usePreload();

  // Автоматически закрываем сайдбар при выборе элемента
  useEffect(() => {
    if (leftContent || rightContent) {
      setIsExpanded(false);
    }
  }, [leftContent, rightContent]);

  const handleItemClick = (item: NavGroup['items'][0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const store = useContentStore.getState();
    // Временная визуальная подсказка для диагностики (не оставляет консольные логи)
    try {
      const overlayId = 'diag-sidebar-overlay';
      let overlay = document.getElementById(overlayId);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        document.body.appendChild(overlay);
      }
      overlay.style.position = 'fixed';
      overlay.style.right = '12px';
      overlay.style.top = '76px';
      overlay.style.zIndex = '99999';
      overlay.style.background = 'rgba(0,0,0,0.7)';
      overlay.style.color = 'white';
      overlay.style.padding = '8px 12px';
      overlay.style.borderRadius = '8px';
      overlay.style.fontSize = '13px';
      overlay.style.fontFamily = 'sans-serif';
      overlay.style.pointerEvents = 'none';
      overlay.textContent = `path=${location.pathname} | left=${store.leftContent} | right=${store.rightContent} | click=${item.id}`;
      setTimeout(() => { try { overlay?.remove(); } catch (_) { } }, 5000);
    } catch (e) { }
    // click handled

    if (item.type === 'page') {
      if (item.path) {
        preloadRoute(item.path);
        navigate(item.path);
      }
      setIsExpanded(false);
      return;
    }

    if (item.type === 'left') {
      const leftRoute = item.id === 'map' ? '/map'
        : item.id === 'planner' ? '/planner'
          : item.id === 'calendar' ? '/calendar'
            : `/${item.id}`;

      preloadRoute(leftRoute);

      // Проверяем, является ли текущая левая панель той же самой
      const isCurrentlyActive = store.leftContent === item.id;

      if (isCurrentlyActive) {
        // ЗАКРЫВАЕМ левую панель - переключаем на полноэкранный режим правой панели
        store.setLeftContent(null);
        // Переходим на главную страницу или посты
        if (store.rightContent === 'posts' || !store.rightContent) {
          navigate('/');
        }
      } else {
        // КРИТИЧНО: СНАЧАЛА меняем store, потом navigate
        // Это гарантирует что MainLayout увидит уже установленный leftContent
        // и не будет его перезаписывать
        store.setLeftContent(item.id as ContentType);
        if (!store.rightContent) {
          store.setRightContent('posts');
        }

        // Навигация на соответствующий маршрут (после изменения store)
        if (location.pathname !== leftRoute) {
          // Используем setTimeout чтобы store успел обновиться до реакции MainLayout
          setTimeout(() => navigate(leftRoute), 0);
        }
      }

      setIsExpanded(false);
      return;
    }

    if (item.type === 'right') {
      if (item.id === 'posts') {
        preloadRoute('/posts');
      }

      // Проверяем, закрываем ли мы панель (она уже активна)
      const isCurrentlyActive = store.rightContent === item.id;

      if (isCurrentlyActive) {
        // Закрываем правую панель
        store.setRightContent(null);
        // Если есть левая панель (карта/планировщик), она останется на полный экран
        // Если нет левой панели, открываем посты
        if (!store.leftContent) {
          store.setRightContent('posts');
        }
      } else {
        // Открываем правую панель
        store.setRightContent(item.id as ContentType);

        if (item.id === 'posts' && location.pathname !== '/' && location.pathname !== '/posts') {
          navigate('/posts');
        }
      }

      setIsExpanded(false);
      return;
    }
  };

  const isItemActive = (item: NavGroup['items'][0]) => {
    if (item.type === 'page') {
      return location.pathname === item.path;
    }
    if (item.type === 'left') {
      const isExactRoute =
        (item.id === 'planner' && location.pathname === '/planner') ||
        (item.id === 'map' && location.pathname === '/map') ||
        (item.id === 'calendar' && location.pathname === '/calendar');

      if (isExactRoute) {
        return true;
      }

      const isPanelOpen = leftContent === item.id || (item.id === 'calendar' && (leftContent === 'calendar' || rightContent === 'calendar'));
      return isPanelOpen;
    }
    if (item.type === 'right') {
      if (item.id === 'posts') {
        if (location.pathname === '/' || location.pathname === '/posts') {
          return true;
        }
        return rightContent === item.id;
      }
      return rightContent === item.id;
    }
    return false;
  };

  const handleCloseProfile = () => {
    const store = useContentStore.getState();
    store.setRightContent(null);
  };

  // Сайдбар показывается всегда - для навигации

  return (
    <>
      {/* Боковая панель в стиле Attack Map - вертикальный столбец с glass-эффектом, всегда видна */}
      <nav
        className="sidebar-attack-map"
        style={{
          position: 'fixed', // Фиксированная позиция - всегда видна
          left: 0,
          top: '64px', // Под Topbar (64px высота)
          height: 'calc(100vh - 64px)', // На всю высоту экрана минус Topbar
          width: isExpanded ? '280px' : '50px', // Свернутый: 50px, развернутый: 280px
          zIndex: 1150,
          background: 'rgba(255, 255, 255, 0.15)', // Более прозрачный
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: 'none', // Убираем границу справа - нет разделения с Topbar
          transition: 'width 0.3s ease',
          overflow: 'visible',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}
        onClick={() => {
          // При клике на сайдбар - переключаем состояние
          if (!isExpanded) {
            setIsExpanded(true);
          }
        }}
      >
        {/* Иконки навигации - вертикальный столбец */}
        <div className="flex flex-col h-full py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              {/* Заголовок группы - показывается только при раскрытии */}
              {isExpanded && (
                <div className="px-4 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#000000' }}>
                    {group.title}
                  </span>
                </div>
              )}

              {/* Элементы группы */}
              <div className="space-y-1">
                {group.items
                  .filter((item) => {
                    if (item.adminOnly && (!auth?.user || auth.user.role !== 'admin')) {
                      return false;
                    }
                    return true;
                  })
                  .map((item) => {
                    const active = isItemActive(item);

                    return (
                      <button
                        key={item.id}
                        onClick={(e) => handleItemClick(item, e)}
                        className="w-full flex items-center transition-all duration-200"
                        style={{
                          padding: '12px',
                          paddingLeft: isExpanded ? '16px' : '12px',
                          backgroundColor: active ? 'rgba(76, 201, 240, 0.2)' : 'transparent',
                          color: active ? 'var(--text-accent)' : 'var(--text-primary)',
                          borderLeft: active ? '3px solid var(--text-accent)' : '3px solid transparent',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          // Предзагружаем при наведении
                          if (item.type === 'page' && item.path) {
                            preloadRoute(item.path);
                          } else if (item.type === 'left') {
                            const leftRoute = item.id === 'map' ? '/map'
                              : item.id === 'planner' ? '/planner'
                                : `/${item.id}`;
                            preloadRoute(leftRoute);
                          } else if (item.type === 'right') {
                            if (item.id === 'posts') {
                              // Posts уже загружен
                            } else if (item.id === 'feed') {
                              preloadRoute('/activity');
                            }
                          }
                        }}
                      >
                        {/* Иконка - всегда видна, черная */}
                        <i
                          className={`fas ${item.icon}`}
                          style={{
                            fontSize: '20px',
                            width: '26px',
                            textAlign: 'center',
                            color: active ? '#4cc9f0' : '#000000', // Черные иконки, активная - голубая
                            filter: active ? 'drop-shadow(0 0 4px rgba(76, 201, 240, 0.6))' : 'none'
                          }}
                        />

                        {/* Название - показывается только при раскрытии, черное */}
                        {isExpanded && (
                          <span
                            className="ml-3 whitespace-nowrap"
                            style={{
                              fontSize: '14px',
                              fontWeight: active ? 600 : 400,
                              opacity: 1,
                              transition: 'opacity 0.2s ease',
                              color: '#000000' // Черный текст
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Profile Panel */}
      {rightContent === 'profile' && (
        <ProfilePanel onClose={handleCloseProfile} />
      )}

      {/* AuthGate */}
      <AuthGate
        isOpen={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        contentType={authGateType}
      />
    </>
  );
};

export default Sidebar;
