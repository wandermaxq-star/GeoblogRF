import { useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number; // ms, 0 = sticky
}

interface UseToastReturn {
  toast: (data: Omit<ToastItem, 'id'>) => string;
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

// queue limit constant
const MAX_TOASTS = 3;

export const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (data: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substr(2, 9);
      const durationDefault =
        data.variant === 'warning' ? 5000 : data.variant === 'error' ? 0 : 3000;
      const newToast: ToastItem = {
        id,
        variant: data.variant || 'info',
        title: data.title,
        description: data.description,
        duration: data.duration ?? durationDefault,
      };
      setToasts((prev) => {
        const arr = [...prev, newToast];
        if (arr.length > MAX_TOASTS) arr.shift();
        return arr;
      });
      if (newToast.duration > 0) {
        setTimeout(() => dismiss(id), newToast.duration);
      }
      return id;
    },
    [dismiss]
  );

  return { toast, toasts, dismiss };
};

