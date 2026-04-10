# 🎯 ОТВЕТЫ НА ВОПРОСЫ О АДМИН-ПАНЕЛИ МАРКЕРОВ

## 1️⃣ Какой файл содержит компонент админ-панели для просмотра маркеров?

### ✅ Основной компонент
**[frontend/src/components/Admin/ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx)** (940 строк)

Это универсальный компонент для модерации всех типов контента (posts, markers, events, routes, comments).

### Файлы, которые его используют:
- **[frontend/src/components/Admin/AdminContent.tsx](frontend/src/components/Admin/AdminContent.tsx)** - маршрутизирует на компонент:
  ```tsx
  {activeItem === 'moderation-markers' && (
    <ModerationHistoryPanel defaultContentType="markers" />
  )}
  ```

- **[frontend/src/pages/AdminDashboard.tsx](frontend/src/pages/AdminDashboard.tsx)** - главная страница админ-панели

- **[frontend/src/components/Admin/AdminSidebar.tsx](frontend/src/components/Admin/AdminSidebar.tsx)** - боковое меню с табом "Метки 📍"

---

## 2️⃣ Есть ли там уже раздел/таб для комментариев маркеров?

### ❌ НЕТ

**Текущее состояние:**
- ✅ В боковом меню есть таб "Комментарии 💬"
- ❌ **НО** это комментарии к ПОСТАМ, не к маркерам
- ❌ Система не поддерживает комментарии маркеров вообще

**Что видно в админ-панели:**

В `AdminSidebar.tsx` есть пять табов модерации:
```tsx
subItems: [
  { label: 'Посты', id: 'moderation-posts', ... },
  { label: 'События', id: 'moderation-events', ... },
  { label: 'Метки', id: 'moderation-markers', ... },      ← Маркеры
  { label: 'Маршруты', id: 'moderation-routes', ... },
  { label: 'Комментарии', id: 'moderation-comments', ... } ← ТОЛЬКО для постов!
]
```

**Доказательство (из ModerationHistoryPanel.tsx, строка 664):**
```tsx
{contentType === 'comments' && item.source_title && (
  <div className="flex items-center gap-1">
    <span>💬 К посту:</span>
    <span className="font-medium text-blue-700">«{item.source_title}»</span>
  </div>
)}
```

Видно `source_title` - это название ПОСТА!

---

## 3️⃣ Если есть - как он устроен? Какой API вызывает?

### API, используемый для маркеров:

#### GET /moderation/history/markers
**Получить список маркеров на модерации**

Вызывается в функции `loadHistory()` (строка ~120):
```jsx
const response = await apiClient.get(`/moderation/history/markers`, {
  params: {
    limit: 100,
    offset: 0,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery.trim() || undefined,
    sort: 'created_at DESC'
  },
  headers: { Authorization: `Bearer ${token}` }
});
```

**Backend код:** [backend/src/controllers/moderationHistoryController.js](backend/src/controllers/moderationHistoryController.js), функция `getModerationHistory`

```js
case 'markers':
  tableName = 'map_markers';
  authorColumn = 'creator_id';
  titleColumn = 'title';
  contentColumn = 'description';
  break;
```

**Ответ содержит:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Памятник Пушкина",
      "description": "Описание...",
      "creator_id": "user-uuid",
      "author_name": "Иван Петров",
      "status": "pending",
      "created_at": "2025-03-20T10:30:00Z",
      "photo_urls": "url1,url2",
      "ai_suggestion": "approve",
      "ai_confidence": 0.98,
      "ai_reason": "Качественное фото...",
      "ai_category": "landmark",
      "ai_issues": []
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

#### GET /moderation/markers/{id}/details
**Получить детальную информацию о маркере**

Вызывается при клике на маркер (строка ~384):
```jsx
const response = await apiClient.get(
  `/moderation/${contentType}/${item.id}/details`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

**Backend код:** функция `getContentDetails` в том же файле

```js
case 'markers':
  tableName = 'map_markers';
  authorColumn = 'creator_id';
  break;
```

**Ответ:**
```json
{
  "content": {
    "id": "uuid",
    "title": "Памятник Пушкина",
    "description": "Полное описание...",
    "creator_id": "user-uuid",
    "author_name": "Иван Петров",
    "status": "pending",
    "created_at": "2025-03-20T10:30:00Z",
    "updated_at": "2025-03-20T10:30:00Z",
    "photo_urls": "url1,url2",
    "latitude": 55.7505,
    "longitude": 37.6174,
    "category": "landmark",
    "visibility": "public"
  },
  "aiDecision": {
    "ai_suggestion": "approve",
    "ai_confidence": 0.98,
    "ai_reason": "Детальная рекомендация...",
    "ai_category": "landmark",
    "ai_issues": []
  },
  "moderationHistory": []
}
```

#### POST /moderation/markers/{id}/approve (и другие действия)
Вызывается при нажатии кнопки одобрения (строка ~248):
```jsx
await apiClient.post(`/moderation/markers/${itemId}/approve`, {
  /* данные */
});
```

Также поддерживаются:
- `POST /moderation/markers/{id}/reject`
- `POST /moderation/markers/{id}/revision` (отправить на доработку)
- `POST /moderation/markers/{id}/hide`

---

## 4️⃣ Если нет - подскажи какой файл нужно модифицировать

### Это уже ответ на вопрос #2

Раздела для комментариев маркеров **НЕ СУЩЕСТВУЕТ**, поэтому нужно его создать.

### Файлы для модификации:

#### 1. **Backend**: [backend/src/controllers/moderationHistoryController.js](backend/src/controllers/moderationHistoryController.js)

Добавить новый case в переключатели `getModerationHistory` и `getContentDetails`:

```js
case 'marker_comments':
  // Специальный случай: комментарии маркеров
  tableName = 'comments';
  authorColumn = 'author_id';
  titleColumn = 'content';
  contentColumn = 'content';
  // Добавить условие: WHERE c.marker_id IS NOT NULL
  break;
