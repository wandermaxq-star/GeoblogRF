# ФИНАЛЬНЫЙ РАЗДЕЛ ПРОЕКТА: Route Pack Builder → Hub → Marketplace
> Полный поэтапный план реализации с отметками выполнения.
> Статусы: `[ ]` не начато · `[~]` в работе · `[x]` выполнено

---

## КОНТЕКСТ И ЦЕЛЬ

Пользователь строит маршрут в Planner → нажимает «Упаковать» → открывается **RoutePackageBuilder** (красивый glassmorphic UI) → заполняет мета-данные, устанавливает цену → отправляет на модерацию → Админ одобряет → пак появляется в **Route Hub** (`/hub`) и каталоге `/pro` → другие пользователи покупают/скачивают → Автор получает долю выручки.

---

## ЧТО УЖЕ ГОТОВО (не трогать)

| Компонент | Путь | Статус |
|---|---|---|
| ProPage (каталог, покупка, скачивание) | `frontend/src/pages/ProPage.tsx` | ✅ готово, подключён в App.tsx `/pro` |
| Типы пака | `frontend/src/types/proRoutePacks.ts` | ✅ CuratedRoutePack, Variant, Waypoint |
| Admin CRUD паков | `frontend/src/components/Admin/CuratedRoutePacksPanel.tsx` | ✅ |
| Offline скачивание | `frontend/src/components/Offline/DownloadRoutePackModal.tsx` | ✅ |
| DB таблица `curated_route_packs` | backend | ✅ id TEXT PK, data JSONB |
| DB таблица `user_purchased_route_packs` | backend | ✅ |
| DB таблица `route_ratings` | backend | ✅ vote SMALLINT (-1/1) |
| API `/api/curated-route-packs` | `backend/src/routes/curatedRoutePacks.js` | ✅ GET/POST/PATCH/DELETE |
| API `/api/curated-route-packs/:id/purchase` | backend | ✅ |
| Planner с альтернативными маршрутами | `frontend/src/pages/Planner.tsx` | ✅ shortest/highway/city |
| Routing service (ORS + Yandex) | `frontend/src/services/routingService.ts` | ✅ |

---

## ЧТО НУЖНО ПОСТРОИТЬ

---

## ЭТАП 1 — БАЗА ДАННЫХ: Новые таблицы и расширение схемы
> Приоритет: 🔴 ПЕРВОЕ. Без этого ничто не работает.

### 1.1 Таблица `route_pack_submissions`
> Хранит паки, отправленные пользователями на модерацию, до одобрения.

```sql
CREATE TABLE IF NOT EXISTS route_pack_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Мета-данные пака (заполняет автор)
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  route_kind TEXT NOT NULL DEFAULT 'regional',  -- federal | regional | event
  tags TEXT[] DEFAULT '{}',
  highlight TEXT DEFAULT '',
  hero_metric TEXT DEFAULT '',
  
  -- Маршрут (из Planner)
  polyline JSONB NOT NULL,         -- [[lat,lng], ...] — координаты из routingService
  waypoints JSONB NOT NULL,        -- [{title, coordinates, note, isRequired, ...}]
  distance_meters INTEGER,
  duration_seconds INTEGER,
  
  -- Варианты (минимум 1)
  variants JSONB NOT NULL DEFAULT '[]',
  
  -- Монетизация
  price INTEGER NOT NULL DEFAULT 0,   -- в рублях, 0 = бесплатно
  is_exclusive BOOLEAN DEFAULT FALSE,
  
  -- Статус модерации
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | revision
  
  moderation_comment TEXT,           -- комментарий модератора при отклонении
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMP,            -- когда стал публичным
  
  -- Статистика (заполняется после публикации)
  download_count INTEGER DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Тайлы
  tile_pack_ready BOOLEAN DEFAULT FALSE,
  tile_pack_size_mb NUMERIC(8,2),
  
  CONSTRAINT valid_status CHECK (status IN ('pending','approved','rejected','revision')),
  CONSTRAINT valid_route_kind CHECK (route_kind IN ('federal','regional','event')),
  CONSTRAINT valid_price CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rps_author ON route_pack_submissions(author_id);
CREATE INDEX IF NOT EXISTS idx_rps_status ON route_pack_submissions(status);
CREATE INDEX IF NOT EXISTS idx_rps_submitted ON route_pack_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rps_published ON route_pack_submissions(published_at DESC) WHERE status = 'approved';
```

