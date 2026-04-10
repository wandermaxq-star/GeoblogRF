import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  FaFont, FaListAlt, FaAlignLeft, FaMapMarkerAlt, FaHashtag, FaImage,
  FaChevronDown, FaChevronUp, FaExclamationTriangle
} from 'react-icons/fa';
import { CATEGORIES } from '../../constants/categories';
import { markerService } from '../../services/markerService';
import { GlassPanel, GlassHeader, GlassAccordion, GlassButton, GlassInput } from '../Glass';
import { useContentStore } from '../../stores/contentStore';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/use-mobile';

const HEADER_FOOTER_BG = '#dadada';
const HEADER_FOOTER_TEXT = '#222';
const SECTION_BORDER = '#bcbcbc';

const Wrapper = styled.div`
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
  border: 2px solid ${SECTION_BORDER};
  max-width: 220px;
  width: 100%;
  min-width: 200px;
  padding: 0;
  display: flex;
  flex-direction: column;
  font-size: 15px;
  overflow: hidden;
  z-index: 1600;
`;

// Информационный блок о культуре меток
const CultureInfo = styled.div`
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  border: 1px solid #c3e6c3;
  border-radius: 8px;
  padding: 6px 8px;
  margin: 4px 0 8px 0;
  font-size: 11px;
  color: #2d5a2d;
  line-height: 1.3;
  
  .culture-title {
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .culture-text {
    opacity: 0.9;
  }
`;

const AccordionBox = styled.div`
  background: #fff;
  border-radius: 16px;
  box-shadow: none;
  overflow: hidden;
  border: none;
`;

const Header = styled.div`
  background: ${HEADER_FOOTER_BG};
  color: ${HEADER_FOOTER_TEXT};
  font-size: 1.08em;
  font-weight: bold;
  padding: 12px 0;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  letter-spacing: 0.01em;
  text-align: center;
`;

const AccordionSection = styled.div<{ active?: boolean }>`
  background: ${({ active }) => (active ? '#f4f4f4' : '#fff')};
  color: #222;
  display: flex;
  align-items: center;
  padding: 0;
  border-bottom: 1.5px solid ${SECTION_BORDER};
  transition: background 0.2s;
  cursor: pointer;
  position: relative;
`;

const IconBox = styled.div<{ active?: boolean }>`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 1.1em;
`;

const SectionTitle = styled.div`
  flex: 1;
  font-weight: 600;
  font-size: 0.98em;
  padding: 0 0 0 2px;
  text-align: center;
`;

