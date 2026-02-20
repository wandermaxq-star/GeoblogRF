import React from 'react';
import StarRating from '../ui/StarRating';
import { useRating } from '../../hooks/useRating';
import { X, Calendar, MapPin, Clock, Star, MessageCircle } from 'lucide-react';
import { ExternalEvent } from '../../services/externalEventsService';
import { useFavorites } from '../../contexts/FavoritesContext';
import ReportButton from '../Moderation/ReportButton';
import AddToFavoritesModal from '../Modals/AddToFavoritesModal';
import { useAddToFavorites } from '../../hooks/useAddToFavorites';

interface EventsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: ExternalEvent[];
  date: string;
  onEventClick: (event: ExternalEvent) => void;
}

export const EventsListModal: React.FC<EventsListModalProps> = ({
  isOpen,
  onClose,
  events,
  date,
  onEventClick
}) => {
  const { isModalOpen, currentItem, openModal, closeModal, handleConfirm } = useAddToFavorites();

  if (!isOpen) return null;

  const EventRating: React.FC<{ eventId: string | number }> = ({ eventId }) => {
    const { summary, handleRate } = useRating('event', eventId);
    return (
      <div className="mr-2">
        <StarRating value={summary.avg || 0} count={summary.count} interactive onChange={handleRate} />
      </div>
    );
  };

  const favorites = useFavorites();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'timepad': return '🎫';
      case 'vk': return '📘';
      case 'dgis': return '🗺️';
      default: return '📅';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'culture': return '🎭';
      case 'sports': return '⚽';
      case 'business': return '💼';
      case 'technology': return '💻';
      case 'food': return '🍽️';
      case 'travel': return '✈️';
      default: return '📅';
    }
  };

  const toggleFavorite = (event: ExternalEvent) => {
    if (!favorites) return;
    const id = event.id.toString();
    if (favorites.isEventFavorite(id)) {
      favorites.removeFavoriteEvent(id);
    } else {
      // Открываем модал выбора категории вместо прямого добавления
      openModal({
        id,
        title: event.title,
        type: 'event',
        data: {
          date: new Date(event.start_date),
          location: event.location?.address || '',
          category: event.category || 'other'
        }
      });
    }
  };

  const isFavorite = (event: ExternalEvent) => {
    if (!favorites) return false;
    return favorites.isEventFavorite(event.id.toString());
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4"
      style={{
        borderRadius: 'inherit',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="w-full max-h-[85%] overflow-hidden flex flex-col animate-[slideUpGlass_0.35s_ease-out]"
        style={{
          maxWidth: 'min(92%, 480px)',
          background: 'linear-gradient(135deg, rgba(30, 20, 60, 0.72), rgba(40, 30, 80, 0.65))',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Заголовок */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <Calendar className="w-4.5 h-4.5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white/95 leading-tight">События {date}</h2>
              <p className="text-xs text-white/50">{events.length} мероприятий</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Карточки событий */}
        <div className="px-4 py-3 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
          <div className="flex flex-col gap-3">
            {events.map((event) => {
              const eventAny = event as any;
              let mainPhoto: string | null = null;
              if (eventAny.cover_image_url) mainPhoto = eventAny.cover_image_url;
              else if (event.image_url) mainPhoto = event.image_url;
              else if (eventAny.photo_urls) {
                const photos = Array.isArray(eventAny.photo_urls)
                  ? eventAny.photo_urls.filter(Boolean)
                  : typeof eventAny.photo_urls === 'string'
                    ? eventAny.photo_urls.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [];
                if (photos.length > 0) mainPhoto = photos[0];
              }

              return (
                <div
                  key={event.id}
                  className="group cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '14px',
                    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
                  }}
                  onClick={() => onEventClick(event)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  {/* Верхняя строка: название + действия */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <h3 className="font-semibold text-sm text-white/90 leading-snug line-clamp-2 flex-1 group-hover:text-purple-200 transition-colors">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {event.id && <EventRating eventId={event.id} />}
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        title={isFavorite(event) ? 'В избранном' : 'В избранное'}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(event); }}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFavorite(event) ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'}`} />
                      </button>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        title="Обсуждения"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-white/40" />
                      </button>
                      <ReportButton
                        contentId={event.id.toString()}
                        contentType="event"
                        contentTitle={event.title}
                        variant="icon"
                        size="sm"
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } as any}
                      />
                    </div>
                  </div>

                  {/* Фото + описание в строку */}
                  <div className="flex gap-3 mb-2.5">
                    {/* Миниатюра фото */}
                    <div
                      className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
                    >
                      {mainPhoto ? (
                        <img src={mainPhoto} alt={event.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-white/20 text-2xl">📷</div>
                      )}
                    </div>
                    {/* Описание */}
                    <div className="flex-1 min-w-0">
                      {event.description && (
                        <p className="text-xs text-white/50 line-clamp-3 leading-relaxed mb-1.5">
                          {event.description}
                        </p>
                      )}
                      {event.price && (
                        <span className="text-xs text-emerald-300 font-medium">{event.price}</span>
                      )}
                    </div>
                  </div>

                  {/* Мета-информация + кнопка */}
                  <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
                    <div className="flex items-center gap-3 text-xs text-white/45 overflow-hidden">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-purple-300/60" />
                        {formatDate(event.start_date)}
                      </span>
                      {event.location?.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-rose-300/60 shrink-0" />
                          <span className="truncate">{event.location.address}</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(124, 58, 237, 0.5))',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: 'rgba(255, 255, 255, 0.9)',
                      }}
                    >
                      Детали
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Модал выбора категории для добавления в избранное */}
      <AddToFavoritesModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleConfirm}
        itemType={currentItem?.type}
        itemTitle={currentItem?.title}
      />

      <style>{`
        @keyframes slideUpGlass {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};