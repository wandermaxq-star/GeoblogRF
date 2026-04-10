# 🎨 Анализ системы визуализации GEO-Blog

## Краткий обзор

Проект использует **двухслойную систему визуализации**:
- **Interactive Pages** — динамические страницы с glassmorphism эффектом (морфизм)
- **Static Pages** — статичные страницы с игровыми стилями и украшениями

---

## 1️⃣ МОРФИЗМ / GLASSMORPHISM СТРАНИЦЫ (Интерактивные)

### 📋 Страницы с эффектом морфизма

#### **Map.tsx** — Интерактивная карта
```
Файл: frontend/src/pages/Map.tsx (1578 строк)
```

**Визуальный стиль:**
- Два слоя стекла `glass-l1` (панели) + `glass-l2` (контролы)
- Динамичные левая (фильтры/действия) и правая (избранное) панели
- Backdrop blur: `blur(10px) saturate(180%)`
- Градиентный фон поверх Leaflet-карты

**Компоненты:**
- `<GlassPanel>` — основная рамка панелей
- `<GlassHeader>` — заголовки с иконками + кнопка закрытия
- `<GlassButton>` — интерактивные кнопки
- `<GlassInput>` — поля ввода (поиск, координаты)
- `<GlassAccordion>` — выпадающие списки фильтров

**Режим:** `map-mode` (full viewport, z-index регулируется)

**CSS переменные:**
```css
--glass-l1-bg: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
--glass-l1-border: rgba(255, 255, 255, 0.2);
--glass-blur: blur(10px) saturate(180%);
--glass-radius: 20px;
```

---

#### **Posts.tsx** — Лента постов с морфизмом
```
Файл: frontend/src/pages/Posts.tsx (868 строк)
```

**Визуальный стиль:**
- Темное матовое стекло: `rgba(34, 38, 48, 0.85)` с `rgba(46, 52, 68, 0.82)`
- Глубокий blur: `blur(24px) saturate(180%)`
- Динамическое переключение `glass-light` | `glass-dark` через `data-theme`
- Левая панель (карта/планировщик) + Правая панель (посты)

**Компоненты:**
- `<PostCard>` — карточка поста с реакциями
- `<CreatePostModal>` — модальное окно создания
- `<LazyPostConstructor>` — конструктор контента
- `<OfflineDraftsPanel>` — панель офлайн-черновиков

**Режим:** `posts-mode` (glass-dark/glass-light переключение)

**CSS:**
```css
background: linear-gradient(135deg, rgba(34,38,48,0.85) 0%, rgba(46,52,68,0.82) 100%);
-webkit-backdrop-filter: blur(24px) saturate(180%);
border: 1px solid rgba(255,255,255,0.12);
box-shadow: 0 25px 50px rgba(5,8,15,0.5), 0 8px 20px rgba(10,14,25,0.35);
```

---

#### **Calendar.tsx** — Календарь событий
```
Файл: frontend/src/pages/Calendar.tsx (1786 строк)
```

**Визуальный стиль:**
- Glass-панели для редактора событий
- Интерактивное выбор локации на карте
- Двухслойная система: `glass-l1` (контейнеры) + `glass-l2` (кнопки)

**Компоненты:**
- `<TravelCalendar>` — интерактивный календарь
- `<EventBlocksEditor>` — редактор блоков событий
- `<EventLocationPicker>` — выбор локации на карте
- `<SmartEventSearch>` — умный поиск событий

**Режим:** `calendar-mode`

---

#### **Activity.tsx** — Лента активности
```
Файл: frontend/src/pages/Activity.tsx (209 строк)
```

**Визуальный стиль:**
- Красивые **stat-card** блоки с цветовой кодировкой (blue, orange, green, purple)
- Glassmorphism контейнер для активности
- Динамические иконки (FaBell, FaComment, FaHeart и т.д.)

**Компоненты:**
- `<ActivityStatsBlocks>` — stat-card с метриками
- `<ActivityFiltersPanel>` — панель фильтров
- `<SimpleActivityFeed>` — лента активности

