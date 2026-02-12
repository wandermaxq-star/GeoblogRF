import React from 'react';
import { FaMapMarkerAlt, FaRoute, FaCalendarAlt } from 'react-icons/fa';
import styled from 'styled-components';

// --- Типы ---

export type GeoRefType = 'marker' | 'route' | 'event';

export interface GeoRef {
  type: GeoRefType;
  id: string;
  title?: string;
}

// --- Конфигурация ---

const GEO_CONFIG: Record<GeoRefType, { icon: React.ReactNode; label: string }> = {
  marker: { icon: <FaMapMarkerAlt />, label: 'Место' },
  route:  { icon: <FaRoute />,        label: 'Маршрут' },
  event:  { icon: <FaCalendarAlt />,  label: 'Событие' },
};

// --- Styled ---

const BadgeWrapper = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-secondary, #8e8e8e);
  font-size: 14px;
  position: relative;
  transition: opacity 0.2s ease, transform 0.2s ease;

  /* Неактивные — почти невидимые */
  opacity: ${p => p.$active ? 0.85 : 0.12};
  cursor: ${p => p.$active ? 'pointer' : 'default'};
  pointer-events: ${p => p.$active ? 'auto' : 'none'};

  &:hover {
    opacity: 1;
    transform: scale(1.15);
  }
`;

const Tooltip = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 25, 0.9);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 100;

  ${BadgeWrapper}:hover & {
    opacity: 1;
  }
`;

// --- GeoBadge ---

interface GeoBadgeProps {
  type: GeoRefType;
  geoRef?: GeoRef | null;
  onClick?: (geoRef: GeoRef) => void;
}

const GeoBadge: React.FC<GeoBadgeProps> = ({ type, geoRef, onClick }) => {
  const isActive = !!geoRef;
  const config = GEO_CONFIG[type];

  const tooltipText = isActive
    ? `${config.label}: ${geoRef!.title || 'Без названия'}`
    : `Нет привязки: ${config.label}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive && onClick && geoRef) {
      onClick(geoRef);
    }
  };

  return (
    <BadgeWrapper $active={isActive} onClick={handleClick}>
      {config.icon}
      <Tooltip>{tooltipText}</Tooltip>
    </BadgeWrapper>
  );
};

// --- GeoBadgeList ---

const BadgeListWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
`;

interface GeoBadgeListProps {
  geoRefs: GeoRef[];
  onOpen?: (geoRef: GeoRef) => void;
}

const GEO_TYPES: GeoRefType[] = ['marker', 'route', 'event'];

export const GeoBadgeList: React.FC<GeoBadgeListProps> = ({ geoRefs, onOpen }) => {
  return (
    <BadgeListWrapper>
      {GEO_TYPES.map(type => {
        const ref = geoRefs.find(r => r.type === type) || null;
        return (
          <GeoBadge
            key={type}
            type={type}
            geoRef={ref}
            onClick={onOpen}
          />
        );
      })}
    </BadgeListWrapper>
  );
};

export default GeoBadge;
