import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MapPin, Navigation, Calendar, Image, Type, Map, Plus, Check, Save, X, FileText } from 'lucide-react';
import { useFavorites } from '../../contexts/FavoritesContext';
import PostMap from '../Maps/PostMap';
import { normalizeCategoryKey } from '../../constants/markerCategories';

interface PostConstructorProps {
  onSave: (postData: any) => void;
  onClose: () => void;
}

interface PostData {
  title: string;
  description: string;
  map: {
    visible: boolean;
    base: 'opentopo' | 'alidade';
    elements: {
      markers: any[];
      routes: any[];
      events: any[];
    };
  };
  images: {
    visible: boolean;
    items: any[];
  };
}

// Основной контейнер - обычная страница
const PageContainer = styled.div`
  width: 100%;
  height: 100vh;
  background: white;
  display: flex;
  overflow: hidden;
`;

// Главный контейнер - блок по центру экрана
const MainContainer = styled.div`
  width: 100%;
  height: 100%;
  background: white;
  display: flex;
  overflow: hidden;
`;

// Левая панель - 25% ширины
const LeftPanel = styled.div`
  width: 25%;
  background: #f8fafc;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
`;

// Правая панель - 75% ширины (25 см)
const RightPanel = styled.div`
  width: 75%;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-width: 25cm; /* 25 сантиметров */
`;

// Заголовок левой панели
const PanelTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 20px 0;
  padding: 0;
`;

// Кнопки управления
const ControlButton = styled.button<{ active?: boolean }>`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid ${props => props.active ? '#3b82f6' : '#e5e7eb'};
  border-radius: 8px;
  margin-bottom: 10px;
  background: ${props => props.active ? '#f0f9ff' : 'white'};
  color: ${props => props.active ? '#1e40af' : '#374151'};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 10px;
  
  &:hover {
    border-color: #3b82f6;
    background: #f0f9ff;
  }
