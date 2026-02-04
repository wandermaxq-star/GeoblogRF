import React, { useState } from 'react';
import styled from 'styled-components';
import { X, MapPin, Palette, Type, Save } from 'lucide-react';
import { BlogSegment } from '../../types/blog';

interface SegmentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: BlogSegment) => void;
  segment: BlogSegment | null;
  availableParagraphs: Array<{ id: string; text: string }>;
}

const EditorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const EditorContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const EditorHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const EditorTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
`;

const EditorContent = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FormLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const FormInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const FormTextarea = styled.textarea`
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const FormSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ColorPicker = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ColorOption = styled.button<{ color: string; selected: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#d1d5db'};
  background-color: ${props => props.color};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
  }
`;

const CoordinatesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
`;

const CoordinateItem = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.75rem;
  color: #6b7280;
`;

const EditorFooter = styled.div`
  padding: 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;

  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `
          background: #3b82f6;
          color: white;
          border: none;
          &:hover {
            background: #2563eb;
          }
        `;
      default:
        return `
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          &:hover {
            background: #e5e7eb;
          }
        `;
    }
  }}
`;

const SegmentEditor: React.FC<SegmentEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  segment,
  availableParagraphs
}) => {
  const [title, setTitle] = useState(segment?.title || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [paragraphId, setParagraphId] = useState(segment?.paragraphId || '');
  const [highlight, setHighlight] = useState(segment?.highlight || '#3b82f6');
  const [coordinates, setCoordinates] = useState<number[][]>(
    segment?.coordinates || [[56.1286, 40.4064], [56.1290, 40.4070]]
  );

  const colorOptions = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // yellow
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16'  // lime
  ];

  const handleSave = () => {
    if (!segment) return;

    const updatedSegment: BlogSegment = {
      ...segment,
      title,
      description,
      paragraphId,
      highlight,
      coordinates
    };

    onSave(updatedSegment);
  };

  const addCoordinate = () => {
    const newCoordinate: [number, number] = [56.1286 + Math.random() * 0.01, 40.4064 + Math.random() * 0.01];
    setCoordinates([...coordinates, newCoordinate]);
  };

  const removeCoordinate = (index: number) => {
    setCoordinates(coordinates.filter((_, i) => i !== index));
  };

  if (!isOpen || !segment) return null;

  return (
    <EditorOverlay onClick={onClose}>
      <EditorContainer onClick={(e) => e.stopPropagation()}>
        <EditorHeader>
          <EditorTitle>Редактировать отрезок маршрута</EditorTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </EditorHeader>

        <EditorContent>
          <FormGroup>
            <FormLabel>Название отрезка</FormLabel>
            <FormInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название отрезка..."
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Описание</FormLabel>
            <FormTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание отрезка маршрута..."
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Связанный абзац</FormLabel>
            <FormSelect
              value={paragraphId}
              onChange={(e) => setParagraphId(e.target.value)}
            >
              <option value="">Выберите абзац</option>
              {availableParagraphs.map((paragraph) => (
                <option key={paragraph.id} value={paragraph.id}>
                  {paragraph.text.substring(0, 50)}...
                </option>
              ))}
            </FormSelect>
          </FormGroup>

          <FormGroup>
            <FormLabel>Цвет выделения</FormLabel>
            <ColorPicker>
              {colorOptions.map((color) => (
                <ColorOption
                  key={color}
                  color={color}
                  selected={highlight === color}
                  onClick={() => setHighlight(color)}
                />
              ))}
            </ColorPicker>
          </FormGroup>

          <FormGroup>
            <FormLabel>Координаты маршрута</FormLabel>
            <CoordinatesList>
              {coordinates.map((coord, index) => (
                <CoordinateItem key={index}>
                  <MapPin className="w-4 h-4" />
                  <span>{index + 1}. {coord[0].toFixed(6)}, {coord[1].toFixed(6)}</span>
                  <button
                    onClick={() => removeCoordinate(index)}
                    className="text-red-500 hover:text-red-700 ml-auto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </CoordinateItem>
              ))}
            </CoordinatesList>
            <Button onClick={addCoordinate}>
              <MapPin className="w-4 h-4" />
              Добавить точку
            </Button>
          </FormGroup>
        </EditorContent>

        <EditorFooter>
          <Button onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleSave}>
            <Save className="w-4 h-4" />
            Сохранить
          </Button>
        </EditorFooter>
      </EditorContainer>
    </EditorOverlay>
  );
};

export default SegmentEditor;
