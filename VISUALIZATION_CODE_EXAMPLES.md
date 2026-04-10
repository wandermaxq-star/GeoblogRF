# 💻 Примеры кода: Визуализация GEO-Blog

## 1. Glass Components — Базовое использование

### GlassPanel + GlassHeader на Map.tsx

```tsx
// frontend/src/pages/Map.tsx (строка ~570)
import { GlassPanel, GlassHeader, GlassButton, GlassInput } from '../components/Glass';

export const MapPage: React.FC<MapPageProps> = () => {
  const [showLegend, setShowLegend] = useState(false);

  return (
    <MirrorGradientContainer>
      {/* Левая панель — Glass Panel L1 */}
      {isTwoPanelMode && (
        <GlassPanel className="left-panel">
          <GlassHeader 
            title="Фильтры" 
            onClose={() => setShowFilters(false)}
            showCloseButton
          />
          
          {/* Level 2 компоненты */}
          <GlassInput 
            placeholder="Поиск места..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <GlassAccordion title="Kategorie">
            {/* Категории */}
          </GlassAccordion>
          
          <GlassButton onClick={applyFilters}>
            Применить
          </GlassButton>
        </GlassPanel>
      )}
    </MirrorGradientContainer>
  );
}
```

---

## 2. CentrePage — Игровой дизайн

### Структура CentrePage.tsx

```tsx
// frontend/src/pages/CentrePage.tsx
import { CentreBackground } from '../components/Centre/CentreBackground';
import { CentreLevelCard, CentreDailyGoals, CentreAchievementsRow } from '../components/Centre';
import { Trophy, Flame, Star, Crown, Sparkles } from 'lucide-react';

export default function CentrePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  return (
    <>
      {/* Анимированный фон с орбами */}
      <CentreBackground />
      
      {/* Desktop glass-панель */}
      <MirrorGradientContainer className="centre-mode">
        {/* Статический заголовок */}
        <div className="centre-static-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600">
                <Star className="w-4 h-4 text-white" />
              </div>
              <h2>Центр Влияния</h2>
            </div>
            <p className="text-xs">Прогресс · Соревнования · Мотивация</p>
          </div>
        </div>

        {/* Скролльная область контента */}
        <div className="centre-scroll-area">
          <div className="centre-content space-y-5">
            {/* Карточка уровня с круговым прогресс-баром */}
            <CentreLevelCard />
            
            {/* Дневные цели */}
            <CentreDailyGoals />
            
            {/* Достижения */}
            <CentreAchievementsRow />
          </div>
        </div>
      </MirrorGradientContainer>
    </>
  );
}
```

### CentreBackground — Анимация с орбами

```tsx
// frontend/src/components/Centre/CentreBackground.tsx
import React from 'react';
import './CentreBackground.css';

const CentreBackground: React.FC = () => {
  return (
    <div className="centre-bg" aria-hidden="true">
      {/* 4 плывущих градиентных сферы */}
      <div className="centre-bg__orb centre-bg__orb--1" />  {/* Indigo */}
      <div className="centre-bg__orb centre-bg__orb--2" />  {/* Purple */}
      <div className="centre-bg__orb centre-bg__orb--3" />  {/* Blue */}
      <div className="centre-bg__orb centre-bg__orb--4" />  {/* Pink */}
      
      {/* Нойз-оверлей для текстуры */}
      <div className="centre-bg__noise" />
    </div>
  );
};
```

### CentreLevelCard — SVG прогресс-бар с рангом

```tsx
// frontend/src/components/Centre/CentreLevelCard.tsx
import { Flame, Crown, Star } from 'lucide-react';

const CentreLevelCard: React.FC = () => {
  const { userLevel } = useLevelProgress();
  
  const RANK_ICONS: Record<string, React.ReactNode> = {
    novice: <Sprout className="w-6 h-6 text-green-400" />,
    explorer: <Search className="w-6 h-6 text-yellow-400" />,
    traveler: <Compass className="w-6 h-6 text-blue-400" />,
    legend: <Star className="w-6 h-6 text-purple-400" />,
    geoblogger: <Crown className="w-6 h-6 text-amber-400" />,
  };

  const ringGradient = {
    novice: { from: '#9ca3af', to: '#d1d5db' },
    explorer: { from: '#eab308', to: '#22c55e' },
    traveler: { from: '#22c55e', to: '#3b82f6' },
    legend: { from: '#3b82f6', to: '#8b5cf6' },
    geoblogger: { from: '#8b5cf6', to: '#ec4899' },
  }[userLevel.rank];

  return (
    <div className="centre-glass-card h-full">
      <div className="flex items-center gap-5">
        {/* Круговой SVG прогресс-бар */}
        <svg width="96" height="96" viewBox="0 0 96 96" className="centre-level-ring">
          <defs>
            <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ringGradient.from} />
              <stop offset="100%" stopColor={ringGradient.to} />
            </linearGradient>
          </defs>
          
          {/* Фоновый круг */}
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          
          {/* Прогресс-бар с градиентом */}
          <circle 
            cx="48" cy="48" r="40" 
            fill="none" 
            stroke="url(#ring-gradient)" 
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
          
          {/* Аватар внутри */}
          <image href={avatarUrl} x="18" y="18" width="60" height="60" clipPath="url(#circle)" />
        </svg>

        {/* Информация справа */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {RANK_ICONS[userLevel.rank]}
            <h3 className="text-lg font-bold">{username}</h3>
          </div>
          
          <div className="text-sm text-gray-400">
            Уровень <span className="font-bold text-white">{userLevel.level}</span>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">{streak} дней</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 3. CSS Glass Theme

### _glass-theme.css стиль

```css
/* ============================================
   GLASS THEME — Единая система стекла
   ============================================ */