`;

// Кнопки действий
const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.variant === 'primary' ? `
    background: #3b82f6;
    color: white;
    &:hover { background: #2563eb; }
  ` : `
    background: #f3f4f6;
    color: #374151;
    &:hover { background: #e5e7eb; }
  `}
`;

// Область предпросмотра
const PreviewArea = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

// Блок контента
const ContentBlock = styled.div<{ isSelected?: boolean }>`
  border: ${props => props.isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb'};
  border-radius: 8px;
  background: white;
  position: relative;
  cursor: pointer;
  
  &:hover {
    border-color: #3b82f6;
  }
`;

// Текстовые блоки - на всю ширину
const TextBlock = styled.div`
  padding: 20px;
  font-size: 16px;
  line-height: 1.6;
  color: #374151;
  min-height: 60px;
  outline: none;
  border: none;
  background: transparent;
  
  &:empty:before {
    content: attr(data-placeholder);
    color: #9ca3af;
  }
`;

// Заголовок - крупнее
const TitleBlock = styled(TextBlock)`
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
`;

// Карта - по центру
const MapBlock = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

const MapContainer = styled.div`
  width: 100%;
  max-width: 600px;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

// Изображения - горизонтально
const ImagesBlock = styled.div`
  display: flex;
  gap: 10px;
  padding: 20px;
  flex-wrap: wrap;
  justify-content: center;
`;

const ImageItem = styled.div`
  width: 150px;
  height: 150px;
  background: #f3f4f6;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  cursor: pointer;
  
  &:hover {
    border-color: #3b82f6;
    background: #f0f9ff;
  }
`;

// Кнопки внизу
const BottomButtons = styled.div`
  display: flex;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
`;

/* Модальные стили перенесены в `frontend/src/styles/_components.css`.
   Используйте классы: `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-title`, `.modal-list`,
   а также утилиты `.image-remove-btn`, `.image-cover`, `.pc-section-heading`, `.pc-btn-row`, `.pc-section`. */

type PostType = 'simple' | 'guide';

interface GuideSection {
  id: string;
  title: string;
  content: string;
  hasMap: boolean;
  routeId?: string;
  markerId?: string;
  eventId?: string;
}

const PostConstructor: React.FC<PostConstructorProps> = ({ onSave, onClose }) => {
  const favorites = useFavorites();
  const [postType, setPostType] = useState<PostType>('simple');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoritesType, setFavoritesType] = useState<'markers' | 'routes' | 'events'>('markers');
  
  // Для путеводителя: секции
  const [guideSections, setGuideSections] = useState<GuideSection[]>([]);
  
  const [postData, setPostData] = useState<PostData>({
    title: '',
    description: '',
    map: {
      visible: false, // Карта по умолчанию скрыта, пока не добавлен крючок контента
      base: 'alidade',
      elements: {
        markers: [],
        routes: [],
        events: []
      }
    },
    images: {
      visible: false,
      items: []
    }
  });


  const updateTitle = (text: string) => {
    setPostData(prev => ({ ...prev, title: text }));
  };

  const updateDescription = (text: string) => {
    setPostData(prev => ({ ...prev, description: text }));
  };

  const toggleMap = () => {
    setPostData(prev => ({
      ...prev,
      map: { ...prev.map, visible: !prev.map.visible }
    }));
  };

  const toggleImages = () => {
    setPostData(prev => ({
      ...prev,
      images: { ...prev.images, visible: !prev.images.visible }
    }));
  };

  // Функции для работы с избранным
  const openFavoritesModal = (type: 'markers' | 'routes' | 'events') => {
    setFavoritesType(type);
    setShowFavoritesModal(true);
  };

  const addFromFavorites = (type: 'markers' | 'routes' | 'events', element: any) => {
    // Автоматически включаем карту при добавлении первого элемента
    setPostData(prev => ({
      ...prev,
      map: {
        ...prev.map,
        visible: true // Автоматически включаем карту при добавлении крючка
      }
    }));
    
    // Проверяем, добавляем ли мы в секцию путеводителя
    const sectionId = (window as any).__currentGuideSectionId;
    if (sectionId && postType === 'guide') {
      const sectionIdx = guideSections.findIndex(s => s.id === sectionId);
      if (sectionIdx >= 0) {
        const newSections = [...guideSections];
        // Очищаем другие типы элементов
        newSections[sectionIdx].routeId = undefined;
        newSections[sectionIdx].markerId = undefined;
        newSections[sectionIdx].eventId = undefined;
        // Устанавливаем выбранный элемент
        if (type === 'routes') newSections[sectionIdx].routeId = element.id;
        else if (type === 'markers') newSections[sectionIdx].markerId = element.id;
        else if (type === 'events') newSections[sectionIdx].eventId = element.id;
        setGuideSections(newSections);
        (window as any).__currentGuideSectionId = undefined;
        setShowFavoritesModal(false);
        return;
      }
    }
    
    // Обычное добавление в простой пост
    setPostData(prev => ({
      ...prev,
      map: {
        ...prev.map,
        elements: {
          ...prev.map.elements,
          [type]: [...prev.map.elements[type], element]
        }
      }
    }));
    setShowFavoritesModal(false);
  };

  const removeMapElement = (type: 'markers' | 'routes' | 'events', elementId: string) => {
    setPostData(prev => {
      const newElements = {
        ...prev.map.elements,
        [type]: prev.map.elements[type].filter((item: any) => item.id !== elementId)
      };
      
      // Если все элементы удалены, автоматически скрываем карту
      const hasElements = newElements.markers.length > 0 || 
                         newElements.routes.length > 0 || 
                         newElements.events.length > 0;
      
      return {
        ...prev,
        map: {
          ...prev.map,
          visible: hasElements ? prev.map.visible : false, // Скрываем карту если нет элементов
          elements: newElements
        }
      };
    });
  };

  const addMapElement = (type: 'marker' | 'route' | 'event', element: any) => {
    setPostData(prev => ({
      ...prev,
      map: {
        ...prev.map,
        visible: true, // Автоматически включаем карту при добавлении элемента
        elements: {
          ...prev.map.elements,
          [type + 's']: [...prev.map.elements[type + 's' as keyof typeof prev.map.elements], element]
        }
      }
    }));
  };

  // Состояние для загрузки файлов
  const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
  
  // Обработка выбора файлов
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, imageId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }
    
    // Создаем превью
    const previewUrl = URL.createObjectURL(file);
    
    // Обновляем изображение с превью
    setPostData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        items: prev.images.items.map(img => 
          img.id === imageId 
            ? { ...img, src: previewUrl, alt: file.name, file: file }
            : img
        )
      }
    }));
    
    // Загружаем на сервер
    setUploadingImages(prev => ({ ...prev, [imageId]: true }));
    try {
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
        // Обновляем src на реальный URL с сервера
        setPostData(prev => ({
          ...prev,
          images: {
            ...prev.images,
            items: prev.images.items.map(img => 
              img.id === imageId 
                ? { ...img, src: data.photoUrl, alt: file.name }
                : img
            )
          }
        }));
      } else {
        alert('Ошибка загрузки изображения');
      }
    } catch (error) {
      alert('Ошибка загрузки изображения');
    } finally {
      setUploadingImages(prev => ({ ...prev, [imageId]: false }));
    }
    
    // Очищаем input
    e.target.value = '';
  };
  
  // Обработка drag and drop
  const handleImageDrop = async (e: React.DragEvent, imageId: string) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    // Создаем временный input для обработки
    const input = document.createElement('input');
    input.type = 'file';
    input.files = e.dataTransfer.files as any;
    const event = { target: input } as any;
    await handleImageFileSelect(event, imageId);
  };
  
  const addImage = () => {
    const newImage = {
      id: Date.now().toString(),
      src: '',
      alt: 'Новое изображение'
    };
    
    setPostData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        items: [...prev.images.items, newImage]
      }
    }));
  };
  
  // Удаление изображения
  const removeImage = (imageId: string) => {
    setPostData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        items: prev.images.items.filter(img => img.id !== imageId)
      }
    }));
  };

  const handleSave = async () => {
    // Валидация перед сохранением
    if (!postData.title && !postData.description) {
      alert('Добавьте заголовок или описание поста');
      return;
    }
    
    // Подготавливаем данные для сохранения
    // Извлекаем URL фото из items (только реальные URL с сервера, не blob)
    const photoUrls = postData.images.items
      .filter(img => img.src && !img.src.startsWith('blob:') && !img.src.startsWith('data:') && !img.src.startsWith('http://localhost:5173'))
      .map(img => img.src);
    
    // Формируем финальные данные поста
    const finalPostData = {
      ...postData,
      photoUrls: photoUrls.length > 0 ? photoUrls.join(',') : undefined
    };
    
    onSave(finalPostData);
  };

  return (
    <PageContainer>
      <MainContainer>
        {/* Левая панель - 25% */}
        <LeftPanel>
          <PanelTitle>Создать пост</PanelTitle>
          
          {/* Переключатель типа поста */}
          <div className="pc-toggle-group">
            <ControlButton
              active={postType === 'simple'}
              onClick={() => setPostType('simple')}
              className="pc-btn-full"
            >
              <FileText size={14} />
              Простой
            </ControlButton>
            <ControlButton
              active={postType === 'guide'}
              onClick={() => setPostType('guide')}
              className="pc-btn-full"
            >
              <Map size={14} />
              Путеводитель
            </ControlButton>
          </div>
          
          {/* Кнопки управления */}
          <ControlButton
            active={selectedBlock === 'title'}
            onClick={() => setSelectedBlock('title')}
          >
            <Type size={16} />
            Добавить название
          </ControlButton>
          
          <ControlButton
            active={selectedBlock === 'description'}
            onClick={() => setSelectedBlock('description')}
          >
            <Type size={16} />
            Добавить описание
          </ControlButton>
          
          <ControlButton
            active={postData.map.visible}
            onClick={toggleMap}
          >
            <Map size={16} />
            Добавить карту
          </ControlButton>
          
          <ControlButton
            active={postData.images.visible}
            onClick={toggleImages}
          >
            <Image size={16} />
            Добавить изображение
          </ControlButton>
          
          {/* Для путеводителя: кнопка добавления секции */}
          {postType === 'guide' && (
            <ControlButton
              onClick={() => {
                const newSection: GuideSection = {
                  id: `section-${Date.now()}`,
                  title: '',
                  content: '',
                  hasMap: false
                };
                setGuideSections([...guideSections, newSection]);
              }}
            >
              <Plus size={16} />
              Добавить секцию
            </ControlButton>
          )}
          
          {/* Кнопки для выбора из избранного */}
          {postData.map.visible && (
            <>
              <div className="pc-section">
                <div className="pc-label-sm">Фон карты</div>
                <div className="pc-btn-row">
                  <ControlButton active={postData.map.base === 'opentopo'} onClick={() => setPostData(prev => ({ ...prev, map: { ...prev.map, base: 'opentopo' } }))}>OpenTopoMap</ControlButton>
                  <ControlButton active={postData.map.base === 'alidade'} onClick={() => setPostData(prev => ({ ...prev, map: { ...prev.map, base: 'alidade' } }))}>Alidade Smooth</ControlButton>
                </div>
              </div>
              <h3 className="pc-section-header">Добавить на карту</h3>
              
              <ControlButton onClick={() => openFavoritesModal('markers')}>
                <MapPin size={16} />
                Выбрать метки
              </ControlButton>
              
              <ControlButton onClick={() => openFavoritesModal('routes')}>
                <Navigation size={16} />
                Выбрать маршруты
              </ControlButton>
              
              <ControlButton onClick={() => openFavoritesModal('events')}>
                <Calendar size={16} />
                Выбрать события
              </ControlButton>

              {/* Список выбранных элементов с крестиками для удаления */}
              {(postData.map.elements.markers.length > 0 || postData.map.elements.routes.length > 0 || postData.map.elements.events.length > 0) && (
                <div className="pc-selected-list">
                  {postData.map.elements.markers.length > 0 && (
                    <div>
                      <div className="pc-label-sm">Метки на карте</div>
                      <div className="pc-list-col">
                        {postData.map.elements.markers.map((m: any) => (
                          <div key={m.id} className="pc-list-item">
                            <div className="pc-text-muted-sm">{m.title}</div>
                            <button onClick={() => removeMapElement('markers', m.id)} className="pc-btn-icon-sm pc-btn-icon-danger">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {postData.map.elements.routes.length > 0 && (
                    <div>
                      <div className="pc-label-sm">Маршруты на карте</div>
                      <div className="pc-list-col">
                        {postData.map.elements.routes.map((r: any) => (
                          <div key={r.id} className="pc-list-item">
                            <div className="pc-text-muted-sm">{r.title}</div>
                            <button onClick={() => removeMapElement('routes', r.id)} className="pc-btn-icon-sm pc-btn-icon-danger">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {postData.map.elements.events.length > 0 && (
                    <div>
                      <div className="pc-label-sm">События на карте</div>
                      <div className="pc-list-col">
                        {postData.map.elements.events.map((e: any) => (
                          <div key={e.id} className="pc-list-item">
                            <div className="pc-text-muted-sm">{e.title}</div>
                            <button onClick={() => removeMapElement('events', e.id)} className="pc-btn-icon-sm pc-btn-icon-danger">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )} 
            </>
          )}
          
          {/* Для путеводителя: список секций */}
          {postType === 'guide' && guideSections.length > 0 && (
            <div className="pc-guide-wrapper">
              <div className="pc-section-heading">
                Секции путеводителя ({guideSections.length})
              </div>
              <div className="pc-guide-list">
                {guideSections.map((section, idx) => (
                  <div key={section.id} className={"pc-section-card " + (selectedBlock === `section-${section.id}` ? 'active' : '')}>
                    <div className="pc-list-item">
                      <span 
                        onClick={() => setSelectedBlock(`section-${section.id}`)}
                        className="pc-text-muted-sm pc-clickable"
                      >
                        {section.title || `Секция ${idx + 1}`}
                      </span>
                      <button
                        onClick={() => setGuideSections(guideSections.filter(s => s.id !== section.id))}
                        className="pc-btn-icon-sm pc-btn-icon-danger"
                        title="Удалить секцию"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Чекбокс для карты в секции */}
                    <div className="pc-checkbox-row">
                      <input
                        type="checkbox"
                        checked={section.hasMap}
                        onChange={(e) => {
                          const newSections = [...guideSections];
                          newSections[idx].hasMap = e.target.checked;
                          if (!e.target.checked) {
                            newSections[idx].routeId = undefined;
                            newSections[idx].markerId = undefined;
                            newSections[idx].eventId = undefined;
                          }
                          setGuideSections(newSections);
                        }}
                        id={`map-check-${section.id}`}
                        className="pc-checkbox-sm"
                      />
                      <label htmlFor={`map-check-${section.id}`} className="pc-label-sm">
                        Добавить карту
                      </label>
                    </div>
                    
                    {/* Выбор элемента для карты */}
                    {section.hasMap && (
                      <div className="pc-map-actions">
                        <button
                          onClick={() => {
                            setFavoritesType('routes');
                            setShowFavoritesModal(true);
                            // Сохраняем ID секции для добавления
                            (window as any).__currentGuideSectionId = section.id;
                          }}
                          className="pc-btn-action-sm"
                        >
                          Выбрать маршрут
                        </button>
                        <button
                          onClick={() => {
                            setFavoritesType('markers');
                            setShowFavoritesModal(true);
                            (window as any).__currentGuideSectionId = section.id;
                          }}
                          className="pc-btn-action-sm"
                        >
                          Выбрать метку
                        </button>
                        <button
                          onClick={() => {
                            setFavoritesType('events');
                            setShowFavoritesModal(true);
                            (window as any).__currentGuideSectionId = section.id;
                          }}
                          className="pc-btn-action-sm"
                        >
                          Выбрать событие
                        </button>
                        {(section.routeId || section.markerId || section.eventId) && (
                          <div className="pc-status-badge flex items-center gap-1">
                            <Check size={12} />
                            {section.routeId ? 'Маршрут добавлен' : section.markerId ? 'Метка добавлена' : section.eventId ? 'Событие добавлено' : ''}
                          </div>
                        )}
                      </div>
                    )} 
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Кнопки действий */}
          <div className="pc-bottom-actions">
            <ActionButton variant="secondary">
              <Save size={16} />
              Сохранить в черновик
            </ActionButton>
          </div> 
        </LeftPanel>
        
        {/* Правая панель - 75% */}
        <RightPanel>
          <PreviewArea>
            {/* Заголовок */}
            <ContentBlock
              isSelected={selectedBlock === 'title'}
              onClick={() => setSelectedBlock('title')}
            >
              <TitleBlock
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateTitle(e.currentTarget.textContent || '')}
                data-placeholder="Заголовок с возможностью редактирования, сразу вставляется как в сообществе имя автора или ресурса"
              />
            </ContentBlock>
            
            {/* Описание */}
            <ContentBlock
              isSelected={selectedBlock === 'description'}
              onClick={() => setSelectedBlock('description')}
            >
              <TextBlock
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateDescription(e.currentTarget.textContent || '')}
                data-placeholder="А вот в этом окне пользователь пишет посты, редактирует их путём создания формы редактора при вводе текста добавляет изображения и включает по чекбоксу контейнер карты, и всё это перемещает так как ему хочется, главное не оставлять свободного неиспользованного места при его создании."
              />
            </ContentBlock>
            
            {/* Карта - показываем только если есть элементы (маркеры/маршруты/события) */}
            {postData.map.visible && 
             (postData.map.elements.markers.length > 0 || 
              postData.map.elements.routes.length > 0 || 
              postData.map.elements.events.length > 0) && (
              <ContentBlock onClick={() => setSelectedBlock('map')}>
                <MapBlock>
                  <MapContainer>
                    <PostMap
                      anchors={postData.map.elements.markers.map((m:any)=>{
                        // ПРИОРИТЕТ 1: явные поля lat/lon (самый надёжный вариант)
                        let lat = Number.isFinite(m.lat) ? Number(m.lat) : (Number.isFinite(m.latitude) ? Number(m.latitude) : null);
                        let lon = Number.isFinite(m.lon) ? Number(m.lon) : (Number.isFinite(m.longitude) ? Number(m.longitude) : null);
                        
                        // ПРИОРИТЕТ 2: из coordinates [lat, lon] (если явных полей нет)
                        if ((lat === null || lon === null) && Array.isArray(m.coordinates) && m.coordinates.length >= 2) {
                          lat = lat === null ? Number(m.coordinates[0]) : lat;
                          lon = lon === null ? Number(m.coordinates[1]) : lon;
                        }
                        
                        // Проверка валидности и исправление перепутанных координат
                        if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== null && lon !== null) {
                          const latOk = lat >= -90 && lat <= 90;
                          const lonOk = lon >= -180 && lon <= 180;
                          // Если lat вне диапазона, но lon в диапазоне lat - координаты перепутаны
                          if (!latOk && lonOk && lon >= -90 && lon <= 90) {
                            [lat, lon] = [lon, lat];
                          }
                        }
                        
                        // Фильтруем только валидные координаты
                        const finalLat = Number.isFinite(lat) && lat !== null ? lat : 0;
                        const finalLon = Number.isFinite(lon) && lon !== null ? lon : 0;
                        
                        return { 
                          id: m.id, 
                          lat: finalLat, 
                          lon: finalLon, 
                          title: m.title || m.name || '',
                          category: m.category || m.type || undefined,
                          description: m.description || undefined
                        };
                      })
                      .filter(anchor => anchor.lat !== 0 || anchor.lon !== 0)} // Убираем маркеры с нулевыми координатами
                      route={postData.map.elements.routes[0] ? { 
                        id: postData.map.elements.routes[0].id, 
                        route_data: { 
                          // ПРИОРИТЕТ: используем сохранённую geometry из route_data, если она есть
                          geometry: Array.isArray((postData.map.elements.routes[0] as any).route_data?.geometry)
                            ? (postData.map.elements.routes[0] as any).route_data.geometry
                            : (Array.isArray(postData.map.elements.routes[0].coordinates) 
                                ? postData.map.elements.routes[0].coordinates 
                                : undefined),
                          points: Array.isArray(postData.map.elements.routes[0].coordinates)
                            ? postData.map.elements.routes[0].coordinates
                            : undefined
                        } 
                      } : undefined}
                      zoom={12}
                      glBase={postData.map.base}
                    />
                  </MapContainer>
                </MapBlock>
              </ContentBlock>
            )}
            
            {/* Изображения */}
            {postData.images.visible && (
              <ContentBlock onClick={() => setSelectedBlock('images')}>
                <div className="pc-images-header">
                  <h3 className="pc-images-title">Фотографии</h3>
                  <p className="pc-images-hint">
                    Нажмите на фото или перетащите файл для загрузки
                  </p>
                </div>
                <ImagesBlock>
                  {postData.images.items.map((image, index) => {
                    const imageId = `image-upload-${image.id}`;
                    return (
                      <ImageItem 
                        key={image.id}
                        onDrop={(e) => handleImageDrop(e, image.id)}
                        onDragOver={(e) => e.preventDefault()}
                        className="image-item"
                      >
                        {image.src ? (
                          <>
                            <img 
                              src={image.src} 
                              alt={image.alt} 
                              className="image-cover" 
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(image.id);
                              }}
                              className="image-remove-btn"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              id={imageId}
                              style={{ display: 'none' }}
                              onChange={(e) => handleImageFileSelect(e, image.id)}
                            />
                            <label htmlFor={imageId} className="pc-img-placeholder">
                              {uploadingImages[image.id] ? (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '12px', color: '#666' }}>Загрузка...</div>
                                </div>
                              ) : (
                                <>
                                  <Image size={32} color="#94a3b8" />
                                  <div style={{ fontSize: '12px', marginTop: '5px', color: '#64748b' }}>
                                    ФОТО {index + 1}
                                  </div>
                                  <div style={{ fontSize: '10px', marginTop: '4px', color: '#94a3b8' }}>
                                    Клик или перетащите
                                  </div>
                                </>
                              )}
                            </label>
                          </>
                        )}
                      </ImageItem>
                    );
                  })}
                  
                  {postData.images.items.length < 10 && (
                    <ImageItem onClick={addImage}>
                      <div className="pc-img-placeholder" style={{ textAlign: 'center' }}>
                        <Plus size={32} color="#94a3b8" />
                        <div style={{ fontSize: '12px', marginTop: '5px', color: '#64748b' }}>Добавить</div>
                      </div>
                    </ImageItem>
                  )}
                </ImagesBlock>
              </ContentBlock>
            )}
            
            {/* Для путеводителя: секции */}
            {postType === 'guide' && guideSections.map((section, idx) => (
              <ContentBlock key={section.id} onClick={() => setSelectedBlock(`section-${section.id}`)}>
                <div className="pc-section-preview-content">
                  <TitleBlock
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const newSections = [...guideSections];
                      newSections[idx].title = e.currentTarget.textContent || '';
                      setGuideSections(newSections);
                    }}
                    data-placeholder={`Заголовок секции ${idx + 1}`}
                    className="pc-mb-md"
                  />
                  <TextBlock
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const newSections = [...guideSections];
                      newSections[idx].content = e.currentTarget.textContent || '';
                      setGuideSections(newSections);
                    }}
                    data-placeholder={`Текст секции ${idx + 1}...`}
                  />
                  {section.hasMap && (() => {
                    // Находим элемент из избранного для отображения
                    let markerData = null;
                    let routeData = null;
                    let eventData = null;
                    
                    if (section.markerId) {
                      markerData = favorites?.favoritePlaces?.find(p => p.id === section.markerId);
                    }
                    if (section.routeId) {
                      routeData = favorites?.favoriteRoutes?.find(r => r.id === section.routeId);
                    }
                    if (section.eventId) {
                      eventData = favorites?.favoriteEvents?.find(e => e.id === section.eventId);
                    }
                    
                    return (
                      <div className="pc-mt-md">
                        <MapBlock>
                          <MapContainer>
                            <PostMap
                              anchors={markerData ? [{
                                id: markerData.id,
                                lat: markerData.latitude,
                                lon: markerData.longitude,
                                title: markerData.name || '',
                                category: (markerData as any).category || (markerData as any).type
                              }] : eventData ? [{
                                id: eventData.id,
                                lat: eventData.latitude,
                                lon: eventData.longitude,
                                title: eventData.title || '',
                                category: (eventData as any).category || 'event'
                              }] : []}
                              route={routeData ? {
                                id: routeData.id,
                                route_data: {
                                  geometry: (routeData as any).route_data?.geometry || 
                                    (Array.isArray((routeData as any).coordinates) ? (routeData as any).coordinates : []),
                                  points: Array.isArray((routeData as any).coordinates) ? (routeData as any).coordinates : []
                                }
                              } : undefined}
                              zoom={12}
                              glBase={postData.map.base}
                            />
                          </MapContainer>
                        </MapBlock>
                      </div>
                    );
                  })()}
                </div>
              </ContentBlock>
            ))}
            
            {/* Стандартные кнопки сообщества */}
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', marginTop: '20px' }}>
              Тут стандартный набор кнопок для сообщества
            </div>
          </PreviewArea>
          
          {/* Кнопки внизу */}
          <BottomButtons>
            <ActionButton variant="secondary" onClick={onClose}>
              <X size={16} />
              Отмена
            </ActionButton>
            <ActionButton variant="primary" onClick={handleSave}>
              <Save size={16} />
              Опубликовать
            </ActionButton>
          </BottomButtons>
        </RightPanel>
      </MainContainer>
      
      {/* Модальное окно для выбора из избранного */}
      {showFavoritesModal && (
        <div className="modal-overlay" onClick={() => setShowFavoritesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                Выбрать {favoritesType === 'markers' ? 'метки' : favoritesType === 'routes' ? 'маршруты' : 'события'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowFavoritesModal(false)}>&times;</button>
            </div>

            <div className="modal-list">
              {favoritesType === 'markers' && favorites?.favoritePlaces?.map(place => (
                <div key={place.id} className="pc-list-item">
                  <div className="pc-fill-flex">
                    <div className="pc-text-muted-sm">{place.name}</div>
                    <div className="pc-label-sm">{place.description || place.location}</div>
                  </div>
                  <button className="pc-btn-action-sm" onClick={() => {
                    const categoryKey = normalizeCategoryKey((place as any).category || place.type || undefined);
                    addFromFavorites('markers', {
                      id: place.id,
                      coordinates: place.coordinates || [place.latitude, place.longitude],
                      latitude: place.latitude,
                      longitude: place.longitude,
                      lat: place.latitude,
                      lon: place.longitude,
                      title: place.name,
                      description: place.description || place.location,
                      category: categoryKey
                    });
                  }}>Добавить</button>
                </div>
              ))}

              {favoritesType === 'routes' && favorites?.favoriteRoutes
                ?.filter((route: any) => {
                  const tags = Array.isArray(route?.tags) ? route.tags : [];
                  return route?.categories?.post || route?.purpose === 'post' || route?.category === 'post' || tags.includes('post');
                })
                .map(route => (
                <div key={route.id} className="pc-list-item">
                  <div className="pc-fill-flex">
                    <div className="pc-text-muted-sm">{route.title}</div>
                    <div className="pc-label-sm">{route.description}</div>
                  </div>
                  <button className="pc-btn-action-sm" onClick={() => {
                    const toNum = (v: any) => (v === null || v === undefined ? NaN : Number(v));
                    const norm = (a: any, b: any): [number, number] | null => {
                      const x = toNum(a); const y = toNum(b);
                      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                      if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y];
                      if (Math.abs(x) <= 90 && Math.abs(y) <= 180) return [y, x];
                      return null;
                    };
                    let coordinates: [number, number][] = [];
                    
                    if ((route as any).route_data?.geometry && Array.isArray((route as any).route_data.geometry)) {
                      coordinates = (route as any).route_data.geometry
                        .map((coord: any) => {
                          if (Array.isArray(coord) && coord.length >= 2) {
                            return norm(coord[0], coord[1]);
                          }
                          return null;
                        })
                        .filter((c: any): c is [number, number] => Array.isArray(c));
                    } else if ((route as any).route_data?.polyline && Array.isArray((route as any).route_data.polyline)) {
                      coordinates = (route as any).route_data.polyline
                        .map((coord: any) => norm(coord[0], coord[1]))
                        .filter((c: any): c is [number, number] => Array.isArray(c));
                    } else if (Array.isArray((route as any).waypoints) && (route as any).waypoints.length > 0) {
                      coordinates = (route as any).waypoints
                        .map((wp: any) => norm(wp.longitude ?? wp.lng ?? (wp.coordinates?.[1]), wp.latitude ?? wp.lat ?? (wp.coordinates?.[0])))
                        .filter((c: any): c is [number, number] => Array.isArray(c));
                    } else if (Array.isArray((route as any).points) && (route as any).points.length > 0) {
                      coordinates = (route as any).points
                        .map((p: any) => norm(p.longitude ?? p.lng ?? (p.coordinates?.[1]), p.latitude ?? p.lat ?? (p.coordinates?.[0])))
                        .filter((c: any): c is [number, number] => Array.isArray(c));
                    }
                    const latlon: [number, number][] = coordinates
                      .map((c: any) => Array.isArray(c) && c.length === 2 ? [c[1], c[0]] as [number, number] : c)
                      .filter((c: any): c is [number, number] => Array.isArray(c));
                    const routeWithGeometry: any = {
                      id: route.id,
                      coordinates: latlon,
                      title: route.title,
                      description: route.description,
                      route_data: {
                        geometry: (route as any).route_data?.geometry || latlon,
                        points: latlon
                      }
                    };
                    addFromFavorites('routes', routeWithGeometry);
                  }}>Добавить</button>
                </div>
              ))}

              {favoritesType === 'events' && favorites?.favoriteEvents?.map(event => (
                <div key={event.id} className="pc-list-item">
                  <div className="pc-fill-flex">
                    <div className="pc-text-muted-sm">{event.title}</div>
                    <div className="pc-label-sm">{event.description || event.location}</div>
                  </div>
                  <button className="pc-btn-action-sm" onClick={() => addFromFavorites('events', {
                    id: event.id,
                    coordinates: (event as any).coordinates || [event.latitude, event.longitude],
                    latitude: event.latitude,
                    longitude: event.longitude,
                    lat: event.latitude,
                    lon: event.longitude,
                    title: event.title,
                    description: event.description,
                    date: event.date,
                    time: '12:00',
                    location: event.location,
                    category: (event as any).category || (event as any).type || 'event'
                  })}>Добавить</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default PostConstructor;
