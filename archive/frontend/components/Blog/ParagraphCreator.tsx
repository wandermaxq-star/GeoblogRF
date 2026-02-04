import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  MapPin, 
  Calendar,
  Type,
  Link,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Upload,
  Download
} from 'lucide-react';
import { BlogParagraph, StateType } from '../../types/blog';
import RichTextEditor from './RichTextEditor';
import DragDropZone from './DragDropZone';
import StatusIndicator from './StatusIndicator';

interface ParagraphCreatorProps {
  onSave: (paragraph: BlogParagraph) => void;
  onCancel: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  initialParagraph?: BlogParagraph;
  order: number;
  onStateTypeSelect?: (type: StateType) => void;
  onPublish?: () => void;
  onSaveDraft?: () => void;
  onLoadDraft?: () => void;
}

const CreatorWrapper = styled.div`
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px 0 rgba(0,0,0,0.08);
  border: 2px solid #e9ecef;
  width: 100%;
  margin-bottom: 20px;
  overflow: hidden;
`;

const CreatorHeader = styled.div`
  background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CreatorContent = styled.div`
  display: flex;
  min-height: 400px;
`;

const StatusIndicatorWrapper = styled.div`
  display: flex;
  align-items: stretch;
  min-height: 400px;
`;

const LeftPanel = styled.div`
  width: 300px;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const RightPanel = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StateButton = styled.button<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  border: 2px solid ${({ selected }) => (selected ? '#007bff' : '#e9ecef')};
  border-radius: 12px;
  background: ${({ selected }) => (selected ? '#f0f8ff' : '#fff')};
  color: ${({ selected }) => (selected ? '#007bff' : '#495057')};
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
`;

const StateIcon = styled.div<{ type: StateType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${({ type }) => {
    switch (type) {
      case 'marker':
        return 'linear-gradient(135deg, #28a745, #20c997)';
      case 'route':
        return 'linear-gradient(135deg, #007bff, #6610f2)';
      case 'event':
        return 'linear-gradient(135deg, #fd7e14, #e83e8c)';
      default:
        return 'linear-gradient(135deg, #6c757d, #495057)';
    }
  }};
  color: white;
`;



const PhotoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;



const PhotoPreview = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const PhotoItem = styled.div`
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e9ecef;
`;

const PhotoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PhotoRemove = styled.button`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

const LinkSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LinkInput = styled.input`
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.9em;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const LinkList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LinkItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.9em;
`;

const CreatorFooter = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const FooterButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 10px 16px;
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

const ParagraphCreator: React.FC<ParagraphCreatorProps> = ({
  onSave,
  onCancel,
  onMoveUp,
  onMoveDown,
  onDelete,
  initialParagraph,
  order,
  onStateTypeSelect,
  onPublish,
  onSaveDraft,
  onLoadDraft
}) => {
  const [selectedState, setSelectedState] = useState<StateType>(
    initialParagraph?.state.type || null
  );
  const [text, setText] = useState(initialParagraph?.text || '');
  const [photos, setPhotos] = useState<string[]>(initialParagraph?.photos || []);
  const [links, setLinks] = useState<string[]>(initialParagraph?.links || []);

  const [newLink, setNewLink] = useState('');

  const handleSave = () => {
    if (!text.trim()) {
      alert('Пожалуйста, введите текст абзаца');
      return;
    }

    const paragraph: BlogParagraph = {
      id: initialParagraph?.id || Date.now().toString(),
      text,
      state: {
        type: selectedState,
        data: null // Будет заполнено при выборе конкретного контента
      },
      photos,
      links,
      order
    };

    onSave(paragraph);
  };



  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (newLink.trim()) {
      setLinks(prev => [...prev, newLink.trim()]);
      setNewLink('');
    }
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <CreatorWrapper>
      <CreatorHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            Абзац {order}
          </span>
          {selectedState && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {selectedState === 'marker' && 'Метка'}
              {selectedState === 'route' && 'Маршрут'}
              {selectedState === 'event' && 'Событие'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onPublish && (
            <button
              onClick={onPublish}
              className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600 transition-colors"
              title="Опубликовать блог"
            >
              Опубликовать
            </button>
          )}
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Переместить вверх"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Переместить вниз"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-red-500 hover:text-red-700"
              title="Удалить абзац"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CreatorHeader>

      <StatusIndicatorWrapper>
        <StatusIndicator
          stateType={selectedState}
          hasAttachedElement={!!(selectedState && initialParagraph?.state?.data && (initialParagraph.state.data as any).id)}
          elementName={(initialParagraph?.state as any)?.data?.title || (initialParagraph?.state as any)?.data?.name}
        />
        <CreatorContent>
          <LeftPanel>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Выберите тип состояния
          </h3>
          
          <StateButton
            selected={selectedState === 'marker'}
            onClick={() => {
              setSelectedState('marker');
              onStateTypeSelect?.('marker');
            }}
          >
            <StateIcon type="marker">
              <MapPin className="w-5 h-5" />
            </StateIcon>
            <div>
              <div className="font-medium">Метка</div>
              <div className="text-xs text-gray-500">Место на карте</div>
            </div>
          </StateButton>

          <StateButton
            selected={selectedState === 'route'}
            onClick={() => {
              setSelectedState('route');
              onStateTypeSelect?.('route');
            }}
          >
            <StateIcon type="route">
              <MapPin className="w-5 h-5" />
            </StateIcon>
            <div>
              <div className="font-medium">Маршрут</div>
              <div className="text-xs text-gray-500">Путь между точками</div>
            </div>
          </StateButton>

          <StateButton
            selected={selectedState === 'event'}
            onClick={() => {
              setSelectedState('event');
              onStateTypeSelect?.('event');
            }}
          >
            <StateIcon type="event">
              <Calendar className="w-5 h-5" />
            </StateIcon>
            <div>
              <div className="font-medium">Событие</div>
              <div className="text-xs text-gray-500">Временное событие</div>
            </div>
          </StateButton>

          <StateButton
            selected={selectedState === null}
            onClick={() => {
              setSelectedState(null);
              onStateTypeSelect?.(null);
            }}
          >
            <StateIcon type={null}>
              <Type className="w-5 h-5" />
            </StateIcon>
            <div>
              <div className="font-medium">Только текст</div>
              <div className="text-xs text-gray-500">Без привязки</div>
            </div>
          </StateButton>
        </LeftPanel>

        <RightPanel>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Текст абзаца *
            </label>
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder="Начните писать ваш абзац..."
              showToolbar={true}
            />
          </div>

                     <PhotoSection>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Медиа файлы
             </label>
             <DragDropZone
               onDrop={(files) => {
                 const urls = files.map(file => URL.createObjectURL(file));
                 setPhotos(prev => [...prev, ...urls]);
               }}
               acceptedTypes={['image/*', 'video/*']}
               maxFiles={5}
             />
             {photos.length > 0 && (
               <PhotoPreview>
                 {photos.map((photo, index) => (
                   <PhotoItem key={index}>
                     <PhotoImage src={photo} alt={`Фото ${index + 1}`} />
                     <PhotoRemove onClick={() => removePhoto(index)}>
                       ×
                     </PhotoRemove>
                   </PhotoItem>
                 ))}
               </PhotoPreview>
             )}
           </PhotoSection>

          <LinkSection>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ссылки
            </label>
            <div className="flex gap-2">
              <LinkInput
                type="text"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="URL ссылки"
              />
              <button
                onClick={addLink}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <Link className="w-4 h-4" />
              </button>
            </div>
            {links.length > 0 && (
              <LinkList>
                {links.map((link, index) => (
                  <LinkItem key={index}>
                    <span className="text-sm text-blue-600 truncate">
                      {link}
                    </span>
                    <button
                      onClick={() => removeLink(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </LinkItem>
                ))}
              </LinkList>
            )}
          </LinkSection>
        </RightPanel>
        </CreatorContent>
      </StatusIndicatorWrapper>

      <CreatorFooter>
        <div className="text-sm text-gray-600">
          {photos.length} фото, {links.length} ссылок
        </div>
        <div className="flex gap-3">
          {onLoadDraft && (
            <FooterButton onClick={onLoadDraft}>
              <Upload className="w-4 h-4" />
              Загрузить черновик
            </FooterButton>
          )}
          {onSaveDraft && (
            <FooterButton onClick={onSaveDraft}>
              <Download className="w-4 h-4" />
              Сохранить черновик
            </FooterButton>
          )}
          <FooterButton onClick={onCancel}>
            Отмена
          </FooterButton>
          {onDelete && (
            <FooterButton variant="danger" onClick={onDelete}>
              <X className="w-4 h-4" />
              Удалить
            </FooterButton>
          )}
          <FooterButton variant="primary" onClick={handleSave}>
            <Save className="w-4 h-4" />
            Сохранить
          </FooterButton>
        </div>
      </CreatorFooter>
    </CreatorWrapper>
  );
};

export default ParagraphCreator;
