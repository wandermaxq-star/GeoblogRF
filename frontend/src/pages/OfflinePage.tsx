import React, { useState, useEffect, useCallback } from 'react';
import RussiaMapSvg from '../components/Offline/RussiaMapSvg';
import RegionPanel from '../components/Offline/RegionPanel';
import DownloadRegionModal from '../components/Regions/DownloadRegionModal';
import { useOfflineTilesStore } from '../stores/offlineTilesStore';
import { offlineService } from '../services/offlineService';
import { FaArrowLeft, FaGlobeAsia } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './OfflinePage.css';

const OfflinePage: React.FC = () => {
  const navigate = useNavigate();
  const [downloadModalRegionId, setDownloadModalRegionId] = useState<string | null>(null);
  const { initDownloadedRegions, setDownloadStatus } = useOfflineTilesStore();

  // ── Загрузка ранее скачанных регионов ──────────────────────────────
  useEffect(() => {
    offlineService
      .getDownloadedRegions()
      .then((ids) => initDownloadedRegions(ids))
      .catch(() => {});
  }, [initDownloadedRegions]);

  // ── Клик по региону (на карте или в списке) → диалог загрузки ──────
  const handleRegionClick = useCallback((regionId: string) => {
    setDownloadModalRegionId(regionId);
  }, []);

  // ── Завершение загрузки → обновить статус ─────────────────────────
  const handleDownloadComplete = useCallback(() => {
    if (downloadModalRegionId) {
      setDownloadStatus(downloadModalRegionId, 'downloaded');
    }
  }, [downloadModalRegionId, setDownloadStatus]);

  return (
    <div className="offline-page">
      {/* Кнопка назад */}
      <button
        className="offline-page-back"
        onClick={() => navigate(-1)}
        title="Назад"
      >
        <FaArrowLeft />
      </button>

      {/* SVG-карта — занимает весь фон, зумит к активному региону */}
      <div className="offline-page-map">
        <div className="offline-page-map-badge">
          <FaGlobeAsia /> Офлайн карты регионов России
        </div>
        <RussiaMapSvg onRegionClick={handleRegionClick} />
      </div>

      {/* Панель со списком регионов */}
      <div className="offline-page-panel">
        <RegionPanel onRegionClick={handleRegionClick} />
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
    </div>
  );
};

export default OfflinePage;
