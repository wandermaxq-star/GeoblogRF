/**
 * OfflineMapWidget — интерактивная карта для Pro.tsx
 * 
 * Карта встроена прямо в фон страницы (без контейнера).
 * Использует переменные тем для адаптации к light/dark режимам.
 */

import React, { useCallback, useState, useEffect } from 'react';
import RussiaMapSvg from './RussiaMapSvg';
import { useOfflineTilesStore } from '../../stores/offlineTilesStore';
import DownloadRegionModal from '../Regions/DownloadRegionModal';
import { offlineService } from '../../services/offlineService';
import type { CuratedRouteWaypoint } from '../../types/proRoutePacks';

interface OfflineMapWidgetProps {
  highlightedRegionIds?: string[];
  previewWaypoints?: CuratedRouteWaypoint[];
}

const OfflineMapWidget: React.FC<OfflineMapWidgetProps> = ({
  highlightedRegionIds = [],
  previewWaypoints = [],
}) => {
  const [downloadModalRegionId, setDownloadModalRegionId] = useState<string | null>(null);
  const { initDownloadedRegions, setDownloadStatus } = useOfflineTilesStore();

  // Загрузка ранее скачанных регионов
  useEffect(() => {
    offlineService
      .getDownloadedRegions()
      .then((ids) => initDownloadedRegions(ids))
      .catch(() => {});
  }, [initDownloadedRegions]);

  // Клик по региону → диалог загрузки
  const handleRegionClick = useCallback((regionId: string) => {
    setDownloadModalRegionId(regionId);
  }, []);

  // Завершение загрузки → обновить статус
  const handleDownloadComplete = useCallback(() => {
    if (downloadModalRegionId) {
      setDownloadStatus(downloadModalRegionId, 'downloaded');
    }
  }, [downloadModalRegionId, setDownloadStatus]);

  return (
    <>
      {/* Карта встроена прямо в фон — БЕЗ контейнера и ограничений по высоте */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '12px',
          marginBottom: '12px',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <RussiaMapSvg
          onRegionClick={handleRegionClick}
          highlightedRegionIds={highlightedRegionIds}
          previewWaypoints={previewWaypoints}
        />
      </div>

      {/* Модал скачивания */}
      {downloadModalRegionId && (
        <DownloadRegionModal
          regionId={downloadModalRegionId}
          isOpen={true}
          onClose={() => setDownloadModalRegionId(null)}
          onDownloadComplete={handleDownloadComplete}
        />
      )}
    </>
  );
};

export default OfflineMapWidget;
