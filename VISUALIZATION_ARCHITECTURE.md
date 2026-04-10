# 🏗️ Архитектурная диаграмма визуализации GEO-Blog

## Структура слоев визуализации

```
┌─────────────────────────────────────────────────────────────────┐
│                    СТРАНИЦЫ ПРИЛОЖЕНИЯ (pages/)                │
├─────────────────────────────────────┬───────────────────────────┤
│   ИНТЕРАКТИВНЫЕ (Glassmorphism)     │  СТАТИЧНЫЕ (игровой)      │
├─────────────────────────────────────┼───────────────────────────┤
│ • Map.tsx                           │ • CentrePage.tsx ⭐       │
│ • Posts.tsx                         │ • ProfilePage.tsx         │
│ • Calendar.tsx                      │ • HomePage.tsx            │
│ • Activity.tsx                      │ • OfflinePage.tsx         │
│ • Planner.tsx                       │ • Friends.tsx             │
│ • Chat.tsx                          │                           │
└─────────────────────────────────────┴───────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MirrorGradientProvider                        │
│         (управление фоном для разного количества панелей)      │
├─────────────────────────────────────────────────────────────────┤
│  panelCount → getGradientClass() → 'mirror-bg', 'mirror-bg-2p' │
│                                     'mirror-bg-3p', 'mirror-bg-4p'
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CSS РЕЖИМЫ (modes)                           │
├─────────────────────────────────────────────────────────────────┤
│ MODE      │ FILE        │ BACKGROUND   │ BLUR    │ Z-INDEX      │
├───────────┼─────────────┼──────────────┼─────────┼──────────────┤
│ map       │ _modes.css  │ Gradient     │ 10px    │ Full viewport│
│ posts     │ _content.css│ Dark glass   │ 24px    │ Variable     │
│ planner   │ _modes.css  │ Yandex Maps  │ 10px    │ 100vh full   │
│ calendar  │ _content.css│ Gradient     │ 10px    │ Variable     │
│ chat      │ PageLayout  │ Embossed     │ -       │ Variable     │
│ centre ⭐ │ PageLayout  │ Orbs animate │ var     │ 1145         │
│ activity  │ PageLayout  │ Gradient     │ 10px    │ Variable     │
└───────────┴─────────────┴──────────────┴─────────┴──────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   GLASS КОМПОНЕНТЫ                              │
│             (frontend/src/components/Glass/)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐    │
│  │ GlassPanel   │      │ GlassHeader  │      │ GlassButton │    │
│  │ (L1 Layer)   │      │ (заголовки)  │      │ (L2 Layer)  │    │
│  └──────────────┘      └──────────────┘      └─────────────┘    │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐    │
│  │ GlassInput   │      │ GlassAccordion│     │ GlassTabs   │    │
│  │ (L2 Layer)   │      │ (L2 Layer)   │      │ (L2 Layer)  │    │
│  └──────────────┘      └──────────────┘      └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CSS ПЕРЕМЕННЫЕ СИСТЕМЫ                         │
│             (_glass-theme.css: 282 строк)                      │
├─────────────────────────────────────────────────────────────────┤
│ ТЕМА        │ --glass-l1-bg    │ --glass-l2-bg    │ --glass-blur│
├─────────────┼──────────────────┼──────────────────┼─────────────┤
│ LIGHT ⭐    │ rgba(255,255,255 │ rgba(255,255,255 │ blur(10px)  │
│ [default]   │ ,0.1) gradient   │ ,0.1)            │ saturate    │
├─────────────┼──────────────────┼──────────────────┼─────────────┤
│ DARK        │ rgba(0,0,0       │ rgba(0,0,0       │ blur(10px)  │
│ [data-theme]│ ,0.1) gradient   │ ,0.06)           │ saturate    │
├─────────────┼──────────────────┼──────────────────┼─────────────┤
│ EMERALD     │ rgba(255,255,255 │ rgba(255,255,255 │ blur(10px)  │
│ [solo]      │ ,0.08) + GREEN   │ ,0.06) + GREEN   │ saturate    │
│             │ tint             │ tint             │             │
└─────────────┴──────────────────┴──────────────────┴─────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   렌더 ФАЗА HTML                                │
│                                                                  │
│  <div class="page-layout-container page-container posts-mode    │
│       glass-dark">                                               │
│    {/* Glass-панели со стилями из CSS переменных */}            │
│    <div class="page-main-panel">                               │
│      <div class="glass-l1"> ← Для панелей                       │
│        <div class="glass-l2"> ← Для кнопок/инпутов             │
│        </div>                                                   │
│      </div>                                                     │
│    </div>                                                       │
│  </div>                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## CentrePage специальная архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    CentrePage.tsx                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌───────────────────┐         ┌──────────────────┐
│ CentreBackground  │         │ MirrorGradient   │
│ (Async orbs)      │         │ Container        │
└───────────────────┘         └──────────────────┘
   ↓ (z-index: 1)                 ↓ (z-index: 1145)
┌─────────────────────────────────────────────────────┐
│   background: #0a0a1a / #e8e6f0                    │
│   [4 animated gradient orbs]                        │
│                                                     │
│   • Orb 1: Indigo (25s) — blur(80px)               │
│   • Orb 2: Purple (30s) — blur(80px)               │
│   • Orb 3: Blue   (28s) — blur(80px)               │
│   • Orb 4: Pink   (32s) — blur(80px)               │
│                                                     │
│   + Noise overlay (opacity: 0.05)                  │
└─────────────────────────────────────────────────────┘
                         ↑
                    (поверх это)
┌────────────────────────────────────────────────────────────┐
│ .centre-mode (Glass L1)                                    │
│ background: var(--glass-l1-bg)                             │
│ backdrop-filter: blur(16px) saturate(180%)                 │
│ border: 1px solid var(--glass-l1-border)                  │
│ z-index: 1145                                              │
│ position: fixed, max-width: 1400px                         │
│                                                            │
│ ┌──────────────────────────────────────────────────┐      │
│ │ .centre-static-header (иконки, заголовок)        │◀─┐   │
│ │ ┌─ Star (от Trophy to Star) gradient text        │  │   │
│ │         "Центр Влияния"                          │  │   │
│ │                                                  │  │   │
│ │ "Прогresс · Соревнования · Мотивация"            │  │   │
│ └──────────────────────────────────────────────────┘  │   │
│                                                        │   │
│ ┌──────────────────────────────────────────────────┐  │   │
│ │ .centre-scroll-area (scrollbar-width: none)      │  │   │
│ │                                                   │  │   │
│ │ ┌─ centre-glass-card ┐                           │  │   │
│ │ │ CentreLevelCard    │ ← SVG progressBar,        │  │   │
│ │ │ (Level + Rank)     │   Rank Icon (Crown/Star) │  │   │
│ │ └────────────────────┘   Streak (Flame 🔥)      │  │   │
│ │                                                   │  │   │
│ │ ┌─ centre-glass-card ┐                           │  │   │
│ │ │ CentreDailyGoals   │ ← Daily quests            │  │   │
│ │ │ (прогресс цели)    │   Progress bars           │  │   │
│ │ └────────────────────┘                           │  │   │
│ │                                                   │  │   │
│ │ ┌─ centre-glass-card ┐                           │  │   │
│ │ │ CentreAchievements │ ← Common / Rare / Epic /  │  │   │
│ │ │ (значков и рарность)                           │  │   │
│ │ │                    │   Legendary (pulse anim)  │  │   │
│ │ └────────────────────┘                           │  │   │
│ │                                                   │  │   │
│ │ ┌─ centre-glass-card ┐                           │  │   │
│ │ │ UserProfileCard    │ ← Overlay при select      │  │   │
│ │ │ (другой пользов.)  │   Top gradient bar        │  │   │
│ │ └────────────────────┘                           │  │   │
│ │                                                   │  │   │
│ └──────────────────────────────────────────────────┘  │   │
└────────────────────────────────────────────────────────────┘
                                        ← ICONS используют
                                           Lucide React:
                                           Trophy
                                           Flame
                                           Star
                                           Crown
                                           Sprout
                                           Search
                                           Compass
```

