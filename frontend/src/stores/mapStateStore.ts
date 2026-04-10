/**
 * @file mapStateStore.ts
 * @description Централизованное хранилище для состояния карты
 * 
 * РЕШАЕМЫЕ ПРОБЛЕМЫ:
 * 1. Состояние карты (center, zoom) теряется при переключении между Map и Planner
 * 2. Маркеры не сохраняются при смене рендерера
 * 3. Две разные инициализации карты конфликтуют друг с другом
 * 
 * АРХИТЕКТУРА:
 * - Map и Planner используют РАЗНЫЕ контексты (osm и planner)
 * - Каждый контекст имеет своё сохранённое состояние
 * - При переключении между страницами состояние восстанавливается
 * - Маркеры кэшируются и автоматически переотрисовываются
 */

import { create } from 'zustand';
import { MarkerData } from '../types/marker';

// Состояние для одного контекста карты
interface MapContextState {
    center: [number, number];
    zoom: number;
    // Маркеры сохраняем отдельно для каждого контекста
    markers?: any[];
    // Флаг инициализации
    initialized: boolean;
    // ID контейнера
    containerId?: string;
}

// Глобальное состояние всех карт
interface MapStateStore {
    // Состояние для каждого контекста
    contexts: {
        osm: MapContextState;      // Map.tsx
        planner: MapContextState;  // Planner.tsx
        offline: MapContextState;  // Offline режим
    };

    // Глобальные маркеры (общие для всех контекстов)
    globalMarkers: any[];

    // Флаг первичной загрузки маркеров
    markersLoaded: boolean;

    // Активный контекст
    activeContext: 'osm' | 'planner' | 'offline';

    // Методы
    setContextState: (context: 'osm' | 'planner' | 'offline', state: Partial<MapContextState>) => void;
    getContextState: (context: 'osm' | 'planner' | 'offline') => MapContextState;
    setActiveContext: (context: 'osm' | 'planner' | 'offline') => void;

    // Управление маркерами
    setGlobalMarkers: (markers: any[]) => void;
    getGlobalMarkers: () => any[];

    // Сохранение/восстановление состояния
    saveCurrentState: (context: 'osm' | 'planner' | 'offline', center: [number, number], zoom: number) => void;
    restoreState: (context: 'osm' | 'planner' | 'offline') => MapContextState | null;

    // Флаг готовности
    setMarkersLoaded: (loaded: boolean) => void;
}

// Значения по умолчанию для центра карты (Владимир, Россия)
const DEFAULT_CENTER: [number, number] = [56.1366, 40.3966];
const DEFAULT_ZOOM = 12;

export const useMapStateStore = create<MapStateStore>((set, get) => ({
    contexts: {
        osm: {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            initialized: false,
        },
        planner: {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            initialized: false,
        },
        offline: {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            initialized: false,
        },
    },

    globalMarkers: [],
    markersLoaded: false,
    activeContext: 'osm',

    setContextState: (context, state) => set((prev) => ({
        contexts: {
            ...prev.contexts,
            [context]: {
                ...prev.contexts[context],
                ...state,
            },
        },
    })),

    getContextState: (context) => get().contexts[context],

    setActiveContext: (context) => set({ activeContext: context }),

    setGlobalMarkers: (markers) => set({
        globalMarkers: markers,
        markersLoaded: markers.length > 0
    }),

    getGlobalMarkers: () => get().globalMarkers,

    saveCurrentState: (context, center, zoom) => {
        console.log(`[MapStateStore] Saving state for ${context}:`, { center, zoom });
        set((prev) => ({
            contexts: {
                ...prev.contexts,
                [context]: {
                    ...prev.contexts[context],
                    center,
                    zoom,
                    initialized: true,
                },
            },
        }));
    },

    restoreState: (context) => {
        const state = get().contexts[context];
        if (state.initialized) {
            console.log(`[MapStateStore] Restoring state for ${context}:`, { center: state.center, zoom: state.zoom });
            return state;
        }
        return null;
    },

    setMarkersLoaded: (loaded) => set({ markersLoaded: loaded }),
}));

// Хелперы для работы с состоянием
export const mapStateHelpers = {
    /**
     * Получить текущий центр и зум для контекста
     * КРИТИЧНО: Если planner контекст не инициализирован, берём состояние из osm
     */
    getCenterAndZoom: (context: 'osm' | 'planner' | 'offline'): { center: [number, number]; zoom: number } => {
        const state = useMapStateStore.getState().contexts[context];
        
        // Если контекст не инициализирован и это planner, пробуем взять состояние из osm
        if (!state.initialized && context === 'planner') {
            const osmState = useMapStateStore.getState().contexts['osm'];
            if (osmState.initialized) {
                console.log('[mapStateHelpers] planner not initialized, using osm state');
                return {
                    center: osmState.center || DEFAULT_CENTER,
                    zoom: osmState.zoom || DEFAULT_ZOOM,
                };
            }
        }
        
        return {
            center: state.center || DEFAULT_CENTER,
            zoom: state.zoom || DEFAULT_ZOOM,
        };
    },

    /**
     * Проверить, инициализирован ли контекст
     */
    isInitialized: (context: 'osm' | 'planner' | 'offline'): boolean => {
        return useMapStateStore.getState().contexts[context].initialized;
    },

    /**
     * Получить все глобальные маркеры
     */
    getMarkers: (): any[] => {
        return useMapStateStore.getState().globalMarkers;
    },

    /**
     * Сохранить маркеры глобально
     */
    setMarkers: (markers: any[]): void => {
        useMapStateStore.getState().setGlobalMarkers(markers);
    },
};

export default useMapStateStore;
