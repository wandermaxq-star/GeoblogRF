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
import { MarkerData } from '../../types/marker';
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
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(marker.likes_count || 0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareValue, setShareValue] = useState('');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [mainPhotoIdx, setMainPhotoIdx] = useState(0);
  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  
  // Comments state
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [showSuggestInfo, setShowSuggestInfo] = useState(false);
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : undefined as any;

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
  const currentUserId = "test_creator_id";
  const numericRating = summary.avg || 0;

  const handleDescriptionClick = () => {
    if (marker.description) {
      setIsDescriptionOpen(true);
    }
  };

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

  // Discuss/Comments handler
  const handleDiscussClick = async () => {
    setCommentsExpanded(!commentsExpanded);
    if (!commentsExpanded && comments.length === 0) {
      setLoadingComments(true);
      try {
        const response = await apiClient.get(`/markers/${marker.id}/comments`);
        setComments(response.data || []);
      } catch (error) {
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  // Submit comment to moderation
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await apiClient.post(`/markers/${marker.id}/comments`, {
        content: newComment
      });
      setNewComment('');
      // Reload comments
      const response = await apiClient.get(`/markers/${marker.id}/comments`);
      setComments(response.data || []);
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  // Share handler
  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareValue.trim()) {
      setShareStatus('Пожалуйста, введите email или ссылку');
      return;
    }
    try {
      await apiClient.post(`/markers/${marker.id}/share`, { value: shareValue });
      setShareStatus('Ссылка успешно отправлена!');
      setTimeout(() => {
        setShowShareModal(false);
        setShareStatus(null);
        setShareValue('');
      }, 1500);
    } catch (e) {
      setShareStatus('Ошибка при отправке.');
    }
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

  const handleEditSubmit = async (formData: any) => {
    if (!marker.id) return;
    try {
      const updatedMarker = await markerService.updateMarker(marker.id, formData);
      onMarkerUpdate(updatedMarker);
      setEditModalOpen(false);
      setSuggestModalOpen(false);
    } catch (error) {
      alert("Не удалось сохранить изменения. Попробуйте снова.");
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

  return (
    <div className={`custom-marker-popup ${isSelected ? 'selected' : ''} ${visualClasses}`}>
      <PopupContainer>
        <CloseButton onClick={onClose}>&times;</CloseButton>
        <PopupContent $isExpanded={isDescriptionOpen || commentsExpanded}>
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
                    src={marker.photo_urls?.[mainPhotoIdx] || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'%3ENo img%3C/text%3E%3C/svg%3E"}
                    alt="Фото объекта"
                    onClick={() => (marker.photo_urls?.length ?? 0) > 0 && openGallery(mainPhotoIdx)}
                    className={(marker.photo_urls?.length ?? 0) > 0 ? 'photo-clickable' : undefined}
                    onError={e => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'%3ENo img%3C/text%3E%3C/svg%3E";
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
                <Description 
                  $isExpanded={isDescriptionOpen}
                  onClick={!isDescriptionOpen ? handleDescriptionClick : undefined}
                  style={{
                    cursor: !isDescriptionOpen ? 'pointer' : 'default',
                    userSelect: 'none',
                    pointerEvents: 'auto',
                  }}
                >
                  {marker.description}
                </Description>
                {isDescriptionOpen && (
                  <button
                    onClick={() => setIsDescriptionOpen(false)}
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      background: 'none',
                      border: '1px solid var(--glass-l1-border)',
                      borderRadius: '4px',
                      color: 'var(--glass-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.72em',
                      fontWeight: 600
                    }}
                  >
                    ⬆️ Скрыть
                  </button>
                )}
              </div>

              {!isDescriptionOpen && <div style={{ marginBottom: '12px' }}>
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
              </div>}

              {!isDescriptionOpen && marker.hashtags && marker.hashtags.length > 0 && (
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
              
              {/* Comments Section */}
              {commentsExpanded && (
                <div style={{ marginBottom: '70px' }}>
                  <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>💬 Комментарии</h4>
                  
                  {loadingComments ? (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--glass-text-secondary)' }}>
                      Загрузка...
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--glass-text-secondary)', fontSize: '12px' }}>
                      Нет комментариев
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '12px' }}>
                      {comments.map((comment: any) => (
                        <div key={comment.id} style={{ 
                          padding: '8px', 
                          borderLeft: '2px solid var(--glass-l1-border)', 
                          marginBottom: '8px',
                          fontSize: '12px'
                        }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong>{comment.author_name}</strong>
                            <span style={{ color: 'var(--glass-text-secondary)', fontSize: '11px' }}>
                              {comment.created_at}
                            </span>
                            {comment.status && comment.status !== 'active' && (
                              <ModerationBadge status={comment.status} className="" />
                            )}
                          </div>
                          <p style={{ margin: '4px 0 0 0' }}>{comment.text || comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add Comment Form */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    padding: '8px',
                    borderTop: '1px solid var(--glass-l1-border)'
                  }}>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Добавить комментарий..."
                      style={{
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid var(--glass-l1-border)',
                        fontSize: '12px',
                        minHeight: '60px',
                        fontFamily: 'inherit',
                        backgroundColor: 'var(--glass-bg)',
                        color: 'var(--glass-text-primary)',
                        resize: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setNewComment('')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          border: '1px solid var(--glass-l1-border)',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--glass-text-secondary)'
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleSubmitComment}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          background: '#2ecc71',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                      >
                        Отправить на модерацию
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Кнопки привязаны к низу попапа */}
              {!isDescriptionOpen && <div style={{ 
                position: 'absolute', 
                bottom: '3px', 
                left: '0', 
                right: '0', 
                padding: '0 16px'
              }}>
                <Actions style={{ flexWrap: 'nowrap' }}>
                <ActionButton $buttonColor={isLiked ? "#e74c3c" : "#7f8c8d"} onClick={handleLikeClick}>
                  <i className="fas fa-heart"></i>
                  <span>{likeCount}</span>
                </ActionButton>
                <ActionButton $buttonColor="#2ecc71" onClick={handleDiscussClick}>
                  <i className="fas fa-comments"></i>
                  {marker.comments_count > 0 && <span>{marker.comments_count}</span>}
                </ActionButton>
                <ActionButton $buttonColor="#f39c12" onClick={() => setShowShareModal(true)}>
                  <i className="fas fa-share-alt"></i>
                  {marker.shares_count > 0 && <span>{marker.shares_count}</span>}
                </ActionButton>
                <div style={{ position: 'relative', display: 'inline-block' }} ref={settingsRef}>
                  <ActionButton
                    $buttonColor="#888"
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
              </div>}
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
