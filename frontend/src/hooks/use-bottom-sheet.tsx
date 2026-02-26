import React, { useEffect, useCallback, useState } from 'react';
import { useBottomSheetStore } from '../stores/bottomSheetStore';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Блокирует скролл body когда BottomSheet открыт.
 */
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (active) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [active]);
}

/**
 * Хук для определения высоты клавиатуры.
 * При открытии клавиатуры sheet поднимается вверх.
 */
function useKeyboardOffset(active: boolean) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active || !window.visualViewport) return;

    const vv = window.visualViewport;
    const handler = () => {
      // Разница между полной высотой окна и высотой viewport = высота клавиатуры
      const kbHeight = window.innerHeight - vv.height;
      setOffset(kbHeight > 50 ? kbHeight : 0);
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, [active]);

  return offset;
}

/**
 * Содержимое BottomSheet — стабильный компонент, вынесенный из хука.
 */
const BottomSheetContent: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  keyboardOffset: number;
  children?: React.ReactNode;
}> = ({ isOpen, onClose, keyboardOffset, children }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        key="bottom-sheet-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[70vh] bg-white dark:bg-gray-900 rounded-t-3xl pt-4 px-4 z-50 flex flex-col"
          initial={{ y: '100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ paddingBottom: keyboardOffset > 0 ? keyboardOffset : undefined }}
          onClick={(e) => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            // Закрытие по свайпу вниз (offset > 150px)
            if (info.offset.y > 150) onClose();
          }}
        >
          {/* Drag handle */}
          <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 flex-shrink-0" />
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/**
 * Хук для управления BottomSheet.
 * Возвращает { isOpen, open, close, Sheet }.
 * Sheet — обёртка, принимающая children.
 */
export function useBottomSheet() {
  const isOpen = useBottomSheetStore((s) => s.isOpen);
  const open = useBottomSheetStore((s) => s.open);
  const close = useBottomSheetStore((s) => s.close);

  useBodyScrollLock(isOpen);
  const keyboardOffset = useKeyboardOffset(isOpen);

  const Sheet = useCallback(
    ({ children }: { children?: React.ReactNode }) => (
      <BottomSheetContent isOpen={isOpen} onClose={close} keyboardOffset={keyboardOffset}>
        {children}
      </BottomSheetContent>
    ),
    [isOpen, close, keyboardOffset]
  );

  return { isOpen, open, close, Sheet };
}
