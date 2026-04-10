import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, Map, RotateCcw, ChevronRight, Cloud } from 'lucide-react';
import { useIsMobile } from '../../hooks/use-mobile';

export type CreationMode = 'instant' | 'story' | 'guide' | 'continue';

interface ModeConfig {
  id: CreationMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
  gradient: string;
  accentBg: string;
}

interface ModeSelectorProps {
  onSelect: (mode: CreationMode) => void;
  hasDraft?: boolean;
  isOnline?: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelect, hasDraft = false, isOnline = true }) => {
  const isMobile = useIsMobile();

  const modes: ModeConfig[] = [
    {
      id: 'instant',
      title: 'Здесь и сейчас',
      description: 'Сфотографируй момент и напиши пару слов',
      icon: <Camera className="w-7 h-7" />,
      primary: isMobile,
      gradient: 'from-blue-500 to-cyan-500',
      accentBg: 'rgba(59,130,246,0.07)',
    },
    {
      id: 'story',
      title: 'Впечатление дня',
      description: 'Несколько фото + эмоции + геометка',
      icon: <Sparkles className="w-7 h-7" />,
      primary: !isMobile,
      gradient: 'from-purple-500 to-pink-500',
      accentBg: 'rgba(168,85,247,0.07)',
    },
    {
      id: 'guide',
      title: 'Мой путеводитель',
      description: 'Маршрут, точки, советы, структура',
      icon: <Map className="w-7 h-7" />,
      primary: false,
      gradient: 'from-emerald-500 to-teal-500',
      accentBg: 'rgba(16,185,129,0.07)',
    },
  ];

  if (hasDraft) {
    modes.push({
      id: 'continue',
      title: 'Продолжить черновик',
      description: 'Последняя заметка — добей и опубликуй',
      icon: <RotateCcw className="w-7 h-7" />,
      primary: false,
      gradient: 'from-amber-500 to-orange-500',
      accentBg: 'rgba(245,158,11,0.07)',
    });
  }

  const sorted = [...modes].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-5 sm:p-6 space-y-6"
    >
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--glass-text, var(--text-primary, #1a1a1a))' }}>
          Что создаём сегодня?
        </h2>
        <p className="text-sm" style={{ color: 'var(--glass-text-secondary, var(--text-secondary, #888))' }}>
          {isMobile ? 'Быстрый момент или полноценный гид?' : 'Выбери подходящий формат'}
        </p>
      </div>

      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        <AnimatePresence>
          {sorted.map((mode, i) => (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(mode.id)}
              className="relative overflow-hidden rounded-2xl text-left p-5 transition-shadow duration-300"
              style={{
                background: 'var(--glass-bg, rgba(255,255,255,0.7))',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                border: mode.primary
                  ? '2px solid rgba(59,130,246,0.4)'
                  : '1px solid var(--border-light, rgba(255,255,255,0.25))',
                boxShadow: mode.primary
                  ? '0 4px 20px rgba(59,130,246,0.15)'
                  : '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Градиентный акцент */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} pointer-events-none`}
                style={{ opacity: 0.06 }}
              />

              <div className="relative flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${mode.gradient} text-white shadow-md`}
                >
                  {mode.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--glass-text, var(--text-primary))' }}>
                    {mode.title}
                  </h3>
                  <p className="text-sm leading-snug" style={{ color: 'var(--glass-text-secondary, var(--text-secondary))' }}>
                    {mode.description}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 mt-1 shrink-0" style={{ color: 'var(--glass-text-secondary, #aaa)' }} />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {!isOnline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm mt-4 flex items-center justify-center gap-2"
          style={{ color: 'var(--glass-text-secondary, #b59f3b)' }}
        >
          <Cloud className="w-4 h-4" />
          <span>Работаем оффлайн — всё сохранится автоматически</span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ModeSelector;