:root, [data-theme="light"] {
  /* --- Layer 1: контейнеры (панели, тулбары) --- */
  --glass-l1-bg: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
  --glass-l1-border: rgba(255,255,255,0.2);
  --glass-l1-shadow: 0 8px 32px rgba(0,0,0,0.1);

  /* --- Layer 2: кнопки, инпуты, чипсы --- */
  --glass-l2-bg: rgba(255,255,255,0.1);
  --glass-l2-border: rgba(255,255,255,0.2);
  --glass-l2-bg-hover: rgba(255,255,255,0.15);
  --glass-l2-border-hover: rgba(255,255,255,0.3);
  --glass-l2-shadow: 0 4px 12px rgba(0,0,0,0.15);

  /* --- Общие --- */
  --glass-blur: blur(10px) saturate(180%);
  --glass-text: rgba(0,0,0,0.8);
  --glass-text-secondary: rgba(0,0,0,0.5);
  --glass-radius: 20px;
}

[data-theme="dark"] {
  /* --- Layer 1 (тёмное) --- */
  --glass-l1-bg: linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 100%);
  --glass-l1-border: rgba(0,0,0,0.12);
  --glass-l1-shadow: 0 8px 32px rgba(0,0,0,0.1);

  /* --- Layer 2 (тёмное) --- */
  --glass-l2-bg: rgba(0,0,0,0.06);
  --glass-l2-border: rgba(0,0,0,0.12);
  --glass-l2-bg-hover: rgba(0,0,0,0.1);
  --glass-l2-border-hover: rgba(0,0,0,0.12);
  --glass-l2-shadow: none;

  /* --- Общие --- */
  --glass-blur: blur(10px) saturate(180%);
  --glass-text: rgba(255,255,255,0.92);
  --glass-text-secondary: rgba(255,255,255,0.65);
  --glass-radius: 20px;
}

/* Использование: */
.glass-l1 {
  background: var(--glass-l1-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-l1-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-l1-shadow);
  color: var(--glass-text);
}

.glass-l2 {
  background: var(--glass-l2-bg);
  border: 1px solid var(--glass-l2-border);
  box-shadow: var(--glass-l2-shadow);
}

.glass-l2:hover {
  background: var(--glass-l2-bg-hover);
  border-color: var(--glass-l2-border-hover);
}
```

---

## 4. Режимы (Modes) — CSS

### centre-mode для CentrePage

```css
/* frontend/src/styles/PageLayout.css (строка ~1694) */

.page-container.centre-mode {
  position: fixed !important;
  top: calc(64px + 1cm) !important;
  bottom: 1cm !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: calc(100vw - 56px - 1cm) !important;
  max-width: 1400px !important;

  /* Glass L1 стиль */
  background: var(--glass-l1-bg) !important;
  backdrop-filter: var(--glass-blur-strong) !important;
  border: 1px solid var(--glass-l1-border) !important;
  border-radius: var(--glass-radius) !important;
  box-shadow: var(--glass-l1-shadow) !important;
  color: var(--glass-text) !important;

  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  z-index: 1145 !important;
}

/* Заголовок */
.centre-static-header {
  position: relative !important;
  flex-shrink: 0 !important;
  padding: 16px 20px 12px 20px !important;
  border-bottom: 1px solid var(--glass-l2-border) !important;
  background: transparent !important;
  z-index: 10 !important;
}

.centre-static-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #4f46e5, #7c3aed, #9333ea);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Скролльная область */
.centre-scroll-area {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 16px 20px 30px 20px !important;
  scrollbar-width: none;
}

.centre-scroll-area::-webkit-scrollbar {
  display: none;
}

