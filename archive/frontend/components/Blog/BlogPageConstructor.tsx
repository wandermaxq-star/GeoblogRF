import React, { useState, useEffect, useMemo } from 'react';
import { FaTimes, FaPlus, FaEye, FaSave, FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useFavorites } from '../../contexts/FavoritesContext';
import useFavoriteRoutes from '../../hooks/useFavoriteRoutes';
import MiniMapMarker from '../Posts/MiniMapMarker';
import MiniMapRoute from '../Posts/MiniMapRoute';
import MiniEventCard from '../Posts/MiniEventCard';
import ContentAddMenu from './ContentAddMenu';
import { MarkerData } from '../../types/marker';
import { Route as RouteData } from '../../types/route';
import { EventData } from '../../types/blog';

type HookType = 'route' | 'marker' | 'event' | null;

interface BlogPage {
  id: string;
  leftContent: {
    type: HookType;
    markerId?: string;
    routeId?: string;
    eventId?: string;
  };
  rightContent: {
    text: string;
    photos: string[];
  };
}

interface BlogPageConstructorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, preview: string, pages: BlogPage[]) => void;
  initialTitle?: string;
  initialPreview?: string;
  initialPages?: BlogPage[];
}

const BlogPageConstructor: React.FC<BlogPageConstructorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTitle = '',
  initialPreview = '',
  initialPages = []
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [preview, setPreview] = useState(initialPreview);
  const [pages, setPages] = useState<BlogPage[]>(initialPages.length > 0 ? initialPages : []);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showContentMenu, setShowContentMenu] = useState(false);
  const [selectedHookType, setSelectedHookType] = useState<HookType>(null);
  const [mapBase, setMapBase] = useState<'opentopo' | 'alidade'>('opentopo');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const favorites = useFavorites();
  const { favoriteRoutes } = useFavoriteRoutes();

  // Фильтруем только те элементы, которые помечены для блогов (как в CreatePostModal для постов)
  const availableMarkers = useMemo(() => {
    if (!favorites?.favoritePlaces) return [];
    // Сначала ищем элементы с purpose === 'blog', если таких нет - показываем все избранные
    const blogMarkers = favorites.favoritePlaces.filter((p: any) => 
      p.purpose === 'blog' || 
      p.categories?.blog || 
      (Array.isArray(p.tags) && p.tags.includes('blog'))
    );
    const allMarkers = blogMarkers.length > 0 ? blogMarkers : favorites.favoritePlaces;
    // Преобразуем FavoritePlace в MarkerData
    return allMarkers.map((place: any) => ({
      id: place.id,
      title: place.name || '',
      description: place.description || '',
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category || place.type || '',
      rating: place.rating || 0,
      rating_count: 0,
      photo_urls: (place as any).photo_urls || (place as any).photoUrls || [],
      hashtags: place.tags || [],
      author_name: (place as any).author_name || 'Неизвестно',
      created_at: place.created_at || new Date().toISOString(),
      updated_at: place.updated_at || new Date().toISOString(),
      likes_count: (place as any).likes_count || 0,
      comments_count: (place as any).comments_count || 0,
      shares_count: (place as any).shares_count || 0,
      address: place.location || '',
      is_verified: false,
    } as MarkerData));
  }, [favorites?.favoritePlaces]);

  const availableRoutes = useMemo(() => {
    if (!favoriteRoutes) return [];
    // Сначала ищем маршруты с purpose === 'blog', если таких нет - показываем все избранные
    const blogRoutes = favoriteRoutes.filter((r: any) => 
      r.purpose === 'blog' || 
      r.categories?.blog ||
      (Array.isArray(r.tags) && r.tags.includes('blog'))
    );
    return blogRoutes.length > 0 ? blogRoutes : favoriteRoutes;
  }, [favoriteRoutes]);

  const availableEvents = useMemo(() => {
    if (!favorites?.favoriteEvents) return [];
    // Сначала ищем события с purpose === 'blog', если таких нет - показываем все избранные
    const blogEvents = favorites.favoriteEvents.filter((e: any) => 
      e.purpose === 'blog' || 
      e.categories?.blog ||
      (Array.isArray(e.tags) && e.tags.includes('blog'))
    );
    const allEvents = blogEvents.length > 0 ? blogEvents : favorites.favoriteEvents;
    // Преобразуем FavoriteEvent в EventData
    return allEvents.map((event: any) => {
      // Преобразуем date в строку, если это Date объект
      let dateStr = '';
      if (event.date) {
        dateStr = event.date instanceof Date ? event.date.toISOString() : String(event.date);
      } else if (event.start_date) {
        dateStr = event.start_date instanceof Date ? event.start_date.toISOString() : String(event.start_date);
      } else if (event.startDate) {
        dateStr = event.startDate instanceof Date ? event.startDate.toISOString() : String(event.startDate);
      } else {
        dateStr = new Date().toISOString();
      }
      
      return {
        id: event.id,
        title: event.title || '',
        description: event.description || '',
        date: dateStr,
        time: event.time || '',
        location: event.location || '',
        participants: Array.isArray(event.participants) ? event.participants : 
          (typeof event.participants === 'string' ? [event.participants] : []),
      } as EventData;
    });
  }, [favorites?.favoriteEvents]);

  // Автоматически создаем первую страницу при открытии
  useEffect(() => {
    if (isOpen && pages.length === 0 && initialPages.length === 0) {
      const firstPage: BlogPage = {
        id: `page-${Date.now()}`,
        leftContent: {
          type: null
        },
        rightContent: {
          text: '',
          photos: []
        }
      };
      setPages([firstPage]);
      setCurrentPageIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setPreview('');
      setPages([]);
      setCurrentPageIndex(0);
      setShowContentMenu(false);
      setSelectedHookType(null);
      setShowPreview(false);
    } else {
      setTitle(initialTitle);
      setPreview(initialPreview);
      if (initialPages.length > 0) {
        setPages(initialPages);
      }
    }
  }, [isOpen, initialTitle, initialPreview, initialPages]);

  // Создать новую страницу
  const addPage = () => {
    const newPage: BlogPage = {
      id: `page-${Date.now()}`,
      leftContent: {
        type: null
      },
      rightContent: {
        text: '',
        photos: []
      }
    };
    setPages([...pages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  // Удалить страницу
  const removePage = (pageId: string) => {
    if (pages.length <= 1) {
      alert('Должна быть хотя бы одна страница');
      return;
    }
    const newPages = pages.filter(p => p.id !== pageId);
    setPages(newPages);
    if (currentPageIndex >= newPages.length) {
      setCurrentPageIndex(Math.max(0, newPages.length - 1));
    }
  };

  // Обновить текущую страницу
  const updateCurrentPage = (updates: Partial<BlogPage>) => {
    setPages(pages.map((p, idx) => 
      idx === currentPageIndex ? { ...p, ...updates } : p
    ));
  };

  const currentPage = pages[currentPageIndex];

  // Обработка выбора типа крючка
  const handleHookTypeSelect = (type: HookType) => {
    setSelectedHookType(type);
    setShowContentMenu(true);
  };

  // Обработка добавления маркера
  const handleAddMarker = (marker: MarkerData) => {
    if (currentPage) {
      updateCurrentPage({
        leftContent: {
          type: 'marker',
          markerId: marker.id
        }
      });
    }
    setShowContentMenu(false);
    setSelectedHookType(null);
  };

  // Обработка добавления маршрута
  const handleAddRoute = (route: RouteData) => {
    if (currentPage) {
      updateCurrentPage({
        leftContent: {
          type: 'route',
          routeId: route.id
        }
      });
    }
    setShowContentMenu(false);
    setSelectedHookType(null);
  };

  // Обработка добавления события
  const handleAddEvent = (event: EventData) => {
    if (currentPage) {
      updateCurrentPage({
        leftContent: {
          type: 'event',
          eventId: event.id
        }
      });
    }
    setShowContentMenu(false);
    setSelectedHookType(null);
  };

  // Обработка загрузки фото для текущей страницы
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && currentPage) {
      const newPhotos: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          newPhotos.push(url);
          if (newPhotos.length === files.length) {
            updateCurrentPage({
              rightContent: {
                ...currentPage.rightContent,
                photos: [...currentPage.rightContent.photos, ...newPhotos]
              }
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Удалить фото
  const removePhoto = (photoIndex: number) => {
    if (currentPage) {
      updateCurrentPage({
        rightContent: {
          ...currentPage.rightContent,
          photos: currentPage.rightContent.photos.filter((_, idx) => idx !== photoIndex)
        }
      });
    }
  };

  // Сохранение
  const handleSave = async () => {
    if (!title.trim()) {
      alert('Введите заголовок блога');
      return;
    }
    if (pages.length === 0) {
      alert('Добавьте хотя бы одну страницу');
      return;
    }
    setLoading(true);
    try {
      await onSave(title, preview, pages);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Заголовок */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">Создать блог</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>

          {/* Выбор стиля карты */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="font-medium">Стиль карты:</span>
              <button
                type="button"
                onClick={() => setMapBase('opentopo')}
                className={`px-3 py-1.5 rounded ${mapBase === 'opentopo' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
              >OpenTopoMap</button>
              <button
                type="button"
                onClick={() => setMapBase('alidade')}
                className={`px-3 py-1.5 rounded ${mapBase === 'alidade' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
              >Alidade Smooth</button>
            </div>
          </div>

          {/* Содержимое */}
          <div className="flex-1 overflow-hidden flex">
            {/* Левая панель: редактор */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Заголовок блога */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Заголовок блога *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Путешествие по Алтаю..."
                />
              </div>

              {/* Вступление */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Вступление *
                </label>
                <textarea
                  value={preview}
                  onChange={(e) => setPreview(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[120px] focus:border-blue-500 focus:outline-none"
                  placeholder="Краткое описание путешествия..."
                />
              </div>

              {/* Страницы блога */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Страницы блога
                  </label>
                  {pages.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0}
                        className="p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaChevronLeft />
                      </button>
                      <span className="text-xs text-gray-600">
                        Страница {currentPageIndex + 1} из {pages.length}
                      </span>
                      <button
                        onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === pages.length - 1}
                        className="p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                  )}
                </div>

                {pages.length > 0 && currentPage && (
                  <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                    {/* Левая часть страницы - Карта */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Левая часть (Интерактивный контент)
                      </label>
                      {currentPage.leftContent.type ? (
                        <div className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              {currentPage.leftContent.type === 'marker' && '📍 Метка'}
                              {currentPage.leftContent.type === 'route' && '🛣️ Маршрут'}
                              {currentPage.leftContent.type === 'event' && '📅 Событие'}
                            </span>
                            <button
                              onClick={() => updateCurrentPage({ leftContent: { type: null } })}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleHookTypeSelect('marker')}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              📍 Метка
                            </button>
                            <button
                              onClick={() => handleHookTypeSelect('route')}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              🛣️ Маршрут
                            </button>
                            <button
                              onClick={() => handleHookTypeSelect('event')}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            >
                              📅 Событие
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Правая часть страницы - Текст и фото */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Правая часть (Текст и фото)
                      </label>
                      <textarea
                        value={currentPage.rightContent.text}
                        onChange={(e) => updateCurrentPage({
                          rightContent: {
                            ...currentPage.rightContent,
                            text: e.target.value
                          }
                        })}
                        placeholder="Введите текст описания..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px] focus:border-blue-500 focus:outline-none"
                      />
                      
                      {/* Загрузка фото для страницы */}
                      <div className="mt-3">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id={`photo-upload-${currentPage.id}`}
                            disabled={currentPage.rightContent.photos.length >= 10}
                          />
                          <label
                            htmlFor={`photo-upload-${currentPage.id}`}
                            className={`cursor-pointer flex flex-col items-center justify-center py-2 ${
                              currentPage.rightContent.photos.length >= 10 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                            }`}
                          >
                            <FaPlus size={20} className="text-gray-400 mb-1" />
                            <span className="text-xs text-gray-600">
                              {currentPage.rightContent.photos.length >= 10 ? 'Достигнут лимит фото' : 'Нажмите для загрузки фото'}
                            </span>
                          </label>
                          
                          {/* Превью фото */}
                          {currentPage.rightContent.photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              {currentPage.rightContent.photos.map((photo, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={photo}
                                    alt={`Фото ${idx + 1}`}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(idx)}
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
                    </div>
                  </div>
                )}

                {/* Кнопка добавления страницы */}
                <button
                  onClick={addPage}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaPlus size={14} />
                  Добавить страницу
                </button>
              </div>
            </div>

            {/* Правая панель - Предпросмотр */}
            <div className="w-96 border-l bg-gray-50 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Предпросмотр</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <FaEye size={16} />
                </button>
              </div>
              {pages.length === 0 ? (
                <div className="text-center text-gray-500 py-12 text-sm">
                  Добавьте страницу для предпросмотра
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page, idx) => (
                    <div key={page.id} className="bg-white rounded-lg shadow p-3">
                      <div className="text-xs text-gray-500 mb-2">Страница {idx + 1}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Левая часть - Карта */}
                        <div className="border rounded p-2" style={{ height: '200px' }}>
                          {page.leftContent.type === 'marker' && page.leftContent.markerId && (
                            <MiniMapMarker markerId={page.leftContent.markerId} height="200px" />
                          )}
                          {page.leftContent.type === 'route' && page.leftContent.routeId && (
                            <MiniMapRoute routeId={page.leftContent.routeId} height="200px" />
                          )}
                          {page.leftContent.type === 'event' && page.leftContent.eventId && (
                            <MiniEventCard eventId={page.leftContent.eventId} height="200px" />
                          )}
                          {!page.leftContent.type && (
                            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                              Карта
                            </div>
                          )}
                        </div>
                        {/* Правая часть - Текст */}
                        <div className="border rounded p-2">
                          <div className="text-xs whitespace-pre-wrap mb-2">
                            {page.rightContent.text || <span className="text-gray-400">Текст описания</span>}
                          </div>
                          {page.rightContent.photos.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 mt-2">
                              {page.rightContent.photos.slice(0, 4).map((photo, photoIdx) => (
                                <img key={photoIdx} src={photo} alt={`Фото ${photoIdx + 1}`} className="w-full h-16 object-cover rounded" />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Футер */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <FaEye size={14} />
              {showPreview ? 'Скрыть' : 'Показать'} предпросмотр
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={loading || pages.length === 0 || !title.trim() || !preview.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <FaSave size={14} />
                  Опубликовать
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Меню выбора контента */}
      <ContentAddMenu
        isOpen={showContentMenu}
        onClose={() => {
          setShowContentMenu(false);
          setSelectedHookType(null);
        }}
        onAddMarker={handleAddMarker}
        onAddRoute={handleAddRoute}
        onAddEvent={handleAddEvent}
        availableMarkers={availableMarkers}
        availableRoutes={availableRoutes}
        availableEvents={availableEvents}
        initialTab={selectedHookType === 'marker' ? 'markers' : selectedHookType === 'route' ? 'routes' : 'events'}
      />
    </>
  );
};

export default BlogPageConstructor;
