# 📋 Отчёт: Структура админ-панели просмотра маркеров

## 1️⃣ Компонент для просмотра маркеров

### Основной файл
**[frontend/src/components/Admin/ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx)**

Это **универсальный компонент** для модерации всех типов контента:
- ✅ Posts (посты)
- ✅ Markers (метки)
- ✅ Events (события)
- ✅ Routes (маршруты)
- ✅ Comments (комментарии)

### Как вызывается для маркеров
```tsx
// В AdminContent.tsx, строка ~30:
{activeItem === 'moderation-markers' && (
  <ModerationHistoryPanel defaultContentType="markers" />
)}
```

---

## 2️⃣ Структура компонента ModerationHistoryPanel

### Типы и интерфейсы
```tsx
type ContentType = 'events' | 'posts' | 'routes' | 'markers' | 'comments';
type StatusFilter = 'all' | 'pending' | 'active' | 'rejected' | 'hidden' | 'revision';

interface HistoryItem {
  id: string;
  title?: string;
  description?: string;
  body?: string;
  content?: string;
  author_id?: string;
  author_name?: string;
  status: string;
  photo_urls?: string;  // ← Критично для маркеров
  ai_suggestion?: 'approve' | 'reject' | 'hide' | 'review';
  ai_confidence?: number;
  ai_reason?: string;
  ai_category?: string;
  ai_issues?: string[];
  // Для комментариев:
  source_title?: string;  // ← Название поста, к которому оставлен комментарий
  [key: string]: any;
}
```

### Основной процесс данных

```
1. Загрузка истории 📦
   ↓
   - Получить локальный контент из localStorage
   - Получить контент из БД: GET /moderation/history/markers
   - Объединить и убрать дубликаты
   - Применить фильтры (статус, поиск)
   ↓
2. Отображение списка 📝
   ↓
   - Каждая строка = логический маркер на модерации
   - Показывается: Название, Статус, Автор, Дата создания
   - Если контент с фото → видно предупреждение 🚨
   ↓
3. При клике на маркер 🖱️
   ↓
   - Загрузить детали: GET /moderation/markers/{id}/details
   - Открыть модальное окно с полной информацией
   ↓
4. Модальное окно (детали маркера) 🔍
   ├─ Информация о маркере
   │  └─ ID, Статус, Автор, Дата создания/обновления
   ├─ Фотографии (сетка с нумерацией)
   │  └─ КРИТИЧНО: сетка фотографий с красным бордером
   ├─ Текст описания
   ├─ Рекомендации ИИ
   │  └─ Предложение, Уверенность, Категория, Причина
   ├─ История модерации (если есть)
   └─ Кнопки действий
      ├─ ✓ Одобрить (требует подтверждения фото)
      ├─ На доработку
      └─ ✗ Отклонить
```

---

## 3️⃣ API, используемый компонентом

### GET /moderation/history/markers
**Получить список маркеров на модерации**

**Параметры:**
```js
{
  status?: 'pending' | 'active' | 'rejected' | 'hidden' | 'revision' | 'all',
  limit?: number (default: 50),
  offset?: number (default: 0),
  search?: string,
  sort?: 'created_at DESC' (default)
}
```

