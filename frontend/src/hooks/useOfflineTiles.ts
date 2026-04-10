/**
 * Кастомный хук для управления офлайн-картами
 * Инкапсулирует всю логику работы с тайлами
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { mapFacade } from '../services/map_facade/index';
import { OfflineTileset, OfflineTilesetMetadata } from '../types/offline';

export interface UseOfflineTilesReturn {
  // State
  isActive: boolean;
  menuOpen: boolean;
  tilesets: OfflineTileset[];
  activeSet: string;
  metadata: OfflineTilesetMetadata | null;
  loading: boolean;
  error: string | null;

  // Actions
  setIsActive: (active: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setActiveSet: (name: string) => void;
  loadTilesets: () => Promise<void>;

  // Refs
  menuRef: React.RefObject<HTMLDivElement>;
  layerRef: React.RefObject<any>;
  boundsRef: React.RefObject<any>;
}

export function useOfflineTiles(): UseOfflineTilesReturn {
  const [isActive, setIsActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tilesets, setTilesets] = useState<OfflineTileset[]>([]);
  const [activeSet, setActiveSet] = useState<string>('test-raster');
  const [metadata, setMetadata] = useState<OfflineTilesetMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);

  // Загрузка списка тайлсетов
  const loadTilesets = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tiles');
      if (!res.ok) throw new Error('Failed to load tilesets');

      const data = await res.json();
      const list = data.tilesets || [];
      setTilesets(list);

      // Автовыбор PNG-тайлсета
      const png = list.find((t: OfflineTileset) => t.format === 'png');
      if (png) setActiveSet(png.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('[useOfflineTiles] Failed to load tilesets:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Загрузка метаданных активного тайлсета
  const loadMetadata = useCallback(async (tilesetName: string) => {
    try {
      const res = await fetch(`/api/tiles/${tilesetName}/metadata`);
      if (!res.ok) return;

      const meta = await res.json();
      setMetadata(meta);
      return meta;
    } catch (err) {
      console.warn('[useOfflineTiles] Failed to load metadata:', err);
    }
  }, []);

  // Закрытие меню при клике вне
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Загрузка тайлсетов при активации
  useEffect(() => {
    if (!isActive) return;
    loadTilesets();
  }, [isActive, loadTilesets]);

  // Загрузка метаданных при изменении активного тайлсета
  useEffect(() => {
    if (!isActive || !activeSet) return;
    loadMetadata(activeSet);
  }, [isActive, activeSet, loadMetadata]);

  // Управление слоем на карте Leaflet
  useEffect(() => {
    try { mapFacade().getMap(); } catch { return; }

    // Удаляем предыдущие слои
    if (layerRef.current) {
      try { mapFacade().removeLayer(layerRef.current); } catch {}
      layerRef.current = null;
    }
    if (boundsRef.current) {
      try { mapFacade().removeLayer(boundsRef.current); } catch {}
      boundsRef.current = null;
    }

    if (!isActive || !activeSet) return;

    if (!metadata) return;

    const facade = mapFacade();

    // Добавляем тайловый слой
    const tileUrl = `/api/tiles/${activeSet}/{z}/{x}/{y}.png`;
    const tileLayer = facade.addTileLayer(tileUrl, {
      minZoom: metadata.minzoom ?? 1,
      maxZoom: metadata.maxzoom ?? 18,
      opacity: 0.9,
      attribution: `Offline: ${activeSet}`,
      zIndex: 500,
    });
    layerRef.current = tileLayer;

    // Показываем границы тайлсета
    if (metadata.bounds && metadata.bounds.length === 4) {
      const [west, south, east, north] = metadata.bounds;
      const boundsRect = facade.createRectangle(
        [[south, west], [north, east]],
        { 
          color: '#3b82f6', 
          weight: 2, 
          fill: true, 
          fillOpacity: 0.05, 
          dashArray: '8 4' 
        }
      );
      boundsRef.current = boundsRect;

      // Перемещаем карту в область тайлов
      facade.fitBounds(
        { south, west, north, east } as any,
        { padding: [20, 20], maxZoom: metadata.maxzoom ?? 12 }
      );
    }
  }, [isActive, activeSet, metadata]);

  return {
    isActive,
    menuOpen,
    tilesets,
    activeSet,
    metadata,
    loading,
    error,
    setIsActive,
    setMenuOpen,
    setActiveSet,
    loadTilesets,
    menuRef,
    layerRef,
    boundsRef,
  };
}
