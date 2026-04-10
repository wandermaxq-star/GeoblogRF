/**
 * Переключение между онлайн и офлайн режимами карты
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOfflineTiles } from './useOfflineTiles';
import { MapMode } from '../types/offline';

export interface UseOfflineModeToggleReturn {
  mapMode: MapMode;
  toggleMode: () => void;
  setOfflineMode: () => void;
  setOnlineMode: () => void;
  goToProPage: () => void;
  // Refs для управления слоями (доступны после инициализации)
  offlineTiles: ReturnType<typeof useOfflineTiles>;
}

export function useOfflineModeToggle(): UseOfflineModeToggleReturn {
  const navigate = useNavigate();
  const offlineTiles = useOfflineTiles();
  
  const [mapMode, setMapMode] = useState<MapMode>({ type: 'online' });

  // Синхронизация с состоянием offlineTiles
  useEffect(() => {
    if (offlineTiles.isActive && mapMode.type !== 'offline') {
      setMapMode({ type: 'offline', activeSet: offlineTiles.activeSet });
    } else if (!offlineTiles.isActive && mapMode.type !== 'online') {
      setMapMode({ type: 'online' });
    }
  }, [offlineTiles.isActive, offlineTiles.activeSet]);

  const toggleMode = useCallback(() => {
    if (mapMode.type === 'online') {
      // Переходим в офлайн режим - показываем меню выбора
      offlineTiles.setMenuOpen(true);
    } else {
      // Переходим в онлайн режим
      offlineTiles.setIsActive(false);
      setMapMode({ type: 'online' });
    }
  }, [mapMode.type, offlineTiles]);

  const setOfflineMode = useCallback(() => {
    offlineTiles.setIsActive(true);
    setMapMode({ type: 'offline', activeSet: offlineTiles.activeSet });
  }, [offlineTiles]);

  const setOnlineMode = useCallback(() => {
    offlineTiles.setIsActive(false);
    setMapMode({ type: 'online' });
  }, [offlineTiles]);

  const goToProPage = useCallback(() => {
    navigate('/pro/offline');
  }, [navigate]);

  return {
    mapMode,
    toggleMode,
    setOfflineMode,
    setOnlineMode,
    goToProPage,
    offlineTiles,
  };
}
