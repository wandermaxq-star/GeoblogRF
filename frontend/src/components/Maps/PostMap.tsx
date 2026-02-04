import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { projectManager } from '../../services/projectManager';
import { mapFacade } from '../../services/map_facade/index';
import { getRenderableRouteGeometry } from '../../services/routeGeometryUtil';
import { getRoutePolyline } from '../../services/routingService';
import MiniMarkerPopup from '../Map/MiniMarkerPopup';
import MarkerPopup from '../Map/MarkerPopup';
import { MarkerData } from '../../types/marker';
import { getMarkerById } from '../../services/markerService';

type LatLng = [number, number];

export interface PostMapAnchor {
  id: string;
  lat: number;
  lon: number;
  title?: string;
  category?: string; // Категория маркера для определения иконки и стиля попапа
  description?: string; // Описание для попапа
}

export interface PostMapProps {
  route?: any | null; // route with saved geometry
  anchors?: PostMapAnchor[]; // connectable waypoints/anchors
  center?: LatLng;
  zoom?: number;
  glBase?: 'opentopo' | 'alidade' | 'osm';
  markerIconUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  onStandardPopupOpen?: () => void; // Callback при открытии стандартного попапа
  onStandardPopupClose?: () => void; // Callback при закрытии стандартного попапа
}

const DEFAULT_CENTER: LatLng = [55.751244, 37.618423];

