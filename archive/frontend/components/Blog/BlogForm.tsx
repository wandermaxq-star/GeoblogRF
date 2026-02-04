import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { 
  FileText, 
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  MapPin,
  Link,
  Save,
  X,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { Blog } from '../../types/blog';

interface BlogFormProps {
  blog?: Blog;
  onSave?: (blog: Blog) => void;
  onCancel?: () => void;
  selectedCategory?: string;
  selectedGeoTypes?: string[];
  selectedTools?: string[];
}

const FormWrapper = styled.div`
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

const FormHeader = styled.div`
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

const Toolbar = styled.div`
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ToolbarButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ active }) => (active ? '#007bff' : '#dee2e6')};
  border-radius: 4px;
  background: ${({ active }) => (active ? '#007bff' : '#fff')};
  color: ${({ active }) => (active ? '#fff' : '#495057')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${({ active }) => (active ? '#0056b3' : '#e9ecef')};
    border-color: ${({ active }) => (active ? '#0056b3' : '#adb5bd')};
  }
`;

const FormContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #495057;
  font-size: 0.9em;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const Textarea = styled.textarea`
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1em;
  min-height: 120px;
  resize: vertical;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const Select = styled.select`
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1em;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9em;
  color: #495057;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #007bff;
  }
`;

const FormFooter = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'success' | 'danger' }>`
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
      case 'danger':
        return `
          background: #dc3545;
          color: white;
          &:hover {
            background: #c82333;
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

const StatusBadge = styled.span<{ status: 'draft' | 'published' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
  background: ${({ status }) => status === 'published' ? '#d4edda' : '#fff3cd'};
  color: ${({ status }) => status === 'published' ? '#155724' : '#856404'};
`;

