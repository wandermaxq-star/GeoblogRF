import React, { useState, useEffect } from 'react';
import { X, Star, MapPin, Navigation, Calendar, FileText, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import MobileSlidePanel from './MobileSlidePanel';
import { useFavoritesPanel } from '../../hooks/useFavoritesPanel';
import { useAuth } from '../../contexts/AuthContext';
import { getRoutes } from '../../api/routes';
import { RouteData } from '../../types/route';

interface MobileFavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkerToggle?: (place: any, checked: boolean) => void;
  allowBackgroundInteraction?: boolean;
}

const MobileFavoritesPanel: React.FC<MobileFavoritesPanelProps> = ({ isOpen, onClose, onMarkerToggle, allowBackgroundInteraction }) => {
  // Используем глобальное тема-управление (data-theme) через CSS классы
  // Удаляем отдельные inline-стили и ручные цвета.

  const {
    favorites,
    favoritePlaces,
    favoriteRoutes: localFavoriteRoutes,
    favoriteEvents,
    favoritePosts,
    selectedMarkerIds,
    setSelectedMarkerIds,
    selectedRouteIds,
    setSelectedRouteIds,
    selectedEventIds,
    getTotalCount,
    handleItemClick,
    markerToggle,
    routeToggle,
    eventToggle,
  } = useFavoritesPanel({ onMarkerToggle });

  // Загружаем маршруты с бэкенда (как в десктопном Favorites.tsx)
  // чтобы мобильная панель и десктоп показывали одни и те же данные
  const authContext = useAuth();
  const token = authContext?.token;
  const [apiRoutes, setApiRoutes] = useState<RouteData[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    getRoutes(token || undefined).then((loaded) => {
      if (loaded && loaded.length > 0) {
        setApiRoutes(loaded);
      } else {
        setApiRoutes(localFavoriteRoutes);
      }
    }).catch(() => {
      setApiRoutes(localFavoriteRoutes);
    });
  }, [isOpen, token]);

  // Маршруты: приоритет API, fallback — локальные из IndexedDB
  const favoriteRoutes = apiRoutes.length > 0 ? apiRoutes : localFavoriteRoutes;

  const [activeTab, setActiveTab] = useState<'places' | 'routes' | 'events' | 'posts'>('places');

  const handleItemClickWrapped = (type: 'place' | 'route' | 'event' | 'post', id: string) => {
    handleItemClick(type, id);
    onClose();
  };

  // Стилизованные компоненты с inline-стилями
  const GlassCard: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }> = ({ children, onClick, className }) => (
    <div
      onClick={onClick}
      className={cn(
        'favorites-card', // переиспользуем desktop класс
        className
      )}
    >
      {children}
    </div>
  );

  const GlassButton: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    active?: boolean;
  }> = ({ children, onClick, className, active }) => (
    <button
      onClick={onClick}
      className={cn(
        'favorites-tab',
        active && 'active',
        className
      )}
      type="button"
    >
      {children}
    </button>
  );

  const GlassBadge: React.FC<{
    children: React.ReactNode;
    className?: string;
  }> = ({ children, className }) => (
    <span className={cn('favorites-count', className)}>
      {children}
    </span>
  );

  return (
    <MobileSlidePanel isOpen={isOpen} onClose={onClose} allowBackgroundInteraction={allowBackgroundInteraction} cardClassName="favorites-accordion"> 
      <div className="favorites-wrapper h-full">
        {/* Header */}
        <div className="favorites-header">

          <div className="favorites-title">
            <Star className="w-5 h-5" />
            <h2 className="favorites-main-title">Избранное</h2>
            {getTotalCount() > 0 && (
              <GlassBadge>{getTotalCount()}</GlassBadge>
            )}
          </div>
          <button
            onClick={onClose}
            className="favorites-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="favorites-tabs">
          <GlassButton
            className={cn(
              "favorites-tab",
              activeTab === 'places' && "active"
            )}
            onClick={() => setActiveTab('places')}
            active={activeTab === 'places'}
          >
            <MapPin className="inline-block w-4 h-4 mr-1" />
            <span>Места</span>
            {favoritePlaces.length > 0 && (
              <GlassBadge className="absolute -top-1 -right-1 text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                {favoritePlaces.length > 99 ? '99+' : favoritePlaces.length}
              </GlassBadge>
            )}
          </GlassButton>

          <GlassButton
            className={cn(
              "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
              activeTab === 'routes' && "active"
            )}
            onClick={() => setActiveTab('routes')}
            active={activeTab === 'routes'}
          >
            <Navigation className="inline-block w-4 h-4 mr-1" />
            <span>Маршруты</span>
            {favoriteRoutes.length > 0 && (
              <GlassBadge className="absolute -top-1 -right-1 text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                {favoriteRoutes.length > 99 ? '99+' : favoriteRoutes.length}
              </GlassBadge>
            )}
          </GlassButton>

          <GlassButton
            className={cn(
              "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
              activeTab === 'events' && "active"
            )}
            onClick={() => setActiveTab('events')}
            active={activeTab === 'events'}
          >
            <Calendar className="inline-block w-4 h-4 mr-1" />
            <span>События</span>
            {favoriteEvents.length > 0 && (
              <GlassBadge className="absolute -top-1 -right-1 text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                {favoriteEvents.length > 99 ? '99+' : favoriteEvents.length}
              </GlassBadge>
            )}
          </GlassButton>

          <GlassButton
            className={cn(
              "flex-1 py-2 px-2 text-sm font-medium transition-all duration-300 rounded-xl relative",
              activeTab === 'posts' && "active"
            )}
            onClick={() => setActiveTab('posts')}
            active={activeTab === 'posts'}
          >
            <FileText className="inline-block w-4 h-4 mr-1" />
            <span>Посты</span>
            {favoritePosts.length > 0 && (
              <GlassBadge className="absolute -top-1 -right-1 text-[9px] rounded-full flex items-center justify-center font-bold min-w-[16px] h-4 px-1">
                {favoritePosts.length > 99 ? '99+' : favoritePosts.length}
              </GlassBadge>
            )}
          </GlassButton>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 overflow-y-auto">
          {activeTab === 'places' && (
            <div className="space-y-2">
              {favoritePlaces.length === 0 ? (
                <div className="text-center py-8 favorites-empty">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Нет избранных мест</p>
                </div>
              ) : (
                favoritePlaces.map((place) => {
                  const isSelected = selectedMarkerIds.includes(place.id);
                  const toggleSelected = (checked: boolean) => markerToggle(place, checked);

                  return (
                    <div
                      key={place.id}
                      className={cn('marker-item', 'cursor-pointer')}
                      onClick={() => handleItemClickWrapped('place', place.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelected(!isSelected); }}
                          className={cn(
                            'mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                            isSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent'
                          )}
                        >
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </button>

                        {/* Icon */}
                        <div className="card-icon">
                          <MapPin className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="marker-title font-semibold text-sm truncate">
                            {place.title || 'Метка'}
                          </h3>
                          {place.location && (
                            <p className="marker-details text-xs truncate">
                              {place.location}
                            </p>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          className="ml-2 p-1 flex-shrink-0 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (favorites && typeof favorites.removeFavoritePlace === 'function') {
                              favorites.removeFavoritePlace(place.id);
                            }
                            setSelectedMarkerIds((prev) => prev.filter(id => id !== place.id));
                          }}
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-2">
              {favoriteRoutes.length === 0 ? (
                <div className="text-center py-8 favorites-empty">
                  <Navigation className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Нет избранных маршрутов</p>
                </div>
              ) : (
                favoriteRoutes.map((route) => {
                  const isSelectedRoute = selectedRouteIds.includes(route.id);
                  const toggleRoute = (checked: boolean) => routeToggle(route, checked);

                  return (
                    <div className="route-item" key={route.id} onClick={() => handleItemClickWrapped('route', route.id)}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRoute(!isSelectedRoute); }}
                          className={cn(
                            'mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                            isSelectedRoute ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent'
                          )}
                        >
                          {isSelectedRoute && <span className="text-white text-xs">✓</span>}
                        </button>

                        {/* Icon */}
                        <div className="card-icon">
                          <Navigation className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="route-title font-semibold text-sm truncate">
                            {route.title || 'Маршрут'}
                          </h3>
                          {route.description && (
                            <p className="route-description text-xs line-clamp-2">
                              {route.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-2">
              {favoriteEvents.length === 0 ? (
                <div className="text-center py-8 favorites-empty">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Нет избранных событий</p>
                </div>
              ) : (
                favoriteEvents.map((event) => {
                  const isSelectedEvent = selectedEventIds.includes(String(event.id));
                  const toggleEvent = (checked: boolean) => eventToggle(event, checked);

                  return (
                  <div className="event-item" key={event.id} onClick={() => handleItemClickWrapped('event', event.id)}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleEvent(!isSelectedEvent); }}
                        className={cn(
                          'mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                          isSelectedEvent ? 'bg-violet-500 border-violet-500 text-white' : 'bg-transparent'
                        )}
                      >
                        {isSelectedEvent && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="card-icon">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="event-title font-semibold text-sm truncate">
                          {event.title || 'Событие'}
                        </h3>
                        {event.date && (
                          <p className="event-subtitle text-xs">
                            {new Date(event.date).toLocaleDateString('ru-RU')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )})
              )}
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-2">
              {favoritePosts.length === 0 ? (
                <div className="text-center py-8 favorites-empty">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Нет избранных постов</p>
                </div>
              ) : (
                favoritePosts.map((post: any) => (
                  <div
                    key={post.id}
                    className="post-item"
                    onClick={() => handleItemClickWrapped('post', post.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="card-icon">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="post-title font-semibold text-sm truncate">
                          {post.title || 'Пост'}
                        </h3>
                        {post.body && (
                          <p className="post-subtitle text-xs line-clamp-2">
                            {post.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </MobileSlidePanel>
  );
};

export default MobileFavoritesPanel;

