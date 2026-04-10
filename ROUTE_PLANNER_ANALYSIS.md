# Быстрый анализ Route Planner - Логика, Кнопки, Стили

## 1️⃣ Построение маршрута (Почему по прямой?)

### Основной файл: [YandexPlannerRenderer.ts](frontend/src/services/map_facade/adapters/YandexPlannerRenderer.ts#L165)

**Функция `renderRoute()` (строки 165-230):**

```typescript
async renderRoute(route: PersistedRoute): Promise<void> {
  // ШАГ 1: Если есть сохранённая ПОЛНАЯ геометрия (>10 точек) — рисует полилинией по дорогам
  if (geometry && geometry.length > 10) {
    const polyline = new ymaps.Polyline(geometry, {}, 
      { strokeWidth: 4, strokeColor: route.color || '#2196F3' });
    this.map.geoObjects.add(polyline);
    return;
  }

  // ШАГ 2: Если геометрии нет — строит маршрут ЧЕРЕЗ YANDEX CARDS API
  const routeResult = await ymaps.route(coords, {
    mapStateAutoApply: false,
    routingMode: 'auto'  // ← Режим ДОРОГ
  });
}
```

**Почему может идти по прямой:**

| Сценарий | Что происходит |
|---------|---------------|
| **Есть сохранённая полная геометрия** | ✅ Рисует по дорогам (полилиния через реальные точки) |
| **Нет сохранённой геометрии, <2 точек** | ❌ **НЕ рисует ничего** (`if (coords.length < 2) return`) |
| **ymaps.route() не доступен или ошибка** | ⚠️ **Fallback на простую Polyline** → **ПРЯМАЯ ЛИНИЯ** |
| **Успешно вызвана ymaps.route()** | ✅ Маршрут по дорогам (от Yandex) |

**ВЫВОД:** Маршрут идёт по прямой когда:
- Yandex Maps API не загрузился
- Ошибка при вызове `ymaps.route()`
- Fallback `catch` блок активирован

---

## 2️⃣ Кнопка "Очистить карту"

### Иерархия компонентов:

```
Planner.tsx (главная)
  ↓ строка 1289-1304
  ├─ handleClearAllClickMarkers() callback
  │  ├─ mapApi.clear()  ← Очистка через фасад
  │  ├─ renderMarkersOnMap([]) ← Удалить маркеры
  │  ├─ setFacadeMarkers([]) + setFacadeRoutes([]) ← Reset состояния
  │  └─ alert('✅ Карта очищена')
  │
  ↓ строка 1750 + 1778
  └─ PlannerActionButtons.tsx
     ├─ Prop onClearMapClick={handleClearAllClickMarkers}
     ├─ Кнопка ID: "clear" (если hasMarkersOrRoutes === true)
     ├─ Иконка: Trash2 (lucide-react)
     └─ Label: "Очистить карту"
```

### Файлы:
- **[Planner.tsx](frontend/src/pages/Planner.tsx#L1289-L1304)** — функция `handleClearAllClickMarkers()`
- **[PlannerActionButtons.tsx](frontend/src/components/Planner/PlannerActionButtons.tsx#L54-L61)** — кнопка с id="clear"

### Когда видна кнопка:
```typescript
if (hasMarkersOrRoutes) {  // ← Условие отображения
  buttons.push({
    id: 'clear',
    icon: Trash2,
    label: 'Очистить карту',
    onClick: onClearMapClick,
  });
}
```

---

## 3️⃣ Стили маркеров (Точки вместо капель)

### Основной файл: [mapUtils.ts](frontend/src/components/Map/mapUtils.ts#L126-L145)

**Объект `markerCategoryStyles`:**
```typescript
export const markerCategoryStyles = {
  attraction: { color: '#3498db', icon: 'fa-star' },
  restaurant: { color: '#8B0000', icon: 'fa-utensils' },
  hotel: { color: '#8e44ad', icon: 'fa-hotel' },
  nature: { color: '#27ae60', icon: 'fa-leaf' },
  // ... и ещё 13 категорий
  default: { color: '#7f8c8d', icon: 'fa-map-marker-alt' }
};
```

**Функция HTML-маркера: `createMarkerIconHTML()`** (строки 149-172)

```typescript
// ✨ ТЕКУЩИЙ СТИЛЬ: КРУГЛАЯ ТОЧКА С ИКОНКОЙ (не капля!)
export function createMarkerIconHTML(category: string, color: string, size: number = 24): string {
  return `
    <div style="
      background-color: ${fill} !important;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;    ← ⚠️ ФОРМА КАПЛИ (не круг!)
      border: 3px solid white !important;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    ">
      <i class="fas ${style.icon}" style="
        color: white !important;
        font-size: ${size * 0.5}px;
        transform: rotate(45deg);
      "></i>
    </div>
  `;
}
```

### Где хранятся стили:
| Файл | Что там |
|------|---------|
| [mapUtils.ts](frontend/src/components/Map/mapUtils.ts#L126-L155) | 🎨 Цвета + иконки для каждой категории |
| [mapUtils.ts](frontend/src/components/Map/mapUtils.ts#L149-L172) | 📐 HTML шаблон маркера (border-radius, тень, иконка) |
| [Map.tsx](frontend/src/components/Map/Map.tsx#L1220-L1230) | 🔧 Применение стилей при рендере маркеров |
| [useMapMarkers.tsx](frontend/src/components/Map/useMapMarkers.tsx#L97-L127) | 📍 Логика подстановки цветов и иконок |

### Чтобы сделать ПОЛНЫЕ КРУГИ (вместо капель):
Измените в `createMarkerIconHTML()` строку:
```typescript
// ❌ Текущая форма (капля):
border-radius: 50% 50% 50% 0;

// ✅ Для полного круга:
border-radius: 50%;
```

---

## 📊 Сводная таблица

| Что | Файл | Строки | Функция |
|-----|------|--------|---------|
| **Маршрутизация** | YandexPlannerRenderer.ts | 165-230 | `renderRoute()` → `ymaps.route()` |
| **Построение** | MapContextFacade.ts | 774-780 | `drawRoute()` → `renderRoute()` |
| **Очистка** | Planner.tsx | 1289-1304 | `handleClearAllClickMarkers()` |
| **Кнопка очистки** | PlannerActionButtons.tsx | 54-61 | `<button id="clear">` |
| **Стили маркеров** | mapUtils.ts | 126-172 | `markerCategoryStyles` + `createMarkerIconHTML()` |
| **Применение стилей** | Map.tsx | 1220-1230 | Подстановка цвета из категории |

---

## 🔍 Быстрые поиски (выполнены):

✅ `drawRoute` → [YandexPlannerRenderer.ts](frontend/src/services/map_facade/adapters/YandexPlannerRenderer.ts#L165)  
✅ `Clear` button → [PlannerActionButtons.tsx](frontend/src/components/Planner/PlannerActionButtons.tsx#L54-L61)  
✅ `marker.*style` → [mapUtils.ts](frontend/src/components/Map/mapUtils.ts#L126-L172)  
✅ `ymaps.route()` → [YandexPlannerRenderer.ts](frontend/src/services/map_facade/adapters/YandexPlannerRenderer.ts#L197)  
✅ `mapApi.clear()` → [Planner.tsx](frontend/src/pages/Planner.tsx#L1292-L1293)
