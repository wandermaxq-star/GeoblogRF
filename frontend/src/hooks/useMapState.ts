/**
 * Управление базовым состоянием карты (center, zoom, UI)
 */

import { useState, useCallback } from 'react';
import { mapStateHelpers } from '../stores/mapStateStore';

export interface MapUIState {
  settingsOpen: boolean;
  favoritesOpen: boolean;
  legendOpen: boolean;
  isAddingMarkerMode: boolean;
  isRecording: boolean;
  showZonesLayer: boolean;
}

export function useMapState() {
  // Координаты карты
  const savedState = mapStateHelpers.getCenterAndZoom('osm');
  const [center, setCenter] = useState<[number, number]>(savedState.center);
  const [zoom, setZoom] = useState<number>(savedState.zoom);

  // UI состояния
  const [uiState, setUiState] = useState<MapUIState>({
    settingsOpen: false,
    favoritesOpen: false,
    legendOpen: false,
    isAddingMarkerMode: false,
    isRecording: false,
    showZonesLayer: false,
  });

  // Helper функции для переключения UI
  const toggleSettings = useCallback(() =>
    setUiState(prev => ({ ...prev, settingsOpen: !prev.settingsOpen })),
    []
  );

  const toggleFavorites = useCallback(() =>
    setUiState(prev => ({ ...prev, favoritesOpen: !prev.favoritesOpen })),
    []
  );

  const toggleLegend = useCallback(() =>
    setUiState(prev => ({ ...prev, legendOpen: !prev.legendOpen })),
    []
  );

  const toggleAddingMarker = useCallback(() =>
    setUiState(prev => ({ ...prev, isAddingMarkerMode: !prev.isAddingMarkerMode })),
    []
  );

  const toggleRecording = useCallback(() =>
    setUiState(prev => ({ ...prev, isRecording: !prev.isRecording })),
    []
  );

  const toggleZones = useCallback(() =>
    setUiState(prev => ({ ...prev, showZonesLayer: !prev.showZonesLayer })),
    []
  );

  return {
    // Карта
    center, setCenter,
    zoom, setZoom,

    // UI состояния
    ...uiState,

    // Переключатели
    toggleSettings,
    toggleFavorites,
    toggleLegend,
    toggleAddingMarker,
    toggleRecording,
    toggleZones,

    // Прямое управление UI
    setUiState,
  };
}
