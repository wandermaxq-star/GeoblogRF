import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { 
  BookOpen, 
  X, 
  Upload, 
  MapPin, 
  Palette, 
  Type, 
  Eye, 
  Save, 
  Send,
  Plus,
  Trash2,
  Move,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Blog } from '../../types/blog';
import { Route as RouteData } from '../../types/route';
import { MarkerData } from '../../types/marker';
import CoverEditor from './CoverEditor';
import DynamicBookTemplate from './DynamicBookTemplate';
import BookPreview from './BookPreview';

// Стилизованные компоненты в стиле конструктора блогов
const BookCreatorWrapper = styled.div`
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
  border: 2px solid #7c7b7b91;
  width: 100%;
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  font-size: 15px;
  overflow: hidden;
`;

const BookCreatorHeader = styled.div`
  background: #dadada;
  color: #222;
  font-size: 1.1em;
  font-weight: bold;
  padding: 16px 20px;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const BookCreatorContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  background: #fafafa;
`;

const SectionButton = styled.button<{ isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: #fff;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1em;
  font-weight: 500;
  margin-bottom: 8px;

  &:hover {
    border-color: #007bff;
    color: #007bff;
    background: #f0f8ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  }

  ${({ isOpen }) => isOpen && `
    border-color: #007bff;
    color: #007bff;
    background: #f0f8ff;
  `}
`;

const SectionContent = styled.div`
  padding: 16px 20px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const BookCreatorButton = styled.button<{ variant?: 'primary' | 'secondary' | 'success' | 'preview' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: #fff;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1em;
  font-weight: 500;
  margin-bottom: 8px;

  &:hover {
    border-color: #007bff;
    color: #007bff;
    background: #f0f8ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  }

  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          border-color: #007bff;
          &:hover {
            background: linear-gradient(135deg, #0056b3, #004085);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
          }
        `;
      case 'success':
        return `
          background: linear-gradient(135deg, #28a745, #1e7e34);
          color: white;
          border-color: #28a745;
          &:hover {
            background: linear-gradient(135deg, #1e7e34, #155724);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3);
          }
        `;
      case 'preview':
        return `
          background: linear-gradient(135deg, #6c757d, #495057);
          color: white;
          border-color: #6c757d;
          &:hover {
            background: linear-gradient(135deg, #495057, #343a40);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(108, 117, 125, 0.3);
          }
        `;
      default:
        return '';
    }
  }}
`;

const BlogItem = styled.div<{ isSelected: boolean; isDragging?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.9em;
  margin-bottom: 8px;
  transition: all 0.2s;
  cursor: pointer;

  ${({ isSelected }) => isSelected && `
    border-color: #007bff;
    background: #f0f8ff;
  `}

  ${({ isDragging }) => isDragging && `
    transform: rotate(2deg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `}

  &:hover {
    border-color: #007bff;
    background: #f8f9fa;
  }
`;

const BlogInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const OrderControls = styled.div`
  display: flex;
  gap: 4px;
`;

const OrderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #f8f9fa;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e9ecef;
    border-color: #adb5bd;
  }
`;

const BookCreatorFooter = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const FooterButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;

  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `
          background: #007bff;
          color: white;
          &:hover {
            background: #0056b3;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
          }
        `;
      default:
        return `
          background: #6c757d;
          color: white;
          &:hover {
            background: #545b62;
          }
        `;
    }
  }}
`;

interface BookSegment {
  id: string;
  paragraphId: string;
  coordinates: number[][];
  highlight: string;
  title: string;
}

interface BookCover {
  image: string;
  color: string;
  font: string;
  // Пользовательская обложка (URL изображения)
  customCoverUrl?: string;
  // Настройки цветов для динамического шаблона
  coverColor?: string;
  spineColor?: string;
  borderColor?: string;
  cornerColor?: string;
  textColor?: string;
}

interface BookCreatorData {
  title: string;
  category: string;
  blogs: string[];
  cover: BookCover;
  segments: BookSegment[];
}

interface BookCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  blog: Blog | null;
  availableBlogs: Blog[];
  availableRoutes: RouteData[];
  availableMarkers: MarkerData[];
  onSaveDraft: (data: BookCreatorData) => void;
  onPublish: (data: BookCreatorData) => void;
}

const BookCreator: React.FC<BookCreatorProps> = ({
  isOpen,
  onClose,
  blog,
  availableBlogs,
  availableRoutes,
  availableMarkers,
  onSaveDraft,
  onPublish
}) => {
  const [bookData, setBookData] = useState<BookCreatorData>({
    title: '',
    category: 'mixed',
    blogs: [],
    cover: {
      image: '',
      color: 'white',
      font: 'Roboto',
      customCoverUrl: '',
      coverColor: '#92400e',
      spineColor: '#8b4513',
      borderColor: '#8b4513',
      cornerColor: '#fbbf24',
      textColor: '#ffffff'
    },
    segments: []
  });

  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedSegment, setDraggedSegment] = useState<string | null>(null);
  const [segmentMarkers, setSegmentMarkers] = useState<{ [key: string]: { lat: number; lng: number } }>({});
  const [showCoverEditor, setShowCoverEditor] = useState(false);

  // Accordion open state
  const [openSection, setOpenSection] = useState<'blogs' | 'cover' | 'segments' | 'actions'>('blogs');

  // Инициализация данных при открытии
  useEffect(() => {
    if (isOpen && blog) {
      setBookData(prev => ({
        ...prev,
        title: blog.title || '',
        blogs: [blog.id]
      }));

      // Ищем связанный маршрут
      if (blog.related_route_id) {
        const route = availableRoutes.find(r => r.id === blog.related_route_id);
        if (route) {
          setSelectedRoute(route);
          // Создаем начальные сегменты
          createInitialSegments(route);
        }
      }
    }
  }, [isOpen, blog, availableRoutes]);

  const createInitialSegments = (route: RouteData) => {
    if (!route.points || route.points.length < 2) return;

    const segments: BookSegment[] = [];
    const pointsPerSegment = Math.ceil(route.points.length / 3); // Максимум 3 сегмента

    for (let i = 0; i < 3 && i * pointsPerSegment < route.points.length; i++) {
      const startIdx = i * pointsPerSegment;
      const endIdx = Math.min((i + 1) * pointsPerSegment, route.points.length);
      
      const segmentPoints = route.points.slice(startIdx, endIdx);
      const coordinates = segmentPoints.map(point => [point.latitude, point.longitude]);

      segments.push({
        id: `segment-${i}`,
        paragraphId: `paragraph-${i}`,
        coordinates,
        highlight: ['blue', 'red', 'green'][i] || 'blue',
        title: `Отрезок ${i + 1}`
      });
    }

    setBookData(prev => ({ ...prev, segments }));
  };

  const handleTitleChange = (title: string) => {
    setBookData(prev => ({ ...prev, title }));
  };

  const handleCategoryChange = (category: string) => {
    setBookData(prev => ({ ...prev, category }));
  };

  const handleBlogToggle = (blogId: string) => {
    setBookData(prev => ({
      ...prev,
      blogs: prev.blogs.includes(blogId)
        ? prev.blogs.filter(id => id !== blogId)
        : [...prev.blogs, blogId]
    }));
  };

  const handleCoverImageChange = (image: string) => {
    setBookData(prev => ({
      ...prev,
      cover: { ...prev.cover, image }
    }));
  };

  const handleCoverColorChange = (color: string) => {
    setBookData(prev => ({
      ...prev,
      cover: { ...prev.cover, color }
    }));
  };

  const handleFontChange = (font: string) => {
    setBookData(prev => ({
      ...prev,
      cover: { ...prev.cover, font }
    }));
  };

  const handleCoverEditorSave = (cover: { image: string; elements: any[] }) => {
    setBookData(prev => ({
      ...prev,
      cover: { ...prev.cover, image: cover.image, elements: cover.elements }
    }));
    setShowCoverEditor(false);
  };

  const handleSegmentTitleChange = (segmentId: string, title: string) => {
    setBookData(prev => ({
      ...prev,
      segments: prev.segments.map(seg => 
        seg.id === segmentId ? { ...seg, title } : seg
      )
    }));
  };

  const handleSegmentHighlightChange = (segmentId: string, highlight: string) => {
    setBookData(prev => ({
      ...prev,
      segments: prev.segments.map(seg => 
        seg.id === segmentId ? { ...seg, highlight } : seg
      )
    }));
  };

  const handleSegmentParagraphChange = (segmentId: string, paragraphId: string) => {
    setBookData(prev => ({
      ...prev,
      segments: prev.segments.map(seg => 
        seg.id === segmentId ? { ...seg, paragraphId } : seg
      )
    }));
  };

  const handleTestSegment = (segmentId: string) => {
    // TODO: Реализовать тестирование сегмента на карте
    alert(`Тестирование сегмента: ${segmentId}`);
  };

  const handleDragStart = (segmentId: string) => {
    setDraggedSegment(segmentId);
  };

  const handleDragEnd = () => {
    setDraggedSegment(null);
  };

  const handleMarkerMove = (segmentId: string, lat: number, lng: number) => {
    setSegmentMarkers(prev => ({
      ...prev,
      [segmentId]: { lat, lng }
    }));
    
    // Обновляем координаты сегмента
    setBookData(prev => ({
      ...prev,
      segments: prev.segments.map(seg => 
        seg.id === segmentId 
          ? { ...seg, coordinates: [[lat, lng], ...seg.coordinates.slice(1)] }
          : seg
      )
    }));
  };

  const addSegment = () => {
    if (bookData.segments.length >= 3) {
      alert('Максимум 3 отрезка на старте');
      return;
    }

    const newSegment: BookSegment = {
      id: `segment-${Date.now()}`,
      paragraphId: '',
      coordinates: [],
      highlight: ['blue', 'red', 'green'][bookData.segments.length] || 'blue',
      title: `Отрезок ${bookData.segments.length + 1}`
    };

    setBookData(prev => ({
      ...prev,
      segments: [...prev.segments, newSegment]
    }));
  };

  const removeSegment = (segmentId: string) => {
    setBookData(prev => ({
      ...prev,
      segments: prev.segments.filter(seg => seg.id !== segmentId)
    }));
    
    setSegmentMarkers(prev => {
      const newMarkers = { ...prev };
      delete newMarkers[segmentId];
      return newMarkers;
    });
  };

  const handleSaveDraft = () => {
    console.log('💾 Сохраняем черновик книги:', bookData);
    onSaveDraft(bookData);
    alert('Черновик книги сохранен!');
  };

  const handlePublish = () => {
    if (bookData.blogs.length < 1) {
      alert('Выберите минимум один блог для книги');
      return;
    }
    console.log('🚀 Публикуем книгу:', bookData);
    onPublish(bookData);
    onClose();
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const getParagraphs = () => {
    const selectedBlogs = availableBlogs.filter(blog => bookData.blogs.includes(blog.id));
    const paragraphs: { id: string; text: string }[] = [];
    
    selectedBlogs.forEach(blog => {
      if (blog.constructor_data?.paragraphs) {
        blog.constructor_data.paragraphs.forEach((para: any, index: number) => {
          paragraphs.push({
            id: `${blog.id}-${index}`,
            text: para.text
          });
        });
      } else if (blog.content) {
        const contentParagraphs = blog.content.split('\n\n');
        contentParagraphs.forEach((para, index) => {
          paragraphs.push({
            id: `${blog.id}-${index}`,
            text: para.trim()
          });
        });
      }
    });
    
    return paragraphs;
  };

  const paragraphs = getParagraphs();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-96 z-50"
        >
          <BookCreatorWrapper>
            <BookCreatorHeader>
              <div className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Создать книгу
              </div>
              <X 
                className="w-5 h-5 cursor-pointer hover:text-red-600 transition-colors"
                onClick={onClose}
              />
            </BookCreatorHeader>

            <BookCreatorContent>
              {/* Section: Выбор блогов и порядок */}
              <SectionButton
                isOpen={openSection === 'blogs'}
                onClick={() => setOpenSection(openSection === 'blogs' ? 'cover' : 'blogs')}
              >
                <div className="flex items-center gap-2">
                  <span>Шаг 1: Выбор блогов и порядок</span>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {bookData.blogs.length} выбрано
                  </span>
                </div>
                {openSection === 'blogs' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </SectionButton>
              
              {openSection === 'blogs' && (
                <SectionContent>
                  {/* Название книги */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Название книги *
                    </label>
                    <input
                      type="text"
                      value={bookData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Введите название книги..."
                    />
                  </div>

                  {/* Классификация */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Классификация
                    </label>
                    <select
                      value={bookData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="attractions">Достопримечательности</option>
                      <option value="events">События</option>
                      <option value="mixed">Смешанная</option>
                    </select>
                  </div>

                  {/* Список блогов */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Мои блоги
                    </label>
                    <div className="max-h-48 overflow-y-auto">
                      {availableBlogs.map(b => {
                        const checked = bookData.blogs.includes(b.id);
                        const idx = bookData.blogs.indexOf(b.id);
                        return (
                          <BlogItem
                            key={b.id}
                            isSelected={checked}
                            onClick={() => handleBlogToggle(b.id)}
                          >
                            <BlogInfo>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {}}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 truncate max-w-[200px]">{b.title}</span>
                            </BlogInfo>
                            {checked && (
                              <OrderControls>
                                <OrderButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (idx > 0) {
                                      const arr = [...bookData.blogs];
                                      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                      setBookData(prev => ({ ...prev, blogs: arr }));
                                    }
                                  }}
                                  title="Переместить вверх"
                                >
                                  ↑
                                </OrderButton>
                                <OrderButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (idx < bookData.blogs.length - 1) {
                                      const arr = [...bookData.blogs];
                                      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                                      setBookData(prev => ({ ...prev, blogs: arr }));
                                    }
                                  }}
                                  title="Переместить вниз"
                                >
                                  ↓
                                </OrderButton>
                              </OrderControls>
                            )}
                          </BlogItem>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Выберите как минимум один блог. Порядок влияет на последовательность в книге.
                    </p>
                  </div>
                </SectionContent>
              )}

              {/* Section: Оформление обложки */}
              <SectionButton
                isOpen={openSection === 'cover'}
                onClick={() => setOpenSection(openSection === 'cover' ? 'segments' : 'cover')}
              >
                <span>Шаг 2: Оформление обложки</span>
                {openSection === 'cover' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </SectionButton>
              
              {openSection === 'cover' && (
                <SectionContent>
                  {/* Динамический предпросмотр книги */}
                  <div className="mb-6">
                    <BookPreview
                      title={bookData.title || "Название книги"}
                      author="Автор"
                      coverColor={bookData.cover.coverColor || '#92400e'}
                      spineColor={bookData.cover.spineColor || '#8b4513'}
                      borderColor={bookData.cover.borderColor || '#8b4513'}
                      cornerColor={bookData.cover.cornerColor || '#fbbf24'}
                      textColor={bookData.cover.textColor || '#ffffff'}
                      onColorChange={(type, color) => {
                        setBookData(prev => ({
                          ...prev,
                          cover: {
                            ...prev.cover,
                            [type === 'cover' ? 'coverColor' : 
                             type === 'spine' ? 'spineColor' : 
                             type === 'border' ? 'borderColor' :
                             type === 'corner' ? 'cornerColor' : 'textColor']: color
                          }
                        }));
                      }}
                    />
                  </div>

                  {/* Редактор обложек */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Дизайн обложки
                    </label>
                    <div className="space-y-3">
                      <BookCreatorButton onClick={() => setShowCoverEditor(true)}>
                        <Type className="w-4 h-4" />
                        Открыть редактор обложек
                      </BookCreatorButton>
                      
                      {bookData.cover.image && (
                        <div className="relative">
                          <img
                            src={bookData.cover.image}
                            alt="Обложка"
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => setBookData(prev => ({ ...prev, cover: { ...prev.cover, image: '' } }))}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Цвет фона */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Цвет фона
                    </label>
                    <div className="flex space-x-2">
                      {['white', 'gray', 'blue', 'green', 'purple'].map(color => (
                        <button
                          key={color}
                          onClick={() => handleCoverColorChange(color)}
                          className={`w-8 h-8 rounded-full border-2 ${
                            bookData.cover.color === color ? 'border-blue-500' : 'border-gray-300'
                          }`}
                          style={{ 
                            backgroundColor: color === 'white' ? '#ffffff' : 
                                           color === 'gray' ? '#6b7280' :
                                           color === 'blue' ? '#3b82f6' :
                                           color === 'green' ? '#10b981' : '#8b5cf6' 
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Шрифт */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Шрифт
                    </label>
                    <select
                      value={bookData.cover.font}
                      onChange={(e) => handleFontChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Roboto">Roboto</option>
                      <option value="Montserrat">Montserrat</option>
                    </select>
                  </div>
                </SectionContent>
              )}

              {/* Section: Маршрут и отрезки */}
              <SectionButton
                isOpen={openSection === 'segments'}
                onClick={() => setOpenSection(openSection === 'segments' ? 'actions' : 'segments')}
              >
                <span>Шаг 3: Маршрут и отрезки (опционально)</span>
                {openSection === 'segments' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </SectionButton>
              
              {openSection === 'segments' && (
                <SectionContent>
                  {selectedRoute ? (
                    <>
                      <div className="mb-4 p-4 border border-gray-300 rounded-md bg-gray-50">
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-600">Карта маршрута</span>
                        </div>
                        <div className="h-32 bg-gray-200 rounded flex items-center justify-center relative">
                          <span className="text-gray-500 text-sm">Карта будет здесь</span>
                          <div className="absolute top-2 right-2 text-xs text-gray-400 bg-white px-2 py-1 rounded">
                            Перетащите маркеры для разделения маршрута
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {bookData.segments.map((segment, index) => (
                          <div 
                            key={segment.id} 
                            className={`p-3 border border-gray-200 rounded-md transition-all ${
                              draggedSegment === segment.id ? 'shadow-lg border-blue-500' : ''
                            }`}
                            draggable
                            onDragStart={() => handleDragStart(segment.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2 flex-1">
                                <Move className="w-4 h-4 text-gray-400 cursor-move" />
                                <input
                                  type="text"
                                  value={segment.title}
                                  onChange={(e) => handleSegmentTitleChange(segment.id, e.target.value)}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder={`Отрезок ${index + 1}`}
                                />
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleTestSegment(segment.id)}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Тест
                                </button>
                                <button
                                  onClick={() => removeSegment(segment.id)}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="mb-2">
                              <select
                                value={segment.paragraphId}
                                onChange={(e) => handleSegmentParagraphChange(segment.id, e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">Выберите абзац</option>
                                {paragraphs.map(para => (
                                  <option key={para.id} value={para.id}>
                                    {para.text.substring(0, 50)}...
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">Цвет:</span>
                              {['blue', 'red', 'green'].map(color => (
                                <button
                                  key={color}
                                  onClick={() => handleSegmentHighlightChange(segment.id, color)}
                                  className={`w-4 h-4 rounded-full border ${
                                    segment.highlight === color ? 'border-gray-800' : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        {bookData.segments.length < 3 && (
                          <BookCreatorButton onClick={addSegment}>
                            <Plus className="w-4 h-4" />
                            Добавить отрезок
                          </BookCreatorButton>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Нет выбранного маршрута. Этот шаг опционален и доступен, если блог содержит маршрут.
                    </div>
                  )}
                </SectionContent>
              )}

              {/* Section: Предпросмотр и публикация */}
              <SectionButton
                isOpen={openSection === 'actions'}
                onClick={() => setOpenSection('actions')}
              >
                <span>Шаг 4: Предпросмотр и публикация</span>
                {openSection === 'actions' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </SectionButton>
              
              {openSection === 'actions' && (
                <SectionContent>
                  <div className="text-sm text-gray-600 mb-4 p-3 bg-blue-50 rounded-md">
                    📚 Книга публикуется как отдельный объект (Book) и будет доступна в чтении (BookView) и в разделе активности. В книгу попадут выбранные вами блоги в заданном порядке.
                  </div>
                  
                  <BookCreatorButton variant="preview" onClick={handlePreview}>
                    <Eye className="w-4 h-4" />
                    Предпросмотр
                  </BookCreatorButton>
                  
                  <div className="flex gap-2">
                    <BookCreatorButton variant="primary" onClick={handleSaveDraft}>
                      <Save className="w-4 h-4" />
                      Сохранить черновик
                    </BookCreatorButton>
                    
                    <BookCreatorButton 
                      variant="success" 
                      onClick={handlePublish}
                      disabled={bookData.blogs.length < 1}
                    >
                      <Send className="w-4 h-4" />
                      Опубликовать
                    </BookCreatorButton>
                  </div>
                </SectionContent>
              )}
            </BookCreatorContent>

            <BookCreatorFooter>
              <div className="text-sm text-gray-600">
                {bookData.blogs.length} блогов выбрано
              </div>
              <div className="flex gap-3">
                <FooterButton onClick={onClose}>
                  Отмена
                </FooterButton>
              </div>
            </BookCreatorFooter>
          </BookCreatorWrapper>
        </motion.div>
      )}

      {/* Редактор обложек */}
      <CoverEditor
        isOpen={showCoverEditor}
        onClose={() => setShowCoverEditor(false)}
        onSave={handleCoverEditorSave}
        initialCover={bookData.cover}
      />

      {/* Модальное окно предпросмотра */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg w-full max-w-4xl h-5/6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full">
                {/* Левая страница - Карта */}
                <div className="w-1/2 p-6 border-r border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Карта с отрезками</h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {/* Заглушка карты */}
                  <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Карта с выделенными отрезками</p>
                    </div>
                  </div>

                  {/* Список отрезков */}
                  <div className="space-y-2">
                    {bookData.segments.map((segment, index) => (
                      <div key={segment.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: segment.highlight }}
                        />
                        <span className="text-sm text-gray-700">{segment.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Правая страница - Текст */}
                <div className="w-1/2 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Текст книги</h3>
                  
                  {/* Обложка */}
                  <div className="mb-6">
                    <div 
                      className="h-32 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ 
                        backgroundColor: bookData.cover.color === 'white' ? '#ffffff' : 
                                       bookData.cover.color === 'gray' ? '#6b7280' :
                                       bookData.cover.color === 'blue' ? '#3b82f6' :
                                       bookData.cover.color === 'green' ? '#10b981' : '#8b5cf6',
                        color: bookData.cover.color === 'white' ? '#000000' : '#ffffff'
                      }}
                    >
                      {bookData.title || 'Название книги'}
                    </div>
                  </div>

                  {/* Содержимое */}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {paragraphs.map((para, index) => (
                      <div key={para.id} className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-700">{para.text}</p>
                        {bookData.segments.find(seg => seg.paragraphId === para.id) && (
                          <div className="mt-2 text-xs text-blue-600">
                            Связан с отрезком: {bookData.segments.find(seg => seg.paragraphId === para.id)?.title}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default BookCreator;
