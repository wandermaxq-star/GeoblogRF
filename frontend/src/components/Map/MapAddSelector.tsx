/**
 * MapAddSelector — попап предвыбора типа добавляемого объекта на карте.
 * Появляется вместо кнопки "+" и предлагает: Метку / Событие.
 * По аналогии с ModeSelector в PostsPage.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, CalendarPlus, ChevronRight, X } from 'lucide-react';

export type MapAddMode = 'marker' | 'event';

interface MapAddSelectorProps {
  isOpen: boolean;
  onSelect: (mode: MapAddMode) => void;
  onClose: () => void;
}

const OPTIONS: {
  id: MapAddMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  color: string;
}[] = [
  {
    id: 'marker',
    title: 'Метку',
    description: 'Точка интереса — место, которое хочется запомнить',
    icon: <MapPin className="w-6 h-6" />,
    gradient: 'from-blue-500 to-cyan-500',
    color: '#3b82f6',
  },
  {
    id: 'event',
    title: 'Событие',
    description: 'Мероприятие с датой, временем и адресом',
    icon: <CalendarPlus className="w-6 h-6" />,
    gradient: 'from-purple-500 to-pink-500',
    color: '#8b5cf6',
  },
];

const MapAddSelector: React.FC<MapAddSelectorProps> = ({ isOpen, onSelect, onClose }) => {
  const portal = typeof document !== 'undefined' ? document.body : null;
  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(0,0,0,0.35)',
              pointerEvents: 'auto',
            }}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '16px',
            }}
          >
          {/* Попап */}
          <motion.div
            key="popup"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.22 }}
            style={{
              zIndex: 1201,
              pointerEvents: 'auto',
              width: '280px',
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--glass-bg, rgba(255,255,255,0.82))',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderRadius: '20px',
              border: '1px solid var(--border-light, rgba(255,255,255,0.3))',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              padding: '16px',
            }}
          >
            {/* Заголовок */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--glass-text, #1a1a1a)', margin: 0 }}>
                  Что добавляем?
                </p>
                <p style={{ fontSize: '12px', color: 'var(--glass-text-secondary, #888)', margin: '2px 0 0' }}>
                  Кликните на карту после выбора
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-light, rgba(0,0,0,0.1))',
                  background: 'rgba(255,255,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X className="w-4 h-4" style={{ color: 'var(--glass-text-secondary, #666)' }} />
              </button>
            </div>

            {/* Варианты */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {OPTIONS.map((opt, i) => (
                <motion.button
                  key={opt.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); onSelect(opt.id); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.25))',
                    background: 'var(--glass-bg, rgba(255,255,255,0.5))',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Иконка */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${opt.color}cc, ${opt.color}88)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {opt.icon}
                  </div>

                  {/* Текст */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--glass-text, #1a1a1a)', margin: 0 }}>
                      {opt.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--glass-text-secondary, #888)', margin: '2px 0 0', lineHeight: 1.35 }}>
                      {opt.description}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--glass-text-secondary, #aaa)', flexShrink: 0 }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (!portal) return content;
  return ReactDOM.createPortal(content, portal);
};

export default MapAddSelector;
