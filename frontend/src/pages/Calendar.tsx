// src/pages/Calendar.tsx
import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FaCalendar as _FaCalendar, FaCog as _FaCog, FaTimes as _FaTimes, FaQuestion, FaSearch, FaListAlt, FaMapMarkerAlt, FaCamera, FaLeaf } from 'react-icons/fa'; // future use
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { GlassPanel, GlassHeader } from '../components/Glass';
import '../styles/PageLayout.css';
import CalendarActionButtons from '../components/Calendar/CalendarActionButtons';
import '../components/Calendar/CalendarViewSwitcher.css';

// Импортируем все компоненты сразу для быстрой загрузки
import { TravelCalendar, categories } from '../components/TravelCalendar';
import { SmartEventSearch } from '../components/Events/SmartEventSearch';
import { EventPreview } from '../components/Events/EventPreview';
import { EventBlocksSelector } from '../components/Events/EventBlocksSelector';
import { EventBlocksEditor } from '../components/Events/EventBlocksEditor';
import EventLocationPicker from '../components/Events/EventLocationPicker';
import EventLocationModal from '../components/Events/EventLocationModal';
import storageService from '../services/storageService';
import { GlassButton } from '../components/Glass';
import GlassAccordion from '../components/Glass/GlassAccordion';
import RegionSelector from '../components/Regions/RegionSelector';
import { useGuest } from '../contexts/GuestContext';
import { useAuth } from '../contexts/AuthContext';
import AdminModerationModal from '../components/Moderation/AdminModerationModal';
import { getPendingContentCounts } from '../services/localModerationStorage';
import { offlineContentStorage, OfflineEventDraft } from '../services/offlineContentStorage';
import { MockEvent } from '../components/TravelCalendar/mockEvents';
import { FaCloud } from 'react-icons/fa';

