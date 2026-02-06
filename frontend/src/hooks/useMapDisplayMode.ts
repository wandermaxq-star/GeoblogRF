import { useMemo } from 'react';
import { useContentStore } from '../stores/contentStore';

/**
 * Определяет режим отображения карты на основе состояния приложения
 */
export const useMapDisplayMode = () => {
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const showBackgroundMap = useContentStore((state) => state.showBackgroundMap);

  return useMemo(() => {
    // Проверяем, активен ли Planner (использует Яндекс карту)
    const isPlannerActive = leftContent === 'planner';
    
    // Проверяем, активна ли карта (использует Leaflet)
    const isMapActive = leftContent === 'map';
    
    // Двухоконный режим - когда открыта правая панель
    const isTwoPanelMode = rightContent !== null;

    // Карта на полном экране по умолчанию, но может быть скрыта специальным флагом
    // Прежняя логика скрывала карту если открыты только posts + activity — это ломало фон.
    const isOnlyPostsAndActivity = 
      rightContent === 'posts' && 
      leftContent !== 'map' && 
      leftContent !== 'planner' &&
      !isMapActive;

    // ИСПРАВЛЕНО: Карта должна быть видна и интерактивна всегда когда
    // leftContent === 'map' или isPlannerActive, независимо от showBackgroundMap.
    // showBackgroundMap влияет только на фоновый режим (когда карта НЕ является активным контентом).
    const shouldShowFullscreen = isMapActive || isPlannerActive || (showBackgroundMap && !isOnlyPostsAndActivity);

    return {
      // Использовать Leaflet карту (не Яндекс)
      shouldUseLeaflet: !isPlannerActive,
      
      // Показывать карту на полном экране
      shouldShowFullscreen,
      
      // Режимы
      isPlannerActive,
      isMapActive,
      isTwoPanelMode,
      isOnlyPostsAndActivity,
      
      // Текущий тип карты
      mapProvider: isPlannerActive ? 'yandex' : 'leaflet',
      
      // Отступы для карты
      mapTop: isTwoPanelMode ? '70px' : '0px', // В двухоконном режиме - отступ под хедер
      
      // Класс для контейнера
      containerClass: isTwoPanelMode 
        ? 'facade-map-root two-panel-mode' 
        : 'facade-map-root',
    };
  }, [leftContent, rightContent, showBackgroundMap]);
}

export default useMapDisplayMode;
