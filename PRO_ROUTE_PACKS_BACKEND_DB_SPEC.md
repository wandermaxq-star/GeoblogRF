# PRO_ROUTE_PACKS_BACKEND_DB_SPEC — Backend и БД для curated маршрутных пакетов

**Дата:** 7 марта 2026  
**Статус:** Планирование  
**Приоритет:** Высокий  
**Связанные документы:** [PRO_ROUTE_PACKS_CONCEPT.md](PRO_ROUTE_PACKS_CONCEPT.md), [OFFLANE_ROAD.md](OFFLANE_ROAD.md), [README.md](README.md)

---

## 1. Назначение документа

Этот документ фиксирует серверную и базовую DB-архитектуру для нового домена:

**curated маршрутные оффлайн-пакеты Pro-раздела**.

Документ нужен для того, чтобы:

- не смешать пользовательские маршруты и curated-каталог;
- определить отдельный домен данных для Pro-маршрутов;
- подготовить backend API для маршрутных bundle;
- задать правильный порядок миграции без преждевременной переусложнённости.

Это не документ про все маршруты в системе. Это документ только про **Pro route packs** и связанный backend.

---

## 2. Главный архитектурный принцип

### Нельзя смешивать два домена

В проекте должны существовать два отдельных домена:

1. **User Routes Domain**
2. **Curated Route Packs Domain**

### User Routes Domain

Сюда входят:

- маршруты пользователей;
- оффлайн-черновики маршрутов;
- личные поездки;
- частные или повседневные маршруты;
- пользовательские треки.

Это обычный UGC-контент.

### Curated Route Packs Domain

Сюда входят:

- федерально значимые маршруты;
- известные сценарии поездок;
- событийные маршрутные подборки;
- редакционные маршруты проекта;
- в будущем маршруты проверенных гидов.

Это curated-контент.

### Жёсткое правило

**Пользовательский маршрут не должен автоматически попадать в curated Pro-каталог.**

Если когда-либо маршрут пользователя и может стать основой нового curated-пакета, то только через отдельный редакционный процесс и уже как новая самостоятельная сущность.

---

## 3. Текущее состояние backend-домена маршрутов

По коду видно, что маршрутный домен уже существует, но не полностью консистентен.

### Наблюдаемое состояние

