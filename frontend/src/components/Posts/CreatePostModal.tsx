import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaMapMarkerAlt, FaRoute, FaCalendar, FaPaperPlane, FaEye, FaExpand, FaCompress, FaTrash, FaCloud } from 'react-icons/fa';
import { createPost, PostDTO, MapSnapshot } from '../../services/postsService';
import { useLayoutState } from '../../contexts/LayoutContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import MiniMapMarker from './MiniMapMarker';
import MiniMapRoute from './MiniMapRoute';
import MiniEventCard from './MiniEventCard';
import PostPreview from './PostPreview';
import GuideFormatSelector, { GuideFormat } from './GuideFormatSelector';
import { offlinePostsStorage } from '../../services/offlinePostsStorage';

type PostType = 'simple' | 'guide';
type HookType = 'route' | 'marker' | 'event' | null;

interface GuideSection {
  id: string;
  title: string;
  content: string;
  hasMap: boolean;
  routeId?: string;
  markerId?: string;
  eventId?: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: PostDTO) => void;
  initialRoute?: any;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated, initialRoute }) => {
  // Тип поста
  const [postType, setPostType] = useState<PostType>('simple');
  
  // Общие поля
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  
  // Простой пост: крючок контента
  const [hasHook, setHasHook] = useState(false);
  const [hookType, setHookType] = useState<HookType>(null);
  const [hookRouteId, setHookRouteId] = useState<string | null>(null);
  const [hookMarkerId, setHookMarkerId] = useState<string | null>(null);
  const [hookEventId, setHookEventId] = useState<string | null>(null);
  
  // Путеводитель: секции и формат
  const [guideSections, setGuideSections] = useState<GuideSection[]>([]);
  const [guideFormat, setGuideFormat] = useState<GuideFormat>('mobile');
  const [guideFormatSelected, setGuideFormatSelected] = useState(false); // Выбран ли формат
  
  // Модальное окно для выбора крючков контента в секциях
  const [showContentHookModal, setShowContentHookModal] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [contentHookType, setContentHookType] = useState<'markers' | 'routes' | 'events'>('markers');
  
  // Фото
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  // Стиль карты
  const [mapBase, setMapBase] = useState<'opentopo' | 'alidade'>('opentopo');
  
  // Предпросмотр
  const [showPreview, setShowPreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layout = useLayoutState();
  const favorites = useFavorites();

  // Очистка формы при закрытии
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setBody('');
      setHasHook(false);
      setHookType(null);
      setHookRouteId(null);
      setHookMarkerId(null);
      setHookEventId(null);
      setGuideSections([]);
      setGuideFormat('mobile');
      setGuideFormatSelected(false);
      setUploadedFiles([]);
      setPhotoPreviewUrls([]);
      setShowPreview(false);
      setPreviewExpanded(false);
      setShowContentHookModal(false);
      setCurrentSectionId(null);
      setError(null);
    }
  }, [isOpen]);

  // Если передан начальный маршрут (например, при навигации из профиля), применяем его как hook
  useEffect(() => {
    if (isOpen && initialRoute) {
      const r = initialRoute;
      setHookRouteId(r.id || r.track?.id || null);
      setHookType('route');
      setHasHook(true);
    }
  }, [isOpen, initialRoute]);
  
  // Обработка выбора формата путеводителя
  const handleFormatSelect = (format: GuideFormat) => {
    setGuideFormat(format);
    setGuideFormatSelected(true);
  };
  
  // Открытие модального окна для выбора крючка контента
  const openContentHookModal = (sectionId: string, type: 'markers' | 'routes' | 'events') => {
    setCurrentSectionId(sectionId);
    setContentHookType(type);
    setShowContentHookModal(true);
  };
  
  // Добавление крючка контента в секцию
  const addContentHookToSection = (type: 'markers' | 'routes' | 'events', id: string) => {
    if (!currentSectionId) return;
    
    const updates: Partial<GuideSection> = {
      hasMap: true
    };
    
    if (type === 'routes') {
      updates.routeId = id;
      updates.markerId = undefined;
      updates.eventId = undefined;
    } else if (type === 'markers') {
      updates.markerId = id;
      updates.routeId = undefined;
      updates.eventId = undefined;
    } else if (type === 'events') {
      updates.eventId = id;
      updates.routeId = undefined;
      updates.markerId = undefined;
    }
    
    updateGuideSection(currentSectionId, updates);
    setShowContentHookModal(false);
    setCurrentSectionId(null);
  };

  // Добавление секции в путеводитель
  const addGuideSection = () => {
    const newSection: GuideSection = {
      id: `section-${Date.now()}`,
      title: '',
      content: '',
      hasMap: false
    };
    setGuideSections([...guideSections, newSection]);
  };
    
  // Обновление секции
  const updateGuideSection = (id: string, updates: Partial<GuideSection>) => {
    setGuideSections(guideSections.map(s => s.id === id ? { ...s, ...updates } : s));
  };
    
  // Удаление секции
  const removeGuideSection = (id: string) => {
    setGuideSections(guideSections.filter(s => s.id !== id));
  };

  // Обработка крючка контента
  const handleHookSelect = (type: HookType, id?: string) => {
    if (type === 'route' && id) {
      setHookRouteId(id);
      setHookMarkerId(null);
      setHookEventId(null);
      setHookType('route');
    } else if (type === 'marker' && id) {
      setHookMarkerId(id);
      setHookRouteId(null);
      setHookEventId(null);
      setHookType('marker');
    } else if (type === 'event' && id) {
      setHookEventId(id);
      setHookRouteId(null);
      setHookMarkerId(null);
      setHookType('event');
    } else {
      setHookType(null);
      setHookRouteId(null);
      setHookMarkerId(null);
      setHookEventId(null);
    }
  };

  // Обработка загрузки фото
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newFiles = [...uploadedFiles, ...files].slice(0, 10); // Максимум 10 фото
    setUploadedFiles(newFiles);
    
    // Создаем превью
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls(newPreviews);
    
    // Очищаем input
    e.target.value = '';
  };
  
  // Удаление фото
  const handleRemovePhoto = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    const newPreviews = photoPreviewUrls.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    setPhotoPreviewUrls(newPreviews);
  };

  // Извлечение трека из маршрута
  const extractTrackFromRoute = (routeId: string | null): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (!routeId || !favorites?.favoriteRoutes) {
      return null;
    }

    const route = favorites.favoriteRoutes.find(r => r.id === routeId);
    if (!route || !route.points || route.points.length < 2) {
      return null;
    }

    // Преобразуем точки маршрута в координаты [longitude, latitude] для GeoJSON
    const coordinates = route.points.map(point => {
      // Проверяем формат координат (может быть [lat, lon] или {latitude, longitude})
      if (Array.isArray(point.coordinates)) {
        const [lat, lon] = point.coordinates;
        return [lon, lat]; // GeoJSON использует [lon, lat]
      } else if (point.latitude !== undefined && point.longitude !== undefined) {
        return [point.longitude, point.latitude];
      } else if (point.coordinates && Array.isArray(point.coordinates)) {
        return point.coordinates.length === 2 ? [point.coordinates[1], point.coordinates[0]] : null;
      }
      return null;
    }).filter((coord): coord is [number, number] => coord !== null);

    if (coordinates.length < 2) {
      return null;
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        routeId: route.id,
        routeTitle: route.title,
        distance: (route as any).totalDistance || 0,
        duration: (route as any).estimatedDuration || 0
      }
    };
  };

  // Получение regionId из геолокации
  const getRegionIdFromGeolocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('default');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Упрощённая логика: определяем регион по координатам
          // Можно улучшить, используя API геокодирования
          if (latitude >= 55 && latitude <= 56 && longitude >= 37 && longitude <= 38) {
            resolve('moscow');
          } else if (latitude >= 59 && latitude <= 60 && longitude >= 30 && longitude <= 31) {
            resolve('spb');
          } else if (latitude >= 43 && latitude <= 45 && longitude >= 39 && longitude <= 41) {
            resolve('krasnodar');
          } else {
            resolve('default');
          }
        },
        () => {
          resolve('default');
        },
        { timeout: 3000 }
      );
    });
  };

  // Сохранение поста офлайн
  const handleSaveOffline = async () => {
    if (postType === 'simple' && !body.trim()) {
      setError('Текст поста обязателен');
      return;
    }
    
    if (postType === 'guide') {
      if (!title.trim()) {
        setError('Заголовок путеводителя обязателен');
        return;
      }
      if (!body.trim()) {
        setError('Вступление путеводителя обязательно');
        return;
      }
      if (guideSections.length === 0) {
        setError('Добавьте хотя бы одну секцию');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      let postBody = body;
      let track: GeoJSON.Feature<GeoJSON.LineString> | null = null;
      let hasTrack = false;
      
      // Для путеводителя формируем структурированный контент
      if (postType === 'guide') {
        const sectionsData = guideSections.map(s => ({
          title: s.title,
          content: s.content,
          hasMap: s.hasMap,
          routeId: s.routeId,
          markerId: s.markerId,
          eventId: s.eventId
        }));
        postBody = JSON.stringify({
          type: 'guide',
          introduction: body,
          sections: sectionsData
        });

        // Извлекаем трек из первой секции с маршрутом
        const firstRouteSection = guideSections.find(s => s.hasMap && s.routeId);
        if (firstRouteSection?.routeId) {
          track = extractTrackFromRoute(firstRouteSection.routeId);
          hasTrack = track !== null;
        }
      } else {
        // Для простого поста извлекаем трек из крючка маршрута
        if (hasHook && hookType === 'route' && hookRouteId) {
          track = extractTrackFromRoute(hookRouteId);
          hasTrack = track !== null;
        }
      }

      // Получаем regionId из геолокации
      const regionId = await getRegionIdFromGeolocation();

      // Сохраняем в IndexedDB
      await offlinePostsStorage.addDraft({
        text: postBody,
        title: title.trim() || undefined, // Добавляем title, если он есть
        images: uploadedFiles, // Сохраняем File объекты напрямую
        track: track,
        status: 'draft',
        regionId: regionId,
        hasImages: uploadedFiles.length > 0,
        hasTrack: hasTrack
      });

      alert('Черновик сохранён офлайн! Он будет отправлен автоматически при появлении интернета.');
      
      // Запускаем автоматическую отправку, если интернет есть
      if (navigator.onLine) {
        const { offlineContentQueue } = await import('../../services/offlineContentQueue');
        offlineContentQueue.start();
      }
      
      onClose();
    } catch (e: any) {
      setError('Не удалось сохранить черновик: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  // Создание поста
  const handleCreatePost = async () => {
    if (postType === 'simple' && !body.trim()) {
      setError('Текст поста обязателен');
      return;
    }
    
    if (postType === 'guide') {
      if (!title.trim()) {
        setError('Заголовок путеводителя обязателен');
        return;
      }
      if (!body.trim()) {
        setError('Вступление путеводителя обязательно');
        return;
      }
      if (guideSections.length === 0) {
        setError('Добавьте хотя бы одну секцию');
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Загружаем фото на сервер
      let photoUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        try {
          const uploadPromises = uploadedFiles.map(async (file) => {
            const formData = new FormData();
            formData.append('image', file);
            const response = await fetch('/api/upload/image', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: formData
            });
            if (response.ok) {
              const data = await response.json();
              return data.photoUrl;
            }
            return null;
          });
          
          const uploadedUrls = await Promise.all(uploadPromises);
          photoUrls = uploadedUrls.filter(url => url !== null) as string[];
        } catch (error) {
          setError('Не удалось загрузить некоторые фото');
        }
      }
      
      let postBody = body;
      
      // Для путеводителя формируем структурированный контент
      if (postType === 'guide') {
        const sectionsData = guideSections.map(s => ({
          title: s.title,
          content: s.content,
          hasMap: s.hasMap,
          routeId: s.routeId,
          markerId: s.markerId,
          eventId: s.eventId
        }));
        postBody = JSON.stringify({
          type: 'guide',
          introduction: body,
          sections: sectionsData
        });
      }
      
      const created = await createPost({
        title: title.trim() || undefined,
        body: postBody,
        route_id: (postType === 'simple' && hasHook && hookType === 'route') ? hookRouteId || undefined : undefined,
        marker_id: (postType === 'simple' && hasHook && hookType === 'marker') ? hookMarkerId || undefined : undefined,
        event_id: (postType === 'simple' && hasHook && hookType === 'event') ? hookEventId || undefined : undefined,
        photo_urls: photoUrls.length > 0 ? photoUrls.join(',') : undefined,
        payload: undefined, // Для путеводителя данные хранятся в body как JSON
        template: postType === 'guide' ? 'article' : 'mobile'
      });
      
      onPostCreated(created);
      onClose();
    } catch (e: any) {
      setError('Не удалось создать пост');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div 
          className="rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          style={{
            background: 'var(--glass-bg-modal)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-panel)',
            boxShadow: 'var(--shadow-panel)'
          }}
        >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Создать пост</h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FaTimes size={20} />
          </button>
        </div>

          {/* Переключатель типа поста */}
          <div className="p-4 border-b" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderColor: 'var(--border-light)' }}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPostType('simple')}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  background: postType === 'simple' ? 'var(--text-accent)' : 'var(--glass-bg)',
                  color: postType === 'simple' ? '#ffffff' : 'var(--text-primary)',
                  backdropFilter: postType !== 'simple' ? 'blur(14px)' : 'none',
                  WebkitBackdropFilter: postType !== 'simple' ? 'blur(14px)' : 'none',
                  border: postType !== 'simple' ? '1px solid var(--border-light)' : 'none',
                  borderRadius: 'var(--radius-panel)'
                }}
              >
                📝 Простой пост
              </button>
              <button
                type="button"
                onClick={() => setPostType('guide')}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  background: postType === 'guide' ? 'var(--text-accent)' : 'var(--glass-bg)',
                  color: postType === 'guide' ? '#ffffff' : 'var(--text-primary)',
                  backdropFilter: postType !== 'guide' ? 'blur(14px)' : 'none',
                  WebkitBackdropFilter: postType !== 'guide' ? 'blur(14px)' : 'none',
                  border: postType !== 'guide' ? '1px solid var(--border-light)' : 'none',
                  borderRadius: 'var(--radius-panel)'
                }}
              >
                🗺️ Путеводитель
              </button>
            </div>
          </div>
          {/* Выбор стиля карты для предпросмотра/поста - показываем только если есть крючок контента */}
          {((postType === 'simple' && hasHook) || (postType === 'guide' && guideSections.some(s => s.hasMap))) && (
            <div className="p-4 border-b" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                <span className="font-medium">Стиль карты:</span>
                <button
                  type="button"
                  onClick={() => setMapBase('opentopo')}
                  className="px-3 py-1.5 rounded"
                  style={{
                    background: mapBase === 'opentopo' ? 'var(--text-accent)' : 'var(--glass-bg)',
                    color: mapBase === 'opentopo' ? '#ffffff' : 'var(--text-primary)',
                    border: mapBase !== 'opentopo' ? '1px solid var(--border-light)' : 'none',
                    backdropFilter: mapBase !== 'opentopo' ? 'blur(14px)' : 'none',
                    WebkitBackdropFilter: mapBase !== 'opentopo' ? 'blur(14px)' : 'none'
                  }}
                >OpenTopoMap</button>
                <button
                  type="button"
                  onClick={() => setMapBase('alidade')}
                  className="px-3 py-1.5 rounded"
                  style={{
                    background: mapBase === 'alidade' ? 'var(--text-accent)' : 'var(--glass-bg)',
                    color: mapBase === 'alidade' ? '#ffffff' : 'var(--text-primary)',
                    border: mapBase !== 'alidade' ? '1px solid var(--border-light)' : 'none',
                    backdropFilter: mapBase !== 'alidade' ? 'blur(14px)' : 'none',
                    WebkitBackdropFilter: mapBase !== 'alidade' ? 'blur(14px)' : 'none'
                  }}
                >Alidade Smooth</button>
              </div>
            </div>
          )}

          {/* Содержимое */}
          <div className="flex-1 overflow-hidden flex">
            {/* Левая панель: редактор */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Заголовок */}
              {(postType === 'simple' || (postType === 'guide' && guideFormatSelected)) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {postType === 'guide' ? 'Заголовок путеводителя *' : 'Заголовок (необязательно)'}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-panel)'
                    }}
                    placeholder={postType === 'guide' ? 'Путешествие по Алтаю...' : 'Введите заголовок...'}
                  />
                </div>
              )}

              {/* Основной текст */}
              {(postType === 'simple' || (postType === 'guide' && guideFormatSelected)) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    {postType === 'guide' ? 'Вступление *' : 'Текст поста *'}
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:border-blue-500 focus:outline-none"
                    placeholder={postType === 'guide' ? 'Краткое описание путешествия...' : 'Напишите ваш пост...'}
                  />
                </div>
              )}
              
              {/* Загрузка фото */}
              {(postType === 'simple' || (postType === 'guide' && guideFormatSelected)) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Фотографии (до 10 штук)
                  </label>
                <div className="border-2 border-dashed rounded-lg p-4" style={{ borderColor: 'var(--border-light)', borderRadius: 'var(--radius-panel)' }}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploadedFiles.length >= 10}
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer flex flex-col items-center justify-center py-4"
                    style={{
                      opacity: uploadedFiles.length >= 10 ? 0.5 : 1,
                      cursor: uploadedFiles.length >= 10 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <FaPlus size={24} className="mb-2" style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {uploadedFiles.length >= 10 ? 'Достигнут лимит фото' : 'Нажмите для загрузки фото'}
                    </span>
                  </label>
                  
                  {/* Превью фото */}
                  {photoPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Превью ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}
              
              {/* Простой пост: крючок контента */}
              {postType === 'simple' && (
                <div className="border rounded-lg p-4" style={{ borderColor: 'var(--border-light)', borderRadius: 'var(--radius-panel)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={hasHook}
                        onChange={(e) => {
                          setHasHook(e.target.checked);
                          if (!e.target.checked) {
                            handleHookSelect(null);
                          }
                        }}
                        className="w-4 h-4"
                      />
                      Добавить крючок контента
                    </label>
            </div>
            
                  {hasHook && (
                    <div className="space-y-4">
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Маршруты</div>
                      {(favorites?.favoriteRoutes && (favorites.favoriteRoutes.filter(r => r.purpose === 'post').length > 0
                        ? favorites.favoriteRoutes.filter(r => r.purpose === 'post')
                        : favorites.favoriteRoutes)).map(route => (
                <button
                  key={route.id}
                          onClick={() => handleHookSelect('route', route.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                          style={{
                            background: hookType === 'route' && hookRouteId === route.id ? 'rgba(76, 201, 240, 0.3)' : 'var(--glass-bg)',
                            color: hookType === 'route' && hookRouteId === route.id ? 'var(--text-accent)' : 'var(--text-primary)',
                            border: hookType === 'route' && hookRouteId === route.id ? '2px solid var(--text-accent)' : '1px solid var(--border-light)',
                            backdropFilter: hookType !== 'route' || hookRouteId !== route.id ? 'blur(14px)' : 'none',
                            WebkitBackdropFilter: hookType !== 'route' || hookRouteId !== route.id ? 'blur(14px)' : 'none',
                            borderRadius: 'var(--radius-panel)'
                          }}
                >
                  <FaRoute size={14} />
                          <span className="flex-1 text-left">{route.title}</span>
                </button>
              ))}
                      <div className="text-xs font-semibold uppercase tracking-wide mt-4" style={{ color: 'var(--text-secondary)' }}>Метки</div>
                      {(favorites?.favoritePlaces && (favorites.favoritePlaces.filter(p => (p as any).purpose === 'post').length > 0
                        ? favorites.favoritePlaces.filter(p => (p as any).purpose === 'post')
                        : favorites.favoritePlaces)).map(place => (
                <button
                  key={place.id}
                          onClick={() => handleHookSelect('marker', place.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                          style={{
                            background: hookType === 'marker' && hookMarkerId === place.id ? 'rgba(76, 201, 240, 0.3)' : 'var(--glass-bg)',
                            color: hookType === 'marker' && hookMarkerId === place.id ? 'var(--text-accent)' : 'var(--text-primary)',
                            border: hookType === 'marker' && hookMarkerId === place.id ? '2px solid var(--text-accent)' : '1px solid var(--border-light)',
                            backdropFilter: hookType !== 'marker' || hookMarkerId !== place.id ? 'blur(14px)' : 'none',
                            WebkitBackdropFilter: hookType !== 'marker' || hookMarkerId !== place.id ? 'blur(14px)' : 'none',
                            borderRadius: 'var(--radius-panel)'
                          }}
                >
                  <FaMapMarkerAlt size={14} />
                          <span className="flex-1 text-left">{place.name}</span>
                </button>
              ))}
                      <div className="text-xs font-semibold uppercase tracking-wide mt-4" style={{ color: 'var(--text-secondary)' }}>События</div>
                      {(favorites?.favoriteEvents && (favorites.favoriteEvents.filter(e => (e as any).purpose === 'post').length > 0
                        ? favorites.favoriteEvents.filter(e => (e as any).purpose === 'post')
                        : favorites.favoriteEvents)).map(event => (
                <button
                  key={event.id}
                          onClick={() => handleHookSelect('event', event.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                          style={{
                            background: hookType === 'event' && hookEventId === event.id ? 'rgba(185, 103, 255, 0.3)' : 'var(--glass-bg)',
                            color: hookType === 'event' && hookEventId === event.id ? '#b967ff' : 'var(--text-primary)',
                            border: hookType === 'event' && hookEventId === event.id ? '2px solid #b967ff' : '1px solid var(--border-light)',
                            backdropFilter: hookType !== 'event' || hookEventId !== event.id ? 'blur(14px)' : 'none',
                            WebkitBackdropFilter: hookType !== 'event' || hookEventId !== event.id ? 'blur(14px)' : 'none',
                            borderRadius: 'var(--radius-panel)'
                          }}
                >
                  <FaCalendar size={14} />
                          <span className="flex-1 text-left">{event.title}</span>
                </button>
              ))}
            </div>
                  )}
              </div>
            )}

              {/* Путеводитель: выбор формата и секции */}
              {postType === 'guide' && (
                <div className="space-y-6">
                  {/* Шаг 1: Выбор формата (если еще не выбран) */}
                  {!guideFormatSelected ? (
                    <div>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Выберите формат путеводителя</h3>
                        <p className="text-sm text-gray-600">Выберите, как вы хотите оформить свой путеводитель</p>
                      </div>
                      <GuideFormatSelector
                        selectedFormat={guideFormat}
                        onFormatChange={handleFormatSelect}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Индикатор выбранного формата */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                              {guideFormat === 'mobile' && '📱'}
                              {guideFormat === 'desktop' && '💻'}
                              {guideFormat === 'article' && '📄'}
                              {guideFormat === 'focus' && '🎯'}
                            </div>
                            <div>
                              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {guideFormat === 'mobile' && 'Мобильный гид'}
                                {guideFormat === 'desktop' && 'Десктоп-обзор'}
                                {guideFormat === 'article' && 'Статья-исследование'}
                                {guideFormat === 'focus' && 'Фокус-гайд'}
                              </div>
                              <div className="text-xs text-gray-600">Формат выбран</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setGuideFormatSelected(false)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Изменить
                          </button>
                        </div>
                      </div>

                      {/* Шаг 2: Создание контента */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-gray-700">Секции путеводителя</h3>
                          <button
                            type="button"
                            onClick={addGuideSection}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            <FaPlus size={12} />
                            Добавить секцию
                          </button>
                        </div>

                        {guideSections.map((section, idx) => (
                          <div key={section.id} className="border border-gray-200 rounded-lg p-4 space-y-3 mb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">Секция {idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeGuideSection(section.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <FaTrash size={14} />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) => updateGuideSection(section.id, { title: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                              placeholder="Заголовок секции..."
                            />
                            
                            <textarea
                              value={section.content}
                              onChange={(e) => updateGuideSection(section.id, { content: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:border-blue-500 focus:outline-none"
                              placeholder="Текст секции..."
                            />
                            
                            {/* Кнопка добавления крючка контента */}
                            <div className="flex items-center gap-2">
                              {section.hasMap ? (
                                <div className="flex items-center gap-2 flex-1">
                                  {section.routeId && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                      <FaRoute size={14} className="text-blue-600" />
                                      <span className="text-sm text-blue-800">Маршрут добавлен</span>
                                      <button
                                        type="button"
                                        onClick={() => updateGuideSection(section.id, { hasMap: false, routeId: undefined })}
                                        className="text-blue-600 hover:text-blue-800 ml-2"
                                      >
                                        <FaTimes size={12} />
                                      </button>
                                    </div>
                                  )}
                                  {section.markerId && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                                      <FaMapMarkerAlt size={14} className="text-green-600" />
                                      <span className="text-sm text-green-800">Метка добавлена</span>
                                      <button
                                        type="button"
                                        onClick={() => updateGuideSection(section.id, { hasMap: false, markerId: undefined })}
                                        className="text-green-600 hover:text-green-800 ml-2"
                                      >
                                        <FaTimes size={12} />
                                      </button>
                                    </div>
                                  )}
                                  {section.eventId && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                                      <FaCalendar size={14} className="text-purple-600" />
                                      <span className="text-sm text-purple-800">Событие добавлено</span>
                                      <button
                                        type="button"
                                        onClick={() => updateGuideSection(section.id, { hasMap: false, eventId: undefined })}
                                        className="text-purple-600 hover:text-purple-800 ml-2"
                                      >
                                        <FaTimes size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex gap-2 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => openContentHookModal(section.id, 'routes')}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-sm transition-colors"
                                  >
                                    <FaRoute size={14} />
                                    Маршрут
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openContentHookModal(section.id, 'markers')}
                                    className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 text-sm transition-colors"
                                  >
                                    <FaMapMarkerAlt size={14} />
                                    Метка
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openContentHookModal(section.id, 'events')}
                                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 text-sm transition-colors"
                                  >
                                    <FaCalendar size={14} />
                                    Событие
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

          {/* Ошибка */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
            </div>

            {/* Правая панель: предпросмотр */}
            <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Предпросмотр</h3>
                <button
                  type="button"
                  onClick={() => setPreviewExpanded(!previewExpanded)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {previewExpanded ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
              </div>
              
              <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
                previewExpanded ? 'min-h-[600px]' : ''
              }`}>
                {postType === 'simple' ? (
                  <div className="space-y-3">
                    {title && (
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                    )}
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{body || 'Введите текст...'}</p>
                    {photoPreviewUrls.length > 0 && (
                      <div className="grid gap-2" style={{ gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : photoPreviewUrls.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
                        {photoPreviewUrls.map((url, index) => (
                          <img key={index} src={url} alt={`Фото ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        ))}
                      </div>
                    )}
                    {hasHook && hookType === 'route' && hookRouteId && (
                      <div className="h-32 rounded-lg overflow-hidden">
                        <MiniMapRoute routeId={hookRouteId} height="128px" glBase={mapBase} />
                      </div>
                    )}
                    {hasHook && hookType === 'marker' && hookMarkerId && (
                      <div className="h-32 rounded-lg overflow-hidden">
                        <MiniMapMarker markerId={hookMarkerId} height="128px" glBase={mapBase} />
                      </div>
                    )}
                    {hasHook && hookType === 'event' && hookEventId && (
                      <div className="h-32 rounded-lg overflow-hidden">
                        <MiniEventCard eventId={hookEventId} height="128px" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {title && (
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-lg">
                        <h2 className="text-xl font-bold">{title}</h2>
                      </div>
                    )}
                    {body && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{body}</p>
                    )}
                    {/* Фото галерея */}
                    {photoPreviewUrls && photoPreviewUrls.length > 0 && (
                      <div className="grid gap-2" style={{
                        gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : 
                                             photoPreviewUrls.length === 2 ? '1fr 1fr' : 
                                             'repeat(3, 1fr)'
                      }}>
                        {photoPreviewUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Фото ${idx + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Карта для мобильной версии - собираем все крючки */}
                    {guideFormat === 'mobile' && (() => {
                      const hasAnyHooks = guideSections.some(s => s.hasMap && (s.routeId || s.markerId || s.eventId));
                      if (!hasAnyHooks) return null;
                      
                      const firstRoute = guideSections.find(s => s.hasMap && s.routeId);
                      const firstMarker = guideSections.find(s => s.hasMap && s.markerId);
                      const firstEvent = guideSections.find(s => s.hasMap && s.eventId);
                      
                      return (
                        <div className="h-32 rounded-lg overflow-hidden bg-gray-800">
                          {firstRoute && (
                            <MiniMapRoute routeId={firstRoute.routeId!} height="128px" glBase={mapBase} />
                          )}
                          {!firstRoute && firstMarker && (
                            <MiniMapMarker markerId={firstMarker.markerId!} height="128px" glBase={mapBase} />
                          )}
                          {!firstRoute && !firstMarker && firstEvent && (
                            <MiniEventCard eventId={firstEvent.eventId!} height="128px" />
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Оглавление - только для desktop и article */}
                    {(guideFormat === 'desktop' || guideFormat === 'article') && guideSections.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Оглавление</h4>
                        <ul className="space-y-1">
                          {guideSections.map((s, idx) => (
                            <li key={s.id} className="text-xs text-gray-600">
                              {idx + 1}. {s.title || `Секция ${idx + 1}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Секции */}
                    {guideSections.map((section, idx) => (
                      <div key={section.id} className={`border rounded-lg p-3 ${
                        guideFormat === 'focus' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                      }`}>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                          {guideFormat === 'focus' && '✅ '}
                          {section.title || `Секция ${idx + 1}`}
                        </h4>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap mb-2">
                          {section.content || 'Текст секции...'}
                        </p>
                        {section.hasMap && section.routeId && (
                          <div className="h-24 rounded overflow-hidden">
                            <MiniMapRoute routeId={section.routeId} height="96px" glBase={mapBase} />
                          </div>
                        )}
                        {section.hasMap && section.markerId && (
                          <div className="h-24 rounded overflow-hidden">
                            <MiniMapMarker markerId={section.markerId} height="96px" glBase={mapBase} />
                          </div>
                        )}
                        {section.hasMap && section.eventId && (
                          <div className="h-24 rounded overflow-hidden">
                            <MiniEventCard eventId={section.eventId} height="96px" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FaEye size={14} />
              {showPreview ? 'Скрыть' : 'Показать'} предпросмотр
            </button>
            <button
              onClick={handleSaveOffline}
              disabled={loading || (postType === 'simple' && !body.trim()) || (postType === 'guide' && (!title.trim() || !body.trim() || guideSections.length === 0))}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Сохранить черновик офлайн для отправки позже"
            >
              <FaCloud size={14} />
              Сохранить офлайн
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleCreatePost}
              disabled={loading || (postType === 'simple' && !body.trim()) || (postType === 'guide' && (!title.trim() || !body.trim() || guideSections.length === 0))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <FaPaperPlane size={14} />
                  Опубликовать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Полноэкранный предпросмотр */}
      {showPreview && (
        <PostPreview
          title={title}
          body={body}
          postType={postType}
          hasHook={hasHook}
          hookType={hookType}
          hookRouteId={hookRouteId}
          hookMarkerId={hookMarkerId}
          hookEventId={hookEventId}
          guideSections={guideSections}
          guideFormat={guideFormat}
          photoPreviewUrls={photoPreviewUrls}
          mapBase={mapBase}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Модальное окно для выбора крючка контента в секции */}
      {showContentHookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Выберите {contentHookType === 'routes' ? 'маршрут' : contentHookType === 'markers' ? 'метку' : 'событие'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowContentHookModal(false);
                  setCurrentSectionId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {contentHookType === 'routes' && (
                <>
                  {(favorites?.favoriteRoutes && (() => {
                    const postRoutes = favorites.favoriteRoutes.filter((r: any) => 
                      r.categories?.post || r.purpose === 'post' || 
                      (Array.isArray(r.tags) && r.tags.includes('post'))
                    );
                    const routesToShow = postRoutes.length > 0 ? postRoutes : favorites.favoriteRoutes;
                    return routesToShow.map((route: any) => (
                      <button
                        key={route.id}
                        onClick={() => addContentHookToSection('routes', route.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                      >
                        <FaRoute size={16} className="text-blue-600" />
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{route.title}</div>
                          {route.description && (
                            <div className="text-sm text-gray-600 mt-1">{route.description.substring(0, 100)}...</div>
                          )}
                        </div>
                      </button>
                    ));
                  })())}
                </>
              )}

              {contentHookType === 'markers' && (
                <>
                  {(favorites?.favoritePlaces && (() => {
                    const postPlaces = favorites.favoritePlaces.filter((p: any) => 
                      (p as any).categories?.post || (p as any).purpose === 'post' ||
                      (Array.isArray((p as any).tags) && (p as any).tags.includes('post'))
                    );
                    const placesToShow = postPlaces.length > 0 ? postPlaces : favorites.favoritePlaces;
                    return placesToShow.map((place: any) => (
                      <button
                        key={place.id}
                        onClick={() => addContentHookToSection('markers', place.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 hover:border-green-300 transition-colors text-left"
                      >
                        <FaMapMarkerAlt size={16} className="text-green-600" />
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{place.name}</div>
                          {place.description && (
                            <div className="text-sm text-gray-600 mt-1">{place.description.substring(0, 100)}...</div>
                          )}
                        </div>
                      </button>
                    ));
                  })())}
                </>
              )}

              {contentHookType === 'events' && (
                <>
                  {(favorites?.favoriteEvents && (() => {
                    const postEvents = favorites.favoriteEvents.filter((e: any) => 
                      e.categories?.post || e.purpose === 'post' ||
                      (Array.isArray(e.tags) && e.tags.includes('post'))
                    );
                    const eventsToShow = postEvents.length > 0 ? postEvents : favorites.favoriteEvents;
                    return eventsToShow.map((event: any) => (
                      <button
                        key={event.id}
                        onClick={() => addContentHookToSection('events', event.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-purple-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors text-left"
                      >
                        <FaCalendar size={16} className="text-purple-600" />
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</div>
                          {event.description && (
                            <div className="text-sm text-gray-600 mt-1">{event.description.substring(0, 100)}...</div>
                          )}
                          {event.date && (
                            <div className="text-xs text-gray-500 mt-1">
                              {typeof event.date === 'string' ? event.date : event.date instanceof Date ? event.date.toLocaleDateString('ru-RU') : 'Не указано'}
                            </div>
                          )}
                        </div>
                      </button>
                    ));
                  })())}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreatePostModal;
