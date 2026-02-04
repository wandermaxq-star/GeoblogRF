import React, { useEffect, useRef, useState } from 'react';
import { mapFacade } from '../../services/map_facade/index';

import '../../styles/FireMarkers.css';
import { FaLayerGroup, FaMap, FaSatelliteDish, FaGlobe, FaMoon } from 'react-icons/fa';
import { toYandexFormat, fromYandexFormat, validateCoordinates } from '../../utils/coordinateConverter';

interface YandexMapProps {
  center: [number, number] | null;
  zoom: number;
  markers?: Array<{
    id: string; // Изменено с number на string для UUID
    coordinates: [number, number];
    title: string;
    description?: string;
    source?: 'favorites' | 'map-click' | 'search' | 'imported';
  }>;
  onMapClick?: (coordinates: [number, number]) => void;
  onRemoveMarker?: (markerId: string) => void;
  routeLine?: [number, number][];
  displayedRoutePolylines?: Array<{id: string, polyline: [number, number][], color: string}>;
  onMapReady?: (mapInstance?: any) => void;
  autoFitBounds?: boolean; // Добавляем пропс для автоматического масштабирования
  mapLayer?: string; // Добавляем пропс для слоя карты
  zones?: Array<{ severity?: string; polygons: number[][][]; name?: string; type?: string }>;
}

const LAYER_OPTIONS = [
  { value: 'map', label: 'Стандартная', icon: <FaMap color="#222" /> },
  { value: 'satellite', label: 'Спутник', icon: <FaSatelliteDish color="#222" /> },
  { value: 'hybrid', label: 'Гибрид', icon: <FaGlobe color="#222" /> },
  { value: 'dark', label: 'Тёмная', icon: <FaMoon color="#222" /> },
];

