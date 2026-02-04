import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Eye, MapPin, Calendar, Type, X } from 'lucide-react';
import { BlogConstructor } from '../../types/blog';

interface MiniPreviewProps {
  constructor: BlogConstructor;
  isVisible: boolean;
  onClose: () => void;
}

const slideIn = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
`;

const PreviewOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 500px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #E5E7EB;
  z-index: 1000;
  animation: ${({ isVisible }) => isVisible ? slideIn : slideOut} 0.3s ease-out;
  overflow: hidden;
`;

const PreviewHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PreviewTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const PreviewContent = styled.div`
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
`;

const PreviewSection = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ParagraphPreview = styled.div<{ index: number }>`
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  opacity: 0;
  animation: ${slideIn} 0.3s ease-out ${({ index }) => index * 0.1}s forwards;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ParagraphHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const StateBadge = styled.span<{ type: string | null }>`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  
  ${({ type }) => {
    switch (type) {
      case 'marker':
        return 'background: #DBEAFE; color: #1E40AF;';
      case 'route':
        return 'background: #D1FAE5; color: #065F46;';
      case 'event':
        return 'background: #FEE2E2; color: #991B1B;';
      default:
        return 'background: #F3F4F6; color: #374151;';
    }
  }}
`;

const StateIcon = styled.div<{ type: string | null }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  
  ${({ type }) => {
    switch (type) {
      case 'marker':
        return 'background: #3B82F6; color: white;';
      case 'route':
        return 'background: #10B981; color: white;';
      case 'event':
        return 'background: #F59E0B; color: white;';
      default:
        return 'background: #6B7280; color: white;';
    }
  }}
`;

const ParagraphText = styled.div`
  font-size: 12px;
  color: #6B7280;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MediaPreview = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const MediaItem = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: #F3F4F6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B7280;
  font-size: 12px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #6B7280;
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  background: #F3F4F6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #9CA3AF;
`;

const MiniPreview: React.FC<MiniPreviewProps> = ({
  constructor,
  isVisible,
  onClose
}) => {
  // Анимация переключения между параграфами
  useEffect(() => {
    if (isVisible && constructor.paragraphs.length > 0) {
      // Анимация уже реализована через CSS
    }
  }, [isVisible, constructor.paragraphs.length]);

  const getStateIcon = (type: string | null) => {
    switch (type) {
      case 'marker':
        return <MapPin className="w-3 h-3" />;
      case 'route':
        return <Type className="w-3 h-3" />;
      case 'event':
        return <Calendar className="w-3 h-3" />;
      default:
        return <Type className="w-3 h-3" />;
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

  if (!isVisible) return null;

  return (
    <PreviewOverlay isVisible={isVisible}>
      <PreviewHeader>
        <PreviewTitle>
          <Eye className="w-4 h-4 mr-2" />
          Предпросмотр блога
        </PreviewTitle>
        <CloseButton onClick={onClose}>
          <X className="w-4 h-4" />
        </CloseButton>
      </PreviewHeader>

      <PreviewContent>
        {constructor.paragraphs.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <Eye className="w-6 h-6" />
            </EmptyIcon>
            <div>Добавьте абзацы для предпросмотра</div>
          </EmptyState>
        ) : (
          <>
            <PreviewSection>
              <SectionTitle>
                <Type className="w-4 h-4" />
                Заголовок
              </SectionTitle>
              <div style={{ 
                background: '#F9FAFB', 
                padding: '12px', 
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {constructor.title || 'Без заголовка'}
              </div>
            </PreviewSection>

            <PreviewSection>
              <SectionTitle>
                <MapPin className="w-4 h-4" />
                Абзацы ({constructor.paragraphs.length})
              </SectionTitle>
              {constructor.paragraphs.map((paragraph, index) => (
                <ParagraphPreview key={paragraph.id} index={index}>
                  <ParagraphHeader>
                    <StateIcon type={paragraph.state.type}>
                      {getStateIcon(paragraph.state.type)}
                    </StateIcon>
                    <StateBadge type={paragraph.state.type}>
                      {getStateLabel(paragraph.state.type)}
                    </StateBadge>
                    <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                      Абзац {index + 1}
                    </span>
                  </ParagraphHeader>
                  
                  <ParagraphText>
                    {paragraph.text || 'Пустой абзац'}
                  </ParagraphText>
                  
                  {(paragraph.photos.length > 0 || paragraph.links.length > 0) && (
                    <MediaPreview>
                      {paragraph.photos.length > 0 && (
                        <MediaItem>
                          📷 {paragraph.photos.length}
                        </MediaItem>
                      )}
                      {paragraph.links.length > 0 && (
                        <MediaItem>
                          🔗 {paragraph.links.length}
                        </MediaItem>
                      )}
                    </MediaPreview>
                  )}
                </ParagraphPreview>
              ))}
            </PreviewSection>

            {(constructor.photos.length > 0 || constructor.links.length > 0) && (
              <PreviewSection>
                <SectionTitle>
                  <Type className="w-4 h-4" />
                  Медиа
                </SectionTitle>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {constructor.photos.length > 0 && (
                    <MediaItem>
                      📷 {constructor.photos.length}
                    </MediaItem>
                  )}
                  {constructor.links.length > 0 && (
                    <MediaItem>
                      🔗 {constructor.links.length}
                    </MediaItem>
                  )}
                </div>
              </PreviewSection>
            )}
          </>
        )}
      </PreviewContent>
    </PreviewOverlay>
  );
};

export default MiniPreview;
