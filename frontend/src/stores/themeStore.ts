import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;            // текущая фактическая тема
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('geoblog-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
};

const applyTheme = (theme: ThemeMode) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('geoblog-theme', theme);
};

// helper for legacy code; compute based on map context if needed
export const computeTheme = (isMap: boolean): ThemeMode => {
  return isMap ? 'light' : 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => {
  // Apply initial theme when store is created
  const initialTheme = getInitialTheme();
  if (typeof document !== 'undefined') {
    applyTheme(initialTheme);
  }

  return {
    theme: initialTheme,
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    toggleTheme: () => {
      const { theme: oldTheme } = get();
      const newTheme: ThemeMode = oldTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      set({ theme: newTheme });
    },
  };
});
