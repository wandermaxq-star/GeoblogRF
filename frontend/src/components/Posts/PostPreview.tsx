import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Expand, Minimize2 } from 'lucide-react';
import { MiniMapMarker, MiniMapRoute, MiniEventCard } from './LazyMiniComponents';
import { GuideFormat } from './GuideFormatSelector';

type PostType = 'simple' | 'guide';
type HookType = 'route' | 'marker' | 'event' | null;

interface GuideSection {
  id: string;
  title: string;
  content: string;
  hasMap: boolean;
  routeId?: string;
  markerId?: string;
  eventId?: string;
}

interface PostPreviewProps {
  title: string;
  body: string;
  postType: PostType;
  hasHook?: boolean;
  hookType?: HookType;
  hookRouteId?: string | null;
  hookMarkerId?: string | null;
  hookEventId?: string | null;
  guideSections?: GuideSection[];
  guideFormat?: GuideFormat;
  photoPreviewUrls?: string[];
  mapBase?: 'opentopo' | 'alidade';
  onClose: () => void;
}

const PreviewOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const PreviewContainer = styled.div<{ expanded?: boolean }>`
  width: ${props => props.expanded ? '100%' : '90%'};
  max-width: ${props => props.expanded ? 'none' : '1200px'};
  height: ${props => props.expanded ? '100%' : '90%'};
  max-height: ${props => props.expanded ? 'none' : '800px'};
  background: white;
  border-radius: ${props => props.expanded ? '0' : '16px'};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.3s ease-out;
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const PreviewHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

const PreviewTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const ActionButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
`;

const PreviewContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #f8f9fa;
        `;

// Стили для простого поста
const SimplePostContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
  background: white;
`;

const SimplePostTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 20px;
  color: #1a1a1a;
  line-height: 1.2;
        `;

const SimplePostBody = styled.div`
  font-size: 1.1rem;
  line-height: 1.8;
  color: #4a4a4a;
  margin-bottom: 30px;
  white-space: pre-wrap;
        `;

// Стили для путеводителя
const GuideContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  background: white;
        `;

const GuideHeader = styled.div`
  background: linear-gradient(135deg, #4a6fa5 0%, #6b8cae 100%);
          color: white;
  padding: 40px;
          text-align: center;
        `;

const GuideTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 15px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
`;

const GuideMeta = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  opacity: 0.9;
  font-size: 1.1rem;
  margin-top: 15px;
`;

const GuideIntroduction = styled.div`
  padding: 40px;
  background: #f8f9fa;
  border-bottom: 2px solid #6b8cae;
`;

const GuideIntroductionText = styled.p`
  font-size: 1.1rem;
  line-height: 1.8;
  color: #4a4a4a;
  text-align: justify;
  white-space: pre-wrap;
`;

const TocContainer = styled.div`
  background: #f8f9fa;
  padding: 30px 40px;
  border-bottom: 2px solid #6b8cae;
`;

const TocTitle = styled.h2`
  font-size: 1.8rem;
  color: #4a6fa5;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TocList = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const TocItem = styled.li`
  padding: 15px;
  background: white;
  border-radius: 12px;
  border-left: 4px solid #e74c3c;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:hover {
    transform: translateX(5px);
    border-left-color: #4a6fa5;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }
`;

const SectionContainer = styled.div`
  padding: 40px;
  border-bottom: 1px solid #e5e7eb;
  
  &:last-child {
    border-bottom: none;
  }
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  color: #4a6fa5;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SectionContent = styled.p`
  font-size: 1.1rem;
  line-height: 1.8;
  color: #4a4a4a;
  margin-bottom: 25px;
  text-align: justify;
  white-space: pre-wrap;
`;

const SectionMap = styled.div`
  margin-top: 25px;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  height: 400px;
`;

const HookContainer = styled.div`
  margin-top: 30px;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  height: 400px;
