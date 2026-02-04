import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Calendar, MapPin, Star } from 'lucide-react';
import { useFavorites } from '../../contexts/FavoritesContext';
import { FavoriteEvent } from '../../contexts/FavoritesContext';
import { eventService } from '../../services/eventService';
import { EventData } from '../../types/event';

interface SimplifiedCalendarProps {
  eventId?: string;
  className?: string;
}

const CalendarContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
`;

const CalendarFrame = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  display: flex;
  flex-direction: column;
  color: #e65100;
  padding: 16px;
`;

const EventHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
`;

const EventIcon = styled.div`
  width: 48px;
  height: 48px;
  background: #e65100;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  box-shadow: 0 4px 12px rgba(230, 81, 0, 0.3);
`;

const EventInfo = styled.div`
  flex: 1;
`;

const EventTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #e65100;
`;

const EventDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
`;

const EventDetails = styled.div`
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const DetailRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailIcon = styled.div`
  width: 32px;
  height: 32px;
  background: #e65100;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
`;

const DetailContent = styled.div`
  flex: 1;
`;

const DetailLabel = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
`;

const DetailValue = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #333;
`;

const SimplifiedCalendar: React.FC<SimplifiedCalendarProps> = ({ 
  eventId, 
  className 
}) => {
  const { favoriteEvents } = useFavorites() || { favoriteEvents: [] };
  const [selectedEvent, setSelectedEvent] = useState<FavoriteEvent | null>(null);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);

  // Загружаем все события с API
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const events = await eventService.getAllEvents();
        setAllEvents(events);
      } catch (error) {
        // Используем тестовые данные как fallback
        const testEvents: EventData[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440005',
            title: 'Фестиваль "Золотые ворота"',
            description: 'Культурный фестиваль у Золотых ворот',
            start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
            location: 'Золотые ворота',
            category: 'festival',
            event_type: 'public',
            is_public: true,
            creator_id: 'test-user',
            hashtags: ['фестиваль', 'владимир'],
            is_user_modified: false,
            used_in_blogs: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        setAllEvents(testEvents);
      }
    };
    loadEvents();
  }, []);

  // Находим выбранное событие сначала в API событиях, потом в избранном
  useEffect(() => {
    if (eventId) {
      
      // Сначала ищем в API событиях
      const apiEvent = allEvents.find((e: EventData) => e.id === eventId);
      if (apiEvent) {
        // Преобразуем EventData в FavoriteEvent
        const favoriteEvent: FavoriteEvent = {
          id: apiEvent.id,
          title: apiEvent.title,
          description: apiEvent.description || '',
          date: new Date(apiEvent.start_date).toISOString(),
          location: typeof apiEvent.location === 'string' ? apiEvent.location : (apiEvent.location?.address || ''),
          latitude: 0,
          longitude: 0,
          category: apiEvent.category || 'other',
          addedAt: new Date(apiEvent.created_at),
          purpose: 'personal',
          tags: [],
          visibility: 'private',
          usageCount: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setSelectedEvent(favoriteEvent);
        return;
      }
      
      // Если не найдено в API, ищем в избранном
      if (favoriteEvents.length > 0) {
        const event = favoriteEvents.find((e: FavoriteEvent) => e.id === eventId);
        if (event) {
          setSelectedEvent(event);
        }
      }
      
      // Если ничего не найдено, создаем тестовое событие
      if (!apiEvent && (!favoriteEvents.length || !favoriteEvents.find(e => e.id === eventId))) {
        const testEvent: FavoriteEvent = {
          id: eventId,
          title: 'Музыкальный концерт в Астрахани',
          description: 'Культурное событие с участием местных и приглашенных артистов',
          date: '2025-09-16T03:00:00',
          location: 'Астрахань, Астраханская область',
          latitude: 46.3497,
          longitude: 48.0408,
          category: 'concert',
          addedAt: new Date(),
          purpose: 'personal',
          tags: [],
          visibility: 'private',
          usageCount: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setSelectedEvent(testEvent);
      }
    }
  }, [eventId, allEvents, favoriteEvents]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!selectedEvent) {
    return (
      <CalendarContainer className={className}>
        <CalendarFrame>
          <EventHeader>
            <EventIcon>
              <Calendar size={24} color="white" />
            </EventIcon>
            <EventInfo>
              <EventTitle>Событие не найдено</EventTitle>
              <EventDescription>Выберите событие для просмотра</EventDescription>
            </EventInfo>
          </EventHeader>
        </CalendarFrame>
      </CalendarContainer>
    );
  }

  return (
    <CalendarContainer className={className}>
      <CalendarFrame>
        <EventHeader>
          <EventIcon>
            <Calendar size={24} color="white" />
          </EventIcon>
          <EventInfo>
            <EventTitle>{selectedEvent.title}</EventTitle>
            <EventDescription>Событие</EventDescription>
          </EventInfo>
        </EventHeader>

        <EventDetails>
          <DetailRow>
            <DetailIcon>
              <Calendar size={16} color="white" />
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Дата</DetailLabel>
              <DetailValue>{formatDate(selectedEvent.date)}</DetailValue>
            </DetailContent>
          </DetailRow>

          {selectedEvent.location && (
            <DetailRow>
              <DetailIcon>
                <MapPin size={16} color="white" />
              </DetailIcon>
              <DetailContent>
                <DetailLabel>Место</DetailLabel>
                <DetailValue>{selectedEvent.location}</DetailValue>
              </DetailContent>
            </DetailRow>
          )}

          <DetailRow>
            <DetailIcon>
              <Star size={16} color="white" />
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Категория</DetailLabel>
              <DetailValue>{selectedEvent.category}</DetailValue>
            </DetailContent>
          </DetailRow>
        </EventDetails>

        {/* Детальная информация о событии */}
        <EventDetails>
          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🚇</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Метро</DetailLabel>
              <DetailValue>Станция "Культурная" (5 мин пешком)</DetailValue>
            </DetailContent>
          </DetailRow>

          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🚗</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Автомобиль</DetailLabel>
              <DetailValue>Парковка рядом с местом проведения</DetailValue>
            </DetailContent>
          </DetailRow>
        </EventDetails>

        {/* Где остановиться */}
        <EventDetails>
          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🏨</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Отель "Культурный"</DetailLabel>
              <DetailValue>5 мин пешком • от 3000₽/ночь</DetailValue>
            </DetailContent>
          </DetailRow>

          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🏠</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Хостел "Арт"</DetailLabel>
              <DetailValue>10 мин пешком • от 800₽/ночь</DetailValue>
            </DetailContent>
          </DetailRow>
        </EventDetails>

        {/* Где поесть */}
        <EventDetails>
          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>☕</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Кафе "Вкусное"</DetailLabel>
              <DetailValue>3 мин пешком • Кухня: русская</DetailValue>
            </DetailContent>
          </DetailRow>

          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🍽️</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Ресторан "Элегант"</DetailLabel>
              <DetailValue>7 мин пешком • Кухня: европейская</DetailValue>
            </DetailContent>
          </DetailRow>
        </EventDetails>

        {/* Что посмотреть */}
        <EventDetails>
          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🏛️</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Дворцовая площадь</DetailLabel>
              <DetailValue>10 мин пешком • Главная площадь города</DetailValue>
            </DetailContent>
          </DetailRow>

          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🎨</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Эрмитаж</DetailLabel>
              <DetailValue>15 мин пешком • Крупнейший музей России</DetailValue>
            </DetailContent>
          </DetailRow>

          <DetailRow>
            <DetailIcon>
              <span style={{ fontSize: '16px' }}>🛣️</span>
            </DetailIcon>
            <DetailContent>
              <DetailLabel>Невский проспект</DetailLabel>
              <DetailValue>5 мин пешком • Главная улица города</DetailValue>
            </DetailContent>
          </DetailRow>
        </EventDetails>

        {/* Хэштеги */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px', 
          marginTop: '16px' 
        }}>
          {['#культура', '#москва', '#фестиваль', '#искусство', '#творчество'].map(tag => (
            <span key={tag} style={{
              background: 'rgba(255, 255, 255, 0.7)',
              color: '#e65100',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {tag}
            </span>
          ))}
        </div>
      </CalendarFrame>
    </CalendarContainer>
  );
};

export default SimplifiedCalendar;
