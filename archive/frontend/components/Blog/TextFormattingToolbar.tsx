import React from 'react';
import styled from 'styled-components';
import { 
  Bold, 
  Italic, 
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Minus
} from 'lucide-react';

interface TextFormattingToolbarProps {
  onFormat: (format: string, value?: string) => void;
  onInsert: (type: string, data?: any) => void;
  isActive?: (format: string) => boolean;
  disabled?: boolean;
}

const ToolbarWrapper = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
`;

const ToolbarGroup = styled.div`
  display: flex;
  gap: 2px;
  padding: 0 8px;
  border-right: 1px solid #dee2e6;
  
  &:last-child {
    border-right: none;
  }
`;

const ToolbarButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ active }) => (active ? '#007bff' : '#dee2e6')};
  border-radius: 4px;
  background: ${({ active }) => (active ? '#e3f2fd' : '#fff')};
  color: ${({ active }) => (active ? '#007bff' : '#495057')};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;

  &:hover {
    background: ${({ active }) => (active ? '#e3f2fd' : '#f8f9fa')};
    border-color: #007bff;
    color: #007bff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ColorInput = styled.input`
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
  
  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  
  &::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }
`;

const FontSizeSelect = styled.select`
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  color: #495057;
  font-size: 12px;
  padding: 0 8px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const TextFormattingToolbar: React.FC<TextFormattingToolbarProps> = ({
  onFormat,
  onInsert,
  isActive = () => false,
  disabled = false
}) => {
  const handleFormat = (format: string, value?: string) => {
    if (!disabled) {
      onFormat(format, value);
    }
  };

  const handleInsert = (type: string, data?: any) => {
    if (!disabled) {
      onInsert(type, data);
    }
  };

  return (
    <ToolbarWrapper>
      {/* Базовое форматирование */}
      <ToolbarGroup>
        <ToolbarButton
          active={isActive('bold')}
          onClick={() => handleFormat('bold')}
          title="Жирный"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={isActive('italic')}
          onClick={() => handleFormat('italic')}
          title="Курсив"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={isActive('underline')}
          onClick={() => handleFormat('underline')}
          title="Подчеркивание"
        >
          <Underline className="w-4 h-4" />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Выравнивание */}
      <ToolbarGroup>
        <ToolbarButton
          active={isActive('alignLeft')}
          onClick={() => handleFormat('justifyLeft')}
          title="Выровнять по левому краю"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={isActive('alignCenter')}
          onClick={() => handleFormat('justifyCenter')}
          title="Выровнять по центру"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={isActive('alignRight')}
          onClick={() => handleFormat('justifyRight')}
          title="Выровнять по правому краю"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={isActive('alignJustify')}
          onClick={() => handleFormat('justifyFull')}
          title="Выровнять по ширине"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Списки */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={() => handleFormat('insertUnorderedList')}
          title="Маркированный список"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('insertOrderedList')}
          title="Нумерованный список"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Специальные элементы */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={() => handleFormat('formatBlock', 'blockquote')}
          title="Цитата"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleFormat('formatBlock', 'pre')}
          title="Код"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleInsert('link')}
          title="Вставить ссылку"
        >
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => handleInsert('image')}
          title="Вставить изображение"
        >
          <Image className="w-4 h-4" />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Заголовки */}
      <ToolbarGroup>
        <FontSizeSelect
          onChange={(e) => handleFormat('formatBlock', e.target.value)}
          title="Размер заголовка"
        >
          <option value="p">Обычный текст</option>
          <option value="h1">Заголовок 1</option>
          <option value="h2">Заголовок 2</option>
          <option value="h3">Заголовок 3</option>
          <option value="h4">Заголовок 4</option>
          <option value="h5">Заголовок 5</option>
          <option value="h6">Заголовок 6</option>
        </FontSizeSelect>
      </ToolbarGroup>

      {/* Цвета */}
      <ToolbarGroup>
        <ColorInput
          type="color"
          defaultValue="#000000"
          onChange={(e) => handleFormat('foreColor', e.target.value)}
          title="Цвет текста"
        />
        <ColorInput
          type="color"
          defaultValue="#ffffff"
          onChange={(e) => handleFormat('backColor', e.target.value)}
          title="Цвет фона"
        />
      </ToolbarGroup>

      {/* Разделитель */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={() => handleInsert('separator')}
          title="Горизонтальная линия"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>
      </ToolbarGroup>
    </ToolbarWrapper>
  );
};

export default TextFormattingToolbar;
