import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MarkerData } from '../types/marker';
import { 
  FaTrash, 
  FaRoute, 
  FaClipboardList, 
  FaSearch, 
  FaCompass, 
  FaHeart,
  FaMapMarkerAlt,
  FaChevronDown,
  FaChevronUp,
  FaUsers,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaDownload,
  FaSort,
  FaEdit,
  FaShare,
  FaArrowLeft,
  FaTimes
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useLayoutState } from '../contexts/LayoutContext';
import { useContentStore } from '../stores/contentStore';
import { RouteData, EnhancedRouteData } from '../types/route';
import { getRoutes, createRoute, deleteRoute, updateRoute } from '../api/routes';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { getRouteVisualClasses, getMarkerVisualClasses } from '../utils/visualStates';
import { activityService } from '../services/activityService';
import ReportButton from './Moderation/ReportButton';

import RouteEditor from './Planner/RouteEditor';
import { GlassPanel, GlassHeader, GlassButton } from './Glass';
import './FavoritesPanel.css';

type GroupType = 'all' | 'category';

interface FavoritesPanelProps {
  favorites: MarkerData[];
  routes: RouteData[];
  isVip: boolean;
  onRemove: (id: string) => void;
  onClose: () => void;
  onBuildRoute: (ids: string[]) => void;
  onMoveToPlanner: (ids: string[]) => void;
  onMoveToMap?: (ids: string[]) => void;
  mode: 'map' | 'planner';
  onLoadRoute: (route: RouteData, mode?: 'map' | 'planner') => void;
  onRouteToggle?: (route: RouteData, checked: boolean, mode: 'map' | 'planner') => void;
  initialTab?: 'places' | 'routes' | 'events';
  onRouteSaved?: () => void;
  selectedMarkerIds: string[];
  onSelectedMarkersChange: (ids: string[]) => void;
  selectedRouteIds: string[];
  onSelectedRouteIdsChange: (ids: string[]) => void;
  isOpen?: boolean;
  /** Ограничить панель активной зоной карты (для двухоконного режима) */
  constrainToMapArea?: boolean;
}

const groupOptions = [
  { value: 'all', label: 'Все' },
  { value: 'category', label: 'По тематике' },
];

const tabOptions = [
  { key: 'places', label: 'Метки', icon: <FaMapMarkerAlt /> },
  { key: 'routes', label: 'Маршруты', icon: <FaRoute /> },
  { key: 'events', label: 'События', icon: <FaCalendarAlt /> },
];

