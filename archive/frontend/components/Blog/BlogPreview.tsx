import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { 
  X, 
  Play, 
  Pause,
  RotateCcw,
  MapPin,
  Calendar
} from 'lucide-react';
import { BlogConstructor as BlogConstructorType, BlogParagraph } from '../../types/blog';

interface BlogPreviewProps {
  constructor: BlogConstructorType;
  onClose: () => void;
}

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const ModalOverlay = styled.div`
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

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  width: 95%;
  max-width: 1200px;
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
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ControlButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #0056b3;
    transform: scale(1.1);
  }

  &.secondary {
    background: #6c757d;
    
    &:hover {
      background: #545b62;
    }
  }
`;

const ModalBody = styled.div`
  flex: 1;
  display: flex;
  min-height: 600px;
`;

const LeftPanel = styled.div`
  width: 400px;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const RightPanel = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  position: relative;
`;

const DynamicContent = styled.div<{ show: boolean }>`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: ${({ show }) => (show ? 1 : 0)};
  transform: ${({ show }) => (show ? 'scale(1)' : 'scale(0.8)')};
  transition: all 0.5s ease-in-out;
`;

const ContentIcon = styled.div<{ type: string | null }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 20px;
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
  margin-bottom: 20px;
  animation: ${fadeIn} 0.5s ease-in-out;
`;

const ContentTitle = styled.h3`
  font-size: 1.5em;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  text-align: center;
  animation: ${slideIn} 0.5s ease-in-out;
`;

const ContentDescription = styled.p`
  color: #666;
  text-align: center;
  line-height: 1.6;
  animation: ${slideIn} 0.5s ease-in-out 0.2s both;
`;

const BlogTitle = styled.h1`
  font-size: 2em;
  font-weight: bold;
  color: #333;
  margin-bottom: 16px;
  text-align: center;
`;

const BlogPreview = styled.p`
  color: #666;
  text-align: center;
  margin-bottom: 40px;
  font-size: 1.1em;
  line-height: 1.6;
`;

const ParagraphContainer = styled.div<{ visible: boolean; delay: number }>`
  margin-bottom: 30px;
  opacity: ${({ visible }) => (visible ? 1 : 0)};
  transform: ${({ visible }) => (visible ? 'translateY(0)' : 'translateY(20px)')};
  transition: all 0.5s ease-in-out;
  transition-delay: ${({ delay }) => delay}ms;
`;

const ParagraphText = styled.div`
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
  line-height: 1.6;
  color: #333;
`;

const ParagraphPhotos = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
`;

const PhotoItem = styled.img`
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
`;

const ParagraphLinks = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 12px;
`;

const LinkItem = styled.a`
  display: inline-block;
  padding: 6px 12px;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9em;
  transition: all 0.2s;

  &:hover {
    background: #0056b3;
    transform: translateY(-1px);
  }
`;

const ProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #e9ecef;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #007bff, #28a745);
  width: ${({ progress }) => progress}%;
  transition: width 0.3s ease;
`;

const BlogPreviewModal: React.FC<BlogPreviewProps> = ({
  constructor,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [visibleParagraphs, setVisibleParagraphs] = useState<number[]>([]);

  const paragraphs = constructor.paragraphs || [];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentParagraph(prev => {
          const next = prev + 1;
          if (next < paragraphs.length) {
            setVisibleParagraphs(prev => [...prev, prev.length]);
            return next;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 2000); // 2 секунды на абзац
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, paragraphs.length]); // Убираем currentParagraph из зависимостей

  const handlePlay = () => {
    if (currentParagraph >= paragraphs.length) {
      // Сброс и начало заново
      setCurrentParagraph(0);
      setVisibleParagraphs([]);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentParagraph(0);
    setVisibleParagraphs([]);
  };

  const getCurrentContent = () => {
    if (currentParagraph < paragraphs.length) {
      return paragraphs[currentParagraph];
    }
    return null;
  };

  const getContentIcon = (type: string | null) => {
    switch (type) {
      case 'marker':
        return <MapPin className="w-10 h-10" />;
      case 'route':
        return <MapPin className="w-10 h-10" />;
      case 'event':
        return <Calendar className="w-10 h-10" />;
      default:
        return <div className="w-10 h-10 bg-gray-500 rounded-full" />;
    }
  };

  const getContentTitle = (type: string | null) => {
    switch (type) {
      case 'marker':
        return 'Метка на карте';
      case 'route':
        return 'Маршрут';
      case 'event':
        return 'Событие';
      default:
        return 'Текст';
    }
  };

  const getContentDescription = (paragraph: BlogParagraph) => {
    if (paragraph.state.data) {
      if ('name' in paragraph.state.data) {
        return paragraph.state.data.name;
      }
      if ('title' in paragraph.state.data) {
        return paragraph.state.data.title;
      }
    }
    return 'Выбранный элемент';
  };

  const progress = paragraphs.length > 0 ? (currentParagraph / paragraphs.length) * 100 : 0;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            Предпросмотр блога
          </ModalTitle>
          <Controls>
            <ControlButton onClick={handlePlay}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </ControlButton>
            <ControlButton className="secondary" onClick={handleReset}>
              <RotateCcw className="w-5 h-5" />
            </ControlButton>
            <ControlButton className="secondary" onClick={onClose}>
              <X className="w-5 h-5" />
            </ControlButton>
          </Controls>
        </ModalHeader>

        <ModalBody>
          <LeftPanel>
            <DynamicContent show={currentParagraph < paragraphs.length}>
              <ContentIcon type={getCurrentContent()?.state.type || null}>
                {getContentIcon(getCurrentContent()?.state.type || null)}
              </ContentIcon>
              <ContentTitle>
                {getContentTitle(getCurrentContent()?.state.type || null)}
              </ContentTitle>
              <ContentDescription>
                {getCurrentContent() ? getContentDescription(getCurrentContent()!) : 'Начните предпросмотр'}
              </ContentDescription>
            </DynamicContent>
            <ProgressBar>
              <ProgressFill progress={progress} />
            </ProgressBar>
          </LeftPanel>

          <RightPanel>
            <BlogTitle>{constructor.title}</BlogTitle>
            {constructor.preview && (
              <BlogPreview>{constructor.preview}</BlogPreview>
            )}

            {paragraphs.map((paragraph, index) => (
              <ParagraphContainer
                key={paragraph.id}
                visible={visibleParagraphs.includes(index)}
                delay={index * 200}
              >
                <ParagraphText>
                  {paragraph.text}
                </ParagraphText>

                {paragraph.photos.length > 0 && (
                  <ParagraphPhotos>
                    {paragraph.photos.map((photo, photoIndex) => (
                      <PhotoItem
                        key={photoIndex}
                        src={photo}
                        alt={`Фото ${photoIndex + 1}`}
                      />
                    ))}
                  </ParagraphPhotos>
                )}

                {paragraph.links.length > 0 && (
                  <ParagraphLinks>
                    {paragraph.links.map((link, linkIndex) => (
                      <LinkItem
                        key={linkIndex}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ссылка {linkIndex + 1}
                      </LinkItem>
                    ))}
                  </ParagraphLinks>
                )}
              </ParagraphContainer>
            ))}
          </RightPanel>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};

export default BlogPreviewModal;
