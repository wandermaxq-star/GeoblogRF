import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mapFacade } from '../services/map_facade/index';
import { routesService } from '../services/routesService';
import { exportRouteAndDownload } from '../services/routeExporters/exportClient';
import { offlineContentQueue } from '../services/offlineContentQueue';
import { useNavigate } from 'react-router-dom';

const ProfileRoutes: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth?.user) {
      navigate('/login');
      return;
    }
    setLoading(true);
    routesService.getMyRoutes().then((r) => setRoutes(r || [])).finally(() => setLoading(false));
  }, [auth, navigate]);

  const handleExport = (route: any, format: 'gpx' | 'kml' | 'geojson') => {
    // Поддерживаем оба варианта API фасада: `mapFacade.exportTrack` (объект) и `mapFacade().exportTrack` (функция)
    try {
      if ((mapFacade as any)?.exportTrack && typeof (mapFacade as any).exportTrack === 'function') {
        (mapFacade as any).exportTrack(route.track || route, format);
        return;
      }
    } catch (e) {
      // ignore and fall back
      console.warn('mapFacade export check failed', e);
    }

    try {
      const maybeFacade = typeof mapFacade === 'function' ? (mapFacade as any)() : (mapFacade as any);
      if (maybeFacade && typeof maybeFacade.exportTrack === 'function') {
        maybeFacade.exportTrack(route.track || route, format);
        return;
      }
    } catch (e) {
      console.warn('mapFacade export failed, falling back', e);
    }

    // Используем общий export-клиент: сначала пробуем серверный экспорт, иначе локальная сериализация
    exportRouteAndDownload(route, format).catch((e) => {
      console.error('Export failed', e);
    });
  };

  const handleDelete = async (route: any) => {
    try {
      await routesService.deleteRoute(route.id);
      setRoutes((s) => s.filter((r) => r.id !== route.id));
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleAddToPost = (route: any) => {
    // Navigate to posts page and open create modal with attached route
    navigate('/posts', { state: { attachRoute: route } });
  };

  return (
    <div className="page-container">
      <h1>Мои маршруты</h1>
      {loading && <p>Загрузка...</p>}
      {!loading && !routes.length && <p>У вас нет сохранённых маршрутов.</p>}
      <ul>
        {routes.map((r) => (
          <li key={r.id} style={{ padding: 12, borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{r.title || `Маршрут ${r.id}`}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {r.distance ? `${(r.distance/1000).toFixed(2)} км` : ''} {r.duration ? `• ${Math.round(r.duration/60000)} мин` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleExport(r, 'gpx')}>Export GPX</button>
                <button onClick={() => handleExport(r, 'kml')}>Export KML</button>
                <button onClick={() => handleExport(r, 'geojson')}>Export GeoJSON</button>
                {/* Publish: отправить черновик в очередь (для локальных draft/failed) */}
                {(r.status === 'draft' || String(r.id || '').startsWith('pending_')) && (
                  <button
                    onClick={async () => {
                      try {
                        await offlineContentQueue.uploadDraftById(r.id);
                        // После ручной отправки можно запустить обработку очереди
                        offlineContentQueue.start();
                      } catch (e) {
                        console.error('Publish failed', e);
                      }
                    }}
                  >
                    Publish
                  </button>
                )}
                {r.status === 'failed' && (
                  <button
                    onClick={async () => {
                      try {
                        await offlineContentQueue.uploadDraftById(r.id);
                        offlineContentQueue.start();
                      } catch (e) {
                        console.error('Retry failed', e);
                      }
                    }}
                  >
                    Retry
                  </button>
                )}
                <button onClick={() => handleAddToPost(r)}>Добавить в пост</button>
                <button onClick={() => handleDelete(r)}>Удалить</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProfileRoutes;
