import { useMemo } from 'react';
import { useContentStore } from '../stores/contentStore';

/**
 * Определяет режим отображения карты на основе состояния приложения
 */
export const useMapDisplayMode = () => {
  const leftContent = useContentStore((state) => state.leftContent);
  const rightContent = useContentStore((state) => state.rightContent);
  const showBackgroundMap = useContentStore((state) => state.showBackgroundMap);
  const isMobile = useContentStore((state) => state.isMobile);

  return useMemo(() => {
    // Проверяем, активен ли Planner (использует Яндекс карту)
    const isPlannerActive = leftContent === 'planner';
    
    // Проверяем, активна ли карта (использует Leaflet)
    const isMapActive = leftContent === 'map';
    
    // Двухоконный режим - когда открыта правая панель
    const isTwoPanelMode = rightContent !== null && !isMobile;

    // ИСПРАВЛЕНО: Leaflet-карта видна как фон ТОЛЬКО когда Planner НЕ активен.
    // Когда Planner активен — он рендерит Яндекс-карту в #planner-map-container,
    // и Leaflet-портал (#global-map-root) не должен перекрывать его и перехватывать клики.
    // showBackgroundMap — единственный способ скрыть фоновый Leaflet через настройки.
    const shouldShowFullscreen = isMapActive || (showBackgroundMap && !isPlannerActive);

    return {
      // Использовать Leaflet карту (не Яндекс)
      shouldUseLeaflet: !isPlannerActive,
      
      // Показывать карту на полном экране
      shouldShowFullscreen,
      
      // Режимы
      isPlannerActive,
      isMapActive,
      isTwoPanelMode,
      
      // Текущий тип карты
      mapProvider: isPlannerActive ? 'yandex' : 'leaflet',
      
      // Отступы для карты
      mapTop: isTwoPanelMode ? '70px' : '0px', // В двухоконном режиме - отступ под хедер
      
      // Класс для контейнера
      containerClass: isTwoPanelMode 
        ? 'facade-map-root two-panel-mode' 
        : 'facade-map-root',
    };
  }, [leftContent, rightContent, showBackgroundMap, isMobile]);
}

export default useMapDisplayMode;