**Stat-card цвета:**
```css
.stat-card.blue    { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
.stat-card.orange  { background: linear-gradient(135deg, #f97316, #fb923c); }
.stat-card.green   { background: linear-gradient(135deg, #22c55e, #4ade80); }
.stat-card.purple  { background: linear-gradient(135deg, #a855f7, #d946ef); }
```

---

#### **Planner.tsx** — Планировщик маршрутов
```
Файл: frontend/src/pages/Planner.tsx (1932+ строк)
```

**Визуальный стиль:**
- Полнооконный режим (Yandex Maps)
- Glass-панели для управления маршрутами
- Интеграция с Yandex Maps Router API

**Режим:** `planner-mode` (full viewport, height: 100vh)

**Компоненты:**
- `<EnhancedPlanner>` — планировщик маршрутов
- `<RoutePlanner>` — управление точками маршрута
- Glass-контролы поверх карты

---

#### **Chat.tsx** — Чат
```
Файл: frontend/src/pages/Chat.tsx
```

**Визуальный стиль:**
- Классический chat-mode с embossed эффектом
- Белые линии и глубокие тени
- Специальный класс `.chat-container`

**Режим:** `chat-container`

**CSS:**
```css
box-shadow: 
  0 0 0 1px rgba(255,255,255,0.9),    /* Белая линия */
  0 2px 8px rgba(255,255,255,0.4),     /* Светлый ореол */
  0 8px 32px rgba(0,0,0,0.15),         /* Глубокое затемнение */
  0 16px 64px rgba(0,0,0,0.08);        /* Дополнительная глубина */
```

---

## 2️⃣ СТАТИЧНЫЕ СТРАНИЦЫ (Игровой стиль)

### 🎮 Страницы с игровыми элементами

#### **CentrePage.tsx** — Центр Влияния (Gamification Hub)
```
Файл: frontend/src/pages/CentrePage.tsx (233 строк)
```

**Визуальный стиль:** ✨ НАИБОЛЕЕ НЕСТАНДАРТНАЯ
- **Анимированный фон** с плывущими градиентными сферами (orbs)
- Glass-панель `centre-mode` поверх фона
- Игровой дизайн с рангами, достижениями, уровнями
- Круговые SVG прогресс-бары с цветовыми градиентами по рангам

**Компоненты:**
- `<CentreBackground>` — анимирующиеся градиентные сферы (CSS-only)
- `<CentreLevelCard>` — карточка уровня с круговым прогресс-баром
- `<CentreDailyGoals>` — дневные цели с прогрессом
- `<CentreAchievementsRow>` — достижения (common, rare, epic, legendary)
- `<UserProfileCard>` — карточка профиля пользователя

**Иконки (Lucide React):**
```tsx
<Trophy/>    // Трофеи
<Flame/>     // Стрик/огонь
<Star/>      // Звезды
<Crown/>     // Корона (Geoblogger ранг)
<Sprout/>    // Зелень (Novice ранг)
<Search/>    // Лупа (Explorer)
<Compass/>   // Компас (Traveler)
```

**Режим:** `centre-mode` (fixed позиция, z-index: 1145)

**Ранги и цвета:**
```tsx
novice: { from: '#9ca3af', to: '#d1d5db' }      // Серый
explorer: { from: '#eab308', to: '#22c55e' }    // жёлто-зелёный
traveler: { from: '#22c55e', to: '#3b82f6' }    // зелёно-синий
legend: { from: '#3b82f6', to: '#8b5cf6' }      // синий-фиолет
geoblogger: { from: '#8b5cf6', to: '#ec4899' }  // фиолет-розовый
```

**Фон (CentreBackground.css):**
```css
/* 4 анимирующихся сферы с blur(80px) */
.centre-bg__orb {
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: centre-orb-float-1 25s ease-in-out infinite;
}

/* Orb 1: Indigo верхний левый */
.centre-bg__orb--1 {
  background: radial-gradient(circle, rgba(99,102,241,0.7) 0%, transparent 70%);
  animation: centre-orb-float-1 25s ease-in-out infinite;
}

/* Orb 2: Purple правый центр */
.centre-bg__orb--2 {
  background: radial-gradient(circle, rgba(147,51,234,0.6) 0%, transparent 70%);
  animation: centre-orb-float-2 30s ease-in-out infinite;
}

/* Orb 3: Blue нижний левый */
.centre-bg__orb--3 {
  background: radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%);
  animation: centre-orb-float-3 28s ease-in-out infinite;
}

/* Orb 4: Pink нижний правый */
.centre-bg__orb--4 {
  background: radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%);
  animation: centre-orb-float-4 32s ease-in-out infinite;
}
```

