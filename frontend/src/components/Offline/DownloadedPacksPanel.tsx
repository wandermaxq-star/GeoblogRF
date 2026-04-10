import React, { useEffect, useState } from 'react';
import { offlineService, type OfflineRoutePackData } from '../../services/offlineService';

interface DownloadedPacksPanelProps {}

const DownloadedPacksPanel: React.FC<DownloadedPacksPanelProps> = () => {
  const [packs, setPacks] = useState<OfflineRoutePackData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    offlineService
      .getDownloadedRoutePacks()
      .then((list) => setPacks(list))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (packId: string) => {
    try {
      await offlineService.deleteRoutePackData(packId);
      setPacks((prev) => prev.filter((p) => p.packId !== packId));
    } catch (e) {
      console.error('failed to delete pack', e);
    }
  };

  if (loading || packs.length === 0) {
    return null;
  }

  return (
    <div className="downloaded-packs-panel">
      <h3 className="downloaded-packs-title">Скачанные маршрутные пакеты</h3>
      <ul className="downloaded-packs-list">
        {packs.map((p) => (
          <li key={p.storageKey} className="downloaded-packs-item">
            <span className="downloaded-packs-name">
              {p.packTitle} — {p.variantTitle}
            </span>
            <button
              className="downloaded-packs-delete"
              onClick={() => handleDelete(p.packId)}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DownloadedPacksPanel;
