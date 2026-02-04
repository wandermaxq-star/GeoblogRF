import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { 
  FileText, 
  Image,
  Save,
  X,
  Plus,
  Eye,
  EyeOff,
  Move,
  Trash2,
  Type,
  Heading1,
  Quote,
  Code,
  Minus,
} from 'lucide-react';
import { Blog } from '../../types/blog';

interface BlogEditorProps {
  blog?: Blog;
  onSave?: (blog: Blog) => void;
  onCancel?: () => void;
  selectedCategory?: string;
  selectedGeoTypes?: string[];
}

// Типы блоков контента
type ContentBlockType = 'text' | 'heading' | 'image' | 'quote' | 'code' | 'separator';

interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string;
  settings?: {
    level?: 1 | 2 | 3; // для заголовков
    alignment?: 'left' | 'center' | 'right';
    imageUrl?: string;
    imageAlt?: string;
  };
}

const EditorWrapper = styled.div`
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

const EditorHeader = styled.div`
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

const BlockButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9em;

  &:hover {
    background: #e9ecef;
    border-color: #adb5bd;
  }
`;

const EditorContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  background: #fafafa;
`;

const ContentBlockWrapper = styled.div<{ isSelected?: boolean }>`
  position: relative;
  padding: 12px;
  border: 2px solid ${({ isSelected }) => (isSelected ? '#007bff' : 'transparent')};
  border-radius: 8px;
  background: white;
  transition: all 0.2s;

  &:hover {
    border-color: ${({ isSelected }) => (isSelected ? '#007bff' : '#e9ecef')};
  }
`;

const BlockControls = styled.div`
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  opacity: 0;
  transition: opacity 0.2s;

  ${ContentBlockWrapper}:hover & {
    opacity: 1;
  }
`;

const ControlButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #f8f9fa;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e9ecef;
  }

  &.danger:hover {
    background: #dc3545;
    color: white;
  }
`;

const TextBlock = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 1em;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const HeadingBlock = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 1.5em;
  font-weight: bold;
  background: #f8f9fa;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const ImageBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 2px dashed #dee2e6;
  border-radius: 6px;
  background: #f8f9fa;
  text-align: center;
`;

const ImagePreview = styled.img`
  max-width: 100%;
  max-height: 300px;
  border-radius: 6px;
  object-fit: cover;
`;

const ImageInput = styled.input`
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.9em;
`;

const QuoteBlock = styled.blockquote`
  padding: 16px;
  border-left: 4px solid #007bff;
  background: #f8f9fa;
  font-style: italic;
  margin: 0;
  border-radius: 0 6px 6px 0;
`;

const CodeBlock = styled.pre`
  padding: 16px;
  background: #2d3748;
  color: #e2e8f0;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  overflow-x: auto;
  margin: 0;
`;

const SeparatorBlock = styled.hr`
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #dee2e6, transparent);
  margin: 20px 0;
`;

const AddBlockButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 16px;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  background: white;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1em;

  &:hover {
    border-color: #007bff;
    color: #007bff;
    background: #f0f8ff;
  }