/* Карточки */
.centre-glass-card {
  background: var(--glass-card-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(255,255,255,0.35);
  border-radius: var(--glass-radius-sm);
  padding: 18px;
  box-shadow: var(--glass-shadow);
  transition: all 0.25s ease;
}

.centre-glass-card:hover {
  background: var(--glass-card-bg-hover);
  border-color: rgba(255,255,255,0.50);
  box-shadow: var(--glass-shadow-hover);
  transform: translateY(-1px);
}
```

### posts-mode для Posts.tsx

```css
/* frontend/src/styles/_content.css (строка ~157) */

.page-container.posts-mode .page-main-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;

  /* ТЕМНОЕ МАТОВОЕ СТЕКЛО */
  background: linear-gradient(135deg, rgba(34,38,48,0.85) 0%, rgba(46,52,68,0.82) 100%);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(5,8,15,0.5), 0 8px 20px rgba(10,14,25,0.35);

  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 16px;
  transition: background 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
```

---

## 5. CentreBackground — Анимация орбов

### CSS анимация плывущих сфер

```css
/* frontend/src/components/Centre/CentreBackground.css */

.centre-bg {
  position: fixed;
  inset: 0;
  z-index: 1; /* Ниже всех панелей */
  overflow: hidden;
  background: #0a0a1a;
  transition: background 0.5s ease;
}

:root[data-theme="light"] .centre-bg {
  background: #e8e6f0;
}

/* Базовые свойства орбов */
.centre-bg__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  will-change: transform;
  transform: translate3d(0, 0, 0);
}

/* Orb 1 — Indigo, верхний левый, 25s анимация */
.centre-bg__orb--1 {
  width: 45vw;
  height: 45vw;
  max-width: 600px;
  top: -10%;
  left: -5%;
  background: radial-gradient(circle, rgba(99,102,241,0.7) 0%, rgba(79,70,229,0.3) 50%, transparent 70%);
  animation: centre-orb-float-1 25s ease-in-out infinite;
}

/* Orb 2 — Purple, правый центр, 30s анимация */
.centre-bg__orb--2 {
  width: 40vw;
  height: 40vw;
  max-width: 550px;
  top: 20%;
  right: -8%;
  background: radial-gradient(circle, rgba(147,51,234,0.6) 0%, rgba(124,58,237,0.25) 50%, transparent 70%);
  animation: centre-orb-float-2 30s ease-in-out infinite;
}

/* Orb 3 — Blue, нижний левый, 28s анимация */
.centre-bg__orb--3 {
  width: 35vw;
  height: 35vw;
  max-width: 500px;
  bottom: -5%;
  left: 10%;
  background: radial-gradient(circle, rgba(59,130,246,0.5) 0%, rgba(37,99,235,0.2) 50%, transparent 70%);
  animation: centre-orb-float-3 28s ease-in-out infinite;
}

/* Orb 4 — Pink, нижний правый, 32s анимация */
.centre-bg__orb--4 {
  width: 38vw;
  height: 38vw;
  max-width: 520px;
  bottom: -3%;
  right: 5%;
  background: radial-gradient(circle, rgba(236,72,153,0.4) 0%, rgba(219,39,119,0.15) 50%, transparent 70%);
  animation: centre-orb-float-4 32s ease-in-out infinite;
}

/* Нойз-оверлей для текстуры */
.centre-bg__noise {
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml,...');
  opacity: 0.05;
  pointer-events: none;
}

/* Анимации плавающих орбов */
@keyframes centre-orb-float-1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(30px, -50px); }
  50% { transform: translate(-20px, -30px); }
  75% { transform: translate(40px, 20px); }
}

@keyframes centre-orb-float-2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-40px, 40px); }
  50% { transform: translate(30px, 50px); }
  75% { transform: translate(-50px, -30px); }
}

@keyframes centre-orb-float-3 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(50px, 30px); }
  50% { transform: translate(-30px, 40px); }
  75% { transform: translate(20px, -40px); }
}

@keyframes centre-orb-float-4 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-30px, -40px); }
  50% { transform: translate(40px, -20px); }
  75% { transform: translate(-40px, 30px); }
}

/* Пульсирующий legendary эффект */
@keyframes centre-legendary-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.05); }
}
```

---

## 6. MirrorGradientProvider использование

### Компонент в Post.tsx

```tsx
// frontend/src/pages/Posts.tsx (строка ~559)
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useThemeStore } from '../stores/themeStore';

