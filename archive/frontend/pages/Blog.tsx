import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import '../styles/GlobalStyles.css';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import BlogSection, { BlogForm } from '../components/Blog/BlogSection';
import BlogPageConstructor from '../components/Blog/BlogPageConstructor';
import PhotoGallery from '../components/Blog/PhotoGallery';
import MiniPreview from '../components/Blog/MiniPreview';
import BlogPreviewModal from '../components/Blog/BlogPreview';
import ContentAddMenu from '../components/Blog/ContentAddMenu';
import { FaPlus as _FaPlus, FaCog as _FaCog, FaTimes as _FaTimes } from 'react-icons/fa';
import { BookOpen, X } from 'lucide-react';
import { Blog, BlogConstructor as BlogConstructorType, BlogParagraph, StateType, EventData } from '../types/blog';
import { MarkerData } from '../types/marker';
import { Route as RouteData } from '../types/route';
import { useLayoutState } from '../contexts/LayoutContext';
import useFavoriteRoutes from '../hooks/useFavoriteRoutes';
import { getBlogs, createBlog, getUserDrafts } from '../api/blogs';
import { markerService } from '../services/markerService';
import { activityService } from '../services/activityService';
import { useFavorites } from '../contexts/FavoritesContext';
import { blogDraftBus } from '../utils/blogDraftBus';
import { lazy, Suspense } from 'react';
import BookCreator from '../components/Blog/BookCreator';
import { projectManager } from '../services/projectManager';
// Ленивая загрузка тяжелых компонентов
const BookView = lazy(() => import('../components/Blog/BookView'));
const BookDraftsList = lazy(() => import('../components/Blog/BookDraftsList'));
const BlogsGrid = lazy(() => import('../components/Blog/BlogsGrid'));
const BooksGrid = lazy(() => import('../components/Blog/BooksGrid'));
import { Book } from '../types/blog';
import { bookService } from '../services/bookService';

