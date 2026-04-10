import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore, ContentType } from '../stores/contentStore';
import { useAuth } from '../contexts/AuthContext';
import { useGuest } from '../contexts/GuestContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { logFrontend } from '../api/apiClient';
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
      { id: 'calendar', icon: 'fa-calendar', label: 'Календарь', type: 'right' },
    ],
  },
  {
    title: 'Общение',
    items: [
      { id: 'feed', icon: 'fa-stream', label: 'Лента', type: 'right' },
      { id: 'posts', icon: 'fa-newspaper', label: 'Посты', type: 'right' },
      { id: 'favorites', icon: 'fa-heart', label: 'Избранное', type: 'right' },
    ],
  },
  {
    title: 'Дополнительно',
    items: [
      { id: 'profile', icon: 'fa-user', label: 'Личный кабинет', type: 'right' },
      { id: 'pro', icon: 'fa-crown', label: 'PRO Аккаунт', type: 'page', path: '/pro' },
      { id: 'hub', icon: 'fa-globe', label: 'Маршрутный Хаб', type: 'page', path: '/hub' },
      { id: 'partners', icon: 'fa-handshake', label: 'Партнёры', type: 'page', path: '/partners' },
      { id: 'influence', icon: 'fa-users', label: 'Центр влияния', type: 'page', path: '/centre' },
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
  const favorites = useFavorites();
  const favoritesCount = favorites.getFavoritesStats ? favorites.getFavoritesStats().totalItems : 0;

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
    // diagnostic overlay removed - was only for temporary debugging

    // Определяем, был ли пользователь на solo-странице (центре/про/юридичке)
    // — тогда при переходе на любую страницу из двухоконного режима
    // нас интересует однопанельный режим.
    const isSoloPage = ['/centre', '/pro', '/partners', '/partner', '/admin', '/legal', '/profile']
      .some(p => location.pathname.startsWith(p));

    // ═══ КАЛЕНДАРЬ — всегда правая панель ═══
    // Без map/planner: календарь на весь экран с leaflet-фоном
    // С map/planner: календарь справа в dual mode
    if (item.id === 'calendar') {
      if (isSoloPage) {
        // Из solo — переходим на /map и открываем EventPanel справа
        store.setLeftContent('map');
        store.setRightContent('calendar');
        navigate('/map');
        setIsExpanded(false);
        return;
      }
      if (store.rightContent === 'calendar') {
        // Toggle off: возвращаем posts
        store.setRightContent('posts');
      } else {
        // Открываем календарь справа, левую панель не трогаем
        store.setRightContent('calendar');
      }
      setIsExpanded(false);
      return;
    }

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
          : `/${item.id}`;

      preloadRoute(leftRoute);

      // Определяем, был ли пользователь на solo-странице (центре/про/юридичке)
      // — в этом случае ожидаем, что переход на карту будет в полноэкранном режиме.
      const isSoloPage = ['/centre', '/pro', '/partner', '/admin', '/legal', '/profile']
        .some(p => location.pathname.startsWith(p));

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
        // Запоминаем, была ли уже активна левая панель (map/planner) в полноэкранном режиме
        const hadLeftPanel = store.leftContent === 'map' || store.leftContent === 'planner';

        // КРИТИЧНО: СНАЧАЛА меняем store, потом navigate
        store.setLeftContent(item.id as ContentType);

        // Если пришли с solo-страницы — открываем карту в полноэкранном режиме (без правой панели)
        if (isSoloPage) {
          store.setRightContent(null);
        } else if (!store.rightContent && !hadLeftPanel) {
          // Открываем посты ТОЛЬКО при первом открытии левой панели.
          // Если переключаемся между map↔planner и rightContent=null —
          // значит пользователь намеренно закрыл правую панель, уважаем это.
          store.setRightContent('posts');
        }

        // Навигация на соответствующий маршрут (после изменения store)
        if (location.pathname !== leftRoute) {
          setTimeout(() => navigate(leftRoute), 0);
        }
      }

      setIsExpanded(false);
      return;
    }

    if (item.type === 'right') {
      // Профиль — отдельная страница, не задействует панели
      if (item.id === 'profile') {
        preloadRoute('/profile');
        navigate('/profile');
        setIsExpanded(false);
        return;
      }

      // Разрешаем корректный переход из solo-страницы:
      // при перемещении с solo на правую панель надо сбрасывать левую панель
      // и перейти на соответствующий route.
      const routeForRightItem: Record<string, string> = {
        feed: '/activity',
        posts: '/posts',
        favorites: '/favorites',
      };

      if (isSoloPage) {
        store.setLeftContent(null);
        store.setRightContent(item.id as ContentType);
        const route = routeForRightItem[item.id];
        if (route) {
          preloadRoute(route);
          navigate(route);
        }
        setIsExpanded(false);
        return;
      }

      const isPostsRoute = location.pathname === '/' || location.pathname === '/posts';
      const isFeedRoute = location.pathname === '/activity';
      const isFavoritesRoute = location.pathname === '/favorites';

      const routeBasedActive =
        (item.id === 'posts' && isPostsRoute) ||
        (item.id === 'feed' && isFeedRoute) ||
        (item.id === 'favorites' && isFavoritesRoute);

      const isActive = store.rightContent === item.id || (routeBasedActive && !store.rightContent);

      // Тоггл: если панель активна — закрываем
      if (isActive) {
        // Позволяем закрывать любую правую панель даже в dual-mode.
        // Если карта/планировщик слева остались — они перейдут в полноэкранный режим.
        store.setRightContent(null);

        // Если мы открыты не в dual-mode — возвращаемся на главную
        const hasMapLeft = store.leftContent === 'map' || store.leftContent === 'planner';
        if (!hasMapLeft) {
          if (item.id === 'posts') {
            navigate('/');
          }
        }

        setIsExpanded(false);
        return;
      }

      // Активируем выбранную правую панель
      // КРИТИЧНО: НЕ трогаем leftContent! Если слева карта/планировщик — они остаются.
      // Это обеспечивает корректный dual-mode: map + posts, planner + favorites и т.д.
      store.setRightContent(item.id as ContentType);

      // Если слева нет map/planner и мы переходим на posts — обновляем URL
      const hasMapLeft = store.leftContent === 'map' || store.leftContent === 'planner';
      if (item.id === 'posts' && !hasMapLeft) {
        // Без карты слева — posts на весь экран, убираем calendar слева если был
        if (store.leftContent && store.leftContent !== 'map' && store.leftContent !== 'planner') {
          store.setLeftContent(null);
        }
        if (location.pathname !== '/' && location.pathname !== '/posts') {
          navigate('/posts');
        }
      }

      setIsExpanded(false);
      return;
    }
  };

  const isItemActive = (item: NavGroup['items'][0]) => {
    // Calendar — универсальный: может быть на любой стороне
    if (item.id === 'calendar') {
      return leftContent === 'calendar' || rightContent === 'calendar';
    }
    if (item.type === 'page') {
      return location.pathname === item.path;
    }
    if (item.type === 'left') {
      const isExactRoute =
        (item.id === 'planner' && location.pathname === '/planner') ||
        (item.id === 'map' && location.pathname === '/map');

      if (isExactRoute) {
        return true;
      }

      const isPanelOpen = leftContent === item.id;
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

  // Сайдбар показывается всегда - для навигации

  return (
    <>
      {/* Боковая панель в стиле Attack Map - вертикальный столбец с glass-эффектом, всегда видна */}
      <nav
        className="sidebar-attack-map"
        style={{
          position: 'fixed',
          left: 0,
          top: '64px',
          height: 'calc(100vh - 64px)',
          width: isExpanded ? '280px' : '50px',
          zIndex: 1200,
          pointerEvents: 'auto',
          background: 'var(--glass-card-bg)',
          backdropFilter: 'var(--glass-blur-strong)',
          WebkitBackdropFilter: 'var(--glass-blur-strong)',
          borderRight: 'none',
          transition: 'width 0.3s ease',
          overflow: 'visible',
          color: 'var(--glass-text)',
          boxShadow: 'var(--glass-shadow)'
        }}
        onClick={() => {
          // При клике на сайдбар - переключаем состояние
          if (!isExpanded) {
            setIsExpanded(true);
          }
        }}
      >
        {/* Иконки навигации - вертикальный столбец */}
        <div className="flex flex-col h-full py-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              {/* Заголовок группы - показывается только при раскрытии */}
              {isExpanded && (
                <div className="px-4 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--glass-text-secondary)' }}>
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
                            } else if (item.id === 'favorites') {
                              // Favorites загружается лениво
                            }
                          }
                        }}
                      >
                        {/* Иконка - всегда видна */}
                        <div style={{ position: 'relative' }}>
                          <i
                            className={`fas ${item.icon}`}
                            style={{
                              fontSize: '20px',
                              width: '26px',
                              textAlign: 'center',
                              color: active ? '#4cc9f0' : 'var(--glass-text)',
                              filter: active ? 'drop-shadow(0 0 4px rgba(76, 201, 240, 0.6))' : 'none'
                            }}
                          />
                          {/* Бейдж для избранного */}
                          {item.id === 'favorites' && favoritesCount > 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                left: '18px',
                                top: '-4px',
                                backgroundColor: '#ff4757',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                borderRadius: '50%',
                                minWidth: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 2px',
                                lineHeight: 1,
                                zIndex: 10,
                              }}
                            >
                              {favoritesCount > 99 ? '99+' : favoritesCount}
                            </span>
                          )}
                        </div>

                        {/* Название - показывается только при раскрытии */}
                        {isExpanded && (
                          <span
                            className="ml-3 whitespace-nowrap"
                            style={{
                              fontSize: '14px',
                              fontWeight: active ? 600 : 400,
                              opacity: 1,
                              transition: 'opacity 0.2s ease',
                              color: 'var(--glass-text)'
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
