import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  FileText, 
  MapPin,
  Compass,
  Calendar,
  Plane,
  Utensils,
  Building2,
  TreePine,
  Mountain,
  Building,
  BookOpen,
  Plus,
  Router,
  Camera,
  Upload,
  Link,
  Map,
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  AlignCenter,
  Save,
  Edit
} from 'lucide-react';
import { Blog } from '../../types/blog';

interface BlogConstructorAccordionProps {
  onCreateBlog?: (blog: Blog) => void;
  onClose?: () => void;
  routeDataForBlog?: any;
  markerDataForBlog?: any;
}

// Компактные стили как в MapFilters
const Wrapper = styled.div`
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
  border: 2px solid #7c7b7b91;
  max-width: 340px;
  min-width: 220px;
  width: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  font-size: 15px;
  overflow: hidden;
`;

const Header = styled.div`
  background: #dadada;
  color: #222;
  font-size: 1.1em;
  font-weight: bold;
  padding: 16px 0;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  text-align: center;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }
`;

const AccordionSection = styled.div`
  padding: 0 28px 18px 28px;
  border-bottom: 1.5px solid #e3e3e3;

  &:last-child {
    border-bottom: none;
  }
`;

const AccordionTitle = styled.div<{ isOpen: boolean }>`
  font-size: 16px;
  font-weight: 600;
  color: #222;
  cursor: pointer;
  padding: 10px 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: color 0.2s, background 0.2s;

  ${({ isOpen }) => isOpen && `
    color: #222;
    background: #f4f4f4;
  `}

  &:hover {
    color: #222;
    background: #f4f4f4;
  }
`;

const AccordionContent = styled.div<{ isOpen: boolean }>`
  padding: 8px 0 0 32px;
  max-height: ${({ isOpen }) => isOpen ? '200px' : '0'};
  overflow-y: auto;
  transition: max-height 0.3s ease;
  
  /* Стили для скроллбара */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;

const CategoryButton = styled.button<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: 2px solid ${({ selected }) => (selected ? '#007bff' : '#e0e0e0')};
  border-radius: 8px;
  background: ${({ selected }) => (selected ? '#f0f8ff' : '#fff')};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9em;
  font-weight: 500;
  margin-bottom: 6px;

  &:hover {
    border-color: #007bff;
    background: #f0f8ff;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const MultiSelectButton = styled.button<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: 2px solid ${({ selected }) => (selected ? '#28a745' : '#e0e0e0')};
  border-radius: 8px;
  background: ${({ selected }) => (selected ? '#f0fff4' : '#fff')};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9em;
  font-weight: 500;
  margin-bottom: 6px;

  &:hover {
    border-color: #28a745;
    background: #f0fff4;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'success' }>`
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
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
      case 'success':
        return `
          background: #28a745;
          color: white;
          &:hover {
            background: #218838;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
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

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SelectedCount = styled.span`
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  font-weight: bold;
  margin-left: auto;