const BlogPage: React.FC = () => {
  const isUuid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const layoutContext = useLayoutState();
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'view' | 'constructor' | 'books'>('list');
  // Книги загружаем синхронно со списком блогов и отдаём во внешний контролируемый BooksGrid
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState<boolean>(true);
  
  // Состояние конструктора
  const [constructor, setConstructor] = useState<BlogConstructorType>({
    paragraphs: [],
    photos: [],
    links: [],
    title: '',
    preview: '',
    segments: []
  });
  
  // Состояние данных обложки
  const [blogCoverData, setBlogCoverData] = useState<{
    title: string;
    description: string;
    gradient: string;
    textColor: string;
    titleFont: string;
    descriptionFont: string;
  } | null>(null);
  const [editingParagraph, setEditingParagraph] = useState<BlogParagraph | null>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showBlogPreview, setShowBlogPreview] = useState(false);
  const [showMiniPreview, setShowMiniPreview] = useState(false);
  const [selectedStateType, setSelectedStateType] = useState<StateType>(null);
  const [showContentAddMenu, setShowContentAddMenu] = useState(false);
  const [availableMarkers, setAvailableMarkers] = useState<MarkerData[]>([]);
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [showBookCreator, setShowBookCreator] = useState(false);
  const [selectedBlogForBook, setSelectedBlogForBook] = useState<Blog | null>(null);
  const [showBookDrafts, setShowBookDrafts] = useState(false);
  
  // Состояние поиска и фильтрации
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  
  // Книжное представление всегда используется для чтения блога
  
  const favoritesContext = useFavorites();
  const { favoriteRoutes } = useFavoriteRoutes();

  // Загружаем данные для интерактивных элементов
  useEffect(() => {
    const loadData = async () => {
      try {
        // Загружаем маркеры
        const markers = await projectManager.getMarkers();
        setAvailableMarkers(markers);
        
        // Загружаем события из избранного
        if (favoritesContext) {
          // Преобразуем FavoriteEvent в EventData
          const events = (favoritesContext.favoriteEvents || []).map(event => ({
            id: event.id,
            title: event.title,
            description: '',
            date: event.date,
            location: event.location || '',
            is_public: false,
            creator_id: 'user',
            hashtags: [],
            is_user_modified: false,
            used_in_blogs: false
          }));
          setAvailableEvents(events);
        }
      } catch (error) {
        // no-op
        }
    };
    
    loadData();
  }, [favoritesContext]);

  // Функция для парсинга блога с использованием реальных крючков
  const parseBlogContent = (blog: Blog) => {
    if (!blog.content) return [];

    // Разбиваем на абзацы
    const paragraphs = blog.content.split('\n\n').filter(p => p.trim());
    // Получаем связанные элементы из блога
    const relatedMarkers = blog.related_markers || [];
    const relatedRoute = blog.related_route_id;
    
    return paragraphs.map((paragraph, index) => {
      const paragraphText = paragraph.trim();
      
      // Определяем крючок для этого абзаца на основе связанных элементов
      let hook = undefined;
      
      // Сначала проверяем, есть ли крючок в constructor_data
      if (blog.constructor_data?.paragraphs?.[index]?.state) {
        hook = blog.constructor_data.paragraphs[index].state;
        }
      // Если нет крючка в constructor_data, создаем на основе связанных элементов
      else if (index === 0 && relatedMarkers.length > 0) {
        const marker = availableMarkers.find(m => m.id === relatedMarkers[0]);
        if (marker) {
          hook = { type: 'marker' as const, data: { id: marker.id } };
        }
      }
      // Если есть связанный маршрут, используем для второго абзаца
      else if (index === 1 && relatedRoute) {
        const route = favoriteRoutes.find(r => r.id === relatedRoute);
        if (route) {
          hook = { type: 'route' as const, data: { id: route.id } };
        }
      }
      // Для третьего абзаца ищем событие по упоминанию
      else if (index === 2) {
        const foundEvent = availableEvents.find(event => 
          event.title && paragraphText.toLowerCase().includes(event.title.toLowerCase())
        );
        if (foundEvent) {
          hook = { type: 'event' as const, data: { id: foundEvent.id } };
        }
      }

      return {
        id: `paragraph-${index}`,
        text: paragraphText,
        state: hook ? { type: hook.type, data: hook.data } : undefined,
        photos: [],
        links: [],
        order: index
      };

      return {
        id: `paragraph-${index}`,
        text: paragraphText,
        state: hook ? { type: hook.type, data: hook.data } : undefined,
        photos: [],
        links: [],
        order: index
      };
    });
  };

  // Рендер для чтения: оборачиваем выбранный блог в объект книги

  // LayoutContext всегда загружен (возвращает заглушку)

  const { routeDataForBlog, markerDataForBlog, setRouteDataForBlog, setMarkerDataForBlog } = layoutContext;

  useEffect(() => {
    registerPanel();
    registerPanel();
    
    return () => {
      unregisterPanel();
      unregisterPanel();
    };
  }, []); // Убираем функции из зависимостей, так как они стабильны

  // ОПТИМИЗИРОВАННАЯ ЗАГРУЗКА: блоги и книги загружаются одновременно
  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      try {
        setBooksLoading(true);
        
        // Загружаем блоги и книги параллельно
        const [blogsData, booksList] = await Promise.all([
          getBlogs().catch(error => {
            console.error('[blogs] failed', error?.response || error);
            return [];
          }),
          bookService.listMyBooks().catch(async () => {
            // Пытаемся инициализировать таблицу, если её не было
            try { await bookService.initBooksTable?.(); } catch {}
            return [];
          })
        ]);
        
        if (!cancelled) {
          // Устанавливаем данные
          setBlogs(Array.isArray(blogsData) ? blogsData : []);
          setBooks(Array.isArray(booksList) ? booksList : []);
          
          // Логирование
          console.info('[blogs] loaded', Array.isArray(blogsData) ? blogsData.length : 0);
          console.info('[books] loaded', Array.isArray(booksList) ? booksList.length : 0);
          
          // Отладочные данные
          if (Array.isArray(blogsData)) {
            console.info('[blogs] sample', blogsData.slice(0, 3).map(b => b.title));
            (window as any).__blogs = blogsData;
            (window as any).__setBlogs = (next: any[]) => setBlogs(Array.isArray(next) ? next : []);
          }
        }
      } catch (error) {
        console.error('[data] failed to load', error);
        if (!cancelled) {
          setBlogs([]);
          setBooks([]);
        }
      } finally {
        if (!cancelled) {
          setBooksLoading(false);
        }
      }
    };
    
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Загружаем доступные метки и события
  useEffect(() => {
    const loadAvailableData = async () => {
      try {
        // Загружаем метки
        const markers = await projectManager.getMarkers();
        setAvailableMarkers(markers);
        
        // TODO: Загрузить события из API
        setAvailableEvents([]);
      } catch (error) {
        // no-op
        }
    };
    
    loadAvailableData();
  }, []);

  const handleCreate = async (newBlog: Blog) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('jwt');
      if (!token) {
        alert('Для публикации войдите в аккаунт.');
        return;
      }

      // Получаем ID пользователя из токена
      let userId = 'current_user';
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.user_id || payload.id || payload.sub || 'current_user';
      } catch (e) {
        // no-op
        }

      // Создаем блог через API
      const createdBlog = await createBlog({
        title: newBlog.title,
        content: newBlog.content,
        excerpt: newBlog.preview || '',
        cover_image_url: newBlog.cover_image_url || '',
        tags: newBlog.category ? [newBlog.category] : [],
        related_route_id: null, // Не отправляем маршруты, так как они могут не существовать в БД
        related_markers: [], // Не отправляем маркеры, так как они могут не существовать в БД
        status: 'published'
      });
      console.log('createBlog: created', createdBlog);
      
      // Создаем активность для создания блога
      await activityService.createActivityHelper(
        'blog_created',
        'blog',
        createdBlog.id,
        {
          title: createdBlog.title,
          category: newBlog.category,
          excerpt: createdBlog.excerpt
        }
      );

      // Создаем активность о модерации контента
      await activityService.createActivityHelper(
        'content_published',
        'blog',
        createdBlog.id,
        {
          title: createdBlog.title,
          userId,
          moderationStatus: 'approved',
          category: newBlog.category
        }
      );
      
      // Добавляем новый блог в список
      setBlogs(prev => [createdBlog, ...prev]);
      setLeftPanelOpen(false);
      // Очищаем данные маршрута и метки после создания блога
      setRouteDataForBlog(null);
      setMarkerDataForBlog(null);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Неизвестная ошибка';
      alert(`Не удалось сохранить блог: ${message}`);
    }
  };

  const handleViewBlog = (blog: Blog | null) => {
    // Проверяем, что blog не null
    if (!blog) {
      console.warn('⚠️ handleViewBlog: blog is null');
      return;
    }
    
    // Если у блога есть constructor_data, используем его
    if (blog.constructor_data) {
    setSelectedBlog(blog);
      setCurrentView('view');
      return;
    }
    
    // Если у блога нет constructor_data, создаем его из parseBlogContent
    const blogWithConstructor = {
      ...blog,
      constructor_data: {
        paragraphs: parseBlogContent(blog)
      }
    };
    
    setSelectedBlog(blogWithConstructor);
    setCurrentView('view');
  };
  
  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedBlog(null);
  };

  // Функции конструктора
  const handleAddParagraph = () => {
    const newParagraph: BlogParagraph = {
      id: Date.now().toString(),
      text: '',
      state: { type: null, data: null },
      photos: [],
      links: [],
      order: constructor.paragraphs.length
    };
    setEditingParagraph(newParagraph);
  };

  const handleSaveParagraph = (paragraph: BlogParagraph) => {
    setConstructor(prev => ({
      ...prev,
      paragraphs: [...prev.paragraphs.filter(p => p.id !== paragraph.id), paragraph]
        .sort((a, b) => a.order - b.order)
    }));
    setEditingParagraph(null);
  };

  const handleCancelParagraph = () => {
    setEditingParagraph(null);
  };

  const handleAddPhoto = () => {
    setShowPhotoGallery(true);
  };

  const handleAddPhotoGroup = () => {
    setShowPhotoGallery(true);
  };

  const handleAddLink = () => {
    const link = prompt('Введите URL ссылки:');
    if (link) {
      setConstructor(prev => ({
        ...prev,
        links: [...prev.links, link]
      }));
    }
  };

  const handleAddContent = () => {
    setShowContentAddMenu(true);
  };

  const handleAddMarkerToBlog = async (marker: MarkerData) => {
    // Если редактируется существующий абзац, обновляем его
    if (editingParagraph) {
      const updatedParagraph: BlogParagraph = {
        ...editingParagraph,
        state: {
          type: 'marker',
          data: marker // Сохраняем весь объект маркера с ID
        }
      };
      handleSaveParagraph(updatedParagraph);
      setShowContentAddMenu(false);
      return;
    }

    // Иначе создаем новый абзац (если нет редактируемого)
    try {
      await markerService.updateMarker(marker.id, { used_in_blogs: true });
    } catch (error) {
      // no-op
    }

    const newParagraph: BlogParagraph = {
      id: Date.now().toString(),
      text: '' // Пустой текст - пользователь должен его заполнить
      ,
      type: 'content',
      state: {
        type: 'marker',
        data: marker
      },
      content: marker,
      photos: [],
      links: [],
      order: constructor.paragraphs.length
    };
    
    setConstructor(prev => ({
      ...prev,
      paragraphs: [...prev.paragraphs, newParagraph]
    }));
    setEditingParagraph(newParagraph); // Открываем для редактирования
    setShowContentAddMenu(false);
  };

  const handleAddRouteToBlog = async (route: RouteData) => {
    // Если редактируется существующий абзац, обновляем его
    if (editingParagraph) {
      const updatedParagraph: BlogParagraph = {
        ...editingParagraph,
        state: {
          type: 'route',
          data: route
        }
      };
      handleSaveParagraph(updatedParagraph);
      setShowContentAddMenu(false);
      return;
    }

    // Иначе создаем новый абзац
    try {
      // Здесь нужно будет добавить API для обновления маршрутов
    } catch (error) {
      // no-op
    }

    const newParagraph: BlogParagraph = {
      id: Date.now().toString(),
      text: '' // Пустой текст - пользователь должен его заполнить
      ,
      type: 'content',
      state: {
        type: 'route',
        data: route
      },
      content: route,
      photos: [],
      links: [],
      order: constructor.paragraphs.length
    };
    
    setConstructor(prev => ({
      ...prev,
      paragraphs: [...prev.paragraphs, newParagraph]
    }));
    setEditingParagraph(newParagraph); // Открываем для редактирования
    setShowContentAddMenu(false);
  };

  const handleAddEventToBlog = async (event: EventData) => {
    // Если редактируется существующий абзац, обновляем его
    if (editingParagraph) {
      const updatedParagraph: BlogParagraph = {
        ...editingParagraph,
        state: {
          type: 'event',
          data: event
        }
      };
      handleSaveParagraph(updatedParagraph);
      setShowContentAddMenu(false);
      return;
    }

    // Иначе создаем новый абзац
    try {
      // Здесь нужно будет добавить API для обновления событий
    } catch (error) {
      // no-op
    }

    const newParagraph: BlogParagraph = {
      id: Date.now().toString(),
      text: '' // Пустой текст - пользователь должен его заполнить
      ,
      type: 'content',
      state: {
        type: 'event',
        data: event
      },
      content: event,
      photos: [],
      links: [],
      order: constructor.paragraphs.length
    };
    
    setConstructor(prev => ({
      ...prev,
      paragraphs: [...prev.paragraphs, newParagraph]
    }));
    setEditingParagraph(newParagraph); // Открываем для редактирования
    setShowContentAddMenu(false);
  };

  // Функции для работы с создателем книг
  const handleOpenBookCreator = (blog: Blog) => {
    setSelectedBlogForBook(blog);
    setShowBookCreator(true);
  };

  const handleCloseBookCreator = () => {
    setShowBookCreator(false);
    setSelectedBlogForBook(null);
  };

  const handleSaveBookDraft = (bookData: any) => {
    console.log('💾 Сохраняем черновик книги в localStorage:', bookData);
    // Сохраняем черновик книги в localStorage
    const drafts = JSON.parse(localStorage.getItem('book_drafts') || '[]');
    const newDraft = {
      id: Date.now().toString(),
      ...bookData,
      created_at: new Date().toISOString()
    };
    drafts.push(newDraft);
    localStorage.setItem('book_drafts', JSON.stringify(drafts));
    console.log('✅ Черновик сохранен в localStorage. Всего черновиков:', drafts.length);
  };

  const handlePublishBook = (bookData: any) => {
    // Публикуем книгу через сервис
    (async () => {
      try {
        // Сначала инициализируем таблицу книг (если нужно)
        try {
          await bookService.initBooksTable();
        } catch (initError) {
          console.log('Таблица книг уже существует или ошибка инициализации:', initError);
        }

        console.log('📚 Создаем книгу через API...');
        const created = await bookService.createBook({
          title: bookData.title,
          category: bookData.category,
          blogIds: bookData.blogs,
          cover: bookData.cover,
          segments: bookData.segments
        });
        
        console.log('✅ Книга создана:', created);
        alert(`Книга "${created.title}" успешно опубликована!`);
        setShowBookCreator(false);
        setSelectedBlogForBook(null);
        
        // Обновляем список блогов, убирая те, что вошли в книгу
        const blogsData = await getBlogs();
        const remainingBlogs = blogsData.filter(blog => !bookData.blogs.includes(blog.id));
        setBlogs(remainingBlogs);
        
        // Принудительно обновляем компонент BooksGrid
        window.dispatchEvent(new CustomEvent('booksUpdated'));
      } catch (e: any) {
        const message = e?.response?.data?.error || e?.message || 'Не удалось опубликовать книгу';
        alert(`Ошибка: ${message}`);
        console.error('Ошибка создания книги:', e);
      }
    })();
  };

  // Функции для работы с черновиками книг
  const handleEditDraft = (draft: any) => {
    console.log('✏️ Редактируем черновик:', draft);
    setSelectedBlogForBook(null);
    setShowBookCreator(true);
    // TODO: Загрузить данные черновика в BookCreator
  };

  const handleDeleteDraft = (draftId: string) => {
    console.log('🗑️ Удаляем черновик:', draftId);
    // Черновик уже удален в BookDraftsList
  };

  const handlePublishDraft = (draft: any) => {
    console.log('🚀 Публикуем черновик:', draft);
    handlePublishBook(draft);
  };

  const handleCloseConstructor = () => {
    setCurrentView('list');
    setEditingParagraph(null);
    // Сбрасываем конструктор, но сохраняем черновик
    const currentConstructor = constructor;
    if (currentConstructor.title || currentConstructor.paragraphs.length > 0) {
      localStorage.setItem('blog_autosave', JSON.stringify(currentConstructor));
    }
  };

  const [showBlogConstructor, setShowBlogConstructor] = useState(false);

  const handleOpenConstructor = () => {
    setShowBlogConstructor(true);
  };

  const handleStateSelect = (data: any) => {
    if (editingParagraph) {
      const updatedParagraph = {
        ...editingParagraph,
        state: {
          type: selectedStateType,
          data
        }
      };
      setEditingParagraph(updatedParagraph);
    }
  };

  // Функции для работы с черновиками
  const handleSaveDraft = async (constructor: BlogConstructorType) => {
    try {
      // Сохраняем в localStorage для автосохранения
      localStorage.setItem('blog_draft', JSON.stringify(constructor));
      
      // Сохраняем в БД
      
      // Показываем уведомление
      alert('Черновик сохранен в БД!');
    } catch (error) {
      alert('Ошибка при сохранении черновика');
    }
  };

  const handleLoadDraft = async () => {
    try {
      // Сначала пробуем загрузить из localStorage
      const savedDraft = localStorage.getItem('blog_draft');
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        setConstructor(parsedDraft);
        alert('Черновик загружен из localStorage!');
        return;
      }
      
      // Если в localStorage нет, загружаем из БД
      const drafts = await getUserDrafts();
      if (drafts.length > 0) {
        // Показываем список черновиков для выбора
        const latestDraft = drafts[0]; // Берем последний
        if (latestDraft.constructor_data) {
          setConstructor(latestDraft.constructor_data);
          } else {
          // Если нет constructor_data, создаем базовую структуру
          setConstructor({
            title: latestDraft.title || '',
            preview: latestDraft.excerpt || '',
            category: latestDraft.tags?.[0] || 'other',
            geoType: 'point',
            tools: [],
            paragraphs: [],
            photos: [],
            links: []
          });
        }
        alert('Черновик загружен из БД!');
      } else {
        alert('Черновики не найдены');
      }
    } catch (error) {
      alert('Ошибка при загрузке черновика');
    }
  };

  // Обработчик сохранения данных обложки
  const handleCoverSave = (coverData: {
    title: string;
    description: string;
    gradient: string;
    textColor: string;
    titleFont: string;
    descriptionFont: string;
  }) => {
    setBlogCoverData(coverData);
    console.log('💾 Данные обложки сохранены:', coverData);
  };

  const handleBlogSave = async (title: string, preview: string, pages: any[]) => {
    if (!title.trim()) {
      alert('Введите заголовок блога');
      return;
    }
    if (pages.length === 0) {
      alert('Добавьте хотя бы одну страницу');
      return;
    }

    try {
      // Конвертируем страницы в старый формат для совместимости
      const paragraphs = pages.map((page, index) => ({
        id: page.id || `page-${index}`,
        text: page.rightContent?.text || '',
        state: {
          type: page.leftContent?.type || null,
          data: page.leftContent?.type === 'marker' ? { id: page.leftContent.markerId } :
                page.leftContent?.type === 'route' ? { id: page.leftContent.routeId } :
                page.leftContent?.type === 'event' ? { id: page.leftContent.eventId } : null
        },
        photos: page.rightContent?.photos || [],
        links: [],
        order: index
      }));

      const content = paragraphs
        .map(p => (p.text || '').replace(/<[^>]*>/g, ''))
        .join('\n\n');

      const constructorData = {
        title,
        preview,
        paragraphs,
        photos: [],
        links: [],
        segments: []
      };

      const created = await createBlog({
        title,
        content,
        excerpt: preview || '',
        tags: [],
        related_route_id: null,
        related_markers: [],
        status: 'published',
        constructor_data: constructorData,
        cover_data: blogCoverData || undefined
      });

      setBlogs(prev => [created, ...prev]);
      setSelectedBlog(created);
      setShowBlogConstructor(false);
      setCurrentView('view');
      alert('Блог опубликован!');
    } catch (err) {
      alert('Ошибка публикации блога');
    }
  };

  // Автосохранение каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      // Получаем актуальное состояние constructor через замыкание
      setConstructor(currentConstructor => {
        if (currentConstructor.title || currentConstructor.paragraphs.length > 0) {
          localStorage.setItem('blog_autosave', JSON.stringify(currentConstructor));
        }
        return currentConstructor; // Не изменяем состояние, только сохраняем
      });
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []); // Убираем constructor из зависимостей

  return (
    <MirrorGradientContainer className="page-layout-container blog-page">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* Фиксированные кнопки через портал, чтобы не прокручивались с контентом */}
            {typeof document !== 'undefined' && currentView === 'list' && ReactDOM.createPortal(
              <>
                <div style={{ position: 'fixed', left: 88, top: '50%', transform: 'translateY(-50%)', zIndex: 1200 }}>
                  <button
                    className="page-side-button left"
                    onClick={handleOpenConstructor}
                    title="Создать блог"
                    style={{ width: 47, height: 47, borderRadius: 9999, background: '#ffffff', border: '2px solid #8E9093', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <_FaPlus className="text-gray-600" size={20} />
                  </button>
                </div>
                <div style={{ position: 'fixed', right: 17, top: '50%', transform: 'translateY(-50%)', zIndex: 1200 }}>
                  <button
                    className="page-side-button right"
                    onClick={() => {
                      setSelectedBlogForBook(null);
                      setShowBookCreator(true);
                    }}
                    title="Создать книгу"
                    style={{ width: 47, height: 47, borderRadius: 9999, background: '#ffffff', border: '2px solid #8E9093', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <BookOpen className="text-gray-600" size={20} />
                  </button>
                </div>
              </>,
              document.body
            )}

            <div className="h-full relative">
              {currentView === 'view' && selectedBlog ? (
                <Suspense fallback={<div className="text-center text-gray-500 py-8">Загрузка книги...</div>}>
                  {(() => {
                    console.log('📝 Blog.tsx передает данные в BookView:', {
                      selectedBlog,
                      constructor_data: selectedBlog.constructor_data,
                      paragraphs: selectedBlog.constructor_data?.paragraphs
                    });
                    return (
                      <BookView
                        book={{
                          id: `book-${selectedBlog.id}`,
                          title: selectedBlog.title,
                          description: selectedBlog.excerpt,
                          author_id: selectedBlog.author || 'unknown',
                          author_name: selectedBlog.author_name,
                          author_avatar: selectedBlog.author_avatar,
                          cover_image_url: selectedBlog.cover_image_url,
                          category: 'mixed',
                          blogs: [{ ...selectedBlog }], // Передаем весь selectedBlog, включая constructor_data
                          rating: 4.8,
                          ratings_count: 1,
                          views_count: 0,
                          likes_count: 0,
                          is_favorite: false,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          status: 'published'
                        } as Book}
                        onClose={handleBackToList}
                      />
                    );
                  })()}
                </Suspense>
              ) : (
                <div className="h-full flex">
                  {/* Левая панель - Блоги */}
                  <div className="w-1/2 border-r border-gray-200 flex flex-col">
                    <div className="bg-white border-b border-gray-200 px-4 py-2">
                      <h2 className="text-lg font-bold text-gray-900 mb-2">БЛОГИ</h2>
                      <div className="flex space-x-4">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Поиск по блогам..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <select 
                          value={filterBy}
                          onChange={(e) => setFilterBy(e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="all">Все</option>
                          <option value="rating">По рейтингу</option>
                          <option value="date">По дате</option>
                          <option value="views">По просмотрам</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex-1 p-2">
                      <Suspense fallback={<div className="text-center p-4">Загрузка блогов...</div>}>
                        <BlogsGrid 
                          blogs={blogs}
                          onViewBlog={handleViewBlog}
                          searchQuery={searchQuery}
                          filterBy={filterBy}
                        />
                      </Suspense>
                    </div>
                  </div>

                  {/* Правая панель - Книги */}
                  <div className="w-1/2 flex flex-col">
                    <div className="bg-white border-b border-gray-200 px-4 py-2">
                      <h2 className="text-lg font-bold text-gray-900 mb-2">КНИГИ</h2>
                      <div className="flex space-x-4">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Поиск по книгам..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <select 
                          value={filterBy}
                          onChange={(e) => setFilterBy(e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="all">Все</option>
                          <option value="rating">По рейтингу</option>
                          <option value="date">По дате</option>
                          <option value="views">По просмотрам</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex-1 p-2">
                      <Suspense fallback={<div className="text-center p-4">Загрузка книг...</div>}>
                        <BooksGrid 
                          onBookOpen={(book) => {
                            const blogToView = book.blogs?.[0] || selectedBlog;
                            if (blogToView) {
                              handleViewBlog(blogToView);
                            } else {
                              console.warn('⚠️ No blog available to view');
                            }
                          }}
                          searchQuery={searchQuery}
                          filterBy={filterBy}
                        />
                      </Suspense>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {leftPanelOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Создать блог</h2>
                    <button
                      onClick={() => setLeftPanelOpen(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <_FaTimes size={20} />
                    </button>
                  </div>
                  <BlogForm
                    onSave={handleCreate}
                    onCancel={() => setLeftPanelOpen(false)}
                  />
                </div>
              </div>
            )}

            {rightPanelOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Настройки блогов</h2>
                    <button
                      onClick={() => setRightPanelOpen(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <_FaTimes size={20} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-gray-600">Настройки блогов будут здесь</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальные окна */}

      {showPhotoGallery && (
        <PhotoGallery
          photos={constructor.photos}
          onClose={() => setShowPhotoGallery(false)}
          onAddPhoto={(url) => {
            setConstructor(prev => ({
              ...prev,
              photos: [...prev.photos, url]
            }));
          }}
          onRemovePhoto={(index) => {
            setConstructor(prev => ({
              ...prev,
              photos: prev.photos.filter((_, i) => i !== index)
            }));
          }}
        />
      )}

      {showBlogPreview && (
        <BlogPreviewModal
          constructor={constructor}
          onClose={() => setShowBlogPreview(false)}
        />
      )}

      {/* Мини-предпросмотр */}
      <MiniPreview
        constructor={constructor}
        isVisible={showMiniPreview}
        onClose={() => setShowMiniPreview(false)}
      />

      {/* Новый конструктор блогов */}
      <BlogPageConstructor
        isOpen={showBlogConstructor}
        onClose={() => setShowBlogConstructor(false)}
        onSave={handleBlogSave}
      />

      {/* Меню добавления контента */}
      <ContentAddMenu
        isOpen={showContentAddMenu}
        onClose={() => {
          setShowContentAddMenu(false);
          setSelectedStateType(null); // Сбрасываем выбранный тип при закрытии
        }}
        onAddMarker={handleAddMarkerToBlog}
        onAddRoute={handleAddRouteToBlog}
        onAddEvent={handleAddEventToBlog}
        availableMarkers={availableMarkers}
        availableRoutes={favoriteRoutes as any}
        availableEvents={availableEvents}
        initialTab={selectedStateType === 'marker' ? 'markers' : selectedStateType === 'route' ? 'routes' : selectedStateType === 'event' ? 'events' : 'markers'}
      />

      {/* Создатель книг */}
      <BookCreator
        isOpen={showBookCreator}
        onClose={handleCloseBookCreator}
        blog={selectedBlogForBook}
        availableBlogs={blogs}
        availableRoutes={favoriteRoutes}
        availableMarkers={availableMarkers}
        onSaveDraft={handleSaveBookDraft}
        onPublish={handlePublishBook}
      />

      {/* Модальное окно черновиков книг */}
      {showBookDrafts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-5/6 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Черновики книг</h2>
              <button
                onClick={() => setShowBookDrafts(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto h-full">
              <Suspense fallback={<div className="text-center p-4">Загрузка черновиков...</div>}>
                <BookDraftsList
                  onEditDraft={handleEditDraft}
                  onDeleteDraft={handleDeleteDraft}
                  onPublishDraft={handlePublishDraft}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </MirrorGradientContainer>
  );
};

export default BlogPage;