---

## Maps.tsx с двухслойной panel системой

```
┌───────────────────────────────────────────────────────────┐
│ MapPage.tsx                                               │
└───────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ MirrorGradientContainer (map-mode)                          │
│ full viewport, position: relative                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   [LEAFLET MAP - background] ┌──────────────┐│
│  │Left Panel│                              │Right Panel   ││
│  │(Filters) │   • Markers                   │(Favorites)   ││
│  │          │   • Routes                    │              ││
│  │[L1 Glass]│   • Clusters                  │[L1 Glass]    ││
│  │          │   • Zoom controls             │              ││
│  │ ┌─────────  ├ GlassPanel                 ├─────────┐    ││
│  │ │ Filter  │                              │ ⭐ Items│    ││
│  │ │ Categories                             │ 📍 Places    ││
│  │ │ Distance │                             │ 🛣️  Routes   ││
│  │ │ Tags    │                              │ 📅 Events    ││
│  │ │         │                              │         │    ││
│  │ │ [L2]    │                              │ [L2]    │    ││
│  │ │ Button  │                              │ Button  │    ││
│  │ └─────────┘                              └─────────┘    ││
│  │          │                              │              ││
│  └──────────┘                              └──────────────┘│
│                                                             │
│  LEFT: class="page-left-panel map-mode"                   │
│        background: transparent                            │
│        position: fixed, left: 28px, top: 92px             │
│                                                            │
│  RIGHT: class="page-right-panel map-mode"                 │
│         background: rgba(255,255,255,0.08) ← Glass        │
│         backdrop-filter: blur(10px) saturate(160%)         │
│         position: fixed, right: 28px, top: 92px           │
│         border-radius: 12px, z-index: 250                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
                   CSS Modes:
              page-left-panel.map-mode
              page-right-panel.map-mode
```

