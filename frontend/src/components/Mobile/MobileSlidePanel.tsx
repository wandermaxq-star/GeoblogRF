import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MobileSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  cardClassName?: string;
  allowBackgroundInteraction?: boolean;
}

const MobileSlidePanel: React.FC<MobileSlidePanelProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  cardClassName = '',
  allowBackgroundInteraction = false,
}) => {
  // Используем общие переменные темы, без индивидуальной ручной темы
  const panelStyles = {
    background: 'var(--glass-l1-bg)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-l1-border)',
    boxShadow: 'var(--glass-l1-shadow)',
  };

  const overlayStyles = {
    background: allowBackgroundInteraction ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      style={{ 
        ...overlayStyles,
        pointerEvents: isOpen && !allowBackgroundInteraction ? 'auto' : 'none' 
      }}
      onClick={allowBackgroundInteraction ? undefined : onClose}
    >
      <div
        className={cn(
          "fixed left-0 right-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out overflow-hidden max-h-[50vh] min-h-[40vh] h-[50vh] rounded-t-2xl flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full",
          cardClassName
        )}
        style={{ 
          ...panelStyles,
          pointerEvents: 'auto' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default MobileSlidePanel;