**Glass-карточки (centre-glass-card):**
```css
background: var(--glass-card-bg);
backdrop-filter: var(--glass-blur);
border: 1px solid rgba(255,255,255,0.35);
border-radius: 12px;
padding: 18px;
transition: all 0.25s ease;
box-shadow: var(--glass-shadow);
```

**Достижения (rarities):**
```css
.centre-rarity-common { color: #9ca3af; }
.centre-rarity-rare { color: #3b82f6; text-shadow: 0 0 8px rgba(59,130,246,0.3); }
.centre-rarity-epic { color: #8b5cf6; text-shadow: 0 0 8px rgba(139,92,246,0.3); }
.centre-rarity-legendary {
  color: #f59e0b;
  text-shadow: 0 0 12px rgba(245,158,11,0.4);
  animation: centre-legendary-pulse 2s ease-in-out infinite;
}
```

---

#### **ProfilePage.tsx** — Профиль пользователя
```
Файл: frontend/src/pages/ProfilePage.tsx
```

**Визуальный стиль:**
- Также использует `centre-mode` с glass-панелями
- Профильная информация с рангом/уровнем
- Статистика и достижения пользователя

**Режим:** `centre-mode`

---

### 📄 Другие страницы

#### **HomePage.tsx / Home.tsx**
- Статьи с embossed эффектом
- Основной контент без специальной визуализации

#### **OfflinePage.tsx**
- SVG-карта России (85 регионов, Albers проекция)
- Offline контент с glass-панелью для выбора региона

#### **Friends.tsx**
- Социальные компоненты
- Glass-стиль для панелей

---

## 3️⃣ АРХИТЕКТУРА CSS СИСТЕМЫ СТИЛЕЙ

### 📂 Структура файлов CSS

```
frontend/src/styles/
├── _glass-theme.css          # 🔑 Основная система glass-переменных
├── _modes.css                # Режимы: map, posts, centre, calendar и т.д.
├── _mobile-glass.css         # Мобильные glass-стили
├── _components.css           # stat-card, элементы ввода
├── _content.css              # posts-mode, favorites-mode стили
├── PageLayout.css            # centre-mode и другие режимы (1934 строк)
├── GlobalStyles.css          # mirror-bg классы, embossed эффект
├── _dark-overrides.css       # Dark-тема переопределения
├── MapBackground.css         # Фон для карты
├── ParticleSystem.css        # Частицы (опционально)
├── EmbossedStyles.css        # Embossed эффект чата
├── HolographicUI.css         # Голографический стиль
└── ...другие
```

### 🎯 Ключевые CSS переменные (_glass-theme.css)

**Light режим:**
```css
:root {
  /* Layer 1: Контейнеры */
  --glass-l1-bg: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
  --glass-l1-border: rgba(255,255,255,0.2);
  --glass-l1-shadow: 0 8px 32px rgba(0,0,0,0.1);

  /* Layer 2: Кнопки, инпуты */
  --glass-l2-bg: rgba(255,255,255,0.1);
  --glass-l2-border: rgba(255,255,255,0.2);
  --glass-l2-shadow: 0 4px 12px rgba(0,0,0,0.15);

  /* Общие */
  --glass-blur: blur(10px) saturate(180%);
  --glass-text: rgba(0,0,0,0.8);
  --glass-radius: 20px;
}
```

**Dark режим:**
```css
[data-theme="dark"] {
  --glass-l1-bg: linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 100%);
  --glass-l1-border: rgba(0,0,0,0.12);
  --glass-l2-bg: rgba(0,0,0,0.06);
  --glass-text: rgba(255,255,255,0.92);
}
```

