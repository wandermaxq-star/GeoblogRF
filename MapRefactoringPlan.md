# План Рефакторинга Картографической Системы

## Обзор
Этот документ описывает план рефакторинга картографической системы проекта. Основные компоненты: `map.tsx`, картографический фасад (`map_facade`) и `planner.tsx`. Цель — обеспечить стабильность, читаемость и расширяемость перед релизом.

## 1. Ключевые Состояния Компонентов

### map.tsx
- **Карта и контейнер**: `mapContainerRef`, `facadeMapRootEl` (portal для рендеринга).
- **Фильтры и настройки**: `appliedFilters`, `draftFilters`, `appliedMapSettings`, `draftMapSettings`.
- **Маркеры и маршруты**: `allMarkers`, `filteredMarkers`, `pendingMarkerDrafts`, `routeData`, `activeFavoriteRoutes`.
- **События и модерация**: `selectedEvent`, `openEvents`, `showModerationModal`, `moderationCount`.
- **UI-состояния**: `settingsOpen`, `legendOpen`, `isAddingMarkerMode`, `isAddingEventMode`, `addSelectorOpen`, `isCreationPanelOpen`.
- **Геолокация**: `userLocation`, `userBounds`, `locationMode`, `searchRadiusCenter`.
- **Поиск**: `searchQuery`, `geocodingResults`, `filteredMarkersForSearch`.
- **Регионы и зоны**: `selectedRegions`, `zones`, `showZonesLayer`.
- **Оффлайн**: `useLazyLoading`, `mapBounds`.

### Фасад (map_facade)
- **Рендереры**: `currentRenderer`, `rendererPool`, `rendererMeta` (пулы для OSM, Yandex, Offline).
- **Контексты и режимы**: `activeContext` (osm/planner/offline), `isOnline`, `splitScreenState`.
- **События**: `clickHandlers`, `routeGeometryHandlers`, `moveHandlers`, `zoomHandlers` и т.д.
- **Трекинг GPS**: `trackingActive`, `trackingPoints`, `trackingStartTime`, `trackingPaused`, `geoLocationWatchId`.
- **Маркеры и маршруты**: `pendingExternalMarkers`, `INTERNAL.externalMarkers` (буфер для синхронизации).
- **Зависимости (DI)**: `deps` (gamificationFacade, offlineContentQueue, moderationService и т.д.).
- **Внутренние состояния**: `isInitializing`, `isOfflineCapable`.

### planner.tsx
- **Маркеры и маршруты**: `facadeMarkers`, `facadeRoutes`, `routePointsFromContext`, `pendingRouteDrafts`.
- **Настройки маршрута**: `routeStats`, `routeGeometry`, `routeAlternatives`, `selectedAltId`.
- **UI-состояния**: `settingsOpen`, `showCoordinateInput`, `showSearchForm`, `showTitleModal`, `isCreationPanelOpen`.
- **Фильтры и зоны**: `showZonesLayer`, `zones`, `appliedMapSettings`.
- **События и календарь**: `selectedEvent`, `openEvents`, `selectedEventIds`, `selectedMarkerIds`.
- **Геолокация и поиск**: `coordinateLat`, `coordinateLon`, `searchAddress`, `flyToCoordinates`.
- **Модерация и офлайн**: `moderationCount`, `showModerationModal`, `useForPosts`, `useForEvents`.
- **Загрузка**: `isLoading`, `loadError`, `isMountedRef`.
- **Двухоконный режим**: `isTwoPanelMode`, `leftContent`, `rightContent`.

## 2. Пути Связей и Взаимодействий

