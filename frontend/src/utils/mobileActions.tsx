import { NavigateFunction } from 'react-router-dom';
import { ReactNode } from 'react';
import { Calendar, MapPin, Navigation, FilePlus2, Star } from 'lucide-react';
import AddLocationIcon from '@mui/icons-material/AddLocation';
// minimal shape of favorites used in actions
interface MobileFavorites {
  favoritePlaces?: Array<any>;
  favoriteRoutes?: Array<any>;
  favoriteEvents?: Array<any>;
}

export interface MobileAction {
  id: string;
  label?: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: number;
}

interface GetActionsOpts {
  pathname: string;
  navigate: NavigateFunction;
  favorites?: MobileFavorites | null;
  onFavoritesClick?: () => void;
}

export function getMobileActions({ pathname, navigate, favorites, onFavoritesClick }: GetActionsOpts): MobileAction[] {
  // favorites count kept separately, but favorites button is rendered by TopBar
  const favoritesCount = (favorites?.favoritePlaces?.length || 0) +
                        (favorites?.favoriteRoutes?.length || 0) +
                        (favorites?.favoriteEvents?.length || 0);

  // helper wrapper for actions that should open favorites panel too
  const wrapWithFavorites = (fn: () => void) => {
    return () => {
      if (onFavoritesClick) onFavoritesClick();
      fn();
    };
  };

  // page-specific logic: show only the most relevant primary action
  if (pathname === '/posts' || pathname === '/' || pathname === '/home') {
    return [
      {
        id: 'create-post',
        label: 'Добавить пост',
        icon: <FilePlus2 className="w-5 h-5" />,
        onClick: () => navigate(`${pathname}?create=true`),
      },
    ];
  }

  if (pathname === '/map') {
    return [
      {
        id: 'add-marker',
        label: 'Добавить',
        icon: <AddLocationIcon className="w-5 h-5" />,
        onClick: () => navigate('/map?addSelector=true'),
      },
    ];
  }

  if (pathname === '/planner') {
    return [
      {
        id: 'new-route',
        icon: <Navigation className="w-5 h-5" />,
        onClick: () => navigate('/planner?newRoute=true'),
      },
    ];
  }

  if (pathname === '/calendar' || pathname === '/map') {
    // На календаре не показываем дополнительные action-кнопки, только основную панель и иконку темы
    return [];
  }

  // default fallback (e.g. centre or other pages) - show ProPage button
  return [
    {
      id: 'pro',
      icon: <Star className="w-5 h-5" />, // temporarily reuse star or replace with crown
      onClick: () => navigate('/pro'),
    },
  ];
}
