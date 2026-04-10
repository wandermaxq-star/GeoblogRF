import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Star, MessageCircle, Heart, Share2, MapPin, Clock, 
  Users, DollarSign, User, ExternalLink, Image as ImageIcon, 
  Map, Edit3, Flag, ArrowLeft, Plus
} from 'lucide-react';
import { ExternalEvent } from '../../services/externalEventsService';
import { useEventsStore } from '../../stores/eventsStore';
import { useContentStore } from '../../stores/contentStore';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/use-mobile';
import { MockEvent } from '../TravelCalendar/mockEvents';
import { useFavorites } from '../../contexts/FavoritesContext';
import ReportButton from '../Moderation/ReportButton';
import { EventEditModal } from './EventEditModal';
import { updateEvent } from '../../services/eventService';
import './EventDetailPage.css';

interface EventDetailPageProps {
  event: ExternalEvent;
  onClose: () => void;
  onBack: () => void;
  /** Когда true — рендерится без overlay-обёртки (для использования внутри GlassPanel на карте) */
  standalone?: boolean;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  event,
  onClose,
  onBack,
  standalone = false,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(event);
  const { addOpenEvent, setSelectedEvent, setFocusEvent } = useEventsStore();
  const setLeftContent = useContentStore(state => state.setLeftContent);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const favorites = useFavorites();

  const handleShowMap = () => {
    // Убедиться, что событие выбрано в глобальном хранилище для карты
    if (currentEvent.location?.latitude && currentEvent.location?.longitude) {
      const mockEvent: MockEvent = {
        id: parseInt(currentEvent.id) || 0,
        title: currentEvent.title,
        description: currentEvent.description || '',
        date: currentEvent.start_date,
        categoryId: currentEvent.category || 'festival',
        hashtags: [],
        location: currentEvent.location?.address || '',
        latitude: currentEvent.location.latitude,
        longitude: currentEvent.location.longitude
      };
      
      addOpenEvent(mockEvent);
      setSelectedEvent(mockEvent);
      setFocusEvent(mockEvent);
      
      if (isMobile) {
        navigate('/map');
      } else {
        setLeftContent('map');
      }
    }
  };