const CalendarPage: React.FC = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const { addEvent: addGuestEvent } = useGuest();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);

  // Загружаем счётчик модерации
  useEffect(() => {
    if (isAdmin) {
      const counts = getPendingContentCounts();
      setModerationCount(counts.event);
    }
  }, [isAdmin]);


  // Состояния для боковых панелей
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showEventPreview, setShowEventPreview] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Режим отображения календаря (всегда начинаем с месяца)
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Состояние конструктора событий
  const [eventConstructor, setEventConstructor] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: {
      title: '',
      address: '',
      coordinates: { lat: 0, lng: 0 }
    },
    category: '',
    hashtags: [] as string[],
    hashtagInput: '',
    photos: [] as string[],
    coverImageUrl: undefined as string | undefined,
    // Дополнительные блоки
    selectedBlocks: [] as string[],
    blocks: {
      howToGet: {
        metro: '',
        car: '',
        bus: ''
      },
      whereToStay: [] as Array<{
        name: string;
        distance: string;
        price: string;
      }>,
      whereToEat: [] as Array<{
        name: string;
        distance: string;
        cuisine: string;
      }>,
      whatToSee: [] as Array<{
        name: string;
        distance: string;
        description: string;
      }>
    },
    // Дополнительные параметры
    organizer: '',
    budget: '',
    difficulty: '',
    status: '',
    // Состояния аккордеона
    showBasicInfo: false,
    showCategories: false,
    showLocation: false,
    showAdditional: false,
    showSeasonsHashtags: false,
    showPhotos: false,
    showAdditionalParams: false
  });

  // Локальная оценка полноты события (зеркало бэкенда)
  const completeness = useMemo(() => {
    let score = 0;
    let max = 0;
    const add = (ok: boolean, weight: number) => { max += weight; if (ok) score += weight; };

    add((eventConstructor.title?.trim()?.length || 0) >= 5, 20);
    add((eventConstructor.description?.trim()?.length || 0) >= 80, 25);
    add(!!eventConstructor.date, 15);
    add((eventConstructor.location?.title?.trim()?.length || 0) > 0, 10); // city surrogate
    add(typeof eventConstructor.location?.coordinates?.lat === 'number' && typeof eventConstructor.location?.coordinates?.lng === 'number', 10);
    add((eventConstructor.photos?.length || 0) > 0, 10);
    add(!!eventConstructor.category, 10);

    const percent = max ? Math.round((score / max) * 100) : 0;
    const status = percent >= 90 ? 'excellent' : percent >= 80 ? 'good' : percent >= 60 ? 'acceptable' : percent >= 40 ? 'poor' : 'incomplete';
    return { score: percent, status };
  }, [eventConstructor]);

  // Оценка очков за привязки (MVP): где жить/есть/как добраться/что посмотреть
  const pointsEstimate = useMemo(() => {
    const statusPoints = { excellent: 50, good: 35, acceptable: 20, poor: 10, incomplete: 0 } as const;
    const base = statusPoints[completeness.status as keyof typeof statusPoints] ?? 0;
    const hotels = eventConstructor.blocks.whereToStay?.length || 0;
    const restaurants = eventConstructor.blocks.whereToEat?.length || 0;
    const see = eventConstructor.blocks.whatToSee?.length || 0; // не даем бонус сейчас
    const routes = eventConstructor.selectedBlocks.includes('howToGet') ? 1 : 0; // если указан блок "как добраться"
    const attach = hotels * 5 + (routes * 8) + restaurants * 4;
    return { base, attach, total: base + attach };
  }, [completeness.status, eventConstructor.blocks.whereToStay, eventConstructor.blocks.whereToEat, eventConstructor.blocks.whatToSee, eventConstructor.selectedBlocks]);

  // Регистрация панели
  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  // Обработчики для дополнительных блоков
  const handleToggleBlock = (blockId: string) => {
    setEventConstructor(prev => ({
      ...prev,
      selectedBlocks: prev.selectedBlocks.includes(blockId)
        ? prev.selectedBlocks.filter(id => id !== blockId)
        : [...prev.selectedBlocks, blockId]
    }));
  };

  const handleUpdateBlocks = (blocks: any) => {
    setEventConstructor(prev => ({
      ...prev,
      blocks: { ...prev.blocks, ...blocks }
    }));
  };

  // Обработчик добавления хэштега
  const handleAddHashtag = () => {
    if (eventConstructor.hashtagInput.trim()) {
      setEventConstructor(prev => ({
        ...prev,
        hashtags: [...prev.hashtags, prev.hashtagInput.trim()],
        hashtagInput: ''
      }));
    }
  };

  // Обработчик удаления хэштега
  const handleRemoveHashtag = (index: number) => {
    setEventConstructor(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter((_, i) => i !== index)
    }));
  };

  // Состояние для загрузки файлов
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]); // File объекты для офлайн-режима
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);

  // Обработчик добавления фото по URL
  const handleAddPhoto = (url: string) => {
    if (url.trim()) {
      setEventConstructor(prev => ({
        ...prev,
        photos: [...prev.photos, url.trim()]
      }));
    }
  };

  // Обработчик загрузки фото с компьютера
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          alert('Пожалуйста, выберите изображение');
          return null;
        }

        const formData = new FormData();
        formData.append('image', file);
        
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Необходимо авторизоваться для загрузки фотографий');
          return null;
        }

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // НЕ добавляем Content-Type - браузер установит его автоматически с boundary для FormData
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          return data.photoUrl;
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Ошибка загрузки' }));
          console.error('Ошибка загрузки фото:', errorData);
          throw new Error(errorData.message || 'Ошибка загрузки фотографии');
        }
      });

      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter((url): url is string => url !== null);
      
      // Сохраняем File объекты для офлайн-режима
      const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
      setPhotoFiles(prev => [...prev, ...fileArray]);

      if (validUrls.length > 0) {
        if (isCover) {
          // Первое фото - главное (обложка)
          setEventConstructor(prev => ({
            ...prev,
            coverImageUrl: validUrls[0],
            photos: [validUrls[0], ...prev.photos.filter(url => url !== validUrls[0])]
          }));
        } else {
          // Дополнительные фото
          setEventConstructor(prev => ({
            ...prev,
            photos: [...prev.photos, ...validUrls]
          }));
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки фотографий:', error);
      alert(`Ошибка загрузки фотографий: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setUploadingPhotos(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Обработчик удаления фото
  const handleRemovePhoto = (index: number) => {
    setEventConstructor(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Сохранение события офлайн
  const handleSaveEventOffline = async () => {
    if (!eventConstructor.title?.trim()) {
      alert('Название события обязательно');
      return;
    }

    if (!user?.id) {
      alert('Для сохранения офлайн необходимо авторизоваться');
      return;
    }

    try {
      // Формируем даты события
      const startDatetime = eventConstructor.date && eventConstructor.time 
        ? `${eventConstructor.date}T${eventConstructor.time}:00.000Z`
        : eventConstructor.date ? `${eventConstructor.date}T12:00:00.000Z` : new Date().toISOString();
      
      const endDatetime = eventConstructor.date 
        ? `${eventConstructor.date}T23:59:59.000Z`
        : new Date(Date.now() + 24*60*60*1000).toISOString();

      // Получаем regionId (можно использовать 'default' или определить по координатам)
      const regionId = 'default';

      // Сохраняем в IndexedDB
      await offlineContentStorage.addDraft({
        contentType: 'event',
        contentData: {
          title: eventConstructor.title,
          description: eventConstructor.description || '',
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          location: eventConstructor.location.title || eventConstructor.location.address || '',
          latitude: (eventConstructor.location.coordinates.lat && eventConstructor.location.coordinates.lat !== 0) 
            ? eventConstructor.location.coordinates.lat 
            : null,
          longitude: (eventConstructor.location.coordinates.lng && eventConstructor.location.coordinates.lng !== 0) 
            ? eventConstructor.location.coordinates.lng 
            : null,
          category: eventConstructor.category || 'flights',
          hashtags: eventConstructor.hashtags || [],
          organizer: eventConstructor.organizer
        },
        images: photoFiles, // Сохраняем File объекты
        hasImages: photoFiles.length > 0,
        status: 'draft',
        regionId: regionId
      });

      alert('✅ Черновик события сохранён офлайн! Он будет отправлен автоматически при появлении интернета.');
      
      // Сброс формы
      setEventConstructor({
        title: '',
        description: '',
        date: '',
        time: '',
        location: {
          title: '',
          address: '',
          coordinates: { lat: 0, lng: 0 }
        },
        category: '',
        hashtags: [],
        hashtagInput: '',
        photos: [],
        coverImageUrl: undefined,
        selectedBlocks: [],
        blocks: {
          howToGet: { metro: '', car: '', bus: '' },
          whereToStay: [],
          whereToEat: [],
          whatToSee: []
        },
        organizer: '',
        budget: '',
        difficulty: '',
        status: '',
        showBasicInfo: false,
        showCategories: false,
        showLocation: false,
        showAdditional: false,
        showSeasonsHashtags: false,
        showPhotos: false,
        showAdditionalParams: false
      });
      setPhotoFiles([]);
    } catch (e: any) {
      alert('❌ Не удалось сохранить черновик: ' + (e.message || 'Неизвестная ошибка'));
    }
  };

  // Обработчик создания события
  const handleCreateEvent = async () => {
    try {
      const token = storageService.getItem('token') || '';
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Преобразуем данные события в формат бэкенда
      const eventData = {
        title: eventConstructor.title,
        description: eventConstructor.description,
        start_datetime: eventConstructor.date && eventConstructor.time 
          ? `${eventConstructor.date}T${eventConstructor.time}:00.000Z`
          : eventConstructor.date ? `${eventConstructor.date}T12:00:00.000Z` : new Date().toISOString(),
        end_datetime: eventConstructor.date 
          ? `${eventConstructor.date}T23:59:59.000Z`
          : new Date(Date.now() + 24*60*60*1000).toISOString(),
        location: eventConstructor.location.title || eventConstructor.location.address || 'Место не указано',
        category: eventConstructor.category || 'flights',
        photo_urls: eventConstructor.photos,
        cover_image_url: eventConstructor.coverImageUrl,
        hashtags: eventConstructor.hashtags,
        is_public: true,
        organizer: eventConstructor.organizer,
        // Отправляем координаты только если они валидны (не 0,0)
        // Если координаты не указаны, бэкенд попытается геокодировать адрес
        latitude: (eventConstructor.location.coordinates.lat && eventConstructor.location.coordinates.lat !== 0) 
          ? eventConstructor.location.coordinates.lat 
          : null,
        longitude: (eventConstructor.location.coordinates.lng && eventConstructor.location.coordinates.lng !== 0) 
          ? eventConstructor.location.coordinates.lng 
          : null
      };

      // Для не-админов сохраняем локально на модерацию
      if (!isAdmin && token) {
        const { savePendingContent } = await import('../services/localModerationStorage');
        const { analyzeContentWithAI } = await import('../services/aiModerationService');
        
        const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const authorName = user?.username || user?.email || 'Пользователь';
        const authorId = user?.id;

        // Сохраняем локально
        savePendingContent({
          id: pendingId,
          type: 'event',
          data: eventData,
          created_at: new Date().toISOString(),
          author_id: authorId,
          author_name: authorName,
        });

        // Запускаем ИИ-анализ асинхронно
        analyzeContentWithAI('event', pendingId, eventData).catch(err => 
          console.error('Ошибка ИИ-анализа события:', err)
        );

        alert('Событие отправлено на модерацию! После одобрения оно будет опубликовано.');
        setShowEventPreview(true);
        
        // Сброс формы
        setEventConstructor({
          title: '',
          description: '',
          date: '',
          time: '',
          location: {
            title: '',
            address: '',
            coordinates: { lat: 0, lng: 0 }
          },
          category: '',
          hashtags: [],
          hashtagInput: '',
          photos: [],
          coverImageUrl: undefined,
          selectedBlocks: [],
          blocks: {
            howToGet: { metro: '', car: '', bus: '' },
            whereToStay: [],
            whereToEat: [],
            whatToSee: []
          },
          organizer: '',
          budget: '',
          difficulty: '',
          status: '',
          showBasicInfo: false,
          showCategories: false,
          showLocation: false,
          showAdditional: false,
          showSeasonsHashtags: false,
          showPhotos: false,
          showAdditionalParams: false
        });
        return;
      }

      // Для админов и гостей сохраняем сразу в БД
      const response = await fetch('/api/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(eventData),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Сохраняем ID созданного события
        (window as any).__lastCreatedEventId = result.id;
        
        // Создаем активность для создания события
        try {
          const { activityService } = await import('../services/activityService');
          await activityService.createActivityHelper(
            'event_created',
            'event',
            result.id,
            {
              title: result.title || eventConstructor.title,
              category: result.category || eventConstructor.category,
              location: result.location || eventConstructor.location.title || eventConstructor.location.address
            }
          );
        } catch (err) {
          console.error('Ошибка создания активности для события:', err);
        }
        
        // Если пользователь не авторизован, сохраняем событие в GuestContext
        if (!user && result.id) {
          addGuestEvent({
            ...result,
            status: 'pending' // События гостей отправляются на модерацию
          });
          alert('Событие сохранено! После регистрации оно будет отправлено на модерацию.');
        } else {
          alert('Событие успешно создано!');
        }
        setShowEventPreview(true);
        
        // Сброс формы
        setEventConstructor({
          title: '',
          description: '',
          date: '',
          time: '',
          location: {
            title: '',
            address: '',
            coordinates: { lat: 0, lng: 0 }
          },
          category: '',
          hashtags: [],
          hashtagInput: '',
          photos: [],
          coverImageUrl: undefined,
          selectedBlocks: [],
          blocks: {
            howToGet: { metro: '', car: '', bus: '' },
            whereToStay: [],
            whereToEat: [],
            whatToSee: []
          },
          organizer: '',
          budget: '',
          difficulty: '',
          status: '',
          showBasicInfo: false,
          showCategories: false,
          showLocation: false,
          showAdditional: false,
          showSeasonsHashtags: false,
          showPhotos: false,
          showAdditionalParams: false
        });
      } else {
        alert(`Ошибка при создании события: ${result.message || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка создания события:', error);
      alert('Ошибка при создании события');
    }
  };

  return (
    <MirrorGradientContainer className="page-layout-container page-container calendar-mode">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* Основной контент - растянутый на весь контейнер */}
            <div className="h-full w-full relative">
              <div className="map-content-container h-full w-full">
                {/* Заголовок контента */}
                <div className="map-content-header">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <_FaCalendar className="w-5 h-5 text-slate-400" />
                      <h1 className="text-lg font-semibold" style={{ color: '#333333' }}>Календарь событий</h1>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Селектор регионов */}
                      <RegionSelector />
                    </div>
                  </div>
                </div>
                {/* Область контента - растянута на максимум */}
                <div className="map-area h-full w-full">
                  <div className="full-height-content h-full w-full">
                    <div className="h-full w-full flex items-center justify-center">
                      <TravelCalendar 
                        viewMode={calendarViewMode} 
                        onViewModeChange={(mode) => {
                          setCalendarViewMode(mode);
                        }}
                        selectedDate={selectedDate}
                        onSelectedDateChange={setSelectedDate}
                        onAddEventClick={() => setLeftPanelOpen(true)}
                        onSearchClick={() => setRightPanelOpen(true)}
                        onLegendClick={() => setShowLegend(true)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Правая выдвигающаяся панель — умный поиск событий */}
            <GlassPanel
              isOpen={rightPanelOpen}
              onClose={() => setRightPanelOpen(false)}
              position="right"
              width="400px"
              closeOnOverlayClick={true}
              showCloseButton={false}
              className="calendar-panel"
            >
              <GlassHeader
                title="Умный поиск событий"
                onClose={() => setRightPanelOpen(false)}
                showCloseButton={true}
              />
              <div className="glass-panel-content">
                  <SmartEventSearch 
                    isOpen={rightPanelOpen}
                    onClose={() => setRightPanelOpen(false)}
                  />
                  </div>
            </GlassPanel>

            {/* Левая выдвигающаяся панель — добавить событие */}
            <GlassPanel
              isOpen={leftPanelOpen}
              onClose={() => setLeftPanelOpen(false)}
              position="left"
              width="400px"
              closeOnOverlayClick={true}
              showCloseButton={false}
              className="calendar-panel"
            >
              <GlassHeader
                title="Добавить событие"
                onClose={() => setLeftPanelOpen(false)}
                showCloseButton={true}
              />
              <div className="glass-panel-content h-full flex flex-col calendar-panel-content">

                {/* Основной контент - аккордеон как в ElegantAccordionForm */}
                <div className="flex-1 overflow-y-auto">
                  {/* Основная информация */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: !prev.showBasicInfo,
                          showCategories: false,
                          showLocation: false,
                          showAdditional: false,
                          showSeasonsHashtags: false,
                          showPhotos: false,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaSearch />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        {eventConstructor.title ? `Основная информация: ${eventConstructor.title}` : 'Основная информация'}
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showBasicInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showBasicInfo && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Название события *</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.title}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, title: e.target.value })}
                              placeholder="Введите название события"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 h-24"
                              value={eventConstructor.description}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, description: e.target.value })}
                              placeholder="Описание события..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Дата</label>
                              <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                value={eventConstructor.date}
                                onChange={(e) => setEventConstructor({ ...eventConstructor, date: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Время</label>
                              <input
                                type="time"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                value={eventConstructor.time}
                                onChange={(e) => setEventConstructor({ ...eventConstructor, time: e.target.value })}
                              />
                            </div>
                </div>
              </div>
            </div>
                    )}
                  </div>

                  {/* Категории */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                  <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: !prev.showCategories,
                          showLocation: false,
                          showAdditional: false,
                          showSeasonsHashtags: false,
                          showPhotos: false,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaListAlt />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        {eventConstructor.category ? `Категория: ${categories.find(cat => cat.id === eventConstructor.category)?.name || eventConstructor.category}` : 'Категория'}
                          </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showCategories ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showCategories && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Выберите категорию</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.category}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, category: e.target.value })}
                            >
                              <option value="">Выберите категорию</option>
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Местоположение */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: false,
                          showLocation: !prev.showLocation,
                          showAdditional: false,
                          showSeasonsHashtags: false,
                          showPhotos: false,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaMapMarkerAlt />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        {eventConstructor.location.title ? `Местоположение: ${eventConstructor.location.title}` : 'Местоположение'}
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showLocation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showLocation && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Название места</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.location.title}
                              onChange={(e) => setEventConstructor({ 
                                ...eventConstructor, 
                                location: { ...eventConstructor.location, title: e.target.value }
                              })}
                              placeholder="Название места проведения"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Адрес</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.location.address}
                              onChange={(e) => setEventConstructor({ 
                                ...eventConstructor, 
                                location: { ...eventConstructor.location, address: e.target.value }
                              })}
                              placeholder="Адрес места проведения"
                            />
                          </div>
                          {/* Компонент выбора места с картой */}
                          <div className="mt-4">
                            <EventLocationPicker
                              location={eventConstructor.location}
                              onLocationChange={(newLocation) => {
                                setEventConstructor({
                                  ...eventConstructor,
                                  location: newLocation
                                });
                              }}
                              onPreciseClick={() => setShowLocationModal(true)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Дополнительные блоки */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: false,
                          showLocation: false,
                          showAdditional: !prev.showAdditional,
                          showSeasonsHashtags: false,
                          showPhotos: false,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaLeaf />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        Дополнительные блоки
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showAdditional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showAdditional && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Выберите блоки для включения</label>
                            <EventBlocksSelector
                              selectedBlocks={eventConstructor.selectedBlocks}
                              onToggleBlock={handleToggleBlock}
                            />
                          </div>
                          {eventConstructor.selectedBlocks.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Настройте выбранные блоки</label>
                              <EventBlocksEditor
                                blocks={eventConstructor.blocks}
                                onUpdateBlocks={handleUpdateBlocks}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Хэштеги */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: false,
                          showLocation: false,
                          showAdditional: false,
                          showSeasonsHashtags: !prev.showSeasonsHashtags,
                          showPhotos: false,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaSearch />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        Хэштеги
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showSeasonsHashtags ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showSeasonsHashtags && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Добавить хэштег</label>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                value={eventConstructor.hashtagInput}
                                onChange={(e) => setEventConstructor({ ...eventConstructor, hashtagInput: e.target.value })}
                                placeholder="Введите хэштег"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddHashtag()}
                              />
                              <GlassButton
                                onClick={handleAddHashtag}
                                variant="primary"
                                size="small"
                              >
                                Добавить
                              </GlassButton>
                            </div>
                          </div>
                          {eventConstructor.hashtags.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Текущие хэштеги</label>
                              <div className="flex flex-wrap gap-2">
                                {eventConstructor.hashtags.map((hashtag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                                  >
                                    #{hashtag}
                                    <button
                                      onClick={() => handleRemoveHashtag(index)}
                                      className="ml-2 text-blue-600 hover:text-blue-800"
                                    >
                                      <X size={14} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Фотографии */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: false,
                          showLocation: false,
                          showAdditional: false,
                          showSeasonsHashtags: false,
                          showPhotos: !prev.showPhotos,
                          showAdditionalParams: false
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaCamera />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        Фотографии
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showPhotos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showPhotos && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-4">
                          {/* Главное фото */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Главное фото (обложка)</label>
                            {eventConstructor.coverImageUrl ? (
                              <div className="relative mb-2">
                                <img
                                  src={eventConstructor.coverImageUrl}
                                  alt="Главное фото"
                                  className="w-full h-32 object-cover rounded-lg border-2 border-blue-300"
                                />
                                <button
                                  onClick={() => setEventConstructor(prev => ({ ...prev, coverImageUrl: undefined }))}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => coverFileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                              >
                                <FaCamera className="mx-auto mb-2 text-gray-400" size={24} />
                                <span className="text-sm text-gray-600">Нажмите для загрузки главного фото</span>
                              </div>
                            )}
                            <input
                              ref={coverFileInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleFileUpload(e, true)}
                            />
                          </div>

                          {/* Дополнительные фото */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Дополнительные фотографии</label>
                            <div className="flex flex-col gap-2">
                              <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 transition-colors"
                              >
                                <FaCamera className="mx-auto mb-1 text-gray-400" size={20} />
                                <span className="text-xs text-gray-600">Загрузить фото с компьютера</span>
                              </div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileUpload(e, false)}
                              />
                              <div className="text-xs text-gray-500 mb-2">или</div>
                              <div className="flex space-x-2">
                                <input
                                  type="url"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                  placeholder="https://example.com/photo.jpg"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAddPhoto((e.target as HTMLInputElement).value);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }}
                                />
                                <GlassButton
                                  onClick={(e) => {
                                    const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                                    handleAddPhoto(input.value);
                                    input.value = '';
                                  }}
                                  variant="primary"
                                  size="small"
                                >
                                  Добавить
                                </GlassButton>
                              </div>
                            </div>
                          </div>

                          {/* Превью фотографий */}
                          {eventConstructor.photos.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Все фотографии ({eventConstructor.photos.length})
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {eventConstructor.photos.map((photo, index) => (
                                  <div key={index} className="relative">
                                    <img
                                      src={photo}
                                      alt={`Фото ${index + 1}`}
                                      className="w-full h-20 object-cover rounded-lg"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    {index === 0 && eventConstructor.coverImageUrl && (
                                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded">
                                        Обложка
                                      </div>
                                    )}
                                    <button
                                      onClick={() => handleRemovePhoto(index)}
                                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {uploadingPhotos && (
                            <div className="text-center text-sm text-gray-500">
                              Загрузка фотографий...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Дополнительные параметры */}
                  <div className="border-b-[1.5px] border-[#bcbcbc]">
                    <button
                      onClick={() => {
                        setEventConstructor(prev => ({
                          ...prev,
                          showBasicInfo: false,
                          showCategories: false,
                          showLocation: false,
                          showAdditional: false,
                          showSeasonsHashtags: false,
                          showPhotos: false,
                          showAdditionalParams: !prev.showAdditionalParams
                        }));
                      }}
                      className="w-full px-4 py-3 text-left flex items-center transition-all duration-300 calendar-accordion-button"
                    >
                      <div className="w-8 h-8 flex items-center justify-center text-[#888] mr-3">
                        <FaSearch />
                      </div>
                      <span className="flex-1 text-[#222]" style={{ fontSize: '0.88em', fontWeight: '600' }}>
                        Дополнительные параметры
                      </span>
                      <div className="w-4 h-4 flex items-center justify-center text-[#888]">
                        {eventConstructor.showAdditionalParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {eventConstructor.showAdditionalParams && (
                      <div className="px-4 py-3 bg-white border-t border-[#bcbcbc]">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Организатор</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.organizer}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, organizer: e.target.value })}
                              placeholder="Название организатора"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Бюджет</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.budget}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, budget: e.target.value })}
                              placeholder="Бюджет события"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Сложность</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.difficulty}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, difficulty: e.target.value })}
                            >
                              <option value="">Выберите сложность</option>
                              <option value="easy">Легкая</option>
                              <option value="medium">Средняя</option>
                              <option value="hard">Сложная</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                              value={eventConstructor.status}
                              onChange={(e) => setEventConstructor({ ...eventConstructor, status: e.target.value })}
                            >
                              <option value="">Выберите статус</option>
                              <option value="draft">Черновик</option>
                              <option value="published">Опубликовано</option>
                              <option value="archived">Архив</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Футер с кнопками */}
                <div className="bg-[#dadada] px-4 py-3 border-t-[1.5px] border-[#bcbcbc] rounded-b-2xl">
                  {/* Прогресс заполнения и предполагаемые очки */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Полнота:</div>
                      <div style={{ width: 120, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${completeness.score}%`, height: '100%', background: completeness.score >= 80 ? '#10b981' : completeness.score >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#444' }}>{completeness.score}%</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#444' }}>Очки: <span style={{ fontWeight: 700 }}>{pointsEstimate.total}</span> <span style={{ color: '#6b7280' }}>({pointsEstimate.base} + {pointsEstimate.attach})</span></div>
                  </div>
                  <div className="flex space-x-2">
                    {user && (
                      <GlassButton
                        onClick={handleSaveEventOffline}
                        variant="secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <FaCloud />
                        Сохранить офлайн
                      </GlassButton>
                    )}
                    <GlassButton
                      onClick={handleCreateEvent}
                      variant="primary"
                      fullWidth
                    >
                      Создать событие
                    </GlassButton>
                    <GlassButton
                      onClick={async () => {
                        // Попытка начислить очки — сработает только для уже сохранённого на бэкенде события с id
                        const eventId = (window as any).__lastCreatedEventId;
                        if (!eventId) { alert('Сначала сохраните событие. Сейчас показана только оценка и предположительные очки.'); return; }
                        try {
                          const token = storageService.getItem('token') || '';
                          const resp = await fetch(`/api/events/${eventId}/award-points`, { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' } });
                          const js = await resp.json();
                          if (resp.ok && js.success) alert(`Начислено очков: ${js.data.points.totalPoints}`);
                          else alert(js.message || 'Не удалось начислить очки');
                        } catch {
                          alert('Не удалось начислить очки');
                        }
                      }}
                      variant="success"
                    >
                      Начислить очки
                    </GlassButton>
                    <GlassButton
                      onClick={() => setShowEventPreview(true)}
                      variant="secondary"
                    >
                      Превью
                    </GlassButton>
                  </div>
                </div>
              </div>
            </GlassPanel>

            {/* Панель легенды календаря */}
            <GlassPanel
              isOpen={showLegend}
              onClose={() => setShowLegend(false)}
              position="left"
              width="300px"
              closeOnOverlayClick={true}
              showCloseButton={false}
              className="calendar-legend-panel"
            >
              <GlassHeader
                title="Легенда календаря"
                onClose={() => setShowLegend(false)}
                showCloseButton={true}
              />
              <div style={{ padding: '0 24px 24px 24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'rgba(0, 0, 0, 0.9)' }}>Категории событий</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    {categories.map((category) => {
                      const Icon = category.icon;
                      const colorMap: { [key: string]: string } = {
                        'bg-red-500': '#ef4444', 'bg-orange-500': '#f97316', 'bg-sky-500': '#0ea5e9',
                        'bg-emerald-500': '#10b981', 'bg-violet-500': '#8b5cf6', 'bg-amber-500': '#f59e0b',
                        'bg-pink-500': '#ec4899', 'bg-fuchsia-500': '#d946ef', 'bg-indigo-500': '#6366f1',
                        'bg-lime-500': '#84cc16', 'bg-cyan-500': '#06b6d4', 'bg-yellow-400': '#facc15',
                        'bg-rose-500': '#f43f5e', 'bg-purple-600': '#9333ea', 'bg-purple-500': '#a855f7',
                        'bg-orange-400': '#fb923c', 'bg-teal-500': '#14b8a6', 'bg-blue-400': '#60a5fa',
                        'bg-neutral-800': '#262626'
                      };
                      const categoryColor = category.color ? (colorMap[category.color] || '#6b7280') : '#6b7280';
                      
                      return (
                        <div 
                          key={category.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div 
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}dd 100%)`,
                              border: '2px solid rgba(255, 255, 255, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={20} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                          </div>
                          <span style={{ color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px', fontWeight: '500' }}>
                            {category.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>

      {/* Модальное окно для точного указания места */}
      <EventLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        location={eventConstructor.location}
        onConfirm={(newLocation) => {
          setEventConstructor({
            ...eventConstructor,
            location: newLocation
          });
          setShowLocationModal(false);
        }}
      />

      {/* Модальное окно превью события */}
      {showEventPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Превью события</h2>
              <button
                onClick={() => setShowEventPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <EventPreview
              event={{
                title: eventConstructor.title || 'Название события',
                description: eventConstructor.description || 'Описание события',
                date: eventConstructor.date || '2024-01-01',
                time: eventConstructor.time || '12:00',
                location: {
                  title: eventConstructor.location.title || 'Место проведения',
                  address: eventConstructor.location.address || 'Адрес',
                  coordinates: eventConstructor.location.coordinates
                },
                category: eventConstructor.category || 'flights',
                hashtags: eventConstructor.hashtags,
                photos: eventConstructor.photos,
                // Дополнительные блоки
                howToGet: eventConstructor.selectedBlocks.includes('howToGet') ? eventConstructor.blocks.howToGet : undefined,
                whereToStay: eventConstructor.selectedBlocks.includes('whereToStay') ? eventConstructor.blocks.whereToStay : undefined,
                whereToEat: eventConstructor.selectedBlocks.includes('whereToEat') ? eventConstructor.blocks.whereToEat : undefined,
                whatToSee: eventConstructor.selectedBlocks.includes('whatToSee') ? eventConstructor.blocks.whatToSee : undefined
              }}
              isPreview={true}
            />
          </div>
        </div>
      )}

      {/* Кнопка модерации для админа */}
      {isAdmin && !showModerationModal && (
        <button
          onClick={() => setShowModerationModal(true)}
          className="fixed right-4 top-20 z-40 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          title="Модерация событий"
        >
          <span>📋</span>
          <span>Модерация</span>
          {moderationCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {moderationCount}
            </span>
          )}
        </button>
      )}

      {/* Модальное окно модерации */}
      {isAdmin && (
        <AdminModerationModal
          isOpen={showModerationModal}
          onClose={() => setShowModerationModal(false)}
          contentType="event"
          onContentApproved={(contentId) => {
            // Обновляем счётчик
            const counts = getPendingContentCounts();
            setModerationCount(counts.event);
          }}
        />
      )}
    </MirrorGradientContainer>
  );
};

export default CalendarPage;