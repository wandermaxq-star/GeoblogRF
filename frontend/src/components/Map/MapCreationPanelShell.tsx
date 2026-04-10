import React from 'react';
import { X } from 'lucide-react';

interface MapCreationPanelShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  isMobile: boolean;
  isTwoPanelMode: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const MapCreationPanelShell: React.FC<MapCreationPanelShellProps> = ({
  title,
  subtitle,
  icon,
  accentColor = '#4cc9f0',
  isMobile,
  isTwoPanelMode,
  onClose,
  children,
  footer,
}) => {
  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 94px)',
        zIndex: 2002,
        pointerEvents: 'auto',
      }
    : {
        position: 'absolute',
        left: isTwoPanelMode ? '25%' : '50%',
        top: '64px',
        transform: 'translateX(-50%)',
        width: 'min(440px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 2002,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
      };

  const cardStyle: React.CSSProperties = isMobile
    ? {
        width: '100%',
        height: 'min(58vh, calc(100dvh - 180px))',
        minHeight: 400,
        maxHeight: 'min(58vh, calc(100dvh - 180px))',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }
    : {
        width: '100%',
        flex: 1,
        minHeight: 0,
        borderRadius: 24,
      };

  return (
    <div style={containerStyle}>
      <div
        style={{
          ...cardStyle,
          background: 'var(--glass-l1-bg, rgba(255,255,255,0.92))',
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          border: '1px solid var(--glass-l1-border, rgba(255,255,255,0.3))',
          boxShadow: '0 22px 50px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', flexShrink: 0 }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.14)' }} />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            background: `linear-gradient(135deg, ${accentColor}22, transparent)`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
            {icon && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                  boxShadow: `0 10px 24px ${accentColor}55`,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--glass-text, #111827)' }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 2, color: 'var(--glass-text-secondary, #6b7280)' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--glass-text-secondary, #6b7280)',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '10px 14px 12px' : '14px 16px 16px' }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: isMobile ? '10px 14px 10px' : '0 16px 16px',
              borderTop: '1px solid rgba(255,255,255,0.22)',
              background: isMobile
                ? 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.96))'
                : 'transparent',
              backdropFilter: isMobile ? 'blur(14px)' : undefined,
              WebkitBackdropFilter: isMobile ? 'blur(14px)' : undefined,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapCreationPanelShell;