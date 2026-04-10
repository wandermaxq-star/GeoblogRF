import React, { useEffect, useMemo, useState } from 'react';
import { FaCheckCircle, FaDownload, FaSpinner, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import type { CuratedRoutePack, CuratedRouteVariant } from '../../types/proRoutePacks';
import {
  offlineService,
  type DownloadProgress,
  type OfflineRoutePackData,
  type OfflineRoutePackDownloadType,
  type TileVersion,
} from '../../services/offlineService';
import '../Regions/DownloadRegionModal.css';

interface DownloadRoutePackModalProps {
  pack: CuratedRoutePack;
  variant: CuratedRouteVariant;
  enabledWaypointIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onDownloadComplete?: (data: OfflineRoutePackData) => void;
}

const DownloadRoutePackModal: React.FC<DownloadRoutePackModalProps> = ({
  pack,
  variant,
  enabledWaypointIds,
  isOpen,
  onClose,
  onDownloadComplete,
}) => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<OfflineRoutePackDownloadType>('route_cities');
  const [tileVersion, setTileVersion] = useState<TileVersion>('trimmed');
  const [sizeEstimate, setSizeEstimate] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadedPack, setDownloadedPack] = useState<OfflineRoutePackData | null>(null);

  const includedWaypoints = useMemo(() => {
    const enabledSet = new Set(enabledWaypointIds);
    return variant.waypoints.filter((waypoint) => waypoint.isRequired || enabledSet.has(waypoint.id));
  }, [enabledWaypointIds, variant.waypoints]);

  const isPremium = offlineService.isPremiumUser(user?.subscription_expires_at);
  const isPurchased = !!user?.purchasedPacks?.includes(pack.id);
  const canDownload = isPremium || isPurchased;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    offlineService.getRoutePackData(pack.id).then(setDownloadedPack).catch(() => setDownloadedPack(null));
  }, [isOpen, pack.id]);

  useEffect(() => {
    if (!isOpen || !user?.id) {
      setSizeEstimate(0);
      return;
    }

    offlineService
      .estimateRoutePackDownloadSize(pack, variant, enabledWaypointIds, selectedType, user.id, tileVersion)
      .then(setSizeEstimate)
      .catch(() => setSizeEstimate(0));
  }, [enabledWaypointIds, isOpen, pack, selectedType, tileVersion, user?.id, variant]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const handleDownload = async () => {
    if (!user?.id || !canDownload) {
      return;
    }

    setIsDownloading(true);
    setProgress({
      regionId: pack.id,
      progress: 0,
      status: 'preparing',
      message: 'Подготовка маршрутного пакета...',
    });

    try {
      const data = await offlineService.downloadRoutePackData(
        pack,
        variant,
        enabledWaypointIds,
        user.id,
        selectedType,
        (progressUpdate) => {
          setProgress(progressUpdate);
        },
        tileVersion,
        isPurchased,
      );

      setDownloadedPack(data);
      onDownloadComplete?.(data);

      setTimeout(() => {
        setIsDownloading(false);
        setProgress(null);
        onClose();
      }, 900);
    } catch {
      setProgress({
        regionId: pack.id,
        progress: 0,
        status: 'error',
        message: 'Не удалось сохранить маршрутный пакет',
      });
      setIsDownloading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const downloadOptions = [
    {
      type: 'route_data' as OfflineRoutePackDownloadType,
      title: 'Сценарий маршрута',
      description: 'Маршрут, выбранные точки и ваши данные по поездке без оффлайн-тайлов карты.',
      icon: '🧭',
    },
    {
      type: 'route_cities' as OfflineRoutePackDownloadType,
      title: 'Маршрут + города',
      description: 'Базовый offline pack: сценарий поездки и тайлы только для включённых точек маршрута.',
      icon: '🏙️',
    },
    {
      type: 'route_corridor' as OfflineRoutePackDownloadType,
      title: 'Маршрут + дорожный коридор',
      description: 'Добавляет расширенное покрытие по связанным регионам, чтобы поездка не рвалась между точками.',
      icon: '🛣️',
      showTileVersion: true,
    },
  ];

  return (
    <div className="download-modal-overlay" onClick={onClose}>
      <div className="download-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="download-modal-header">
          <h2 className="download-modal-title">Скачать маршрутный пакет «{pack.title}»?</h2>
          <button className="download-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {downloadedPack && (
          <div className="download-modal-already-downloaded">
            <FaCheckCircle />
            <span>
              Уже сохранён оффлайн: {downloadedPack.variantTitle} · {new Date(downloadedPack.downloadedAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        )}

        {progress && progress.status !== 'completed' && (
          <div className="download-modal-progress">
            <div className="download-modal-progress-bar">
              <div className="download-modal-progress-fill" style={{ width: `${progress.progress}%` }} />
            </div>
            <div className="download-modal-progress-text">{progress.message || `${progress.progress}%`}</div>
          </div>
        )}

        <div className="download-modal-options">
          <div style={{ padding: '0 2px 8px 2px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '6px' }}>
              В пакет войдут {includedWaypoints.length} точек маршрута
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {includedWaypoints.map((waypoint) => (
                <span
                  key={waypoint.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {waypoint.title}
                </span>
              ))}
            </div>
          </div>

          {downloadOptions.map((option) => (
            <div key={option.type}>
              <label
                className={`download-modal-option ${selectedType === option.type ? 'download-modal-option-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="routePackDownloadType"
                  value={option.type}
                  checked={selectedType === option.type}
                  onChange={() => setSelectedType(option.type)}
                  disabled={isDownloading}
                />
                <div className="download-modal-option-content">
                  <div className="download-modal-option-header">
                    <span className="download-modal-option-icon">{option.icon}</span>
                    <span className="download-modal-option-title">{option.title}</span>
                  </div>
                  <p className="download-modal-option-description">{option.description}</p>
                  <div className="download-modal-option-size">Примерный размер: {formatSize(sizeEstimate)}</div>
                </div>
              </label>
              {option.showTileVersion && selectedType === option.type && (
                <div className="download-modal-tile-version">
                  <label className="download-modal-tile-version-label">Покрытие коридора:</label>
                  <div className="download-modal-tile-version-buttons">
                    <button
                      className={`download-modal-tile-version-button ${tileVersion === 'trimmed' ? 'download-modal-tile-version-button-active' : ''}`}
                      onClick={() => setTileVersion('trimmed')}
                      disabled={isDownloading}
                    >
                      Обрезанный коридор
                    </button>
                    <button
                      className={`download-modal-tile-version-button ${tileVersion === 'full' ? 'download-modal-tile-version-button-active' : ''}`}
                      onClick={() => setTileVersion('full')}
                      disabled={isDownloading}
                    >
                      Расширенный коридор
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!user && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.14)', color: '#92400e', fontSize: '13px', lineHeight: 1.5 }}>
              Для сохранения оффлайн-маршрута нужно войти в аккаунт.
            </div>
          )}

          {user && !canDownload && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.14)', color: '#92400e', fontSize: '13px', lineHeight: 1.5 }}>
              Скачивание маршрутных пакетов доступно только в PRO-подписке или через покупку пакета.
            </div>
          )}
        </div>

        <div className="download-modal-footer">
          <button
            className="download-modal-button download-modal-button-primary"
            onClick={handleDownload}
            disabled={isDownloading || !user || !canDownload}
          >
            {isDownloading ? (
              <>
                <FaSpinner className="download-modal-spinner" />
                <span>Собираем пакет...</span>
              </>
            ) : downloadedPack ? (
              <>
                <FaDownload />
                <span>Обновить пакет</span>
              </>
            ) : (
              <>
                <FaDownload />
                <span>Скачать пакет</span>
              </>
            )}
          </button>
          <button className="download-modal-button download-modal-button-secondary" onClick={onClose} disabled={isDownloading}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadRoutePackModal;
