# 📖 Рекомендации для работы с визуализацией GEO-Blog

## Как выбрать стиль для новой страницы

### ✨ Используйте GLASSMORPHISM если:
1. Страница **интерактивная** (требует фильтров, выбора, действий)
2. Нужна **двухслойная система** (панели слева/справа)
3. Контент **динамически меняется** (лента, карта, список)
4. Требуется **визуальная связь** с картой или другим контентом

**Примеры:** Map.tsx, Posts.tsx, Calendar.tsx, Chat.tsx

**Как создать:**
```tsx
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { GlassPanel, GlassHeader, GlassButton } from '../components/Glass';

export const MyPage: React.FC = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => unregisterPanel();
  }, [registerPanel, unregisterPanel]);

  return (
    <MirrorGradientContainer className="page-layout-container page-container my-mode">
      <GlassPanel>
        <GlassHeader title="Заголовок" />
        <GlassButton>Кнопка</GlassButton>
      </GlassPanel>
    </MirrorGradientContainer>
  );
};
```

---

### 🎮 Используйте ИГРОВОЙ СТИЛЬ если:
1. Страница **статичная** (не требует постоянного взаимодействия)
2. **Геймификационный контент** (уровни, достижения, очки)
3. Хотите **выделить визуально** (от остальных страниц)
4. Нужна **спецэффекты** (анимации, gradients, particle effects)

**Примеры:** CentrePage.tsx (единственная с этим стилем)

**Как создать (максимум усилий):**
```tsx
import CentreBackground from '../components/Centre/CentreBackground';

export const MyGamePage: React.FC = () => {
  return (
    <>
      {/* Анимированный фон */}
      <CentreBackground />
      
      {/* Glass-панель поверх */}
      <MirrorGradientContainer className="centre-mode">
        {/* Специальные game-карточки */}
        <div className="centre-glass-card">
          {/* Контент */}
        </div>
      </MirrorGradientContainer>
    </>
  );
};
```

---

## Архитектурные решения при дизайне

### 1. Выбираем MODE (режим страницы)

```css
/* Существующие режимы в _modes.css / PageLayout.css */

.page-container.map-mode       /* Full viewport, transparent bg */
.page-container.posts-mode     /* Dark glass, z-index: overlay */
.page-container.planner-mode   /* 100vh, Yandex Maps */
.page-container.calendar-mode  /* Glass-панели */
.page-container.chat-container /* Embossed эффект */
.page-container.centre-mode    /* Fixed glass + orbs bg */
.page-container.activity-mode  /* Stat-cards */
.page-container.favorites-mode /* Glass, как posts */

/* Не добавляйте новый mode, используйте существующий! */
```

**Если не подходит ни один** → обсудите с командой + добавьте в `_modes.css`

---

### 2. Выбираем цветовую схему

```tsx
// Light (по умолчанию)
const theme = 'light';

// Dark
const theme = 'dark';
```

**Переключение в компоненте:**
```tsx
const { theme } = useThemeStore();

<MirrorGradientContainer className={`posts-mode glass-${theme}`}>
  {/* theme = 'light' | 'dark' → CSS автоматически переключит все переменные */}
</MirrorGradientContainer>
```

---

### 3. Выбираем Glass-слой

| Слой | HTML | CSS класс | Blur | Для чего |
|------|------|-----------|------|----------|
| **L1** | `<GlassPanel>` | `.glass-l1` | 10px | Панели, контейнеры, попапы |
| **L2** | `<GlassButton>` | `.glass-l2` | - | Кнопки, инпуты, чипсы |

```tsx
// L1: контейнер
<GlassPanel>
  {/* L2: элементы */}
  <GlassButton>Click</GlassButton>
  <GlassInput placeholder="Type..." />
</GlassPanel>
```

```css
/* Если нужно вручную */
.my-container {
  background: var(--glass-l1-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-l1-border);
  border-radius: var(--glass-radius);
}

.my-button {
  background: var(--glass-l2-bg);
  border: 1px solid var(--glass-l2-border);
}

.my-button:hover {
  background: var(--glass-l2-bg-hover);
  border-color: var(--glass-l2-border-hover);
}
```

---

## Типичные сценарии

### Сценарий 1: Добавить новый фильтр на Map

