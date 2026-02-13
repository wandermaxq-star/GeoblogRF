/**
 * Тестовая страница для проверки офлайн-тайлов.
 *
 * Отображает карту с тайлами из MBTiles файлов.
 * Позволяет переключаться между доступными тайлсетами.
 * Включает диагностику: предпросмотр отдельных тайлов, статус загрузки, сетку тайлов.
 *
 * URL: /offline-map-test
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OfflineOSMRenderer } from '../services/map_facade/adapters/OfflineOSMRenderer';
import type { OfflineMapConfig } from '../services/map_facade/adapters/OfflineOSMRenderer';
import { loadLeafletStyles } from '../utils/loadLeafletStyles';

interface TilesetInfo {
  name: string;
  filename: string;
  sizeMB: number;
  format: string;
  bounds: number[] | null;
  center: number[] | null;
  minzoom: number | null;
  maxzoom: number | null;
  description: string | null;
}

interface TileProbeResult {
  url: string;
  z: number;
  x: number;
  y: number;
  status: number;
  contentType: string;
  size: number;
  ok: boolean;
  loadTimeMs: number;
}

const OfflineMapTest: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OfflineOSMRenderer | null>(null);

  const [tilesets, setTilesets] = useState<TilesetInfo[]>([]);
  const [activeTileset, setActiveTileset] = useState<string>('test-raster');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tilesetMeta, setTilesetMeta] = useState<any>(null);

  // Диагностика
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [probeResults, setProbeResults] = useState<TileProbeResult[]>([]);
  const [probing, setProbing] = useState(false);
  const [previewTile, setPreviewTile] = useState<{ z: number; x: number; y: number } | null>(null);
  const [tileLoadErrors, setTileLoadErrors] = useState<string[]>([]);
  const [tileLoadCount, setTileLoadCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Проверяем доступность сервера
  useEffect(() => {
    setServerStatus('checking');
    fetch('/api/tiles')
      .then(r => {
        setServerStatus(r.ok ? 'online' : 'offline');
      })
      .catch(() => setServerStatus('offline'));
  }, []);

  // 1. Загружаем список доступных тайлсетов
  useEffect(() => {
    const loadTilesets = async () => {
      try {
        const res = await fetch('/api/tiles');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTilesets(data.tilesets || []);
        if (data.tilesets?.length > 0) {
          const pngTileset = data.tilesets.find((t: TilesetInfo) => t.format === 'png');
          setActiveTileset(pngTileset?.name ?? data.tilesets[0].name);
        }
      } catch (err: any) {
        setError(`Не удалось загрузить список тайлсетов: ${err.message}`);
      }
    };
    loadTilesets();
  }, []);

  // 2. Инициализируем / переинициализируем карту при смене тайлсета
  useEffect(() => {
    if (!mapContainerRef.current || !activeTileset) return;

    const initMap = async () => {
      setLoading(true);
      setError(null);
      setTileLoadErrors([]);
      setTileLoadCount(0);

      await loadLeafletStyles();

      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }

      try {
        const renderer = new OfflineOSMRenderer();
        const config: OfflineMapConfig = {
          tileset: activeTileset,
          onlineFallback: true,
          showBoundsOverlay: true,
          zoom: 9,
        };

        await renderer.init('offline-map-container', config);
        rendererRef.current = renderer;

        // Загружаем метаданные
        const metaRes = await fetch(`/api/tiles/${activeTileset}/metadata`);
        if (metaRes.ok) {
          const meta = await metaRes.json();
          setTilesetMeta(meta);
        }

        // Слушаем ошибки загрузки тайлов через Leaflet
        const map = (renderer as any).map || (renderer as any).mapInstance;
        if (map) {
          map.eachLayer((layer: any) => {
            if (layer._url && layer._url.includes('/api/tiles/')) {
              layer.on('tileload', () => {
                setTileLoadCount(prev => prev + 1);
              });
              layer.on('tileerror', (e: any) => {
                const coords = e.coords || {};
                setTileLoadErrors(prev => [
                  ...prev.slice(-49),
                  `z=${coords.z} x=${coords.x} y=${coords.y} — ошибка загрузки`
                ]);
              });
            }
          });
        }
      } catch (err: any) {
        setError(`Ошибка инициализации карты: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [activeTileset]);

  // Функция проверки отдельных тайлов
  const probeTiles = useCallback(async () => {
    if (!tilesetMeta || !activeTileset) return;
    setProbing(true);
    setProbeResults([]);

    const results: TileProbeResult[] = [];
    const minZ = tilesetMeta.minzoom ?? 7;
    const maxZ = tilesetMeta.maxzoom ?? 12;
    const bounds = tilesetMeta.bounds;

    for (let z = minZ; z <= maxZ; z++) {
      let cx: number, cy: number;
      if (bounds && bounds.length === 4) {
        const [west, south, east, north] = bounds;
        const midLat = (south + north) / 2;
        const midLon = (west + east) / 2;
        cx = Math.floor((midLon + 180) / 360 * Math.pow(2, z));
        cy = Math.floor((1 - Math.log(Math.tan(midLat * Math.PI / 180) + 1 / Math.cos(midLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
      } else {
        cx = Math.floor(Math.pow(2, z) / 2);
        cy = Math.floor(Math.pow(2, z) / 2);
      }

      const url = `/api/tiles/${activeTileset}/${z}/${cx}/${cy}.png`;
      const start = performance.now();
      try {
        const res = await fetch(url);
        const loadTimeMs = Math.round(performance.now() - start);
        const contentType = res.headers.get('content-type') || '';
        let size = 0;
        try {
          const blob = await res.blob();
          size = blob.size;
        } catch { /* ignore */ }
        results.push({ url, z, x: cx, y: cy, status: res.status, contentType, size, ok: res.ok, loadTimeMs });
      } catch {
        const loadTimeMs = Math.round(performance.now() - start);
        results.push({ url, z, x: cx, y: cy, status: 0, contentType: '', size: 0, ok: false, loadTimeMs });
      }
    }

    setProbeResults(results);
    setProbing(false);
  }, [tilesetMeta, activeTileset]);

  const handlePreviewTile = (z: number, x: number, y: number) => {
    setPreviewTile({ z, x, y });
  };

  const statusColor = serverStatus === 'online' ? '#22c55e' : serverStatus === 'offline' ? '#ef4444' : '#f59e0b';
  const statusText = serverStatus === 'online' ? 'Сервер тайлов доступен' : serverStatus === 'offline' ? 'Сервер тайлов недоступен!' : 'Проверяем...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a' }}>
      {/* Заголовок */}
      <div
        style={{
          padding: '12px 24px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          zIndex: 1000,
        }}
      >
        <h1 style={{ color: '#f1f5f9', fontSize: '18px', margin: 0, fontWeight: 600 }}>
          🗺️ Офлайн тайлы — Тестирование
        </h1>

        {/* Статус сервера */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: statusColor }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          {statusText}
        </span>

        {/* Переключатель тайлсетов */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Тайлсет:</span>
          {tilesets.map(ts => {
            const isPng = ts.format === 'png';
            return (
              <button
                key={ts.name}
                onClick={() => setActiveTileset(ts.name)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: activeTileset === ts.name ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                  background: activeTileset === ts.name ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  color: activeTileset === ts.name ? '#60a5fa' : '#94a3b8',
                  cursor: isPng ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: 500,
                  opacity: isPng ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
                disabled={!isPng}
                title={isPng ? `Переключить на ${ts.name}` : `${ts.name} — формат ${ts.format} не подходит для Leaflet`}
              >
                {ts.name} ({ts.sizeMB} МБ, {ts.format})
                {!isPng && ' ⚠️'}
              </button>
            );
          })}
        </div>

        {/* Кнопки управления */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: showDiagnostics ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)',
              background: showDiagnostics ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
              color: showDiagnostics ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            🔬 Диагностика
          </button>
          <a
            href="/"
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            ← На карту
          </a>
        </div>

        {/* Статус загрузки */}
        {loading && (
          <span style={{ color: '#f59e0b', fontSize: '13px' }}>⏳ Загрузка карты...</span>
        )}
        {error && (
          <span style={{ color: '#ef4444', fontSize: '13px' }}>❌ {error}</span>
        )}
      </div>

      {/* Панель метаданных */}
      {tilesetMeta && (
        <div
          style={{
            padding: '8px 24px',
            background: 'rgba(30, 41, 59, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '24px',
            fontSize: '12px',
            color: '#94a3b8',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>📐 Формат: <b style={{ color: '#e2e8f0' }}>{tilesetMeta.format}</b></span>
          <span>🔍 Zoom: <b style={{ color: '#e2e8f0' }}>{tilesetMeta.minzoom} — {tilesetMeta.maxzoom}</b></span>
          {tilesetMeta.bounds && (
            <span>
              📍 Bounds: <b style={{ color: '#e2e8f0' }}>
                [{tilesetMeta.bounds.map((b: number) => b.toFixed(3)).join(', ')}]
              </b>
            </span>
          )}
          {tilesetMeta.description && (
            <span>📝 {tilesetMeta.description}</span>
          )}
          <span style={{ color: '#22c55e' }}>✅ Тайлов загружено: {tileLoadCount}</span>
          {tileLoadErrors.length > 0 && (
            <span style={{ color: '#ef4444' }}>❌ Ошибок: {tileLoadErrors.length}</span>
          )}
        </div>
      )}

      {/* Основная область */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Карта */}
        <div
          id="offline-map-container"
          ref={mapContainerRef}
          style={{
            flex: 1,
            minHeight: '400px',
          }}
        />

        {/* Панель диагностики */}
        {showDiagnostics && (
          <div
            style={{
              width: '380px',
              background: 'rgba(15, 23, 42, 0.98)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 style={{ color: '#f1f5f9', fontSize: '16px', margin: 0 }}>🔬 Диагностика тайлов</h2>

            {/* Кнопка проверки */}
            <button
              onClick={probeTiles}
              disabled={probing || !tilesetMeta}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                cursor: probing ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                width: '100%',
              }}
            >
              {probing ? '⏳ Проверяем тайлы...' : '🔍 Проверить центральные тайлы (все zoom)'}
            </button>

            {/* Результаты проверки */}
            {probeResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3 style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Результаты по zoom-уровням:</h3>
                {probeResults.map((r) => (
                  <div
                    key={r.url}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: r.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${r.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handlePreviewTile(r.z, r.x, r.y)}
                    title="Кликните для предпросмотра тайла"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: r.ok ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                        z={r.z}
                      </span>
                      <span style={{ color: r.ok ? '#4ade80' : '#f87171' }}>
                        {r.ok ? '✅' : '❌'} {r.status}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '2px' }}>
                      x={r.x} y={r.y} | {r.contentType} | {r.size} байт | {r.loadTimeMs}мс
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Предпросмотр тайла */}
            {previewTile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                  Предпросмотр: z={previewTile.z} x={previewTile.x} y={previewTile.y}
                </h3>
                <div
                  style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: '#1a1a2e',
                    position: 'relative',
                  }}
                >
                  <img
                    src={`/api/tiles/${activeTileset}/${previewTile.z}/${previewTile.x}/${previewTile.y}.png`}
                    alt={`Тайл z=${previewTile.z} x=${previewTile.x} y=${previewTile.y}`}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      imageRendering: 'pixelated',
                    }}
                    onError={() => {
                      setPreviewTile(null);
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '4px 8px',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#94a3b8',
                      fontSize: '11px',
                    }}
                  >
                    /api/tiles/{activeTileset}/{previewTile.z}/{previewTile.x}/{previewTile.y}.png
                  </div>
                </div>
                {/* Соседние тайлы для навигации */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[-1, 0, 1].map(dy =>
                    [-1, 0, 1].map(dx => {
                      if (dx === 0 && dy === 0) return null;
                      const nx = previewTile.x + dx;
                      const ny = previewTile.y + dy;
                      return (
                        <button
                          key={`${dx},${dy}`}
                          onClick={() => handlePreviewTile(previewTile.z, nx, ny)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '10px',
                          }}
                        >
                          {dx > 0 ? '→' : dx < 0 ? '←' : ''}{dy > 0 ? '↓' : dy < 0 ? '↑' : ''}({nx},{ny})
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Ручной ввод координат тайла */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Просмотр конкретного тайла:</h3>
              <TileInput activeTileset={activeTileset} onPreview={handlePreviewTile} />
            </div>

            {/* Лог ошибок */}
            {tileLoadErrors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>
                  Ошибки загрузки тайлов ({tileLoadErrors.length}):
                </h3>
                <div
                  style={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    background: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '8px',
                    padding: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  {tileLoadErrors.map((err, i) => (
                    <div key={i} style={{ color: '#f87171', fontSize: '11px', padding: '2px 0' }}>
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** Вспомогательный компонент: ввод координат конкретного тайла */
const TileInput: React.FC<{
  activeTileset: string;
  onPreview: (z: number, x: number, y: number) => void;
}> = ({ activeTileset, onPreview }) => {
  const [z, setZ] = useState('10');
  const [x, setX] = useState('626');
  const [y, setY] = useState('318');

  const inputStyle: React.CSSProperties = {
    width: '60px',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#e2e8f0',
    fontSize: '12px',
    textAlign: 'center' as const,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <label style={{ color: '#64748b', fontSize: '12px' }}>Z:</label>
      <input style={inputStyle} value={z} onChange={e => setZ(e.target.value)} />
      <label style={{ color: '#64748b', fontSize: '12px' }}>X:</label>
      <input style={inputStyle} value={x} onChange={e => setX(e.target.value)} />
      <label style={{ color: '#64748b', fontSize: '12px' }}>Y:</label>
      <input style={inputStyle} value={y} onChange={e => setY(e.target.value)} />
      <button
        onClick={() => onPreview(parseInt(z), parseInt(x), parseInt(y))}
        style={{
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid rgba(59,130,246,0.4)',
          background: 'rgba(59,130,246,0.15)',
          color: '#60a5fa',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        👁️
      </button>
    </div>
  );
};

export default OfflineMapTest;