**Задачи:**
- [x] 1.1.1 — Создать файл `backend/src/migrations/2026-04-route-pack-submissions.sql` с SQL выше
- [x] 1.1.2 — Запустить миграцию: `node backend/apply-migration.js` (или через pool.query при старте)
- [x] 1.1.3 — Проверить таблицу: `SELECT * FROM route_pack_submissions LIMIT 1`

---

### 1.2 Таблица `route_pack_ratings`
> Рейтинг опубликованных паков (отдельно от маршрутов).

```sql
CREATE TABLE IF NOT EXISTS route_pack_ratings (
  id SERIAL PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES route_pack_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  review TEXT,                    -- опциональный текстовый отзыв
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT route_pack_ratings_unique UNIQUE(pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rpr_pack ON route_pack_ratings(pack_id);
```

**Задачи:**
- [x] 1.2.1 — Добавить SQL в ту же миграцию

---

### 1.3 Таблица `author_earnings`
> Выплаты автора за проданные паки.

```sql
CREATE TABLE IF NOT EXISTS author_earnings (
  id SERIAL PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES route_pack_submissions(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gross_amount INTEGER NOT NULL,       -- полная цена покупки (руб.)
  author_share INTEGER NOT NULL,       -- доля автора (70% по умолчанию)
  platform_fee INTEGER NOT NULL,       -- комиссия платформы (30%)
  earned_at TIMESTAMP DEFAULT NOW(),
  paid_out BOOLEAN DEFAULT FALSE,      -- выплачено ли автору
  paid_out_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ae_author ON author_earnings(author_id);
CREATE INDEX IF NOT EXISTS idx_ae_pack ON author_earnings(pack_id);
```

**Задачи:**
- [x] 1.3.1 — Добавить в миграцию

---

### 1.4 Расширить таблицу `users`
> Добавить колонки для авторов паков.

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pack_author BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS author_bio TEXT,
  ADD COLUMN IF NOT EXISTS author_packs_published INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_total_earnings INTEGER DEFAULT 0;
