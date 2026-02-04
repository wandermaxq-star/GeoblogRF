import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  Type, 
  Image, 
  Link, 
  Plus, 
  Eye,
  X,
  Palette,
  MapPin,
  Navigation,
  Settings
} from 'lucide-react';
import { BlogConstructor as BlogConstructorType, BlogParagraph, BlogSegment } from '../../types/blog';
import TextFormattingToolbar from './TextFormattingToolbar';
import StatusIndicator from './StatusIndicator';
import BlogCoverEditor from './BlogCoverEditor';
import SegmentEditor from './SegmentEditor';

interface BlogCoverData {
  title: string;
  description: string;
  gradient: string;
  textColor: string;
  titleFont: string;
  descriptionFont: string;
}

interface BlogConstructorProps {
  onAddParagraph: () => void;
  onAddPhoto: () => void;
  onAddPhotoGroup: () => void;
  onAddLink: () => void;
  onAddContent: () => void;
  onPreview: () => void;
  onClose: () => void;
  constructor: BlogConstructorType;
  paragraphs: BlogParagraph[];
  onUpdateConstructor?: (updates: Partial<BlogConstructorType>) => void;
  onPublish?: () => void;
  onCoverSave?: (coverData: BlogCoverData) => void;
}

const ConstructorWrapper = styled.div`
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

const ConstructorHeader = styled.div`
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

const FormattingPanel = styled.div`
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 12px 20px;
`;

const ConstructorContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  background: #fafafa;
`;

const ConstructorButton = styled.button`
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

  &:hover {
    border-color: #007bff;
    color: #007bff;
    background: #f0f8ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  }

  &.primary {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
    border-color: #007bff;

    &:hover {
      background: linear-gradient(135deg, #0056b3, #004085);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
    }
  }

  &.preview {
    background: linear-gradient(135deg, #28a745, #1e7e34);
    color: white;
    border-color: #28a745;

    &:hover {
      background: linear-gradient(135deg, #1e7e34, #155724);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3);
    }
  }
`;

const ParagraphsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
`;

const ParagraphItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.9em;
`;

const ParagraphInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const ParagraphActions = styled.div`
  display: flex;
  gap: 4px;
`;

const ActionButton = styled.button`
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

  &.danger:hover {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }
`;

const ConstructorFooter = styled.div`
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

const BlogConstructor: React.FC<BlogConstructorProps> = ({
  onAddParagraph,
  onAddPhoto,
  onAddPhotoGroup,
  onAddLink,
  onAddContent,
  onPreview,
  onClose,
  constructor,
  paragraphs,
  onUpdateConstructor,
  onPublish,
  onCoverSave
}) => {
  const [title, setTitle] = useState(constructor.title || '');
  const [preview, setPreview] = useState(constructor.preview || '');
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [showSegmentEditor, setShowSegmentEditor] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<BlogSegment | null>(null);
  const [coverData, setCoverData] = useState<BlogCoverData>({
    title: constructor.title || '',
    description: constructor.preview || '',
    gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
    textColor: '#FFFFFF',
    titleFont: 'bold',
    descriptionFont: 'normal'
  });

  const getStateIcon = (type: string | null) => {
    switch (type) {
      case 'marker':
        return '📍';
      case 'route':
        return '🛣️';
      case 'event':
        return '📅';
      default:
        return '📝';
    }
  };

  const getStateLabel = (type: string | null) => {
    switch (type) {
      case 'marker':
        return 'Метка';
      case 'route':
        return 'Маршрут';
      case 'event':
        return 'Событие';
      default:
        return 'Текст';
    }
  };

  const handleCoverSave = (newCoverData: BlogCoverData) => {
    setCoverData(newCoverData);
    onCoverSave?.(newCoverData);
    setShowCoverEditor(false);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setCoverData(prev => ({ ...prev, title: value }));
    onUpdateConstructor?.({ title: value });
  };

  const handlePreviewChange = (value: string) => {
    setPreview(value);
    setCoverData(prev => ({ ...prev, description: value }));
    onUpdateConstructor?.({ preview: value });
  };

  // Функции для работы с сегментами
  const handleAddSegment = () => {
    const newSegment: BlogSegment = {
      id: `segment-${Date.now()}`,
      paragraphId: paragraphs.length > 0 ? paragraphs[0].id : '',
      coordinates: [[56.1286, 40.4064], [56.1290, 40.4070]],
      highlight: '#3b82f6',
      title: `Отрезок ${(constructor.segments?.length || 0) + 1}`,
      description: ''
    };
    
    const updatedSegments = [...(constructor.segments || []), newSegment];
    onUpdateConstructor?.({ segments: updatedSegments });
  };

  const handleEditSegment = (segment: BlogSegment) => {
    setSelectedSegment(segment);
    setShowSegmentEditor(true);
  };

  const handleDeleteSegment = (segmentId: string) => {
    const updatedSegments = (constructor.segments || []).filter(seg => seg.id !== segmentId);
    onUpdateConstructor?.({ segments: updatedSegments });
  };

  const handleSegmentSave = (updatedSegment: BlogSegment) => {
    const updatedSegments = (constructor.segments || []).map(seg => 
      seg.id === updatedSegment.id ? updatedSegment : seg
    );
    onUpdateConstructor?.({ segments: updatedSegments });
    setShowSegmentEditor(false);
    setSelectedSegment(null);
  };

  return (
    <ConstructorWrapper>
      <ConstructorHeader>
        <div className="flex items-center">
          <Type className="w-5 h-5 mr-2" />
          Конструктор блогов
        </div>
        <X 
          className="w-5 h-5 cursor-pointer hover:text-red-600 transition-colors"
          onClick={onClose}
        />
      </ConstructorHeader>

      <FormattingPanel>
        <TextFormattingToolbar
          onFormat={(format, value) => {
            // Глобальное форматирование будет применено к активному абзацу
            }}
          onInsert={(type, data) => {
            // Вставка элементов
            }}
          isActive={() => false}
        />
      </FormattingPanel>

      <ConstructorContent>
        {/* Заголовок блога */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Заголовок блога *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Введите заголовок блога..."
          />
        </div>

        {/* Краткое описание */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Краткое описание
          </label>
          <textarea
            value={preview}
            onChange={(e) => handlePreviewChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Краткое описание блога..."
            rows={3}
          />
        </div>

        {/* Настройка обложки */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Настройка обложки
          </label>
          <ConstructorButton onClick={() => setShowCoverEditor(true)}>
            <Palette className="w-5 h-5" />
            Выбрать цвет и стиль обложки
          </ConstructorButton>
        </div>

        {/* Кнопки инструментов */}
        <div className="space-y-3">
          <ConstructorButton onClick={onAddPhoto}>
            <Image className="w-5 h-5" />
            Добавить фото
          </ConstructorButton>

          <ConstructorButton onClick={onAddPhotoGroup}>
            <Image className="w-5 h-5" />
            Группа фото
          </ConstructorButton>

          <ConstructorButton onClick={onAddLink}>
            <Link className="w-5 h-5" />
            Добавить ссылку
          </ConstructorButton>

          <ConstructorButton onClick={handleAddSegment}>
            <Navigation className="w-5 h-5" />
            Создать отрезок маршрута
          </ConstructorButton>

          <ConstructorButton className="primary" onClick={onAddParagraph}>
            <Plus className="w-5 h-5" />
            Добавить абзац
          </ConstructorButton>

          <ConstructorButton className="preview" onClick={onPreview}>
            <Eye className="w-5 h-5" />
            Предпросмотр
          </ConstructorButton>
        </div>

        {/* Список абзацев */}
        {paragraphs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Абзацы ({paragraphs.length})
            </h3>
            <ParagraphsList>
              {paragraphs.map((paragraph) => (
                <ParagraphItem key={paragraph.id}>
                  <div className="flex items-center gap-3">
                    <StatusIndicator
                      stateType={paragraph.state.type}
                      hasAttachedElement={!!(paragraph.state?.data && paragraph.state.data.id)}
                      elementName={paragraph.state?.data?.title || paragraph.state?.data?.name}
                      className="w-12 h-12"
                    />
                    <ParagraphInfo>
                      <span className="text-lg">
                        {getStateIcon(paragraph.state.type)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {getStateLabel(paragraph.state.type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {paragraph.text.substring(0, 30)}...
                      </span>
                    </ParagraphInfo>
                  </div>
                  <ParagraphActions>
                    <ActionButton title="Переместить вверх">
                      ↑
                    </ActionButton>
                    <ActionButton title="Переместить вниз">
                      ↓
                    </ActionButton>
                    <ActionButton className="danger" title="Удалить">
                      <X className="w-3 h-3" />
                    </ActionButton>
                  </ParagraphActions>
                </ParagraphItem>
              ))}
            </ParagraphsList>
          </div>
        )}

        {/* Список сегментов маршрута */}
        {constructor.segments && constructor.segments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Отрезки маршрута ({constructor.segments.length})
            </h3>
            <div className="space-y-2">
              {constructor.segments.map((segment) => (
                <div key={segment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: segment.highlight }}
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-800">
                        {segment.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {segment.coordinates.length} точек
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSegment(segment)}
                      className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                      title="Редактировать"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSegment(segment.id)}
                      className="p-1 text-red-600 hover:text-red-800 transition-colors"
                      title="Удалить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ConstructorContent>

      <ConstructorFooter>
        <div className="text-sm text-gray-600">
          {paragraphs.length} абзацев
        </div>
        <div className="flex gap-3">
          <FooterButton onClick={onClose}>
            Отмена
          </FooterButton>
          {onPublish && (
            <FooterButton variant="primary" onClick={onPublish}>
              Опубликовать
            </FooterButton>
          )}
        </div>
      </ConstructorFooter>

      {/* Редактор обложки */}
      <BlogCoverEditor
        isOpen={showCoverEditor}
        onClose={() => setShowCoverEditor(false)}
        onSave={handleCoverSave}
        initialData={coverData}
      />

      {/* Редактор сегментов */}
      <SegmentEditor
        isOpen={showSegmentEditor}
        onClose={() => {
          setShowSegmentEditor(false);
          setSelectedSegment(null);
        }}
        onSave={handleSegmentSave}
        segment={selectedSegment}
        availableParagraphs={paragraphs.map(p => ({ id: p.id, text: p.text }))}
      />
    </ConstructorWrapper>
  );
};

export default BlogConstructor;
