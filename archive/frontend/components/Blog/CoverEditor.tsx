import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { 
  Upload, 
  Type, 
  Palette, 
  Move, 
  RotateCw, 
  RotateCcw, 
  Bold, 
  Italic, 
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  X,
  Download
} from 'lucide-react';

interface CoverElement {
  id: string;
  type: 'text' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color: string;
  backgroundColor?: string;
  opacity: number;
  rotation: number;
  zIndex: number;
}

interface CoverEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cover: { image: string; elements: CoverElement[] }) => void;
  initialCover?: { image?: string; elements?: CoverElement[] };
}

const EditorWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const EditorContainer = styled.div`
  background: white;
  border-radius: 20px;
  width: 90vw;
  height: 90vh;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const EditorHeader = styled.div`
  background: #2d3748;
  color: white;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #4a5568;
`;

const EditorContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Toolbar = styled.div`
  width: 280px;
  background: #f7fafc;
  border-right: 1px solid #e2e8f0;
  padding: 20px;
  overflow-y: auto;
`;

const CanvasContainer = styled.div`
  flex: 1;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const Canvas = styled.div<{ backgroundImage?: string; backgroundColor?: string }>`
  width: 400px;
  height: 600px;
  background: ${props => props.backgroundImage ? `url(${props.backgroundImage})` : props.backgroundColor || '#ffffff'};
  background-size: cover;
  background-position: center;
  position: relative;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Element = styled.div<{
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  color: string;
  backgroundColor?: string;
  opacity: number;
  rotation: number;
  zIndex: number;
  isSelected?: boolean;
}>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  font-size: ${props => props.fontSize || 16}px;
  font-family: ${props => props.fontFamily || 'Arial'};
  font-weight: ${props => props.fontWeight || 'normal'};
  font-style: ${props => props.fontStyle || 'normal'};
  text-decoration: ${props => props.textDecoration || 'none'};
  text-align: ${props => props.textAlign || 'left'};
  color: ${props => props.color};
  background-color: ${props => props.backgroundColor || 'transparent'};
  opacity: ${props => props.opacity};
  transform: rotate(${props => props.rotation}deg);
  z-index: ${props => props.zIndex};
  cursor: move;
  border: ${props => props.isSelected ? '2px solid #3182ce' : '2px solid transparent'};
  border-radius: 4px;
  padding: 4px;
  word-wrap: break-word;
  overflow: hidden;
  user-select: none;

  &:hover {
    border-color: ${props => props.isSelected ? '#3182ce' : '#a0aec0'};
  }
`;

const ToolSection = styled.div`
  margin-bottom: 24px;
`;