`;

const PostPreview: React.FC<PostPreviewProps> = ({
  title,
  body,
  postType,
  hasHook = false,
  hookType = null,
  hookRouteId = null,
  hookMarkerId = null,
  hookEventId = null,
  guideSections = [],
  guideFormat = 'desktop',
  photoPreviewUrls = [],
  mapBase = 'opentopo',
  onClose
}) => {
  const [expanded, setExpanded] = useState(false);

  const renderSimplePost = () => (
    <SimplePostContainer>
      {title && <SimplePostTitle>{title}</SimplePostTitle>}
      <SimplePostBody>{body || 'Введите текст поста...'}</SimplePostBody>
      {Array.isArray(photoPreviewUrls) && photoPreviewUrls.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : photoPreviewUrls.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24
        }}>
          {photoPreviewUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`Фото ${idx + 1}`}
              style={{ width: '100%', height: photoPreviewUrls.length === 1 ? 360 : 180, objectFit: 'cover', borderRadius: 12 }}
            />
          ))}
          </div>
      )}
      {hasHook && hookType === 'route' && hookRouteId && (
        <HookContainer>
          <MiniMapRoute routeId={hookRouteId} height="400px" />
        </HookContainer>
      )}
      {hasHook && hookType === 'marker' && hookMarkerId && (
        <HookContainer>
          <MiniMapMarker markerId={hookMarkerId} height="400px" />
        </HookContainer>
      )}
      {hasHook && hookType === 'event' && hookEventId && (
        <HookContainer>
          <MiniEventCard eventId={hookEventId} height="400px" />
        </HookContainer>
      )}
    </SimplePostContainer>
        );
      
  // Собираем все крючки контента из секций для мобильной версии
  const collectAllHooks = () => {
    const markers: string[] = [];
    const routes: string[] = [];
    const events: string[] = [];
    
    guideSections.forEach(section => {
      if (section.hasMap) {
        if (section.markerId) markers.push(section.markerId);
        if (section.routeId) routes.push(section.routeId);
        if (section.eventId) events.push(section.eventId);
      }
    });
    
    return { markers, routes, events };
  };

  const renderGuide = () => {
    // Рендерим в зависимости от формата
    switch (guideFormat) {
      case 'mobile':
        return renderMobileGuide();
      case 'desktop':
        return renderDesktopGuide();
      case 'article':
        return renderArticleGuide();
      case 'focus':
        return renderFocusGuide();
      default:
        return renderDesktopGuide();
    }
  };

  const renderMobileGuide = () => {
    const hooks = collectAllHooks();
    const hasAnyHooks = hooks.markers.length > 0 || hooks.routes.length > 0 || hooks.events.length > 0;

  return (
      <GuideContainer style={{ maxWidth: '100%', padding: 0 }}>
        {/* Заголовок - компактный */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 10px 0' }}>
            {title || 'Путеводитель'}
          </h1>
          <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: 0 }}>
            {new Date().toLocaleDateString('ru-RU')}
          </p>
        </div>

        {/* Карта - на весь экран, если есть крючки */}
        {hasAnyHooks && (
          <div style={{ height: '400px', width: '100%', background: '#1a1a1a', position: 'relative' }}>
            {hooks.routes.length > 0 && (
              <MiniMapRoute routeId={hooks.routes[0]} height="400px" glBase={mapBase} />
            )}
            {hooks.routes.length === 0 && hooks.markers.length > 0 && (
              <MiniMapMarker markerId={hooks.markers[0]} height="400px" glBase={mapBase} />
            )}
            {hooks.routes.length === 0 && hooks.markers.length === 0 && hooks.events.length > 0 && (
              <MiniEventCard eventId={hooks.events[0]} height="400px" />
            )}
          </div>
        )}

        {/* Вступление - краткое */}
        {body && (
          <div style={{ padding: '16px', background: '#f8f9fa' }}>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#4a4a4a', margin: 0 }}>
              {body}
            </p>
          </div>
        )}

        {/* Фото галерея */}
        {photoPreviewUrls && photoPreviewUrls.length > 0 && (
          <div style={{ padding: '16px', background: 'white' }}>
              <div style={{
              display: 'grid',
              gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : photoPreviewUrls.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '8px'
            }}>
              {photoPreviewUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Фото ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: photoPreviewUrls.length === 1 ? '200px' : '120px',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Секции - компактные карточки */}
        <div style={{ padding: '16px', background: '#f8f9fa' }}>
          {guideSections.map((section, idx) => (
            <div
              key={section.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#1a1a1a',
                margin: '0 0 8px 0'
              }}>
                {section.title || `Секция ${idx + 1}`}
              </h3>
              {section.content && (
                <p style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  color: '#4a4a4a',
                  margin: '0 0 12px 0'
                }}>
                  {section.content}
                </p>
              )}
              {section.hasMap && section.markerId && (
                <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                  <MiniMapMarker markerId={section.markerId} height="150px" glBase={mapBase} />
                </div>
              )}
              {section.hasMap && section.routeId && (
                <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                  <MiniMapRoute routeId={section.routeId} height="150px" glBase={mapBase} />
                </div>
              )}
              {section.hasMap && section.eventId && (
                <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                  <MiniEventCard eventId={section.eventId} height="150px" />
              </div>
            )}
            </div>
          ))}
        </div>
      </GuideContainer>
    );
  };

  const renderDesktopGuide = () => (
    <GuideContainer>
      <GuideHeader>
        <GuideTitle>{title || 'Путеводитель'}</GuideTitle>
        <GuideMeta>
          <span>📍 ГеоБлог.рф</span>
          <span>📅 {new Date().toLocaleDateString('ru-RU')}</span>
        </GuideMeta>
      </GuideHeader>
      
      {body && (
        <GuideIntroduction>
          <GuideIntroductionText>{body}</GuideIntroductionText>
        </GuideIntroduction>
      )}

      {/* Фото галерея */}
      {photoPreviewUrls && photoPreviewUrls.length > 0 && (
        <div style={{ padding: '40px', background: 'white', borderBottom: '2px solid #6b8cae' }}>
              <div style={{
            display: 'grid',
            gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : photoPreviewUrls.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {photoPreviewUrls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Фото ${idx + 1}`}
                style={{
                  width: '100%',
                  height: photoPreviewUrls.length === 1 ? '400px' : '250px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
            ))}
          </div>
              </div>
            )}
      
      {guideSections.length > 0 && (
        <TocContainer>
          <TocTitle>📑 Оглавление</TocTitle>
          <TocList>
            {guideSections.map((section, idx) => (
              <TocItem key={section.id}>
                {idx + 1}. {section.title || `Секция ${idx + 1}`}
              </TocItem>
            ))}
          </TocList>
        </TocContainer>
      )}
      
      {guideSections.map((section, idx) => (
        <SectionContainer key={section.id} id={`section-${idx}`}>
          <SectionTitle>
            {section.title || `Секция ${idx + 1}`}
          </SectionTitle>
          {section.content && (
            <SectionContent>{section.content}</SectionContent>
          )}
          {section.hasMap && section.routeId && (
            <SectionMap>
              <MiniMapRoute routeId={section.routeId} height="400px" glBase={mapBase} />
            </SectionMap>
          )}
          {section.hasMap && section.markerId && (
            <SectionMap>
              <MiniMapMarker markerId={section.markerId} height="400px" glBase={mapBase} />
            </SectionMap>
          )}
          {section.hasMap && section.eventId && (
            <SectionMap>
              <MiniEventCard eventId={section.eventId} height="400px" />
            </SectionMap>
          )}
        </SectionContainer>
      ))}
    </GuideContainer>
  );

  const renderArticleGuide = () => (
    <GuideContainer style={{ maxWidth: '900px', margin: '0 auto', padding: '40px' }}>
      <div style={{ borderLeft: '4px solid #3b82f6', paddingLeft: '20px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 10px 0', color: '#1a1a1a' }}>
          {title || 'Путеводитель'}
        </h1>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          <span>ГеоБлог.рф</span> • <span>{new Date().toLocaleDateString('ru-RU')}</span>
        </div>
          </div>
          
      {body && (
        <div style={{ marginBottom: '40px', fontSize: '1.1rem', lineHeight: 1.8, color: '#4a4a4a' }}>
          {body}
        </div>
      )}

      {/* Фото галерея */}
      {photoPreviewUrls && photoPreviewUrls.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: photoPreviewUrls.length === 1 ? '1fr' : '1fr 1fr',
            gap: '20px'
          }}>
            {photoPreviewUrls.map((url, idx) => (
              <div key={idx}>
                <img
                  src={url}
                  alt={`Фото ${idx + 1}`}
              style={{ 
                    width: '100%',
                    height: '300px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {guideSections.map((section, idx) => (
        <div key={section.id} style={{ marginBottom: '50px' }}>
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: '20px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '10px'
          }}>
            {section.title || `Секция ${idx + 1}`}
          </h2>
          {section.content && (
            <div style={{ fontSize: '1.05rem', lineHeight: 1.8, color: '#4a4a4a', marginBottom: '25px' }}>
              {section.content}
            </div>
          )}
          {section.hasMap && section.routeId && (
            <div style={{ marginTop: '25px', borderRadius: '8px', overflow: 'hidden', height: '400px' }}>
              <MiniMapRoute routeId={section.routeId} height="400px" glBase={mapBase} />
            </div>
          )}
          {section.hasMap && section.markerId && (
            <div style={{ marginTop: '25px', borderRadius: '8px', overflow: 'hidden', height: '400px' }}>
              <MiniMapMarker markerId={section.markerId} height="400px" glBase={mapBase} />
            </div>
          )}
          {section.hasMap && section.eventId && (
            <div style={{ marginTop: '25px', borderRadius: '8px', overflow: 'hidden', height: '400px' }}>
              <MiniEventCard eventId={section.eventId} height="400px" />
            </div>
          )}
        </div>
      ))}
    </GuideContainer>
  );

  const renderFocusGuide = () => (
    <GuideContainer style={{ maxWidth: '800px', margin: '0 auto', padding: '30px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white',
        padding: '30px',
        borderRadius: '16px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 10px 0' }}>
          {title || 'Фокус-гайд'}
        </h1>
        <p style={{ fontSize: '1rem', opacity: 0.9, margin: 0 }}>
          Только самое важное
        </p>
      </div>

      {body && (
        <div style={{
          background: '#fff7ed',
          border: '2px solid #f97316',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#9a3412', margin: 0 }}>
            {body}
          </p>
        </div>
      )}

      {/* Фото - только первое, если есть */}
      {photoPreviewUrls && photoPreviewUrls.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <img
            src={photoPreviewUrls[0]}
            alt="Главное фото"
            style={{
              width: '100%',
              height: '300px',
              objectFit: 'cover',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          />
        </div>
      )}

      {guideSections.map((section, idx) => (
        <div
          key={section.id}
          style={{
            background: 'white',
            border: '2px solid #f97316',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <div style={{ fontSize: '1.5rem' }}>✅</div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 8px 0'
              }}>
                {section.title || `Ключевой пункт ${idx + 1}`}
              </h3>
              {section.content && (
                <p style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  color: '#4a4a4a',
                  margin: '0 0 12px 0'
                }}>
                  {section.content}
                </p>
              )}
              {section.hasMap && section.markerId && (
                <div style={{ height: '200px', borderRadius: '8px', overflow: 'hidden', marginTop: '12px' }}>
                  <MiniMapMarker markerId={section.markerId} height="200px" glBase={mapBase} />
                </div>
              )}
              {section.hasMap && section.routeId && (
                <div style={{ height: '200px', borderRadius: '8px', overflow: 'hidden', marginTop: '12px' }}>
                  <MiniMapRoute routeId={section.routeId} height="200px" glBase={mapBase} />
                </div>
              )}
              {section.hasMap && section.eventId && (
                <div style={{ height: '200px', borderRadius: '8px', overflow: 'hidden', marginTop: '12px' }}>
                  <MiniEventCard eventId={section.eventId} height="200px" />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </GuideContainer>
  );

  return (
    <PreviewOverlay onClick={onClose}>
      <PreviewContainer expanded={expanded} onClick={(e) => e.stopPropagation()}>
        <PreviewHeader>
          <PreviewTitle>Предпросмотр поста</PreviewTitle>
          <HeaderActions>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              title={expanded ? 'Уменьшить' : 'Увеличить'}
            >
              {expanded ? <Minimize2 size={18} /> : <Expand size={18} />}
            </ActionButton>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Закрыть"
            >
              <X size={18} />
            </ActionButton>
          </HeaderActions>
        </PreviewHeader>
        
        <PreviewContent>
          {postType === 'simple' ? renderSimplePost() : renderGuide()}
        </PreviewContent>
      </PreviewContainer>
    </PreviewOverlay>
  );
};

export default PostPreview;