  useEffect(() => {
    const mockEvent: MockEvent = {
      id: parseInt(event.id),
      title: event.title,
      description: event.description || '',
      date: event.start_date,
      categoryId: event.category || 'festival',
      hashtags: [],
      location: event.location?.address || '',
      latitude: event.location?.latitude != null ? event.location.latitude : NaN,
      longitude: event.location?.longitude != null ? event.location.longitude : NaN
    };

    addOpenEvent(mockEvent);
    // В standalone-режиме Map.tsx сам управляет selectedEvent через store.
    // Вызов setSelectedEvent здесь вызывает бесконечный цикл перерендеров.
    if (!standalone) {
      setSelectedEvent(mockEvent);
    }

    if (favorites && event.id) {
      setIsFavorite(favorites.isEventFavorite(event.id.toString()));
    }

    setCurrentEvent(event);

    return () => {
      if (!standalone) {
        setSelectedEvent(null);
      }
    };
  }, [event, addOpenEvent, setSelectedEvent, favorites, standalone]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.toLocaleDateString('ru-RU', { day: 'numeric' }),
      month: date.toLocaleDateString('ru-RU', { month: 'long' }),
      year: date.toLocaleDateString('ru-RU', { year: 'numeric' }),
      time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const handleToggleFavorite = () => {
    if (!favorites || !event.id) return;
    
    const eventId = event.id.toString();
    if (isFavorite) {
      favorites.removeFavoriteEvent(eventId);
    } else {
      favorites.addFavoriteEvent({
        id: eventId,
        title: event.title,
        description: event.description,
        date: event.start_date,
        location: event.location?.address || '',
        latitude: event.location?.latitude || 0,
        longitude: event.location?.longitude || 0,
        category: event.category || 'other',
        purpose: 'event',
        tags: [],
        visibility: 'public',
        usageCount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    setIsFavorite(!isFavorite);
  };

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description || '',
          url: window.location.href
        });
      } catch (err) {
        // Пользователь отменил шаринг
      }
    } else if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Получаем главное фото (обложку) и дополнительные фото отдельно
  const getEventPhotos = () => {
    const eventAny = currentEvent as any;
    
    // Главное фото (приоритет: cover_image_url > image_url > первое из photo_urls)
    let mainPhoto: string | null = null;
    if (eventAny.cover_image_url) {
      mainPhoto = eventAny.cover_image_url;
    } else if (event.image_url) {
      mainPhoto = event.image_url;
    }
    
    // Дополнительные фото (все кроме главного)
    const additionalPhotos: string[] = [];
    
    if (eventAny.photo_urls) {
      let allPhotos: string[] = [];
      if (Array.isArray(eventAny.photo_urls)) {
        allPhotos = eventAny.photo_urls.filter(Boolean);
      } else if (typeof eventAny.photo_urls === 'string') {
        allPhotos = eventAny.photo_urls.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      
      // Если нет главного фото, берем первое из списка как главное
      if (!mainPhoto && allPhotos.length > 0) {
        mainPhoto = allPhotos[0];
        additionalPhotos.push(...allPhotos.slice(1));
      } else {
        // Иначе добавляем все фото, исключая главное
        additionalPhotos.push(...allPhotos.filter(url => url !== mainPhoto));
      }
    }
    
    // Если есть image_url и он не главное фото, добавляем в дополнительные
    if (event.image_url && event.image_url !== mainPhoto) {
      additionalPhotos.push(event.image_url);
    }
    
    // Убираем дубликаты
    const uniqueAdditional = additionalPhotos.filter((url, index, self) => self.indexOf(url) === index);
    
    return {
      mainPhoto,
      additionalPhotos: uniqueAdditional
    };
  };

  // Используем currentEvent для отображения (обновляется после редактирования)
  const { mainPhoto, additionalPhotos } = getEventPhotos();
  const description = currentEvent.description || '';
  const shouldTruncate = description.length > 300;
  const displayDescription = shouldTruncate && !showFullDescription 
    ? description.substring(0, 300) + '...' 
    : description;

  const startDate = formatDate(currentEvent.start_date);
  const endDate = currentEvent.end_date ? formatDate(currentEvent.end_date) : null;

  return (
    <div
      className={standalone ? 'event-detail-standalone' : 'event-detail-overlay'}
      onClick={standalone ? undefined : (e) => {
        if (e.target === e.currentTarget) {
          setSelectedEvent(null);
          onClose();
        }
      }}
    >
      <div className={standalone ? 'event-detail-container event-detail-container--standalone' : 'event-detail-container'} onClick={(e) => e.stopPropagation()}>
        {/* Заголовок с кнопками */}
        <div className="event-detail-header">
          <button
            onClick={() => {
              setSelectedEvent(null);
              onBack();
            }}
            className="event-back-button"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>

          <div className="event-header-actions">
            <button
              onClick={handleToggleFavorite}
              className={`event-header-btn ${isFavorite ? 'active' : ''}`}
              title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="event-header-btn"
              title="Поделиться"
            >
              <Share2 className="w-5 h-5" />
            </button>
            {event.id && (
              <ReportButton
                contentId={event.id.toString()}
                contentType="event"
                contentTitle={event.title}
                variant="icon"
                size="sm"
                className="event-header-btn"
              />
            )}
            <button
              onClick={() => {
                setSelectedEvent(null);
                onClose();
              }}
              className="event-header-btn"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="event-detail-content">
          {/* Заголовок события */}
          <div className="event-title-block">
            <div className="event-category-tag">
              {currentEvent.category || 'Событие'}
            </div>
            <h1 className="event-main-title">{currentEvent.title}</h1>
          </div>

          {/* Ключевая информация - компактная полоса */}
          <div className="event-key-info">
            <div className="event-key-item">
              <Clock className="w-4 h-4" />
              <div>
                <div className="event-key-label">Начало</div>
                <div className="event-key-value">{startDate.time}</div>
              </div>
            </div>
            
            {endDate && (
              <div className="event-key-item">
                <Clock className="w-4 h-4" />
                <div>
                  <div className="event-key-label">Окончание</div>
                  <div className="event-key-value">{endDate.time}</div>
                </div>
              </div>
            )}

            {currentEvent.location?.address && (
              <div className="event-key-item">
                <MapPin className="w-4 h-4" />
                <div>
                  <div className="event-key-label">Место</div>
                  <div className="event-key-value">{currentEvent.location.address}</div>
                </div>
              </div>
            )}

            {currentEvent.price && (
              <div className="event-key-item">
                <DollarSign className="w-4 h-4" />
                <div>
                  <div className="event-key-label">Стоимость</div>
                  <div className="event-key-value">{currentEvent.price}</div>
                </div>
              </div>
            )}
          </div>

          {/* Описание и главное фото - горизонтально */}
          {description && mainPhoto && (
            <div className="event-description-photo-block">
              <div className="event-description-part">
                <h3 className="event-block-title">О событии</h3>
                <p className="event-description-text">{displayDescription}</p>
                {shouldTruncate && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="event-read-more-btn"
                  >
                    {showFullDescription ? 'Свернуть' : 'Читать далее'}
                  </button>
                )}
              </div>
              <div className="event-main-photo-part">
                <div className="event-main-photo-label">Главное фото</div>
                <div className="event-main-photo">
                  <img src={mainPhoto} alt={currentEvent.title} />
                </div>
              </div>
            </div>
          )}

          {/* Описание без фото */}
          {description && !mainPhoto && (
            <div className="event-glass-block">
              <h3 className="event-block-title">О событии</h3>
              <p className="event-description-text">{displayDescription}</p>
              {shouldTruncate && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="event-read-more-btn"
                >
                  {showFullDescription ? 'Свернуть' : 'Читать далее'}
                </button>
              )}
            </div>
          )}

