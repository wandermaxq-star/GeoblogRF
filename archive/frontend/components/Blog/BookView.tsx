import React, { useEffect, useState, lazy, Suspense } from 'react';
import { PostMap } from '../Maps/PostMap';
import styled, { css, keyframes } from 'styled-components';
import { ChevronLeft, ChevronRight, Star, Heart, BookOpen } from 'lucide-react';
import { Book } from '../../types/blog';
import MiniMapMarker from '../Posts/MiniMapMarker';
import MiniMapRoute from '../Posts/MiniMapRoute';
import MiniEventCard from '../Posts/MiniEventCard';

// Ленивая загрузка тяжелых компонентов
// Заменяем старые SimplifiedMap/SimplifiedPlanner на фасадные компоненты
const LazySimplifiedCalendar = lazy(() => import('./SimplifiedCalendar'));

interface BookViewProps {
  book: Book;
  onClose: () => void;
  onRate?: (rating: number) => void;
  onToggleFavorite?: () => void;
  onComment?: (content: string) => void;
}

const BookContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  perspective: 1200px;
`;

const BookWrapper = styled.div`
  width: 90vw;
  max-width: 1400px;
  height: 80vh;
  display: flex;
  position: relative;
  /* Убираем изогнутость - книга лежит ровно */
  transform: none;
  transition: box-shadow 0.3s ease;
  
  &:hover {
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  }
`;

const BookCover = styled.div`
  position: absolute;
  inset: -8px;
  background: 
    linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%),
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(0,0,0,0.1) 0%, transparent 50%);
  border-radius: 25px;
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.4),
    inset 0 2px 0 rgba(255, 255, 255, 0.1),
    inset 0 -2px 0 rgba(0, 0, 0, 0.1);
  z-index: -1;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 1px,
        rgba(255,255,255,0.03) 1px,
        rgba(255,255,255,0.03) 2px
      );
    border-radius: 25px;
  }
`;

const BookPages = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  background: #fff;
  border-radius: 20px;
  box-shadow: 
    0 15px 50px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  overflow: hidden;
  position: relative;
  
  /* Текстура бумаги */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 30% 30%, rgba(0,0,0,0.02) 0%, transparent 50%),
      radial-gradient(circle at 70% 70%, rgba(0,0,0,0.02) 0%, transparent 50%),
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 24px,
        rgba(0,0,0,0.02) 24px,
        rgba(0,0,0,0.02) 25px
      );
    pointer-events: none;
    z-index: 1;
  }
`;

/* Торцы страниц для имитации «толстой» книги */
const PageEdgeLeft = styled.div`
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: -10px;
  width: 18px;
  background:
    repeating-linear-gradient(
      90deg,
      #f7f7f7 0px,
      #f7f7f7 2px,
      #e9e9e9 2px,
      #e9e9e9 3px
    );
  box-shadow:
    inset -6px 0 8px rgba(0,0,0,0.15),
    0 12px 24px rgba(0,0,0,0.15);
  border-radius: 14px 0 0 14px;
  z-index: 0;
`;

const PageEdgeRight = styled.div`
  position: absolute;
  top: -6px;
  bottom: -6px;
  right: -10px;
  width: 18px;
  background:
    repeating-linear-gradient(
      90deg,
      #f7f7f7 0px,
      #f7f7f7 2px,
      #e9e9e9 2px,
      #e9e9e9 3px
    );
  box-shadow:
    inset 6px 0 8px rgba(0,0,0,0.15),
    0 12px 24px rgba(0,0,0,0.15);
  border-radius: 0 14px 14px 0;
  z-index: 0;
`;

const pageFlipNext = keyframes`
  0% { transform: rotateY(0deg); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
  50% { transform: rotateY(-12deg); box-shadow: inset -20px 0 40px rgba(0,0,0,0.15); }
  100% { transform: rotateY(0deg); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
`;

const pageFlipPrev = keyframes`
  0% { transform: rotateY(0deg); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
  50% { transform: rotateY(12deg); box-shadow: inset 20px 0 40px rgba(0,0,0,0.15); }
  100% { transform: rotateY(0deg); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
`;