**Emerald режим (solo-страницы):**
```css
[data-theme="emerald"] {
  --glass-l1-bg: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
  --glass-l1-border: rgba(16,185,129,0.25);  /* Зелёный tint */
  --glass-text: rgba(255,255,255,0.92);
}
```

### 🔀 Режимы (Modes)

| Режим | Файл | Особенности |
|-------|------|------------|
| `map-mode` | _modes.css | Full viewport, z-index управляется, left/right панели |
| `posts-mode` | _content.css | Glass-dark/glass-light, двухслойный контент |
| `planner-mode` | _modes.css | Yandex Maps, height: 100vh |
| `calendar-mode` | _content.css | Glass-панели для редактора событий |
| `chat-container` | PageLayout.css | Embossed эффект, белые линии |
| `centre-mode` | PageLayout.css | Glass-панель + Orbs background, fixed позиция |
| `activity-mode` | PageLayout.css | Glassmorphism с stat-card блоками |
| `favorites-mode` | _content.css | Glass-контейнер для избранного |

---

## 4️⃣ КОМПОНЕНТЫ GLASS СИСТЕМЫ

### Структура Glass-компонентов

```
frontend/src/components/Glass/
├── GlassPanel.tsx            # Контейнер (level 1)
├── GlassHeader.tsx           # Заголовок панели
├── GlassButton.tsx           # Кнопка (level 2)
├── GlassInput.tsx            # Текстовое поле (level 2)
├── GlassAccordion.tsx        # Выпадающая секция
├── GlassTabs.css             # Вкладки
└── index.ts                  # Экспорты
```

**GlassPanel.tsx:**
```tsx
<GlassPanel>
  <GlassHeader title="Заголовок" onClose={handleClose} />
  <GlassButton>Кнопка</GlassButton>
  <GlassInput placeholder="Введите текст" />
</GlassPanel>
```

---

## 5️⃣ MirrorGradientProvider — Управление фоном

### Назначение
Система управления gradient-фоном для разного количества панелей

**Компонент:** `MirrorGradientProvider.tsx`

**Логика:**
```tsx
interface MirrorGradientContextType {
  panelCount: number;
  getGradientClass: () => string;
}

getGradientClass() {
  switch(panelCount) {
    case 1: return 'mirror-bg';          // Обычный фон
    case 2: return 'mirror-bg-2panels';  // Фон для 2 панелей
    case 3: return 'mirror-bg-3panels';  // Фон для 3 панелей
    case 4: return 'mirror-bg-4panels';  // Фон для 4 панелей
  }
}
```

**CSS классы** (GlobalStyles.css):
```css
.mirror-bg                { /* Основной фон */ }
.mirror-bg.posts-mode     { /* Posts с glass */ }
.mirror-bg.centre-mode    { /* Centre с orbs */ }
.mirror-bg-2panels        { /* Двухслойный фон */ }
.mirror-bg-3panels        { /* Трёхслойный фон */ }
.mirror-bg-4panels        { /* Четырехслойный фон */ }
```

---

## 6️⃣ ТЁМНАЯ ТЕМА И ПЕРЕКЛЮЧЕНИЕ

### Система переключения тем

**Хук:** `useThemeStore` (stores/themeStore.ts)

**Атрибут данных:**
```tsx
<html data-theme="light" | "dark" | "emerald">
```

**В Posts.tsx:**
```tsx
const { theme } = useThemeStore();
const glassVariant = theme; // 'light' | 'dark'

<MirrorGradientContainer className={`posts-mode glass-${glassVariant}`}>
```

**CSS переопределения:**
```css
[data-theme="dark"] .centre-glass-card {
  border-color: rgba(255,255,255,0.25);
}

[data-theme="dark"] .centre-static-header {
  /* Dark-специфичные стили */
}
```

---

## 🎨 Визуальные эффекты и анимации

### Glassmorphism эффекты

1. **Backdrop Filter:**
   - `blur(10px) saturate(180%)` — стандартный размытый стакан
   - `blur(24px) saturate(180%)` — тёмное матовое стекло (posts)
   - `blur(16px) saturate(180%)` — сильный размытый эффект