`;

const BlogConstructorAccordion: React.FC<BlogConstructorAccordionProps> = ({
  onCreateBlog,
  onClose,
  routeDataForBlog,
  markerDataForBlog
}) => {
  const [openSections, setOpenSections] = useState({
    category: true,
    geography: false,
    tools: false,
    formatting: false,
    linked: false
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGeoTypes, setSelectedGeoTypes] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const categories = [
    { id: 'travel', name: 'Путешествия', icon: Plane },
    { id: 'food', name: 'Еда', icon: Utensils },
    { id: 'culture', name: 'Культура', icon: Building2 },
    { id: 'nature', name: 'Природа', icon: TreePine },
    { id: 'adventure', name: 'Приключения', icon: Mountain },
    { id: 'city', name: 'Город', icon: Building },
    { id: 'history', name: 'История', icon: BookOpen },
    { id: 'other', name: 'Другое', icon: FileText }
  ];

  const geoTypes = [
    { id: 'point', name: 'Место', icon: MapPin },
    { id: 'route', name: 'Маршрут', icon: Compass },
    { id: 'event', name: 'Событие', icon: Calendar }
  ];

  const tools = [
    { id: 'photo', name: 'Фото', icon: Camera },
    { id: 'markers', name: 'Метки', icon: MapPin },
    { id: 'links', name: 'Ссылки', icon: Link },
    { id: 'files', name: 'Файлы', icon: Upload }
  ];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  // Автоматически закрываем секцию после выбора
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Закрываем секцию категории после выбора
    setTimeout(() => {
      setOpenSections(prev => ({ ...prev, category: false }));
    }, 300);
  };

  const handleGeoTypeToggle = (geoTypeId: string) => {
    setSelectedGeoTypes(prev => {
      if (prev.includes(geoTypeId)) {
        return prev.filter(id => id !== geoTypeId);
      } else {
        return [...prev, geoTypeId];
      }
    });
  };

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => {
      if (prev.includes(toolId)) {
        return prev.filter(id => id !== toolId);
      } else {
        return [...prev, toolId];
      }
    });
  };

  const handleStartBlog = () => {
    if (!selectedCategory) {
      alert('Пожалуйста, выберите категорию блога');
      return;
    }

    const blogData: Blog = {
      id: `blog_${Date.now()}`,
      title: '',
      preview: '',
      content: '',
      category: selectedCategory,
      geoType: selectedGeoTypes.length > 0 ? selectedGeoTypes[0] as 'point' | 'route' | 'event' : 'point',
      favoriteRouteId: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: 'Пользователь',
      views_count: 0,
      likes_count: 0,
      comments_count: 0,
      reading_time: 0,
      related_markers: markerDataForBlog ? [markerDataForBlog] : [],
      related_route_id: routeDataForBlog ? routeDataForBlog.id : undefined
    };

    onCreateBlog?.(blogData);
  };

  const handleSaveDraft = () => {
    // Сохранение черновика
    };

  const handleEditBlog = () => {
    // Редактирование существующего блога
    };

  return (
    <Wrapper>
      <Header>
        <FileText className="w-5 h-5 mr-2" />
        Конструктор блогов
        {onClose && (
          <CloseButton onClick={onClose}>
            ×
          </CloseButton>
        )}
      </Header>

      {/* Категория блога */}
      <AccordionSection>
        <AccordionTitle 
          isOpen={openSections.category}
          onClick={() => toggleSection('category')}
        >
          <div className="flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Категория блога
          </div>
          <div className="text-xs text-gray-500">
            {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Не выбрано'}
          </div>
        </AccordionTitle>
        <AccordionContent isOpen={openSections.category}>
          {categories.map(category => {
            const IconComponent = category.icon;
            return (
              <CategoryButton
                key={category.id}
                selected={selectedCategory === category.id}
                onClick={() => handleCategorySelect(category.id)}
              >
                <IconComponent className="w-4 h-4 mr-3" />
                {category.name}
              </CategoryButton>
            );
          })}
        </AccordionContent>
      </AccordionSection>

      {/* Тип географии - множественный выбор */}
      <AccordionSection>
        <AccordionTitle 
          isOpen={openSections.geography}
          onClick={() => toggleSection('geography')}
        >
          <div className="flex items-center">
            <Map className="w-4 h-4 mr-2" />
            Тип географии
          </div>
          <div className="flex items-center">
            {selectedGeoTypes.length > 0 && (
              <SelectedCount>{selectedGeoTypes.length}</SelectedCount>
            )}
            <div className="text-xs text-gray-500 ml-2">
              {selectedGeoTypes.length === 0 && 'Не выбрано'}
              {selectedGeoTypes.length === 1 && geoTypes.find(g => g.id === selectedGeoTypes[0])?.name}
              {selectedGeoTypes.length > 1 && `${selectedGeoTypes.length} выбрано`}
            </div>
          </div>
        </AccordionTitle>
        <AccordionContent isOpen={openSections.geography}>
          {geoTypes.map(geoType => {
            const IconComponent = geoType.icon;
            return (
              <MultiSelectButton
                key={geoType.id}
                selected={selectedGeoTypes.includes(geoType.id)}
                onClick={() => handleGeoTypeToggle(geoType.id)}
              >
                <IconComponent className="w-4 h-4 mr-3" />
                {geoType.name}
              </MultiSelectButton>
            );
          })}
        </AccordionContent>
      </AccordionSection>

      {/* Инструменты - множественный выбор */}
      <AccordionSection>
        <AccordionTitle 
          isOpen={openSections.tools}
          onClick={() => toggleSection('tools')}
        >
          <div className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Инструменты
          </div>
          <div className="flex items-center">
            {selectedTools.length > 0 && (
              <SelectedCount>{selectedTools.length}</SelectedCount>
            )}
            <div className="text-xs text-gray-500 ml-2">
              {selectedTools.length === 0 && 'Не выбрано'}
              {selectedTools.length === 1 && tools.find(t => t.id === selectedTools[0])?.name}
              {selectedTools.length > 1 && `${selectedTools.length} выбрано`}
            </div>
          </div>
        </AccordionTitle>
        <AccordionContent isOpen={openSections.tools}>
          <div className="text-xs text-gray-600 mb-3">
            В редакторе блога вы сможете добавлять фото, метки на карте и ссылки в любом месте текста.
          </div>
          
          {tools.map(tool => {
            const IconComponent = tool.icon;
            return (
              <MultiSelectButton
                key={tool.id}
                selected={selectedTools.includes(tool.id)}
                onClick={() => handleToolToggle(tool.id)}
              >
                <IconComponent className="w-4 h-4 mr-3" />
                {tool.name}
              </MultiSelectButton>
            );
          })}
        </AccordionContent>
      </AccordionSection>

      {/* Форматирование */}
      <AccordionSection>
        <AccordionTitle 
          isOpen={openSections.formatting}
          onClick={() => toggleSection('formatting')}
        >
          <div className="flex items-center">
            <Bold className="w-4 h-4 mr-2" />
            Форматирование
          </div>
          <div className="text-xs text-gray-500">
            Курсив, выделение, выравнивание
          </div>
        </AccordionTitle>
        <AccordionContent isOpen={openSections.formatting}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <Bold className="mx-auto mb-1 w-4 h-4" />
              Жирный
            </button>
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <Italic className="mx-auto mb-1 w-4 h-4" />
              Курсив
            </button>
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <Underline className="mx-auto mb-1 w-4 h-4" />
              Подчеркнуть
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <List className="mx-auto mb-1 w-4 h-4" />
              Список
            </button>
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <AlignLeft className="mx-auto mb-1 w-4 h-4" />
              По левому
            </button>
            <button className="p-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors text-xs">
              <AlignCenter className="mx-auto mb-1 w-4 h-4" />
              По центру
            </button>
          </div>
        </AccordionContent>
      </AccordionSection>

      {/* Связанные данные */}
      {(routeDataForBlog || markerDataForBlog) && (
        <AccordionSection>
          <AccordionTitle 
            isOpen={openSections.linked}
            onClick={() => toggleSection('linked')}
          >
            <div className="flex items-center">
              <Router className="w-4 h-4 mr-2" />
              Связанные данные
            </div>
            <div className="text-xs text-gray-500">
              {routeDataForBlog ? 'Маршрут' : ''}
              {markerDataForBlog ? 'Место' : ''}
            </div>
          </AccordionTitle>
          <AccordionContent isOpen={openSections.linked}>
            <div className="text-xs text-gray-600">
              {routeDataForBlog && (
                <div className="flex items-center gap-2 mb-2">
                  <Router className="text-blue-500 w-4 h-4" />
                  <span>Маршрут: {routeDataForBlog.title || 'Без названия'}</span>
                </div>
              )}
              {markerDataForBlog && (
                <div className="flex items-center gap-2">
                  <MapPin className="text-green-500 w-4 h-4" />
                  <span>Место: {markerDataForBlog.title || 'Без названия'}</span>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionSection>
      )}

      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <ActionButton 
          variant="primary"
          onClick={handleStartBlog}
          disabled={!selectedCategory}
        >
          <Plus className="w-4 h-4" />
          Начать создание блога
        </ActionButton>
        
        <ActionButton 
          variant="success"
          onClick={handleSaveDraft}
        >
          <Save className="w-4 h-4" />
          Сохранить черновик
        </ActionButton>
        
        <ActionButton 
          variant="secondary"
          onClick={handleEditBlog}
        >
          <Edit className="w-4 h-4" />
          Редактировать блог
        </ActionButton>
      </div>
    </Wrapper>
  );
};

export default BlogConstructorAccordion;