const LeftPage = styled.div<{ $flip?: 'next' | 'prev' | null }>`
  flex: 1;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-right: 2px solid #dee2e6;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
  transform-origin: right center;
  ${(p) => p.$flip === 'prev' && css`animation: ${pageFlipPrev} 450ms ease;`}
`;

const RightPage = styled.div<{ $flip?: 'next' | 'prev' | null }>`
  flex: 1;
  background: #fff;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 20%, rgba(0, 0, 0, 0.02) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.02) 0%, transparent 50%);
    pointer-events: none;
  }
  transform-origin: left center;
  ${(p) => p.$flip === 'next' && css`animation: ${pageFlipNext} 450ms ease;`}
`;

const BookSpine = styled.div`
  width: 32px;
  background: 
    linear-gradient(90deg, #1a1a1a 0%, #2c2c2c 20%, #1a1a1a 50%, #2c2c2c 80%, #1a1a1a 100%),
    radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 70%);
  box-shadow: 
    inset -2px 0 4px rgba(0,0,0,0.3),
    inset 2px 0 4px rgba(255,255,255,0.1),
    0 0 20px rgba(0,0,0,0.2);
  position: relative;
  border-radius: 0 4px 4px 0;
  
  &::before {
    content: '';
    position: absolute;
    top: 20px;
    bottom: 20px;
    left: 50%;
    width: 1px;
    transform: translateX(-0.5px);
    background: linear-gradient(to bottom, 
      transparent 0%, 
      rgba(255,255,255,0.1) 20%, 
      rgba(255,255,255,0.2) 50%, 
      rgba(255,255,255,0.1) 80%, 
      transparent 100%
    );
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    background: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 2px,
        rgba(0,0,0,0.1) 2px,
        rgba(0,0,0,0.1) 3px
      );
    border-radius: 0 4px 4px 0;
  }
`;

