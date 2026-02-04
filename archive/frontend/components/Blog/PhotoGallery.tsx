import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  X, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Download,
  Share2
} from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  onClose: () => void;
  onAddPhoto?: (url: string) => void;
  onRemovePhoto?: (index: number) => void;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: #f8f9fa;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h2`
  font-size: 1.2em;
  font-weight: bold;
  color: #333;
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const PhotoThumbnail = styled.div<{ selected?: boolean }>`
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 3px solid ${({ selected }) => (selected ? '#007bff' : 'transparent')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
`;

const PhotoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PhotoOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.7));
  display: flex;
  align-items: flex-end;
  padding: 12px;
  opacity: 0;
  transition: opacity 0.2s;

  ${PhotoThumbnail}:hover & {
    opacity: 1;
  }
`;

const PhotoActions = styled.div`
  display: flex;
  gap: 8px;
`;

const PhotoActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: white;
    transform: scale(1.1);
  }
`;

const AddPhotoCard = styled.div`
  aspect-ratio: 1;
  border: 2px dashed #dee2e6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8f9fa;

  &:hover {
    border-color: #007bff;
    background: #f0f8ff;
    color: #007bff;
  }
`;

const AddPhotoInput = styled.input`
  display: none;
`;

const FullscreenView = styled.div<{ show: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: ${({ show }) => (show ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 1001;
`;

const FullscreenImage = styled.img`
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: 8px;
`;

const FullscreenControls = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
`;

const FullscreenButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }
`;

const NavigationButton = styled.button<{ position: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ position }) => position}: 20px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-50%) scale(1.1);
  }
`;

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onClose,
  onAddPhoto,
  onRemovePhoto
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const handleAddPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        onAddPhoto?.(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (window.confirm('Удалить это фото?')) {
      onRemovePhoto?.(index);
    }
  };

  const navigateFullscreen = (direction: 'prev' | 'next') => {
    if (fullscreenIndex === null) return;
    
    if (direction === 'prev') {
      setFullscreenIndex(fullscreenIndex > 0 ? fullscreenIndex - 1 : photos.length - 1);
    } else {
      setFullscreenIndex(fullscreenIndex < photos.length - 1 ? fullscreenIndex + 1 : 0);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (fullscreenIndex === null) return;
    
    switch (event.key) {
      case 'ArrowLeft':
        navigateFullscreen('prev');
        break;
      case 'ArrowRight':
        navigateFullscreen('next');
        break;
      case 'Escape':
        setFullscreenIndex(null);
        break;
    }
  };

  return (
    <>
      <ModalOverlay onClick={onClose}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>Галерея фото</ModalTitle>
            <X 
              className="w-6 h-6 cursor-pointer hover:text-red-600 transition-colors"
              onClick={onClose}
            />
          </ModalHeader>

          <ModalBody>
            <GalleryGrid>
              {photos.map((photo, index) => (
                <PhotoThumbnail
                  key={index}
                  selected={selectedPhoto === index}
                  onClick={() => setSelectedPhoto(index)}
                >
                  <PhotoImage src={photo} alt={`Фото ${index + 1}`} />
                  <PhotoOverlay>
                    <PhotoActions>
                      <PhotoActionButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenIndex(index);
                        }}
                        title="Открыть в полном размере"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </PhotoActionButton>
                      <PhotoActionButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(index);
                        }}
                        title="Удалить фото"
                      >
                        <X className="w-4 h-4" />
                      </PhotoActionButton>
                    </PhotoActions>
                  </PhotoOverlay>
                </PhotoThumbnail>
              ))}
              
              {onAddPhoto && (
                <AddPhotoCard>
                  <AddPhotoInput
                    type="file"
                    accept="image/*"
                    onChange={handleAddPhoto}
                    id="add-photo"
                  />
                  <label htmlFor="add-photo" style={{ cursor: 'pointer' }}>
                    <Plus className="w-8 h-8 mb-2" />
                    <div className="text-sm font-medium">Добавить фото</div>
                  </label>
                </AddPhotoCard>
              )}
            </GalleryGrid>

            {photos.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <Plus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <div className="text-lg font-medium">Нет фото</div>
                  <div className="text-sm">Добавьте фото в галерею</div>
                </div>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </ModalOverlay>

      {/* Полноэкранный просмотр */}
      <FullscreenView 
        show={fullscreenIndex !== null}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {fullscreenIndex !== null && (
          <>
            <FullscreenImage 
              src={photos[fullscreenIndex]} 
              alt={`Фото ${fullscreenIndex + 1}`}
            />
            
            <FullscreenControls>
              <FullscreenButton
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = photos[fullscreenIndex];
                  link.download = `photo-${fullscreenIndex + 1}.jpg`;
                  link.click();
                }}
                title="Скачать"
              >
                <Download className="w-5 h-5" />
              </FullscreenButton>
              
              <FullscreenButton
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Фото из галереи',
                      url: photos[fullscreenIndex]
                    });
                  }
                }}
                title="Поделиться"
              >
                <Share2 className="w-5 h-5" />
              </FullscreenButton>
              
              <FullscreenButton
                onClick={() => setFullscreenIndex(null)}
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </FullscreenButton>
            </FullscreenControls>

            {photos.length > 1 && (
              <>
                <NavigationButton
                  position="left"
                  onClick={() => navigateFullscreen('prev')}
                  title="Предыдущее фото"
                >
                  <ChevronLeft className="w-6 h-6" />
                </NavigationButton>
                
                <NavigationButton
                  position="right"
                  onClick={() => navigateFullscreen('next')}
                  title="Следующее фото"
                >
                  <ChevronRight className="w-6 h-6" />
                </NavigationButton>
              </>
            )}
          </>
        )}
      </FullscreenView>
    </>
  );
};

export default PhotoGallery;