          {/* Главное фото без описания */}
          {!description && mainPhoto && (
            <div className="event-glass-block">
              <h3 className="event-block-title">Главное фото</h3>
              <div className="event-main-photo-standalone">
                <img src={mainPhoto} alt={currentEvent.title} />
              </div>
            </div>
          )}

          {/* Сетка контента */}
          <div className="event-content-grid">
            {/* Левая колонка */}
            <div className="event-main-column">

              {/* Детали */}
              <div className="event-glass-block">
                <h3 className="event-block-title">Детали</h3>
                <div className="event-details-grid">
                  {currentEvent.organizer && (
                    <div className="event-detail-box">
                      <User className="w-5 h-5" />
                      <div>
                        <div className="event-detail-box-label">Организатор</div>
                        <div className="event-detail-box-value">{currentEvent.organizer}</div>
                      </div>
                    </div>
                  )}

                  {currentEvent.attendees_count && (
                    <div className="event-detail-box">
                      <Users className="w-5 h-5" />
                      <div>
                        <div className="event-detail-box-label">Участники</div>
                        <div className="event-detail-box-value">{currentEvent.attendees_count} человек</div>
                      </div>
                    </div>
                  )}

                  <div className="event-detail-box">
                    <Calendar className="w-5 h-5" />
                    <div>
                      <div className="event-detail-box-label">Дата</div>
                      <div className="event-detail-box-value">
                        {startDate.day} {startDate.month} {startDate.year}
                      </div>
                    </div>
                  </div>

