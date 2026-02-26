import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, MapPin, Navigation, FileText, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFavorites } from '../../contexts/FavoritesContext';

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onClick: () => void;
  badge?: number;
}

interface ActionButtonsProps {
  onFavoritesClick?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onFavoritesClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const favorites = useFavorites();
  
  const favoritesCount = (favorites?.favoritePlaces?.length || 0) + 
                        (favorites?.favoriteRoutes?.length || 0) + 
                        (favorites?.favoriteEvents?.length || 0);

  // Определяем кнопки в зависимости от текущей страницы
  const getActionsForPage = (): ActionButton[] => {
    const path = location.pathname;

    if (path === '/posts' || path === '/') {
      return [
        {
          id: 'create-post',
          label: 'Создать пост',
          icon: <FileText className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          onClick: () => {
            navigate('/posts?create=true');
          },
        },
        {
          id: 'new-event',
          label: 'Новое событие',
          icon: <Calendar className="w-5 h-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          onClick: () => navigate('/calendar'),
        },
        {
          id: 'add-marker',
          label: 'Добавить метку',
          icon: <MapPin className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          onClick: () => navigate('/map?addMarker=true'),
        },
        {
          id: 'create-route',
          label: 'Создать маршрут',
          icon: <Navigation className="w-5 h-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          onClick: () => navigate('/planner?newRoute=true'),
        },
        {
          id: 'favorites',
          label: 'Избранное',
          icon: <Star className="w-5 h-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          onClick: () => onFavoritesClick?.(),
          badge: favoritesCount > 0 ? favoritesCount : undefined,
        },
      ];
    }

    if (path === '/map') {
      return [
        {
          id: 'add-marker',
          label: 'Добавить метку',
          icon: <MapPin className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          onClick: () => navigate('/map?addMarker=true'),
        },
        {
          id: 'create-route',
          label: 'Создать маршрут',
          icon: <Navigation className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          onClick: () => navigate('/planner?newRoute=true'),
        },
        {
          id: 'new-event',
          label: 'Новое событие',
          icon: <Calendar className="w-5 h-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          onClick: () => navigate('/calendar'),
        },
        {
          id: 'create-post',
          label: 'Создать пост',
          icon: <FileText className="w-5 h-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          onClick: () => navigate('/posts?create=true'),
        },
        {
          id: 'favorites',
          label: 'Избранное',
          icon: <Star className="w-5 h-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          onClick: () => onFavoritesClick?.(),
          badge: favoritesCount > 0 ? favoritesCount : undefined,
        },
      ];
    }

    if (path === '/planner') {
      return [
        {
          id: 'new-route',
          label: 'Новый маршрут',
          icon: <Navigation className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          onClick: () => navigate('/planner?newRoute=true'),
        },
        {
          id: 'add-marker',
          label: 'Добавить метку',
          icon: <MapPin className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          onClick: () => navigate('/map?addMarker=true'),
        },
        {
          id: 'new-event',
          label: 'Новое событие',
          icon: <Calendar className="w-5 h-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          onClick: () => navigate('/calendar'),
        },
        {
          id: 'create-post',
          label: 'Создать пост',
          icon: <FileText className="w-5 h-5" />,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          onClick: () => navigate('/posts?create=true'),
        },
        {
          id: 'favorites',
          label: 'Избранное',
          icon: <Star className="w-5 h-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          onClick: () => onFavoritesClick?.(),
          badge: favoritesCount > 0 ? favoritesCount : undefined,
        },
      ];
    }

    // По умолчанию для других страниц
    return [
      {
        id: 'create-post',
        label: 'Создать пост',
        icon: <FileText className="w-5 h-5" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        onClick: () => navigate('/posts?create=true'),
      },
      {
        id: 'new-event',
        label: 'Новое событие',
        icon: <Calendar className="w-5 h-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        onClick: () => navigate('/calendar'),
      },
      {
        id: 'add-marker',
        label: 'Добавить метку',
        icon: <MapPin className="w-5 h-5" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        onClick: () => navigate('/map?addMarker=true'),
      },
      {
        id: 'create-route',
        label: 'Создать маршрут',
        icon: <Navigation className="w-5 h-5" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        onClick: () => navigate('/planner?newRoute=true'),
      },
      {
        id: 'favorites',
        label: 'Избранное',
        icon: <Star className={cn("w-5 h-5", favoritesCount > 0 && "fill-yellow-500 text-yellow-500")} />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        onClick: () => onFavoritesClick?.(),
        badge: favoritesCount > 0 ? favoritesCount : undefined,
      },
    ];
  };

  const actions = getActionsForPage();

  return (
    <div className="px-4 py-3 m-glass-actions">
      <div className="flex justify-between items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={cn(
              "m-glass-btn",
              "transition-all duration-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2",
              "min-w-[70px] max-w-[70px] h-[70px] relative"
            )}
            title={action.label}
          >
            <div className="relative">
              <div className="m-glass-icon">
                {React.cloneElement(action.icon as React.ReactElement, {
                  className: "w-5 h-5 m-glass-icon"
                })}
              </div>
              {action.badge && action.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 m-glass-badge text-[9px] rounded-full flex items-center justify-center font-bold">
                  {action.badge > 99 ? '99+' : action.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-tight text-center m-glass-text">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionButtons;