const BlogForm: React.FC<BlogFormProps> = ({
  blog,
  onSave,
  onCancel,
  selectedCategory,
  selectedGeoTypes = [],
  selectedTools = []
}) => {
  const [formData, setFormData] = useState({
    title: blog?.title || '',
    preview: blog?.preview || '',
    content: blog?.content || '',
    category: selectedCategory || blog?.category || '',
    geoTypes: selectedGeoTypes,
    tools: selectedTools,
    status: blog?.status || 'draft'
  });

  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false
  });

  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormattingToggle = (format: string) => {
    setFormatting(prev => ({ ...prev, [format]: !prev[format as keyof typeof prev] }));
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Здесь будет логика обработки файлов
    }
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Пожалуйста, введите заголовок блога');
      return;
    }

    const updatedBlog: Blog = {
      ...blog!,
      title: formData.title,
      preview: formData.preview,
      content: formData.content,
      category: formData.category,
      geoType: formData.geoTypes.length > 0 ? formData.geoTypes[0] as 'point' | 'route' | 'event' : 'point',
      status: formData.status,
      updated_at: new Date().toISOString()
    };

    onSave?.(updatedBlog);
  };

  const handlePublish = () => {
    setFormData(prev => ({ ...prev, status: 'published' }));
    handleSave();
  };

  const categories = [
    { id: 'travel', name: 'Путешествия' },
    { id: 'food', name: 'Еда' },
    { id: 'culture', name: 'Культура' },
    { id: 'nature', name: 'Природа' },
    { id: 'adventure', name: 'Приключения' },
    { id: 'city', name: 'Город' },
    { id: 'history', name: 'История' },
    { id: 'other', name: 'Другое' }
  ];

  const geoTypes = [
    { id: 'point', name: 'Место' },
    { id: 'route', name: 'Маршрут' },
    { id: 'event', name: 'Событие' }
  ];

  const tools = [
    { id: 'photo', name: 'Фото' },
    { id: 'markers', name: 'Метки' },
    { id: 'links', name: 'Ссылки' },
    { id: 'files', name: 'Файлы' }
  ];

  return (
    <FormWrapper>
      <FormHeader>
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Создание блога
          <StatusBadge status={formData.status as 'draft' | 'published'} className="ml-3">
            {formData.status === 'published' ? 'Опубликован' : 'Черновик'}
          </StatusBadge>
      </div>
        {onCancel && (
          <X 
            className="w-5 h-5 cursor-pointer hover:text-red-600 transition-colors"
            onClick={onCancel}
          />
        )}
      </FormHeader>

      <Toolbar>
        <ToolbarButton 
          active={formatting.bold}
          onClick={() => handleFormattingToggle('bold')}
          title="Жирный"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton 
          active={formatting.italic}
          onClick={() => handleFormattingToggle('italic')}
          title="Курсив"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton 
          active={formatting.underline}
          onClick={() => handleFormattingToggle('underline')}
          title="Подчеркнуть"
        >
          <Underline className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-gray-300 mx-2"></div>
        
        <ToolbarButton 
          active={formatting.list}
          onClick={() => handleFormattingToggle('list')}
          title="Список"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-gray-300 mx-2"></div>
        
        <ToolbarButton 
          active={formatting.alignLeft}
          onClick={() => handleFormattingToggle('alignLeft')}
          title="По левому краю"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton 
          active={formatting.alignCenter}
          onClick={() => handleFormattingToggle('alignCenter')}
          title="По центру"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton 
          active={formatting.alignRight}
          onClick={() => handleFormattingToggle('alignRight')}
          title="По правому краю"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        
        <div className="w-px h-6 bg-gray-300 mx-2"></div>
        
        <ToolbarButton title="Добавить фото" onClick={handleFileUpload}>
          <Image className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Добавить метку">
          <MapPin className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Добавить ссылку">
          <Link className="w-4 h-4" />
        </ToolbarButton>
      </Toolbar>

      <FormContent>
        <InputGroup>
          <Label>Заголовок блога *</Label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Введите заголовок блога..."
          />
        </InputGroup>

        <InputGroup>
          <Label>Категория</Label>
          <Select
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
          >
            <option value="">Выберите категорию</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </InputGroup>

        <InputGroup>
          <Label>Типы географии</Label>
          <CheckboxGroup>
            {geoTypes.map(geoType => (
              <CheckboxLabel key={geoType.id}>
                <input
                  type="checkbox"
                  checked={formData.geoTypes.includes(geoType.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange('geoTypes', [...formData.geoTypes, geoType.id]);
                    } else {
                      handleInputChange('geoTypes', formData.geoTypes.filter(id => id !== geoType.id));
                    }
                  }}
                />
                {geoType.name}
              </CheckboxLabel>
            ))}
          </CheckboxGroup>
        </InputGroup>

        <InputGroup>
          <Label>Инструменты</Label>
          <CheckboxGroup>
            {tools.map(tool => (
              <CheckboxLabel key={tool.id}>
                <input
                  type="checkbox"
                  checked={formData.tools.includes(tool.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange('tools', [...formData.tools, tool.id]);
                    } else {
                      handleInputChange('tools', formData.tools.filter(id => id !== tool.id));
                    }
                  }}
                />
                {tool.name}
              </CheckboxLabel>
            ))}
          </CheckboxGroup>
        </InputGroup>

        <InputGroup>
          <Label>Краткое описание</Label>
          <Textarea
            value={formData.preview}
            onChange={(e) => handleInputChange('preview', e.target.value)}
            placeholder="Краткое описание блога..."
            style={{ minHeight: '80px' }}
          />
        </InputGroup>

        <InputGroup>
          <Label>Основной текст *</Label>
          <Textarea
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            placeholder="Начните писать ваш блог..."
            style={{ minHeight: '200px' }}
          />
        </InputGroup>
      </FormContent>

      {/* Скрытый input для загрузки файлов */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <FormFooter>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {formData.content.length} символов
          </div>
          <button
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Скрыть' : 'Предпросмотр'}
          </button>
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <ActionButton variant="secondary" onClick={onCancel}>
              Отмена
            </ActionButton>
          )}
          <ActionButton variant="success" onClick={handleSave}>
            <Save className="w-4 h-4" />
            Сохранить
          </ActionButton>
          <ActionButton variant="primary" onClick={handlePublish}>
            <Plus className="w-4 h-4" />
            Опубликовать
          </ActionButton>
    </div>
      </FormFooter>
    </FormWrapper>
  );
};

export default BlogForm;