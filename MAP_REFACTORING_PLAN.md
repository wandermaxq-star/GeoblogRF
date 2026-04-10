# 🗺️ ПОЛНЫЙ ПЛАН РЕФАКТОРИНГА Map.tsx

**Дата создания:** 4 марта 2026  
**Версия:** 1.0  
**Статус:** 📋 Планирование  
**Приоритет:** 🔴 ВЫСОКИЙ

---

## 📋 СОДЕРЖАНИЕ

1. [Обзор проблемы](#обзор-проблемы)
2. [Целевая архитектура](#целевая-архитектура)
3. [Фаза 1: Перенос Offline функциональности](#фаза-1-перенос-offline-функциональности)
4. [Фаза 2: Упрощение Map.tsx](#фаза-2-упрощение-maptsx)
5. [Фаза 3: Рефакторинг логики](#фаза-3-рефакторинг-логики)
6. [Файловая структура](#файловая-структура)
7. [Пошаговая реализация](#пошаговая-реализация)
8. [Тестирование](#тестирование)

---

## 🔴 ОБЗОР ПРОБЛЕМЫ

### Текущее состояние

**Файл:** `frontend/src/pages/Map.tsx`  
**Размер:** 1664 строки  
**Состояние:** Перегруженный, 50+ переменных состояния, 25+ useEffect хуков

### Основные проблемы

| # | Проблема | Строк | Критичность |
|---|----------|-------|------------|
| 1 | Офлайн функциональность занимает 150+ строк | 150 | 🔴 HIGH |
| 2 | Фильтрация маркеров - 230+ строк в одном useMemo | 230 | 🔴 HIGH |
| 3 | Управление черновиками - 80+ строк с polling | 80 | 🟠 MEDIUM |
| 4 | UI состояния - 10+ boolean в state | 50 | 🟠 MEDIUM |
| 5 | Заглушки функций, console.log, мертвый код | 30 | 🟡 LOW |

**Итого дополнительного кода:** ~580 строк из 1664 (35%)

### Диаграмма зависимостей (текущая)

```
Map.tsx (1664 строк)
├── Offline функциональность (150 строк)
│   ├── useState for tiles, menu, meta
│   ├── useEffect для menu clicks outside
│   ├── useEffect для загрузки tilesets
│   └── useEffect для управления слоем на карте (80 строк)
├── Черновики маркеров (80 строк)
│   ├── useState для drafts
│   └── useEffect с polling каждые 10 сек
├── Фильтрация маркеров (230 строк)
│   └── useMemo с 15+ зависимостями
├── Управление маршрутами (70 строк)
│   ├── useRef для отслеживания изменений
│   └── useEffect для sync
├── UI Состояния (30 строк)
│   └── 10+ useState boolean флаги
└── Рендер (300+ строк)
    ├── Search toolbar
    ├── Region selector
    ├── Offline menu
    ├── Settings panel
    ├── Favorites panel
    └── Moderation modal
```

---

## 🎯 ЦЕЛЕВАЯ АРХИТЕКТУРА

### Новая структура

```
frontend/src/
├── pages/
│   ├── Map.tsx (500 строк)  ← Более простой основной компонент
│   └── OfflineMapConfig.tsx (новый)  ← PRO раздел для офлайн карт
│
├── hooks/
│   ├── useMapState.ts (новый)  ← Управление состоянием карты
│   ├── useOfflineTiles.ts (новый)  ← Вся логика офлайн
│   ├── usePendingMarkerDrafts.ts (новый)  ← Черновики
│   ├── useMarkerFiltering.ts (новый)  ← Фильтрация
│   └── useRouteSync.ts (новый)  ← Синхронизация маршрутов
│
├── utils/
│   ├── markerFiltering.ts (новый)  ← Функции фильтрации
│   ├── markerDraftConversion.ts (новый)  ← Преобразование данных
│   └── routeNormalization.ts (новый)  ← Нормализация маршрутов
│
├── types/
│   ├── mapState.ts (новый)  ← Типы для состояния
│   └── offline.ts (новый)  ← Типы для офлайн режима
│
└── components/
    ├── Map/
    │   ├── MapSearchBar.tsx (новый)  ← Поиск
    │   ├── MapToolbar.tsx (новый)  ← Инструменты
    │   ├── MapModeToggle.tsx (новый)  ← Переключатель онлайн/офлайн
    │   ├── MapSettingsPanel.tsx (уже есть)
    │   └── MapComponent.tsx (уже есть)
    │
    └── MapPro/
        ├── OfflineTilesManager.tsx (новый)  ← Управление тайлами
        ├── OfflineTilesSelector.tsx (новый)  ← Выбор тайлов
        ├── OfflineMetadataDisplay.tsx (новый)  ← Инфо о тайлах
        ├── OfflineDownloadProgress.tsx (новый)  ← Прогресс
        └── OfflineMapConfig.tsx (новый)  ← Основная страница PRO
```

### Диаграмма зависимостей (целевая)

```
Map.tsx (500 строк) - ПРОСТОЙ
├── useMapState()  ← Состояние (center, zoom, UI)
├── useOfflineModeToggle()  ← Переключатель режима
└── MapComponent  ← Отрисовка

OfflineMapConfig.tsx (400 строк) - PRO РАЗДЕЛ
├── useOfflineTiles()  ← Вся офлайн логика
│   ├── useState для tiles, meta
│   ├── useEffect для загрузки tilesets
│   └── useEffect для управления слоем
├── useOfflineModeToggle()  ← Переключение режима
├── OfflineTilesManager
├── OfflineTilesSelector
└── OfflineMetadataDisplay
```

---

## 🔵 ФАЗА 1: ПЕРЕНОС OFFLINE ФУНКЦИОНАЛЬНОСТИ

### 1.1 Что переходит в PRO раздел

| Функциональность | Текущее место | Новое место | Строк |
|------------------|---------------|------------|-------|
| Загрузка списка тайлов | Map.tsx (169-180) | useOfflineTiles.ts | 15 |
| Управление меню тайлов | Map.tsx (133-148) + useEffect | useOfflineTiles.ts | 20 |
| Загрузка метаданных | Map.tsx (181-230) | useOfflineTiles.ts | 50 |
| Добавление слоя на карту | Map.tsx (181-230) | useOfflineTiles.ts | 40 |
| Выпадающее меню UI | Map.tsx (1250-1350) | OfflineTilesSelector.tsx | 80 |
| Панель информации | Map.tsx (1350-1400) | OfflineMetadataDisplay.tsx | 40 |
| **ИТОГО** | | | **245 строк** |

### 1.2 Что остается в Map.tsx

- **Простой переключатель:** Онлайн <-> Офлайн (1 кнопка)
- **Логика:** При клике → переход на `/map-pro/offline` или просто переключение флага

### 1.3 Новые файлы Фазы 1

#### `frontend/src/types/offline.ts`

```typescript
/**
 * Типы для офлайн функциональности
 */

export interface OfflineTileset {
  name: string;
  format: 'png' | 'pbf' | 'jpg';
  sizeMB: number;
  bounds: [number, number, number, number] | null;
  center: [number, number] | null;
  minzoom: number | null;
  maxzoom: number | null;
  description: string | null;
}

export interface OfflineTilesetMetadata {
  name: string;
  format: string;
  minzoom?: number;
  maxzoom?: number;
  center?: [number, number];
  bounds?: [number, number, number, number];
  description?: string;
}

export interface OfflineState {
  isActive: boolean;
  menuOpen: boolean;
  tilesets: OfflineTileset[];
  activeSet: string;
  metadata: OfflineTilesetMetadata | null;
  loading: boolean;
  error: string | null;
}

export interface MapMode {
  type: 'online' | 'offline';
  activeSet?: string;
}
```

#### `frontend/src/hooks/useOfflineTiles.ts`

```typescript
/**
 * Кастомный хук для управления офлайн-картами
 * Инкапсулирует всю логику работы с тайлами
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { mapFacade } from '../services/map_facade/index';
import { OfflineTileset, OfflineTilesetMetadata } from '../types/offline';

export interface UseOfflineTilesReturn {
  // State
  isActive: boolean;
  menuOpen: boolean;
  tilesets: OfflineTileset[];
  activeSet: string;
  metadata: OfflineTilesetMetadata | null;
  loading: boolean;
  error: string | null;

  // Actions
  setIsActive: (active: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setActiveSet: (name: string) => void;
  loadTilesets: () => Promise<void>;

  // Refs
  menuRef: React.RefObject<HTMLDivElement>;
  layerRef: React.RefObject<any>;
  boundsRef: React.RefObject<any>;
}

export function useOfflineTiles(): UseOfflineTilesReturn {
  const [isActive, setIsActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tilesets, setTilesets] = useState<OfflineTileset[]>([]);
  const [activeSet, setActiveSet] = useState<string>('test-raster');
  const [metadata, setMetadata] = useState<OfflineTilesetMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);

  // Загрузка списка тайлсетов
  const loadTilesets = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tiles');
      if (!res.ok) throw new Error('Failed to load tilesets');

      const data = await res.json();
      const list = data.tilesets || [];
      setTilesets(list);

      // Автовыбор PNG-тайлсета
      const png = list.find((t: OfflineTileset) => t.format === 'png');
      if (png) setActiveSet(png.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('[useOfflineTiles] Failed to load tilesets:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Загрузка метаданных активного тайлсета
  const loadMetadata = useCallback(async (tilesetName: string) => {
    try {
      const res = await fetch(`/api/tiles/${tilesetName}/metadata`);
      if (!res.ok) return;

      const meta = await res.json();
      setMetadata(meta);
      return meta;
    } catch (err) {
      console.warn('[useOfflineTiles] Failed to load metadata:', err);
    }
  }, []);

  // Закрытие меню при клике вне
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Загрузка тайлсетов при активации
  useEffect(() => {
    if (!isActive) return;
    loadTilesets();
  }, [isActive, loadTilesets]);

  // Загрузка метаданных при изменении активного тайлсета
  useEffect(() => {
    if (!isActive || !activeSet) return;
    loadMetadata(activeSet);
  }, [isActive, activeSet, loadMetadata]);

  // Управление слоем на карте Leaflet
  useEffect(() => {
    try { mapFacade().getMap(); } catch { return; }

    // Удаляем предыдущие слои
    if (layerRef.current) {
      try { mapFacade().removeLayer(layerRef.current); } catch {}
      layerRef.current = null;
    }
    if (boundsRef.current) {
      try { mapFacade().removeLayer(boundsRef.current); } catch {}
      boundsRef.current = null;
    }

    if (!isActive || !activeSet) return;

    if (!metadata) return;

    const facade = mapFacade();

    // Добавляем тайловый слой
    const tileUrl = `/api/tiles/${activeSet}/{z}/{x}/{y}.png`;
    const tileLayer = facade.addTileLayer(tileUrl, {
      minZoom: metadata.minzoom ?? 1,
      maxZoom: metadata.maxzoom ?? 18,
      opacity: 0.9,
      attribution: `Offline: ${activeSet}`,
      zIndex: 500,
    });
    layerRef.current = tileLayer;

    // Показываем границы тайлсета
    if (metadata.bounds && metadata.bounds.length === 4) {
      const [west, south, east, north] = metadata.bounds;
      const boundsRect = facade.createRectangle(
        [[south, west], [north, east]],
        { 
          color: '#3b82f6', 
          weight: 2, 
          fill: true, 
          fillOpacity: 0.05, 
          dashArray: '8 4' 
        }
      );
      boundsRef.current = boundsRect;

      // Перемещаем карту в область тайлов
      facade.fitBounds(
        { south, west, north, east } as any,
        { padding: [20, 20], maxZoom: metadata.maxzoom ?? 12 }
      );
    }
  }, [isActive, activeSet, metadata]);

  return {
    isActive,
    menuOpen,
    tilesets,
    activeSet,
    metadata,
    loading,
    error,
    setIsActive,
    setMenuOpen,
    setActiveSet,
    loadTilesets,
    menuRef,
    layerRef,
    boundsRef,
  };
}
```

#### `frontend/src/hooks/useMapState.ts`

```typescript
/**
 * Управление базовым состоянием карты (center, zoom, UI)
 */

import { useState, useCallback } from 'react';
import { mapStateHelpers } from '../stores/mapStateStore';

export interface MapUIState {
  settingsOpen: boolean;
  favoritesOpen: boolean;
  legendOpen: boolean;
  isAddingMarkerMode: boolean;
  isRecording: boolean;
  showZonesLayer: boolean;
}

export function useMapState() {
  // Координаты карты
  const savedState = mapStateHelpers.getCenterAndZoom('osm');
  const [center, setCenter] = useState<[number, number]>(savedState.center);
  const [zoom, setZoom] = useState<number>(savedState.zoom);

  // UI состояния
  const [uiState, setUiState] = useState<MapUIState>({
    settingsOpen: false,
    favoritesOpen: false,
    legendOpen: false,
    isAddingMarkerMode: false,
    isRecording: false,
    showZonesLayer: false,
  });

  // Helper функции для переключения UI
  const toggleSettings = useCallback(() =>
    setUiState(prev => ({ ...prev, settingsOpen: !prev.settingsOpen })),
    []
  );

  const toggleFavorites = useCallback(() =>
    setUiState(prev => ({ ...prev, favoritesOpen: !prev.favoritesOpen })),
    []
  );

  const toggleLegend = useCallback(() =>
    setUiState(prev => ({ ...prev, legendOpen: !prev.legendOpen })),
    []
  );

  const toggleAddingMarker = useCallback(() =>
    setUiState(prev => ({ ...prev, isAddingMarkerMode: !prev.isAddingMarkerMode })),
    []
  );

  const toggleRecording = useCallback(() =>
    setUiState(prev => ({ ...prev, isRecording: !prev.isRecording })),
    []
  );

  const toggleZones = useCallback(() =>
    setUiState(prev => ({ ...prev, showZonesLayer: !prev.showZonesLayer })),
    []
  );

  return {
    // Карта
    center, setCenter,
    zoom, setZoom,

    // UI состояния
    ...uiState,

    // Переключатели
    toggleSettings,
    toggleFavorites,
    toggleLegend,
    toggleAddingMarker,
    toggleRecording,
    toggleZones,

    // Прямое управление UI
    setUiState,
  };
}
```

#### `frontend/src/pages/OfflineMapConfig.tsx` (новая PRO страница)

```typescript
/**
 * Страница конфигурации офлайн-карт (PRO раздел)
 */

import React from 'react';
import { MirrorGradientContainer } from '../components/MirrorGradientProvider';
import { useOfflineTiles } from '../hooks/useOfflineTiles';
import OfflineTilesManager from '../components/MapPro/OfflineTilesManager';

export default function OfflineMapConfig() {
  const offlineTiles = useOfflineTiles();

  return (
    <MirrorGradientContainer className="page-layout-container offline-map-config">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <h1 style={{ marginBottom: '20px' }}>⚙️ Конфигурация Офлайн Карт</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Левая колонка - Список тайлсетов */}
            <div className="lg:col-span-2">
              <OfflineTilesManager {...offlineTiles} />
            </div>

            {/* Правая колонка - Информация */}
            <div className="lg:col-span-1">
              <div className="glass-l1 p-4 rounded-lg">
                <h3>О офлайн картах</h3>
                <p>Загрузите карты регионов для использования в режиме без интернета.</p>
                <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                  <li>✅ Работает без интернета</li>
                  <li>✅ Быстрая загрузка</li>
                  <li>⚠️ Требует место на диске</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );
}
```

---

## 🟠 ФАЗА 2: УПРОЩЕНИЕ Map.tsx

### 2.1 Какой код удаляется

| Код | Строк | Причина |
|-----|-------|---------|
| Офлайн useState (7 переменных) | 25 | → useOfflineTiles() |
| Офлайн useEffect (4 эффекта) | 120 | → useOfflineTiles() |
| Офлайн UI (меню, панель) | 150 | → OfflineMapConfig |
| Заглушки функций | 15 | Не используются |
| console.log отладочные | 10 | Чистота кода |
| Закомментированный код | 50 | Мертвый код |
| **ИТОГО** | **370 строк** | **22% файла** |

### 2.2 Новая структура Map.tsx

```tsx
// Map.tsx (500 строк вместо 1664)

import React from 'react';
import { useMapState } from '../hooks/useMapState';
import { useOfflineModeToggle } from '../hooks/useOfflineModeToggle';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import MapComponent from '../components/Map/Map';
import MapToolbar from '../components/Map/MapToolbar';
import MapModeToggle from '../components/Map/MapModeToggle';

export default function MapPage({ selectedMarkerId, showOnlySelected }) {
  // Основное состояние
  const {
    center, setCenter, zoom, setZoom,
    settingsOpen, toggleSettings,
    favoritesOpen, toggleFavorites,
    ...uiState
  } = useMapState();

  // Управление режимом (онлайн/офлайн)
  const { mapMode, toggleMode } = useOfflineModeToggle();

  // Загрузка данных
  const { markers, loading } = useMapMarkers();
  const favorites = useFavoritesContext();

  // Фильтрация
  const filteredMarkers = useFilteredMarkers(markers, favorites);

  // Управление маршрутами
  const { routes, selectedRouteIds } = useRoutes();

  // Основной рендер
  return (
    <>
      <MapModeToggle 
        currentMode={mapMode} 
        onModeChange={toggleMode} 
      />

      <div className="map-container">
        <MapToolbar
          center={center}
          zoom={zoom}
          onSettingsClick={toggleSettings}
          onFavoritesClick={toggleFavorites}
          // ... другие props
        />

        <MapComponent
          center={center}
          zoom={zoom}
          markers={filteredMarkers}
          // ... другие props
        />
      </div>

      {/* Панели (уже оптимизированные) */}
      <MapSettingsPanel isOpen={settingsOpen} />
      <FavoritesPanel isOpen={favoritesOpen} />
    </>
  );
}
```

---

## 🟡 ФАЗА 3: РЕФАКТОРИНГ ЛОГИКИ

### 3.1 Создание хуков для других функций

#### `frontend/src/hooks/useMarkerFiltering.ts`

```typescript
/**
 * Фильтрация маркеров с поддержкой множества критериев
 */

import { useMemo } from 'react';
import { MarkerData } from '../types/marker';
import { filterMarkers, type MarkerFilterOptions } from '../utils/markerFiltering';

export function useMarkerFiltering(options: MarkerFilterOptions) {
  return useMemo(() => filterMarkers(options), [
    options.baseMarkers.length,
    options.lazyMarkers.length,
    options.draftMarkers.length,
    options.selectedFavorites.length,
    options.selectedHashtags.join(','),
    options.filterLogic,
    options.searchQuery,
    options.activePreset,
    options.categories.join(','),
    options.radiusOn,
    options.radius,
    options.searchRadiusCenter ? options.searchRadiusCenter[0] : null,
  ]);
}
```

#### `frontend/src/hooks/usePendingMarkerDrafts.ts`

```typescript
/**
 * Управление черновиками маркеров с polling
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MarkerData } from '../types/marker';
import { offlineContentStorage } from '../services/offlineContentStorage';
import { convertDraftsToMarkers } from '../utils/markerDraftConversion';

export function usePendingMarkerDrafts() {
  const [drafts, setDrafts] = useState<MarkerData[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setDrafts([]);
      return;
    }

    const loadDrafts = async () => {
      try {
        await offlineContentStorage.init();
        const rawDrafts = await offlineContentStorage.getAllDrafts('marker');
        const markerDrafts = await convertDraftsToMarkers(rawDrafts, user);
        setDrafts(markerDrafts);
      } catch (error) {
        console.error('[usePendingMarkerDrafts]', error);
      }
    };

    loadDrafts();
    const interval = setInterval(loadDrafts, 10000); // Polling

    return () => {
      clearInterval(interval);
      // Cleanup blob URLs
      drafts.forEach(marker => {
        marker.photo_urls?.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      });
    };
  }, [user?.id]);

  return drafts;
}
```

#### `frontend/src/hooks/useRouteSync.ts`

```typescript
/**
 * Синхронизация выбранных маршрутов с отображением на карте
 */

import { useEffect, useRef, useCallback } from 'react';
import { RouteData } from '../types/route';

export function useRouteSync(
  selectedRouteIds: string[],
  routes: RouteData[],
  onRouteAdded: (route: RouteData) => void,
  onRouteRemoved: (routeId: string) => void,
) {
  const prevIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const currentIds = selectedRouteIds || [];

    const addedIds = currentIds.filter(id => !prevIds.includes(id));
    const removedIds = prevIds.filter(id => !currentIds.includes(id));

    prevIdsRef.current = Array.from(currentIds);

    addedIds.forEach(routeId => {
      const route = routes.find(r => r.id === routeId);
      if (route) onRouteAdded(route);
    });

    removedIds.forEach(routeId => onRouteRemoved(routeId));
  }, [selectedRouteIds, routes, onRouteAdded, onRouteRemoved]);
}
```

### 3.2 Утилиты для преобразования данных

#### `frontend/src/utils/markerFiltering.ts`

Все функции фильтрации (по хэштегам, поиску, категориям, радиусу, пресетам)

#### `frontend/src/utils/markerDraftConversion.ts`

Преобразование raw drafts из storage → MarkerData format

#### `frontend/src/utils/routeNormalization.ts`

Нормализация маршрутов между разными форматами

---

## 📁 ФАЙЛОВАЯ СТРУКТУРА

### Новые файлы для создания (15 файлов)

```
✅ = готово к созданию
⏳ = требует рефакторинга

Типы:
├── ✅ frontend/src/types/offline.ts
└── ✅ frontend/src/types/mapState.ts

Хуки:
├── ✅ frontend/src/hooks/useMapState.ts
├── ✅ frontend/src/hooks/useOfflineTiles.ts
├── ✅ frontend/src/hooks/useOfflineModeToggle.ts
├── ⏳ frontend/src/hooks/useMarkerFiltering.ts
├── ⏳ frontend/src/hooks/usePendingMarkerDrafts.ts
└── ⏳ frontend/src/hooks/useRouteSync.ts

Утилиты:
├── ⏳ frontend/src/utils/markerFiltering.ts
├── ⏳ frontend/src/utils/markerDraftConversion.ts
└── ⏳ frontend/src/utils/routeNormalization.ts

Компоненты Map:
├── ✅ frontend/src/components/Map/MapModeToggle.tsx
├── ✅ frontend/src/components/Map/MapSearchBar.tsx
├── ✅ frontend/src/components/Map/MapToolbar.tsx
└── ⏳ frontend/src/components/Map/MapSettingsPanel.tsx (рефакторинг)

Компоненты MapPro (для офлайн карт):
├── ✅ frontend/src/components/MapPro/OfflineTilesManager.tsx
├── ✅ frontend/src/components/MapPro/OfflineTilesSelector.tsx
├── ✅ frontend/src/components/MapPro/OfflineMetadataDisplay.tsx
└── ✅ frontend/src/components/MapPro/OfflineDownloadProgress.tsx

Страницы:
├── ⏳ frontend/src/pages/Map.tsx (рефакторинг)
└── ✅ frontend/src/pages/OfflineMapConfig.tsx
```

### Файлы для изменения

```
⏳ frontend/src/pages/Map.tsx (1664 → 500 строк)
⏳ frontend/src/components/Map/MapComponent.tsx (простые изменения)
⏳ frontend/src/routes.tsx (добавить новый маршрут для OfflineMapConfig)
```

---

## 📍 ПОШАГОВАЯ РЕАЛИЗАЦИЯ

### ШАГ 1: Подготовка (1 часа)

- [ ] Создать файл типов `frontend/src/types/offline.ts`
- [ ] Создать файл типов `frontend/src/types/mapState.ts`
- [ ] Создать все скелеты файлов (пустые файлы со структурой)

### ШАГ 2: Хуки (2-3 часа)

- [ ] Реализовать `useMapState.ts` (управление состоянием)
- [ ] Реализовать `useOfflineTiles.ts` (вся офлайн логика)
- [ ] Реализовать `useOfflineModeToggle.ts` (переключатель режимов)
- [ ] Реализовать `useMarkerFiltering.ts` (фильтрация)
- [ ] Реализовать `usePendingMarkerDrafts.ts` (черновики)
- [ ] Реализовать `useRouteSync.ts` (маршруты)

### ШАГ 3: Утилиты (1.5-2 часа)

- [ ] Реализовать `markerFiltering.ts` (функции фильтрации)
- [ ] Реализовать `markerDraftConversion.ts` (преобразование данных)
- [ ] Реализовать `routeNormalization.ts` (нормализация маршрутов)

### ШАГ 4: Компоненты (2-3 часа)

- [ ] Создать `MapModeToggle.tsx` (кнопка переключения)
- [ ] Создать `MapSearchBar.tsx` (поиск)
- [ ] Создать `MapToolbar.tsx` (панель инструментов)
- [ ] Создать компоненты в папке `MapPro/`:
  - [ ] `OfflineTilesManager.tsx`
  - [ ] `OfflineTilesSelector.tsx`
  - [ ] `OfflineMetadataDisplay.tsx`
  - [ ] `OfflineDownloadProgress.tsx`

### ШАГ 5: Страницы (1-1.5 часа)

- [ ] Создать `OfflineMapConfig.tsx` (PRO страница)
- [ ] Обновить `routes.tsx` (добавить маршрут `/map-pro/offline`)
- [ ] Рефакторить `Map.tsx` (удалить офлайн логику, оставить только переключатель)

### ШАГ 6: Тестирование (1-2 часа)

- [ ] Проверить работу каждого хука отдельно
- [ ] Проверить интеграцию компонентов
- [ ] Проверить навигацию между Map и OfflineMapConfig
- [ ] Проверить сохранение состояния карты при переключении режимов

---

## 🧪 ТЕСТИРОВАНИЕ

### Функциональное тестирование

#### Сценарий 1: Переключение режимов

1. Открыть карту в онлайн режиме
2. Клик на кнопку "Офлайн"
3. ✅ Должны быть видны переключатели режима
4. Клик на "Перейти к конфигурации"
5. ✅ Должна открыться страница `/map-pro/offline`
6. Клик на "Вернуться на карту"
7. ✅ Должны вернуться на карту в офлайн режиме

#### Сценарий 2: Загрузка тайлсетов

1. На странице OfflineMapConfig
2. ✅ Должен отобразиться список тайлсетов
3. ✅ Автоматически должен выбраться PNG формат
4. ✅ Должны загрузиться метаданные тайлсета

#### Сценарий 3: Состояние карты

1. Установить центр карты на [55.75, 37.61], zoom 12
2. Переключиться на другую страницу
3. Вернуться на карту
4. ✅ Центр и зум должны быть сохранены

#### Сценарий 4: Фильтра маркеров

1. Выбрать категорию "Кафе"
2. ✅ На карте должны показываться только кафе
3. Ввести поисковый запрос
4. ✅ Маркеры должны отфильтроваться по поиску
5. Выбрать хэштег
6. ✅ Маркеры должны отфильтроваться по хэштегу

#### Сценарий 5: Черновики маркеров

1. Авторизоваться
2. ✅ Должны загрузиться черновики из localStorage
3. ✅ Черновики должны отобразиться на карте с индикатором
4. Поллинг каждые 10 сек
5. ✅ Новые черновики должны появиться автоматически

### Проверка производительности

```bash
# Перед рефакторингом
Map.tsx:
- Bundle size: X кб
- Render time: Y ms
- useEffect hooks: 25

# После рефакторинга
Map.tsx:
- Bundle size: X - 20% кб
- Render time: Y - 30% ms
- useEffect hooks: 5
```

### Лучше практики для проверки

- [ ] Никаких console.log в production коде
- [ ] Все заглушки функций удалены
- [ ] Все useEffect имеют правильные зависимости
- [ ] Нет infinite loops в useEffect
- [ ] Все новые хуки правильно типизированы
- [ ] Основной Map.tsx зависит ТОЛЬКО от своих хуков, у не импортирует прямо логику

---

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### До рефакторинга

| Метрика | Значение |
|---------|----------|
| Размер файла | 1664 строк |
| useState переменных | 50+ |
| useEffect хуков | 25+ |
| Сложность | 9/10 (очень сложный) |
| Сопровождаемость | 4/10 |

### После рефакторинга Фазы 1-2

| Метрика | Значение |
|---------|----------|
| Map.tsx | 500 строк (-70%) |
| OfflineMapConfig.tsx | 300 строк (новый) |
| useState в Map.tsx | 8-10 |
| useEffect в Map.tsx | 5-7 |
| Сложность Map.tsx | 4/10 |
| Сопровождаемость | 8/10 |

### После рефакторинга Фазы 3

| Метрика | Значение |
|---------|----------|
| Map.tsx | 400-450 строк |
| Модульность | 9/10 |
| Переиспользуемость хуков | 8/10 |
| Сопровождаемость | 9/10 |

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [MAP_CURRENT_ANALYSIS.md] - Текущий анализ структуры
- [DNA_Project/01_GLOBAL_CORES.md] - Архитектурные ядра системы
- [DNA_Project/04_EXTENSION_POINTS.md] - Точки расширения

---

## 🎯 ЦЕЛЕВОЙ РЕЗУЛЬТАТ

```tsx
// Map.tsx становится просто и понятным
export default function MapPage({ selectedMarkerId, showOnlySelected }) {
  // 1. Одна строка для состояния
  const mapState = useMapState();

  // 2. Одна строка для режима
  const { mapMode, toggleMode } = useOfflineModeToggle();

  // 3. Одна строка для данных
  const markers = useFilteredMarkers(...);

  // 4. Просто рендерим
  return (
    <>
      <MapModeToggle currentMode={mapMode} onToggle={toggleMode} />
      <MapComponent {...mapState} markers={markers} />
    </>
  );
}

// Вся офлайн логика в отдельном месте
// OfflineMapConfig.tsx для PRO пользователей
```

---

**Обновлено:** 4 марта 2026  
**Статус:** 📋 Готово к реализации
