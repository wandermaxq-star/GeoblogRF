# ГеоБлог.рф — Frontend

![React](https://img.shields.io/badge/React-18.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Vite](https://img.shields.io/badge/Vite-5.x-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.x-cyan)
![Zustand](https://img.shields.io/badge/Zustand-5.x-orange)

**ГеоБлог.рф** — платформа для создания интерактивных постов с интеграцией карт и маршрутов по России.

## Концепция

Платформа для создания интерактивных постов, в которых:

- Текст объединяется с картами и маршрутами
- Геолокация становится частью истории
- Система реакций, комментариев и рейтингов
- Геймификация, достижения и система уровней
- Полноценный офлайн-режим с синхронизацией

---

## Основные функции

### Посты
- Конструктор постов с интуитивным интерфейсом
- Геолокационная привязка контента к местам
- Интеграция с картами — автоматическое создание меток
- Интерактивные элементы — изображения, ссылки, маршруты
- Система черновиков и публикации
- Офлайн-режим — создание постов без интернета
- Автоматическое начисление XP за создание

### Навигация и карты
- Интерактивная карта с поддержкой нескольких провайдеров (Yandex Maps, Leaflet)
- Единый фасад карт (`map_facade/MapContextFacade`) для работы с разными провайдерами
- `projectManager` — singleton для инициализации и управления картой, предоставляет `getMapApi()`
- Планировщик маршрутов (Yandex Maps) — 4 способа добавления точек: клик по карте, поиск по адресу, ввод координат, чекбоксы избранного
- Автоматическое построение маршрута при 2+ точках (ORS / ymaps.route() / fallback)
- Множественные маршруты — сохранённые и авто-маршруты на одной карте
- Система меток с категориями и избранным
- Кастомные каплевидные маркеры для постов
- Маркеры событий — круглые маркеры с иконкой календаря
- Слои карты (стандартная, спутниковая, гибридная, OpenTopoMap)
- Геокодирование через Яндекс Geocoder API
- Интеграция с календарём — события из календаря отображаются на карте

### Геймификация
- Система уровней и XP — `XP = 100 * уровень^1.5`
- Ранги от Новичка 🌱 до ГеоБлоггера 👑
- Ежедневные цели с наградами и стриком
- Достижения за контент, активность, качество
- Защита от накруток — проверка уникальности, лимиты
- Feature Flags — поэтапное раскрытие функций

### Календарь событий
- Режимы отображения: день, неделя, месяц, год, круговой вид
- Конструктор событий с блоками (как добраться, где остановиться, где поесть, что посмотреть)
- Интеграция с картой — маркеры событий, мини-попапы с glassmorphism
- Интеграция с планировщиком маршрутов
- Двухоконный режим (левый/правый компонент)
- Офлайн-создание событий с автоматической синхронизацией

### Офлайн-режим
- Полностью офлайн создание — посты, метки, маршруты, события
- Хранение в IndexedDB + `storageService` (единый фасад)
- Автоматическая синхронизация при появлении интернета
- Надёжная очередь отправки с ретраями и экспоненциальным бэкоффом
- Универсальная панель черновиков для всех типов контента

### Офлайн-карты «Карманный геоблог» 🆕
- **SVG-карта России** — 85 регионов, проекция Albers Equal-Area Conic, labels, zoom/pan
- **Скачивание тайлов** — OSM zoom 6–12 по регионам (~5–35 МБ), хранение в IndexedDB
- **GPS без интернетa** — `navigator.geolocation.watchPosition` + пульсирующая точка на скачанных тайлах

### Маршрутный Хаб и Route Pack Builder 🆕

Полноценный маркетплейс маршрутных паков, созданных сообществом.

**Флоу публикации:**
- Пользователь строит маршрут в `/planner` → появляется кнопка **«Упаковать»** (внизу-справа карты, только при построенном маршруте)
- Открывается **`RoutePackageBuilder`** (4-шаговый glassmorphic модал via `packBuilderStore`)
  - Шаг 1: Название, описание, тип маршрута, теги
  - Шаг 2: SVG-превью полилинии + список waypoints
  - Шаг 3: Монетизация (бесплатно / цена в ₽, доля автора 70%)
  - Шаг 4: Чеклист качества → «Отправить на модерацию»
- Администратор одобряет → пак появляется в `/hub`

**Флоу использования:**
- `/hub` — каталог одобренных паков с фильтрами (тип, цена, сортировка, поиск)
- Карточка пака: SVG-превью маршрута, рейтинг лайк/дизлайк, цена
- «Открыть в Планировщике» → `sessionStorage('hub_pack_to_load')` → `navigate('/planner')` → Planner рисует маршрут и добавляет waypoints как маркеры

**Ключевые файлы:**

| Файл | Назначение |
|---|---|
| `src/stores/packBuilderStore.ts` | Zustand store — глобальное открытие/закрытие Builder |
| `src/components/Planner/RoutePackageBuilder.tsx` | 4-шаговый UI упаковки пака |
| `src/pages/HubPage.tsx` | Solo-страница каталога паков (`/hub`) |
| `src/components/Admin/PackSubmissionsPanel.tsx` | Модерация паков в AdminDashboard |
| `src/components/Profile/MyPacksSection.tsx` | Вкладка «Мои паки» в профиле |
| `src/services/routePackService.ts` | API-сервис (submit, my, hub, rate, purchase) |
| `src/types/routePackSubmission.ts` | TypeScript типы пака |
| `backend/src/routes/routePackSubmissions.js` | API авторов + модерации (9 эндпоинтов) |
| `backend/src/routes/hubRoutes.js` | Публичный Hub API (5 эндпоинтов) |

**Архитектурные решения:**
- `RoutePackageBuilder` смонтирован **глобально в `MainLayout`** (не в `planner.tsx`) — управляется через `packBuilderStore`. Это позволяет вызвать Builder с любой страницы.
- `/hub` — solo-страница: добавлена в `soloPages` в `MainLayout`, отображается через `soloOverlay` (fixed div поверх карты), использует `CentreBackground + MirrorGradientContainer + usePanelRegistration` — точно как `CentrePage` и `ProPage`.
- Hub→Planner: данные пака передаются через `sessionStorage('hub_pack_to_load')`, Planner читает при монтировании и создаёт синтетический `RouteAlternative` из polylane + `facadeMarkers` из waypoints.

> **Про оффлайн‑пакеты Pro‑маршрутов**
> 
> В рамках подготовки Pro‑страницы и механики платных/бесплатных офлайн‑путешествий мы разобрали
> выполнение следующего объёма работ:
> 
> 1. **Схема данных и API** – добавили таблицы `curated_route_packs`/`variants`/`waypoints` с
>    описанием наборов маршрутов и вариантов, реализовали CRUD‑эндпоинты, административную
>    панель и seed‑скрипт. Начальная версия данных хранится как статический JSON, но система
>    автоматически падает на него, если БД недоступна (тестовый режим, локальный запуск).
> 
> 2. **Frontend логика ProPage** – карточки пакетов, фильтрация, выбор варианта, переключение
>    путевых точек и загрузка офлайн‑пакета. Добавлены индикаторы загрузки, состояние
>    скачанных/сохранённых пакетов и диалог скачивания с расчётом веса.
> 
> 3. **Offline service** – обёртка над IndexedDB для сохранения/удаления пакета, вычисление
>    «охваченных регионов», управление очередью синхронизации. Сервис теперь поддерживает
>    Pro‑пакеты наряду с постами и другими черновиками.
> 
> 4. **Админ‑UI** – простая панель управления пакетами, которая позволяет создавать и редактировать
>    JSON или пользоваться удобной формой; добавлен тестовый набор и витесты.
> 
> 5. **Генерация тайлов** – вспомогательный Node‑скрипт `backend/scripts/generate-route-pack-tiles.cjs`,
>    чтобы на Ubuntu с GDAL/Tippecanoe подготовить mbtiles/PNG по GeoJSON из описания пакета.
>    Результат размещается в `public/tiles/curated/<pack-id>` или CDN, дальше фронтенд автоматически
>    скачивает его при сохранении пакета пользователем.
> 
> 
> **Ценность:**
> - Пользователь покупает не абстрактный регион, а готовый маршрут со сценариями, что снижает
>   размер скачиваемого контента и повышает понятность: не нужно грузить всю область, когда
>   достаточно трёх‑четырёх городов.
> - Привязывая GPS‑позицию и офлайн‑метки к пакету, мы гарантируем, что функциональность
>   «Карманного геоблога» работает именно в контексте маршрута, а не просто как карта слоёв.
> - Админам теперь легко добавлять новые маршруты, варианты и точки без ручного редактирования
>   БД, что ускоряет выпуск новых Pro‑продуктов.
> - Скрипт генерации тайлов делает процесс подготовки пакета воспроизводимым, даёт мост к
>   реальному GIS‑workflow и позволяет отделить бэкенд от сборки геоданных.
> 
> Этот модуль — фундамент, на котором позже можно строить платный маркетплейс Pro‑пакетов,
> персональные рекомендации, социальные маршруты и т.п.

### Генерация тайлов для Pro‑маршрутов
Скрипт `backend/scripts/generate-route-pack-tiles.cjs` помогает подготовить
тайлы по заданному маршруту. Он **не запускает** реальные инструменты — просто
создаёт маршрутный GeoJSON и печатает команды `ogr2ogr`/`tippecanoe`, которые
нужно выполнить на Ubuntu с установленным GDAL/Tippecanoe.


### Генерация тайлов для Pro‑маршрутов
Скрипт `backend/scripts/generate-route-pack-tiles.cjs` помогает подготовить
тайлы по заданному маршруту. Он **не запускает** реальные инструменты — просто
создаёт маршрутный GeoJSON и печатает команды `ogr2ogr`/`tippecanoe`, которые
нужно выполнить на Ubuntu с установленным GDAL/Tippecanoe.

Пример:
```bash
cd backend
npm run tiles:generate -- golden-ring /tmp/golden
# выполнить команды из output-папки
```
Результат (.mbtiles, PNG и т.п.) попадает в `public/tiles/curated/<pack-id>/` или на CDN; фронтенд
скачивает его при сохранении пакета пользователем.
- **Избранные метки офлайн** — ★-метки из постов/рейтингов автоматически кешируются при скачивании
- **Freemium-модель** — Premium: карта + метки + полное создание; Free: «слепой режим» по GPS
- **Подробная документация:** [`OFFLANE_ROAD.md`](../OFFLANE_ROAD.md)

### Социальные функции
- Чат (WebSocket, порт 8080)
- Друзья — добавление, управление
- Лента активности сообщества
- Комментарии и рейтинги
- Q&A — система вопросов и ответов
- Гостевой режим — работа без регистрации

### Модерация
- Автоматическая модерация контента с AI-фильтрами
- Гео-валидация координат на запрещённые зоны
- Панель администратора с очередью модерации
- Уведомления о статусе контента (toast + история за 60 дней)

### Аналитика

Все данные — **реальные из PostgreSQL**. Никаких хардкод-заглушек. API: `GET /api/analytics/comprehensive?time_range=7d` (admin-only).

**Три дашборда:**

| Дашборд | Что показывает |
|---------|----------------|
| **Executive** (Обзор) | Пользователи (всего, новые, активные авторы, рост %), контент за период (посты, метки, события, маршруты, комментарии), география меток (топ регионов, по категориям), модерация (статусы по типам, точность ИИ), уведомления (отправлено, прочитано %) |
| **Product Team** (Продукт) | Геймификация (XP за сегодня, за период, средний/макс уровень, источники XP, распределение по уровням, топ-10 по XP, проблемные места), контент (% постов с фото, комментариев/пост, лайков за период, топ авторов) |
| **Technical** (Технический) | ИИ-модерация (точность %, проверено решений, ожидают модерации, отклонено), статусы контента по типам (таблица), общая статистика (контент + пользователи), график постов по дням |

**Источники данных (SQL-запросы к таблицам):**
- `users` — общие метрики пользователей, рост, регистрации по дням
- `posts`, `map_markers`, `events`, `travel_routes` — контент (по периоду и всего), статусы модерации
- `comments` — количество комментариев (всего и за период)
- `user_levels`, `xp_history` — уровни, XP источники, распределение, топ пользователей
- `ai_moderation_decisions` — точность ИИ-модерации
- `notifications` — статистика уведомлений (отправлено / прочитано)
- `post_likes` — лайки за период

**Фильтрация по времени:** 24h, 7d, 30d, 90d — единый селектор на каждом дашборде.

**Система «Do Not Track»:** проверка `analytics_opt_out` через middleware перед сохранением трекинг-событий.

---

## Технологии

### Frontend Stack
| Технология | Назначение |
|---|---|
| **React 18.2** + **TypeScript** | Основной фреймворк |
| **Vite 5** | Сборка и dev-сервер |
| **Zustand 5** | Глобальное состояние (stores) |
| **React Context** | Контексты (auth, layout, theme и др.) |
| **Tailwind CSS** + **styled-components** | Стилизация |
| **Framer Motion** | Анимации |
| **Radix UI** + **MUI** | UI-компоненты |
| **Recharts** + **react-big-calendar** | Графики и календарь |
| **i18next** | Интернационализация (заготовка) |
| **Vitest** | Тестирование |

### Карты и геолокация
| Технология | Назначение |
|---|---|
| **Yandex Maps API** | Основная картографическая система |
| **Leaflet** | Альтернативный провайдер |
| **OpenRouteService** | Построение маршрутов |
| **Яндекс Geocoder** | Геокодирование |

---

## Архитектура проекта

```
frontend/
├── public/                    # Статические файлы, PWA манифест
├── src/
│   ├── analytics/             # Система аналитики
│   │   ├── services/          # analyticsOrchestrator, product/behavioral/performance/error
│   │   ├── hooks/             # useComprehensiveAnalytics
│   │   ├── types/             # analytics.types.ts
│   │   ├── utils/             # consent, anonymization
│   │   └── dashboard/         # MetricCard, Executive/Product/Technical дашборды
│   ├── api/                   # API клиент и утилиты
│   ├── assets/                # Статические ресурсы, Lottie-анимации
│   ├── components/            # React компоненты (70+)
│   │   ├── Achievements/      # Дашборд достижений
│   │   ├── activity/          # Лента, карточки, статистика активности
│   │   ├── Admin/             # Админ-панель, модерация
│   │   ├── Calendar/          # Компоненты календаря
│   │   ├── chat/              # Чат-компоненты
│   │   ├── Common/            # Общие переиспользуемые компоненты
│   │   ├── Events/            # Блоки событий, детальная страница
│   │   ├── Gamification/      # LevelCard, DailyGoals, XPNotification, LevelUpAnimation
│   │   ├── Geo/               # Гео-компоненты
│   │   ├── Glass/             # Glass-эффекты
│   │   ├── icons/             # Иконки
│   │   ├── InfluenceCenter/   # Центр влияния, тренды
│   │   ├── Layout/            # Компоненты макета
│   │   ├── Map/               # Основная карта (Leaflet), фильтры, легенда, попапы
│   │   ├── Maps/              # PostMap (карта в постах)
│   │   ├── Markers/           # Компоненты маркеров
│   │   ├── Mobile/            # Мобильные компоненты
│   │   ├── Modals/            # Модальные окна
│   │   ├── Moderation/        # Компоненты модерации
│   │   ├── Notifications/     # Toast, панель, иконка уведомлений
│   │   ├── Offline/           # Офлайн-карты: RussiaMapSvg, RegionPanel, OfflineMapViewer
│   │   ├── Planner/           # Планировщик: RouteBuilder, RouteEditor, AIGuide
│   │   ├── Posts/             # Конструктор, карточка, список, черновики
│   │   ├── Premium/           # Премиум-компоненты
│   │   ├── Profile/           # Компоненты профиля
│   │   ├── QnA/               # Вопросы и ответы
│   │   ├── Regions/           # Регионы
│   │   ├── RoutePlanner/      # Планировщик маршрутов
│   │   ├── RussiaContent/     # Контент по России
│   │   ├── Search/            # Поиск
│   │   ├── TravelCalendar/    # TravelCalendar, CircularCalendar
│   │   ├── ui/                # Базовые UI-элементы
│   │   ├── UserCabinet/       # Личный кабинет
│   │   ├── YandexMap/         # Интеграция с Яндекс.Картами
│   │   ├── FavoritesPanel.tsx # Панель избранного
│   │   ├── Header.tsx         # Шапка
│   │   ├── Sidebar.tsx        # Боковая панель навигации
│   │   └── ...                # ErrorBoundary, MirrorGradientProvider и др.
│   ├── data/                  # Географические данные
│   │   ├── russiaRegionsPaths.ts  # SVG-пути 85 регионов (Albers проекция)
│   │   └── russiaRegionsGeo.ts    # Метаданные регионов (центры, ФО, площади)
│   ├── config/                # Конфигурация
│   │   ├── api.ts             # API ключи и настройки
│   │   ├── features.ts        # Feature flags
│   │   ├── gamificationFeatures.ts
│   │   ├── xpSources.ts      # Источники XP
│   │   └── russia.ts         # Настройки для России
│   ├── constants/             # Константы (markerCategories и др.)
│   ├── contexts/              # React контексты (9 шт.)
│   │   ├── AuthContext.tsx
│   │   ├── FavoritesContext.tsx
│   │   ├── GamificationContext.tsx
│   │   ├── GuestContext.tsx
│   │   ├── LayoutContext.tsx    # Обёртка над contentStore
│   │   ├── LoadingContext.tsx
│   │   ├── RoutePlannerContext.tsx
│   │   ├── SideContentContext.tsx
│   │   └── ThemeContext.tsx
│   ├── stores/                # Zustand stores (8 шт.)
│   │   ├── contentStore.ts    # leftContent/rightContent (синхронный, без startTransition)
│   │   ├── eventsStore.ts     # selectedEvent, openEvents
│   │   ├── geoFocusStore.ts   # Фокус на гео-объекте
│   │   ├── mapStateStore.ts   # center, zoom, provider (сохраняется при переключении страниц)
│   │   ├── offlineTilesStore.ts # Статусы скачивания регионов, активный регион
│   │   ├── regionsStore.ts    # Выбранные регионы
│   │   ├── regionCities.ts    # Города по регионам РФ
│   │   └── themeStore.ts      # Тема приложения
│   ├── hooks/                 # Пользовательские хуки (37+)
│   │   ├── useAchievements.ts, useDailyGoals.ts, useLevelProgress.ts
│   │   ├── useActivityStats.ts, useModeration.ts, useAnalyticsConsent.ts
│   │   ├── useEnhancedRouting.ts, useFavoriteRoutes.ts, useRouteBuilder.ts
│   │   ├── useUserLocation.ts, useRussiaRestrictions.ts
│   │   ├── useAdaptiveClustering.ts, useMarkerClustering.ts
│   │   ├── useFriends.ts, useRating.ts, useReporting.ts
│   │   ├── useEventState.ts, useMapDisplayMode.ts, useMapStyle.ts
│   │   ├── useServiceWorker.ts, useWelcomeModal.ts
│   │   ├── useDebounce.ts, useIsVisible.ts, useLazyImage.ts, useLazyMarkers.ts
│   │   └── ...
│   ├── pages/                 # Страницы приложения (30+)
│   │   ├── HomePage.tsx, Home.tsx
│   │   ├── Map.tsx            # Карта (Leaflet + Map Facade)
│   │   ├── Planner.tsx        # Планировщик маршрутов (Yandex Maps)
│   │   ├── OfflinePage.tsx    # Офлайн-карты (SVG-карта России + панель регионов)
│   │   ├── OfflineMapTest.tsx # Тестовый рендеринг MBTiles
│   │   ├── Posts.tsx, Posts/PostDetail.tsx
│   │   ├── Calendar.tsx       # Календарь событий
│   │   ├── Activity.tsx       # Лента активности
│   │   ├── Chat.tsx, Friends.tsx
│   │   ├── ProfilePage.tsx, ProfileRoutes.tsx
│   │   ├── CentrePage.tsx     # Центр влияния
│   │   ├── AdminDashboard.tsx, AdminSubscriptionsPage.tsx
│   │   ├── ModerationPage.tsx
│   │   ├── LoginPage.tsx, RegisterPage.tsx
│   │   ├── PrivacyPolicy.tsx, UserAgreement.tsx
│   │   ├── GalaxyPreview.tsx
│   │   ├── PageLayer.tsx      # Рендерер левого/правого контента
│   │   ├── PersistentMaps.tsx
│   │   ├── admin/             # Админ-страницы
│   │   └── Mobile/            # Мобильные страницы
│   ├── services/              # Сервисы (40+)
│   │   ├── projectManager.ts  # Инициализация карты (singleton)
│   │   ├── postsService.ts, markerService.ts, routeService.ts, routesService.ts
│   │   ├── activityService.ts, eventService.ts, externalEventsService.ts
│   │   ├── gamificationFacade.ts, xpService.ts, globalGoalsService.ts
│   │   ├── moderationService.ts, aiModerationService.ts
│   │   ├── moderationNotificationsService.ts, moderationNotifications.ts
│   │   ├── commentsService.ts, ratingsService.ts, qnaService.ts
│   │   ├── routingService.ts  # ORS API
│   │   ├── yandexMapsService.ts, geocodingService.ts
│   │   ├── placeDiscoveryService.ts, locationService.ts, zoneService.ts
│   │   ├── storageService.ts  # Единый фасад (localStorage + IndexedDB)
│   │   ├── offlineContentStorage.ts, offlineContentQueue.ts
│   │   ├── offlinePostsStorage.ts, offlinePostsQueue.ts, offlineService.ts
│   │   ├── guestActionsService.ts, guestDrafts.ts
│   │   ├── coordinateEnhancer.ts, routeGeometryUtil.ts, routeTitleService.ts
│   │   ├── IntegrationService.ts, localModerationStorage.ts, mapProvider.ts
│   │   ├── map_facade/        # Фасад карт (canonical)
│   │   │   ├── IMapRenderer.ts
│   │   │   ├── MapContextFacade.ts
│   │   │   ├── types.ts       # GeoPoint, PersistedRoute, UnifiedMarker
│   │   │   ├── index.ts
│   │   │   └── adapters/      # YandexPlannerRenderer, OSMMapRenderer, OfflineOSMRenderer
│   │   └── routeExporters/    # GPX/KML/GeoJSON сериализаторы + exportClient
│   ├── types/                 # TypeScript типы (30+)
│   │   ├── activity.ts, marker.ts, route.ts, post.ts, postTypes.ts
│   │   ├── gamification.ts, user.ts, favorites.ts, event.ts, eventRef.ts
│   │   ├── chat.ts, friends.ts, globalGoals.ts
│   │   ├── routeBuilder.ts, routeCategories.ts, routePoint.ts
│   │   ├── accessControl.ts, offlineDraft.ts, mapActionButton.ts
│   │   └── ...
│   ├── utils/                 # Утилиты (20+)
│   │   ├── auth.ts, dateUtils.ts, xpCalculator.ts
│   │   ├── dailyGoalGenerator.ts, gamificationHelper.ts
│   │   ├── russiaBounds.ts, coordinateConverter.ts
│   │   ├── postUtils.ts, routePointUtils.ts
│   │   ├── security.ts, debugLogger.ts
│   │   └── ...
│   ├── styles/                # Глобальные стили
│   ├── layouts/               # MainLayout, MobileLayout
│   ├── i18n/                  # Интернационализация (заготовка)
│   ├── lib/                   # Библиотечные утилиты
│   ├── data/                  # Статические данные
│   ├── App.tsx                # Корневой компонент
│   ├── main.tsx               # Точка входа
│   └── routes.tsx             # Конфигурация маршрутов
├── docs/                      # Документация (25+ файлов)
│   ├── ARCHITECTURE.md
│   ├── GAMIFICATION_DEVELOPER_GUIDE.md
│   ├── GAMIFICATION_PLAN.md / STATUS.md / IMPLEMENTATION.md / ROLLOUT_STRATEGY.md
│   ├── GPS_TRACKS_HANDOVER.md
│   ├── GEO_ROUTES_API.md
│   ├── COORDINATE_SYSTEM.md / COORDINATE_QUICK_START.md
│   ├── MAP_FACADE_ANALYSIS.md / FACADE_CLEAN.md
│   ├── MOBILE_ADAPTATION_GUIDE.md
│   ├── DARK_THEME_IMPLEMENTATION.md
│   ├── ROUTE_ARCHITECTURE.md
│   └── ...
├── tests/                     # Тесты (Vitest)
├── package.json
├── vite.config.ts
├── vitest.config.cjs
├── tailwind.config.js
└── tsconfig.json
```

---

## Ключевые архитектурные решения

### Map Facade

Единый интерфейс для работы с разными провайдерами карт.

- **Canonical папка**: `src/services/map_facade/` (устаревшая `mapFacade/` camelCase — удалена)
- **MapContextFacade** — singleton, пул рендереров, переключение контекстов
- **projectManager** — инициализация карты с проверкой `isConnected`, `getMapApi()` с привязанными методами
- **Адаптеры**: `YandexPlannerRenderer`, `OSMMapRenderer`, `OfflineOSMRenderer`
- **Интерфейс `IMapRenderer`**: `init`, `renderMarkers`, `renderRoute`, `removeRoute`, `clear`, `destroy`, `onClick`, `setView`, `planRoute`, `setMapMargin`, `resetMapMargin`, `onRouteGeometry`
- **Ключевые типы**: `GeoPoint`, `MapConfig`, `UnifiedMarker`, `PersistedRoute`

Подробнее: [docs/MAP_FACADE_ANALYSIS.md](docs/MAP_FACADE_ANALYSIS.md), [docs/FACADE_CLEAN.md](docs/FACADE_CLEAN.md)

> Как добавить адаптер: создать файл в `src/services/map_facade/adapters/`, реализовать `IMapRenderer`, экспортировать из каталога.

### contentStore (двухоконный режим)

Zustand-store управляет `leftContent`/`rightContent` для двухоконного интерфейса. Все методы **синхронные** (без `startTransition` — удалён для устранения задержки 1-2 сек при навигации). `LayoutContext` — обёртка над `contentStore` (не дублирование).

### mapStateStore

Zustand-store сохраняет `center`, `zoom`, `provider` карты при переключении страниц Map ↔ Planner. Маркеры кэшируются глобально. Исправлена утечка памяти — добавлен `destroyMap()` в `projectManager`.

### storageService

Единый фасад для key/value (`localStorage` с fallback) + `indexedDBService` для IndexedDB. В тестах работает in-memory fallback. Подробнее: `src/services/storageService.ts`.

### GPS Tracks

Запись GPS-треков, локальное хранение (IndexedDB), экспорт (GPX/KML/GeoJSON), интеграция с геймификацией. Подробнее: [docs/GPS_TRACKS_HANDOVER.md](docs/GPS_TRACKS_HANDOVER.md), [docs/GEO_ROUTES_API.md](docs/GEO_ROUTES_API.md).

---

## Интеграция компонентов

| Связь | Описание |
|---|---|
| Посты ↔ Карты | Автоматическое создание меток |
| События ↔ Календарь ↔ Карта | События из календаря отображаются на карте с маркерами |
| Календарь ↔ Планировщик | События доступны в планировщике маршрутов |
| Геймификация ↔ Контент | Автоматическое начисление XP за посты и метки |
| Достижения ↔ Активность | Разблокировка за действия пользователя |
| Офлайн ↔ Все типы контента | Черновики и синхронизация |

---

## Геймификация — детали

### Источники XP

| Действие | XP |
|---|---|
| Создание поста | 50 |
| Пост с фото | +25 (итого 75) |
| Пост с меткой | +30 (итого 80) |
| Пост с фото и меткой | +55 (итого 105) |
| Создание метки | 30 |
| Метка с фото | +20 (итого 50) |
| Метка с описанием | +15 (итого 45) |
| Высокое качество | +20 |
| Идеальное качество | +30 |
| Ежедневная цель | 25 |
| Все цели за день | +50 бонус |
| Стрик активности | +10 за каждый день |

### Ранги
| Ранг | Уровень |
|---|---|
| 🌱 Новичок | 1-5 |
| 🌿 Путешественник | 6-10 |
| 🌳 Исследователь | 11-15 |
| 🏔️ Географ | 16-20 |
| 👑 ГеоБлоггер | 21+ |

Подробнее: [docs/GAMIFICATION_DEVELOPER_GUIDE.md](docs/GAMIFICATION_DEVELOPER_GUIDE.md)

---

## Партнёрская программа

Платформа предлагает два пути участия в партнёрской программе с чётким разделением ролей.

### Структура программы

```
┌─────────────────────────────────────────────────────────────────┐
│  SIMPLE USER (Активный автор)                                    │
│  ├── НЕТ реферальной ссылки                                      │
│  ├── Прогресс: маршруты + положительные оценки                   │
│  ├── Комиссия: 15% → 20% → 25% (только кураторские паки)         │
│  └── Статусы: novice → ambassador → expert                       │
│                                                                  │
│  PRO GUIDE (Профессиональный гид)                                │
│  ├── ЕСТЬ реферальная ссылка                                     │
│  ├── Доступ к партнёрскому дашборду (/partner)                   │
│  ├── Премиум-рефералы: 10→10%, 25→15%, 50→20%, 100+→25%          │
│  ├── Продажи паков: 10→15%, 25→20%, 50→25%, 100+→30%             │
│  └── Статус: pro_guide (по приглашению)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Simple User (Активный автор)

Для пользователей, которые создают контент внутри платформы.

| Уровень | Требования | Комиссия |
|---------|------------|----------|
| 🌱 Новичок | Начальный уровень | 15% |
| ⭐ Амбассадор | 8 маршрутов, 10 положительных оценок | 20% |
| 🏆 Про-эксперт | 15 маршрутов, 20 положительных оценок | 25% |

**Особенности:**
- НЕТ реферальной ссылки
- Заработок только на кураторских паках
- Максимум 25% комиссии

### Pro Guide (Профессиональный гид)

Для профессиональных гидов с аудиторией вне платформы.

**Премиум-рефералы (оплаченные подписки):**

| Подписчиков | Комиссия |
|-------------|----------|
| 10+ | 10% |
| 25+ | 15% |
| 50+ | 20% |
| 100+ | 25% |

**Продажи кураторских паков:**

| Продаж | Комиссия |
|--------|----------|
| 10+ | 15% |
| 25+ | 20% |
| 50+ | 25% |
| 100+ | 30% |

**Особенности:**
- ЕСТЬ реферальная ссылка
- Полный доступ к партнёрскому дашборду
- Максимум 30% на эксклюзивный контент
- Статус присваивается по приглашению через админ-панель

### API и страницы

| Endpoint | Описание |
|----------|----------|
| `GET /api/partners/progress` | Прогресс пользователя (разный для simple/pro_guide) |
| `POST /api/partners/apply` | Заявка на партнёрство (simple) |
| `POST /api/partners/apply-guide` | Заявка на Pro Guide |
| `GET /api/users/partner` | Статистика партнёра (только для pro_guide) |

| Страница | Роль | Описание |
|----------|------|----------|
| `/partners` | Все | Информация о программе, прогресс, форма заявки |
| `/partner` | Pro Guide | Партнёрский дашборд со статистикой |
| `/partner/apply` | Все | Форма заявки Pro Guide |
| `/pro` | Все | PRO-подписка и офлайн-паки |

### Конфигурация

```typescript
// frontend/src/data/partnerTiers.ts

export const SimpleAuthorTiers = [
  { level: 'novice', threshold: 0, commission: 15 },
  { level: 'ambassador', threshold: 8, commission: 20 },
  { level: 'expert', threshold: 15, commission: 25 },
];

export const ProGuidePremiumTiers = [
  { threshold: 10, commission: 10 },
  { threshold: 25, commission: 15 },
  { threshold: 50, commission: 20 },
  { threshold: 100, commission: 25 },
];

export const ProGuidePackTiers = [
  { threshold: 10, commission: 15 },
  { threshold: 25, commission: 20 },
  { threshold: 50, commission: 25 },
  { threshold: 100, commission: 30 },
];
```

---

## PRO-подписка

Платная подписка для доступа к офлайн-картам и расширенным функциям.

**Цена:** 350 ₽/месяц

### Преимущества PRO

| Функция | Free | PRO |
|---------|------|-----|
| Просмотр карты онлайн | ✅ | ✅ |
| Скачивание офлайн-паков | ❌ | ✅ |
| GPS-навигация офлайн | ❌ | ✅ |
| Создание кураторских паков | ❌ | ✅ |
| Скидка на кураторские паки | — | **15%** |
| Приоритетная поддержка | ❌ | ✅ |

### Экономия с PRO

При покупке 3 пакетов по 500 ₽ со скидкой 15% вы экономите **225 ₽** — это 65% стоимости подписки.

PRO окупается за первую же поездку при активных путешествиях.

### Кураторские паки

Пользователи могут покупать готовые маршрутные пакеты:

- **Федеральные маршруты** — Золотое кольцо, Алтай, Камчатка
- **Региональные паки** — Карелия, Байкал, Дагестан
- **Событийные паки** — фестивали, мероприятия

### Модель доступа

```
┌─────────────────────────────────────────────────────────────────┐
│  Купленный пакет                                                │
│  ├── Доступ ПОСТОЯННЫЙ (не зависит от подписки)                 │
│  └── Обновления включены                                        │
│                                                                  │
│  Premium-регион (без покупки)                                   │
│  ├── Доступ только при активной PRO-подписке                    │
│  └── После окончания подписки — недоступен                       │
└─────────────────────────────────────────────────────────────────┘
```

### API

| Endpoint | Описание |
|----------|----------|
| `GET /api/curated-route-packs` | Каталог пакетов |
| `POST /api/curated-route-packs/:id/purchase` | Покупка пакета |
| `GET /api/users/purchased-route-packs` | Купленные пакеты пользователя |

---

## Установка и запуск

### Предварительные требования
- **Node.js** 18+
- **npm**
- **PostgreSQL** (для бэкенда, порт 5432)

### Установка

```bash
git clone git@github.com:megatimur1000-jpg/NewGeoBlogRF.git
cd NewGeoBlogRF/frontend
npm install
cp .env.example .env   # Отредактируйте .env
npm run dev
```

Откройте в браузере: `http://localhost:5173`

---

## Команды разработки

```bash
# Разработка
npm run dev              # Запуск dev-сервера (Vite)
npm run build            # Сборка: tsc + vite build
npm run build:prod       # Production-сборка (node build-production.js)
npm run build:analyze    # Сборка + анализ бандла
npm run preview          # Предпросмотр сборки

# Линтинг
npm run lint             # ESLint проверка
npm run lint:fix         # ESLint с автоисправлением

# Тестирование
npm test                 # Vitest (vitest.config.cjs)

# Утилиты
npm run clean            # Очистка dist и кеша Vite
npm run security:audit   # Аудит безопасности зависимостей
npm run security:fix     # Автоисправление уязвимостей
```

---

## Конфигурация

### Переменные окружения (.env)

```env
# Backend API
VITE_API_URL=http://localhost:3002
VITE_API_BASE_URL=http://localhost:3002
VITE_API_ORIGIN=http://localhost:3002

# WebSocket
VITE_WS_URL=ws://localhost:8080

# Карты и геокодирование
VITE_YANDEX_MAPS_API_KEY=your_yandex_maps_key
VITE_STADIA_MAPS_API_KEY=your_stadia_maps_key          # опционально
VITE_OPENROUTESERVICE_API_KEY=your_openrouteservice_key

# Feature flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false
VITE_ENABLE_PWA=false
```

### API-ключи

- **Yandex Maps** — [developer.tech.yandex.ru](https://developer.tech.yandex.ru/)
- **OpenRouteService** — [openrouteservice.org](https://openrouteservice.org/)

---

## Документация

| Документ | Описание |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Общая архитектура |
| [docs/GAMIFICATION_DEVELOPER_GUIDE.md](docs/GAMIFICATION_DEVELOPER_GUIDE.md) | Руководство по геймификации |
| [docs/GAMIFICATION_PLAN.md](docs/GAMIFICATION_PLAN.md) | План геймификации |
| [docs/GAMIFICATION_STATUS.md](docs/GAMIFICATION_STATUS.md) | Статус реализации |
| [docs/GPS_TRACKS_HANDOVER.md](docs/GPS_TRACKS_HANDOVER.md) | GPS-треки — handover |
| [docs/GEO_ROUTES_API.md](docs/GEO_ROUTES_API.md) | API маршрутов |
| [docs/COORDINATE_SYSTEM.md](docs/COORDINATE_SYSTEM.md) | Система координат |
| [docs/MAP_FACADE_ANALYSIS.md](docs/MAP_FACADE_ANALYSIS.md) | Анализ Map Facade |
| [docs/MOBILE_ADAPTATION_GUIDE.md](docs/MOBILE_ADAPTATION_GUIDE.md) | Мобильная адаптация |
| [docs/DARK_THEME_IMPLEMENTATION.md](docs/DARK_THEME_IMPLEMENTATION.md) | Тёмная тема |
| [docs/ROUTE_ARCHITECTURE.md](docs/ROUTE_ARCHITECTURE.md) | Архитектура маршрутов |

---

## Glass Theme — Система стилей стекла

Вся стилизация стеклянных элементов построена на **4 состояниях** через CSS-переменные.
Автоматически переключается при смене `data-theme="light"|"dark"` — никаких отдельных dark-overrides.

### Принцип: 2 слоя

```
┌────────────────────────────────────────┐
│  Layer 1 (L1) — КОНТЕЙНЕР             │
│  Тулбар, панель, попап, сайдбар       │
│  gradient bg + backdrop-filter: blur   │
│  ┌──────────────────────────────────┐  │
│  │  Layer 2 (L2) — КОНТРОЛ         │  │
│  │  Кнопка, инпут, чип, карточка   │  │
│  │  flat bg, БЕЗ backdrop-filter   │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

- **L1** — единственный элемент с `backdrop-filter`. Контейнер размывает фон.
- **L2** — плоский полупрозрачный фон внутри. Без собственного blur, чтобы не было двойного наложения.

### CSS-переменные (файл `styles/_glass-theme.css`)

| Переменная | Light | Dark | Назначение |
|---|---|---|---|
| `--glass-l1-bg` | `rgba(255,255,255, 0.1→0.05)` gradient | `rgba(0,0,0, 0.1→0.05)` gradient | Фон контейнера |
| `--glass-l1-border` | `rgba(255,255,255, 0.2)` | `rgba(0,0,0, 0.12)` | Рамка контейнера |
| `--glass-l1-shadow` | `0 8px 32px rgba(0,0,0,0.1)` | `0 8px 32px rgba(0,0,0,0.1)` | Тень контейнера |
| `--glass-l2-bg` | `rgba(255,255,255, 0.1)` | `rgba(0,0,0, 0.06)` | Фон контрола |
| `--glass-l2-border` | `rgba(255,255,255, 0.2)` | `rgba(0,0,0, 0.12)` | Рамка контрола |
| `--glass-l2-bg-hover` | `rgba(255,255,255, 0.15)` | `rgba(0,0,0, 0.1)` | Hover |
| `--glass-l2-bg-active` | `rgba(255,255,255, 0.2)` | `rgba(0,0,0, 0.14)` | Active / selected |
| `--glass-l2-border-active` | `rgba(255,255,255, 0.4)` | `rgba(0,0,0, 0.2)` | Active border |
| `--glass-l2-shadow` | `0 4px 12px rgba(0,0,0,0.15)` | `none` | Тень контрола |
| `--glass-blur` | `blur(10px) saturate(180%)` | то же | Стандартный blur |
| `--glass-blur-strong` | `blur(16px) saturate(180%)` | то же | Усиленный blur (модалки) |
| `--glass-text` | `rgba(0,0,0, 0.8)` | `rgba(0,0,0, 0.85)` | Основной текст |
| `--glass-text-secondary` | `rgba(0,0,0, 0.5)` | `rgba(0,0,0, 0.6)` | Вторичный текст |

### Утилитарные классы

```css
/* Контейнер — тулбар, панель, попап */
.glass-l1 {
  background: var(--glass-l1-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-l1-border);
  box-shadow: var(--glass-l1-shadow);
}

/* Контрол — кнопка, инпут, карточка */
.glass-l2 {
  background: var(--glass-l2-bg);
  border: 1px solid var(--glass-l2-border);
  /* hover/active состояния встроены */
}

/* Модальное окно — усиленный blur */
.glass-l1-strong {
  background: var(--glass-l1-bg);
  backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-l1-border);
}
```

### Как использовать в новом компоненте

```tsx
// Контейнер с backdrop-filter
<div className="glass-l1" style={{ borderRadius: 20, padding: 16 }}>
  
  {/* Кнопка внутри — БЕЗ собственного blur */}
  <button className="glass-l2" style={{ borderRadius: 12, padding: '8px 16px' }}>
    Действие
  </button>

  {/* Инпут */}
  <input className="glass-l2" style={{ borderRadius: 12 }} />
</div>

// Модальное окно
<div className="glass-l1-strong" style={{ borderRadius: 20 }}>
  ...
</div>
```

> **Важно:** inline-стили используй **только для layout** (позиция, padding, borderRadius, zIndex).
> Все glass-свойства (background, border, shadow, backdrop-filter) — **только через классы/переменные**.

### Где применено

| Компонент | Класс / переменные | Файл |
|---|---|---|
| Map toolbar | `.glass-l1` (контейнер), `.glass-l2` (инпут, кнопки) | `pages/Map.tsx` |
| Map action buttons | `--glass-l1-*` / `--glass-l2-*` в CSS | `styles/_components.css` |
| Category filter | `.glass-l1` (панель), `.glass-l2` (чипсы) | `components/Map/CategoryQuickFilter.tsx` |
| GlassPanel | `--glass-l1-*` / `--glass-l2-*` в CSS | `components/Glass/GlassPanel.css` |
| Mini popups | `--glass-l1-*` в CSS | `components/Map/MiniMarkerPopup.css`, `EventMiniPopup.css` |
| Planner toolbar | `.glass-l1`, `.glass-l2` | `pages/Planner.tsx` |
| Planner modals | `.glass-l1-strong` | `pages/Planner.tsx` |
| Posts container | `--glass-l1-*` в CSS | `styles/_content.css` |
| Post cards | `--glass-l2-*` в styled-component | `components/Posts/PostCard.tsx` |
| Filter buttons | `--glass-l2-*` в CSS | `styles/_content.css` |
| Theme toggle | `--glass-l2-*` в CSS | `styles/_glass-theme.css` |

### Переключение темы

```
themeStore.ts (Zustand) → document.documentElement.setAttribute('data-theme', theme)
                        → localStorage.setItem('theme', theme)
```

При смене `data-theme` на `<html>`:
1. Все `--glass-l1-*` / `--glass-l2-*` переменные мгновенно принимают новые значения
2. Все элементы с классами `.glass-l1` / `.glass-l2` обновляются автоматически
3. Все правила через `var(--glass-*)` в CSS-файлах обновляются автоматически

### Правила при добавлении нового glass-элемента

1. **Никогда** не добавляй `backdrop-filter` на элементы внутри glass-контейнера
2. **Никогда** не пиши отдельные `[data-theme="dark"]` оверрайды — используй CSS vars
3. **Один** `backdrop-filter` на иерархию — только на L1 контейнере
4. Для styled-components используй `var(--glass-l2-bg)` и т.д. вместо хардкод rgba

### Файловая структура стилей

```
styles/
├── _glass-theme.css     ← ГЛАВНЫЙ: переменные + утилит-классы
├── _content.css         ← Posts: .page-main-panel (L1), .post-item (L2), filter-btn
├── _components.css      ← .btn-glass (L2), .map-action-buttons-container (L1)
├── _dark-overrides.css  ← УСТАРЕЛ (пустой, импорт удалён)
├── GlobalStyles.css     ← Общие layout-стили
├── PageLayout.css       ← Fallback для .page-main-panel
└── index.css            ← Импорт всех стилей
```

---

## Состояние проекта

### MVP 1.0 — завершён

- [x] Посты — конструктор, геолокация, черновики, офлайн
- [x] Интерактивная карта — Map Facade, множественные провайдеры
- [x] Планировщик маршрутов с сохранением в БД
- [x] Календарь событий — 5 режимов, интеграция с картой и планировщиком
- [x] Система геймификации — уровни, XP, цели, достижения, защита от накруток
- [x] Офлайн-режим — IndexedDB, очередь, синхронизация, черновики
- [x] Офлайн-карты — SVG-карта России (85 регионов, Albers), страница `/offline`, dropdown в Map.tsx
- [x] Модерация — AI-фильтры, панель администратора, уведомления
- [x] Комплексная аналитика — продуктовая, поведенческая, техническая
- [x] Аутентификация JWT + гостевой режим
- [x] Двухоконный интерфейс
- [x] Адаптивный дизайн + мобильные страницы
- [x] PWA
- [x] Социальные функции — чат, друзья, лента активности
- [x] Map Facade — единый интерфейс, кастомные маркеры, маркеры событий

### В разработке (MVP 2.0)

- [ ] **Офлайн-карты «Карманный геоблог»** — скачивание тайлов zoom 6–12, GPS-позиция, избранные метки, создание контента офлайн ([OFFLANE_ROAD.md](../OFFLANE_ROAD.md))
- [ ] API bundle `/api/offline/region/:id/bundle` — сборка данных для скачивания региона
- [ ] Leaflet TileLayer из IndexedDB — офлайн-рендеринг скачанных тайлов
- [ ] GPS-треки — запись в реальном времени, экспорт
- [ ] Расширенная модерация — гео-валидация, жалобы
- [ ] Push-уведомления
- [ ] Цели недели

### Планируется

- [ ] Premium-gate для офлайн-скачивания (freemium-модель)
- [ ] Интеграция с социальными сетями
- [ ] Система рекомендаций AI
- [ ] Мультиязычность
- [ ] API для сторонних разработчиков

---

## Аутентификация

- JWT-токены с автоматическим обновлением
- Защищённые маршруты с проверкой авторизации
- Персистентная сессия
- Гостевой режим (`GuestContext`, `guestActionsService`)

---

## Интерфейс

### Адаптивный дизайн
- Мобильная версия — отдельные страницы/компоненты в `src/pages/Mobile/` и `src/components/Mobile/`
- Планшетная и десктопная версии

### UI-компоненты
- Glassmorphism панели — эффект матового стекла (календарь, кнопки карты, мини-попапы)
- Стеклянная колонка кнопок (MapActionButtons) — A11y, тёмная/светлая тема
- Круговой календарь — карусель месяцев
- Framer Motion анимации — повышение уровня, XP, пульсация маркеров

---

## Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## Лицензия

MIT License — см. файл [LICENSE](LICENSE)

## Контакты

- **GitHub:** [@megatimur1000-jpg](https://github.com/megatimur1000-jpg)

---

**ГеоБлог.рф** — платформа для создания интерактивных постов с интеграцией карт и маршрутов по России