- основная рабочая таблица маршрутов в большинстве backend-кода — `travel_routes`;
- таблица `route_waypoints` уже участвует в маршрутах;
- при этом в [backend/src/routes/routes.js](backend/src/routes/routes.js#L1) есть неоднородность: часть чтения идёт через `routes`, а основная работа и запись идут через `travel_routes`;
- аналитика, модерация и ratings уже ориентируются на `travel_routes`.

### Вывод

Для пользовательского домена нужно зафиксировать **один источник истины**. Судя по текущему коду, им должен стать `travel_routes`.

Но это решение относится только к пользовательским маршрутам.

**Curated route packs не должны использовать ту же таблицу.**

---

## 4. Что именно нужно сделать на уровне backend

Backend для route packs должен решать следующие задачи:

- отдавать каталог curated-маршрутов;
- отдавать карточку маршрута с вариантами;
- отдавать список waypoint, POI и событий;
- уметь собирать состав оффлайн-bundle;
- быть готовым к редакционным и в будущем гидовым пакетам;
- не зависеть от пользовательских маршрутов как от базовой сущности.

---

## 5. Границы первого серверного этапа

На первом серверном этапе не нужен полноценный маркетплейс гидов.

### Достаточно реализовать

- curated-пакеты проекта;
- вариативность маршрута;
- привязку к waypoint;
- привязку к событиям;
- расчёт состава bundle;
- отдачу API для фронта ProPage.

### Не нужно реализовывать сразу

- кабинет гида;
- self-service публикацию маршрутов;
- покупку маршрутов;
- сложную редакторскую CMS;
- ревшару;
- автогенерацию маршрутов.

---

## 6. Целевая схема таблиц

Ниже приведена рекомендуемая минимальная серверная схема для curated-домена.

### 6.1. Таблица `curated_route_packs`

Главная таблица маршрутных пакетов.

Пример полей:

- `id` UUID PK
- `slug` TEXT UNIQUE NOT NULL
- `title` TEXT NOT NULL
- `subtitle` TEXT NULL
- `summary` TEXT NOT NULL
- `description` TEXT NULL
- `route_kind` TEXT NOT NULL
- `source_kind` TEXT NOT NULL
- `publication_status` TEXT NOT NULL
- `visibility` TEXT NOT NULL DEFAULT 'public'
- `is_featured` BOOLEAN NOT NULL DEFAULT false
- `federal_scope` BOOLEAN NOT NULL DEFAULT false
- `seasonality` TEXT[] NULL
- `duration_label` TEXT NULL
- `distance_label` TEXT NULL
- `difficulty_level` TEXT NULL
- `cover_image_url` TEXT NULL
- `map_preview_center_lat` NUMERIC NULL
- `map_preview_center_lng` NUMERIC NULL
- `map_preview_zoom` INTEGER NULL
- `author_mode` TEXT NOT NULL DEFAULT 'editorial'
- `author_id` UUID NULL
- `author_name` TEXT NULL
- `curator_notes` TEXT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMP NOT NULL DEFAULT NOW()
- `published_at` TIMESTAMP NULL

#### Назначение

Это верхний уровень сущности уровня:

- Золотое кольцо России;
- Карелия на 3-5 дней;
- Кострома на событие;
- маршрут от проверенного гида в будущем.

### 6.2. Таблица `curated_route_variants`

Одна поездка может иметь несколько вариантов.

Пример полей:

- `id` UUID PK
- `route_pack_id` UUID FK -> curated_route_packs.id
- `slug` TEXT NOT NULL
- `title` TEXT NOT NULL
- `summary` TEXT NULL
- `variant_kind` TEXT NOT NULL
- `is_default` BOOLEAN NOT NULL DEFAULT false
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `estimated_size_mb` NUMERIC NULL
- `estimated_duration_label` TEXT NULL
- `estimated_distance_label` TEXT NULL
- `is_active` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMP NOT NULL DEFAULT NOW()

#### Пример вариантов

- Кострома базово
- Кострома + Плёс
- Кострома + Лосиная ферма
- Кострома + алмазный завод

### 6.3. Таблица `curated_route_waypoints`

Города, остановки и ключевые узлы маршрута.

Пример полей:

- `id` UUID PK
- `route_variant_id` UUID FK -> curated_route_variants.id
- `title` TEXT NOT NULL
- `waypoint_type` TEXT NOT NULL
- `region_id` TEXT NULL
- `latitude` NUMERIC NOT NULL
- `longitude` NUMERIC NOT NULL
- `is_required` BOOLEAN NOT NULL DEFAULT true
- `is_default_enabled` BOOLEAN NOT NULL DEFAULT true
- `estimated_tile_weight_mb` NUMERIC NULL
- `poi_count` INTEGER NOT NULL DEFAULT 0
- `event_count` INTEGER NOT NULL DEFAULT 0
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `metadata` JSONB NOT NULL DEFAULT '{}'::jsonb
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()

#### Назначение

Это не пользовательские waypoint маршрута из travel-домена, а curated-точки пакета.

### 6.4. Таблица `curated_route_pois`

Точки интереса внутри варианта маршрута.

Пример полей:

- `id` UUID PK
- `route_variant_id` UUID FK -> curated_route_variants.id
- `waypoint_id` UUID NULL FK -> curated_route_waypoints.id
- `title` TEXT NOT NULL
- `poi_type` TEXT NOT NULL
- `description` TEXT NULL
- `latitude` NUMERIC NULL
- `longitude` NUMERIC NULL
- `is_featured` BOOLEAN NOT NULL DEFAULT false
- `is_optional` BOOLEAN NOT NULL DEFAULT true
- `metadata` JSONB NOT NULL DEFAULT '{}'::jsonb
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()

### 6.5. Таблица `curated_route_events`

Публичные события, связанные с маршрутом или вариантом.

Пример полей:

- `id` UUID PK
- `route_variant_id` UUID FK -> curated_route_variants.id
- `event_title` TEXT NOT NULL
- `event_slug` TEXT NULL
- `event_scope` TEXT NOT NULL
- `starts_at` TIMESTAMP NULL
- `ends_at` TIMESTAMP NULL
- `city_name` TEXT NULL
- `region_id` TEXT NULL
- `description` TEXT NULL
- `is_anchor_event` BOOLEAN NOT NULL DEFAULT false
- `metadata` JSONB NOT NULL DEFAULT '{}'::jsonb
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()

#### Пример

Если поездка завязана на известное публичное событие в Костроме, именно здесь хранится событийный якорь пакета.

### 6.6. Таблица `curated_route_bundle_units`

Единицы, из которых собирается конечный оффлайн-bundle.

Пример полей:

- `id` UUID PK
- `route_variant_id` UUID FK -> curated_route_variants.id
- `unit_kind` TEXT NOT NULL
- `source_ref` TEXT NULL
- `title` TEXT NOT NULL
- `region_id` TEXT NULL
- `latitude` NUMERIC NULL
- `longitude` NUMERIC NULL
- `coverage_geometry` JSONB NULL
- `zoom_min` INTEGER NULL
- `zoom_max` INTEGER NULL
- `estimated_size_mb` NUMERIC NULL
- `is_required` BOOLEAN NOT NULL DEFAULT false
- `is_default_enabled` BOOLEAN NOT NULL DEFAULT true
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `metadata` JSONB NOT NULL DEFAULT '{}'::jsonb
- `created_at` TIMESTAMP NOT NULL DEFAULT NOW()

#### Назначение

Эта таблица нужна, чтобы собирать оффлайн-пакет не только по `regionId`, а по составной логике:

- город;
- точка;
- коридор маршрута;
- специальная зона покрытия.

---

## 7. Справочники и перечисления

На старте перечисления можно хранить как текстовые поля с CHECK constraint или серверной валидацией.

### 7.1. `route_kind`

Возможные значения:

- `federal`
- `regional`
- `event`
- `seasonal`
- `editorial`
- `guide`

### 7.2. `source_kind`

Возможные значения:

- `editorial`
- `partner`
- `guide`

### 7.3. `publication_status`

Возможные значения:

- `draft`
- `review`
- `published`
- `archived`

### 7.4. `variant_kind`

Возможные значения:

- `base`
- `extended`
- `event`
- `weekend`
- `alternate`

### 7.5. `waypoint_type`

Возможные значения:

- `city`
- `stop`
- `poi`
- `viewpoint`
- `event_anchor`

### 7.6. `unit_kind`

Возможные значения:

- `city`
- `capital`
- `poi_zone`
- `route_corridor`
- `custom_area`

---

## 8. Что можно переиспользовать из текущей системы

Можно переиспользовать:

- существующие карты регионов и городов на фронте;
- offline storage и bundle-механику как основу;
- уже существующую работу с маршрутами и waypoint как источник архитектурных идей;
- текущие тайловые сервисы и offline pipeline.

Нельзя переиспользовать как основную сущность curated-домена:

- `travel_routes`;
- пользовательские `route_waypoints` как каталог витринных пакетов;
- обычные пользовательские маршруты для Pro-страницы.

---

## 9. Что делать с текущей неоднородностью `routes` и `travel_routes`

### Проблема

В текущем backend есть признак рассинхронизации домена пользовательских маршрутов:

- часть чтения использует `routes`;
- запись и остальной backend в основном используют `travel_routes`.

### Решение

Внутри пользовательского домена нужно провести отдельную техническую нормализацию.

Рекомендуемое решение:

- считать `travel_routes` основным источником истины;
- провести аудит всех запросов к `routes`;
- постепенно перевести их на `travel_routes`;
- при необходимости сделать временный compatibility-layer.

### Важно

Это нужно сделать для здоровья существующего route-домена.

Но это **не означает**, что curated route packs должны переехать в `travel_routes`.

---

## 10. Целевые backend API для curated route packs

### 10.1. Каталог маршрутов

`GET /api/pro-route-packs`

Возвращает список опубликованных curated-маршрутов для ProPage.

Пример ответа:

```json
[
  {
    "id": "...",
    "slug": "golden-ring-russia",
    "title": "Золотое кольцо России",
    "summary": "Исторические города и насыщенная поездка на несколько дней",
    "routeKind": "federal",
    "isFeatured": true,
    "defaultVariant": {
      "id": "...",
      "title": "Базовый маршрут",
      "estimatedSizeMb": 86
    }
  }
]
```

### 10.2. Детали маршрутного пакета

`GET /api/pro-route-packs/:slug`

Возвращает:

- пакет;
- варианты;
- waypoint;
- POI;
- события;
- базовую карту превью.

### 10.3. Сборка bundle по варианту

`POST /api/pro-route-packs/:slug/bundle-preview`

Вход:

```json
{
  "variantId": "...",
  "selectedWaypointIds": ["..."],
  "selectedBundleUnitIds": ["..."]
}
```

Выход:

```json
{
  "routePackId": "...",
  "variantId": "...",
  "estimatedSizeMb": 64,
  "includedWaypoints": [],
  "includedBundleUnits": [],
  "tileManifest": {
    "zoomRange": [6, 12],
    "tileCount": 1234
  }
}
```

### 10.4. Получение готового bundle

`POST /api/pro-route-packs/:slug/download-bundle`

Это фактическая серверная точка, которая позже может вернуть:

- данные для offlineService;
- тайловый manifest;
- markers, POI, events, route geometry;
- состав маршрута после пользовательской настройки.

### 10.5. Событийная фильтрация каталога

Опционально позже:

`GET /api/pro-route-packs?kind=event&month=08&featured=true`

Это позволит строить сезонные и событийные витрины.

---

## 11. Админский и редакционный API

На первом пользовательском этапе можно не делать полноценную UI-админку, но backend должен быть готов к ней.

### Нужные будущие endpoints

- `POST /api/admin/pro-route-packs`
- `PUT /api/admin/pro-route-packs/:id`
- `POST /api/admin/pro-route-packs/:id/variants`
- `POST /api/admin/pro-route-packs/:id/publish`
- `POST /api/admin/pro-route-packs/:id/archive`

### На первом этапе можно заменить

- SQL seed-скриптами;
- временными JSON seed-файлами;
- ручной загрузкой curated-пакетов.

---

## 12. Порядок разработки без лишнего риска

### Этап 1. Frontend MVP

Сначала делаем фронтовой слой и статические пресеты.

Причина:

- он проверяет продуктовую модель;
- он не требует немедленной миграции БД;
- он помогает зафиксировать реальные поля API.

### Этап 2. Backend spec и seeds

После фронтового MVP:

- вводим curated route packs в backend;
- на первом этапе можно даже заполнять их seed-данными;
- строим API под уже проверенную модель.

### Этап 3. Bundle integration

После этого:

- backend начинает считать bundle;
- offlineService перестаёт мыслить только через `regionId`;
- тайловая логика адаптируется под составной пакет.

### Этап 4. Guide mode

Только потом:

- авторы;
- гиды;
- доверенные партнёры;
- коммерческие пакеты.

---

## 13. Рекомендуемые миграции

### Миграция A. Нормализация пользовательского route-домена

Отдельная техническая задача:

- аудит использования `routes` и `travel_routes`;
- перевод на один источник истины;
- исправление backend-кода, где осталась неоднородность.

### Миграция B. Создание curated route packs schema

Создать:

- `curated_route_packs`
- `curated_route_variants`
- `curated_route_waypoints`
- `curated_route_pois`
- `curated_route_events`
- `curated_route_bundle_units`

### Миграция C. Индексы

Рекомендуемые индексы:

- `curated_route_packs(slug)` unique
- `curated_route_packs(publication_status, is_featured)`
- `curated_route_variants(route_pack_id, is_default)`
- `curated_route_waypoints(route_variant_id, sort_order)`
- `curated_route_events(route_variant_id, starts_at)`
- `curated_route_bundle_units(route_variant_id, sort_order)`

### Миграция D. Seed данных

Начальный seed должен включать:

- Золотое кольцо России;
- Владимир и Суздаль на выходные;
- Карелию на 3-5 дней;
- базовый событийный сценарий для Костромы.

---

## 14. Чего нельзя делать

- нельзя складывать curated route packs в `travel_routes`;
- нельзя смешивать пользовательские и витринные маршруты в одном API списка;
- нельзя давать пользовательскому маршруту шанс автоматически попасть в Pro-каталог;
- нельзя проектировать bundle API только вокруг `regionId`;
- нельзя строить схему гидов раньше, чем будет стабилен редакционный curated-домен.

---

## 15. Практический вывод

Правильная техническая стратегия такая:

1. Привести пользовательские маршруты к одному источнику истины в их собственном домене.
2. Создать отдельный curated-домен для Pro route packs.
3. Построить backend API только для curated-пакетов и их bundle.
4. После этого связать curated API с ProPage и offlineService.

Этот документ считается основной технической опорой для backend и БД по направлению Pro route packs.