const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  favorites,
  routes: routesFromProps, // Переименовываем пропс, чтобы избежать конфликта
  isVip,
  onRemove,
  onClose,
  onBuildRoute,
  onMoveToPlanner,
  onMoveToMap,
  mode,
  onLoadRoute,
  onRouteToggle,
  initialTab = 'places',
  onRouteSaved,
  selectedMarkerIds,
  onSelectedMarkersChange,
  selectedRouteIds,
  onSelectedRouteIdsChange,
  isOpen,
  constrainToMapArea = false,
}) => {

  const [activeTab, setActiveTab] = useState<'places' | 'routes' | 'events'>(initialTab as any);
  const [groupBy, setGroupBy] = useState<GroupType>('all');
  const [search, setSearch] = useState('');
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeSortBy, setRouteSortBy] = useState<'createdAt_desc' | 'createdAt_asc' | 'points_desc' | 'points_asc' | 'title_asc'>('createdAt_desc');
  const [routeSearch, setRouteSearch] = useState('');
  const [openSection, setOpenSection] = useState<string>('markers');
  const [routeViewMode, setRouteViewMode] = useState<'manage' | 'saved'>('saved');
  
  // Состояния для работы с событиями
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  
  // Новые состояния для работы с маршрутами
  const [editingRoute, setEditingRoute] = useState<EnhancedRouteData | null>(null);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  
  // Состояние для выбранных маршрутов теперь управляется извне
  
  const authContext = useAuth();
  const navigate = useNavigate();
  const layoutContext = useLayoutState();
  const favoritesContext = useFavorites();

  // Проверяем, что все контексты загружены
  if (!authContext || !layoutContext || !favoritesContext) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка панели избранного...</p>
        </div>
      </div>
    );
  }

  const { token } = authContext;
  // Используем store для управления панелями (если нужно)
  // const setLeftContent = useContentStore((state) => state.setLeftContent);
  const { clearDuplicates } = favoritesContext;
  const favoriteEvents = favoritesContext.favoriteEvents || [];

  // Диагностика дубликатов в избранном (c защитой от некорректных координат)
  const duplicateInfo = useMemo(() => {
    try {
    const normalizeTitle = (t?: string) => (t || '').trim().toLowerCase();
    const seenIds = new Set<string>();
    const seenCoordTitle = new Set<string>();
    let duplicates = 0;
    for (const m of favorites) {
        if (!m) continue;
        const idKey = String(m.id ?? '');
        const latNum = Number((m as any).latitude);
        const lonNum = Number((m as any).longitude);
        const latKey = Number.isFinite(latNum) ? latNum.toFixed(6) : 'na';
        const lonKey = Number.isFinite(lonNum) ? lonNum.toFixed(6) : 'na';
        const comboKey = `${normalizeTitle((m as any).title || '')}|${latKey}|${lonKey}`;
      if (seenIds.has(idKey) || seenCoordTitle.has(comboKey)) {
        duplicates++;
        continue;
      }
      seenIds.add(idKey);
      seenCoordTitle.add(comboKey);
    }
    const total = favorites.length;
    const uniqueCount = total - duplicates;
    return { hasDuplicates: duplicates > 0, duplicates, uniqueCount, total };
    } catch {
      return { hasDuplicates: false, duplicates: 0, uniqueCount: favorites.length, total: favorites.length };
    }
  }, [favorites]);

  // Инициализируем маршрутами из пропсов (например, из FavoritesContext)
  // Используем useMemo для предотвращения бесконечного цикла
  const routesFromPropsMemoized = useMemo(() => {
    if (!Array.isArray(routesFromProps)) return [];
    return routesFromProps;
  }, [routesFromProps?.length, routesFromProps?.map(r => r.id).join(',')]);

  useEffect(() => {
    if (routesFromPropsMemoized.length > 0) {
      setRoutes(prev => {
        const byId = new Map<string, RouteData>();
        [...routesFromPropsMemoized, ...prev].forEach(r => byId.set(r.id, r));
        const newRoutes = Array.from(byId.values());
        // Проверяем, действительно ли изменились маршруты
        const prevIds = JSON.stringify(prev.map(r => r.id).sort());
        const newIds = JSON.stringify(newRoutes.map(r => r.id).sort());
        return prevIds === newIds ? prev : newRoutes;
      });
    }
  }, [routesFromPropsMemoized]);

  // Функция загрузки маршрутов (мемоизированная с useCallback)
  const loadRoutes = useCallback(async () => {
    if (!token) return;
    
    setLoadingRoutes(true);
    try {
      const loadedRoutes = await getRoutes();
      // Нормализуем точки маршрутов в единое поле route.points
      const byFavId = new Map(favorites.map(m => [String(m.id), m]));
      const normalize = (r: RouteData): RouteData => {
        try {
          const rdRaw: any = (r as any).route_data;
          const rd = typeof rdRaw === 'string' ? (JSON.parse(rdRaw) || {}) : (rdRaw || {});
          
          let pts: any[] = Array.isArray(r.points) && r.points.length > 0 ? r.points : (Array.isArray(rd.points) ? rd.points : []);
          if ((!Array.isArray(pts) || pts.length === 0) && Array.isArray(r.waypoints) && r.waypoints.length > 0) {
            // Гидратация из waypoints по избранным меткам
            pts = r.waypoints
              .map((wp: any) => byFavId.get(String(wp.marker_id)))
              .filter(Boolean)
              .map((m: any, idx: number) => {
                // ПРИОРИТЕТ: сначала пробуем явные поля latitude/longitude
                let lat = m.latitude;
                let lon = m.longitude;
                
                // ФОЛБЭК: если нет явных полей, пробуем coordinates
                if ((lat === undefined || lat === null || isNaN(lat)) && Array.isArray(m.coordinates) && m.coordinates.length >= 2) {
                  // Предполагаем, что coordinates[0] = lat, coordinates[1] = lon для favoritePlaces
                  lat = m.coordinates[0];
                  lon = m.coordinates[1];
                }
                
                return {
                id: m.id,
                title: m.title,
                description: m.description,
                  latitude: Number(lat),
                  longitude: Number(lon),
                orderIndex: idx
                };
              });
          }
          // Нормализация координат и отсеивание 0,0
          // ВАЖНО: точки приходят в формате { latitude, longitude }, используем их напрямую
          const norm = (pts || []).map((p: any, idx: number) => {
            // Пытаемся извлечь координаты, сначала из явных полей latitude/longitude
            let lat: number | null = Number(p?.latitude);
            let lon: number | null = Number(p?.longitude);
            
            // Если координаты не валидны или перепутаны, пробуем исправить
            const latIsInRange = lat >= -90 && lat <= 90;
            const lonIsInRange = lon >= -180 && lon <= 180;
            
            if (!latIsInRange || !lonIsInRange) {
              // Если координаты не в правильных диапазонах, может быть они перепутаны?
              // Например, если lat > 90, значит это может быть lon
              // Пробуем поменять местами
              if (!latIsInRange && lonIsInRange) {
                // Пробуем поменять местами, но только если после обмена оба попадают в нужные диапазоны
                const swappedLat = Number(p?.longitude);
                const swappedLon = Number(p?.latitude);
                if (swappedLat >= -90 && swappedLat <= 90 && swappedLon >= -180 && swappedLon <= 180) {
                  lat = swappedLat;
                  lon = swappedLon;
              }
            }
            }
            
            // Проверяем валидность
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              // Пробуем fallback на favoritePlaces
              const fav = byFavId.get(String(p?.id));
              if (fav) {
                lat = Number(fav.latitude);
                lon = Number(fav.longitude);
                }
              }
            
            return {
              id: String(p?.id || `pt-${idx}`),
              title: p?.title || `Точка ${idx+1}`,
              description: p?.description || '',
              latitude: lat as any,
              longitude: lon as any
            };
          }).filter((p: any) => {
            const isValid = Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
            const latInRange = p.latitude >= -90 && p.latitude <= 90;
            const lonInRange = p.longitude >= -180 && p.longitude <= 180;
            return isValid && latInRange && lonInRange;
          });
          return { ...r, points: norm } as RouteData;
        } catch { return r; }
      };
      const normalizedLoaded = loadedRoutes.map(normalize);
      // Мержим с маршрутами, пришедшими через пропсы
      const incoming: RouteData[] = routesFromPropsMemoized || [];
      const byId = new Map<string, RouteData>();
      [...incoming.map(normalize), ...normalizedLoaded].forEach((r: RouteData) => byId.set(r.id, r));
      const finalRoutes = Array.from(byId.values());
      setRoutes(finalRoutes);

      // Синхронизируем в FavoritesContext → Личный кабинет (автодобавление)
      try {
        const fr = (favoritesContext as any)?.favoriteRoutes || [];
        const byIdFav = new Set(fr.map((r: any) => String(r.id)));
        finalRoutes.forEach((r: RouteData) => {
          const rid = String(r.id);
          if (!byIdFav.has(rid)) {
            const pts = (r.points || []).map((p: any, idx: number) => ({ id: p.id || `pt-${idx}` , latitude: Number(p.latitude ?? p?.lat ?? (Array.isArray(p?.coordinates)?p.coordinates[0]:undefined)), longitude: Number(p.longitude ?? p?.lon ?? p?.lng ?? (Array.isArray(p?.coordinates)?p.coordinates[1]:undefined)) }));
            (favoritesContext as any)?.addFavoriteRoute?.({
              id: rid,
              title: r.title || 'Без названия',
              distance: 0,
              duration: 0,
              rating: 0,
              isOriginal: true,
              tags: Array.isArray((r as any).tags) ? (r as any).tags : [],
              description: r.description || '',
              visibility: 'private',
              usageCount: 0,
              relatedContent: (r as any).relatedContent || {},
              created_at: r.createdAt || new Date().toISOString(),
              updated_at: r.updatedAt || new Date().toISOString(),
              points: pts,
              categories: { personal: true, post: false, event: false }
            });
          }
        });
      } catch {}
    } catch (error) {
      console.error('Ошибка загрузки маршрутов:', error);
      setRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  }, [token, favorites, routesFromPropsMemoized, favoritesContext]);

  // Загрузка маршрутов при открытии вкладки 'Маршруты'
  useEffect(() => {
    if (activeTab === 'routes' && token) {
      loadRoutes();
    }
  }, [activeTab, token, loadRoutes]);

  // Фильтрация и сортировка маршрутов
  const filteredSortedRoutes = useMemo(() => {
    let filtered = routes;
    if (routeSearch.trim()) {
      filtered = filtered.filter(r => (r.title || '').toLowerCase().includes(routeSearch.trim().toLowerCase()));
    }
    switch (routeSortBy) {
      case 'createdAt_asc':
        filtered = [...filtered].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        break;
      case 'createdAt_desc':
        filtered = [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'points_asc':
        filtered = [...filtered].sort((a, b) => (a.points?.length || 0) - (b.points?.length || 0));
        break;
      case 'points_desc':
        filtered = [...filtered].sort((a, b) => (b.points?.length || 0) - (a.points?.length || 0));
        break;
      case 'title_asc':
        filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      default:
        break;
    }
    return filtered;
  }, [routes, routeSortBy, routeSearch]);

  // Фильтрация событий
  const filteredEvents = useMemo(() => {
    let filtered = favoriteEvents || [];
    if (eventSearch.trim()) {
      filtered = filtered.filter((event: any) => 
        (event.title || '').toLowerCase().includes(eventSearch.trim().toLowerCase()) ||
        (event.location || '').toLowerCase().includes(eventSearch.trim().toLowerCase())
      );
    }
    return filtered;
  }, [favoriteEvents, eventSearch]);

  // Удаление маршрута
  const handleDeleteRoute = async (id: string) => {
    if (!token) return;
    try {
      // Политика удаления: если помечен для блогов/постов/событий и уже связан с контентом — блокируем
      const favRoute = (favoritesContext as any)?.favoriteRoutes?.find((r: any) => String(r.id) === String(id));
      const categories = favRoute?.categories || { personal: true, post: false, event: false };
      const related = favRoute?.relatedContent || {};

      const hasCategoryMark = Boolean(categories.post || categories.event);
      const hasBoundContent = Boolean((related.posts && related.posts.length) || (related.events && related.events.length));

      if (hasCategoryMark && hasBoundContent) {
        alert('❌ Нельзя удалить маршрут: он уже используется в контенте (пост/событие). Сначала отвяжите контент.');
        return;
      }

      if (hasCategoryMark && !hasBoundContent) {
        const confirmUnmark = confirm('Маршрут помечен для постов/событий. Снять пометки и удалить?');
        if (!confirmUnmark) return;
        try {
          (favoritesContext as any)?.updateFavoriteRoute?.(id, { categories: { personal: true, post: false, event: false } });
        } catch {}
      }

      const confirmDeleteEverywhere = confirm('Маршрут будет удалён из избранного и личного кабинета. Продолжить?');
      if (!confirmDeleteEverywhere) return;

      await deleteRoute(id, token);
      // Локально убираем из списка маршрутов и из выбранных
      setRoutes(prev => prev.filter(r => r.id !== id));
      onSelectedRouteIdsChange(selectedRouteIds.filter(rid => rid !== id));
      // Синхронизируем с избранным профиля, если там хранились копии
      try { (favoritesContext as any).removeFavoriteRoute?.(id); } catch {}
      if (onRouteSaved) onRouteSaved();
      alert('✅ Маршрут удалён');
    } catch (error) {
      alert('❌ Не удалось удалить маршрут');
    }
  };

  // Очистка битых/технических меток (например, "Точка 1/2" или с некорректными координатами)
  const handleCleanupInvalidMarkers = () => {
    try {
      const isBadTitle = (t?: string) => {
        const s = (t || '').trim().toLowerCase();
        return /^точка\s*\d+$/i.test(s) || s === 'точка 1' || s === 'точка 2';
      };
      const isValidCoord = (lat: any, lon: any) => {
        const la = Number(lat);
        const lo = Number(lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
        if (Math.abs(la) > 90 || Math.abs(lo) > 180) return false;
        if (Math.abs(la) < 0.0001 && Math.abs(lo) < 0.0001) return false;
        return true;
      };
      const toRemove = favorites.filter(m => isBadTitle((m as any).title) || !isValidCoord((m as any).latitude, (m as any).longitude));
      if (toRemove.length === 0) {
        alert('Битых технических меток не найдено');
        return;
      }
      const ok = confirm(`Найдено ${toRemove.length} битых меток. Удалить их из избранного?`);
      if (!ok) return;
      try {
        toRemove.forEach(m => { try { (favoritesContext as any).removeFavoritePlace?.(m.id); } catch {} });
      } catch {}
      // Снять выделение удалённых
      try {
        const remaining = selectedMarkerIds.filter(id => !toRemove.some(m => m.id === id));
        onSelectedMarkersChange(remaining);
      } catch {}
      alert(`Удалено ${toRemove.length} меток`);
    } catch (e) {
      alert('Не удалось выполнить очистку меток');
    }
  };

  // Функция для очистки поврежденных маршрутов
  const handleCleanupCorruptedRoutes = async () => {
    if (!token) return;
    
    try {
      setLoadingRoutes(true);
      
      const corruptedRoutes = routes.filter(route => {
        if (!route.points || !Array.isArray(route.points)) return true;
        
        const validPoints = route.points.filter(point => 
          point && 
          typeof point === 'object' &&
          typeof point.latitude === 'number' && 
          typeof point.longitude === 'number' &&
          !isNaN(point.latitude) && 
          !isNaN(point.longitude) &&
          point.latitude >= -90 && point.latitude <= 90 &&
          point.longitude >= -180 && point.longitude <= 180
        );
        
        return validPoints.length !== route.points.length || validPoints.length < 2;
      });
      
      if (corruptedRoutes.length === 0) {
        alert('Поврежденных маршрутов не найдено!');
        return;
      }
      
      const confirmCleanup = confirm(
        `Найдено ${corruptedRoutes.length} поврежденных маршрутов:\n\n` +
        `${corruptedRoutes.map(r => `• ${r.title}`).join('\n')}\n\n` +
        `Удалить их все?`
      );
      
      if (confirmCleanup) {
        for (const route of corruptedRoutes) {
          try {
            await deleteRoute(route.id, token);
          } catch (error) {
          }
        }
        
        alert(`Удалено ${corruptedRoutes.length} поврежденных маршрутов.`);
        // Обновляем список маршрутов без перезагрузки
        setRoutes(prev => prev.filter(route => !corruptedRoutes.some(corrupted => corrupted.id === route.id)));
      }
    } catch (error) {
      alert('Ошибка при очистке маршрутов');
    } finally {
      setLoadingRoutes(false);
      }
  };

  // Создание нового маршрута из выбранных меток
  const handleCreateRoute = async () => {
    if (selectedMarkerIds.length === 0 || !token) return;
    
    try {
      setLoadingRoutes(true);
      
      // Получаем данные выбранных меток
      const selectedMarkers = favorites.filter(marker => selectedMarkerIds.includes(marker.id));
      
      // Создаем маршрут с расширенными данными
      const routeData = {
        title: `Маршрут из ${selectedMarkerIds.length} мест`,
        description: `Автоматически созданный маршрут: ${selectedMarkers.map(m => m.title || '').join(', ')}`,
        route_data: {
          points: selectedMarkers.map(marker => ({
            id: marker.id,
            latitude: marker.latitude,
            longitude: marker.longitude,
            title: marker.title || '',
            description: marker.description || ''
          })),
          metadata: {
            totalDistance: 0,
            estimatedDuration: 0,
            estimatedCost: 0,
            difficultyLevel: 1,
            transportType: ['car'],
            tags: selectedMarkers.map(m => m.category).filter(Boolean)
          },
          settings: {
            isPublic: true
          }
        },
        waypoints: selectedMarkerIds.map((id, index) => ({
          marker_id: id,
          order_index: index
        }))
      };
      
      const newRoute = await createRoute(routeData, token);
      
      // Создаем активность для создания маршрута
      await activityService.createActivityHelper(
        'route_created',
        'route',
        newRoute.id,
        {
          title: newRoute.title,
          pointsCount: selectedMarkerIds.length,
          markers: selectedMarkers.map(m => ({ id: m.id, title: m.title }))
        }
      );
      
      setRoutes(prev => [newRoute, ...prev]);
      // Убираем добавление в избранное здесь; добавляем после выбора категории в Planner.handleCategoryConfirm
      
      if (onRouteSaved) onRouteSaved();
      onSelectedMarkersChange([]);
      
      // Показываем уведомление об успехе
      alert(`✅ Маршрут "${newRoute.title || 'Без названия'}" успешно создан!`);
      
    } catch (error) {
      alert('❌ Ошибка при создании маршрута: ' + (error as Error).message);
    } finally {
      setLoadingRoutes(false);
    }
  };

  // Редактирование маршрута
  const handleEditRoute = (route: RouteData) => {
    // Извлекаем данные из route_data при наличии
    const rd: any = (route as any).route_data || {};
    let derivedPoints: any[] = Array.isArray(route.points) && route.points.length > 0 ? route.points : (Array.isArray(rd.points) ? rd.points : []);
    // Нормализуем точки маршрута в единый формат полей latitude/longitude
    if (Array.isArray(derivedPoints) && derivedPoints.length > 0) {
      derivedPoints = derivedPoints.map((p: any, idx: number) => {
        const candidates: Array<[number|null, number|null]> = [];
        candidates.push([Number(p?.latitude), Number(p?.longitude)]);
        candidates.push([Number(p?.lat), Number(p?.lon || p?.lng)]);
        if (Array.isArray(p?.coordinates) && p.coordinates.length >= 2) {
          const a = Number(p.coordinates[0]);
          const b = Number(p.coordinates[1]);
          if (Number.isFinite(a) && Number.isFinite(b)) {
            if (Math.abs(a) <= 90 && Math.abs(b) <= 180) candidates.push([a,b]);
            if (Math.abs(b) <= 90 && Math.abs(a) <= 180) candidates.push([b,a]);
          }
        }
        let lat: number|null = null, lon: number|null = null;
        for (const [la, lo] of candidates) {
          if (la != null && lo != null && isFinite(la) && isFinite(lo)) { lat = la; lon = lo; break; }
        }
        return {
          id: p.id || p.markerId || `pt-${idx}`,
          title: p.title || p.name || `Точка ${idx+1}`,
          description: p.description || p.notes || '',
          latitude: lat,
          longitude: lon,
          orderIndex: typeof p.orderIndex === 'number' ? p.orderIndex : idx
        };
      });
    }
    // Фолбэк: восстанавливаем точки из waypoints по избранным меткам
    if ((!Array.isArray(derivedPoints) || derivedPoints.length === 0) && Array.isArray(route.waypoints) && route.waypoints.length > 0) {
      const markersById = new Map(favorites.map(m => [m.id, m]));
      derivedPoints = route.waypoints
        .map(wp => markersById.get(wp.marker_id))
        .filter(Boolean)
        .map((m: any, idx: number) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          latitude: m.latitude ?? (Array.isArray(m.coordinates) ? m.coordinates[0] : undefined),
          longitude: m.longitude ?? (Array.isArray(m.coordinates) ? m.coordinates[1] : undefined),
          orderIndex: idx
        }));
    }
    const derivedMetadata = rd.metadata || {};
    const derivedSettings = rd.settings || {};

    // Преобразуем RouteData в EnhancedRouteData для редактора
    const toRad = (deg: number) => deg * Math.PI / 180;
    const computeDistanceKm = (pts: any[]): number => {
      if (!Array.isArray(pts) || pts.length < 2) return 0;
      const extract = (p: any): [number|null, number|null] => {
        const cands: Array<[number|null, number|null]> = [];
        cands.push([Number(p?.latitude), Number(p?.longitude)]);
        cands.push([Number(p?.lat), Number(p?.lon || p?.lng)]);
        if (Array.isArray(p?.coordinates) && p.coordinates.length >= 2) {
          const a = Number(p.coordinates[0]);
          const b = Number(p.coordinates[1]);
          if (Number.isFinite(a) && Number.isFinite(b)) {
            if (Math.abs(a) <= 90 && Math.abs(b) <= 180) cands.push([a,b]);
            if (Math.abs(b) <= 90 && Math.abs(a) <= 180) cands.push([b,a]);
          }
        }
        for (const [la, lo] of cands) {
          if (la != null && lo != null && isFinite(la) && isFinite(lo)) return [la, lo];
        }
        return [null, null];
      };
      let d = 0;
      for (let i=1;i<pts.length;i++){
        const [lat1, lon1] = extract(pts[i-1]);
        const [lat2, lon2] = extract(pts[i]);
        if ([lat1,lon1,lat2,lon2].every(v => typeof v === 'number')){
          const R = 6371;
          const dLat = toRad((lat2 as number)-(lat1 as number));
          const dLon = toRad((lon2 as number)-(lon1 as number));
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1 as number))*Math.cos(toRad(lat2 as number))*Math.sin(dLon/2)**2;
          const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          d += R*c;
        }
      }
      return Math.round(d*10)/10;
    };

    // Фиксация пропущенных координат по избранным меткам и ID
    try {
      const byFavId = new Map(favorites.map(m => [m.id, m]));
      derivedPoints = (derivedPoints || []).map((p: any, idx: number) => {
        const hasLat = Number.isFinite(Number(p?.latitude));
        const hasLon = Number.isFinite(Number(p?.longitude));
        if (hasLat && hasLon) return p;
        const fromFav = byFavId.get(p?.id);
        if (fromFav) {
          return {
            ...p,
            latitude: Number(fromFav.latitude),
            longitude: Number(fromFav.longitude),
            title: p.title || fromFav.title || `Точка ${idx+1}`,
            description: p.description || fromFav.description || ''
          };
        }
        // Попытка из coordinates
        if (Array.isArray(p?.coordinates) && p.coordinates.length >= 2) {
          const a = Number(p.coordinates[0]);
          const b = Number(p.coordinates[1]);
          const lat = (Math.abs(a) <= 90 && Math.abs(b) <= 180) ? a : ((Math.abs(b) <= 90 && Math.abs(a) <= 180) ? b : null);
          const lon = (Math.abs(a) <= 90 && Math.abs(b) <= 180) ? b : ((Math.abs(b) <= 90 && Math.abs(a) <= 180) ? a : null);
          if (lat != null && lon != null) {
            return { ...p, latitude: lat, longitude: lon };
          }
        }
        return p;
      });
    } catch {}

    const initialDistance = computeDistanceKm(derivedPoints as any[]);
    const transport = (Array.isArray(derivedMetadata.transportType) && derivedMetadata.transportType[0]) || 'car';
    const speeds: Record<string, number> = { car: 60, walk: 5, bike: 15, bus: 40, train: 80 };
    const durationH = initialDistance > 0 ? Math.round((initialDistance / (speeds[transport] || 60)) * 10) / 10 : 0;
    const costRub = transport === 'car' ? Math.round(((initialDistance * (derivedMetadata.fuelConsumptionLPer100km || 8)) / 100) * (derivedMetadata.fuelPriceRub || 66)) : 0;

    const enhancedRoute: EnhancedRouteData = {
      id: route.id,
      title: route.title || '',
      description: route.description || '',
      points: derivedPoints as any,
      waypoints: route.waypoints?.map(wp => ({
        id: wp.marker_id,
        markerId: wp.marker_id,
        orderIndex: wp.order_index,
        arrivalTime: wp.arrival_time,
        departureTime: wp.departure_time,
        durationMinutes: wp.duration_minutes,
        notes: wp.notes,
        isOvernight: wp.is_overnight
      })) || [],
      metadata: {
        totalDistance: Number((route as any).totalDistance || derivedMetadata.totalDistance || initialDistance || 0),
        estimatedDuration: Number((route as any).estimatedDuration || derivedMetadata.estimatedDuration || durationH || 0),
        estimatedCost: Number((route as any).estimatedCost || derivedMetadata.estimatedCost || costRub || 0),
        difficultyLevel: Number(derivedMetadata.difficultyLevel || 1),
        transportType: Array.isArray(derivedMetadata.transportType) ? derivedMetadata.transportType : ['car'],
        tags: Array.isArray(derivedMetadata.tags) ? derivedMetadata.tags : []
      },
      settings: {
        isPublic: Boolean(derivedSettings.isPublic),
        startDate: derivedSettings.startDate,
        endDate: derivedSettings.endDate
      },
      stats: {
        likesCount: 0,
        viewsCount: 0,
        sharesCount: 0
      },
      createdAt: route.createdAt || new Date().toISOString(),
      updatedAt: route.updatedAt || new Date().toISOString()
    };
    
    setEditingRoute(enhancedRoute);
    setShowRouteEditor(true);
  };

  // Сохранение изменений маршрута
  const handleSaveRouteChanges = async (routeId: string, updates: Partial<EnhancedRouteData>) => {
    if (!token) return;
    
    try {
      // Преобразуем EnhancedRouteData в UpdateRouteDto
      const updateData = {
        title: updates.title,
        description: updates.description,
        route_data: {
          points: updates.points,
          metadata: updates.metadata,
          settings: updates.settings
        },
        waypoints: updates.waypoints?.map(wp => ({
          marker_id: wp.markerId,
          order_index: wp.orderIndex,
          arrival_time: wp.arrivalTime,
          departure_time: wp.departureTime,
          duration_minutes: wp.durationMinutes,
          notes: wp.notes,
          is_overnight: wp.isOvernight
        }))
      };
      
      const updatedRoute = await updateRoute(routeId, updateData, token);
      setRoutes(prev => prev.map(r => r.id === routeId ? updatedRoute : r));
      
      if (onRouteSaved) onRouteSaved();
      setShowRouteEditor(false);
      setEditingRoute(null);
      
      alert('✅ Маршрут успешно обновлен!');
    } catch (error) {
      alert('❌ Ошибка при обновлении маршрута: ' + (error as Error).message);
    }
  };

  // Удаление маршрута через редактор
  const handleDeleteRouteFromEditor = async (routeId: string) => {
    await handleDeleteRoute(routeId);
    setShowRouteEditor(false);
    setEditingRoute(null);
  };

  // Поделиться маршрутом
  const handleShareRoute = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      const shareUrl = `${window.location.origin}/route/${routeId}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('🔗 Ссылка на маршрут скопирована в буфер обмена!');
      }).catch(() => {
        alert('❌ Не удалось скопировать ссылку');
      });
    }
  };

  // Вставить маршрут в пост (строгий стиль, без лишних иконок)
  const handleInsertRouteToPost = (route: RouteData) => {
    try {
      localStorage.setItem('post-insert-route', JSON.stringify({ id: route.id, title: route.title, points: route.points || [] }));
    } catch {}
    try {
      navigate('/posts');
    } catch {}
  };

  // Группировка меток
  const groupedMarkers = useMemo(() => {
    let filtered = favorites;
    if (search.trim()) {
      filtered = filtered.filter(m => (m.title || '').toLowerCase().includes(search.trim().toLowerCase()));
    }
    if (groupBy === 'all') return { 'Все': filtered };
    if (groupBy === 'category') {
      return filtered.reduce((acc, m) => {
        const key = m.category || 'Без категории';
        acc[key] = acc[key] || [];
        acc[key].push(m);
        return acc;
      }, {} as Record<string, MarkerData[]>);
    }
    return { 'Все': filtered };
  }, [favorites, groupBy, search]);

  const handleSelect = (id: string) => {
    const newIds = selectedMarkerIds.includes(id)
      ? selectedMarkerIds.filter(i => i !== id)
      : [...selectedMarkerIds, id];
    onSelectedMarkersChange(newIds);
    try { localStorage.setItem('favorites-selected-ids', JSON.stringify(newIds)); } catch {}
  };

  // При открытии панели — подтягиваем последние выбранные ID из localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem('favorites-selected-ids');
      const ids = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) {
        onSelectedMarkersChange(Array.from(new Set([...selectedMarkerIds, ...ids])));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleBuildRouteClick = () => {
    onBuildRoute(selectedMarkerIds);
    if (mode === 'map') {
      // Только навигация: панели не трогаем, пусть ими управляет сайдбар
      navigate('/planner');
    }
  };

  const handleMarkersAddToBlog = () => {
    if (selectedMarkerIds.length === 0) {
      alert('Выберите метки для добавления в блог');
      return;
    }
    try {
      const selectedMarkers = favorites.filter(m => selectedMarkerIds.includes(m.id));
      localStorage.setItem('post-insert-markers', JSON.stringify(selectedMarkers));
      navigate('/posts');
    } catch {
      // ignore
    }
  };

  const handleMoveToPlanner = () => {
    if (selectedMarkerIds.length === 0) {
      alert('Выберите метки для планировщика');
      return;
    }
    try {
      // Синхронизируем выбор в глобальном контексте перед переходом
      try { onSelectedMarkersChange(Array.from(new Set(selectedMarkerIds))); } catch {}
      // Передаём выбранные ID наверх (Map/Planner свяжут точки через контекст RoutePlanner)
      onMoveToPlanner(selectedMarkerIds);
      // Переход в планировщик - Sidebar сам откроет панель при навигации
      navigate('/planner');
    } catch {
      // ignore
    }
  };

  const handleMoveToMap = () => {
    if (!onMoveToMap) return;
    if (selectedMarkerIds.length === 0) {
      alert('Выберите метки для карты');
      return;
    }
    try {
      localStorage.setItem('ui-favorites-open', '1');
    } catch {}
    onMoveToMap(selectedMarkerIds);
  };

  // Функции экспорта и переупорядочивания удалены - теперь FavoritesPanel это чистый селектор

  // Очистка дубликатов маршрутов
  const handleClearRouteDuplicates = () => {
    if (routes.length === 0) {
      alert('Нет сохраненных маршрутов для очистки');
      return;
    }

    // Находим дубликаты по названию и количеству точек
    const uniqueRoutes: RouteData[] = [];
    const seen = new Set<string>();

    routes.forEach(route => {
      // Создаем ключ для сравнения: название + количество точек
      const routeKey = `${route.title}_${route.points?.length || 0}`;
      
      if (!seen.has(routeKey)) {
        seen.add(routeKey);
        uniqueRoutes.push(route);
      } else {
        }
    });

    if (uniqueRoutes.length !== routes.length) {
      setRoutes(uniqueRoutes);
      alert(`Удалено ${routes.length - uniqueRoutes.length} дубликатов маршрутов`);
    } else {
      alert('Дубликатов маршрутов не найдено');
    }
  };

  // === ОБРАБОТЧИКИ ДЛЯ СОБЫТИЙ ===
  
  // Выбор/снятие выбора события
  const handleSelectEvent = (eventId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  // Добавление событий в блог
  const handleEventAddToBlog = () => {
    if (selectedEventIds.length === 0) {
      alert('Выберите события для добавления в блог');
      return;
    }

    try {
      // Получаем выбранные события
      const selectedEvents = filteredEvents.filter((event: any) => 
        selectedEventIds.includes(event.id)
      );

      // Сохраняем в localStorage для передачи в блог
      localStorage.setItem('post-insert-events', JSON.stringify(selectedEvents));
      
      // Переходим на страницу блога
      navigate('/posts');
      
      // Очищаем выбор
      setSelectedEventIds([]);
      
      alert(`✅ ${selectedEvents.length} событий добавлено в блог!`);
    } catch (error) {
      alert('❌ Ошибка при добавлении событий в блог');
    }
  };

  // Создание поста Q&A из событий
  const handleEventCreatePost = () => {
    if (selectedEventIds.length === 0) {
      alert('Выберите события для создания поста');
      return;
    }

    try {
      // Получаем выбранные события
      const selectedEvents = filteredEvents.filter((event: any) => 
        selectedEventIds.includes(event.id)
      );

      // Формируем данные для поста
      const postData = {
        type: 'event_qa',
        events: selectedEvents,
        title: `Q&A: ${selectedEvents.map((e: any) => e.title).join(', ')}`,
        createdAt: new Date().toISOString()
      };

      // Сохраняем в localStorage для передачи в посты
      localStorage.setItem('posts-create-qa', JSON.stringify(postData));
      
      // Переходим на страницу постов
      navigate('/posts');
      
      // Очищаем выбор
      setSelectedEventIds([]);
      
      alert(`✅ Пост Q&A создан для ${selectedEvents.length} событий!`);
    } catch (error) {
      alert('❌ Ошибка при создании поста');
    }
  };

  // Поделиться событиями
  const handleEventShare = () => {
    if (selectedEventIds.length === 0) {
      alert('Выберите события для публикации');
      return;
    }

    try {
      // Получаем выбранные события
      const selectedEvents = filteredEvents.filter((event: any) => 
        selectedEventIds.includes(event.id)
      );

      // Формируем текст для публикации
      const shareText = selectedEvents.map((event: any) => 
        `🎯 ${event.title}\n📍 ${event.location || 'Место уточняется'}\n📅 ${event.date || 'Дата уточняется'}`
      ).join('\n\n');

      const fullShareText = `🌟 Интересные события:\n\n${shareText}\n\n#WayAtom #События #Путешествия`;

      // Копируем в буфер обмена
      navigator.clipboard.writeText(fullShareText).then(() => {
        alert('🔗 Информация о событиях скопирована в буфер обмена!');
        setSelectedEventIds([]);
      }).catch(() => {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = fullShareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('🔗 Информация о событиях скопирована в буфер обмена!');
        setSelectedEventIds([]);
      });
    } catch (error) {
      alert('❌ Ошибка при подготовке данных для публикации');
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Автоматически открываем нужную секцию при смене вкладки
  useEffect(() => {
    switch (activeTab) {
      case 'places':
        // Для places аккордеон не нужен - список всегда видим
        break;
      case 'routes':
        setOpenSection('routeList');
        break;
      case 'events':
        setOpenSection('eventsList');
        break;
      default:
        break;
    }
  }, [activeTab]);

  return (
    <GlassPanel
      isOpen={isOpen !== false}
      onClose={onClose}
      position="right"
      width="400px"
      closeOnOverlayClick={true}
      showCloseButton={false}
      className="favorites-panel-glass"
      constrainToMapArea={constrainToMapArea}
    >
      {/* Заголовок в стиле стекла */}
      <GlassHeader
        title="Избранное"
        count={favorites.length}
        onClose={onClose}
        showCloseButton={true}
      />

      {/* Вкладки в стиле стекла */}
      <div className="favorites-tabs-glass" style={{ flexShrink: 0, display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
        {tabOptions.map(tab => (
          <GlassButton
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            size="small"
            icon={tab.icon}
          >
            {tab.label}
          </GlassButton>
        ))}
      </div>

      {/* Основной контент с прокруткой */}
      <div className="favorites-content">

      {activeTab === 'places' && (
        <>
          {/* Баннер про дубликаты */}
          {duplicateInfo.hasDuplicates && (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeeba',
              color: '#856404',
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                Найдено дубликатов: <b>{duplicateInfo.duplicates}</b>. Уникальных меток: <b>{duplicateInfo.uniqueCount}</b> из {duplicateInfo.total}.
              </div>
              <button
                className="action-btn secondary"
                onClick={clearDuplicates}
                title="Очистить дубликаты меток в избранном"
              >
                Очистить
              </button>
            </div>
          )}
          {/* Упрощенная структура без аккордеона - список меток всегда видим */}
          <div className="markers-section-direct">
            {/* Поиск и группировка */}
            <div className="search-controls">
                <div className="search-input-group" style={{ marginBottom: 10 }}>
                  <FaSearch style={{ marginRight: 6, color: '#666' }} />
                  <input
                    type="text"
                    placeholder="Поиск по названию..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
              <div className="search-group" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <label className="search-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FaClipboardList />
                    <span>Группировать:</span>
                    <select 
                      value={groupBy} 
                      onChange={e => setGroupBy(e.target.value as GroupType)}
                      className="search-select"
                    >
                      {groupOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                ))}
              </select>
            </label>
                <div className="selection-controls">
                  <button 
                    className="selection-btn"
                    onClick={() => onSelectedMarkersChange(favorites.map(m => m.id))}
                    title="Выбрать все метки"
                  >
                    Все
                  </button>
                  <button 
                    className="selection-btn"
                    onClick={() => onSelectedMarkersChange([])}
                    title="Снять выбор со всех меток"
                  >
                    Сброс
                  </button>
                  <button
                    className="selection-btn"
                    onClick={handleCleanupInvalidMarkers}
                    title="Удалить битые/технические метки (напр. 'Точка 1')"
                  >
                    Очистить битые
                  </button>
                </div>
              </div>
            </div>
            
            {/* Список меток - занимает всё оставшееся место */}
            <div className="markers-list-container">
                {favorites.length === 0 ? (
                  <div className="empty-state">
                    <p>Нет избранных меток</p>
          </div>
                ) : (
                  <div className="markers-list">
                    {Object.entries(groupedMarkers).map(([groupName, groupMarkers]) => (
                      <div key={groupName} className="markers-group">
                        {groupBy === 'category' && (
                          <div className="group-title">{groupName}</div>
                        )}
                        {groupMarkers.map(marker => {
                          // Определяем визуальные состояния метки
                          const markerVisualClasses = getMarkerVisualClasses({
                            isFavorite: true,
                            isUserModified: (marker as any).is_user_modified,
                            usedInBlogs: (marker as any).used_in_blogs
                          });
                          
                          const isSelected = selectedMarkerIds.includes(marker.id);
                          return (
                          <div key={marker.id} className={`marker-item ${isSelected ? 'selected' : ''}`}>
                            <label className="marker-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(marker.id)}
                      />
                              <span className="checkmark"></span>
                            </label>
                            <div className="marker-info">
                              <div className="marker-title">{marker.title}</div>
                              <div className="marker-details">
                                <span className="marker-rating">★ {Number(marker.rating ?? 0).toFixed(0)}</span>
                                <span className="marker-category">{marker.category}</span>
                              </div>
                              {isSelected && (
                                <div className="marker-helper" style={{ marginTop: 6 }}>
                                ✓ Выбрана для действий в нижнем меню
                            </div>
                              )}
                            </div>
                            <GlassButton 
                              size="small" 
                              title="Убрать метку из избранного"
                              onClick={() => { try { (favoritesContext as any).removeFavoritePlace?.(marker.id); } catch {} }}
                              style={{ color: '#000' }}
                            >
                              <FaTrash size={14} />
                            </GlassButton>
                          </div>
                          );
                        })}
                      </div>
                  ))}
                  </div>
                )}
              </div>
          </div>

          {/* Действия для меток перенесены в нижний action-bar */}
        </>
      )}

      {activeTab === 'events' && (
        <>
          {/* Простой список событий с поиском */}
          <div className="markers-section-direct">
            <div className="search-controls">
              <div className="search-input-group" style={{ marginBottom: 10 }}>
                  <FaSearch style={{ marginRight: 6, color: '#666' }} />
                  <input
                    type="text"
                    placeholder="Поиск по названию или месту..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
          </div>

            <div className="markers-list-container">
                {filteredEvents.length === 0 ? (
                  <div className="empty-state">Нет избранных событий</div>
                ) : (
                  <div className="markers-list">
                    {filteredEvents.map((ev: any) => {
                      const isSelected = selectedEventIds.includes(ev.id);
                      return (
                        <div key={ev.id} className={`event-item ${isSelected ? 'selected' : ''}`}>
                          <label className="marker-checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectEvent(ev.id)}
                            />
                            <span className="checkmark"></span>
                      </label>
                          <div className="marker-info">
                            <div className="marker-title">{ev.title}</div>
                            <div className="marker-details">
                            <span className="marker-category">{ev.date ? (typeof ev.date === 'string' ? ev.date : new Date(ev.date).toLocaleString()) : ''}</span>
                              <span className="marker-category">{ev.location || ''}</span>
                    </div>
                          </div>
                          <GlassButton 
                            size="small" 
                            title="Убрать из избранного" 
                            onClick={() => {
                            try { (favoritesContext as any).removeFavoriteEvent?.(ev.id); } catch {}
                            }}
                            style={{ color: '#000' }}
                          >
                            <FaTrash size={14} />
                          </GlassButton>
                  </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </div>
        </>
      )}
      {activeTab === 'routes' && (
        <>
          <div className="markers-section-direct">
            <div className="search-controls">
              <div className="search-group" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <label className="search-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span>Сортировка:</span>
            <select
              value={routeSortBy}
                    onChange={e => setRouteSortBy(e.target.value as any)}
                        className="search-select"
            >
              <option value="createdAt_desc">Сначала новые</option>
              <option value="createdAt_asc">Сначала старые</option>
              <option value="points_desc">Больше точек</option>
              <option value="points_asc">Меньше точек</option>
                        <option value="title_asc">По названию</option>
            </select>
                    </label>
                <div className="selection-controls">
            <button
                      className="action-btn secondary"
              onClick={handleClearRouteDuplicates}
                      disabled={routes.length === 0}
                      title="Очистить дубликаты маршрутов"
            >
                    <FaExclamationTriangle style={{ marginRight: 6 }} /> Очистить дубликаты
            </button>
          </div>
                </div>
              <div className="search-input-group" style={{ marginBottom: 10 }}>
                <FaSearch style={{ marginRight: 6, color: '#666' }} />
                <input
                  type="text"
                  placeholder="Поиск по маршрутам..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  className="search-input"
                />
              </div>
          </div>

            <div className="markers-list-container">
                {loadingRoutes ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Загрузка маршрутов...</p>
                  </div>
                ) : filteredSortedRoutes.length === 0 ? (
                  <div className="empty-state">
                    <p>Нет сохранённых маршрутов</p>
                  </div>
                ) : (
                  <div className="routes-list">
                    {filteredSortedRoutes.map(route => {
                      // Гидратация точек и метаданных для корректного отображения деталей
                      // Поддержка route_data как объекта или как JSON-строки
                      let rdRaw: any = (route as any).route_data;
                      let rd: any = {};
                      if (rdRaw && typeof rdRaw === 'string') {
                        try { rd = JSON.parse(rdRaw); } catch { rd = {}; }
                      } else {
                        rd = rdRaw || {};
                      }
                      let effectivePoints: any[] = Array.isArray(route.points) && route.points.length > 0
                        ? route.points
                        : (Array.isArray(rd.points) ? rd.points : []);
                      if ((!Array.isArray(effectivePoints) || effectivePoints.length === 0) && Array.isArray(route.waypoints) && route.waypoints.length > 0) {
                        const markersById = new Map(favorites.map(m => [m.id, m]));
                        effectivePoints = route.waypoints
                          .map(wp => markersById.get(wp.marker_id))
                          .filter(Boolean)
                          .map((m: any, idx: number) => ({
                            id: m.id,
                            title: m.title,
                            description: m.description,
                            latitude: m.latitude ?? (Array.isArray(m.coordinates) ? m.coordinates[0] : undefined),
                            longitude: m.longitude ?? (Array.isArray(m.coordinates) ? m.coordinates[1] : undefined),
                            orderIndex: idx
                          }));
                      }

                      const toRad = (deg: number) => deg * Math.PI / 180;
                      const computeDistanceKm = (pts: any[]): number => {
                        if (!Array.isArray(pts) || pts.length < 2) return 0;
                        const extract = (p: any): [number|null, number|null] => {
                          const cands: Array<[number|null, number|null]> = [];
                          cands.push([Number(p?.latitude), Number(p?.longitude)]);
                          cands.push([Number(p?.lat), Number(p?.lon || p?.lng)]);
                          if (Array.isArray(p?.coordinates) && p.coordinates.length >= 2) {
                            const a = Number(p.coordinates[0]);
                            const b = Number(p.coordinates[1]);
                            if (Number.isFinite(a) && Number.isFinite(b)) {
                              if (Math.abs(a) <= 90 && Math.abs(b) <= 180) cands.push([a,b]);
                              if (Math.abs(b) <= 90 && Math.abs(a) <= 180) cands.push([b,a]);
                            }
                          }
                          for (const [la, lo] of cands) {
                            if (la != null && lo != null && isFinite(la) && isFinite(lo)) return [la, lo];
                          }
                          return [null, null];
                        };
                        let d = 0;
                        for (let i=1;i<pts.length;i++){
                          const [lat1, lon1] = extract(pts[i-1]);
                          const [lat2, lon2] = extract(pts[i]);
                          if ([lat1,lon1,lat2,lon2].every(v => typeof v === 'number')){
                            const R = 6371;
                            const dLat = toRad((lat2 as number)-(lat1 as number));
                            const dLon = toRad((lon2 as number)-(lon1 as number));
                            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1 as number))*Math.cos(toRad(lat2 as number))*Math.sin(dLon/2)**2;
                            const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                            d += R*c;
                          }
                        }
                        return Math.round(d*10)/10;
                      };

                      const derivedMetadata = rd.metadata || {};
                      const distanceKm = Number((route as any).totalDistance || derivedMetadata.totalDistance || computeDistanceKm(effectivePoints) || 0);
                      const transport = (Array.isArray(derivedMetadata.transportType) && derivedMetadata.transportType[0]) || 'car';
                      const speeds: Record<string, number> = { car: 60, walk: 5, bike: 15, bus: 40, train: 80 };
                      const durationH = distanceKm > 0 ? Math.round((distanceKm / (speeds[transport] || 60)) * 10) / 10 : 0;
                      const costRub = transport === 'car' ? Math.round(((distanceKm * (derivedMetadata.fuelConsumptionLPer100km || 8)) / 100) * (derivedMetadata.fuelPriceRub || 66)) : 0;

                      const routeVisualClasses = getRouteVisualClasses({
                      isFavorite: true,
                        isUserModified: route.is_user_modified,
                        usedInBlogs: route.used_in_blogs
                      });
                      return (
                      <div key={route.id} className={`route-item ${routeVisualClasses}`}>
                        <div className="route-header">
                          <label className="route-checkbox-top">
                          <input
                            type="checkbox"
                            checked={selectedRouteIds.includes(route.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                                try { onRouteToggle && onRouteToggle(route, checked, mode); } catch {}
                            }}
                          />
                          <span className="checkmark"></span>
                        </label>
                          <div className="route-title-wrapper">
                          <div className="route-title">{route.title || 'Без названия'}</div>
                            <div className="route-points-count">{Array.isArray(effectivePoints) ? effectivePoints.length : 0} точек</div>
                          </div>
                        </div>
                        <div className="route-actions-bottom">
                          <GlassButton size="small" onClick={() => onLoadRoute(route, mode)} title="Загрузить маршрут">
                            <FaCompass size={14} />
                          </GlassButton>
                          <GlassButton size="small" onClick={() => handleEditRoute(route)} title="Редактировать маршрут">
                            <FaEdit size={14} />
                          </GlassButton>
                          <GlassButton size="small" onClick={() => handleShareRoute(route.id)} title="Поделиться маршрутом">
                            <FaShare size={14} />
                          </GlassButton>
                          <ReportButton
                            contentId={route.id}
                            contentType="route"
                            contentTitle={route.title}
                            variant="icon"
                            size="sm"
                            className="action-btn small"
                          />
                          <GlassButton size="small" onClick={() => handleDeleteRoute(route.id)} title="Удалить маршрут" style={{ color: '#000' }}>
                            <FaTrash size={14} />
                          </GlassButton>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
        </>
      )}

      {/* VIP блоки удалены: никаких упоминаний VIP в панели */}
      </div>

      {/* Информационная панель вместо action-bar */}
        <div className="favorites-footer">
        <div className="selection-info">
          {activeTab === 'places' && (
            <div className="info-text">
              {selectedMarkerIds.length > 0 ? (
                <>✓ Выбрано {selectedMarkerIds.length} меток. Используйте нижние действия.</>
              ) : (
                <>Выберите метки для использования в других разделах проекта</>
              )}
            </div>
          )}
          {activeTab === 'routes' && (
            <>
              <div className="info-text">
                {selectedRouteIds.length > 0 && (
                  <>✓ Выбрано {selectedRouteIds.length} маршрутов. Используйте нижние действия.</>
                )}
            </div>
            </>
          )}
          {activeTab === 'events' && (
            <div className="info-text">
              {selectedEventIds.length > 0 ? (
                <>✓ Выбрано {selectedEventIds.length} событий</>
              ) : (
                <>События для добавления в контент</>
          )}
                       </div>
                       )}
                     </div>

        {/* Кнопки действий в футере для меток */}
        {activeTab === 'places' && (
          <div className="footer-actions" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {mode === 'map' && (
              <button className="action-btn secondary" onClick={handleMoveToPlanner} disabled={selectedMarkerIds.length === 0}>
                <FaCompass style={{ marginRight: 6 }} /> Добавить в маршрут
                      </button>
            )}
            {mode === 'planner' && (
              <button className="action-btn secondary" onClick={handleMoveToMap} disabled={selectedMarkerIds.length === 0}>
                <FaCompass style={{ marginRight: 6 }} /> На карту
                      </button>
            )}
        </div>
      )}

        {/* Создание маршрута перемещено в Planner; здесь кнопка скрыта */}
                    </div>

      {/* Модальные окна для переупорядочивания удалены - функция перенесена в планировщик */}

             {/* Модальное окно для редактирования маршрута */}
       {showRouteEditor && editingRoute && (
         <RouteEditor
           route={editingRoute}
           onClose={() => setShowRouteEditor(false)}
           onSave={handleSaveRouteChanges}
           onDelete={handleDeleteRouteFromEditor}
           onShare={handleShareRoute}
         />
       )}
    </GlassPanel>
  );
};

export default FavoritesPanel;