---

## Posts.tsx с тёмным glass режимом

```
┌──────────────────────────────────────────────────────────┐
│ PostsPage.tsx                                            │
│ (layout = useLayoutState())                              │
└──────────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│ MirrorGradientContainer                                  │
│ className="page-layout-container                         │
│             page-container                               │
│             posts-mode                                   │
│             glass-${glassVariant}"                       │
│ (glassVariant = 'light' | 'dark')    ← useThemeStore    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ LEFT: leftContent ─┐   [КАРТА/ПЛАНИРОВЩИК]          │
│ │ Map.tsx            │   (если isTwoPanelMode)          │
│ │ или                │                                  │
│ │ Planner.tsx        │   透明ный background             │
│ └────────────────────┘   z-index: 100                   │
│                                                          │
│                                  ┌─ RIGHT: postMode ──┐ │
│                                  │ class="glass-dark"  │ │
│                                  │ backdrop-filter:    │ │
│                                  │  blur(24px)         │ │
│                                  │                     │ │
│                                  │ ┌─ PostCard ───┐   │ │
│                                  │ │ Glass L2 bgr │   │ │
│                                  │ │ • Title       │   │ │
│                                  │ │ • Image       │   │ │
│                                  │ │ • Reactions   │   │ │
│                                  │ │ • Comments    │   │ │
│                                  │ └───────────────┘   │ │
│                                  │                     │ │
│                                  │ ┌─ PostCard ───┐   │ │
│                                  │ │ ...           │   │ │
│                                  │ └───────────────┘   │ │
│                                  └─────────────────────┘ │
│                                                          │
│ CSS: .page-container.posts-mode                         │
│      .page-main-panel {                                 │
│        background: linear-gradient(135deg,              │
│                      rgba(34,38,48,0.85) 0%,           │
│                      rgba(46,52,68,0.82) 100%);        │
│        backdrop-filter: blur(24px) saturate(180%);      │
│        border: 1px solid rgba(255,255,255,0.12);       │
│        box-shadow: 0 25px 50px rgba(...),               │
│                    0 8px 20px rgba(...);                │
│      }                                                   │
└──────────────────────────────────────────────────────────┘
```

