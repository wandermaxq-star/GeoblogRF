import { Bell, Search, HelpCircle, Settings, Star, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  showSearch?: boolean;
  showHelp?: boolean;
  showSettings?: boolean;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  onFavoritesClick?: () => void;
}

const TopBar = ({ 
  title, 
  showSearch = false, 
  showHelp = true,
  showSettings = false,
  onSearchClick,
  onHelpClick,
  onSettingsClick,
  onFavoritesClick
}: TopBarProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const favorites = useFavorites();
  const { theme, toggleTheme } = useThemeStore();
  
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
    <header className="sticky top-0 z-40 m-glass-topbar" style={{ pointerEvents: 'auto' }}>
      <div className="flex items-center justify-between h-nav px-4">
        <h1 className="text-lg font-bold m-glass-text">{title}</h1>

                <div className="flex items-center gap-2">
                  {/* Кнопка переключения темы */}
                  <button
                    className="m-theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </button>
                  {showSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onSearchClick}
                      className="m-glass-text-secondary hover:m-glass-text"
                    >
                      <Search className="w-5 h-5" />
                    </Button>
                  )}
                  {showSettings && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onSettingsClick}
                      className="m-glass-text-secondary hover:m-glass-text"
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  )}
                  {showHelp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onHelpClick}
                      className="m-glass-text-secondary hover:m-glass-text"
                    >
                      <HelpCircle className="w-5 h-5" />
                    </Button>
                  )}
                  {/* Кнопка избранного - всегда видна */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onFavoritesClick}
                    className="m-glass-text-secondary hover:m-glass-text relative"
                  >
                    <Star className={cn("w-5 h-5", favoritesCount > 0 && "fill-yellow-500 text-yellow-500")} />
                    {favoritesCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 m-glass-badge text-[10px] rounded-full flex items-center justify-center">
                        {favoritesCount > 99 ? '99+' : favoritesCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="m-glass-text-secondary hover:m-glass-text relative"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 m-glass-badge rounded-full"></span>
                  </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="m-glass-text-secondary hover:m-glass-text p-0"
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

