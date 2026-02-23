import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRegionsStore, ALL_REGIONS, ALL_CAPITALS, getRegionIdByName } from '../../stores/regionsStore';
import { useUserLocation } from '../../hooks/useUserLocation';
import { getregioncity as getRegionCity, getregioncitycoordinates as getRegionCityCoordinates, getregionzoom as getRegionZoom } from '../../stores/regionCities';
import { mapFacade } from '../../services/map_facade/index';
import { useAuth } from '../../contexts/AuthContext';
import { offlineService } from '../../services/offlineService';
import DownloadRegionModal from './DownloadRegionModal';
import PremiumScreen from '../Premium/PremiumScreen';
import { FaMapMarkerAlt, FaHome, FaChevronDown, FaChevronUp, FaCheckCircle, FaSearch, FaDownload, FaCity } from 'react-icons/fa';
import './RegionSelector.css';

type TabType = 'regions' | 'capitals';

const RegionSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('regions');
  const [downloadModalRegion, setDownloadModalRegion] = useState<string | null>(null);
  const [downloadModalCapital, setDownloadModalCapital] = useState<string | null>(null);
  const [premiumScreenOpen, setPremiumScreenOpen] = useState(false);
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const { location: userLocation } = useUserLocation();
  const { user } = useAuth();
  const {
    selectedRegions,
    selectedCapitals,
    homeRegion,
    addRegion,
    removeRegion,
    addCapital,
    removeCapital,
    setHomeRegion,
    isRegionSelected,
    isCapitalSelected,
    getSelectedRegionsWithNames,
    getSelectedCapitalsWithNames,
    getRegionName,
    getCapitalName,
    getTotalSelectedCount,
    canAddMore,
  } = useRegionsStore();

  const isPremium = offlineService.isPremiumUser(user?.subscription_expires_at);

  // Загружаем список скачанных регионов
  useEffect(() => {
    if (isOpen) {
      offlineService.getDownloadedRegions().then(setDownloadedRegions).catch(() => {});
    }
  }, [isOpen]);

  // Фильтрация регионов по поисковому запросу
  const filteredRegions = useMemo(() => {
    if (!searchQuery.trim()) {
      return ALL_REGIONS;
    }
    const query = searchQuery.toLowerCase().trim();
    return ALL_REGIONS.filter(region =>
      region.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Фильтрация столиц по поисковому запросу
  const filteredCapitals = useMemo(() => {
    if (!searchQuery.trim()) {
      return ALL_CAPITALS;
    }
    const query = searchQuery.toLowerCase().trim();
    return ALL_CAPITALS.filter(capital =>
      capital.name.toLowerCase().includes(query) ||
      capital.regionName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Определяем и обновляем домашний регион при изменении местоположения
  useEffect(() => {
    if (userLocation && userLocation.region) {
      let regionId: string | null = null;
      
      // Сначала пробуем найти по региону
      regionId = getRegionIdByName(userLocation.region);
      
      // Если не нашли по региону, пробуем найти по городу
      if (!regionId && userLocation.city) {
        // Расширенный маппинг городов на регионы
        const cityToRegionMap: { [key: string]: string } = {
          'Москва': 'moscow_city',
          'Санкт-Петербург': 'spb',
          'СПб': 'spb',
          'Петербург': 'spb',
          'Владимир': 'vladimir_oblast',
          'Владимирская область': 'vladimir_oblast',
          'Суздаль': 'vladimir_oblast',
          'Муром': 'vladimir_oblast',
          'Александров': 'vladimir_oblast',
          'Ковров': 'vladimir_oblast',
          'Гусь-Хрустальный': 'vladimir_oblast',
        };
        
        const cityName = userLocation.city.trim();
        if (cityToRegionMap[cityName]) {
          regionId = cityToRegionMap[cityName];
        } else {
          // Пробуем найти регион, содержащий название города
          const region = ALL_REGIONS.find(r => 
            r.name.toLowerCase().includes(cityName.toLowerCase()) ||
            cityName.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
          );
          if (region) {
            regionId = region.id;
          }
        }
      }
      
      // Если нашли регион, устанавливаем его (даже если homeRegion уже установлен)
      // Это гарантирует, что регион обновится при получении нового местоположения
      if (regionId && regionId !== homeRegion) {
        setHomeRegion(regionId);
        // Центрируем карту на главном городе домашнего региона
        centerMapOnRegion(regionId);
      }
    }
  }, [userLocation?.region, userLocation?.city, setHomeRegion]); // Убрали homeRegion из зависимостей, чтобы обновлять даже если он уже установлен

  // Центрируем карту при изменении homeRegion (если он уже был установлен ранее)
  useEffect(() => {
    if (homeRegion) {
      centerMapOnRegion(homeRegion);
    }
  }, [homeRegion]);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Центрирование карты на главном городе региона
  const centerMapOnRegion = (regionId: string) => {
    const cityInfo = getRegionCity(regionId);
    if (cityInfo) {
      try {
        // Используем setCenter с зумом через провайдер напрямую
        const provider = (mapFacade as any).providers?.[(mapFacade as any).currentProvider];
        if (provider && typeof provider.setCenter === 'function') {
          provider.setCenter(cityInfo.coordinates, cityInfo.zoom);
        } else {
          mapFacade().setCenter(cityInfo.coordinates);
          // Устанавливаем зум отдельно, если доступен
          if (provider?.map?.setZoom) {
            provider.map.setZoom(cityInfo.zoom);
          }
        }
      } catch (error) {
        // Игнорируем ошибки центрирования карты
      }
    }
  };

  const handleToggleRegion = (regionId: string) => {
    if (isRegionSelected(regionId)) {
      // Разрешаем отключить регион, даже если это домашний регион
      removeRegion(regionId);
    } else {
      // Проверяем общий лимит (регионы + столицы)
      if (!canAddMore()) {
        alert(`Можно выбрать максимум 3 элемента (регионы + столицы)`);
        return;
      }
      addRegion(regionId);
      // Центрируем карту на главном городе выбранного региона
      centerMapOnRegion(regionId);
    }
  };

  const handleToggleCapital = (capitalId: string) => {
    if (isCapitalSelected(capitalId)) {
      removeCapital(capitalId);
    } else {
      // Проверяем общий лимит (регионы + столицы)
      if (!canAddMore()) {
        alert(`Можно выбрать максимум 3 элемента (регионы + столицы)`);
        return;
      }
      addCapital(capitalId);
      // Центрируем карту на столице
      const capital = ALL_CAPITALS.find(c => c.id === capitalId);
      if (capital) {
        const cityInfo = getRegionCity(capital.regionId);
        if (cityInfo) {
          try {
            const provider = (mapFacade as any).providers?.[(mapFacade as any).currentProvider];
            if (provider && typeof provider.setCenter === 'function') {
              provider.setCenter(cityInfo.coordinates, cityInfo.zoom);
            } else {
              mapFacade().setCenter(cityInfo.coordinates);
              if (provider?.map?.setZoom) {
                provider.map.setZoom(cityInfo.zoom);
              }
            }
          } catch (error) {
            // Игнорируем ошибки центрирования карты
          }
        }
      }
    }
  };

  const selectedRegionsWithNames = getSelectedRegionsWithNames();
  const selectedCapitalsWithNames = getSelectedCapitalsWithNames();
  const homeRegionName = homeRegion ? getRegionName(homeRegion) : null;
  const additionalRegions = selectedRegionsWithNames.filter(r => r.id !== homeRegion);
  const totalSelected = getTotalSelectedCount();
  
  // Формируем текст для кнопки
  const getButtonText = () => {
    if (homeRegionName) {
      const additionalCount = totalSelected - 1; // минус домашний регион
      if (additionalCount > 0) {
        return `${homeRegionName} + ${additionalCount}`;
      }
      return homeRegionName;
    }
    if (totalSelected > 0) {
      return `Выбрано: ${totalSelected}`;
    }
    return 'Выберите регионы/столицы';
  };

  return (
    <div className="region-selector-container">
      <button
        ref={buttonRef}
        className="region-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FaMapMarkerAlt className="region-selector-icon" />
        <span className="region-selector-text">
          {homeRegionName ? (
            <>
              <span className="region-selector-label">Ваш регион:</span>
              <span className="region-selector-value">{getButtonText()}</span>
            </>
          ) : (
            <span className="region-selector-placeholder">Определение региона...</span>
          )}
        </span>
        {isOpen ? (
          <FaChevronUp className="region-selector-arrow" />
        ) : (
          <FaChevronDown className="region-selector-arrow" />
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="region-selector-dropdown"
          style={{
            position: 'fixed',
            top: buttonRef.current
              ? buttonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: buttonRef.current
              ? buttonRef.current.getBoundingClientRect().left
              : 0,
          }}
        >
          <div className="region-selector-header">
            <h3 className="region-selector-title">Регионы и столицы для отображения</h3>
            <p className="region-selector-subtitle">
              Ваш регион определяется автоматически. Вы можете выбрать до 3 элементов (регионы и/или столицы).
            </p>
            
            {/* Вкладки для переключения между регионами и столицами */}
            <div className="region-selector-tabs">
              <button
                className={`region-selector-tab ${activeTab === 'regions' ? 'region-selector-tab-active' : ''}`}
                onClick={() => setActiveTab('regions')}
              >
                <FaMapMarkerAlt className="region-selector-tab-icon" />
                <span>Регионы</span>
              </button>
              <button
                className={`region-selector-tab ${activeTab === 'capitals' ? 'region-selector-tab-active' : ''}`}
                onClick={() => setActiveTab('capitals')}
              >
                <FaCity className="region-selector-tab-icon" />
                <span>Столицы</span>
              </button>
            </div>
            
            {/* Поисковая строка */}
            <div className="region-selector-search">
              <FaSearch className="region-selector-search-icon" />
              <input
                type="text"
                className="region-selector-search-input"
                placeholder={activeTab === 'regions' ? "Найдите регион..." : "Найдите столицу..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {homeRegion && homeRegionName && (
              <div className="region-selector-home">
                <div className="region-selector-home-icon-wrapper">
                  <FaHome className="region-selector-home-icon" />
                </div>
                <div className="region-selector-home-content">
                  <span className="region-selector-home-label">Ваш регион</span>
                  <span className="region-selector-home-text">{homeRegionName}</span>
                </div>
                <FaCheckCircle className="region-selector-home-check" />
              </div>
            )}
            {!homeRegion && userLocation && (
              <div className="region-selector-home region-selector-home-loading">
                <div className="region-selector-home-icon-wrapper">
                  <div className="region-selector-spinner"></div>
                </div>
                <div className="region-selector-home-content">
                  <span className="region-selector-home-label">Определение региона</span>
                  <span className="region-selector-home-text">Пожалуйста, подождите...</span>
                </div>
              </div>
            )}
          </div>

          <div className="region-selector-list">
            {activeTab === 'regions' ? (
              filteredRegions && filteredRegions.length > 0 ? (
                filteredRegions.map((region) => {
              const isSelected = isRegionSelected(region.id);
              const isHome = homeRegion === region.id;
              // Проверяем общий лимит (регионы + столицы)
              // Домашний регион можно включать/отключать, но он будет помечен иконкой дома
              const isDisabled = !isSelected && !canAddMore();

              return (
                <label
                  key={region.id}
                  className={`region-selector-item ${isSelected ? 'region-selector-item-selected' : ''} ${isHome ? 'region-selector-item-home' : ''} ${isDisabled ? 'region-selector-item-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleRegion(region.id)}
                    disabled={isDisabled}
                    className="region-selector-checkbox"
                  />
                  <span className="region-selector-checkmark"></span>
                  <span className="region-selector-item-name">{region.name}</span>
                  {isHome && (
                    <span className="region-selector-home-badge" title="Ваш регион">
                      <FaHome />
                    </span>
                  )}
                  {isSelected && (
                    <button
                      className="region-selector-download-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPremium) {
                          setDownloadModalRegion(region.id);
                        } else {
                          setPremiumScreenOpen(true);
                        }
                      }}
                      title={downloadedRegions.includes(region.id) ? 'Регион скачан' : 'Скачать для офлайна'}
                    >
                      <FaDownload />
                    </button>
                  )}
                </label>
              );
              })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  Регионы не загружены
                </div>
              )
            ) : (
              // Список столиц
              filteredCapitals && filteredCapitals.length > 0 ? (
                filteredCapitals.map((capital) => {
                  const isSelected = isCapitalSelected(capital.id);
                  const canSelect = canAddMore() || isSelected;

                  return (
                    <label
                      key={capital.id}
                      className={`region-selector-item ${isSelected ? 'region-selector-item-selected' : ''} ${!canSelect ? 'region-selector-item-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleCapital(capital.id)}
                        disabled={!canSelect}
                        className="region-selector-checkbox"
                      />
                      <span className="region-selector-checkmark"></span>
                      <div className="region-selector-item-content">
                        <span className="region-selector-item-name">{capital.name}</span>
                        <span className="region-selector-item-subtitle">{capital.regionName}</span>
                      </div>
                      {isSelected && (
                        <button
                          className="region-selector-download-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPremium) {
                              setDownloadModalCapital(capital.id);
                            } else {
                              setPremiumScreenOpen(true);
                            }
                          }}
                          title={downloadedRegions.includes(capital.regionId) ? 'Столица скачана' : 'Скачать столицу для офлайна'}
                        >
                          <FaDownload />
                        </button>
                      )}
                    </label>
                  );
                })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  Столицы не загружены
                </div>
              )
            )}
          </div>

          {(selectedRegions.length > 0 || selectedCapitals.length > 0) && (
            <div className="region-selector-footer">
              <button
                className="region-selector-clear"
                onClick={() => {
                  // Очищаем все выбранные регионы и столицы
                  // Домашний регион останется помеченным (с иконкой дома), но не будет выбран
                  useRegionsStore.getState().clearSelectedRegions();
                }}
              >
                Очистить выбор
              </button>
              <div className="region-selector-count">
                {homeRegion ? (
                  <>Дополнительно: {totalSelected - 1} / 2</>
                ) : (
                  <>Выбрано: {totalSelected} / 3</>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Модальное окно скачивания региона */}
      {downloadModalRegion && (
        <DownloadRegionModal
          regionId={downloadModalRegion}
          isOpen={!!downloadModalRegion}
          onClose={() => {
            setDownloadModalRegion(null);
            // Обновляем список скачанных регионов
            offlineService.getDownloadedRegions().then(setDownloadedRegions).catch(() => {});
          }}
          onDownloadComplete={() => {
            offlineService.getDownloadedRegions().then(setDownloadedRegions).catch(() => {});
          }}
        />
      )}

      {/* Модальное окно скачивания столицы */}
      {downloadModalCapital && (
        <DownloadRegionModal
          regionId={downloadModalCapital.replace('capital_', '')}
          isCapital={true}
          capitalId={downloadModalCapital}
          isOpen={!!downloadModalCapital}
          onClose={() => {
            setDownloadModalCapital(null);
            offlineService.getDownloadedRegions().then(setDownloadedRegions).catch(() => {});
          }}
          onDownloadComplete={() => {
            offlineService.getDownloadedRegions().then(setDownloadedRegions).catch(() => {});
          }}
        />
      )}

      {/* Экран Premium */}
      <PremiumScreen
        isOpen={premiumScreenOpen}
        onClose={() => setPremiumScreenOpen(false)}
        feature="Скачивание офлайн-карт"
      />
    </div>
  );
};

export default RegionSelector;

