import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import {
  REGIONS_GEO,
  RUSSIA_OUTLINE,
  KALININGRAD_OUTLINE,
  projectToSvg,
  getRegionRadius,
  FD_COLORS,
} from '../../data/russiaRegionsGeo';
import { useOfflineTilesStore, type DownloadStatus } from '../../stores/offlineTilesStore';
import { REGION_PATHS, SVG_WIDTH, SVG_HEIGHT } from '../../data/russiaRegionsPaths';

// Реальные контуры: если сгенерировано > 20 регионов — рисуем path, иначе fallback на circle
const USE_PATHS = Object.keys(REGION_PATHS).length > 20;

interface RussiaMapSvgProps {
  onRegionClick: (regionId: string) => void;
}

// ── ViewBox state ────────────────────────────────────────────────────
interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INITIAL_VB: ViewBox = { x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT };
const ASPECT = SVG_WIDTH / SVG_HEIGHT;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 12;

function clampViewBox(vb: ViewBox): ViewBox {
  const minW = INITIAL_VB.w / MAX_ZOOM;
  const maxW = INITIAL_VB.w / MIN_ZOOM;
  const w = Math.max(minW, Math.min(maxW, vb.w));
  const h = w / ASPECT;
  const x = Math.max(INITIAL_VB.x - w * 0.3, Math.min(INITIAL_VB.w - w * 0.3, vb.x));
  const y = Math.max(INITIAL_VB.y - h * 0.3, Math.min(INITIAL_VB.h - h * 0.3, vb.y));
  return { x, y, w, h };
}