const ToolLabel = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ToolButton = styled.button<{ active?: boolean; variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: ${props => props.active ? '#3182ce' : 'white'};
  color: ${props => props.active ? 'white' : '#4a5568'};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;

  &:hover {
    background: ${props => props.active ? '#2c5aa0' : '#f7fafc'};
    border-color: ${props => props.active ? '#2c5aa0' : '#cbd5e0'};
  }

  ${props => props.variant === 'primary' && `
    background: #3182ce;
    color: white;
    border-color: #3182ce;
    
    &:hover {
      background: #2c5aa0;
      border-color: #2c5aa0;
    }
  `}
`;

const InputGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #2d3748;
  background: white;

  &:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #2d3748;
  background: white;

  &:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
  }
`;

const ColorPicker = styled.input`
  width: 100%;
  height: 40px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
`;

const Slider = styled.input`
  width: 100%;
  margin: 8px 0;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const SmallButton = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: ${props => props.active ? '#3182ce' : 'white'};
  color: ${props => props.active ? 'white' : '#4a5568'};
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${props => props.active ? '#2c5aa0' : '#f7fafc'};
  }
`;

const CoverEditor: React.FC<CoverEditorProps> = ({ isOpen, onClose, onSave, initialCover }) => {
  const [elements, setElements] = useState<CoverElement[]>(initialCover?.elements || []);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(initialCover?.image);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  const addTextElement = () => {
    const newElement: CoverElement = {
      id: `text_${Date.now()}`,
      type: 'text',
      content: 'Новый текст',
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      fontSize: 24,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      color: '#000000',
      opacity: 1,
      rotation: 0,
      zIndex: elements.length + 1
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newElement: CoverElement = {
            id: `image_${Date.now()}`,
            type: 'image',
            content: e.target?.result as string,
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            opacity: 1,
            rotation: 0,
            zIndex: elements.length + 1,
            color: '#000000'
          };
          setElements([...elements, newElement]);
          setSelectedElement(newElement.id);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const updateElement = (id: string, updates: Partial<CoverElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    setSelectedElement(elementId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    const element = elements.find(el => el.id === elementId);
    if (element) {
      setElementStart({ x: element.x, y: element.y });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedElement) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    updateElement(selectedElement, {
      x: Math.max(0, elementStart.x + deltaX),
      y: Math.max(0, elementStart.y + deltaY)
    });
  }, [isDragging, selectedElement, dragStart, elementStart, elements]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSave = () => {
    // Создаем canvas для экспорта
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 600;

    // Рисуем фон
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 400, 600);
        drawElements();
      };
      img.src = backgroundImage;
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, 400, 600);
      drawElements();
    }

    function drawElements() {
      if (!ctx) return;
      
      // Сортируем элементы по z-index
      const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
      
      sortedElements.forEach(element => {
        ctx.save();
        ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.globalAlpha = element.opacity;

        if (element.type === 'text') {
          ctx.font = `${element.fontStyle} ${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
          ctx.fillStyle = element.color;
          ctx.textAlign = element.textAlign as CanvasTextAlign;
          ctx.textBaseline = 'middle';
          
          // Разбиваем текст на строки
          const lines = element.content.split('\n');
          lines.forEach((line, index) => {
            ctx.fillText(line, 0, index * (element.fontSize || 16) * 1.2);
          });
        } else if (element.type === 'image') {
          const img = new Image();
          img.onload = () => {
            if (ctx) {
              ctx.drawImage(img, -element.width / 2, -element.height / 2, element.width, element.height);
            }
          };
          img.src = element.content;
        }

        ctx.restore();
      });

      // Экспортируем как base64
      const dataURL = canvas.toDataURL('image/png');
      onSave({ image: dataURL, elements });
    }
  };

  if (!isOpen) return null;

  const selectedElementData = elements.find(el => el.id === selectedElement);

  return (
    <EditorWrapper onClick={onClose}>
      <EditorContainer onClick={(e) => e.stopPropagation()}>
        <EditorHeader>
          <div className="flex items-center gap-3">
            <Type className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Редактор обложек</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Сохранить
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </EditorHeader>

        <EditorContent>
          <Toolbar>
            {/* Фон */}
            <ToolSection>
              <ToolLabel>Фон</ToolLabel>
              <InputGroup>
                <Label>Изображение</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setBackgroundImage(e.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full"
                />
              </InputGroup>
              <InputGroup>
                <Label>Цвет фона</Label>
                <ColorPicker
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                />
              </InputGroup>
            </ToolSection>

            {/* Элементы */}
            <ToolSection>
              <ToolLabel>Элементы</ToolLabel>
              <ToolButton onClick={addTextElement} variant="primary">
                <Type className="w-4 h-4" />
                Добавить текст
              </ToolButton>
              <ToolButton onClick={addImageElement}>
                <Upload className="w-4 h-4" />
                Добавить изображение
              </ToolButton>
            </ToolSection>

            {/* Свойства элемента */}
            {selectedElementData && (
              <ToolSection>
                <ToolLabel>Свойства элемента</ToolLabel>
                
                {selectedElementData.type === 'text' && (
                  <>
                    <InputGroup>
                      <Label>Текст</Label>
                      <Input
                        value={selectedElementData.content}
                        onChange={(e) => updateElement(selectedElementData.id, { content: e.target.value })}
                        placeholder="Введите текст..."
                      />
                    </InputGroup>
                    
                    <InputGroup>
                      <Label>Размер шрифта</Label>
                      <Slider
                        type="range"
                        min="8"
                        max="72"
                        value={selectedElementData.fontSize || 16}
                        onChange={(e) => updateElement(selectedElementData.id, { fontSize: parseInt(e.target.value) })}
                      />
                      <div className="text-xs text-gray-500 text-center">
                        {selectedElementData.fontSize || 16}px
                      </div>
                    </InputGroup>

                    <InputGroup>
                      <Label>Шрифт</Label>
                      <Select
                        value={selectedElementData.fontFamily || 'Arial'}
                        onChange={(e) => updateElement(selectedElementData.id, { fontFamily: e.target.value })}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Montserrat">Montserrat</option>
                      </Select>
                    </InputGroup>

                    <InputGroup>
                      <Label>Стиль текста</Label>
                      <ButtonGroup>
                        <SmallButton
                          active={selectedElementData.fontWeight === 'bold'}
                          onClick={() => updateElement(selectedElementData.id, { 
                            fontWeight: selectedElementData.fontWeight === 'bold' ? 'normal' : 'bold' 
                          })}
                        >
                          <Bold className="w-4 h-4" />
                        </SmallButton>
                        <SmallButton
                          active={selectedElementData.fontStyle === 'italic'}
                          onClick={() => updateElement(selectedElementData.id, { 
                            fontStyle: selectedElementData.fontStyle === 'italic' ? 'normal' : 'italic' 
                          })}
                        >
                          <Italic className="w-4 h-4" />
                        </SmallButton>
                        <SmallButton
                          active={selectedElementData.textDecoration === 'underline'}
                          onClick={() => updateElement(selectedElementData.id, { 
                            textDecoration: selectedElementData.textDecoration === 'underline' ? 'none' : 'underline' 
                          })}
                        >
                          <Underline className="w-4 h-4" />
                        </SmallButton>
                      </ButtonGroup>
                    </InputGroup>

                    <InputGroup>
                      <Label>Выравнивание</Label>
                      <ButtonGroup>
                        <SmallButton
                          active={selectedElementData.textAlign === 'left'}
                          onClick={() => updateElement(selectedElementData.id, { textAlign: 'left' })}
                        >
                          <AlignLeft className="w-4 h-4" />
                        </SmallButton>
                        <SmallButton
                          active={selectedElementData.textAlign === 'center'}
                          onClick={() => updateElement(selectedElementData.id, { textAlign: 'center' })}
                        >
                          <AlignCenter className="w-4 h-4" />
                        </SmallButton>
                        <SmallButton
                          active={selectedElementData.textAlign === 'right'}
                          onClick={() => updateElement(selectedElementData.id, { textAlign: 'right' })}
                        >
                          <AlignRight className="w-4 h-4" />
                        </SmallButton>
                      </ButtonGroup>
                    </InputGroup>
                  </>
                )}

                <InputGroup>
                  <Label>Цвет</Label>
                  <ColorPicker
                    type="color"
                    value={selectedElementData.color}
                    onChange={(e) => updateElement(selectedElementData.id, { color: e.target.value })}
                  />
                </InputGroup>

                <InputGroup>
                  <Label>Прозрачность</Label>
                  <Slider
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={selectedElementData.opacity}
                    onChange={(e) => updateElement(selectedElementData.id, { opacity: parseFloat(e.target.value) })}
                  />
                  <div className="text-xs text-gray-500 text-center">
                    {Math.round(selectedElementData.opacity * 100)}%
                  </div>
                </InputGroup>

                <InputGroup>
                  <Label>Поворот</Label>
                  <Slider
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedElementData.rotation}
                    onChange={(e) => updateElement(selectedElementData.id, { rotation: parseInt(e.target.value) })}
                  />
                  <div className="text-xs text-gray-500 text-center">
                    {selectedElementData.rotation}°
                  </div>
                </InputGroup>

                <InputGroup>
                  <Label>Размер</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Ширина</Label>
                      <Input
                        type="number"
                        value={selectedElementData.width}
                        onChange={(e) => updateElement(selectedElementData.id, { width: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Высота</Label>
                      <Input
                        type="number"
                        value={selectedElementData.height}
                        onChange={(e) => updateElement(selectedElementData.id, { height: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </InputGroup>

                <ToolButton
                  onClick={() => deleteElement(selectedElementData.id)}
                  style={{ background: '#e53e3e', color: 'white', borderColor: '#e53e3e' }}
                >
                  <X className="w-4 h-4" />
                  Удалить элемент
                </ToolButton>
              </ToolSection>
            )}
          </Toolbar>

          <CanvasContainer>
            <Canvas
              ref={canvasRef}
              backgroundImage={backgroundImage}
              backgroundColor={backgroundColor}
            >
              {elements.map(element => (
                <Element
                  key={element.id}
                  {...element}
                  isSelected={selectedElement === element.id}
                  onMouseDown={(e) => handleMouseDown(e, element.id)}
                  style={{
                    backgroundImage: element.type === 'image' ? `url(${element.content})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {element.type === 'text' ? element.content : ''}
                </Element>
              ))}
            </Canvas>
          </CanvasContainer>
        </EditorContent>
      </EditorContainer>
    </EditorWrapper>
  );
};

export default CoverEditor;
