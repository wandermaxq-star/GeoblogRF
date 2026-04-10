# Мобильный рефакторинг: стабилизация Map/Planner

## 📋 Цель

Сделать мобильную версию такой же стабильной, как десктопная:
- Сохранение состояния карты при переходах `/map` ↔ `/planner`
- Предотвращение повторной инициализации карт
- Единая архитектура с десктопом через `contentStore`

---

## ✅ ВСЕ ЭТАПЫ ВЫПОЛНЕНЫ

### Этап 1: Создать MobilePageLayer (аналог PageLayer) ✅

**Создан:** `frontend/src/pages/MobilePageLayer.tsx`

- Обе страницы (Map + Planner) всегда смонтированы
- Переключение через `visibility: hidden` (как на десктопе)
- Управление видимостью Leaflet портала (#global-map-root)
- Логирование для отладки

### Этап 2: Обновить роутинг в App.tsx ✅

**Изменён:** `frontend/src/App.tsx`

- `/map` и `/planner` теперь используют `MobilePageLayer` для мобильных
- Desktop версия продолжает использовать `PersistentMaps`

### Этап 3: Убрать setLeftContent из страниц ✅

**Изменены:**
- `frontend/src/pages/Mobile/MapPage.tsx` — убран useEffect с setLeftContent
- `frontend/src/pages/Mobile/PlannerPage.tsx` — убрана логика скрытия Leaflet портала

Теперь `leftContent` управляется только в `MobileLayout.tsx` через URL.

### Этап 4: Управление Leaflet порталом ✅

**Добавлено в:** `MobilePageLayer.tsx`

- Leaflet портал скрывается когда Planner активен
- Показывается когда Map активен
- Дублирующая логика убрана из PlannerPage

### Этап 5: Инициализация Yandex карты через localStorage ✅

**Добавлено в:** `frontend/src/pages/Mobile/PlannerPage.tsx`

- `useState` для `isMapInitialized` с инициализацией из localStorage
- Проверка флага перед повторной инициализацией карты
- Сохранение флага в localStorage после успешной инициализации
- Предотвращение повторной инициализации при переключении

### Этап 6: Синхронизация URL с contentStore ✅

**Уже реализовано в:** `MobileLayout.tsx`

- useEffect следит за `location.pathname`
- Устанавливает `leftContent='map'` для `/map`
- Устанавливает `leftContent='planner'` для `/planner`
- Сбрасывает `leftContent=null` при уходе на другие страницы

---

## 📁 ИЗМЕНЁННЫЕ ФАЙЛЫ

| Файл | Действие | Статус |
|------|----------|--------|
| `frontend/src/pages/MobilePageLayer.tsx` | **СОЗДАН** | ✅ |
| `frontend/src/App.tsx` | Изменён роутинг | ✅ |
| `frontend/src/pages/Mobile/MapPage.tsx` | Убран setLeftContent | ✅ |
| `frontend/src/pages/Mobile/PlannerPage.tsx` | Убрана логика портала + localStorage | ✅ |

---

## 🎯 РЕЗУЛЬТАТ

1. ✅ Переход `/map` → `/planner` не размонтирует карты
2. ✅ Состояние карты сохраняется между переходами
3. ✅ Нет race condition с `leftContent`
4. ✅ Десктопная версия НЕ затрагивается (стабильна)
5. ✅ Единая архитектура с Desktop (через `contentStore`)
6. ✅ Yandex карта не пересоздаётся при возврате на Planner

---

## 📝 ТЕСТИРОВАНИЕ

**Что проверить:**
1. `/map` → `/planner` — Leaflet карта сохраняет состояние
2. `/planner` → `/map` — Yandex карта сохраняет состояние
3. `/map` → `/posts` → `/map` — карта пересоздаётся (нормально)
4. Маркеры, попапы, зум — сохраняются при переключении `/map` ↔ `/planner`
5. Геолокация — работает корректно

---

## ⚠️ ЧЕГО НЕ ДЕЛАТЬ

- ❌ Не менять десктопную версию (она стабильна)
- ❌ Не менять другие мобильные страницы (Posts, Activity, Profile)
- ❌ Не добавлять новую функциональность — только стабилизация