```

**Задачи:**
- [x] 1.4.1 — Добавить в миграцию

---

### 1.5 Создать скрипт применения миграции
**Задачи:**
- [x] 1.5.1 — Создать `backend/src/migrations/run-route-pack-submissions.js` — подключается к pool, читает SQL файл, выполняет
- [x] 1.5.2 — Запустить и убедиться, что все таблицы созданы без ошибок

---

## ЭТАП 2 — BACKEND API: Новые эндпоинты
> Файл: `backend/src/routes/routePackSubmissions.js` (новый)

### 2.1 Эндпоинты для авторов

```
POST   /api/route-pack-submissions          — отправить пак на модерацию (auth required)
GET    /api/route-pack-submissions/my       — мои паки (статусы, статистика) (auth)
PATCH  /api/route-pack-submissions/:id      — редактировать пак (только pending/revision) (auth)
DELETE /api/route-pack-submissions/:id      — удалить неопубликованный пак (auth)
```

**Задачи:**
- [x] 2.1.1 — Создать файл `backend/src/routes/routePackSubmissions.js`
- [x] 2.1.2 — Реализовать `POST /api/route-pack-submissions`:
  - Валидация: title (min 5 chars), polyline (min 2 точки), price >= 0
  - INSERT в `route_pack_submissions` с author_id из токена
  - Вернуть `{ id, status: 'pending' }`
- [x] 2.1.3 — Реализовать `GET /api/route-pack-submissions/my`:
  - SELECT * WHERE author_id = user.id ORDER BY submitted_at DESC
- [x] 2.1.4 — Реализовать `PATCH /api/route-pack-submissions/:id`:
  - Проверить owner + status IN ('pending','revision')
  - UPDATE частичное
- [x] 2.1.5 — Реализовать `DELETE /api/route-pack-submissions/:id`:
  - Только если status != 'approved'

---

### 2.2 Эндпоинты для Hub (публичные)

```
GET    /api/hub/packs                        — список одобренных паков (с фильтрами)
GET    /api/hub/packs/:id                    — детали пака
POST   /api/hub/packs/:id/rate              — поставить лайк/дизлайк (auth)
POST   /api/hub/packs/:id/purchase          — купить пак (auth)
GET    /api/hub/packs/:id/download-url      — получить ссылку на тайлы (auth + purchased)
```

**Задачи:**
- [x] 2.2.1 — `GET /api/hub/packs`: SELECT + фильтр status='approved', sort по rating/date/popular, пагинация (limit/offset)
- [x] 2.2.2 — `GET /api/hub/packs/:id`: детальная карточка + рейтинг
- [x] 2.2.3 — `POST /api/hub/packs/:id/rate`: INSERT/UPDATE в route_pack_ratings + пересчёт rating_avg в route_pack_submissions
- [x] 2.2.4 — `POST /api/hub/packs/:id/purchase`: INSERT user_purchased_route_packs + запись в author_earnings (70/30), обновить purchase_count
- [x] 2.2.5 — `GET /api/hub/packs/:id/download-url`: проверить покупку → вернуть подписанную ссылку или presigned URL

---

### 2.3 Эндпоинты для Admin модерации

```
GET    /api/admin/route-pack-submissions     — очередь на модерацию (admin role)
PATCH  /api/admin/route-pack-submissions/:id/approve  — одобрить
PATCH  /api/admin/route-pack-submissions/:id/reject   — отклонить с комментарием
PATCH  /api/admin/route-pack-submissions/:id/revision — вернуть на правки
```

**Задачи:**
- [x] 2.3.1 — `GET /api/admin/route-pack-submissions`: SELECT WHERE status='pending' ORDER BY submitted_at ASC с JOIN users для author info
- [x] 2.3.2 — `PATCH approve`: UPDATE status='approved', published_at=NOW(), reviewed_by, reviewed_at; запустить генерацию тайлов асинхронно
- [x] 2.3.3 — `PATCH reject`: UPDATE status='rejected', moderation_comment; уведомить автора (notification)
- [x] 2.3.4 — `PATCH revision`: UPDATE status='revision', moderation_comment

---

### 2.4 Подключить роутер в server.js

**Задачи:**
- [x] 2.4.1 — В `backend/server.js` добавить:
  ```js
  import routePackSubmissionsRoutes from './src/routes/routePackSubmissions.js';
  // ...
  app.use('/api', routePackSubmissionsRoutes);
  ```
- [x] 2.4.2 — Аналогично добавить hub routes

---

### 2.5 Тайловый pipeline (асинхронный)

**Задачи:**
- [ ] 2.5.1 — Создать `backend/src/services/tilePackService.js` — принимает pack_id, загружает polyline из БД, вызывает `generate-route-pack-tiles.cjs` → сохраняет результат, обновляет `tile_pack_ready=true` и `tile_pack_size_mb`
- [ ] 2.5.2 — Вызывать из эндпоинта approve асинхронно (без блокировки ответа)
- [ ] 2.5.3 — WebSocket или polling для отслеживания статуса генерации (опционально на первом этапе — просто polling `/api/hub/packs/:id`)

---

## ЭТАП 3 — FRONTEND: Типы и сервисы

### 3.1 Расширить типы

**Задачи:**
- [x] 3.1.1 — Создать `frontend/src/types/routePackSubmission.ts`:
  ```ts
  export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'revision';
  export interface RoutePackSubmission {
    id: string;
    authorId: string;
    title: string;
    subtitle: string;
    summary: string;
    routeKind: 'federal' | 'regional' | 'event';
    tags: string[];
    highlight: string;
    heroMetric: string;
    polyline: [number, number][];
    waypoints: RoutePackWaypoint[];
    distanceMeters: number;
    durationSeconds: number;
    variants: SubmissionVariant[];
    price: number;
    isExclusive: boolean;
    status: SubmissionStatus;
    moderationComment?: string;
    submittedAt: string;
    publishedAt?: string;
    downloadCount: number;
    purchaseCount: number;
    ratingAvg: number;
    ratingCount: number;
    tilePackReady: boolean;
    tilePackSizeMb?: number;
  }
  export interface RoutePackWaypoint {
    id: string;
    title: string;
    coordinates: [number, number];
    note?: string;
    isRequired: boolean;
  }
  export interface SubmissionVariant {
    id: string;
    title: string;
    summary: string;
    durationLabel: string;
    distanceLabel: string;
    estimatedBaseSizeMb: number;
  }
  ```

---

### 3.2 Создать сервис `routePackService.ts`

**Задачи:**
- [x] 3.2.1 — Создать `frontend/src/services/routePackService.ts`:
  - `submitPack(data)` → POST `/api/route-pack-submissions`
  - `getMyPacks()` → GET `/api/route-pack-submissions/my`
  - `updatePack(id, data)` → PATCH `/api/route-pack-submissions/:id`
  - `deletePack(id)` → DELETE
  - `getHubPacks(filters)` → GET `/api/hub/packs`
  - `getHubPack(id)` → GET `/api/hub/packs/:id`
  - `ratePack(id, vote)` → POST `/api/hub/packs/:id/rate`
  - `purchaseHubPack(id)` → POST `/api/hub/packs/:id/purchase`

---

## ЭТАП 4 — FRONTEND: RoutePackageBuilder компонент
> Главный компонент. Glassmorphic UI, аналог пак.png

**Файл:** `frontend/src/components/Planner/RoutePackageBuilder.tsx`

### 4.1 Структура компонента
```
RoutePackageBuilder
  ├── Шаг 1 — Базовая информация (название, описание, теги, тип маршрута)
  ├── Шаг 2 — Маршрут и точки (preview SVG анимация + список waypoints из Planner)
  ├── Шаг 3 — Монетизация (цена, скидки, exclusive флаг)
  ├── Шаг 4 — Чеклист качества (автоматические проверки)
  └── Кнопка «Опубликовать» (отправка на модерацию)