                  {currentEvent.source && (
                    <div className="event-detail-box">
                      <Flag className="w-5 h-5" />
                      <div>
                        <div className="event-detail-box-label">Источник</div>
                        <div className="event-detail-box-value">{currentEvent.source}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Дополнительные фотографии */}
              {additionalPhotos.length > 0 && (
                <div className="event-glass-block">
                  <h3 className="event-block-title">
                    <ImageIcon className="w-5 h-5" />
                    Дополнительные фотографии
                  </h3>
                  <div className={`event-photos-grid ${additionalPhotos.length === 1 ? 'single' : additionalPhotos.length === 2 ? 'double' : 'multiple'}`}>
                    {additionalPhotos.slice(0, 6).map((photo, index) => (
                      <div key={index} className="event-photo-item">
                        <img src={photo} alt={`Фото ${index + 1}`} />
                        {index === 5 && additionalPhotos.length > 6 && (
                          <div className="event-photo-overlay">
                            +{additionalPhotos.length - 6}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Хэштеги */}
              {(() => {
                const eventAny = currentEvent as any;
                const hashtags = eventAny.hashtags || [];
                if (hashtags.length > 0) {
                  return (
                    <div className="event-glass-block">
                      <h3 className="event-block-title">
                        <Flag className="w-5 h-5" />
                        Теги
                      </h3>
                      <div className="event-hashtags-list">
                        {hashtags.map((tag: string, index: number) => (
                          <span key={index} className="event-hashtag-item">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Правая колонка - действия */}
            <div className="event-sidebar-column">
              <div className="event-glass-block">
                <h3 className="event-block-title">Действия</h3>
                
                <div className="event-actions-list">
                  {currentEvent.location?.latitude && currentEvent.location?.longitude && (
                      <button className="event-action-btn-primary" onClick={handleShowMap}>                        <Map className="w-5 h-5" />                      <span>Показать на карте</span>
                    </button>
                  )}
                  
                  {currentEvent.url && (
                    <a
                      href={currentEvent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="event-action-btn"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Подробнее на сайте</span>
                    </a>
                  )}

                  {/* Кнопка обсуждений - пока заглушка, будет реализована позже */}
                  <button
                    className="event-action-btn"
                    onClick={() => {
                      // TODO: Реализовать открытие обсуждений
                      alert('Функция обсуждений будет реализована в будущем');
                    }}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Обсуждения</span>
                  </button>

                  <button
                    onClick={() => setShowEditModal(true)}
                    className="event-action-btn"
                  >
                    <Edit3 className="w-5 h-5" />
                    <span>Редактировать</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <EventEditModal
          event={currentEvent}
          onClose={() => setShowEditModal(false)}
          onSendForModeration={async (updatedEvent) => {
            try {
              if (currentEvent.id) {
                let photoUrlsForDB: string | string[] | undefined = updatedEvent.photo_urls;
                if (Array.isArray(photoUrlsForDB)) {
                  photoUrlsForDB = photoUrlsForDB;
                }

                const savedEvent = await updateEvent(currentEvent.id.toString(), {
                  photo_urls: photoUrlsForDB,
                  cover_image_url: updatedEvent.cover_image_url,
                  status: 'pending' // Отправляем на модерацию
                } as any);
                
                if (savedEvent) {
                  const eventAny = savedEvent as any;
                  let photoUrls: string[] = [];
                  if (eventAny.photo_urls) {
                    if (Array.isArray(eventAny.photo_urls)) {
                      photoUrls = eventAny.photo_urls;
                    } else if (typeof eventAny.photo_urls === 'string') {
                      photoUrls = eventAny.photo_urls.split(',').map((s: string) => s.trim()).filter(Boolean);
                    }
                  }
                  
                  setCurrentEvent({
                    ...currentEvent,
                    image_url: eventAny.cover_image_url || eventAny.image_url || currentEvent.image_url,
                    ...(photoUrls.length > 0 && { photo_urls: photoUrls })
                  } as ExternalEvent);
                  
                  alert('Событие отправлено на модерацию!');
                }
              }
              setShowEditModal(false);
            } catch (error) {
              console.error('Ошибка отправки на модерацию:', error);
              alert('Не удалось отправить на модерацию. Попробуйте еще раз.');
            }
          }}
          onSave={async (updatedEvent) => {
            try {
              // Сохраняем изменения в БД
              if (currentEvent.id) {
                // Преобразуем массив photo_urls в строку для БД, если нужно
                let photoUrlsForDB: string | string[] | undefined = updatedEvent.photo_urls;
                if (Array.isArray(photoUrlsForDB)) {
                  // Оставляем как массив - БД поддерживает массивы
                  photoUrlsForDB = photoUrlsForDB;
                }

                const savedEvent = await updateEvent(currentEvent.id.toString(), {
                  photo_urls: photoUrlsForDB,
                  cover_image_url: updatedEvent.cover_image_url
                } as any);
                
                if (savedEvent) {
                  // Обновляем текущее событие с данными из БД
                  const eventAny = savedEvent as any;
                  
                  // Обрабатываем photo_urls из БД (может быть массивом или строкой)
                  let photoUrls: string[] = [];
                  if (eventAny.photo_urls) {
                    if (Array.isArray(eventAny.photo_urls)) {
                      photoUrls = eventAny.photo_urls;
                    } else if (typeof eventAny.photo_urls === 'string') {
                      photoUrls = eventAny.photo_urls.split(',').map((s: string) => s.trim()).filter(Boolean);
                    }
                  }
                  
                  setCurrentEvent({
                    ...currentEvent,
                    image_url: eventAny.cover_image_url || eventAny.image_url || currentEvent.image_url,
                    ...(photoUrls.length > 0 && { photo_urls: photoUrls })
                  } as ExternalEvent);
                  
                  // Показываем сообщение об успехе
                  alert('Фотографии успешно сохранены!');
                }
              }
              setShowEditModal(false);
            } catch (error) {
              console.error('Ошибка сохранения события:', error);
              alert('Не удалось сохранить изменения. Попробуйте еще раз.');
            }
          }}
        />
      )}
    </div>
  );
};