### Основные Связи
- **map.tsx ↔ Фасад**: `map.tsx` инициализирует карту через `projectManager` (обёртка над фасадом). Фасад предоставляет `mapFacade().updateExternalMarkers()` для синхронизации маркеров. `map.tsx` читает маркеры из `useMapMarkers` хука, который связан с `markerService`.
- **planner.tsx ↔ Фасад**: `planner.tsx` использует `projectManager.getMapApi()` для доступа к карте. Фасад управляет рендерерами (Yandex для planner). Маркеры/маршруты синхронизируются через Zustand store (`usePlannerFacadeStore`).
- **Фасад ↔ ProjectManager**: `ProjectManager` — синглтон-обёртка, инициализирует карту через `mapFacade().initialize()`. Управляет маркерами через `markerService`, margin через `setMapMargin`.
- **Общие зависимости**: Все компоненты используют `FavoritesContext` для синхронизации избранного, `useContentStore` для layout (одно-/двухоконный режим), `useEventsStore` для событий.

### Поток Данных
1. **Инициализация**: `map.tsx`/`planner.tsx` → `projectManager.initializeMap()` → `mapFacade().initialize()` → Выбор рендерера (OSM/Yandex).
2. **Маркеры**: `markerService.getAllMarkers()` → `map.tsx` фильтрует → `mapFacade().updateExternalMarkers()` → Рендерер отрисовывает.
3. **Маршруты**: `planner.tsx` строит через хуки (`usePlannerAutoRoute`) → `mapFacade().planRoute()` → Рендерер отрисовывает.
4. **События**: `useEventsStore` → `map.tsx`/`planner.tsx` → Фасад регистрирует обработчики событий.
5. **Геймификация**: Действия (посты, трекинг) → `mapFacade().createPost()` → `gamificationFacade.recordAction()`.
6. **Оффлайн**: `offlineContentStorage` → `mapFacade().syncPendingPosts()` → Синхронизация при онлайн.

### Проблемные Связи
- **Дублирование API**: `map.tsx` использует `mapFacade()` напрямую, `planner.tsx` — `projectManager`. Нужно унифицировать на `projectManager`.
- **Синхронизация Store**: `map.tsx` использует `mapStateStore`, `planner.tsx` — `usePlannerFacadeStore`. Переходы теряют состояние — нужен единый store.
- **Зависимости Фасада**: Fallback на пустые функции маскируют ошибки — добавить валидацию.

## 3. План Рефакторинга

### Этап 1: Рефакторинг Фасада (1-2 недели)
- **Исправить ошибки**: В `MapContextFacade.ts` исправить `track.points = this.trackingPoints` в `stopTracking`.
- **Улучшить типизацию**: Заменить `any` на конкретные типы из `IMapRenderer.ts`.
- **Унифицировать API**: Все вызовы через `projectManager`. Убрать прямые `mapFacade()` из `map.tsx`/`planner.tsx`.
- **Валидация зависимостей**: В конструкторе фасада проверять, что сервисы загружены.
- **Логирование**: Добавить structured logging для ошибок (не try/catch everywhere).
- **Тестирование**: Unit-тесты для трекинга, рендереров, событий.

### Этап 2: Адаптация Карт (map.tsx и planner.tsx) (2-3 недели)
- **Убрать дублирование**: Все операции с картой через `projectManager`.
- **Синхронизировать Store**: Расширить `mapStateStore` для единого состояния маркеров/маршрутов.
- **Оптимизация**: Сократить `useEffect`, добавить throttling для событий, кэширование маршрутов.
- **UI/UX**: Улучшить читаемость кода, разбить большие компоненты на хуки/подкомпоненты.
- **Интеграционное тестирование**: Симулировать полноту действий (трекинг + посты + маршруты).

### Этап 3: Тестирование и Релиз
- **Нагрузочное тестирование**: Проверить под нагрузкой (множественные маркеры, одновременные действия).
- **Мониторинг**: Добавить метрики производительности, логи ошибок.
- **Документация**: Обновить README с API фасада.

## 4. Расширение Функционала
Нереализованные функции (например, вывод метки поста в картах, calendar.tsx для мобильной map.tsx) не помешают рефакторингу. После стабилизации фасада и карт:
- Добавьте методы в фасад (например, `renderPostMarker()`).
- Расширьте интерфейсы (`IMapRenderer.ts`).
- Интегрируйте в `map.tsx`/`planner.tsx` через существующие хуки/store.
Это будет просто, так как фундамент станет стабильным.