const CheckCircle = styled.span<{ completed: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${({ completed }) => (completed ? '#7bc043' : '#bbb')};
  background: ${({ completed }) => (completed ? '#7bc043' : 'transparent')};
  display: inline-block;
  margin-left: 6px;
  transition: background 0.2s, border 0.2s;
  position: relative;
  &::after {
    content: '';
    display: ${({ completed }) => (completed ? 'block' : 'none')};
    position: absolute;
    left: 3px; top: 1px;
    width: 4px; height: 8px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
`;

const Chevron = styled.div`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  margin-right: 8px;
`;

const SectionContent = styled.div`
  background: #f8f9fa;
  padding: 6px;
  border-top: 1px solid #e9ecef;
  margin-bottom: 2px;
`;

const Label = styled.label`
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 1px;
  font-size: 0.7em;
  text-align: center;
  line-height: 1.2;
`;

const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 0.7em;
  background: ${props => props.$hasError ? '#fdf2f2' : '#fff'};
  color: #333;
  border: ${props => props.$hasError ? '1px solid #fecaca' : '1px solid #d1d5db'};
  margin-bottom: 1px;
  
  &:focus {
    outline: none;
    border: 1px solid ${props => props.$hasError ? '#e74c3c' : '#3498db'};
    box-shadow: 0 0 0 2px ${props => props.$hasError ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)'};
  }
`;

const Select = styled.select<{ $hasError?: boolean }>`
  width: 100%;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  background: ${props => props.$hasError ? '#fdf2f2' : '#fff'};
  color: #333;
  border: ${props => props.$hasError ? '1px solid #fecaca' : '1px solid #d1d5db'};
  margin-bottom: 2px;
  
  &:focus {
    outline: none;
    border: 1px solid ${props => props.$hasError ? '#e74c3c' : '#3498db'};
    box-shadow: 0 0 0 2px ${props => props.$hasError ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)'};
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  background: #fff;
  color: #333;
  border: 1px solid #d1d5db;
  margin-bottom: 2px;
  min-height: 20px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border: 1px solid #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  font-size: 0.8em;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const HelpText = styled.div`
  color: #666;
  font-size: 0.8em;
  margin-top: 4px;
  line-height: 1.4;
`;

const Footer = styled.div`
  background: ${HEADER_FOOTER_BG};
  padding: 8px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
`;

const Button = styled.button<{ primary?: boolean; secondary?: boolean }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
  
  ${props => props.primary && `
    background: #3498db;
    color: #fff;
    border-color: #3498db;
    
    &:hover {
      background: #2980b9;
      border-color: #2980b9;
    }
  `}
  
  ${props => props.secondary && `
    background: #6c757d;
    color: #fff;
    border-color: #6c757d;
    
    &:hover {
      background: #5a6268;
      border-color: #5a6268;
    }
  `}
  
  ${props => !props.primary && !props.secondary && `
    background: #fff;
    color: #6c757d;
    border-color: #6c757d;
    
    &:hover {
      background: #f8f9fa;
    }
  `}
`;

const fields = [
  {
    key: 'title',
    label: 'Название',
    icon: <FaFont />,
    type: 'input',
    placeholder: 'Введите название',
    helpText: '💡 Используйте официальное название или понятное описание места'
  },
  {
    key: 'category',
    label: 'Категория',
    icon: <FaListAlt />,
    type: 'select',
    options: [
      { value: '', label: 'Выберите категорию' },
      ...(() => {
        const supportedCategories = [
          'attraction',
          'restaurant', 
          'hotel',
          'nature',
          'culture',
          'entertainment',
          'transport',
          'service',
          'other'
        ];
        return CATEGORIES
          .filter(cat => supportedCategories.includes(cat.key))
          .map(cat => ({ value: cat.key, label: cat.label }));
      })()
    ],
    helpText: '💡 Выберите наиболее подходящую категорию для лучшей классификации'
  },
  {
    key: 'description',
    label: 'Описание',
    icon: <FaAlignLeft />,
    type: 'textarea',
    placeholder: 'Краткое описание',
    helpText: '💡 Здесь можно выразить ваше мнение и впечатления о месте'
  },
  {
    key: 'address',
    label: 'Адрес',
    icon: <FaMapMarkerAlt />,
    type: 'input',
    placeholder: 'Адрес (необязательно)',
    helpText: '💡 Точный адрес места'
  },
  {
    key: 'hashtags',
    label: '# Хэштеги',
    icon: <FaHashtag />,
    type: 'input',
    placeholder: 'Введите хэштеги через запятую',
    helpText: '💡 Добавьте теги для лучшего поиска (например: #парк, #история, #отдых)'
  },
  {
    key: 'photoUrls',
    label: 'Фото (URL)',
    icon: <FaImage />,
    type: 'input',
    placeholder: 'Ссылки на фотографии через запятую',
    helpText: '💡 Ссылки на фотографии места'
  }
];

interface ElegantAccordionFormProps {
  coords: [number, number];
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
  showCultureMessage?: boolean;
  onCultureMessageClose?: () => void;
  discoveredPlace?: {
    name: string;
    address: string;
    type: string;
    category: string;
    source: string;
  } | null;
}

export const ElegantAccordionForm: React.FC<ElegantAccordionFormProps> = ({
  onSubmit,
  onCancel,
  showCultureMessage: showCultureMessageProp = false,
  onCultureMessageClose,
  discoveredPlace
}) => {
  const { user, token } = useAuth();
  const isMobile = useIsMobile();
  const [openIdx, setOpenIdx] = useState<number | null>(null); // Все меню закрыты по умолчанию
  const [form, setForm] = useState<any>({
    title: '',
    description: '',
    category: 'other',
    hashtags: '',
    photoUrls: '',
    address: ''
  });
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false); // Показывать ли выпадающий список с предложениями
  const [photoMode, setPhotoMode] = useState<'upload' | 'collection' | 'link'>('link');
  const [userPhotos, setUserPhotos] = useState<string[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [photoLink, setPhotoLink] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Предзаполняем форму данными из геопоиска
  useEffect(() => {
    if (discoveredPlace) {
      setForm((prev: any) => ({
        ...prev,
        title: discoveredPlace.name,
        address: discoveredPlace.address,
        category: discoveredPlace.category || 'other'
      }));
    }
  }, [discoveredPlace]);

  // Загружаем фото пользователя при открытии формы (только для авторизованных)
  useEffect(() => {
    // КРИТИЧНО: Фото пользователя загружаем только для авторизованных пользователей
    if (!user || !token) {
      setIsLoadingPhotos(false);
      setUserPhotos([]);
      return;
    }
    
    setIsLoadingPhotos(true);
    markerService.getUserPhotos()
      .then(photos => {
        setUserPhotos(photos);
        setIsLoadingPhotos(false);
      })
      .catch(() => {
        setIsLoadingPhotos(false);
      });
  }, [user, token]);

  // Скрываем выпадающий список при клике вне поля
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.suggestions-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Состояние для ошибок валидации
  const [titleError, setTitleError] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Валидация названия согласно принципам культуры меток
  const validateTitle = (title: string) => {
    if (!title.trim()) {
      return 'Название обязательно для заполнения';
    }
    
    if (title.trim().length < 3) {
      return 'Название должно содержать минимум 3 символа';
    }
    
    if (title.trim().length > 100) {
      return 'Название не должно превышать 100 символов';
    }
    
    // Проверяем на нежелательные символы
    const forbiddenChars = /[<>{}[\]\\|`~!@#$%^&*+=]/;
    if (forbiddenChars.test(title)) {
      return 'Название содержит недопустимые символы';
    }
    
    // Проверяем на множественные пробелы
    if (/\s{2,}/.test(title)) {
      return 'Не используйте множественные пробелы';
    }
    
    return null;
  };

  // Обработчик изменения названия
  const handleTitleChange = (value: string) => {
    setForm((prev: any) => ({ ...prev, title: value }));
      const error = validateTitle(value);
    if (error) {
      setTitleError(error);
    } else {
      setTitleError('');
    }
  };

  // Обработчик изменения категории
  const handleCategoryChange = (value: string) => {
    setForm((prev: any) => ({ ...prev, category: value }));
    if (value) {
      setCategoryError('');
    }
  };

  const handleChange = (key: string, value: string) => {
    if (key === 'title') {
      handleTitleChange(value);
    } else if (key === 'category') {
      handleCategoryChange(value);
    } else {
      setForm((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handlePhotoSelect = (photoUrl: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoUrl) 
        ? prev.filter(url => url !== photoUrl)
        : [...prev, photoUrl]
    );
  };

  const handlePhotoLinkAdd = () => {
    if (photoLink.trim()) {
      setSelectedPhotos(prev => [...prev, photoLink.trim()]);
      setPhotoLink('');
    }
  };

  const removePhoto = (index: number, type: 'uploaded' | 'selected') => {
    if (type === 'uploaded') {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const isCompleted = (key: string) => {
    if (key === 'title') return form[key]?.trim().length > 0 && !titleError;
    if (key === 'category') return !!form[key] && !categoryError;
    // Остальные поля опциональны
    return true;
  };

  const allCompleted = fields.every(f => isCompleted(f.key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Финальная валидация перед отправкой
    const titleValidationError = validateTitle(form.title);
    if (titleValidationError) {
      setTitleError(titleValidationError);
      return;
    }
    
    if (!allCompleted) return;
    
    // Подготавливаем фото для отправки
    let photoUrls: string[] = [...selectedPhotos];
    
    // Загружаем файлы на сервер и получаем URL
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
        photoUrls = [...photoUrls, ...uploadedUrls.filter(url => url !== null)];
      } catch (error) {
      }
    }
    
    // Объединяем все фото
    const finalPhotoUrls = photoUrls.length > 0 ? photoUrls.join(',') : '';
    
    if (onSubmit) {
      onSubmit({
        ...form,
        photoUrls: finalPhotoUrls || form.photoUrls || ''
      });
    }
  };

  const rightContent = useContentStore(s => s.rightContent);
  const isTwoPanelMode = rightContent !== null && !isMobile;

  return (
    <GlassPanel
      isOpen={true}
      onClose={onCancel || (() => {})}
      position="center"
      width="220px"
      closeOnOverlayClick={true}
      showCloseButton={false}
      className="add-marker-panel"
      constrainToMapArea={isTwoPanelMode}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '42vh' }}>
        <GlassHeader
          title="Добавить метку"
          onClose={onCancel || (() => {})}
          showCloseButton={false}
        />
        <div style={{ flex: 1, overflow: 'hidden', padding: '3px 10px 6px 10px', maxHeight: 'calc(42vh - 45px)', textAlign: 'center' }}>
          
          {fields.map((field, idx) => (
            <React.Fragment key={field.key}>
              <GlassAccordion
                title={field.label}
                defaultOpen={openIdx === idx}
                onToggle={(isOpen) => {
                  // Если кликаем на "Название", скрываем сообщение о культуре
                  if (field.key === 'title' && onCultureMessageClose) {
                    onCultureMessageClose();
                  }
                  setOpenIdx(isOpen ? idx : null);
                }}
              >
                <SectionContent>
                  {/* Поле "Название" - обычное поле с возможностью геопоиска */}
                  {field.key === 'title' && (
                    <div>
                      <Label>Название *</Label>
                      
                                            {/* Информация об обнаруженном месте - показываем только если найдено */}
                      {discoveredPlace && (
                        <div style={{ marginBottom: '6px' }}>
                          <Label style={{ fontSize: '0.75em', color: '#666', marginBottom: '2px' }}>
                            🔍 Найдено место:
                          </Label>
                          <div style={{
                            background: '#f8f9fa',
                            border: '1px solid #e9ecef',
                            borderRadius: '4px',
                            padding: '4px',
                            fontSize: '0.75em',
                            color: '#666'
                          }}>
                            <div><strong>Название:</strong> {discoveredPlace.name}</div>
                            <div><strong>Адрес:</strong> {discoveredPlace.address}</div>
                            <div><strong>Тип:</strong> {discoveredPlace.type}</div>
                            <div><strong>Категория:</strong> {discoveredPlace.category}</div>
                          </div>
                        </div>
                      )}
                      

                      
                      {/* Поле для ввода названия с выпадающим списком */}
                      <div style={{ position: 'relative' }}>
                        <Input
                          type="text"
                          value={form[field.key]}
                          onChange={e => {
                            handleChange(field.key, e.target.value);
                            // Показываем выпадающий список при вводе
                            if (e.target.value.length > 0) {
                              setShowSuggestions(true);
                            } else {
                              setShowSuggestions(false);
                            }
                          }}
                          onFocus={() => {
                            // Показываем предложения при фокусе
                            if (discoveredPlace || form.title.length > 0) {
                              setShowSuggestions(true);
                            }
                          }}
                          placeholder={field.placeholder}
                          $hasError={!!titleError}
                        />
                        
                        {/* Выпадающий список с предложениями */}
                        {showSuggestions && (
                          <div 
                            className="suggestions-container"
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              zIndex: 1000,
                              maxHeight: '150px',
                              overflowY: 'auto'
                            }}
                          >
                            {/* Предложение из геопоиска */}
                            {discoveredPlace && (
                              <div
                                style={{
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f1f5f9',
                                  background: '#f8fafc',
                                  fontSize: '0.75em'
                                }}
                                onClick={() => {
                                  setForm((prev: any) => ({
                                    ...prev,
                                    title: discoveredPlace.name,
                                    address: discoveredPlace.address,
                                    category: discoveredPlace.category || 'other'
                                  }));
                                  setShowSuggestions(false);
                                }}
                              >
                                <div style={{ fontWeight: 'bold', color: '#1e40af' }}>
                                  🔍 {discoveredPlace.name}
                                </div>
                                <div style={{ fontSize: '0.8em', color: '#64748b' }}>
                                  {discoveredPlace.address}
                                </div>
                              </div>
                            )}
                            
                            {/* Ручной ввод */}
                            <div
                              style={{
                                padding: '4px 6px',
                                cursor: 'pointer',
                                background: '#fef3c7',
                                fontSize: '0.75em'
                              }}
                              onClick={() => {
                                setForm((prev: any) => ({
                                  ...prev,
                                  title: '',
                                  address: ''
                                }));
                                setShowSuggestions(false);
                              }}
                            >
                              <div style={{ fontWeight: 'bold', color: '#92400e' }}>
                                ✏️ Ввести своё название
                              </div>
                              <div style={{ fontSize: '0.8em', color: '#92400e' }}>
                                Создать новое название для места
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <HelpText>{field.helpText}</HelpText>
                      {titleError && <ErrorMessage>{titleError}</ErrorMessage>}
                    </div>
                  )}
                  
                  {/* Остальные поля */}
                  {field.key !== 'title' && (
                    // Обычные поля для остальных секций
                    <>
                  {/* Специальная обработка для поля фото */}
                  {field.key === 'photoUrls' ? (
                    <div>
                      <Label>Фото (опционально)</Label>
                      
                      {/* Переключатель режима добавления фото */}
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <button
                          type="button"
                          onClick={() => setPhotoMode('upload')}
                          style={{
                            padding: '1px 4px',
                            background: photoMode === 'upload' ? '#3498db' : '#f0f0f0',
                            color: photoMode === 'upload' ? '#fff' : '#333',
                            border: 'none',
                            borderRadius: 2,
                            cursor: 'pointer',
                            fontSize: 8,
                            lineHeight: '1.1'
                          }}
                        >
                          📤 Файл
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoMode('collection')}
                          style={{
                            padding: '1px 4px',
                            background: photoMode === 'collection' ? '#3498db' : '#f0f0f0',
                            color: photoMode === 'collection' ? '#fff' : '#333',
                            border: 'none',
                            borderRadius: 2,
                            cursor: 'pointer',
                            fontSize: 8,
                            lineHeight: '1.1'
                          }}
                        >
                          🖼️ Коллекция
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoMode('link')}
                          style={{
                            padding: '1px 4px',
                            background: photoMode === 'link' ? '#3498db' : '#f0f0f0',
                            color: photoMode === 'link' ? '#fff' : '#333',
                            border: 'none',
                            borderRadius: 2,
                            cursor: 'pointer',
                            fontSize: 8,
                            lineHeight: '1.1'
                          }}
                        >
                          🔗 Ссылка
                        </button>
                      </div>

                      {/* Режим загрузки файла */}
                      {photoMode === 'upload' && (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileUpload}
                            style={{ marginBottom: 6, fontSize: 10 }}
                          />
                          {uploadedFiles.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                              {uploadedFiles.map((file, index) => (
                                <div key={index} style={{ position: 'relative' }}>
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      objectFit: 'cover',
                                      borderRadius: 3,
                                      border: '1px solid #3498db'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(index, 'uploaded')}
                                    style={{
                                      position: 'absolute',
                                      top: -6,
                                      right: -6,
                                      background: '#ff4444',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: 16,
                                      height: 16,
                                      cursor: 'pointer',
                                      fontSize: 10
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Режим выбора из коллекции */}
                      {photoMode === 'collection' && (
                        <div>
                          {isLoadingPhotos ? (
                            <div style={{ padding: 10, textAlign: 'center', color: '#666', fontSize: 10 }}>
                              Загрузка фото...
                            </div>
                          ) : userPhotos.length === 0 ? (
                            <div style={{ padding: 6, textAlign: 'center', color: '#666', background: '#f8f8f8', borderRadius: 3, fontSize: 10 }}>
                              У вас пока нет загруженных фото. Загрузите фото в других маркерах, чтобы использовать их здесь.
                            </div>
                          ) : (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                              gap: 4,
                              maxHeight: '150px',
                              overflowY: 'auto',
                              padding: 4,
                              background: '#f8f8f8',
                              borderRadius: 6
                            }}>
                              {userPhotos.map((photoUrl, index) => (
                                <div
                                  key={index}
                                  onClick={() => handlePhotoSelect(photoUrl)}
                                  style={{
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: selectedPhotos.includes(photoUrl) ? '3px solid #3498db' : '2px solid #ddd',
                                    borderRadius: 6,
                                    overflow: 'hidden'
                                  }}
                                >
                                  <img
                                    src={photoUrl}
                                    alt={`Фото ${index + 1}`}
                                    style={{
                                      width: '100%',
                                      height: 80,
                                      objectFit: 'cover',
                                      display: 'block'
                                    }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='10'%3ENo img%3C/text%3E%3C/svg%3E";
                                    }}
                                  />
                                  {selectedPhotos.includes(photoUrl) && (
                                    <div style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      background: '#3498db',
                                      color: '#fff',
                                      borderRadius: '50%',
                                      width: 20,
                                      height: 20,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10,
                                      fontWeight: 'bold'
                                    }}>
                                      ✓
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {selectedPhotos.length > 0 && (
                            <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>
                              Выбрано фото: {selectedPhotos.length}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Режим ввода ссылки */}
                      {photoMode === 'link' && (
                        <div>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                            <Input
                              type="text"
                              placeholder="Вставьте ссылку на фото"
                              value={photoLink}
                              onChange={(e) => setPhotoLink(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handlePhotoLinkAdd();
                                }
                              }}
                              style={{ fontSize: 10 }}
                            />
                            <Button
                              type="button"
                              onClick={handlePhotoLinkAdd}
                              style={{ fontSize: 10, padding: '4px 6px' }}
                            >
                              Добавить
                            </Button>
                          </div>
                          {selectedPhotos.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {selectedPhotos.map((url, index) => (
                                <div key={index} style={{ position: 'relative' }}>
                                  <img
                                    src={url}
                                    alt={`Фото ${index + 1}`}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      objectFit: 'cover',
                                      borderRadius: 3,
                                      border: '1px solid #3498db'
                                    }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto(index, 'selected')}
                                    style={{
                                      position: 'absolute',
                                      top: -6,
                                      right: -6,
                                      background: '#ff4444',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: 16,
                                      height: 16,
                                      cursor: 'pointer',
                                      fontSize: 10
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <HelpText>{field.helpText}</HelpText>
                    </div>
                  ) : (
                    <>
                  {field.type === 'input' && (
                    <Input
                      type="text"
                      value={form[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      $hasError={!!titleError && field.key === 'title'}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <Textarea
                      value={form[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.type === 'select' && (
                    <Select
                      value={form[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      $hasError={!!categoryError && field.key === 'category'}
                    >
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  )}
                  
                  {/* Ошибки валидации */}
                  {field.key === 'title' && titleError && (
                    <ErrorMessage>
                      <FaExclamationTriangle /> {titleError}
                    </ErrorMessage>
                  )}
                  {field.key === 'category' && categoryError && (
                    <ErrorMessage>
                      <FaExclamationTriangle /> {categoryError}
                    </ErrorMessage>
                  )}
                  
                  {/* Подсказки для каждого поля */}
                      {field.helpText && <HelpText>{field.helpText}</HelpText>}
                    </>
                  )}
                    </>
                  )}
                </SectionContent>
              </GlassAccordion>
            </React.Fragment>
          ))}
        </div>
          
        <div style={{ padding: '2px 8px', borderTop: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', gap: '3px', flexShrink: 0 }}>
          <GlassButton
            type="button"
            onClick={onCancel || (() => {})}
            variant="secondary"
            fullWidth
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, lineHeight: '1.3' }}
          >
            Отмена
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            fullWidth
            style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, lineHeight: '1.3' }}
          >
            Добавить
          </GlassButton>
        </div>
      </form>
    </GlassPanel>
  );
};