```tsx
// components/Map/MyNewFilter.tsx
import { GlassPanel, GlassHeader, GlassButton, GlassInput } from '../Glass';

export const MyNewFilter: React.FC = () => {
  return (
    <GlassPanel className="my-filter-panel"> {/* ← L1 */}
      <GlassHeader title="Новый фильтр" />
      <GlassInput placeholder="Поиск..." /> {/* ← L2 */}
      <GlassButton onClick={() => {}}>Применить</GlassButton> {/* ← L2 */}
    </GlassPanel>
  );
};
```

```tsx
// pages/Map.tsx
<MapPage>
  <MapFilters>
    <MyNewFilter /> {/* ← Добавляем сюда */}
  </MapFilters>
</MapPage>
```

---

### Сценарий 2: Добавить новое достижение на CentrePage

```tsx
// components/Centre/MyAchievement.tsx
export const MyAchievement: React.FC<{rarity: 'common' | 'rare' | 'epic' | 'legendary'}> = ({rarity}) => {
  return (
    <div className={`centre-glass-card centre-rarity-${rarity}`}>
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6" /> {/* ← Lucide icon */}
        <div>
          <h4>Мое достижение</h4>
          <p className="text-sm">Описание</p>
        </div>
      </div>
    </div>
  );
};
```

```tsx
// components/Centre/CentreAchievementsRow.tsx
<CentreAchievementsRow>
  <MyAchievement rarity="epic" /> {/* ← Добавляем сюда */}
</CentreAchievementsRow>
```

---

### Сценарий 3: Создать новую интерактивную страницу

**Структура:**
```
frontend/src/pages/
├── MyPage.tsx              ← Основной файл
└── ../components/MyPage/
    ├── MyPagePanel.tsx     ← Панель с фильтрами
    ├── MyPageContent.tsx   ← Контент
    └── MyPage.css          ← Стили
```

**MyPage.tsx:**
```tsx
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import MyPagePanel from '../components/MyPage/MyPagePanel';
import MyPageContent from '../components/MyPage/MyPageContent';

const MyPage: React.FC = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => unregisterPanel();
  }, [registerPanel, unregisterPanel]);

  return (
    <MirrorGradientContainer className="page-layout-container page-container my-page-mode">
      <MyPagePanel />
      <MyPageContent />
    </MirrorGradientContainer>
  );
};
```

**MyPagePanel.tsx:**
```tsx
import { GlassPanel, GlassHeader, GlassButton } from '../Glass';

const MyPagePanel: React.FC = () => {
  return (
    <GlassPanel className="my-page-panel">
      <GlassHeader title="Мой фильтр" />
      {/* Содержимое */}
    </GlassPanel>
  );
};
```

**my-page-mode.css:**
```css
.page-container.my-page-mode {
  padding: 28px;
}

.page-container.my-page-mode .my-page-panel {
  position: relative;
  z-index: 100;
}
```

---

## Частые ошибки и как их избежать

### ❌ Ошибка 1: Добавить новый режим вместо использования существующего

```tsx
// ❌ НЕПРАВИЛЬНО
<MirrorGradientContainer className="page-layout-container page-container brand-new-mode">
  {/* Это создаст неконсистентный дизайн */}
</MirrorGradientContainer>

// ✅ ПРАВИЛЬНО
<MirrorGradientContainer className="page-layout-container page-container posts-mode">
  {/* Используем существующий режим */}
</MirrorGradientContainer>
```

### ❌ Ошибка 2: Забыть вызвать `usePanelRegistration`

```tsx
// ❌ НЕПРАВИЛЬНО
const MyPage: React.FC = () => {
  return (
    <MirrorGradientContainer>
      {/* МирrorGradient не узнает про панель */}
    </MirrorGradientContainer>
  );
};

// ✅ ПРАВИЛЬНО
const MyPage: React.FC = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => unregisterPanel();
  }, [registerPanel, unregisterPanel]);

  return (
    <MirrorGradientContainer>
      {/* Gradients адаптируются правильно */}
    </MirrorGradientContainer>
  );
};
```

### ❌ Ошибка 3: Вручную стилизовать вместо использования Glass-компонентов

```tsx
// ❌ НЕПРАВИЛЬНО
<button style={{
  background: 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.2)',
  // ... много кода
}}>
  Click
</button>

// ✅ ПРАВИЛЬНО
<GlassButton>Click</GlassButton>

// Если GlassButton не подходит:
<button className="glass-l2">Click</button>
```

