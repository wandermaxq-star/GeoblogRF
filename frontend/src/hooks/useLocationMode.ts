import { useState, useEffect, useCallback } from 'react';

export type LocationMode = 'auto' | 'manual';

const STORAGE_KEY = 'map_location_mode';

/**
 * Хук для управления режимом определения местоположения на карте.
 * 
 * - 'auto' (по умолчанию): геолокация включена, карта центрируется на пользователе
 * - 'manual': ручной режим, используется текущий центр карты
 * 
 * Выбор сохраняется в localStorage и восстанавливается при следующем заходе.
 */
export function useLocationMode() {
  const [mode, setModeState] = useState<LocationMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'auto' || saved === 'manual') {
        return saved;
      }
    } catch {
      // Игнорируем ошибки localStorage
    }
    
    return 'auto'; // По умолчанию - геолокация
  });

  // Сохраняем выбор в localStorage при изменении
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Игнорируем ошибки localStorage
    }
  }, [mode]);

  // Функция для включения геолокации
  const enableAutoMode = useCallback(() => {
    setModeState('auto');
  }, []);

  // Функция для переключения на ручной режим
  const enableManualMode = useCallback(() => {
    setModeState('manual');
  }, []);

  // Переключение режима
  const toggleMode = useCallback(() => {
    setModeState(prev => prev === 'auto' ? 'manual' : 'auto');
  }, []);

  return {
    mode,
    isAutoMode: mode === 'auto',
    isManualMode: mode === 'manual',
    enableAutoMode,
    enableManualMode,
    toggleMode,
  };
}

export default useLocationMode;
