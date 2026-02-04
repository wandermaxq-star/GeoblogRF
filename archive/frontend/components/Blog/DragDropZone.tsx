import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Upload, Image, File, X } from 'lucide-react';

interface DragDropZoneProps {
  onDrop: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  className?: string;
}

const DropZone = styled.div<{ isDragOver: boolean }>`
  border: 2px dashed ${({ isDragOver }) => isDragOver ? '#3B82F6' : '#D1D5DB'};
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  background: ${({ isDragOver }) => isDragOver ? '#EFF6FF' : '#F9FAFB'};
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  
  &:hover {
    border-color: #3B82F6;
    background: #EFF6FF;
  }
`;

const DropZoneContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B7280;
`;

const Text = styled.div`
  color: #374151;
  font-size: 14px;
`;

const SubText = styled.div`
  color: #6B7280;
  font-size: 12px;
`;

const FileInput = styled.input`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const PreviewContainer = styled.div`
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
`;

const PreviewItem = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #E5E7EB;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PreviewIcon = styled.div`
  width: 100%;
  height: 100%;
  background: #F3F4F6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B7280;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #EF4444;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  
  &:hover {
    background: #DC2626;
  }
`;

const DragDropZone: React.FC<DragDropZoneProps> = ({
  onDrop,
  acceptedTypes = ['image/*', 'video/*'],
  maxFiles = 10,
  className
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      return acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });
    }).slice(0, maxFiles);

    if (validFiles.length > 0) {
      setPreviewFiles(prev => [...prev, ...validFiles]);
      onDrop(validFiles);
    }
  };

  const removeFile = (index: number) => {
    setPreviewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-6 h-6" />;
    }
    if (file.type.startsWith('video/')) {
      return <File className="w-6 h-6" />;
    }
    return <File className="w-6 h-6" />;
  };

  const getFilePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      return (
        <PreviewImage 
          src={URL.createObjectURL(file)} 
          alt={file.name}
        />
      );
    }
    return (
      <PreviewIcon>
        {getFileIcon(file)}
      </PreviewIcon>
    );
  };

  return (
    <div className={className}>
      <DropZone
        isDragOver={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileInput
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
        />
        
        <DropZoneContent>
          <IconWrapper>
            <Upload className="w-6 h-6" />
          </IconWrapper>
          <Text>Перетащите файлы сюда или нажмите для выбора</Text>
          <SubText>
            Поддерживаемые форматы: {acceptedTypes.join(', ')}
          </SubText>
          <SubText>
            Максимум файлов: {maxFiles}
          </SubText>
        </DropZoneContent>
      </DropZone>

      {previewFiles.length > 0 && (
        <PreviewContainer>
          {previewFiles.map((file, index) => (
            <PreviewItem key={index}>
              {getFilePreview(file)}
              <RemoveButton onClick={() => removeFile(index)}>
                <X className="w-3 h-3" />
              </RemoveButton>
            </PreviewItem>
          ))}
        </PreviewContainer>
      )}
    </div>
  );
};

export default DragDropZone;