---

## Режимы и их особенности

```
MAP-MODE
├─ Full viewport background: transparent
├─ Leaflet контейнер поверх градиента
├─ Left + Right glass-панели (L1)
├─ Facade map portal
└─ z-index: управляется режимом

POSTS-MODE
├─ Dark glass gradient фон
├─ Двухслойный контент: карта + посты
├─ Light/Dark переключение
├─ Backdrop blur: 24px (тёмное)
└─ Custom class: .glass-${variant}

PLANNER-MODE
├─ Full viewport (height: 100vh)
├─ Yandex Maps background
├─ Glass-контролы поверху
├─ position: absolute, z-index: full
└─ height: calc(100vh - 64px)

CENTRE-MODE
├─ Animated orbs background
├─ Fixed glass-панель по центру
├─ z-index: 1145 (высокий)
├─ max-width: 1400px, centered
└─ Специальные стили для карточек

CALENDAR-MODE
├─ Glass-панели для редактора
├─ Interactive date picker
├─ Location picker поверх карты
└─ Duo-panel support

ACTIVITY-MODE
├─ Stat-cards с градиентами
├─ Glass контейнер
├─ Colour-coded statistics
└─ Activity feed

CHAT-CONTAINER
├─ Embossed эффект (белые линии + глубокие тени)
├─ Специальный CSS класс
├─ border: multiple shadow layers
└─ position: static/relative

FAVORITES-MODE
├─ Glass-панель (как posts-mode)
├─ Accordion списки
├─ Transparent контент
└─ Glass L2 карточки для элементов
```

---

## Таблица CSS переменных по темам

```
┌──────────────┬──────────────────────┬──────────────────────┐
│ VARIABLE     │ LIGHT (@root)        │ DARK ([data-theme])  │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-l1-bg│ rgba(255,255,255,0.1)│ rgba(0,0,0,0.1)      │
│              │ gradient to 0.05     │ gradient to 0.05     │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-l1-  │ rgba(255,255,255,0.2)│ rgba(0,0,0,0.12)     │
│   border     │                      │                      │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-l2-bg│ rgba(255,255,255,0.1)│ rgba(0,0,0,0.06)     │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-l2-  │ rgba(255,255,255,0.2)│ rgba(0,0,0,0.12)     │
│   border     │                      │                      │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-blur │ blur(10px) sat(180%) │ blur(10px) sat(180%) │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-text │ rgba(0,0,0,0.8)      │ rgba(255,255,255,0.92)
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-     │ rgba(0,0,0,0.5)      │ rgba(255,255,255,0.65)
│   text-sec   │                      │                      │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-     │ 20px                 │ 20px                 │
│   radius     │                      │                      │
├──────────────┼──────────────────────┼──────────────────────┤
│ --glass-l1-  │ 0 8px 32px rgba(...) │ 0 8px 32px rgba(...) │
│   shadow     │ 0,0,0,0.1            │ 0,0,0,0.1            │
└──────────────┴──────────────────────┴──────────────────────┘
```

---

## Визуальный иерархия компонентов

```
LAYER 4 (UI Controls)
├─ Buttons
├─ Inputs  
├─ Checkboxes
└─ Icons

LAYER 3 (Glass L2 Components)
├─ GlassButton
├─ GlassInput
├─ GlassAccordion
└─ GlassTabs

LAYER 2 (Glass L1 Containers)
├─ GlassPanel
└─ GlassHeader

LAYER 1 (Page Mode Containers)
├─ .centre-mode (fixed, z: 1145)
├─ .posts-mode (position: absolute)
├─ .map-mode (transparent)
├─ .planner-mode (100vh)
├─ .calendar-mode (Glass)
├─ .activity-mode (Stat cards)
├─ .chat-container (Embossed)
└─ .favorites-mode (Glass)

LAYER 0 (Background)
├─ Mirror Gradient (varies by mode)
├─ CentreBackground (animating orbs)
└─ MapBackground (Leaflet/Yandex)
```