`;

const EditorFooter = styled.div`
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'success' }>`
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

const BlogEditor: React.FC<BlogEditorProps> = ({
  blog,
  onSave,
  onCancel,
  selectedCategory,
  selectedGeoTypes = []
}) => {
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    { id: '1', type: 'heading', content: blog?.title || 'Новый блог', settings: { level: 1 } },
    { id: '2', type: 'text', content: blog?.preview || 'Краткое описание блога...' },
    { id: '3', type: 'text', content: blog?.content || 'Начните писать ваш блог...' }
  ]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(blog?.title || '');
  

  const addBlock = useCallback((type: ContentBlockType, afterId?: string) => {
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      content: '',
      settings: type === 'heading' ? { level: 2 } : {}
    };

    setBlocks(prev => {
      if (afterId) {
        const index = prev.findIndex(b => b.id === afterId);
        return [...prev.slice(0, index + 1), newBlock, ...prev.slice(index + 1)];
      }
      return [...prev, newBlock];
    });
  }, []);

  const updateBlock = useCallback((id: string, content: string, settings?: any) => {
    setBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, content, settings: { ...block.settings, ...settings } } : block
    ));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(block => block.id !== id));
  }, []);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === id);
      if (direction === 'up' && index > 0) {
        const newBlocks = [...prev];
        [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        return newBlocks;
      }
      if (direction === 'down' && index < prev.length - 1) {
        const newBlocks = [...prev];
        [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        return newBlocks;
      }
      return prev;
    });
  }, []);


  const handleSave = () => {
    if (!title.trim()) {
      alert('Пожалуйста, введите заголовок блога');
      return;
    }

    const content = blocks.map(block => {
      switch (block.type) {
        case 'heading':
          return `# ${block.content}\n\n`;
        case 'text':
          return `${block.content}\n\n`;
        case 'image':
          return `![${block.settings?.imageAlt || 'Изображение'}](${block.settings?.imageUrl})\n\n`;
        case 'quote':
          return `> ${block.content}\n\n`;
        case 'code':
          return `\`\`\`\n${block.content}\n\`\`\`\n\n`;
        case 'separator':
          return `---\n\n`;
        default:
          return '';
      }
    }).join('');

    const updatedBlog: Blog = {
      ...blog!,
      title,
      content,
      preview: blocks.find(b => b.type === 'text')?.content || '',
      category: selectedCategory || blog?.category || '',
      geoType: selectedGeoTypes.length > 0 ? selectedGeoTypes[0] as 'point' | 'route' | 'event' : 'point',
      updated_at: new Date().toISOString()
    };

    onSave?.(updatedBlog);
  };

  const renderBlock = (block: ContentBlock) => {
    const isSelected = selectedBlock === block.id;

    const blockControls = (
      <BlockControls>
        <ControlButton onClick={() => moveBlock(block.id, 'up')} title="Переместить вверх">
          <Move className="w-3 h-3" />
        </ControlButton>
        <ControlButton onClick={() => moveBlock(block.id, 'down')} title="Переместить вниз">
          <Move className="w-3 h-3 rotate-180" />
        </ControlButton>
        <ControlButton 
          className="danger" 
          onClick={() => removeBlock(block.id)} 
          title="Удалить блок"
        >
          <Trash2 className="w-3 h-3" />
        </ControlButton>
      </BlockControls>
    );

    switch (block.type) {
      case 'heading':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <HeadingBlock
              value={block.content}
              onChange={(e) => updateBlock(block.id, e.target.value)}
              placeholder="Заголовок..."
              onFocus={() => setSelectedBlock(block.id)}
            />
          </ContentBlockWrapper>
        );

      case 'text':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <TextBlock
              value={block.content}
              onChange={(e) => updateBlock(block.id, e.target.value)}
              placeholder="Начните писать..."
              onFocus={() => setSelectedBlock(block.id)}
            />
          </ContentBlockWrapper>
        );

      case 'image':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <ImageBlock>
              {block.settings?.imageUrl ? (
                <ImagePreview src={block.settings.imageUrl} alt={block.settings?.imageAlt} />
              ) : (
                <div>
                  <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Добавьте URL изображения</p>
                </div>
              )}
              <ImageInput
                type="text"
                placeholder="URL изображения"
                value={block.settings?.imageUrl || ''}
                onChange={(e) => updateBlock(block.id, block.content, { imageUrl: e.target.value })}
              />
              <ImageInput
                type="text"
                placeholder="Альтернативный текст"
                value={block.settings?.imageAlt || ''}
                onChange={(e) => updateBlock(block.id, block.content, { imageAlt: e.target.value })}
              />
            </ImageBlock>
          </ContentBlockWrapper>
        );

      case 'quote':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <QuoteBlock>
              <TextBlock
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                placeholder="Цитата..."
                onFocus={() => setSelectedBlock(block.id)}
                style={{ border: 'none', background: 'transparent', padding: 0 }}
              />
            </QuoteBlock>
          </ContentBlockWrapper>
        );

      case 'code':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <CodeBlock>
              <TextBlock
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                placeholder="Код..."
                onFocus={() => setSelectedBlock(block.id)}
                style={{ 
                  border: 'none', 
                  background: 'transparent', 
                  padding: 0, 
                  color: '#e2e8f0',
                  fontFamily: 'Courier New, monospace'
                }}
              />
            </CodeBlock>
          </ContentBlockWrapper>
        );

      case 'separator':
        return (
          <ContentBlockWrapper key={block.id} isSelected={isSelected}>
            {blockControls}
            <SeparatorBlock />
          </ContentBlockWrapper>
        );

      default:
        return null;
    }
  };

  const renderPreview = () => {
    return (
      <div className="prose max-w-none">
        {blocks.map(block => {
          switch (block.type) {
            case 'heading':
              return <h1 key={block.id}>{block.content}</h1>;
            case 'text':
              return <p key={block.id}>{block.content}</p>;
            case 'image':
              return block.settings?.imageUrl ? (
                <img key={block.id} src={block.settings.imageUrl} alt={block.settings?.imageAlt} />
              ) : null;
            case 'quote':
              return <blockquote key={block.id}>{block.content}</blockquote>;
            case 'code':
              return <pre key={block.id}><code>{block.content}</code></pre>;
            case 'separator':
              return <hr key={block.id} />;
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <EditorWrapper>
      <EditorHeader>
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Редактор блогов
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Редактировать' : 'Предпросмотр'}
          </button>
          {onCancel && (
            <X 
              className="w-5 h-5 cursor-pointer hover:text-red-600 transition-colors"
              onClick={onCancel}
            />
          )}
        </div>
      </EditorHeader>

      {!showPreview && (
        <Toolbar>
          <BlockButton onClick={() => addBlock('heading')}>
            <Heading1 className="w-4 h-4" />
            Заголовок
          </BlockButton>
          <BlockButton onClick={() => addBlock('text')}>
            <Type className="w-4 h-4" />
            Текст
          </BlockButton>
          <BlockButton onClick={() => addBlock('image')}>
            <Image className="w-4 h-4" />
            Изображение
          </BlockButton>
          <BlockButton onClick={() => addBlock('quote')}>
            <Quote className="w-4 h-4" />
            Цитата
          </BlockButton>
          <BlockButton onClick={() => addBlock('code')}>
            <Code className="w-4 h-4" />
            Код
          </BlockButton>
          <BlockButton onClick={() => addBlock('separator')}>
            <Minus className="w-4 h-4" />
            Разделитель
          </BlockButton>
          
        </Toolbar>
      )}

      <EditorContent>
        {showPreview ? (
          renderPreview()
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заголовок блога *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Введите заголовок блога..."
              />
            </div>

            {blocks.map((block, index) => (
              <div key={block.id}>
                {renderBlock(block)}
                {index < blocks.length - 1 && (
                  <AddBlockButton onClick={() => addBlock('text', block.id)}>
                    <Plus className="w-4 h-4" />
                    Добавить блок
                  </AddBlockButton>
                )}
              </div>
            ))}

            <AddBlockButton onClick={() => addBlock('text')}>
              <Plus className="w-4 h-4" />
              Добавить блок
            </AddBlockButton>
          </>
        )}
      </EditorContent>

      <EditorFooter>
        <div className="text-sm text-gray-600">
          {blocks.length} блоков
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
        </div>
      </EditorFooter>
      
    </EditorWrapper>
  );
};

export default BlogEditor;