```

**Задачи:**
- [x] 4.1.1 — Создать `frontend/src/components/Planner/RoutePackageBuilder.tsx`
- [x] 4.1.2 — **Шаг 1: Базовая информация**
  - Input: `title` (мин 5 символов) с счётчиком
  - Textarea: `subtitle` (до 120 символов)
  - Textarea: `summary` (до 400 символов)
  - Select: `routeKind` (Федеральный / Региональный / Событийный)
  - TagInput: `tags` (до 8 тегов, Enter для добавления)
  - Input: `highlight` — главная фраза пака (50 символов)
  - Input: `heroMetric` — главная метрика («1200 км · 14 дней»)
- [x] 4.1.3 — **Шаг 2: Маршрут и waypoints**
  - SVG нeon route preview: анимированная линия маршрута из `polyline` (cyan→purple, stroke-dashoffset animation)
  - Показать дистанцию и время из routeStats
  - Список точек из `facadeMarkers` плиткой — каждую можно включить/исключить, добавить заметку, отметить как обязательную
  - Add waypoint: ввод вручную названия дополнительной точки
- [x] 4.1.4 — **Шаг 3: Монетизация**
  - Toggle: «Бесплатный» / «Платный» (radio)
  - Если платный — NumberInput `price` (100–10000 ₽), шаг 50
  - Toggle: `isExclusive` — «Эксклюзивный пак гида»
  - Блок-подсказка: «Вы получите 70% от каждой продажи. Платформа берёт 30%.»
  - Расчёт: «При цене 500₽ за 10 продаж ваш заработок составит 3 500₽»
- [x] 4.1.5 — **Шаг 4: Чеклист качества** (автопроверка)
  - ✅ Маршрут имеет минимум 2 точки
  - ✅ Дистанция > 5 км
  - ✅ Название заполнено (мин 5 символов)
  - ✅ Описание заполнено (мин 30 символов)
  - ✅ Хотя бы 1 тег добавлен
  - ⚠️ Рекомендуется: изображение превью (опционально на MVP)
  - ⚠️ Рекомендуется: вариант поездки добавлен
  - Зелёные/красные иконки рядом с каждым пунктом, анимация cascade
- [x] 4.1.6 — **Кнопка «Опубликовать»**
  - Активна только если все обязательные чеки пройдены
  - По клику — вызов `routePackService.submitPack()`
  - Loading state + success/error state
  - После успеха — показать «Пак отправлен на модерацию!» + ссылку «Мои паки»
- [x] 4.1.7 — **Визуальный стиль**
  - Glassmorphism: `background: rgba(15,23,42,0.85)`, `backdrop-filter: blur(20px)`
  - Border: `1px solid rgba(139,92,246,0.3)`
  - Accent: cyan (`#22d3ee`) + purple (`#a78bfa`) gradient
  - Header: иконка `Package` из lucide-react + «Упаковать маршрут»
  - Steps indicator: нумерованные кружки 1-2-3-4 с прогрессом
  - Width: 600px (desktop), fullscreen (mobile)
  - Position: modal overlay над Planner