const RussiaMapSvg: React.FC<RussiaMapSvgProps> = ({ onRegionClick }) => {
  const {
    downloadStatus,
    activeRegionId,
    hoveredRegionId,
    setHoveredRegion,
    setActiveRegion,
  } = useOfflineTilesStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── ViewBox state (zoom / pan) ────────────────────────────────────
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VB);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);
  const wasDragged = useRef(false);

  const currentZoom = INITIAL_VB.w / viewBox.w;

  // ── Fly-to при выборе региона из списка ───────────────────────────
  useEffect(() => {
    if (!activeRegionId || !REGIONS_GEO[activeRegionId]) return;

    const geo = REGIONS_GEO[activeRegionId];
    const [cx, cy] = projectToSvg(geo.center[0], geo.center[1]);

    let targetW: number;
    if (geo.area > 1_000_000)      targetW = SVG_WIDTH * 0.5;
    else if (geo.area > 200_000)   targetW = SVG_WIDTH * 0.35;
    else if (geo.area > 50_000)    targetW = SVG_WIDTH * 0.25;
    else if (geo.area > 10_000)    targetW = SVG_WIDTH * 0.18;
    else                           targetW = SVG_WIDTH * 0.12;

    const targetH = targetW / ASPECT;
    const target = clampViewBox({
      x: cx - targetW / 2,
      y: cy - targetH / 2,
      w: targetW,
      h: targetH,
    });

    const steps = 30;
    const start = { ...viewBox };
    let step = 0;

    const animate = () => {
      step++;
      const t = step / steps;
      const ease = 1 - Math.pow(1 - t, 3);

      setViewBox({
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        w: start.w + (target.w - start.w) * ease,
        h: start.h + (target.h - start.h) * ease,
      });

      if (step < steps) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegionId]);

  // ── Wheel → zoom ─────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

      setViewBox((prev) => {
        const newW = prev.w * factor;
        const newH = newW / ASPECT;
        const newX = prev.x + (prev.w - newW) * mx;
        const newY = prev.y + (prev.h - newH) * my;
        return clampViewBox({ x: newX, y: newY, w: newW, h: newH });
      });
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── Mouse drag → pan ──────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      wasDragged.current = false;
      panStart.current = { x: e.clientX, y: e.clientY, vb: { ...viewBox } };
    },
    [viewBox],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart.current || !svgRef.current) return;

      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        wasDragged.current = true;
      }

      const rect = svgRef.current.getBoundingClientRect();
      const svgDx = (dx / rect.width) * panStart.current.vb.w;
      const svgDy = (dy / rect.height) * panStart.current.vb.h;

      setViewBox(
        clampViewBox({
          x: panStart.current.vb.x - svgDx,
          y: panStart.current.vb.y - svgDy,
          w: panStart.current.vb.w,
          h: panStart.current.vb.h,
        }),
      );
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      wasDragged.current = false;
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, vb: { ...viewBox } };
      setIsPanning(true);
    },
    [viewBox],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPanning || !panStart.current || e.touches.length !== 1 || !svgRef.current) return;

      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;

      const rect = svgRef.current.getBoundingClientRect();
      const svgDx = (dx / rect.width) * panStart.current.vb.w;
      const svgDy = (dy / rect.height) * panStart.current.vb.h;

      setViewBox(
        clampViewBox({
          ...panStart.current.vb,
          x: panStart.current.vb.x - svgDx,
          y: panStart.current.vb.y - svgDy,
        }),
      );
    },
    [isPanning],
  );

  // ── Контур России ─────────────────────────────────────────────────
  const outlinePath = useMemo(() => {
    const pts = RUSSIA_OUTLINE.map(([lon, lat]) => {
      const [x, y] = projectToSvg(lon, lat);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  }, []);

  const kaliningradPath = useMemo(() => {
    const pts = KALININGRAD_OUTLINE.map(([lon, lat]) => {
      const [x, y] = projectToSvg(lon, lat);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  }, []);

  // ── Подготовка данных по регионам ─────────────────────────────────
  const regionEntries = useMemo(() => {
    return Object.entries(REGIONS_GEO)
      .map(([id, geo]) => {
        const pathData = REGION_PATHS?.[id];
        const [cx, cy] = pathData
          ? [pathData.cx, pathData.cy]
          : projectToSvg(geo.center[0], geo.center[1]);
        const r = getRegionRadius(geo.area);
        const d = pathData?.d ?? null;
        return { id, cx, cy, r, geo, d };
      })
      .sort((a, b) => b.geo.area - a.geo.area);
  }, []);

  // ── Цвет региона ──────────────────────────────────────────────────
  const getRegionFill = useCallback(
    (regionId: string, status: DownloadStatus | undefined, isActive: boolean, isHovered: boolean) => {
      const geo = REGIONS_GEO[regionId];
      if (!geo) return '#e0e0e0';
      const fdColor = FD_COLORS[geo.federalDistrict];

      if (status === 'downloaded') return fdColor;
      if (status === 'downloading') return fdColor;
      if (isActive) return fdColor + '90';
      if (isHovered) return fdColor + '60';
      return '#d5dbe3';
    },
    [],
  );

  // ── Размер подписей зависит от зума ───────────────────────────────
  const labelFontSize = Math.max(2.5, Math.min(6, 5 / Math.sqrt(currentZoom)));
  const showLabels = currentZoom >= 0.8;

  // ── Обработчик клика по региону ───────────────────────────────────
  const handleRegionClick = useCallback(
    (regionId: string, e: React.MouseEvent) => {
      if (wasDragged.current) return; // Это был drag, не click
      e.stopPropagation();
      setActiveRegion(regionId);
      onRegionClick(regionId);
    },
    [onRegionClick, setActiveRegion],
  );

  const resetZoom = useCallback(() => {
    const steps = 25;
    const start = { ...viewBox };
    let step = 0;
    const animate = () => {
      step++;
      const t = step / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      setViewBox({
        x: start.x + (INITIAL_VB.x - start.x) * ease,
        y: start.y + (INITIAL_VB.y - start.y) * ease,
        w: start.w + (INITIAL_VB.w - start.w) * ease,
        h: start.h + (INITIAL_VB.h - start.h) * ease,
      });
      if (step < steps) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    setActiveRegion(null);
  }, [viewBox, setActiveRegion]);

  // ── Рендер ────────────────────────────────────────────────────────
  const vbStr = `${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.w.toFixed(1)} ${viewBox.h.toFixed(1)}`;

  return (
    <div
      ref={containerRef}
      className="russia-map-container"
      style={{
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        cursor: isPanning ? 'grabbing' : 'grab',
        position: 'relative',
        touchAction: 'none',
      }}
    >
      {/* Кнопки зума */}
      <div className="russia-map-controls">
        <button
          className="russia-map-ctrl-btn"
          onClick={() =>
            setViewBox((prev) =>
              clampViewBox({
                w: prev.w / 1.4,
                h: prev.h / 1.4,
                x: prev.x + (prev.w - prev.w / 1.4) / 2,
                y: prev.y + (prev.h - prev.h / 1.4) / 2,
              }),
            )
          }
          title="Приблизить"
        >
          +
        </button>
        <button
          className="russia-map-ctrl-btn"
          onClick={() =>
            setViewBox((prev) =>
              clampViewBox({
                w: prev.w * 1.4,
                h: prev.h * 1.4,
                x: prev.x - (prev.w * 1.4 - prev.w) / 2,
                y: prev.y - (prev.h * 1.4 - prev.h) / 2,
              }),
            )
          }
          title="Отдалить"
        >
          −
        </button>
        {currentZoom > 1.1 && (
          <button className="russia-map-ctrl-btn" onClick={resetZoom} title="Вся Россия">
            ⌂
          </button>
        )}
      </div>

      {/* Индикатор зума */}
      <div className="russia-map-zoom-badge">×{currentZoom.toFixed(1)}</div>

      <svg
        ref={svgRef}
        viewBox={vbStr}
        className="russia-map-svg"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <defs>
          <filter id="region-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            @keyframes regionPulse {
              0%, 100% { opacity: 0.45; }
              50% { opacity: 1; }
            }
            .region-downloading { animation: regionPulse 1.5s ease-in-out infinite; }
            .region-circle { cursor: pointer; pointer-events: all; }
            .region-path { cursor: pointer; pointer-events: all; transition: opacity 0.15s; }
            .region-path:hover { opacity: 0.85; }
            .region-label { pointer-events: none; user-select: none; }
          `}</style>
        </defs>

        {/* Фон — заливка всего видимого пространства */}
        <rect
          x={viewBox.x - 500}
          y={viewBox.y - 500}
          width={viewBox.w + 1000}
          height={viewBox.h + 1000}
          fill="#f1f5f9"
        />

        {/* Контуры территории (только при fallback на кружки) */}
        {!USE_PATHS && (
          <>
            <path d={outlinePath}      fill="#e8ecf0" stroke="#cbd5e1" strokeWidth={0.6 / Math.sqrt(currentZoom)} />
            <path d={kaliningradPath}  fill="#e8ecf0" stroke="#cbd5e1" strokeWidth={0.6 / Math.sqrt(currentZoom)} />
          </>
        )}

        {/* Регионы — path (реальные границы) или circle (fallback) */}
        {regionEntries.map(({ id, cx, cy, r, d }) => {
          const status = downloadStatus[id];
          const isActive = activeRegionId === id;
          const isHovered = hoveredRegionId === id;
          const fill = getRegionFill(id, status, isActive, isHovered);

          if (USE_PATHS && d) {
            return (
              <path
                key={id}
                d={d}
                fill={fill}
                stroke={isActive ? '#1e293b' : isHovered ? '#475569' : '#94a3b8'}
                strokeWidth={(isActive ? 1.0 : 0.3) / Math.sqrt(currentZoom)}
                className={`region-path${status === 'downloading' ? ' region-downloading' : ''}`}
                filter={isActive ? 'url(#region-glow)' : undefined}
                fillRule="evenodd"
                onClick={(e) => handleRegionClick(id, e)}
                onMouseEnter={() => setHoveredRegion(id)}
                onMouseLeave={() => setHoveredRegion(null)}
              />
            );
          }

          // Fallback — кружки
          const displayR = isActive ? r * 1.35 : isHovered ? r * 1.15 : r;
          return (
            <circle
              key={id}
              cx={cx}
              cy={cy}
              r={displayR}
              fill={fill}
              stroke={isActive ? '#1e293b' : isHovered ? '#475569' : '#ffffff80'}
              strokeWidth={(isActive ? 1.4 : 0.5) / Math.sqrt(currentZoom)}
              className={`region-circle${status === 'downloading' ? ' region-downloading' : ''}`}
              filter={isActive ? 'url(#region-glow)' : undefined}
              onClick={(e) => handleRegionClick(id, e)}
              onMouseEnter={() => setHoveredRegion(id)}
              onMouseLeave={() => setHoveredRegion(null)}
            />
          );
        })}

        {/* Подписи регионов — zoom ≥ 0.8 */}
        {showLabels &&
          regionEntries.map(({ id, cx, cy, r, geo }) => {
            const isActive = activeRegionId === id;
            const isHovered = hoveredRegionId === id;
            const status = downloadStatus[id];
            const hasColor =
              isActive || isHovered || status === 'downloaded' || status === 'downloading';

            // Для path-карты подпись в центроиде, для кружков — под кружком
            const labelY = USE_PATHS ? cy + labelFontSize * 0.35 : cy + r + labelFontSize * 1.1;

            return (
              <text
                key={`label-${id}`}
                x={cx}
                y={labelY}
                textAnchor="middle"
                fontSize={USE_PATHS ? labelFontSize * 0.85 : labelFontSize}
                fontWeight={isActive || isHovered ? 700 : 500}
                fill={hasColor ? '#1e293b' : '#475569'}
                className="region-label"
                fontFamily="system-ui, -apple-system, sans-serif"
                stroke={USE_PATHS ? '#ffffffcc' : 'none'}
                strokeWidth={USE_PATHS ? labelFontSize * 0.15 : 0}
                paintOrder="stroke"
              >
                {geo.label}
              </text>
            );
          })}

        {/* Столицы регионов — zoom ≥ 3 */}
        {currentZoom >= 3 &&
          regionEntries.map(({ id, geo }) => {
            const [capX, capY] = projectToSvg(geo.capitalCoords[0], geo.capitalCoords[1]);
            const dotR = Math.max(0.6, 1.2 / Math.sqrt(currentZoom));
            const capFontSize = Math.max(1.8, 3.5 / Math.sqrt(currentZoom));
            return (
              <g key={`cap-${id}`} className="region-label">
                <circle cx={capX} cy={capY} r={dotR} fill="#1e293b" />
                <text
                  x={capX}
                  y={capY - dotR - capFontSize * 0.3}
                  textAnchor="middle"
                  fontSize={capFontSize}
                  fontWeight={600}
                  fill="#0f172a"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  stroke="#ffffffcc"
                  strokeWidth={capFontSize * 0.18}
                  paintOrder="stroke"
                >
                  {geo.capital}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
};

export default RussiaMapSvg;