**Ответ:**
```json
{
  "data": [
    {
      "id": "marker-123",
      "title": "Памятник Пушкина",
      "description": "Памятник великому русскому поэту...",
      "creator_id": "user-456",
      "author_name": "Иван Петров",
      "status": "pending",
      "created_at": "2025-03-20T10:30:00Z",
      "photo_urls": "http://example.com/photo1.jpg,http://example.com/photo2.jpg",
      "ai_suggestion": "approve",
      "ai_confidence": 0.98,
      "ai_reason": "Качественное фото памятника, безопасный контент",
      "ai_category": "landmark",
      "source_title": null  // ← Комментарии маркеров (ОТСУТСТВУЮТ!)
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### GET /moderation/markers/{id}/details
**Получить детальную информацию о маркере**

**Ответ:**
```json
{
  "content": {
    "id": "marker-123",
    "title": "Памятник Пушкина",
    "description": "Памятник великому русскому поэту в центре города",
    "creator_id": "user-456",
    "author_name": "Иван Петров",
    "status": "pending",
    "created_at": "2025-03-20T10:30:00Z",
    "updated_at": "2025-03-20T10:30:00Z",
    "photo_urls": "http://example.com/photo1.jpg,http://example.com/photo2.jpg",
    "visibility": "public",
    "latitude": 55.7505,
    "longitude": 37.6174,
    "category": "landmark"
  },
  "aiDecision": {
    "ai_suggestion": "approve",
    "ai_confidence": 0.98,
    "ai_reason": "Качественное фото памятника, безопасный контент",
    "ai_category": "landmark",
    "ai_issues": []
  },
  "moderationHistory": []
}
```

---

## 4️⃣ Раздел комментариев в админ-панели

### ❌ ТЕКУЩЕЕ СОСТОЯНИЕ: ОТСУТСТВУЕТ

В админ-панели есть таб "Комментарии" (`moderation-comments`), **но**:
- Он показывает КОММЕНТАРИИ К ПОСТАМ
- Комментарии привязаны только к `post_id`
- **НЕ СУЩЕСТВУЕТ функциональности для комментариев маркеров**

### Где это видно в коде:

**AdminSidebar.tsx** (строка ~63):
```tsx
{
  id: 'moderation-comments',
  label: 'Комментарии',     // ← Это комментарии к ПОСТАМ
  icon: '💬',
  section: 'moderation',
  badge: notifications.moderation.comments,
  badgeColor: 'orange',
}
```

**ModerationHistoryPanel.tsx** (строка ~664):
```tsx
{contentType === 'comments' && item.source_title && (
  <div className="flex items-center gap-1">
    <span>💬 К посту:</span>
    <span className="font-medium text-blue-700">«{item.source_title}»</span>
  </div>
)}
```

Видно, что `source_title` это НАЗВАНИЕ ПОСТА, не маркера.

---

## 5️⃣ Структура БД

### Таблица map_markers
```sql
map_markers:
├─ id (PRIMARY KEY)
├─ title (VARCHAR)
├─ description (TEXT)
├─ creator_id (UUID)
├─ status (VARCHAR) -- pending, active, rejected, hidden
├─ visibility (VARCHAR) -- public, private
├─ latitude (DECIMAL)
├─ longitude (DECIMAL)
├─ category (VARCHAR)
├─ photo_urls (TEXT) -- comma-separated URLs
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ ... other fields
```

### Таблица comments
```sql
comments:
├─ id (PRIMARY KEY)
├─ post_id (UUID, FOREIGN KEY → posts) -- ← ТОЛЬКО для постов!
├─ author_id (UUID)
├─ content (TEXT)
├─ status (VARCHAR) -- pending, active, rejected
├─ created_at (TIMESTAMP)
├─ updated_at (TIMESTAMP)
└─ marker_id (UUID, FOREIGN KEY → map_markers) -- ❌ ОТСУТСТВУЕТ!
```

---

## 6️⃣ Файлы для модификации (если нужно добавить комментарии маркеров)

### Frontend
1. **[frontend/src/components/Admin/AdminSidebar.tsx](frontend/src/components/Admin/AdminSidebar.tsx)**
   - Добавить новый таб: `moderation-marker-comments`

2. **[frontend/src/components/Admin/AdminContent.tsx](frontend/src/components/Admin/AdminContent.tsx)**
   - Добавить маршрутизацию: `activeItem === 'moderation-marker-comments'`

3. **[frontend/src/components/Admin/ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx)**
   - Добавить новый тип контента: `marker_comments`
   - Обновить отображение source_title (было "К посту" → "K маркеру")

### Backend
1. **[backend/src/controllers/moderationHistoryController.js](backend/src/controllers/moderationHistoryController.js)**
   - Добавить case для `marker_comments`:
     ```js
     case 'marker_comments':
       tableName = 'comments';
       authorColumn = 'author_id';
       // Фильтровать только comments с marker_id IS NOT NULL
       break;
     ```

2. **БД Миграция**
   - Добавить поле в comments (если его нет):
     ```sql
     ALTER TABLE comments ADD COLUMN marker_id UUID REFERENCES map_markers(id);
     CREATE INDEX idx_comments_marker_id ON comments(marker_id);
     ```

---

## 7️⃣ Компонент AdminContent.tsx

**Структура:**
```tsx
AdminContent.tsx
├─ Модерация
│  ├─ moderation-overview → ModerationHistoryPanel()
│  ├─ moderation-posts → ModerationHistoryPanel(defaultContentType="posts")
│  ├─ moderation-events → ModerationHistoryPanel(defaultContentType="events")
│  ├─ moderation-markers → ModerationHistoryPanel(defaultContentType="markers") ← ЗДЕСЬ
│  ├─ moderation-routes → ModerationHistoryPanel(defaultContentType="routes")
│  └─ moderation-comments → ModerationHistoryPanel(defaultContentType="comments")
├─ Аналитика
│  ├─ analytics-overview → AnalyticsDashboard(...)
│  ├─ analytics-executive → AnalyticsDashboard(...)
│  ├─ analytics-product → AnalyticsDashboard(...)
│  └─ analytics-technical → AnalyticsDashboard(...)
├─ Партнёры
│  ├─ partners-overview → PartnersListPanel()
│  ├─ partners-list → PartnersListPanel()
│  ├─ partners-applications → PartnersApplicationsPanel()
│  ├─ partners-events → AffiliateEventsPanel()
│  ├─ partners-payouts → PayoutsPanel()
│  └─ partners-refunds → RefundsPanel()
├─ Пакеты
│  ├─ packs-overview → CuratedRoutePacksPanel()
│  └─ packs-curated → CuratedRoutePacksPanel()
└─ Обратная связь
   ├─ feedback-all → FeedbackPanel()
   ├─ feedback-complaints → FeedbackPanel(filterType="complaint")
   └─ feedback-suggestions → FeedbackPanel(filterType="suggestion")
```

---

## 📌 РЕЗЮМЕ

| Вопрос | Ответ |
|--------|-------|
| **1. Компонент админ-панели** | [ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx) - универсальный 📦 |
| **2. Раздел для комментариев маркеров** | ❌ **ОТСУТСТВУЕТ** |
| **3. Как работают комментарии** | Привязаны только к `post_id`, используют `source_title` |
| **4. Какой API вызывается** | `GET /moderation/history/markers` + `GET /moderation/markers/{id}/details` |
| **5. Что нужно модифицировать** | БД (добавить `marker_id` в comments), Backend (add case), Frontend (add tab + component) |

---

## 🎯 Дальнейшие действия

Если нужно добавить поддержку **комментариев маркеров**:

1. ✅ Выполнить БД миграцию (добавить `marker_id` в comments)
2. ✅ Обновить moderationHistoryController.js (добавить case)
3. ✅ Добавить таб в AdminSidebar.tsx
4. ✅ Обновить ModerationHistoryPanel.tsx (добавить type `marker_comments`)
5. ✅ Обновить AdminContent.tsx (добавить маршрут)

Все изменения локальны и не требуют больших переделок! 🚀