```

#### 2. **Frontend - Навигация**: [frontend/src/components/Admin/AdminSidebar.tsx](frontend/src/components/Admin/AdminSidebar.tsx)

Добавить новый таб в `moderation` раздел:

```tsx
{
  id: 'moderation-marker-comments',
  label: 'Комментарии маркеров',
  icon: '💬📍',
  section: 'moderation',
  badge: notifications.moderation.marker_comments || 0,
  badgeColor: 'orange',
}
```

#### 3. **Frontend - Маршрутизация**: [frontend/src/components/Admin/AdminContent.tsx](frontend/src/components/Admin/AdminContent.tsx)

Добавить новый условный рендер:

```tsx
{activeItem === 'moderation-marker-comments' && (
  <ModerationHistoryPanel defaultContentType="marker_comments" />
)}
```

#### 4. **Frontend - Компонент**: [frontend/src/components/Admin/ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx)

Обновить типы:

```tsx
type ContentType = 'events' | 'posts' | 'routes' | 'markers' | 'comments' | 'marker_comments';
```

И обновить строку отображения источника (строка 664), чтобы различать комментарии постов и маркеров:

```tsx
{contentType === 'comments' && item.source_title && (
  <div className="flex items-center gap-1">
    <span>💬 К посту:</span>
    <span className="font-medium text-blue-700">«{item.source_title}»</span>
  </div>
)}

{contentType === 'marker_comments' && item.source_title && (
  <div className="flex items-center gap-1">
    <span>💬 К маркеру:</span>
    <span className="font-medium text-blue-700">«{item.source_title}»</span>
  </div>
)}
```

#### 5. **БД**: Проверить наличие поля

```sql
-- Проверить есть ли поле marker_id в comments
ALTER TABLE comments ADD COLUMN marker_id UUID REFERENCES map_markers(id);
CREATE INDEX idx_comments_marker_id ON comments(marker_id);
```

#### 6. **Types**: [frontend/src/types/AdminTypes.ts](frontend/src/types/AdminTypes.ts)

Обновить интерфейс `AdminNotifications`:

```tsx
moderation: {
  posts: number;
  events: number;
  markers: number;
  routes: number;
  comments: number;
  marker_comments: number;  // ← Добавить
};
```

---

## 📊 Структура ModerationHistoryPanel

### Основные части компонента:

1. **State переменные** (строка ~50):
   - `contentType` - тип контента (markers в нашем случае)
   - `statusFilter` - фильтр по статусу
   - `history` - массив маркеров на модерации
   - `selectedItem` - выбранный маркер
   - `details` - детали маркера
   - `page` - текущая страница

2. **Функция loadHistory()** (строка ~115):
   - Получает локальный контент из localStorage
   - Вызывает API для получения контента из БД
   - Объединяет, фильтрует и сортирует
   - Применяет пагинацию

3. **Функция handleSelectItem()** (строка ~380):
   - При клике на маркер получает его детали
   - Вызывает: `GET /moderation/markers/{id}/details`

4. **Функция handleModerate()** (строка ~248):
   - Одобрить, отклонить или отправить на доработку
   - POST запрос на backend

5. **Отображение** (строка ~600):
   - Левая часть: список маркеров (20 на странице)
   - Модальное окно: детали маркера
   - Фотографии, описание, рекомендации ИИ
   - Кнопки действий

---

## 🎯 Где должна быть секция комментариев

Если пользователь нажмет на маркер в админ-панели, модальное окно должно содержать вкладку "Комментарии":

```
Модальное окно маркера:
├─ 📍 Информация о маркере
├─ 🚨 Фотографии
├─ 📝 Описание
├─ 🤖 Рекомендации ИИ
├─ 💬 КОММЕНТАРИИ К МАРКЕРУ ← ДОБАВИТЬ ЗДЕСЬ
│  ├─ Список комментариев
│  └─ Для каждого: Текст, Автор, Дата, Статус
├─ 📋 История модерации
└─ 🎯 Кнопки действий
```

Но это требует дополнительной разработки - нужно:
1. Получить комментарии маркера из API
2. Отобразить их в модальном окне
3. Позволить модерировать комментарии

---

## ✨ Суммарная информация

| Параметр | Значение |
|----------|---------|
| **Файл компонента** | [ModerationHistoryPanel.tsx](frontend/src/components/Admin/ModerationHistoryPanel.tsx) |
| **Используется в** | [AdminContent.tsx](frontend/src/components/Admin/AdminContent.tsx) |
| **Таб в меню** | "Метки 📍" в [AdminSidebar.tsx](frontend/src/components/Admin/AdminSidebar.tsx) |
| **API для маркеров** | `GET /moderation/history/markers` |
| **API для деталей** | `GET /moderation/markers/{id}/details` |
| **Backend контроллер** | [moderationHistoryController.js](backend/src/controllers/moderationHistoryController.js) |
| **Комментарии маркеров** | ❌ Не существуют |
| **Файлы для добавления** | 6 файлов (3 backend, 3 frontend) |

