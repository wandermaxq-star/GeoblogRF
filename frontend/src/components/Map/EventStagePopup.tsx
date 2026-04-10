import React from 'react';
import { CalendarDays, Clock3, MapPin, Star, X } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { MockEvent } from '../TravelCalendar/mockEvents';
import { getCategoryById } from '../TravelCalendar/TravelCalendar';
import './EventStagePopup.css';

interface EventStagePopupProps {
  event: MockEvent;
  onClose: () => void;
  onOpenDetails: () => void;
}

const formatDateTitle = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateMeta = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
};

const EventStagePopup: React.FC<EventStagePopupProps> = ({ event, onClose, onOpenDetails }) => {
  const category = getCategoryById(event.categoryId);
  const Icon = category?.icon;
  const rating = 4.5;

  return (
    <div className="event-stage-popup">
      <div className="event-stage-popup__header">
        <div className="event-stage-popup__header-main">
          <div className="event-stage-popup__header-icon">
            <CalendarDays size={16} />
          </div>
          <div>
            <div className="event-stage-popup__title">События {formatDateTitle(event.date)}</div>
            <div className="event-stage-popup__subtitle">1 мероприятие</div>
          </div>
        </div>
        <button type="button" className="event-stage-popup__close" onClick={onClose} aria-label="Закрыть">
          <X size={14} />
        </button>
      </div>

      <div className="event-stage-popup__card">
        <div className="event-stage-popup__card-top">
          <div className="event-stage-popup__badge">{Icon ? <Icon size={14} /> : <Star size={14} />}</div>
          <div className="event-stage-popup__card-body">
            <div className="event-stage-popup__event-title">{event.title}</div>
            <div className="event-stage-popup__rating-row">
              <StarRating value={rating} count={0} size={12} />
            </div>
          </div>
        </div>

        {event.description && (
          <div className="event-stage-popup__description">{event.description}</div>
        )}

        <div className="event-stage-popup__footer">
          <div className="event-stage-popup__meta">
            <span>
              <Clock3 size={12} />
              {formatDateMeta(event.date)}
            </span>
            {event.location && (
              <span className="event-stage-popup__meta-location">
                <MapPin size={12} />
                {event.location}
              </span>
            )}
          </div>
          <button type="button" className="event-stage-popup__details" onClick={onOpenDetails}>
            Детали
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventStagePopup;