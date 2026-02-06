import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './markerpopup.css';
import {
  PopupContainer,
  CloseButton,
  PopupContent,
  PopupHeader,
  PhotoBlock,
  Photo,
  TitleRatingBlock,
  Title,
  Rating,
  Description,
  MetaInfo,
  Author,
  DateInfo,
  BookmarkButton,
  Hashtags,
  Hashtag,
  Actions,
  ActionButton,
} from './Map.styles';
import { getMarkerVisualClasses } from '../../utils/visualStates';
import { useFavorites } from '../../contexts/FavoritesContext';
import ModerationBadge from '../Moderation/ModerationBadge';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { useLayoutState } from '../../contexts/LayoutContext';
import { useContentStore, ContentState } from '../../stores/contentStore';
import { MarkerData } from '../../types/marker';
import { FEATURES } from '../../config/features';
import StarRating from '../ui/StarRating';
import { getSummary as getRatingSummary, getUserRating, rate as rateTarget } from '../../services/ratingsService';
import apiClient from '../../api/apiClient';
import { markerService } from '../../services/markerService';
import MarkerFormModal from './MarkerFormModal';
import ReportModal from './ReportModal';
import ModalMessage from './ModalMessage';
import ReportButton from '../Moderation/ReportButton';

interface MarkerPopupProps {
  marker: MarkerData;
  onClose: () => void;
  onHashtagClick?: (hashtag: string) => void;
  onMarkerUpdate: (updatedMarker: MarkerData) => void;
  onEdit?: (marker: MarkerData) => void;
  onReport?: (marker: MarkerData) => void;
  onRequestEdit?: (marker: MarkerData) => void;
  onAddToFavorites: (marker: MarkerData) => void;
  onAddToBlog?: (marker: MarkerData) => void; // Функция для добавления метки в блог
  isFavorite: boolean;
  isSelected?: boolean; // Для glowing-рамки
  onRemoveFromFavorites?: (id: string) => void;
  setSelectedMarkerIds?: React.Dispatch<React.SetStateAction<string[]>> | ((ids: string[]) => void);
}

const MarkerPopup: React.FC<MarkerPopupProps> = React.memo(({ marker, onClose, onHashtagClick, onMarkerUpdate, onAddToFavorites, onAddToBlog, isFavorite, isSelected, onRemoveFromFavorites, setSelectedMarkerIds }) => {
  const favorites = useFavorites();
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // local interactive state for ratings
  const [userRating, setUserRating] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ avg: number; count: number }>({ avg: Number(marker.rating) || 0, count: Number(marker.rating_count) || 0 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [s, ur] = await Promise.all([
          getRatingSummary('marker', marker.id),
          getUserRating('marker', marker.id)
        ]);
        if (mounted) {
          setSummary(s);
          setUserRating(ur);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [marker.id]);

  const handleRate = async (value: number) => {
    try {
      const s = await rateTarget('marker', marker.id, value);
      setUserRating(value);
      setSummary(s);
    } catch {}
  };
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(marker.likes_count || 0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareValue, setShareValue] = useState('');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [mainPhotoIdx, setMainPhotoIdx] = useState(0);
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [showSuggestInfo, setShowSuggestInfo] = useState(false);
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : undefined as any;
  const layoutContext = useLayoutState();

  // Функция для форматирования адреса
  const formatAddress = (address: string): string => {
    if (!address) return '';
    
    const parts = address.split(', ');
    let city = '';
    let street = '';
    
    // Ищем город
    for (const part of parts) {
      if (part.includes('Владимир') || part.includes('Москва') || part.includes('Санкт-Петербург')) {
        city = part.split(' ')[0]; // Берем только название города
        break;
      }
    }
    
    // Ищем улицу
    for (const part of parts) {
      if (part.includes('улица') || part.includes('проспект') || part.includes('переулок') || part.includes('шоссе')) {
        street = part.replace(/улица|проспект|переулок|шоссе/gi, '').trim();
        break;
      }
    }
    
    let result = '';
    if (city) {
      result += `г. ${city}`;
    }
    if (street) {
      if (result) result += ', ';
      result += `ул. ${street}`;
    }
    
    return result || address; // Если не удалось отформатировать, возвращаем оригинал
  };
  // Используем store для управления панелями
  const openRightPanel = useContentStore((state: ContentState) => state.openRightPanel);

  const currentUserId = "test_creator_id";
  const numericRating = summary.avg || 0;

  const handleDescriptionToggle = useCallback(() => {
    setIsDescriptionExpanded(prev => !prev);
  }, []);

  const renderStars = useMemo(() => {
    return <StarRating value={numericRating} count={summary.count} interactive onChange={handleRate} size={14} />;
  }, [numericRating, summary.count]);

  // Like handler
  const handleLikeClick = async () => {
    try {
      const response = await apiClient.post(`/markers/${marker.id}/like`);
      setIsLiked(true);
      setLikeCount((prev) => prev + 1);
      if (response.data && response.data.likes_count !== undefined) {
        setLikeCount(response.data.likes_count);
      }
    } catch (e) {
      setIsLiked(false);
    }
  };

  // Share handler
  const handleShareClick = () => {
    setShowShareModal(true);
    setShareStatus(null);
    setShareValue('');
  };
  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Example: send shareValue (email or link) to backend
    try {
      await apiClient.post(`/markers/${marker.id}/share`, { value: shareValue });
      setShareStatus('Ссылка успешно отправлена!');
    } catch (e) {
      setShareStatus('Ошибка при отправке.');
    }
  };

  // Discuss handler
  const handleDiscussClick = async () => {
    // Чаты отключены в этой сборке — показываем информативное сообщение
    try {
      alert('Чаты отключены в текущей сборке приложения. Обсуждения недоступны.');
    } catch (error) {
      // noop
    }
  };

  // Build route handler
  const handleBuildRoute = () => {
    // Save marker as route point in localStorage or context if needed
    localStorage.setItem('planner_marker', JSON.stringify({
      id: marker.id,
      latitude: marker.latitude,
      longitude: marker.longitude,
      title: marker.title,
    }));
    if (navigate) navigate('/planner');
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    // Предотвращаем закрытие попапа или всплытие клика к Leaflet
    e.stopPropagation();
    // Если метка ещё не в избранном — открываем выбор категории для добавления
    if (!isFavorite) {
      setShowCategorySelection(true);
      return;
    }

    // Если метка уже в избранном — удаляем её
    try {
      const isRealContext = favorites && !(favorites as any)._isStub;
      if (isRealContext && typeof (favorites as any).removeFavoritePlace === 'function') {
        (favorites as any).removeFavoritePlace(String(marker.id));
      } else if (typeof onRemoveFromFavorites === 'function') {
        onRemoveFromFavorites(String(marker.id));
      }
    } catch (err) {}

    // Убираем её из выбранных checkbox'ов, если была отмечена
    try {
      // Используем контекстный setSelectedMarkerIds (он корректно управляет массивом)
      const ctxSetIds = (favorites && !(favorites as any)._isStub && typeof (favorites as any).setSelectedMarkerIds === 'function')
        ? (favorites as any).setSelectedMarkerIds
        : setSelectedMarkerIds;
      if (typeof ctxSetIds === 'function') {
        ctxSetIds((prev: string[]) => (prev || []).filter((id: string) => String(id) !== String(marker.id)));
      }
    } catch (err) {}
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const handleConfirmCategory = () => {
    try {
      if (selectedCategory) {
        const isRealContext = favorites && !(favorites as any)._isStub;
        if (isRealContext && typeof (favorites as any).addToFavorites === 'function') {
          (favorites as any).addToFavorites(marker, selectedCategory);
        } else if (typeof onAddToFavorites === 'function') {
          try { onAddToFavorites(marker); } catch (err) {}
        }
      }
    } catch (err) {}
    setShowCategorySelection(false);
    setSelectedCategory('');
  };

  const handleCancelCategory = () => {
    setShowCategorySelection(false);
    setSelectedCategory('');
  };

  const openGallery = useCallback((idx: number) => {
    setMainPhotoIdx(idx);
    setIsGalleryOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false);
  }, []);

  const handleNextPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!marker.photo_urls || marker.photo_urls.length === 0) return;
    setMainPhotoIdx(prevIdx => (prevIdx + 1) % marker.photo_urls.length);
  }, [marker.photo_urls]);

  const handlePrevPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!marker.photo_urls || marker.photo_urls.length === 0) return;
    setMainPhotoIdx(prevIdx => (prevIdx - 1 + marker.photo_urls.length) % marker.photo_urls.length);
  }, [marker.photo_urls]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'Escape') {
        closeGallery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGalleryOpen, handleNextPhoto, handlePrevPhoto, closeGallery]);

  const handlePhotoSubmit = async () => {
    if (!newPhotoFile || !marker.id) return;
    try {
      const updatedMarker = await markerService.addPhotoToMarker(marker.id, newPhotoFile);
      onMarkerUpdate(updatedMarker);
      setIsAddPhotoOpen(false);
      setNewPhotoFile(null);
    } catch (error) {
      alert("Не удалось загрузить фото. Попробуйте снова.");
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const isOwner = marker.creator_id === currentUserId;

  // Определяем визуальные состояния маркера
  const visualClasses = getMarkerVisualClasses({
    isFavorite,
    isUserModified: marker.is_user_modified,
    usedInBlogs: marker.used_in_blogs
  });

  function handleEditSubmit(_data: Partial<MarkerData>): void {
    throw new Error('Function not implemented.');
  }

  return (
    <div className={`custom-marker-popup ${isSelected ? 'selected' : ''} ${visualClasses}`}>
      <PopupContainer>
        <CloseButton onClick={onClose}>&times;</CloseButton>
        <PopupContent>
          {!showCategorySelection ? (
            <>
              <PopupHeader>
                <PhotoBlock>
                  <BookmarkButton
                    onClick={(e: React.MouseEvent) => handleFavoriteClick(e)}
                    title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                    aria-label="Добавить в избранное"
                  >
                    {isFavorite ? (
                      <svg width="16" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M2 2C2 0.89543 2.89543 0 4 0H18C19.1046 0 20 0.89543 20 2V18C20 18.5523 19.4477 19 19 19C18.7893 19 18.5858 18.9214 18.4393 18.7803L11 13.5858L3.56066 18.7803C3.214 19.127 2.64518 19.127 2.29852 18.7803C2.10536 18.5871 2 18.3247 2 18.0607V2Z"
                          fill="#8e44ad"
                          stroke="#8e44ad"
                          strokeWidth="2"
                        />
                      </svg>
                    ) : (
                      <svg width="16" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M2 2C2 0.89543 2.89543 0 4 0H18C19.1046 0 20 0.89543 20 2V18C20 18.5523 19.4477 19 19 19C18.7893 19 18.5858 18.9214 18.4393 18.7803L11 13.5858L3.56066 18.7803C3.214 19.127 2.64518 19.127 2.29852 18.7803C2.10536 18.5871 2 18.3247 2 18.0607V2Z"
                          fill="#fff"
                          stroke="#222"
                          strokeWidth="2"
                        />
                      </svg>
                    )}
                  </BookmarkButton>
                  <Photo
                    src={marker.photo_urls?.[mainPhotoIdx] || 'https://via.placeholder.com/80?text=No+Image'}
                    alt="Фото объекта"
                    onClick={() => (marker.photo_urls?.length ?? 0) > 0 && openGallery(mainPhotoIdx)}
                    className={(marker.photo_urls?.length ?? 0) > 0 ? 'photo-clickable' : undefined}
                    onError={e => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=No+Image';
                    }}
                  />
                  <button
                    className="overlay-icon-btn"
                    title="Добавить фото"
                    onClick={() => setIsAddPhotoOpen(true)}
                    aria-label="Добавить фото"
                  >
                    <i className="fas fa-camera"></i>
                  </button>
                  {marker.photo_urls && marker.photo_urls.length > 1 && (
                    <div title="Open gallery" className="overlay-badge" onClick={() => openGallery(mainPhotoIdx)}>
                      <i className="fas fa-images"></i>
                      <span>{marker.photo_urls.length}</span>
                    </div>
                  )} 
                </PhotoBlock>
              </PopupHeader>
              
              {/* Круг полноты заполнения сверху по центру - показываем только если есть реальное значение */}
              {(() => {
                // Используем реальное значение заполняемости из метки или хука
                const completenessScore = marker.completeness_score || marker.completenessScore;
                // Показываем виджет только если есть значение и оно меньше 100%
                if (completenessScore === undefined || completenessScore === null) {
                  return null; // Не показываем, если нет данных
                }
                
                const completeness = Math.round(completenessScore);
                const circumference = 87.96; // 2 * π * 14
                const strokeDashoffset = circumference * (1 - completeness / 100);
                
                // Определяем цвет по проценту
                let strokeColor = '#ef4444'; // красный по умолчанию
                if (completeness > 25 && completeness <= 50) strokeColor = '#f97316'; // оранжевый
                else if (completeness > 50 && completeness <= 75) strokeColor = '#fbbf24'; // желтый
                else if (completeness > 75) strokeColor = '#84cc16'; // салатовый
                
                return (
                  <div className="completeness-badge">
                    <div>
                      <svg width="32" height="32" className="transform -rotate-90">
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                          fill="none"
                        />
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke={strokeColor}
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span 
                          className="font-semibold text-gray-700"
                          style={{ 
                            fontSize: (() => {
                              if (completeness >= 100) return '10px';
                              return '12px';
                            })()
                          }}
                        >
                          {completeness}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Блок с названием и рейтингом перенесен вниз на ~1см */}
              <div style={{ marginTop: '0px', marginBottom: '10px', textAlign: 'center' }}>
                <TitleRatingBlock>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Title style={{ textAlign: 'center' }}>{marker.title}</Title>
                  </div>
                  {marker.category && (
                    <div style={{ 
                      textAlign: 'center', 
                      marginTop: '4px', 
                      marginBottom: '6px',
                      fontSize: '0.85em', 
                      color: '#666',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {marker.category}
                    </div>
                  )}
                  <Rating style={{ justifyContent: 'center' }}>
                    {renderStars}
                    {marker.rating_count > 0 && (
                      <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '4px' }}>
                        ({marker.rating_count} оценок)
                      </span>
                    )}
                  </Rating>
                </TitleRatingBlock>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <Description $isExpanded={isDescriptionExpanded}>
                  {marker.description}
                </Description>
                {marker.description && marker.description.length > 120 && (
                  <div style={{ textAlign: 'right', margin: 0, padding: 0, lineHeight: 1 }}>
                    {!isDescriptionExpanded ? (
                      <button onClick={handleDescriptionToggle} className="text-link-btn">
                        Читать далее
                      </button>
                    ) : (
                      <button onClick={handleDescriptionToggle} className="text-link-btn">
                        Скрыть
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                {/* Бейдж модерации */}
                {(marker.status === 'pending' || (marker as any).is_pending) && (
                  <div style={{ marginBottom: '8px' }}>
                    <ModerationBadge status="pending" />
                  </div>
                )}
                {marker.address && (
                  <MetaInfo>
                    <span>Адрес: {formatAddress(marker.address)}</span>
                  </MetaInfo>
                )}
                {marker.subcategory && (
                  <MetaInfo>
                    <span>Подкатегория: {marker.subcategory}</span>
                  </MetaInfo>
                )}
                {marker.is_verified && (
                  <MetaInfo>
                    <span>Верифицировано: Да</span>
                  </MetaInfo>
                )}
                <MetaInfo>
                  <Author>{marker.author_name}</Author>
                  <DateInfo>{marker.created_at}</DateInfo>
                </MetaInfo>
              </div>
              
              {marker.hashtags && marker.hashtags.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <Hashtags>
                  {marker.hashtags.map((tag: string) => (
                    <Hashtag key={tag} onClick={() => onHashtagClick && onHashtagClick(tag)}>
                      #{tag}
                    </Hashtag>
                  ))}
                </Hashtags>
              </div>
              )}
              
              {/* Кнопки привязаны к низу попапа */}
              <div style={{ 
                position: 'absolute', 
                bottom: '3px', 
                left: '0', 
                right: '0', 
                padding: '0 16px'
              }}>
                <Actions style={{ flexWrap: 'nowrap' }}>
                <ActionButton buttonColor={isLiked ? "#e74c3c" : "#7f8c8d"} onClick={handleLikeClick}>
                  <i className="fas fa-heart"></i>
                  <span>{likeCount}</span>
                </ActionButton>
                <ActionButton buttonColor="#2ecc71" onClick={handleDiscussClick}>
                  <i className="fas fa-comments"></i>
                  {marker.comments_count > 0 && <span>{marker.comments_count}</span>}
                </ActionButton>
                <ActionButton buttonColor="#f39c12" onClick={handleShareClick}>
                  <i className="fas fa-share-alt"></i>
                  {marker.shares_count > 0 && <span>{marker.shares_count}</span>}
                </ActionButton>
                <ActionButton buttonColor="#34495e" onClick={handleBuildRoute}>
                  <i className="fas fa-route"></i>
                </ActionButton>
                {onAddToBlog && (
                  <ActionButton buttonColor="#9b59b6" onClick={() => onAddToBlog(marker)}>
                    <i className="fas fa-pen-nib"></i>
                  </ActionButton>
                )}
                <div style={{ position: 'relative', display: 'inline-block' }} ref={settingsRef}>
                  <ActionButton
                    buttonColor="#888"
                    onClick={e => {
                      e.stopPropagation();
                      setSettingsOpen(v => !v);
                    }}
                  >
                    <i className="fas fa-cog"></i>
                  </ActionButton>
                  {settingsOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '110%',
                        right: 0,
                        background: '#fff',
                        border: '1px solid #eee',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        zIndex: 10,
                        minWidth: 180,
                        padding: '6px 0',
                        maxHeight: '140px',
                        overflowY: 'auto',
                      }}
                    >
                      {isOwner ? (
                        <button className="settings-menu-btn" onClick={e => { e.stopPropagation(); setSettingsOpen(false); setEditModalOpen(true); }}>
                          <i className="fas fa-edit" /> Изменить
                        </button> 
                      ) : (
                        <button className="settings-menu-btn" onClick={e => { e.stopPropagation(); setSettingsOpen(false); setShowSuggestInfo(true); }}>
                          <i className="fas fa-edit" /> Изменить
                        </button> 
                      )} 
                      <button className="settings-menu-btn" onClick={e => { e.stopPropagation(); setSettingsOpen(false); setSuggestModalOpen(true); }}>
                        <i className="fas fa-paper-plane" /> На модерацию
                      </button> 
                      <div style={{ width: '100%', marginTop: '4px' }}>
                        <ReportButton
                          contentId={marker.id}
                          contentType="marker"
                          contentTitle={marker.title}
                          variant="button"
                          size="sm"
                          className="w-full justify-center"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Actions>
              </div>
            </>
          ) : (
            /* Форма выбора категории */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              padding: '12px'
            }}>
              <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#333', textAlign: 'center' }}>
                Добавить в избранное
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                <button onClick={handleCancelCategory} className="modal-btn modal-btn-alt">Отмена</button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Предпочитаем контекст если он реальный (не заглушка),
                    // иначе вызываем prop callback.
                    try {
                      const isRealContext = favorites && !(favorites as any)._isStub;
                      if (isRealContext && typeof (favorites as any).addToFavorites === 'function') {
                        try { (favorites as any).addToFavorites(marker, selectedCategory || 'personal'); } catch (err) {}
                      } else if (typeof onAddToFavorites === 'function') {
                        try { onAddToFavorites(marker); } catch (err) {}
                      }
                    } catch (err) {}

                    // Помечаем метку как выбранную в панели избранного (чекбокс)
                    // Используем контекстный setSelectedMarkerIds с функциональным обновлением
                    try {
                      const ctxSetIds = (favorites && !(favorites as any)._isStub && typeof (favorites as any).setSelectedMarkerIds === 'function')
                        ? (favorites as any).setSelectedMarkerIds
                        : setSelectedMarkerIds;
                      if (typeof ctxSetIds === 'function') {
                        ctxSetIds((prev: string[]) => Array.from(new Set([...(prev || []), String(marker.id)])));
                      }
                    } catch (err) {}

                    // Закрываем форму выбора категории, но оставляем попап открытым
                    setShowCategorySelection(false);
                  }}
                  className="modal-btn modal-btn-success"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </PopupContent>
      </PopupContainer>
      {isGalleryOpen && createPortal(
        <div className="modal-overlay modal-overlay-dark" onClick={closeGallery}>
          <button aria-label="Close gallery" className="modal-close-btn" onClick={closeGallery}>&times;</button>
          {marker.photo_urls && marker.photo_urls.length > 1 && (
            <>
              <button aria-label="Previous image" onClick={handlePrevPhoto} className="gallery-nav-btn gallery-prev">&#10094;</button>
              <button aria-label="Next image" onClick={handleNextPhoto} className="gallery-nav-btn gallery-next">&#10095;</button>
            </>
          )}
          <div className="gallery-inner" onClick={e => e.stopPropagation()}>
            <img src={marker.photo_urls?.[mainPhotoIdx]} alt={`Фото ${marker.title}`} className="gallery-image" />
          </div>
        </div>,
        document.body
      )}
      {isAddPhotoOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPhotoOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsAddPhotoOpen(false)}>&times;</button>
            <h3>Добавить фото</h3>
            <input
              className="modal-input"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  setNewPhotoFile(e.target.files[0]);
                }
              }}
            />
            <div className="modal-actions">
              <button className="modal-btn modal-btn-alt" onClick={() => setIsAddPhotoOpen(false)}>Отмена</button>
              <button className="modal-btn modal-btn-primary" onClick={handlePhotoSubmit} disabled={!newPhotoFile}>
                Добавить
              </button>
            </div>
          </div>
        </div>
      )} 
      {editModalOpen && (
        <MarkerFormModal
          mode="edit"
          initialData={marker}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditModalOpen(false)}
        />
      )}
      {suggestModalOpen && (
        <MarkerFormModal
          mode="suggest"
          initialData={marker}
          onSubmit={handleEditSubmit}
          onCancel={() => setSuggestModalOpen(false)}
        />
      )}
      {reportModalOpen && (
        <ReportModal
          onSubmit={handlePhotoSubmit}
          onCancel={() => setReportModalOpen(false)}
        />
      )}
      {showSuggestInfo && (
        <ModalMessage
          message="Изменения доступны только пользователю, который добавил метку на карту. Если у вас есть предложения, заполните форму и отправьте модератору."
          onClose={() => setShowSuggestInfo(false)}
          onSuggest={() => {
            setShowSuggestInfo(false);
            setSuggestModalOpen(true);
          }}
        />
      )}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowShareModal(false)}>&times;</button>
            <h3>Поделиться меткой</h3>
            <form onSubmit={handleShareSubmit}>
              <input className="modal-input" type="text" placeholder="Email или ссылка" value={shareValue} onChange={e => setShareValue(e.target.value)} />
              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn-alt" onClick={() => setShowShareModal(false)}>Отмена</button>
                <button type="submit" className="modal-btn modal-btn-primary">Отправить</button>
              </div>
            </form>
            {shareStatus && <div className="modal-status" style={{ color: shareStatus.includes('успешно') ? 'var(--state-success)' : 'var(--state-danger)' }}>{shareStatus}</div>}
          </div>
        </div>
      )}


    </div>
  );
});



export default MarkerPopup;
