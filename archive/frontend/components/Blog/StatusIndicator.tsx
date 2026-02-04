import React from 'react';
import styled from 'styled-components';
import { Check, MapPin, Navigation, Calendar, Type } from 'lucide-react';
import { StateType } from '../../types/blog';

interface StatusIndicatorProps {
  stateType: StateType;
  hasAttachedElement: boolean;
  elementName?: string;
  className?: string;
}

const IndicatorContainer = styled.div<{ hasAttached: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 100%;
  background: ${({ hasAttached }) => 
    hasAttached 
      ? 'linear-gradient(135deg, #10b981, #059669)' 
      : 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
  };
  border-radius: 12px 0 0 12px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &.w-12 {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  &.h-12 {
    height: 48px;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${({ hasAttached }) => 
      hasAttached 
        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))'
        : 'transparent'
    };
    border-radius: 12px 0 0 12px;
  }

  &.w-12::before {
    border-radius: 12px;
  }
`;

const IconContainer = styled.div<{ hasAttached: boolean; stateType: StateType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${({ hasAttached, stateType }) => {
    if (hasAttached) {
      return 'rgba(255, 255, 255, 0.9)';
    }
    
    switch (stateType) {
      case 'marker':
        return 'rgba(34, 197, 94, 0.2)';
      case 'route':
        return 'rgba(59, 130, 246, 0.2)';
      case 'event':
        return 'rgba(249, 115, 22, 0.2)';
      default:
        return 'rgba(107, 114, 128, 0.2)';
    }
  }};
  color: ${({ hasAttached, stateType }) => {
    if (hasAttached) {
      return '#059669';
    }
    
    switch (stateType) {
      case 'marker':
        return '#22c55e';
      case 'route':
        return '#3b82f6';
      case 'event':
        return '#f97316';
      default:
        return '#6b7280';
    }
  }};
  transition: all 0.3s ease;
  position: relative;
  z-index: 2;

  .w-12 & {
    width: 24px;
    height: 24px;
  }
`;

const StatusText = styled.div<{ hasAttached: boolean }>`
  font-size: 10px;
  font-weight: 600;
  color: ${({ hasAttached }) => hasAttached ? '#ffffff' : '#6b7280'};
  margin-top: 4px;
  text-align: center;
  line-height: 1.2;
  position: relative;
  z-index: 2;

  .w-12 & {
    font-size: 8px;
    margin-top: 2px;
  }
`;

const ElementName = styled.div<{ hasAttached: boolean }>`
  font-size: 8px;
  color: ${({ hasAttached }) => hasAttached ? 'rgba(255, 255, 255, 0.8)' : '#9ca3af'};
  margin-top: 2px;
  text-align: center;
  line-height: 1.1;
  max-width: 50px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  z-index: 2;

  .w-12 & {
    font-size: 6px;
    max-width: 40px;
    margin-top: 1px;
  }
`;

const PulseAnimation = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 2px solid rgba(16, 185, 129, 0.3);
  border-radius: 50%;
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.4);
      opacity: 0;
    }
  }
`;

const getStateIcon = (stateType: StateType, hasAttached: boolean, isCompact: boolean = false) => {
  const iconSize = isCompact ? "w-3 h-3" : "w-4 h-4";
  const checkSize = isCompact ? "w-3 h-3" : "w-5 h-5";
  
  if (hasAttached) {
    return <Check className={checkSize} />;
  }
  
  switch (stateType) {
    case 'marker':
      return <MapPin className={iconSize} />;
    case 'route':
      return <Navigation className={iconSize} />;
    case 'event':
      return <Calendar className={iconSize} />;
    default:
      return <Type className={iconSize} />;
  }
};

const getStateLabel = (stateType: StateType) => {
  switch (stateType) {
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

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  stateType,
  hasAttachedElement,
  elementName,
  className
}) => {
  const isCompact = className?.includes('w-12');
  
  return (
    <IndicatorContainer 
      hasAttached={hasAttachedElement} 
      className={className}
    >
      {hasAttachedElement && <PulseAnimation />}
      
      <IconContainer 
        hasAttached={hasAttachedElement} 
        stateType={stateType}
      >
        {getStateIcon(stateType, hasAttachedElement, isCompact)}
      </IconContainer>
      
      <StatusText hasAttached={hasAttachedElement}>
        {hasAttachedElement ? '✓' : getStateLabel(stateType)}
      </StatusText>
      
      {hasAttachedElement && elementName && !isCompact && (
        <ElementName hasAttached={hasAttachedElement}>
          {elementName}
        </ElementName>
      )}
    </IndicatorContainer>
  );
};

export default StatusIndicator;