---

### 4.2 Интеграция с Planner

**Задачи:**
- [x] 4.2.1 — В `Planner.tsx` вместо state используется `packBuilderStore` (Zustand, глобальный overlay в MainLayout)
- [x] 4.2.2 — Добавить кнопку «Упаковать» (иконка `Package`, lucide) в панель маршрута — видна только когда маршрут построен (routeAlternatives не пустой)
- [x] 4.2.3 — По клику → `openPackBuilder({ polyline, distanceMeters, durationSeconds, initialWaypoints })`
- [x] 4.2.4 — RoutePackageBuilder открывается через MainLayout (position: fixed, глобальный z-index)
- [x] 4.2.5 — Кнопка «×» закрывает builder без потери состояния (черновик в localStorage)

---

## ЭТАП 5 — FRONTEND: Route Hub страница
> Файл: `frontend/src/pages/HubPage.tsx`

### 5.1 Структура страницы

**Задачи:**
- [x] 5.1.1 — Создать `frontend/src/pages/HubPage.tsx`
- [x] 5.1.2 — Использовать ту же обёртку: `CentreBackground` + `MirrorGradientContainer`
- [x] 5.1.3 — **Заголовок**: «Маршрутный Хаб» + subtitle «Паки от сообщества путешественников»
- [x] 5.1.4 — **Фильтры** (горизонтальный scrollable bar)
- [x] 5.1.5 — **Сетка паков** (grid, 3 колонки desktop / 1 mobile)
- [x] 5.1.6 — **HubPackCard** — glassmorphic карточка
- [x] 5.1.7 — **Детальный modal** `HubPackDetailModal.tsx`
- [x] 5.1.8 — **Пагинация**: кнопка «Загрузить ещё»
- [x] 5.1.9 — **Пустое состояние**
- [x] 5.1.10 — Зарегистрировать маршрут в App.tsx + добавить `/hub` в soloPages (MainLayout)

---

## ЭТАП 6 — FRONTEND: Admin модерация паков

**Файл:** `frontend/src/components/Admin/PackSubmissionsPanel.tsx`

**Задачи:**
- [x] 6.1 — Создать `PackSubmissionsPanel.tsx`
- [x] 6.2 — Добавить панель в `AdminDashboard.tsx` / `AdminSidebar.tsx`
- [x] 6.3 — Бейдж в Sidebar обновляется через polling

---

## ЭТАП 7 — FRONTEND: Профиль автора («Мои паки»)

**Задачи:**
- [x] 7.1 — Добавить секцию «Мои паки» — вкладка `mypacks` в ProfilePanel + `MyPacksSection.tsx`
- [ ] 7.2 — Блок «Заработок автора» (если есть author_earnings):
  - Общий заработок: `SUM(author_share)` где `earned_at` за последние 30 дней
  - Кнопка «Вывести» (MVP: просто форма с email для ручной выплаты)
- [x] 7.3 — Кнопка «Стать автором паков»

---

## ЭТАП 8 — FRONTEND: Интеграция в навигацию

**Задачи:**
- [x] 8.1 — Добавить «Хаб» в Sidebar (`Globe` icon, `/hub`)
- [x] 8.2 — Добавить в мобильный BottomNav
- [ ] 8.3 — На ProPage добавить ссылку «Смотреть все паки сообщества» → `/hub`
- [x] 8.4 — На Planner после построения маршрута — кнопка «Упаковать»

---

## ЭТАП 9 — УВЕДОМЛЕНИЯ И EMAIL

**Задачи:**
- [ ] 9.1 — При одобрении пака: создать notification для автора (используя существующую `NotificationProvider`):
  - «Ваш пак „{title}" одобрен и опубликован в Hub!»
- [ ] 9.2 — При отклонении:
  - «Пак „{title}" отклонён. Причина: {moderationComment}»
  - Кнопка «Доработать» → открывает RoutePackageBuilder в режиме редактирования
