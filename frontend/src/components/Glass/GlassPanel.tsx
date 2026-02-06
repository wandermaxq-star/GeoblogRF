import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './GlassPanel.css';

export interface GlassPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
  width?: string;
  height?: string;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  /** Ограничение правой границы панели (для двухоконного режима) */
  maxRight?: string;
  /** Ограничение области отображения (для центрирования в активной зоне карты) */
  constrainToMapArea?: boolean;
}

const GlassPanel: React.FC<GlassPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  width,
  height,
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = '',
  maxRight,
  constrainToMapArea = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне панели
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        closeOnOverlayClick &&
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeOnOverlayClick, onClose]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClasses = {
    left: 'glass-panel-left',
    right: 'glass-panel-right',
    top: 'glass-panel-top',
    bottom: 'glass-panel-bottom',
    center: 'glass-panel-center',
  };

  // Вычисляем стили для позиции с учетом ограничений двухоконного режима
  const customStyles: React.CSSProperties = {
    ...(width && { width }),
    ...(height && { height }),
  };

  // Для правой панели с ограничением maxRight
  if (position === 'right' && maxRight) {
    customStyles.right = maxRight;
  }

  // Для констрейна в активную зону карты (двухоконный режим)
  if (constrainToMapArea && (position === 'right' || position === 'center')) {
    // Панель должна быть в левой половине экрана (активная зона карты)
    customStyles.right = 'calc(50% + 1cm)';
    customStyles.maxWidth = 'calc(50% - 2cm)';
  }

  return (
    <>
      {/* Panel */}
      <div
        ref={panelRef}
        className={`glass-panel ${positionClasses[position]} ${isOpen ? 'glass-panel-open' : ''} ${className} ${constrainToMapArea ? 'glass-panel-constrained' : ''}`}
        style={customStyles}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'glass-panel-title' : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="glass-panel-header">
            {title && (
              <h2 id="glass-panel-title" className="glass-panel-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                className="glass-panel-close"
                onClick={onClose}
                aria-label="Закрыть панель"
                type="button"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="glass-panel-content">{children}</div>
      </div>
    </>
  );
};

export default GlassPanel;

