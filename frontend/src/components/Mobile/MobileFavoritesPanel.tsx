import React, { useState } from 'react';
import { X, Star, MapPin, Navigation, Calendar, FileText } from 'lucide-react';
import { useFavorites } from '../../contexts/FavoritesContext';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

interface MobileFavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileFavoritesPanel: React.FC<MobileFavoritesPanelProps> = ({ isOpen, onClose }) => {
  const favorites = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'places' | 'routes' | 'events' | 'posts'>('places');

  const favoritePlaces = favorites?.favoritePlaces || [];
  const favoriteRoutes = favorites?.favoriteRoutes || [];
  const favoriteEvents = favorites?.favoriteEvents || [];
  // favoritePosts пока нет в контексте, используем пустой массив
  const favoritePosts: any[] = [];

  const getTotalCount = () => {
    return favoritePlaces.length + favoriteRoutes.length + favoriteEvents.length + favoritePosts.length;
  };

  const handleItemClick = (type: 'place' | 'route' | 'event' | 'post', id: string) => {
    const currentPath = location.pathname;
    
    switch (type) {
      case 'place':
        // Если мы на /planner или /map, остаёмся на текущей странице и добавляем параметр marker
        if (currentPath === '/planner' || currentPath === '/map') {
          const params = new URLSearchParams(location.search);
          params.set('marker', id);
          navigate(`${currentPath}?${params.toString()}`);
        } else {
          // Иначе переходим на /map
          navigate(`/map?marker=${id}`);
        }
        break;
      case 'route':
        // Если мы на /planner, остаёмся на текущей странице
        if (currentPath === '/planner') {
          const params = new URLSearchParams(location.search);
          params.set('route', id);
          navigate(`${currentPath}?${params.toString()}`);
        } else {
          navigate(`/planner?route=${id}`);
        }
        break;
      case 'event':
        navigate(`/calendar?event=${id}`);
        break;
      case 'post':
        navigate(`/posts/${id}`);
        break;
    }
    onClose();
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      onClick={onClose}
    >
      <Card
        className={cn(
          "fixed left-0 right-0 bottom-0 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto max-h-[70vh] rounded-t-2xl",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {/* Header - компактный */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-base font-semibold text-gray-800">Избранное</h2>
              {getTotalCount() > 0 && (
                <Badge className="bg-yellow-500 text-white text-xs">{getTotalCount()}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-gray-600 hover:text-gray-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs - в стиле ActionButtons */}
          <div className="flex gap-2 p-3 border-b border-gray-200">
            <button
              className={cn(
                "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
                "bg-gray-100 text-gray-800 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200",
                activeTab === 'places' && "bg-gray-200 border-gray-300 shadow-lg"
              )}
              onClick={() => setActiveTab('places')}
            >
              <MapPin className="inline-block w-4 h-4 mr-1 text-gray-800" />
              <span className="text-gray-800">Места</span>
              {favoritePlaces.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                  {favoritePlaces.length > 99 ? '99+' : favoritePlaces.length}
                </Badge>
              )}
            </button>
            <button
              className={cn(
                "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
                "bg-gray-100 text-gray-800 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200",
                activeTab === 'routes' && "bg-gray-200 border-gray-300 shadow-lg"
              )}
              onClick={() => setActiveTab('routes')}
            >
              <Navigation className="inline-block w-4 h-4 mr-1 text-gray-800" />
              <span className="text-gray-800">Маршруты</span>
              {favoriteRoutes.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                  {favoriteRoutes.length > 99 ? '99+' : favoriteRoutes.length}
                </Badge>
              )}
            </button>
            <button
              className={cn(
                "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
                "bg-gray-100 text-gray-800 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200",
                activeTab === 'events' && "bg-gray-200 border-gray-300 shadow-lg"
              )}
              onClick={() => setActiveTab('events')}
            >
              <Calendar className="inline-block w-4 h-4 mr-1 text-gray-800" />
              <span className="text-gray-800">События</span>
              {favoriteEvents.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                  {favoriteEvents.length > 99 ? '99+' : favoriteEvents.length}
                </Badge>
              )}
            </button>
            <button
              className={cn(
                "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
                "bg-gray-100 text-gray-800 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200",
                activeTab === 'posts' && "bg-gray-200 border-gray-300 shadow-lg"
              )}
              onClick={() => setActiveTab('posts')}
            >
              <FileText className="inline-block w-4 h-4 mr-1 text-gray-800" />
              <span className="text-gray-800">Посты</span>
              {favoritePosts.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                  {favoritePosts.length > 99 ? '99+' : favoritePosts.length}
                </Badge>
              )}
            </button>
          </div>

          {/* Content - компактный список */}
          <div className="flex-1 p-3 overflow-y-auto">
            {activeTab === 'places' && (
              <div className="space-y-2">
                {favoritePlaces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Нет избранных мест</p>
                  </div>
                ) : (
                  favoritePlaces.map((place) => (
                    <Card
                      key={place.id}
                      className="p-3 cursor-pointer bg-gray-100 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200 transition-all duration-300 rounded-xl active:scale-95"
                      onClick={() => handleItemClick('place', place.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <MapPin className="w-4 h-4 text-gray-800" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate text-gray-800">{place.name || 'Место'}</h3>
                          {place.location && (
                            <p className="text-xs text-gray-600 truncate">{place.location}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === 'routes' && (
              <div className="space-y-2">
                {favoriteRoutes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Navigation className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Нет избранных маршрутов</p>
                  </div>
                ) : (
                  favoriteRoutes.map((route) => (
                    <Card
                      key={route.id}
                      className="p-3 cursor-pointer bg-gray-100 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200 transition-all duration-300 rounded-xl active:scale-95"
                      onClick={() => handleItemClick('route', route.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <Navigation className="w-4 h-4 text-gray-800" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate text-gray-800">{route.title || 'Маршрут'}</h3>
                          {route.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">{route.description}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-2">
                {favoriteEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Нет избранных событий</p>
                  </div>
                ) : (
                  favoriteEvents.map((event) => (
                    <Card
                      key={event.id}
                      className="p-3 cursor-pointer bg-gray-100 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200 transition-all duration-300 rounded-xl active:scale-95"
                      onClick={() => handleItemClick('event', event.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <Calendar className="w-4 h-4 text-gray-800" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate text-gray-800">{event.title || 'Событие'}</h3>
                          {event.date && (
                            <p className="text-xs text-gray-600">
                              {new Date(event.date).toLocaleDateString('ru-RU')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-2">
                {favoritePosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Нет избранных постов</p>
                  </div>
                ) : (
                  favoritePosts.map((post: any) => (
                    <Card
                      key={post.id}
                      className="p-3 cursor-pointer bg-gray-100 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-200 transition-all duration-300 rounded-xl active:scale-95"
                      onClick={() => handleItemClick('post', post.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <FileText className="w-4 h-4 text-gray-800" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate text-gray-800">{post.title || 'Пост'}</h3>
                          {post.body && (
                            <p className="text-xs text-gray-600 line-clamp-2">{post.body}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MobileFavoritesPanel;