- [ ] 9.3 — При покупке пака другим пользователем:
  - Автору: «Пользователь купил ваш пак „{title}"! +350₽ на счёт»
- [ ] 9.4 — Email (опционально, через существующий email сервис backend):
  - Дублировать критичные нотификации на email

---

## ЭТАП 10 — ФИНАЛЬНЫЕ ШТРИХИ

**Задачи:**
- [ ] 10.1 — SEO/meta для `/hub` и `/hub/:id` (og:title, og:image с SVG маршрута)
- [ ] 10.2 — Кнопка «Поделиться паком»: копирует ссылку `/hub/:id` в clipboard + показывает toast
- [ ] 10.3 — Share в соц. сетях (Telegram, VK) — опционально
- [ ] 10.4 — Страница 404 для несуществующего пака
- [ ] 10.5 — Rate limiting на POST /api/route-pack-submissions (max 5 submissions/day per user)
- [ ] 10.6 — Валидация объёма polyline (max 10 000 точек, чтобы не перегружать БД)
- [ ] 10.7 — Тестирование всего flow: Planner → Builder → Submit → Admin Approve → Hub → Purchase → Download
- [ ] 10.8 — Производительность: индексы на hub/packs запросах, пагинация работает корректно

---

## СВОДНАЯ ТАБЛИЦА ПРОГРЕССА

| Этап | Описание | Статус |
|---|---|---|
| **1. БД** | Миграции: route_pack_submissions, ratings, earnings, users | `[x]` ✅ |
| **2. Backend API** | Submissions CRUD + Hub API + Admin API (tile pipeline — отдельно) | `[x]` ✅ |
| **3. Типы + Сервис** | routePackSubmission.ts + routePackService.ts | `[x]` ✅ |
| **4. Builder UI** | RoutePackageBuilder.tsx + packBuilderStore (Zustand) в MainLayout | `[x]` ✅ |
| **5. Hub страница** | HubPage.tsx solo-page + /hub в soloPages + App.tsx | `[x]` ✅ |
| **6. Admin панель** | PackSubmissionsPanel.tsx + интеграция в AdminDashboard | `[x]` ✅ |
| **7. Профиль автора** | MyPacksSection + mypacks вкладка в ProfilePanel | `[x]` ✅ |
| **8. Навигация** | Sidebar + BottomNav + кнопка Упаковать в Planner | `[x]` ✅ |
| **9. Уведомления** | In-app + опционально email | `[ ]` |
| **10. Финал** | SEO, share, rate limit, тесты | `[ ]` |

---

## ПОРЯДОК РЕАЛИЗАЦИИ (рекомендуемый)

```
Этап 1 (БД)
  → Этап 2 (Backend API)
    → Этап 3 (Типы/Сервис)
      → Этап 4 (RoutePackageBuilder) ← главный UI
        → Этап 5 (Hub страница)
          → Этап 6 (Admin панель)
            → Этап 7 (Профиль автора)
              → Этап 8 (Навигация)
                → Этап 9 (Уведомления)
                  → Этап 10 (Финал)
```

**Критический путь:** Этапы 1-4 образуют ядро. Без них всё остальное не имеет смысла. Этапы 5-10 можно реализовывать параллельно после завершения этапов 1-4.

---

## ТЕХНИЧЕСКИЕ РЕШЕНИЯ

| Решение | Обоснование |
|---|---|
| UUID для `route_pack_submissions.id` | Совместимость с существующей архитектурой (users.id = UUID) |
| JSONB для `polyline` и `waypoints` | Гибкость структуры, нет смысла нормализовывать географические данные |
| 70/30 revenue split | Стандарт рынка (как Apple AppStore), легко изменить |
| Статусная машина pending→approved/rejected/revision | Простота, ревизия позволяет итерировать без нового submission |
| Тайлы генерируются асинхронно после approve | Не блокируют модератора, можно повторить при сбое |
| SVG из polyline в карточках Hub | Не требует загрузки картовых тайлов, быстро, offline-ready |
| localStorage черновик в Builder | UX: пользователь не теряет работу при случайном закрытии |

---

*Файл создан: апрель 2026. Обновляйте статусы `[ ]` → `[x]` по мере выполнения.*