const LayersDropdown: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = LAYER_OPTIONS.find(l => l.value === value) || LAYER_OPTIONS[0];
  return (
    <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', zIndex: 50 }}>
      <div className="relative">
        <button
          className="flex items-center px-4 py-2 bg-white/90 rounded-full shadow-lg border border-gray-200 hover:bg-slate-50 transition text-slate-700 font-medium gap-2"
          style={{ minWidth: 120 }}
          onClick={() => setOpen(o => !o)}
        >
          <FaLayerGroup className="text-blue-500" />
          <span className="flex items-center gap-2">{selected.icon} {selected.label}</span>
          <svg className="ml-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open && (
          <div className="absolute left-0 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fade-in-up" style={{ minWidth: 160 }}>
            {LAYER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`w-full flex items-center px-4 py-2 text-left hover:bg-blue-50 transition ${value === opt.value ? 'bg-blue-100 font-semibold' : ''}`}
                onClick={() => {
                  if (opt.value === 'dark') {
                    alert('Тёмная тема в разработке');
                  } else {
                    onChange(opt.value);
                  }
                  setOpen(false);
                }}
                disabled={opt.value === 'dark'}
                style={opt.value === 'dark' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                <span className="mr-2">{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const YandexMap: React.FC<YandexMapProps> = ({ 
  center, 
  zoom, 
  markers = [], 
  onMapClick, 
  onRemoveMarker,
  routeLine, 
  displayedRoutePolylines = [],
  onMapReady,
  autoFitBounds,
  mapLayer: initialMapLayer,
  zones = []
}) => {
  // Вспомогательные функции для горящих меток
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'favorites': return '⭐';
      case 'search': return '🔍';
      case 'map-click': return '📍';
      case 'imported': return '📋';
      default: return '📍';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'favorites': return 'Избранное';
      case 'search': return 'Поиск';
      case 'map-click': return 'Клик по карте';
      case 'imported': return 'Импорт';
      default: return source;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'favorites': return '#fbbf24';
      case 'search': return '#3b82f6';
      case 'map-click': return '#10b981';
      case 'imported': return '#8b5cf6';
      default: return '#10b981';
    }
  };
  // NOTE: mapRef is only the DOM container for Yandex map. Do NOT assign the map instance to this ref.
  // Use `mapFacade()` where map APIs are needed.
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const zonesRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const [mapLayer, setMapLayer] = useState(initialMapLayer || 'map');

  // Обновляем ref при изменении onMapClick
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // useEffect для инициализации карты - ТОЛЬКО ОДИН РАЗ
  useEffect(() => {
    let destroyed = false;

    const loadYandexMaps = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Если уже загружен
        if (window.ymaps) {
          resolve();
          return;
        }

        // Проверяем, не загружается ли уже
        const existingScript = document.querySelector('script[src*="api-maps.yandex.ru"]');
        if (existingScript) {
          let checkAttempts = 0;
          const maxCheckAttempts = 50;
          const checkLoaded = () => {
            if (window.ymaps) {
              resolve();
            } else if (checkAttempts < maxCheckAttempts) {
              checkAttempts++;
              setTimeout(checkLoaded, 100);
            } else {
              reject(new Error('Таймаут ожидания загрузки Yandex Maps'));
            }
          };
          checkLoaded();
          return;
        }
        // Загружаем скрипт
        const script = document.createElement('script');
        script.src = 'https://api-maps.yandex.ru/2.1/?apikey=36b83eab-e2fd-41bd-979d-b9044cfffeab&lang=ru_RU';
        script.async = true;
        
        let resolved = false;
        
        script.onload = () => {
          if (resolved) return;
          resolved = true;
          setTimeout(() => {
            if (window.ymaps) {
              resolve();
            } else {
              reject(new Error('Yandex Maps не загрузился'));
            }
          }, 100);
        };
        
        script.onerror = () => {
          if (resolved) return;
          resolved = true;
          reject(new Error('Ошибка загрузки Yandex Maps скрипта'));
        };
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Таймаут загрузки Yandex Maps'));
          }
        }, 8000);
        
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // КРИТИЧНО: Ждем, пока mapRef.current появится в DOM
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд максимум
        while (!mapRef.current && attempts < maxAttempts && !destroyed) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (destroyed) return;

        if (!mapRef.current) {
          setError('Контейнер карты не найден');
          setIsLoading(false);
          return;
        }

        if (mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) {
          let sizeAttempts = 0;
          const maxSizeAttempts = 50;
          while ((mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) && 
                 sizeAttempts < maxSizeAttempts && !destroyed) {
            await new Promise(resolve => setTimeout(resolve, 100));
            sizeAttempts++;
          }
          
          if (destroyed) return;
          
          if (mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) {
            setError('Контейнер карты не имеет размеров');
            setIsLoading(false);
            return;
          }
        }

        // Загружаем Yandex Maps
        await loadYandexMaps();

        if (destroyed) return;

        if (!mapRef.current) {
          throw new Error('mapRef.current потерян после загрузки Yandex Maps');
        }

        // Уничтожаем предыдущий экземпляр карты
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.destroy();
          } catch (error) {
            // Игнорируем ошибки при уничтожении
          }
          mapInstanceRef.current = null;
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Таймаут ожидания ymaps.ready'));
          }, 5000);
          
          try {
            window.ymaps.ready(() => {
              clearTimeout(timeout);
              resolve();
            });
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });

        // Создание карты
        const mapCenter = center || [55.7558, 37.6176]; // Москва по умолчанию
        mapInstanceRef.current = new window.ymaps.Map(mapRef.current, {
          center: mapCenter,
          zoom,
          controls: ['zoomControl', 'fullscreenControl']
        });

        // Register background API in facade so facade methods can operate on this instance
        try { mapFacade().registerBackgroundApi({ map: mapInstanceRef.current }); } catch (e) { console.debug('[YandexMap] Failed to register with facade', e); }

        // Добавление обработчика клика по карте
        if (!destroyed) {
          mapInstanceRef.current.events.add('click', (e: any) => {
            if (!destroyed && onMapClickRef.current) {
              try {
                const coords = e.get('coords') as [number, number]; // Yandex Maps возвращает [longitude, latitude]
                // Используем функцию конвертации из coordinateConverter
                const ourCoords = fromYandexFormat(coords);
                if (validateCoordinates(ourCoords[0], ourCoords[1])) {
                  onMapClickRef.current(ourCoords);
                }
              } catch {
                // Игнорируем ошибки
              }
            }
          });
        }

        if (!destroyed) {
          setIsLoading(false);
          if (onMapReady) onMapReady(mapInstanceRef.current);
        }
      } catch (err) {
        if (!destroyed) {
          const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
          setError(`Не удалось загрузить карту: ${errorMessage}. Пожалуйста, обновите страницу.`);
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      destroyed = true;
      
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (error) {
          // Игнорируем ошибки при уничтожении
        }
        mapInstanceRef.current = null;
      }

      try { mapFacade().registerBackgroundApi(null); } catch (e) { console.debug('[YandexMap] Failed to unregister from facade', e); }
      
      // Очищаем маркеры
      markersRef.current.forEach(marker => {
        try {
          if (marker && marker.geometry) {
            marker.geometry.setCoordinates([0, 0]);
          }
        } catch (error) {
          // Игнорируем ошибки при очистке
        }
      });
      markersRef.current = [];
    };
  }, []); // Пустой массив зависимостей - инициализация только один раз

  // Helper to resolve map instance prefering facade-registered background API
  const resolveMapInstance = () => {
    try {
      return (mapFacade().getRegisteredApi()?.map ?? mapInstanceRef.current);
    } catch (e) { return mapInstanceRef.current; }
  };

  // useEffect для смены центра и zoom - только при реальных изменениях
  useEffect(() => {
    const mapInst = resolveMapInstance();
    if (!center || !mapInst || !window.ymaps) {
      return;
    }

    // Проверяем, действительно ли изменились координаты
    const currentCenter = mapInst.getCenter();
    const currentZoom = mapInst.getZoom();

    // Центрируем только если изменения значительные (больше 0.01 градуса или 1 уровня зума)
    const centerChanged = Math.abs(currentCenter[0] - center[0]) > 0.01 ||
      Math.abs(currentCenter[1] - center[1]) > 0.01;
    const zoomChanged = Math.abs(currentZoom - zoom) > 1;

    if (centerChanged || zoomChanged) {
      try { mapFacade().setView(center, zoom); } catch (e) { try { mapInst.setCenter(center, zoom); } catch (err) { /* ignore */ } }
    }
  }, [center, zoom]);

  // useEffect для смены типа карты (если поддерживается)
  useEffect(() => {
    if (mapLayer === 'dark') {
      // Не поддерживается, ничего не делаем (alert уже показывается в LayersDropdown)
      return;
    }
    if (mapInstanceRef.current && window.ymaps && typeof mapInstanceRef.current.setType === 'function') {
      let type = 'yandex#map';
      if (mapLayer === 'satellite') type = 'yandex#satellite';
      if (mapLayer === 'hybrid') type = 'yandex#hybrid';
      mapInstanceRef.current.setType(type);
    }
  }, [mapLayer]);

  // Обновление маркеров
  useEffect(() => {
    if (!mapInstanceRef.current || !window.ymaps) {
      return;
    }

    let destroyed = false;

    const updateMarkers = () => {
      if (destroyed) return;

      try {
        // Удаление старых маркеров
        const mapInst = resolveMapInstance();
        markersRef.current.forEach(marker => {
          try {
            if (marker && mapInst) {
              try { mapInst.geoObjects.remove(marker); } catch (err) { /* ignore */ }
            }
          } catch (error) {
            // Игнорируем ошибки при удалении
          }
        });
        markersRef.current = [];
        if (destroyed) return;

        // Добавление новых маркеров с горящими стилями
        markers.forEach((markerData) => {
          if (destroyed) return;
          
          try {
            // Определяем источник метки для стилизации
            const source = markerData.source || 'map-click';
            
            // Создаем HTML-метку с горящими стилями
            // markerData.coordinates уже в правильном формате [latitude, longitude]
            // Yandex Maps Placemark ожидает [longitude, latitude], поэтому переворачиваем
            const yandexCoords = [markerData.coordinates[1], markerData.coordinates[0]];
            
            const marker = new window.ymaps.Placemark(
              yandexCoords,
              {
                balloonContent: `
                  <div class="fire-popup ${source}">
                    <div class="popup-source-icon ${source}"></div>
                    <div class="popup-header">${markerData.title}</div>
                    ${markerData.description ? `<div class="description">${markerData.description}</div>` : ''}
                    <div class="coordinates">[${markerData.coordinates[0].toFixed(4)}, ${markerData.coordinates[1].toFixed(4)}]</div>
                    <div class="source">${getSourceLabel(source)}</div>
                  </div>
                `,
              },
              { 
                // Используем HTML-метку вместо стандартной иконки
                preset: 'islands#redDotIcon',
                iconColor: getSourceColor(source),
                iconContent: `
                  <div class="fire-marker ${source}" style="
                    width: 24px; 
                    height: 24px; 
                    border-radius: 50%; 
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                  ">
                    ${getSourceIcon(source)}
                  </div>
                `
              }
            );
            
            const mapInst = resolveMapInstance();
            if (mapInst && !destroyed) {
              try { mapInst.geoObjects.add(marker); } catch (err) { /* ignore */ }
              markersRef.current.push(marker);
            }
          } catch (error) {
            // Игнорируем ошибки при добавлении маркера
          }
        });

        // Автоматическое масштабирование карты под все маркеры
        if (autoFitBounds && markers.length > 0 && mapInstanceRef.current) {
          try {
            const bounds = markers.reduce((acc, marker) => {
                const [lat, lng] = marker.coordinates; // marker.coordinates содержит [latitude, longitude]
              return {
                minLng: Math.min(acc.minLng, lng),
                maxLng: Math.max(acc.maxLng, lng),
                minLat: Math.min(acc.minLat, lat),
                maxLat: Math.max(acc.maxLat, lat),
              };
            }, {
              minLng: markers[0].coordinates[1], // longitude
              maxLng: markers[0].coordinates[1], // longitude
              minLat: markers[0].coordinates[0], // latitude
              maxLat: markers[0].coordinates[0], // latitude
            });

            // Добавляем небольшой отступ
            const padding = 0.01;
            // Yandex Maps setBounds ожидает [[longitude, latitude], [longitude, latitude]]
            const newBounds = [
              [bounds.minLng - padding, bounds.minLat - padding],
              [bounds.maxLng + padding, bounds.maxLat + padding]
            ];

            try { mapFacade().fitBounds({ southWest: [newBounds[0][1], newBounds[0][0]], northEast: [newBounds[1][1], newBounds[1][0]] }, { padding: 50 }); } catch (e) { const mapInst = resolveMapInstance(); try { mapInst?.setBounds(newBounds, { checkZoomRange: true, duration: 300 }); } catch (err) { /* ignore */ } }
          } catch (error) {
            // Игнорируем ошибки при автоматическом масштабировании
          }
        }
      } catch (error) {
        // Игнорируем ошибки в updateMarkers
      }
    };

    // Вызываем updateMarkers сразу, если карта готова
const mapInst = resolveMapInstance();
      if (mapInst && mapInst.geoObjects) {
      updateMarkers();
    } else {
      // Если карта еще не готова, ждем немного и пробуем снова
      const timeoutId = setTimeout(() => {
        const m = resolveMapInstance();
        if (!destroyed && m && m.geoObjects) {
          updateMarkers();
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        destroyed = true;
      };
    }

    return () => {
      destroyed = true;
    };
  }, [markers]);

  // Обновление запрещенных зон (полигоны)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.ymaps) {
      return;
    }

    let destroyed = false;
    try {
      // Удаляем старые полигоны
      zonesRef.current.forEach(poly => {
        try { mapInstanceRef.current.geoObjects.remove(poly); } catch {}
      });
      zonesRef.current = [];

      const ymaps: any = window.ymaps;
      zones.forEach(z => {
        const color = (z.severity === 'critical') ? '#EF4444' : (z.severity === 'warning') ? '#F59E0B' : '#FB923C';
        z.polygons.forEach(ring => {
          try {
            const polygon = new ymaps.Polygon([ring.map(([lng, lat]) => [lat, lng])], { hintContent: z.name || z.type || 'restricted zone' }, {
              fillColor: color + '33',
              strokeColor: color,
              strokeWidth: 2,
            });
            const mapInst = resolveMapInstance();
            try { mapInst?.geoObjects.add(polygon); } catch (err) { /* ignore */ }
            zonesRef.current.push(polygon);
          } catch {}
        });
      });
    } catch {}

    return () => { destroyed = true; };
  }, [zones]);

  // Обновление линии маршрута
  useEffect(() => {
    if (!mapInstanceRef.current || !window.ymaps) {
      return;
    }

    let destroyed = false;

    const updateRouteLine = () => {
      if (destroyed) return;
    
      try {
        // Удаляем старую линию маршрута
        if (mapInstanceRef.current.routeLine) {
            try {
            mapInstanceRef.current.geoObjects.remove(mapInstanceRef.current.routeLine);
            } catch (error) {
              // Игнорируем ошибки при удалении
            }
          mapInstanceRef.current.routeLine = null;
        }

        if (destroyed) return;

        if (routeLine && routeLine.length > 1) {
          try {
            const ymaps: any = window.ymaps;
            // routeLine приходит в формате [lat, lng] (наш стандарт)
            // Yandex Maps Polyline ожидает [lng, lat] - используем toYandexFormat
            const yandexRouteLine = routeLine.map(p => toYandexFormat(p));
            const polyline = new ymaps.Polyline(yandexRouteLine, {}, {
              strokeColor: '#3B82F6',
              strokeWidth: 5,
              opacity: 0.7,
            });
            
            const mapInst = resolveMapInstance();
            if (mapInst && !destroyed) {
              try { mapInst.geoObjects.add(polyline); } catch (err) { /* ignore */ }
              mapInst.routeLine = polyline;
            }
          } catch (error) {
            // Игнорируем ошибки при создании маршрута
          }
        }
      } catch (error) {
        // Игнорируем ошибки в updateRouteLine
      }
    };

    const timeoutId = setTimeout(updateRouteLine, 100);

    return () => {
      destroyed = true;
      clearTimeout(timeoutId);
    };
  }, [routeLine]);

  // Обновление отображаемых полилиний маршрутов
  useEffect(() => {
    if (!mapInstanceRef.current || !window.ymaps) {
      return;
    }

    let destroyed = false;

    const updateDisplayedPolylines = () => {
      if (destroyed) return;
    
      try {
        // Удаляем старые отображаемые полилинии
        if (mapInstanceRef.current.displayedPolylines) {
          mapInstanceRef.current.displayedPolylines.forEach((polyline: any) => {
            try {
              mapInstanceRef.current.geoObjects.remove(polyline);
            } catch (error) {
              // Игнорируем ошибки при удалении
            }
          });
          mapInstanceRef.current.displayedPolylines = [];
        }

        if (destroyed) return;

        // Добавляем новые отображаемые полилинии
        if (displayedRoutePolylines && displayedRoutePolylines.length > 0) {
          const polylines: any[] = [];
          displayedRoutePolylines.forEach((routePolyline) => {
            if (routePolyline.polyline && routePolyline.polyline.length > 1) {
              try {
                const ymaps: any = window.ymaps;
                // Конвертируем координаты из [lat, lng] в [lng, lat] для Yandex Maps
                const yandexPolyline = routePolyline.polyline.map(([lat, lng]) => [lng, lat]);
                const polyline = new ymaps.Polyline(yandexPolyline, {}, {
                  strokeColor: routePolyline.color || '#3B82F6',
                strokeWidth: 4,
                opacity: 0.6,
              });
              
              const mapInst = resolveMapInstance();
          if (mapInst && !destroyed) {
            try { mapInst.geoObjects.add(polyline); } catch (err) { /* ignore */ }
            polylines.push(polyline);
          }
              } catch (error) {
                // Игнорируем ошибки при создании полилинии
              }
            }
          });
          mapInstanceRef.current.displayedPolylines = polylines;
        }
      } catch (error) {
        // Игнорируем ошибки в updateDisplayedPolylines
      }
    };

    const timeoutId = setTimeout(updateDisplayedPolylines, 100);

    return () => {
      destroyed = true;
      clearTimeout(timeoutId);
    };
  }, [displayedRoutePolylines]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      <LayersDropdown value={mapLayer} onChange={setMapLayer} />
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          zIndex: 1000
        }}>
          <div className="text-lg font-semibold">Загрузка карты...</div>
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 1000
        }}>
          <div className="text-red-600 text-lg font-semibold">{error}</div>
        </div>
      )}
      
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default YandexMap; 