### ❌ Ошибка 4: Не использовать CSS переменные

```css
/* ❌ НЕПРАВИЛЬНО */
.my-panel {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  /* Не переключится при смене темы! */
}

/* ✅ ПРАВИЛЬНО */
.my-panel {
  background: var(--glass-l1-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-l1-border);
  color: var(--glass-text);
  /* Автоматически переключится при смене темы */
}
```

### ❌ Ошибка 5: Забыть `data-theme` атрибут

```tsx
// ❌ НЕПРАВИЛЬНО
<html>
  <body>
    <App />
  </body>
</html>
<!-- Theme CSS переменные не применятся -->

// ✅ ПРАВИЛЬНО (в index.html или управляется через useTheme)
<html data-theme="light">
  <body>
    <App />
  </body>
</html>
```

---

## Стандартные значения для новых компонентов

### Для Glass-панелей
```css
--glass-l1-bg:       linear-gradient(135deg, 
                      rgba(255,255,255,0.1) 0%, 
                      rgba(255,255,255,0.05) 100%);
--glass-l1-border:   rgba(255,255,255,0.2);
--glass-l1-shadow:   0 8px 32px rgba(0,0,0,0.1);
--glass-blur:        blur(10px) saturate(180%);
--glass-radius:      20px;
```

### Для Glass-контролов (L2)
```css
--glass-l2-bg:       rgba(255,255,255,0.1);
--glass-l2-border:   rgba(255,255,255,0.2);
--glass-l2-shadow:   0 4px 12px rgba(0,0,0,0.15);
--glass-radius-sm:   12px;
```

### Для text
```css
--glass-text:        rgba(0,0,0,0.8);          /* Light mode */
--glass-text:        rgba(255,255,255,0.92);   /* Dark mode */
--glass-text-secondary: rgba(0,0,0,0.5);
--glass-text-muted:  rgba(0,0,0,0.35);
```

---

## Тестирование визуализации

### Проверка темы
```tsx
// App.tsx / main.tsx
import { useTheme } from './contexts/ThemeContext';

// Тестируем переключение
<button onClick={() => toggleTheme()}>Toggle Theme</button>

// Проверяем результат
console.log(document.documentElement.getAttribute('data-theme'));
```

### Проверка glassmorphism
```tsx
// Должны видеть размытый background позади glass панели
// 1. Light режим: светлое стекло поверх светлого фона
// 2. Dark режим: тёмное стекло поверх тёмного фона
// 3. Gradient от цветов в левом верхнем углу
```

### Проверка центра влияния
```tsx
// Должны видеть:
// 1. Четыре плывущих орба в фоне (разные цвета)
// 2. Glass-панель поверх них с заголовком
// 3. Круговой прогресс-бар с иконкой ранга
// 4. Достижения с цветовыми эффектами
```

---

## Когда обновлять стили

### Обновляйте `_glass-theme.css` если:
- Нужно изменить **базовые значения blur/radius** для всех glass-компонентов
- Меняется **цветовая схема** light/dark/emerald
- Добавляется **новая тема**

### Обновляйте `_modes.css` если:
- Добавляется **новый режим страницы**
- Меняется **z-index** между лайерами
- Нужны **специальные позиционирование** для нового режима

### Обновляйте `PageLayout.css` если:
- Добавляется **centre-mode** стиль
- Меняется **activity-mode** внешний вид
- Нужны **специальные стили** для других режимов

### Обновляйте компоненты `Glass/` если:
- Нужно **добавить новый компонент** (GlassDropdown и т.д.)
- Меняется **поведение** существующих компонентов
- Требуется **новый props** для кастомизации

---

## Верификация списка

Перед коммитом новой страницы убедитесь:

- [ ] Используется `MirrorGradientContainer`
- [ ] Вызывается `usePanelRegistration()` хук
- [ ] Используются Glass-компоненты (или `.glass-l1/l2` классы)
- [ ] CSS переменные используются (не hardcoded значения)
- [ ] Работает теневое переключение light/dark/emerald
- [ ] Нет scroll-overflow (`overflow-y: auto` оборачивается в контейнер)
- [ ] Z-index согласован с другими слоями
- [ ] Мобильная адаптация (if нужна тёмная версия)
- [ ] Нет redundant режимов (используется существующий)
- [ ] IconSet согласован с проектом (Fa, Lucide icons)