const PostsPage: React.FC = () => {
  const { theme } = useThemeStore();
  const glassVariant = theme; // 'light' | 'dark'

  return (
    <MirrorGradientContainer className={`page-layout-container page-container posts-mode glass-${glassVariant}`}>
      {/* Содержимое постов */}
      <PageLayout>
        <PostCard {...post} />
      </PageLayout>
    </MirrorGradientContainer>
  );
};
```

### MirrorGradientProvider.tsx

```tsx
// frontend/src/components/MirrorGradientProvider.tsx

interface MirrorGradientContextType {
  panelCount: number;
  setPanelCount: React.Dispatch<React.SetStateAction<number>>;
  getGradientClass: () => string;
}

const MirrorGradientContext = createContext<MirrorGradientContextType | undefined>(undefined);

export const MirrorGradientProvider: React.FC<MirrorGradientProviderProps> = ({ children }) => {
  const [panelCount, setPanelCount] = useState(1);

  const getGradientClass = useCallback(() => {
    switch (panelCount) {
      case 1: return 'mirror-bg';
      case 2: return 'mirror-bg-2panels';
      case 3: return 'mirror-bg-3panels';
      case 4: return 'mirror-bg-4panels';
      default: return 'mirror-bg';
    }
  }, [panelCount]);

  return (
    <MirrorGradientContext.Provider value={{ panelCount, setPanelCount, getGradientClass }}>
      {children}
    </MirrorGradientContext.Provider>
  );
};

export const MirrorGradientContainer: React.FC<MirrorGradientContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  const context = useMirrorGradient();
  const gradientClass = context?.getGradientClass() || 'mirror-bg';
  
  return (
    <div className={`${gradientClass} ${className}`}>
      {children}
    </div>
  );
};
```

---

## 7. Stat-Cards для Activity.tsx

### Activity компонент

```tsx
// frontend/src/pages/Activity.tsx (строка ~44)
import { FaBell, FaComment, FaHeart } from 'react-icons/fa';

const ActivityStatsBlocks = React.memo(() => {
  const { stats, loading } = useActivityStats();
  
  return (
    <div className="stat-grid">
      {/* Синяя карточка */}
      <div className="stat-card blue">
        <div>
          <div className="text-2xl font-bold">{stats?.total_activities || 0}</div>
          <div className="text-blue-100 text-sm">Всего событий</div>
        </div>
        <FaBell className="text-2xl text-blue-200" />
      </div>
      
      {/* Оранжевая карточка */}
      <div className="stat-card orange">
        <div>
          <div className="text-2xl font-bold">{stats?.unread_activities || 0}</div>
          <div className="text-orange-100 text-sm">Непрочитанных</div>
        </div>
        <FaComment className="text-2xl text-orange-200" />
      </div>
      
      {/* Зелёная карточка */}
      <div className="stat-card green">
        <div>
          <div className="text-2xl font-bold">{stats?.message_activities || 0}</div>
          <div className="text-green-100 text-sm">Сообщений</div>
        </div>
        <FaHeart className="text-2xl text-green-200" />
      </div>
    </div>
  );
});
```

### CSS для stat-cards

```css
/* frontend/src/styles/_components.css (строка ~507) */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

/* Цветовые варианты */
.stat-card.blue {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #ffffff;
}

.stat-card.orange {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #ffffff;
}

.stat-card.green {
  background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
  color: #ffffff;
}

.stat-card.purple {
  background: linear-gradient(135deg, #a855f7 0%, #d946ef 100%);
  color: #ffffff;
}
```

---

## 📝 Стандартные паттерны

### Паттерн 1: Класс контейнера + mode

```tsx
<MirrorGradientContainer className="page-layout-container page-container posts-mode glass-dark">
  {children}
</MirrorGradientContainer>
```

### Паттерн 2: Glass панель с заголовком

```tsx
<GlassPanel>
  <GlassHeader title="Заголовок" onClose={handleClose} />
  <GlassButton>Кнопка</GlassButton>
  <GlassInput placeholder="Ввод" />
</GlassPanel>
```

### Паттерн 3: Centre-mode с фоном

```tsx
<>
  <CentreBackground />
  <MirrorGradientContainer className="centre-mode">
    <div className="centre-static-header">...</div>
    <div className="centre-scroll-area">
      <div className="centre-content">...</div>
    </div>
  </MirrorGradientContainer>
</>
```

---

## 🎨 Граница переходов между типами страниц

| Если вы добавляете | Используйте | Стиль |
|-------------------|-----------|-------|
| Интерактивная карта | `map-mode` | Glass L1/L2 |
| Посты/Блог | `posts-mode` | Dark glass |
| Планировщик | `planner-mode` | Glass поверх карты |
| Календарь событий | `calendar-mode` | Glass-панели |
| Центр Влияния | `centre-mode` | Glass + Orbs фон |
| Активность | `activity-mode` | Stat-cards |
| Чат | `chat-container` | Embossed |
