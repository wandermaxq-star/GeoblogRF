import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ContentId = string | null;

export type ContentType =
  | 'map'
  | 'planner'
  | 'calendar'
  | 'posts'
  | 'chat'
  | 'feed'
  | 'friends'
  | 'profile'
  | 'test'
  | null;

export interface ContentState {
  // Состояние панелей
  leftContent: ContentType;
  rightContent: ContentType;

  // Мобильная версия
  isMobile: boolean;

  // Показывать ли карту на фоне (если false — карта скрывается)
  showBackgroundMap: boolean;
  setShowBackgroundMap: (show: boolean) => void;

  // Методы для управления левой панелью
  setLeftContent: (content: ContentType) => void;
  openLeftPanel: (content: ContentType) => void;
  closeLeftPanel: () => void;
  toggleLeftPanel: (content: ContentType) => void;

  // Методы для управления правой панелью
  setRightContent: (content: ContentType) => void;
  openRightPanel: (content: ContentType) => void;
  closeRightPanel: () => void;
  toggleRightPanel: (content: ContentType) => void;

  // Методы для управления мобильной версией
  setIsMobile: (isMobile: boolean) => void;

  // Сброс всех панелей
  resetAllPanels: () => void;

  // Получить активный контент (для мобильной версии)
  getActiveContent: () => ContentType;
}

// Правило: что-то одно всегда активно
// Если закрываем правую панель и нет левой - открываем посты
// Если закрываем левую панель и нет правой - открываем посты

export const useContentStore = create<ContentState>()(
  subscribeWithSelector((set, get) => ({
    // Начальное состояние - карта открыта сразу для быстрой загрузки
    leftContent: 'map',
    rightContent: null,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    // По умолчанию показываем карту на фоне (можно скрыть через setShowBackgroundMap)
    showBackgroundMap: true,

    // Установка левого контента
    setLeftContent: (content: ContentType) => {
      set({ leftContent: content });
    },

    // Открытие левой панели
    openLeftPanel: (content: ContentType) => {
      if (!content) return;
      set({ leftContent: content });
    },

    // Закрытие левой панели
    closeLeftPanel: () => {
      set({ leftContent: null });
    },

    // Переключение левой панели
    toggleLeftPanel: (content: ContentType) => {
      const state = get();
      const current = state.leftContent;

      // Если уже активна - закрываем
      if (current === content) {
        set({ leftContent: null });
        return;
      }

      // Открываем новую панель
      set({ leftContent: content });
    },

    // Установка правого контента
    // КРИТИЧНО: Синхронное обновление
    setRightContent: (content: ContentType) => {
      set({ rightContent: content });
    },

    // Открытие правой панели
    // КРИТИЧНО: Синхронное обновление
    openRightPanel: (content: ContentType) => {
      if (!content) return;
      set({ rightContent: content });
    },

    // Закрытие правой панели — теперь разрешаем закрывать всегда
    // чтобы пользователь мог оставить только карту на экране.
    closeRightPanel: () => {
      set({ rightContent: null });
    },

    // Переключение правой панели
    // КРИТИЧНО: Синхронное обновление
    toggleRightPanel: (content: ContentType) => {
      const state = get();
      const current = state.rightContent;

      // Если текущая панель совпадает с запрошенной — закрываем её
      if (current === content) {
        set({ rightContent: null });
        return;
      }

      // Иначе открываем новую правую панель
      set({ rightContent: content });
    },

    // Установка мобильной версии
    setIsMobile: (isMobile: boolean) => {
      set({ isMobile });
    },

    // Сброс всех панелей
    // КРИТИЧНО: Синхронное обновление
    resetAllPanels: () => {
      set({ leftContent: null, rightContent: null });
    },

    // Показывать/скрывать фоновую карту
    setShowBackgroundMap: (show: boolean) => {
      set({ showBackgroundMap: show });
    },

    // Получить активный контент (для мобильной версии)
    getActiveContent: () => {
      const { leftContent, rightContent, isMobile } = get();
      if (isMobile) {
        // На мобильной версии показываем только один контент
        return rightContent || leftContent;
      }
      // На десктопе возвращаем правый контент
      return rightContent;
    },
  }))
);

// Инициализация мобильной версии при загрузке
if (typeof window !== 'undefined') {
  const checkMobile = () => {
    // Используем setTimeout для асинхронного обновления
    setTimeout(() => {
      useContentStore.getState().setIsMobile(window.innerWidth < 768);
    }, 0);
  };

  checkMobile();
  window.addEventListener('resize', checkMobile);
}

