import { Bell, Search, HelpCircle, Settings, Star, Sun, Moon, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { MobileAction } from "@/utils/mobileActions";

interface TopBarProps {
  title: string;
  showSearch?: boolean;
  showHelp?: boolean;
  showSettings?: boolean;
  showNotifications?: boolean;
  showFavorites?: boolean;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  onFavoritesClick?: () => void;
  onNotificationClick?: () => void;
  actions?: MobileAction[]; // dynamic action buttons (usually 0-3 items)
}

const TopBar = ({ 
  title, 
  showSearch = false, 
  showHelp = true,
  showSettings = false,
  showNotifications = false,
  showFavorites = false,
  onSearchClick,
  onHelpClick,
  onSettingsClick,
  onFavoritesClick,
  onNotificationClick,
  actions = []
}: TopBarProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const favorites = useFavorites();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const isMapPath = ['/map','/planner','/calendar','/posts','/activity'].some(p => location.pathname.startsWith(p));
  
  const favoritesCount = (favorites?.favoritePlaces?.length || 0) + 
                        (favorites?.favoriteRoutes?.length || 0) + 
                        (favorites?.favoriteEvents?.length || 0);

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="sticky top-0 z-40 m-glass-topbar" style={{ pointerEvents: 'auto', zIndex: 2000 }}>
      <div className="flex items-center justify-between h-nav px-4">
        <h1 className="text-lg font-bold truncate m-glass-text flex-1 min-w-0">{title}</h1>

        <div className="flex items-center justify-end gap-3">
          {/* группа иконок между заголовком и профилем */}
          <div className="flex items-center m-topbar-action-group">
            {/* динамические кнопки действий */}
            {actions && actions.map(action => (
              <Button
                key={action.id}
                variant="ghost"
                size="icon"
                onClick={action.onClick}
                title={action.label || action.id}
                aria-label={action.label || action.id}
                className={cn(
                  "m-topbar-icon-btn relative",
                  action.id === "add-marker" && "m-topbar-icon-btn--add-marker",
                )}
              >
              {action.icon}
              {action.badge && (
                <span className="absolute top-1 right-1 w-4 h-4 m-glass-badge text-[10px] rounded-full flex items-center justify-center">
                  {action.badge > 99 ? '99+' : action.badge}
                </span>
              )}
            </Button>
          ))}
          </div>
          {/* Тема: солнце / полумесяц */}
          <button
            className="m-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'light' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSearchClick}
              className="m-topbar-icon-btn"
            >
              <Search className="w-4.5 h-4.5" />
            </Button>
          )}
          {showSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettingsClick}
              className="m-topbar-icon-btn"
            >
              <Settings className="w-4.5 h-4.5" />
            </Button>
          )}
          {showHelp && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onHelpClick}
              className="m-topbar-icon-btn"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </Button>
          )}
          {showNotifications && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNotificationClick}
              className="m-topbar-icon-btn relative"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1 right-1 w-2 h-2 m-glass-badge rounded-full"></span>
            </Button>
          )}
          {showFavorites && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onFavoritesClick}
              className="m-topbar-icon-btn relative"
            >
              <Star className={cn("w-4.5 h-4.5", favoritesCount > 0 && "fill-yellow-500 text-yellow-500")} />
              {favoritesCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 m-glass-badge text-[10px] rounded-full flex items-center justify-center">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* профиль всегда справа */}
        <div className="flex-shrink-0 ml-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="m-glass-btn m-glass-text-secondary hover:m-glass-text p-0"
          >
            <Avatar className="w-8 h-8 border-2 border-white/30">
              <AvatarImage src={user?.avatar_url} alt={user?.username || 'Profile'} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;

