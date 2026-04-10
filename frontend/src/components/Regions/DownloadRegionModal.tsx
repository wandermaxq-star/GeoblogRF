import React, { useState, useEffect } from 'react';
import { offlineService, DownloadProgress } from '../../services/offlineService';
import { useRegionsStore } from '../../stores/regionsStore';
import { getregioncity as getRegionCity } from '../../stores/regionCities';
import { useAuth } from '../../contexts/AuthContext';
import { FaDownload, FaCheckCircle, FaTimes, FaSpinner } from 'react-icons/fa';
import './DownloadRegionModal.css';

interface DownloadRegionModalProps {
  regionId: string;
  isOpen: boolean;
  onClose: () => void;
  onDownloadComplete?: () => void;
  isCapital?: boolean; // Если true, то это столица
  capitalId?: string; // ID столицы (capital_${regionId})
}

type DownloadType = 'user_data' | 'user_data_cities' | 'user_data_full';
type TileVersion = 'full' | 'trimmed'; // Полная или обрезанная версия тайлов

const DownloadRegionModal: React.FC<DownloadRegionModalProps> = ({
  regionId,
  isOpen,
  onClose,
  onDownloadComplete,
  isCapital = false,
  capitalId
}) => {
  const { user } = useAuth();
  const { getRegionName, getCapitalName } = useRegionsStore();
  const [selectedType, setSelectedType] = useState<DownloadType>('user_data');
  const [tileVersion, setTileVersion] = useState<TileVersion>('trimmed'); // По умолчанию обрезанная версия
  const [sizeEstimate, setSizeEstimate] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const regionName = isCapital ? (getCapitalName(capitalId || '') || regionId) : (getRegionName(regionId) || regionId);
  const cityInfo = getRegionCity(regionId);

  useEffect(() => {
    if (isOpen && regionId && user?.id) {
      checkDownloadStatus();
      estimateSize();
    }
  }, [isOpen, regionId, user?.id]);

  const checkDownloadStatus = async () => {
    const downloaded = await offlineService.isRegionDownloaded(regionId);
    setIsDownloaded(downloaded);
  };

  const estimateSize = async () => {
    if (!user?.id) return;
    
    const size = await offlineService.estimateDownloadSize(regionId, selectedType, user.id, tileVersion);
    setSizeEstimate(size);
  };

  useEffect(() => {
    if (isOpen) {
      estimateSize();
    }
  }, [selectedType, tileVersion, isOpen]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const handleDownload = async () => {
    if (!user?.id) return;

    setIsDownloading(true);
    setProgress({
      regionId,
      progress: 0,
      status: 'preparing',
      message: 'Подготовка...'
    });

    try {
      await offlineService.downloadRegionData(
        regionId,
        selectedType,
        user.id,
        (progressUpdate) => {
          setProgress(progressUpdate);
        },
        tileVersion,
      );
    
      setIsDownloaded(true);
      onDownloadComplete?.();
      
      // Закрываем модальное окно через 1 секунду после завершения
      setTimeout(() => {
        onClose();
        setIsDownloading(false);
        setProgress(null);
      }, 1000);
    } catch (error) {
      setProgress({
        regionId,
        progress: 0,
        status: 'error',
        message: 'Ошибка при скачивании'
      });
    }
  };

  if (!isOpen) return null;

  const downloadOptions = [
    {
      type: 'user_data' as DownloadType,
      title: 'Только мои данные',
      description: 'Ваши метки, маршруты, события и посты для этого региона. Карта загружается онлайн.',
      icon: '📱',
      defaultSize: 100 * 1024 // ~100KB
    },
    {
      type: 'user_data_cities' as DownloadType,
      title: 'Мои данные + карта города',
      description: `Добавляются офлайн-тайлы ${cityInfo?.cityname || 'города'} для навигации без интернета.`,
      icon: '🏙️',
      defaultSize: 3 * 1024 * 1024 // ~3MB
    },
    {
      type: 'user_data_full' as DownloadType,
      title: 'Мои данные + карта региона',
      description: 'Скачиваются тайлы всей области (до 100 МБ)',
      defaultSize: 50 * 1024 * 1024, // ~50MB
      showTileVersion: true
    }
  ];

  return (
    <>
      <div className="download-modal-overlay" onClick={onClose}>
        <div className="download-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="download-modal-header">
            <h2 className="download-modal-title">
              Что скачать для региона «{regionName}»?
            </h2>
            <button className="download-modal-close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          {isDownloaded && (
            <div className="download-modal-already-downloaded">
              <FaCheckCircle />
              <span>Регион уже скачан</span>
            </div>
          )}

          {progress && progress.status !== 'completed' && (
            <div className="download-modal-progress">
              <div className="download-modal-progress-bar">
                <div
                  className="download-modal-progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="download-modal-progress-text">
                {progress.message || `${progress.progress}%`}
              </div>
            </div>
          )}

          <div className="download-modal-options">
            {downloadOptions.map((option) => (
              <div key={option.type}>
                <label
                  className={`download-modal-option ${
                    selectedType === option.type ? 'download-modal-option-selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="downloadType"
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
                    <div className="download-modal-option-size">
                      Примерный размер: {formatSize(sizeEstimate || option.defaultSize)}
                    </div>
                  </div>
                </label>
                {/* Выбор версии тайлов (только для вариантов с картами) */}
                {option.showTileVersion && selectedType === option.type && (
                  <div className="download-modal-tile-version">
                    <label className="download-modal-tile-version-label">
                      Версия тайлов:
                    </label>
                    <div className="download-modal-tile-version-buttons">
                      <button
                        className={`download-modal-tile-version-button ${tileVersion === 'trimmed' ? 'download-modal-tile-version-button-active' : ''}`}
                        onClick={() => setTileVersion('trimmed')}
                        disabled={isDownloading}
                      >
                        Обрезанная (легкая)
                      </button>
                      <button
                        className={`download-modal-tile-version-button ${tileVersion === 'full' ? 'download-modal-tile-version-button-active' : ''}`}
                        onClick={() => setTileVersion('full')}
                        disabled={isDownloading}
                      >
                        Полная (детальная)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="download-modal-footer">
            <button
              className="download-modal-button download-modal-button-primary"
              onClick={handleDownload}
              disabled={isDownloading || isDownloaded}
            >
              {isDownloading ? (
                <>
                  <FaSpinner className="download-modal-spinner" />
                  <span>Скачивание...</span>
                </>
              ) : isDownloaded ? (
                <>
                  <FaCheckCircle />
                  <span>Уже скачано</span>
                </>
              ) : (
                <>
                  <FaDownload />
                  <span>Скачать</span>
                </>
              )}
            </button>
            <button
              className="download-modal-button download-modal-button-secondary"
              onClick={onClose}
              disabled={isDownloading}
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DownloadRegionModal;
