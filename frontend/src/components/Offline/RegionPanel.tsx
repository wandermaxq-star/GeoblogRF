import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ALL_REGIONS } from '../../stores/regionsStore';
import {
  FD_ORDER,
  FD_NAMES,
  FD_COLORS,
  FD_REGIONS,
  type FederalDistrict,
} from '../../data/russiaRegionsGeo';
import { useOfflineTilesStore } from '../../stores/offlineTilesStore';
import {
  FaDownload,
  FaCheckCircle,
  FaSpinner,
  FaChevronDown,
  FaChevronRight,
  FaSearch,
} from 'react-icons/fa';

interface RegionPanelProps {
  onRegionClick: (regionId: string) => void;
}

const RegionPanel: React.FC<RegionPanelProps> = ({ onRegionClick }) => {
  const { downloadStatus, activeRegionId, setActiveRegion } = useOfflineTilesStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const regionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitialMount = useRef(true);

  const [collapsedFD, setCollapsedFD] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  // ── IntersectionObserver: scroll → highlight на карте ───────────────
  useEffect(() => {
    // Пропускаем первоначальную инициализацию, чтобы не было скачка
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisibleId: string | null = null;

        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisibleId = entry.target.getAttribute('data-region-id');
          }
        });

        if (mostVisibleId && maxRatio > 0.5) {
          // Дебаунс, чтобы карта не прыгала при быстрой прокрутке
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            setActiveRegion(mostVisibleId);
          }, 250);
        }
      },
      {
        root: panelRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    Object.values(regionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      clearTimeout(debounceRef.current);
      observer.disconnect();
    };
  }, [setActiveRegion, collapsedFD, search]);

  // ── Helpers ────────────────────────────────────────────────────────
  const getRegionName = useCallback((regionId: string): string => {
    const region = ALL_REGIONS.find((r) => r.id === regionId);
    return region?.name || regionId;
  }, []);

  const toggleFD = (fd: FederalDistrict) => {
    setCollapsedFD((prev) => ({ ...prev, [fd]: !prev[fd] }));
  };

  const getStatusIcon = (regionId: string) => {
    const status = downloadStatus[regionId];
    if (status === 'downloaded')
      return <FaCheckCircle style={{ color: '#22c55e', flexShrink: 0 }} />;
    if (status === 'downloading')
      return <FaSpinner className="region-panel-spin" style={{ color: '#3b82f6', flexShrink: 0 }} />;
    return <FaDownload style={{ color: '#94a3b8', flexShrink: 0 }} />;
  };

  const downloadedCountInFD = useCallback(
    (fd: FederalDistrict) => {
      return FD_REGIONS[fd].filter((id) => downloadStatus[id] === 'downloaded').length;
    },
    [downloadStatus],
  );

  // ── Фильтрация по поиску ───────────────────────────────────────────
  const filteredFDs = FD_ORDER.map((fd) => {
    if (!search.trim()) return { fd, regionIds: FD_REGIONS[fd] };
    const q = search.toLowerCase().trim();
    const regionIds = FD_REGIONS[fd].filter((id) =>
      getRegionName(id).toLowerCase().includes(q),
    );
    return { fd, regionIds };
  }).filter((entry) => entry.regionIds.length > 0);

  // ── Рендер ─────────────────────────────────────────────────────────
  return (
    <div className="region-panel">
      {/* Заголовок */}
      <div className="region-panel-header">
        <h2 className="region-panel-title">Офлайн карты</h2>
        <p className="region-panel-subtitle">
          Нажмите на регион, чтобы скачать тайлы карты
        </p>

        {/* Поиск */}
        <div className="region-panel-search">
          <FaSearch className="region-panel-search-icon" />
          <input
            type="text"
            placeholder="Поиск региона…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="region-panel-search-input"
          />
        </div>
      </div>

      {/* Список регионов */}
      <div ref={panelRef} className="region-panel-list">
        {filteredFDs.map(({ fd, regionIds }) => {
          const isCollapsed = collapsedFD[fd];
          const total = FD_REGIONS[fd].length;
          const downloaded = downloadedCountInFD(fd);

          return (
            <div key={fd} className="region-panel-fd">
              {/* Заголовок ФО */}
              <button
                className="region-panel-fd-btn"
                onClick={() => toggleFD(fd)}
                style={{ borderLeftColor: FD_COLORS[fd] }}
              >
                <span
                  className="region-panel-fd-dot"
                  style={{ backgroundColor: FD_COLORS[fd] }}
                />
                <span className="region-panel-fd-name">{FD_NAMES[fd]}</span>
                {downloaded > 0 && (
                  <span className="region-panel-fd-badge">
                    {downloaded}/{total}
                  </span>
                )}
                {isCollapsed ? (
                  <FaChevronRight className="region-panel-fd-arrow" />
                ) : (
                  <FaChevronDown className="region-panel-fd-arrow" />
                )}
              </button>

              {/* Элементы ФО */}
              {!isCollapsed && (
                <div className="region-panel-fd-items">
                  {regionIds.map((regionId) => {
                    const isActive = activeRegionId === regionId;
                    return (
                      <div
                        key={regionId}
                        ref={(el) => {
                          regionRefs.current[regionId] = el;
                        }}
                        data-region-id={regionId}
                        className={`region-panel-item${isActive ? ' region-panel-item--active' : ''}`}
                        onClick={() => onRegionClick(regionId)}
                        onMouseEnter={() => setActiveRegion(regionId)}
                      >
                        <span className="region-panel-item-name">
                          {getRegionName(regionId)}
                        </span>
                        {getStatusIcon(regionId)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredFDs.length === 0 && (
          <div className="region-panel-empty">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
};

export default RegionPanel;
