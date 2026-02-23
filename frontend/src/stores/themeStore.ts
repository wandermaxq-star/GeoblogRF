import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('geoblog-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'light';
};

const applyTheme = (theme: ThemeMode) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('geoblog-theme', theme);
};

export const useThemeStore = create<ThemeState>((set, get) => {
  // Применяем начальную тему при создании store
  const initial = getInitialTheme();
  if (typeof document !== 'undefined') {
    applyTheme(initial);
  }

  return {
    theme: initial,
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    toggleTheme: () => {
      const next = get().theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      set({ theme: next });
    },
  };
});