2. **Border-radius:**
   - `20px` — основной для крупных панелей/контейнеров
   - `12px` — для средних компонентов
   - `8px` — для маленьких элементов

3. **Box-shadow:**
   - `0 8px 32px rgba(0,0,0,0.1)` — мягкая тень
   - `0 25px 50px rgba(0,0,0,0.25)` — глубокая тень (posts)
   - `0 4px 12px rgba(0,0,0,0.15)` — лёгкая тень

### Анимации

**Centre page орбы** (CentreBackground.css):
```css
@keyframes centre-orb-float-1 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, -30px); }
}

@keyframes centre-orb-float-2 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-40px, 40px); }
}
/* и т.д. для 3 и 4 */
```

**Legendary достижение пульс:**
```css
@keyframes centre-legendary-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.05); }
}
```

---

## 📱 Мобильная адаптация

### Mobile Glass Styles (_mobile-glass.css)

```tsx
// Мобильная версия CentrePage использует:
{isMobile ? <CentrePageMobile /> : <CentrePageDesktop />}
```

**Мобильные стили:**
- `m-glass-page` — полнооконная glass-панель
- `m-glass-card` — карточки в мобильном размере
- Меньше отступов и сокращённые иконки
- Адаптированные animations

---

## 📊 Сравнительная таблица

| Компонент | Тип | Фон | Blur | Grayscale? | Иконки | Игровой? |
|-----------|-----|-----|------|-----------|--------|----------|
| Map.tsx | Интерактив | Gradient | 10px | Нет | Fa icons | ❌ |
| Posts.tsx | Интерактив | Тёмный | 24px | Нет | Fa icons | ❌ |
| Calendar.tsx | Интерактив | Gradient | 10px | Нет | Fa icons | ❌ |
| Activity.tsx | Интерактив | Gradient | 10px | Нет | Fa icons | ⚡ Stat-cards |
| Planner.tsx | Интерактив | Карта | 10px | Нет | Fa icons | ❌ |
| **CentrePage.tsx** | **Статик** | **Orbs** | **Variable** | **60% locked** | **Lucide** | **🎮 ДА!** |
| Chat.tsx | Интерактив | Embossed | - | Нет | Fa icons | ❌ |

---

## 🔧 Технические детали

### Theme Context
```tsx
// contexts/ThemeContext.ts
{isDarkMode} = useTheme();

// Переходит в: [data-theme="light"] | [data-theme="dark"]
```

### Layout Context
```tsx
// contexts/LayoutContext.ts
{layout} = useLayoutState();
// Управляет позицией левой/правой панелей
```

### Content Store
```tsx
// stores/contentStore.ts
const {leftContent, rightContent} = useContentStore();
// 'map' | 'planner' | 'posts' | null
```

---

## 📝 Резюме

### ✨ Морфизм (Glassmorphism) Страницы:
- **Map.tsx** — двуслойные glass-панели с динамическими фильтрами
- **Posts.tsx** — тёмное матовое стекло с постами и реакциями
- **Calendar.tsx**, **Activity.tsx**, **Planner.tsx** — различной сложности glass-контейнеры

### 🎮 Игровые/Статичные Страницы:
- **CentrePage.tsx** — единственная со специальным игровым дизайном:
  - Анимирующиеся gradient orbs
  - Круговые SVG прогресс-бары
  - Система рангов (novice → geoblogger)
  - Достижения (common → legendary)
  - Иконки Lucide React (Trophy, Flame, Crown и т.д.)

### 🎨 CSS Архитектура:
- **_glass-theme.css** — система переменных для морфизма
- **_modes.css** — режимы отображения (map, posts, centre и т.д.)
- **GlobalStyles.css** — mirror-bg и специальные эффекты
- **PageLayout.css** — centre-mode и activity-mode стили

### 🔄 Динамическое переключение:
- `data-theme="light" | "dark" | "emerald"` — управление цветовой схемой
- `MirrorGradientProvider` — адаптация фона к количеству панелей
- CSS переменные `--glass-*` переключаются автоматически