const CornerHover = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 120px;
  height: 120px;
  background: 
    radial-gradient(ellipse at bottom right, rgba(0,0,0,0.12), transparent 70%),
    linear-gradient(135deg, transparent 0%, rgba(102, 126, 234, 0.1) 100%);
  clip-path: polygon(35% 0%, 100% 0%, 100% 100%, 0% 35%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  pointer-events: auto;
  cursor: pointer;
  z-index: 10;

  ${RightPage}:hover & {
    opacity: 1;
    transform: scale(1.05);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background: rgba(102, 126, 234, 0.3);
    border-radius: 50%;
    opacity: 0;
    transition: all 0.3s ease;
  }
  
  &:hover::before {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
`;

const PageHeader = styled.div`
  padding: 30px 40px 20px;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
`;

const BookTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const BookMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  color: #6c757d;
  font-size: 0.9rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  color: #ffc107;
`;

const InteractiveContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  overflow: hidden;
  background: #f8f9fa;
  border-radius: 8px;
  position: relative;
`;

const ContentPlaceholder = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 15px;
  border: 2px dashed #dee2e6;
  color: #6c757d;
  font-size: 1.1rem;
  text-align: center;
  padding: 40px;
`;

const TextContent = styled.div`
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  line-height: 1.8;
  font-size: 1.1rem;
  color: #2c3e50;
`;

const Paragraph = styled.div`
  margin-bottom: 30px;
  padding: 20px;
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  border-left: 4px solid #667eea;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateX(5px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }
`;

const ParagraphText = styled.p`
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  line-height: 1.8;
`;

const ParagraphImage = styled.img`
  width: 100%;
  max-width: 400px;
  height: auto;
  border-radius: 10px;
  margin: 15px 0;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s ease;
  
  &:hover {
    transform: scale(1.02);
  }
`;

const NavigationControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 40px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-top: 1px solid #dee2e6;
`;

const NavButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const PageIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6c757d;
  font-size: 0.9rem;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: #fff;
    transform: scale(1.1);
  }
`;

const BookView: React.FC<BookViewProps> = ({ 
  book, 
  onClose
}) => {
  const [currentBlogIndex, setCurrentBlogIndex] = useState(0);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  // const [currentRating] = useState(0);
  const [flip, setFlip] = useState<null | 'next' | 'prev'>(null);

  const computeBookRating = () => {
    const scores: number[] = (book.blogs || [])
      .map((b: any) => (typeof b.rating === 'number' ? b.rating : (typeof b.quality_score === 'number' ? b.quality_score : null)))
      .filter((v: any) => typeof v === 'number');
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { value: avg, count: scores.length };
    }
    return { value: book.rating, count: book.ratings_count };
  };

  // NOTE: оставлено на будущее (например, для fallback-поиска по названию),
  // но не используем напрямую — берём id сразу из хука абзаца

  const currentBlog = book.blogs[currentBlogIndex];
  const currentParagraph = currentBlog?.constructor_data?.paragraphs?.[currentParagraphIndex];

  // Автовыбор первого абзаца с хукoм при смене блога
  useEffect(() => {
    const paragraphs: any[] = currentBlog?.constructor_data?.paragraphs || [];
    if (!paragraphs.length) return;
    const idxWithHook = paragraphs.findIndex((p: any) => p?.state?.type);
    if (idxWithHook >= 0) setCurrentParagraphIndex(idxWithHook);
    else setCurrentParagraphIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlogIndex]);

  const handleNext = () => {
    setFlip('next');
    if (currentParagraphIndex < (currentBlog?.constructor_data?.paragraphs?.length || 0) - 1) {
      setCurrentParagraphIndex(prev => prev + 1);
    } else if (currentBlogIndex < book.blogs.length - 1) {
      setCurrentBlogIndex(prev => prev + 1);
      setCurrentParagraphIndex(0);
    }
    setTimeout(() => setFlip(null), 460);
  };

  const handlePrev = () => {
    setFlip('prev');
    if (currentParagraphIndex > 0) {
      setCurrentParagraphIndex(prev => prev - 1);
    } else if (currentBlogIndex > 0) {
      setCurrentBlogIndex(prev => prev - 1);
      const prevBlog = book.blogs[currentBlogIndex - 1];
      setCurrentParagraphIndex((prevBlog?.constructor_data?.paragraphs?.length || 1) - 1);
    }
    setTimeout(() => setFlip(null), 460);
  };

  const renderInteractiveContent = () => {
    if (!currentParagraph?.state?.type || !currentParagraph?.state?.data) {
      return null;
    }

    const { type, data } = currentParagraph.state;

    switch (type) {
      case 'marker': {
        // Проверяем разные варианты ID
        let markerId: string | null = null;
        
        if (typeof data === 'string') {
          markerId = data;
        } else if (data && typeof data === 'object') {
          // Пробуем разные варианты полей
          markerId = (data as any).id || (data as any).marker_id || (data as any).markerId;
        }
        
        if (!markerId) {
          return null;
        }
        
        return (
          <div style={{ 
            width: '100%', 
            height: '400px', 
            minHeight: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            backgroundColor: '#f8f9fa'
          }}>
            <MiniMapMarker markerId={String(markerId)} height="400px" />
          </div>
        );
      }

      case 'route': {
        let routeId: string | null = null;
        
        if (typeof data === 'string') {
          routeId = data;
        } else if (data && typeof data === 'object') {
          routeId = (data as any).id || (data as any).route_id || (data as any).routeId;
        }
        
        if (!routeId) {
          return null;
        }
        return (
          <div style={{ 
            width: '100%', 
            height: '400px', 
            minHeight: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <MiniMapRoute routeId={String(routeId)} height="400px" />
          </div>
        );
      }

      case 'event': {
        const eventId = data?.id || data?.event_id || (typeof data === 'string' ? data : null);
        if (!eventId) {
          return null;
        }
        return (
          <div style={{ 
            width: '100%', 
            height: '400px', 
            minHeight: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <MiniEventCard eventId={String(eventId)} height="400px" />
          </div>
        );
      }

      default:
        return null;
    }
  };

  const canGoNext = currentBlogIndex < book.blogs.length - 1 || 
    currentParagraphIndex < (currentBlog?.constructor_data?.paragraphs?.length || 0) - 1;
  
  const canGoPrev = currentBlogIndex > 0 || currentParagraphIndex > 0;

  return (
    <BookContainer>
      <CloseButton onClick={onClose}>
        ×
      </CloseButton>
      
      <BookWrapper>
        <BookCover />
        
        <BookPages>
          <PageEdgeLeft />
          <LeftPage $flip={flip}>
            <PageHeader>
              <BookTitle>{book.title}</BookTitle>
              <BookMeta>
                <MetaItem>
                  <BookOpen size={16} />
                  {book.blogs.length} блогов
                </MetaItem>
                <Rating>
                  <Star size={16} fill="currentColor" />
                  {computeBookRating().value.toFixed(1)} ({computeBookRating().count})
                </Rating>
                <MetaItem>
                  <Heart size={16} />
                  {book.likes_count}
                </MetaItem>
              </BookMeta>
            </PageHeader>
            
            <InteractiveContent>
              {(() => {
                const content = renderInteractiveContent();
                if (content) {
                  return content;
                }
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#999',
                    fontSize: '14px',
                    opacity: 0.5,
                    padding: '20px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div>Интерактивный контент</div>
                      <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                        {!currentParagraph?.state?.type ? 'Добавьте крючок к абзацу' : 'Нет данных для отображения'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </InteractiveContent>
          </LeftPage>

          <BookSpine />

          <RightPage $flip={flip}>
            <PageHeader>
              <BookTitle>{currentBlog?.title || 'Выберите блог'}</BookTitle>
              <BookMeta>
                <MetaItem>
                  Абзац {currentParagraphIndex + 1} из {currentBlog?.constructor_data?.paragraphs?.length || 0}
                </MetaItem>
              </BookMeta>
            </PageHeader>

            <TextContent>
              {currentParagraph ? (
                <Paragraph>
                  {/* Отображаем текст абзаца - ТОЛЬКО пользовательский текст повествования */}
                  {(() => {
                    const paragraphText = (currentParagraph.text || '').trim();
                    const hookData = currentParagraph.state?.data;
                    
                    // КРИТИЧЕСКИ ВАЖНО: Если есть метка в state - ВСЕГДА проверяем текст на наличие данных метки
                    // Если текст содержит ЛЮБУЮ информацию о метке - скрываем весь текст полностью
                    if (hookData && paragraphText) {
                      // Получаем все возможные данные о метке/маршруте/событии
                      const hookTitle = String((hookData as any).title || (hookData as any).name || '').trim();
                      const hookDescription = String((hookData as any).description || '').trim();
                      const hookCategory = String((hookData as any).category || '').trim();
                      
                      // СТРОГАЯ ПРОВЕРКА: Если текст содержит описание метки - СКРЫВАЕМ ВЕСЬ ТЕКСТ
                      if (hookDescription && hookDescription.length > 0) {
                        // Если текст полностью совпадает с описанием метки - скрываем
                        if (paragraphText === hookDescription) {
                          return (
                            <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                              Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                            </ParagraphText>
                          );
                        }
                        
                        // Если текст содержит описание метки - проверяем, является ли это основным содержанием
                        if (paragraphText.includes(hookDescription)) {
                          // Вычисляем процент совпадения
                          const descriptionLength = hookDescription.length;
                          const textLength = paragraphText.length;
                          
                          // Если описание метки составляет больше 50% текста - это данные метки, скрываем
                          // Или если после удаления описания метки осталось меньше 20 символов - скрываем
                          const textWithoutDescription = paragraphText.replace(hookDescription, '').trim();
                          if ((descriptionLength / textLength) * 100 > 50 || textWithoutDescription.length < 20) {
                            return (
                              <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                                Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                              </ParagraphText>
                            );
                          }
                        }
                        
                        // Дополнительная проверка: если текст начинается с описания метки - скрываем
                        if (paragraphText.startsWith(hookDescription)) {
                          return (
                            <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                              Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                            </ParagraphText>
                          );
                        }
                      }
                      
                      // СТРОГАЯ ПРОВЕРКА: Если текст содержит название метки - скрываем
                      if (hookTitle && hookTitle.length > 0) {
                        if (paragraphText === hookTitle || paragraphText.includes(hookTitle)) {
                          // Если текст состоит только из названия или название - основная часть - скрываем
                          const titleLength = hookTitle.length;
                          const textLength = paragraphText.length;
                          if (paragraphText === hookTitle || (textLength - titleLength < 20)) {
                            return (
                              <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                                Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                              </ParagraphText>
                            );
                          }
                        }
                      }
                      
                      // СТРОГАЯ ПРОВЕРКА: Если текст содержит категорию метки - скрываем
                      if (hookCategory && hookCategory.length > 0) {
                        if (paragraphText.includes(`Категория: ${hookCategory}`) || 
                            paragraphText.includes(`Категория:${hookCategory}`) ||
                            paragraphText.toLowerCase().includes(hookCategory.toLowerCase())) {
                          return (
                            <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                              Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                            </ParagraphText>
                          );
                        }
                      }
                    }
                    
                    // Проверяем на автоматически сгенерированные маркеры (эмодзи, markdown)
                    if (paragraphText.includes('📍') || 
                        paragraphText.includes('🛣️') || 
                        paragraphText.includes('📅') ||
                        paragraphText.includes('**') ||
                        paragraphText.match(/Категория:\s*\w+/i)) {
                      return (
                        <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                          Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                        </ParagraphText>
                      );
                    }
                    
                    // Если текст прошел все проверки - это пользовательский текст, показываем его
                    if (paragraphText) {
                      // Убираем markdown форматирование
                      const cleanText = paragraphText
                        .replace(/\*\*(.*?)\*\*/g, '$1')
                        .replace(/\*(.*?)\*/g, '$1')
                        .trim();
                      
                      if (cleanText) {
                        return <ParagraphText>{cleanText}</ParagraphText>;
                      }
                    }
                    
                    // Если нет пользовательского текста - показываем плейсхолдер
                    return (
                      <ParagraphText style={{ color: '#999', fontStyle: 'italic' }}>
                        Нет описания для этого абзаца. Добавьте текст повествования в конструкторе блога.
                      </ParagraphText>
                    );
                  })()}
                  
                  {/* Фото абзаца */}
                  {currentParagraph.photos && currentParagraph.photos.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      {currentParagraph.photos.map((photo: string, index: number) => (
                        <ParagraphImage 
                          key={index} 
                          src={typeof photo === 'string' ? photo : (photo as any)?.url || ''} 
                          alt={`Фото ${index + 1}`}
                          onClick={() => {/* TODO: Открыть модальное окно */}}
                        />
                      ))}
                    </div>
                  )}
                </Paragraph>
              ) : (
                <Paragraph>
                  <ParagraphText>Выберите блог для просмотра</ParagraphText>
                </Paragraph>
              )}
            </TextContent>

            <NavigationControls>
              <NavButton onClick={handlePrev} disabled={!canGoPrev}>
                <ChevronLeft size={20} />
                Назад
              </NavButton>
              
              <PageIndicator>
                Блог {currentBlogIndex + 1} из {book.blogs.length}
              </PageIndicator>
              
              <NavButton onClick={handleNext} disabled={!canGoNext}>
                Далее
                <ChevronRight size={20} />
              </NavButton>
            </NavigationControls>

            {/* Активная зона в углу для жеста "подгиб/перелистнуть" */}
            <CornerHover onMouseEnter={() => setFlip('next')} onMouseLeave={() => setFlip(null)} onClick={handleNext} />
          </RightPage>
          <PageEdgeRight />
        </BookPages>
      </BookWrapper>
    </BookContainer>
  );
};

export default BookView;

