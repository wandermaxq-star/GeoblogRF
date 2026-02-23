import React from 'react';
import styled from 'styled-components';
import { PostDTO } from '../../types/post';
import { useFavorites } from '../../contexts/FavoritesContext';
import { MiniMapMarker, MiniMapRoute, MiniEventCard } from './LazyMiniComponents';
import { isGuidePost, parseGuideData } from '../../utils/postUtils';

const Container = styled.div`
  padding: 0 20px 16px;
`;

const Toc = styled.div`
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-bottom: 12px;
`;

const TocTitle = styled.div`
  font-weight: 600;
  color: #4a6fa5;
  margin-bottom: 8px;
`;

const TocList = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px 12px;
`;

const TocItem = styled.li`
  font-size: 13px;
  color: #374151;
`;

const Section = styled.div`
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
  background: #fff;
`;

const SectionTitle = styled.h4`
  font-size: 16px;
  font-weight: 700;
  color: #4a6fa5;
  margin: 0 0 8px 0;
`;

const SectionText = styled.p`
  font-size: 14px;
  color: #4a4a4a;
  line-height: 1.7;
  white-space: pre-wrap;
  margin: 0 0 8px 0;
`;

interface GuideInlineProps {
  post: PostDTO;
}

const GuideInline: React.FC<GuideInlineProps> = ({ post }) => {
  const favorites = useFavorites();
  if (!isGuidePost(post)) return null;
  const data = parseGuideData(post);
  if (!data) return null;

  return (
    <Container>
      {data.sections?.length > 0 && (
        <Toc>
          <TocTitle>Оглавление</TocTitle>
          <TocList>
            {data.sections.map((s: any, idx: number) => (
              <TocItem key={idx}>{idx + 1}. {s.title || `Секция ${idx + 1}`}</TocItem>
            ))}
          </TocList>
        </Toc>
      )}

      {data.sections.map((section: any, idx: number) => (
        <Section key={idx}>
          <SectionTitle>{section.title || `Секция ${idx + 1}`}</SectionTitle>
          {section.content && <SectionText>{section.content}</SectionText>}
          {section.hasMap && (
            section.routeId ? (
              <MiniMapRoute routeId={section.routeId} height="200px" />
            ) : section.markerId ? (
              <MiniMapMarker markerId={section.markerId} height="200px" />
            ) : section.eventId ? (
              <MiniEventCard eventId={section.eventId} height="200px" />
            ) : null
          )}
        </Section>
      ))}
    </Container>
  );
};

export default GuideInline;