export const PostMap: React.FC<PostMapProps> = ({
  route,
  anchors = [],
  center,
  zoom = 11,
  glBase = 'opentopo',
  // mapFacade, // Убрано из пропсов, используем глобальный импорт

  markerIconUrl = '/markers/pin.png',
  className,
  style,
  onStandardPopupOpen,
  onStandardPopupClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef<boolean>(false);
  const [miniPopup, setMiniPopup] = useState<{
    marker: any;
    position: { x: number; y: number };
    markerElement?: HTMLElement; // DOM-элемент метки для жёсткой привязки
  } | null>(null);
  const miniPopupPositionRef = useRef<{ x: number; y: number } | null>(null);
  const standardPopupPositionRef = useRef<{ x: number; y: number } | null>(null);
  const standardPopupMarkerElementRef = useRef<HTMLElement | null>(null);
  const [selectedMarkerIdForPopup, setSelectedMarkerIdForPopup] = useState<string | null>(null);
  const [loadedMarkerData, setLoadedMarkerData] = useState<MarkerData | null>(null);
  const isLoadingMarkerRef = useRef<boolean>(false);
  // NOTE: mapRef here is a DOM container ref only — do not use it to access the underlying map instance.
  // For map operations prefer `mapFacade()` or add facade methods.
  const mapRef = useRef<any>(null);
  const popupCloseTimeoutRef = useRef<number | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
  const clickedMarkerElementRef = useRef<HTMLElement | null>(null); // Для управления анимацией метки
  const lastClickedMarkerDataRef = useRef<any>(null); // Сохраняем данные последнего кликнутого маркера

  // Размеры мини-попапа (из CSS)
  const MINI_POPUP_WIDTH = 140;
  const MINI_POPUP_HEIGHT = 200;
  const MINI_POPUP_PADDING = 10; // Отступ от границ карты

  // Размеры маркера (из mapsglAdapter.ts)
  const MARKER_HEIGHT = 44; // Высота маркера
  const MARKER_POPUP_GAP = 2; // Отступ между маркером и попапом (2мм ≈ 2px)
  const MARKER_TOTAL_HEIGHT = MARKER_HEIGHT + MARKER_POPUP_GAP; // Общая высота маркера + отступ
  // Для позиционирования попапа используем отступ 2px от верхней точки маркера
  const POPUP_OFFSET_FROM_MARKER_TOP = MARKER_POPUP_GAP; // 2px выше верхней точки маркера

  // Простая логика: используем сохранённую geometry напрямую
  // Если route.route_data.geometry существует - это уже правильный маршрут по дорогам, используем его
  // Если нет - используем points или перестраиваем только если 2 точки
  const renderableGeometry = useMemo(() => {
    // ПРИОРИТЕТ 1: Если есть сохранённая geometry в route_data - используем её напрямую (это уже правильный маршрут!)
    if (route?.route_data?.geometry && Array.isArray(route.route_data.geometry) && route.route_data.geometry.length >= 2) {
      return route.route_data.geometry;
    }

    // ПРИОРИТЕТ 2: Используем points из route
    if (route?.points && Array.isArray(route.points) && route.points.length >= 2) {
      return route.points;
    }

    // ПРИОРИТЕТ 3: Fallback на getRenderableRouteGeometry
    const fallback = getRenderableRouteGeometry(route);
    if (fallback.length >= 2) {
    }
    return fallback;
  }, [route]);

  // Определяем, «прямая ли линия» (надо перестроить по дорогам)
  const isStraightLine = useCallback((geometry: LatLng[]): boolean => {
    if (!Array.isArray(geometry) || geometry.length < 2) return false;
    if (geometry.length === 2) return true;
    if (geometry.length > 10) return false;
    const start = geometry[0];
    const end = geometry[geometry.length - 1];
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return false;
    const routeDistance = Math.sqrt(dx * dx + dy * dy);
    let maxDeviation = 0;
    for (let i = 1; i < geometry.length - 1; i++) {
      const p = geometry[i];
      const t = ((p[1] - start[1]) * dx + (p[0] - start[0]) * dy) / (dx * dx + dy * dy);
      const proj: LatLng = [start[0] + t * dy, start[1] + t * dx];
      const d = Math.sqrt(Math.pow(p[0] - proj[0], 2) + Math.pow(p[1] - proj[1], 2));
      maxDeviation = Math.max(maxDeviation, d);
    }
    const relativeThreshold = routeDistance * 0.001;
    const absoluteThreshold = 0.001;
    const THRESHOLD = Math.min(relativeThreshold, absoluteThreshold);
    return maxDeviation < THRESHOLD;
  }, []);

  // Получаем ссылку на карту для обновления позиции попапа (через фасад). Оставляем mapRef для обратной совместимости, но основной код использует фасад.
  useEffect(() => {
    if (!initializedRef.current) return;
    const timer = setTimeout(() => {
      // Backwards-compat assignment removed: use `mapFacade()` methods directly in consumers instead of relying on `mapRef`.
      // If you need the raw map instance, call `mapFacade().getMap?.()` at the callsite.
    }, 200);
    return () => clearTimeout(timer);
  }, [initializedRef.current]);

  // Обработка кликов на маркеры - открываем мини-попап
  // Функция для обновления позиции мини-попапа относительно DOM-элемента метки
  const updateMiniPopupPosition = useCallback(() => {
    if (!miniPopup || !miniPopup.markerElement || !containerRef.current) return;

    try {
      const markerElement = miniPopup.markerElement;
      const container = containerRef.current;

      // Получаем позицию метки относительно viewport
      const markerRect = markerElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Вычисляем позицию метки относительно контейнера карты
      // Центр метки по горизонтали
      const markerX = markerRect.left - containerRect.left + markerRect.width / 2;

      // ВЕРХНЯЯ ТОЧКА КАПЛИ - это верхняя граница элемента (markerRect.top)
      // Метка НЕПОДВИЖНА - всегда используем верхнюю границу напрямую
      const markerTopY = markerRect.top - containerRect.top;

      // Попап должен быть строго НАД верхней точкой, не перекрывая её
      // Используем верхнюю точку как базовую позицию
      const markerY = markerTopY;

      miniPopupPositionRef.current = { x: markerX, y: markerY };

      // Обновляем позицию попапа
      setMiniPopup({
        ...miniPopup,
        position: { x: markerX, y: markerY }
      });
    } catch (e) {
    }
  }, [miniPopup]);

  // Функция для обновления позиции стандартного попапа относительно DOM-элемента метки
  const updateStandardPopupPosition = useCallback(() => {
    if (!selectedMarkerIdForPopup || !standardPopupMarkerElementRef.current || !containerRef.current) return;

    try {
      const markerElement = standardPopupMarkerElementRef.current;
      const container = containerRef.current;

      // Получаем позицию метки относительно viewport
      const markerRect = markerElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Вычисляем позицию метки относительно контейнера карты
      // Центр метки по горизонтали
      const markerX = markerRect.left - containerRect.left + markerRect.width / 2;

      // ВЕРХНЯЯ ТОЧКА КАПЛИ - это верхняя граница элемента (markerRect.top)
      // Метка НЕПОДВИЖНА - всегда используем верхнюю границу напрямую
      const markerTopY = markerRect.top - containerRect.top;

      // Попап должен быть строго НАД верхней точкой, не перекрывая её
      // Используем верхнюю точку как базовую позицию
      const markerY = markerTopY;

      standardPopupPositionRef.current = { x: markerX, y: markerY };
    } catch (e) {
    }
  }, [selectedMarkerIdForPopup]);

  useEffect(() => {
    const handleMarkerClick = (e: CustomEvent) => {
      const { marker, position, element } = e.detail;

      // Сохраняем данные маркера для использования в стандартном попапе
      lastClickedMarkerDataRef.current = marker;

      // Сохраняем ссылку на элемент метки для управления анимацией
      if (element) {
        clickedMarkerElementRef.current = element;
        // Сохраняем данные маркера в элементе тоже
        (element as any).__lastMarkerData = marker;

        // Вычисляем позицию попапа относительно DOM-элемента метки
        try {
          const container = containerRef.current;
          if (container) {
            const markerRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Центр метки по горизонтали
            const markerX = markerRect.left - containerRect.left + markerRect.width / 2;
            // ВЕРХНЯЯ ТОЧКА КАПЛИ - это верхняя граница элемента
            // Метка НЕПОДВИЖНА - всегда используем верхнюю границу напрямую
            const markerTopY = markerRect.top - containerRect.top;
            const markerY = markerTopY;

            setMiniPopup({
              marker,
              position: { x: markerX, y: markerY },
              markerElement: element // Сохраняем ссылку на DOM-элемент
            });
            miniPopupPositionRef.current = { x: markerX, y: markerY };
          }
        } catch {
          // Fallback на координаты, если не получилось вычислить через DOM
          if (position) {
            setMiniPopup({ marker, position, markerElement: element });
          } else {
            try {
              const [lon, lat] = [marker.longitude, marker.latitude];
              const p = mapFacade().project([lon, lat]);
              setMiniPopup({ marker, position: { x: p.x, y: p.y }, markerElement: element });
            } catch {
              return;
            }
          }
        }
      } else {
        // Fallback, если элемент не передан
        if (position) {
          setMiniPopup({ marker, position });
        } else {
          try {
            const [lon, lat] = [marker.longitude, marker.latitude];
            const p = mapFacade().project([lon, lat]);
            setMiniPopup({ marker, position: { x: p.x, y: p.y } });
          } catch {
            return;
          }
        }
      }
    };

    window.addEventListener('marker-click', handleMarkerClick as EventListener);

    return () => {
      window.removeEventListener('marker-click', handleMarkerClick as EventListener);
    };
  }, []);

  // Обновляем позицию попапа при изменении зума/движении карты (через фасад)
  useEffect(() => {
    if (!miniPopup || !miniPopup.markerElement) return;

    // Функция обновления позиции с throttling для производительности
    let rafId: number | null = null;
    const updatePosition = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updateMiniPopupPosition();
        rafId = null;
      });
    };

    try {
      mapFacade().onMapMove(updatePosition);
      mapFacade().onMapZoom(updatePosition);
    } catch (e) { }

    const markerElement = miniPopup.markerElement;
    if (markerElement) {
      const observer = new MutationObserver(() => updatePosition());
      observer.observe(markerElement, { attributes: true, attributeFilter: ['style', 'class'], childList: false, subtree: false });

      const intervalId = setInterval(() => {
        if (miniPopup && miniPopup.markerElement) updatePosition();
      }, 16);

      return () => {
        try { mapFacade().offMapMove(updatePosition); } catch (e) { }
        try { mapFacade().offMapZoom(updatePosition); } catch (e) { }
        observer.disconnect();
        clearInterval(intervalId);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    return () => {
      try { mapFacade().offMapMove(updatePosition); } catch (e) { }
      try { mapFacade().offMapZoom(updatePosition); } catch (e) { }
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [miniPopup, updateMiniPopupPosition]);

  // Обновляем позицию стандартного попапа при изменении зума/движении карты
  useEffect(() => {
    if (!selectedMarkerIdForPopup || !standardPopupMarkerElementRef.current) return;

    let rafId: number | null = null;
    const updatePosition = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updateStandardPopupPosition();
        rafId = null;
      });
    };

    try {
      mapFacade().onMapMove(updatePosition);
      mapFacade().onMapZoom(updatePosition);
    } catch (e) { }

    const markerElement = standardPopupMarkerElementRef.current;
    if (markerElement) {
      const observer = new MutationObserver(() => updatePosition());
      observer.observe(markerElement, { attributes: true, attributeFilter: ['style', 'class'], childList: false, subtree: false });

      const intervalId = setInterval(() => {
        if (selectedMarkerIdForPopup && standardPopupMarkerElementRef.current) updatePosition();
      }, 16);

      return () => {
        try { mapFacade().offMapMove(updatePosition); } catch (e) { }
        try { mapFacade().offMapZoom(updatePosition); } catch (e) { }
        observer.disconnect();
        clearInterval(intervalId);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    return () => {
      try { mapFacade().offMapMove(updatePosition); } catch (e) { }
      try { mapFacade().offMapZoom(updatePosition); } catch (e) { }
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selectedMarkerIdForPopup, updateStandardPopupPosition]);

  // УБРАЛИ ВСЮ АВТОМАТИЧЕСКУЮ ПОДСТРОЙКУ КАРТЫ
  // Метка и попап остаются неподвижными, пользователь сам подвинет карту если нужно

  // Загружаем полные данные маркера по ID, если их нет в lastClickedMarkerDataRef
  useEffect(() => {
    if (!selectedMarkerIdForPopup) {
      setLoadedMarkerData(null);
      isLoadingMarkerRef.current = false;
      return;
    }

    // Если уже есть полные данные в lastClickedMarkerDataRef с photo_urls, используем их
    if (lastClickedMarkerDataRef.current &&
      lastClickedMarkerDataRef.current.id === selectedMarkerIdForPopup &&
      lastClickedMarkerDataRef.current.photo_urls &&
      lastClickedMarkerDataRef.current.photo_urls.length > 0) {
      setLoadedMarkerData(lastClickedMarkerDataRef.current);
      return;
    }

    // Иначе загружаем полные данные по ID
    if (!isLoadingMarkerRef.current) {
      isLoadingMarkerRef.current = true;
      getMarkerById(selectedMarkerIdForPopup)
        .then(fullMarkerData => {
          if (fullMarkerData && fullMarkerData.id === selectedMarkerIdForPopup) {
            setLoadedMarkerData(fullMarkerData);
          }
          isLoadingMarkerRef.current = false;
        })
        .catch(() => {
          isLoadingMarkerRef.current = false;
        });
    }
  }, [selectedMarkerIdForPopup]);

  // Метка НЕПОДВИЖНА - никаких анимаций спуска/подъёма
  // Очищаем ссылку на элемент только когда оба попапа закрыты
  // НЕ очищаем при переходе от мини-попапа к стандартному!
  useEffect(() => {
    if (!miniPopup && !selectedMarkerIdForPopup) {
      clickedMarkerElementRef.current = null;
      standardPopupMarkerElementRef.current = null;
      standardPopupPositionRef.current = null;
      setLoadedMarkerData(null);
    }
  }, [miniPopup, selectedMarkerIdForPopup]);

  // Закрытие попапов при начале движения/зума карты (через фасад)
  useEffect(() => {
    const closeMiniPopup = () => { setMiniPopup(null); };
    try {
      mapFacade().onMapMoveStart(closeMiniPopup);
      mapFacade().onMapZoomStart(closeMiniPopup);
    } catch (e) { }
    return () => {
      try {
        mapFacade().offMapMoveStart(closeMiniPopup);
        mapFacade().offMapZoomStart(closeMiniPopup);
      } catch (e) { }
    };
  }, []);

  // Инициализация карты только один раз при монтировании компонента
  // Ждём, пока контейнер будет готов (имеет размеры)
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    const initMap = async () => {
      // Ждём, пока контейнер будет готов и будет иметь размеры
      let mapElement = containerRef.current;
      let attempts = 0;
      const maxAttempts = 50; // 5 секунд максимум (50 * 100ms)

      while ((!mapElement || mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        mapElement = containerRef.current;
        attempts++;
      }

      if (!mapElement) {
        return;
      }

      if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
        return;
      }

      if (initializedRef.current) return; // Проверяем еще раз после ожидания
      initializedRef.current = true;

      try {
        await projectManager.initializeMap(mapElement, {
          provider: 'leaflet',
          center: center || DEFAULT_CENTER,
          zoom,
          markers: [],
          routes: []
        });
        // Backwards-compat assignment removed: consumers should use `mapFacade()` directly.
        setTimeout(() => {
          // If access to raw map instance is required, use `mapFacade().getMap?.()` here instead of assigning to `mapRef`.
        }, 200);
      } catch (e) {
        initializedRef.current = false; // Разрешаем повторную попытку
      }
    };

    initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив зависимостей = инициализация только один раз

  // Реакция на смену базового стиля без реинициализации
  useEffect(() => {
    if (!initializedRef.current) return;
    // try { mapFacade.setBaseStyle(glBase); } catch {}
    // Временно игнорируем смену стиля
  }, [glBase, initializedRef]);

  // Мемоизируем anchors для предотвращения лишних перерендеров
  const memoizedAnchors = useMemo(() => {
    return anchors || [];
  }, [
    Array.isArray(anchors)
      ? anchors.map(a => `${a.id}-${a.lat}-${a.lon}-${a.category || ''}`).join(',')
      : ''
  ]);

  // Сигнатура входных данных, чтобы не перерисовывать без необходимости
  const buildSignature = useCallback((): string => {
    const anchorsSig = (memoizedAnchors || [])
      .filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon))
      .map(a => `${a.id}:${a.lat}:${a.lon}:${a.category || ''}`)
      .join('|');
    const routeSig = Array.isArray(renderableGeometry)
      ? `route:${renderableGeometry.length}`
      : 'route:none';
    const centerSig = center ? `center:${center[0]}:${center[1]}` : 'center:none';
    return `${anchorsSig}__${routeSig}__${centerSig}__${glBase}`;
  }, [memoizedAnchors, renderableGeometry, center, glBase]);

  const lastSignatureRef = useRef<string>("");
  const addedMarkerIdsRef = useRef<Set<string>>(new Set()); // Отслеживаем уже добавленные метки

  // Добавляем маркеры и маршруты после загрузки карты (ждём готовности карты)
  useEffect(() => {
    if (!initializedRef.current) return;

    // Пропускаем перерисовку, если данных нет или не изменились
    const sig = buildSignature();
    const hasAnyAnchors = (memoizedAnchors || []).some(a => Number.isFinite(a.lat) && Number.isFinite(a.lon));
    const hasAnyRoute = Array.isArray(renderableGeometry) && renderableGeometry.length >= 2;
    if (!hasAnyAnchors && !hasAnyRoute) {
      return;
    }
    if (sig === lastSignatureRef.current) {
      return;
    }

    // Используем задержку, чтобы убедиться, что карта полностью загружена
    const timer = setTimeout(async () => {
      try {
        // Очищаем карту перед добавлением новых элементов
        // Non-destructive clear to avoid removing preserved background renderer
        try { mapFacade().clear(); } catch (e) { }
        // Очищаем отслеживание добавленных меток
        addedMarkerIdsRef.current.clear();

        // Дополнительная задержка после clear, чтобы карта успела полностью очиститься
        await new Promise(resolve => setTimeout(resolve, 150));

        // Если есть маршрут с геометрией, добавляем маркеры начала и конца
        let routeStartMarker: PostMapAnchor | null = null;
        let routeEndMarker: PostMapAnchor | null = null;

        // Всегда рисуем маршрут, если есть геометрия
        // Если это прямая линия и идёт перестроение, renderableGeometry будет использовать исходную
        // После перестроения renderableGeometry обновится на перестроенную геометрию
        const shouldDrawRoute = Array.isArray(renderableGeometry) && renderableGeometry.length >= 2;

        if (shouldDrawRoute) {
          // Если сохранённая geometry прямая или отсутствует — достроим по дорогам через ORS
          let geometryForDrawing: LatLng[] = renderableGeometry;
          try {
            const savedLen = Array.isArray(route?.route_data?.geometry) ? route!.route_data!.geometry.length : 0;
            const needsRebuild = (!savedLen || savedLen < 3) || isStraightLine(renderableGeometry);
            if (needsRebuild) {
              const endpoints: LatLng[] = [renderableGeometry[0], renderableGeometry[renderableGeometry.length - 1]];
              const rebuilt = await getRoutePolyline(endpoints, 'driving-car');
              if (Array.isArray(rebuilt) && rebuilt.length > 2) {
                geometryForDrawing = rebuilt as LatLng[];
              }
            }
          } catch { }
          // ВАЖНО: используем ОДНУ итоговую геометрию для линии и маркеров:
          // - если сохранённая geometry существует и НЕ прямая — берём её
          // - иначе берём перестроенную/исходную geometryForDrawing
          const savedGeom: LatLng[] | undefined = Array.isArray(route?.route_data?.geometry)
            ? (route!.route_data!.geometry as LatLng[])
            : undefined;
          const isSavedStraight = Array.isArray(savedGeom) && (savedGeom.length < 3 || isStraightLine(savedGeom));
          const finalGeometry: LatLng[] = (savedGeom && !isSavedStraight) ? savedGeom : geometryForDrawing;

          // Сначала рисуем маршрут (он должен оказаться ниже маркеров)
          const routeForDrawing: any = {
            id: route?.id,
            points: finalGeometry, // Fallback для адаптеров
            color: '#10B981',
            route_data: { geometry: finalGeometry }
          };

          try { mapFacade().drawRoute(routeForDrawing); } catch (e) { }

          // Берём маркеры из finalGeometry
          const geometryForMarkers = finalGeometry;

          // Берём первую и последнюю точку геометрии для маркеров начала и конца
          const startPoint = geometryForMarkers[0];
          const endPoint = geometryForMarkers[geometryForMarkers.length - 1];

          if (Array.isArray(startPoint) && startPoint.length >= 2 &&
            Number.isFinite(startPoint[0]) && Number.isFinite(startPoint[1])) {
            routeStartMarker = {
              id: `route-start-${route?.id || 'default'}`,
              lat: startPoint[0],
              lon: startPoint[1],
              title: 'Начало маршрута'
            };
          }

          if (Array.isArray(endPoint) && endPoint.length >= 2 &&
            Number.isFinite(endPoint[0]) && Number.isFinite(endPoint[1])) {
            routeEndMarker = {
              id: `route-end-${route?.id || 'default'}`,
              lat: endPoint[0],
              lon: endPoint[1],
              title: 'Конец маршрута'
            };
          }

          // Автоматическое центрирование карты для маршрутов (показываем весь маршрут целиком)
          try {
            // Вычисляем границы маршрута из той же геометрии, что используется для отрисовки и маркеров
            const allCoords: LatLng[] = geometryForMarkers.filter((p: any): p is LatLng =>
              Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
            );

            if (allCoords.length >= 2) {
              const lats = allCoords.map((c: LatLng) => c[0]);
              const lngs = allCoords.map((c: LatLng) => c[1]);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              // Добавляем отступы для комфортного просмотра (10% от размера)
              const latPadding = (maxLat - minLat) * 0.1;
              const lngPadding = (maxLng - minLng) * 0.1;

              // Используем fitBounds для показа всего маршрута
              // fitBounds принимает массив координат [southWest, northEast]
              try { mapFacade().fitBounds({ southWest: [minLat - latPadding, minLng - lngPadding], northEast: [maxLat + latPadding, maxLng + lngPadding] }, { padding: 50 }); } catch (e) { } // padding 50px со всех сторон
            }
          } catch (e) {
          }
        }

        // Добавляем маркеры только если маршрут нарисован
        if (shouldDrawRoute) {
          // Добавляем маркер начала маршрута с буквой A
          if (routeStartMarker) {
            try { mapFacade().addMarker({ id: routeStartMarker.id, position: { lat: routeStartMarker.lat, lon: routeStartMarker.lon }, title: routeStartMarker.title, category: 'route', }); } catch (e) { }
          }

          // Добавляем маркер конца маршрута с буквой B
          if (routeEndMarker) {
            try { mapFacade().addMarker({ id: routeEndMarker.id, position: { lat: routeEndMarker.lat, lon: routeEndMarker.lon }, title: routeEndMarker.title, category: 'route', }); } catch (e) { }
          }
        }

        // anchors as markers (обычные якоря, не начала/конца маршрута)
        (memoizedAnchors || []).forEach(a => {
          // Строгая проверка валидности координат
          const lat = Number(a.lat);
          const lon = Number(a.lon);
          const isValid = Number.isFinite(lat) && Number.isFinite(lon) &&
            lat >= -90 && lat <= 90 &&
            lon >= -180 && lon <= 180;

          if (isValid) {
            // Проверяем, что это не дубликат маркера начала/конца маршрута
            const isRouteMarker = a.id === routeStartMarker?.id || a.id === routeEndMarker?.id;
            if (!isRouteMarker) {
              // Убеждаемся, что id - строка
              const markerId = String(a.id || `marker-${Date.now()}-${Math.random()}`);

              // Дополнительная проверка: не добавляем метку, если она уже была добавлена в этом цикле
              if (addedMarkerIdsRef.current.has(markerId)) {
                return; // Пропускаем дубликат
              }

              const markerTitle = a.title || 'Без названия';
              const markerCategory = a.category || 'other';

              // Помечаем метку как добавленную
              addedMarkerIdsRef.current.add(markerId);

              try { mapFacade().addMarker({ id: markerId, position: { lat, lon }, title: markerTitle, category: markerCategory, description: a.description, }); } catch (e) { }

            }
          }
        });

        // Центрируем карту с учетом размера попапов при инициализации
        const allPoints: LatLng[] = [];
        if (routeStartMarker) allPoints.push([routeStartMarker.lat, routeStartMarker.lon]);
        if (routeEndMarker) allPoints.push([routeEndMarker.lat, routeEndMarker.lon]);
        (memoizedAnchors || []).forEach(a => {
          const isRouteMarker = a.id === routeStartMarker?.id || a.id === routeEndMarker?.id;
          if (!isRouteMarker && Number.isFinite(a.lat) && Number.isFinite(a.lon)) {
            allPoints.push([a.lat, a.lon]);
          }
        });
        (renderableGeometry || []).forEach((p: LatLng) => {
          if (Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
            allPoints.push(p as LatLng);
          }
        });

        // Центрируем карту на метки, если нет маршрута
        if (!shouldDrawRoute && memoizedAnchors.length > 0) {
          const validAnchors = memoizedAnchors.filter(a => {
            const lat = Number(a.lat);
            const lon = Number(a.lon);
            return Number.isFinite(lat) && Number.isFinite(lon) &&
              lat >= -90 && lat <= 90 &&
              lon >= -180 && lon <= 180;
          });

          if (validAnchors.length > 0) {
            // Если одна метка - центрируем на ней
            if (validAnchors.length === 1) {
              const anchor = validAnchors[0];
              try {
                // mapFacade.setCenter([Number(anchor.lat), Number(anchor.lon)]);
                // setZoom может отсутствовать, игнорируем если нет
                // if (typeof (mapFacade as any).setZoom === 'function') {
                //   (mapFacade as any).setZoom(13);
                // }
              } catch (e) {
                // Игнорируем ошибки центрирования
              }
            } else {
              // Если несколько меток - используем fitBounds
              const lats = validAnchors.map(a => Number(a.lat));
              const lngs = validAnchors.map(a => Number(a.lon));
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              const latPadding = (maxLat - minLat) * 0.1 || 0.01;
              const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

              try {
                // fitBounds принимает массив координат [southWest, northEast]
                try { mapFacade().fitBounds({ southWest: [minLat - latPadding, minLng - lngPadding], northEast: [maxLat + latPadding, maxLng + lngPadding] }, { padding: 50 }); } catch (e) { }
              } catch (e) {
                // Игнорируем ошибки fitBounds
              }
            }
          }
        }

        // Фиксируем последнюю успешную сигнатуру входных данных
        lastSignatureRef.current = sig;

      } catch (e) {
      }
    }, 150); // Увеличиваем задержку до 150ms для надёжности

    return () => clearTimeout(timer);
  }, [memoizedAnchors, renderableGeometry, center, markerIconUrl, route?.id, buildSignature]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '300px', // Минимальная высота для правильной инициализации карты
        overflow: 'visible', // Важно: позволяем попапам выходить за границы карты
        ...(style || {})
      }}
    >
      {miniPopup && miniPopupPositionRef.current && (
        <div
          style={{
            position: 'absolute',
            left: miniPopupPositionRef.current.x,
            top: miniPopupPositionRef.current.y,
            zIndex: 1200,
            transform: `translate(-50%, calc(-100% - ${POPUP_OFFSET_FROM_MARKER_TOP}px))`, // Попап на 2px выше верхней точки маркера
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease-in-out'
          }}
          onMouseEnter={() => {
            // Отменяем закрытие попапа при наведении на него
            if (popupCloseTimeoutRef.current) {
              clearTimeout(popupCloseTimeoutRef.current);
              popupCloseTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // Закрываем попап с задержкой при уходе курсора с попапа
            popupCloseTimeoutRef.current = window.setTimeout(() => {
              setMiniPopup(null);
              popupCloseTimeoutRef.current = null;
            }, 300);
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <MiniMarkerPopup
              marker={miniPopup.marker}
              onOpenFull={() => {
                if (popupCloseTimeoutRef.current) {
                  clearTimeout(popupCloseTimeoutRef.current);
                  popupCloseTimeoutRef.current = null;
                }
                const markerId = miniPopup.marker.id;

                // ВАЖНО: Сохраняем ссылку на DOM-элемент метки ДО закрытия мини-попапа
                // Иначе useEffect очистит clickedMarkerElementRef и мы потеряем ссылку
                const markerElement = clickedMarkerElementRef.current || miniPopup.markerElement;
                if (markerElement) {
                  standardPopupMarkerElementRef.current = markerElement;
                  // Вычисляем начальную позицию стандартного попапа
                  if (containerRef.current && markerElement) {
                    const container = containerRef.current;
                    const markerRect = markerElement.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    // Центр метки по горизонтали
                    const markerX = markerRect.left - containerRect.left + markerRect.width / 2;
                    // ВЕРХНЯЯ ТОЧКА КАПЛИ - это верхняя граница элемента
                    // Метка НЕПОДВИЖНА - всегда используем верхнюю границу напрямую
                    const markerTopY = markerRect.top - containerRect.top;
                    // Попап должен быть строго НАД верхней точкой
                    standardPopupPositionRef.current = { x: markerX, y: markerTopY };
                  }
                }

                // Закрываем мини-попап перед открытием стандартного
                setMiniPopup(null);
                // Небольшая задержка для плавного перехода
                setTimeout(() => {
                  // Открываем стандартный попап
                  setSelectedMarkerIdForPopup(markerId);
                  // Уведомляем родительский компонент об открытии стандартного попапа
                  onStandardPopupOpen?.();
                }, 50); // Уменьшаем задержку для более быстрого отклика
              }}
              isSelected={false} // Всегда false для постов - не показываем рамку избранного
            />
          </div>
        </div>
      )}
      {/* Стандартный попап */}
      {selectedMarkerIdForPopup && (() => {
        // Ищем маркер среди anchors или используем данные из последнего клика
        let marker = memoizedAnchors.find(a => a.id === selectedMarkerIdForPopup);
        let markerData: MarkerData | null = null;

        // ПРИОРИТЕТ 1: Используем загруженные полные данные (с photo_urls)
        if (loadedMarkerData && loadedMarkerData.id === selectedMarkerIdForPopup) {
          markerData = loadedMarkerData;
          marker = {
            id: loadedMarkerData.id,
            lat: loadedMarkerData.latitude,
            lon: loadedMarkerData.longitude,
            title: loadedMarkerData.title,
            category: loadedMarkerData.category,
            description: loadedMarkerData.description
          };
        }
        // ПРИОРИТЕТ 2: Используем данные из последнего клика (там могут быть полные данные с photo_urls)
        else if (lastClickedMarkerDataRef.current && lastClickedMarkerDataRef.current.id === selectedMarkerIdForPopup) {
          const lastClickedMarker = lastClickedMarkerDataRef.current;
          markerData = lastClickedMarker;
          marker = {
            id: lastClickedMarker.id,
            lat: lastClickedMarker.latitude,
            lon: lastClickedMarker.longitude,
            title: lastClickedMarker.title,
            category: lastClickedMarker.category,
            description: lastClickedMarker.description
          };
        }
        // ПРИОРИТЕТ 3: Используем базовые данные из anchors (photo_urls будут пустыми, но загрузятся через useEffect)
        else if (marker) {
          // Если маркер найден в anchors, но нет данных из клика - загружаем полные данные
          // Пока используем базовые данные, но photo_urls будут пустыми
          markerData = {
            id: marker.id,
            title: marker.title || 'Без названия',
            description: marker.description || '',
            category: marker.category || 'other',
            latitude: marker.lat,
            longitude: marker.lon,
            rating: 0,
            rating_count: 0,
            photo_urls: [], // Будет загружено через useEffect
            hashtags: [],
            author_name: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            likes_count: 0,
            comments_count: 0,
            shares_count: 0
          };
        }

        if (!marker) return null;

        // Используем позицию из ref (вычисленную через DOM-элемент метки)
        // Если позиция ещё не вычислена, вычисляем её сейчас
        if (!standardPopupPositionRef.current && standardPopupMarkerElementRef.current && containerRef.current) {
          try {
            const markerElement = standardPopupMarkerElementRef.current;
            const container = containerRef.current;
            const markerRect = markerElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            // Центр метки по горизонтали
            const markerX = markerRect.left - containerRect.left + markerRect.width / 2;
            // ВЕРХНЯЯ ТОЧКА КАПЛИ - это верхняя граница элемента
            // Метка НЕПОДВИЖНА - всегда используем верхнюю границу напрямую
            const markerTopY = markerRect.top - containerRect.top;
            // Попап должен быть строго НАД верхней точкой
            standardPopupPositionRef.current = { x: markerX, y: markerTopY };
          } catch (e) {
            // Fallback на координаты, если не получилось через DOM
            try {
              const [lon, lat] = [marker.lon, marker.lat];
              const p = mapFacade().project([lon, lat]);
              // Fallback: используем координаты напрямую (метка неподвижна)
              standardPopupPositionRef.current = { x: p.x, y: p.y };
            } catch { }
          }
        }

        // Если позиция всё ещё не вычислена, используем fallback
        if (!standardPopupPositionRef.current) {
          try {
            const [lon, lat] = [marker.lon, marker.lat];
            const p = mapFacade().project([lon, lat]);
            const markerDescentOffset = 20;
            standardPopupPositionRef.current = { x: p.x, y: p.y + markerDescentOffset };
          } catch { }
        }

        if (!standardPopupPositionRef.current) return null;

        // Проверяем, что markerData определён перед рендерингом попапа
        if (!markerData) return null;

        return (
          <div
            key={`popup-${selectedMarkerIdForPopup}`}
            style={{
              position: 'absolute',
              left: standardPopupPositionRef.current.x,
              top: standardPopupPositionRef.current.y,
              transform: `translate(-50%, calc(-100% - ${POPUP_OFFSET_FROM_MARKER_TOP}px - 76px))`, // Поднимаем стандартный попап на 2 см (76px) выше
              zIndex: 1300, // Выше мини-попапа
              width: '205px',
              height: '285px',
            }}
          >
            <MarkerPopup
              marker={markerData}
              onClose={() => {
                setSelectedMarkerIdForPopup(null);
                standardPopupMarkerElementRef.current = null;
                standardPopupPositionRef.current = null;
                // Уведомляем родительский компонент о закрытии стандартного попапа
                onStandardPopupClose?.();
              }}
              onMarkerUpdate={() => { }}
              onAddToFavorites={() => { }}
              isFavorite={false}
              isSelected={false}
            />
          </div>
        );
      })()}
    </div>
  );
};

export default PostMap;


