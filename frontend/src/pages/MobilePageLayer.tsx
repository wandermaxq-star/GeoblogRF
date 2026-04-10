import React, { useEffect, useRef } from 'react';
import { useContentStore } from '../stores/contentStore';
import MobileMapPage from './Mobile/MapPage';
import MobilePlannerPage from './Mobile/PlannerPage';

/**
 * MobilePageLayer - контейнер для мобильных страниц Map и Planner
 * 
 * Аналог десктопного PageLayer: рендерит обе страницы одновременно,
 * но скрывает неактивную через visibility: hidden вместо размонтирования.
 * 
 * Это обеспечивает:
 * - Сохранение состояния карт при переходах /map ↔ /planner
 * - Предотвращение повторной инициализации Yandex/Leaflet карт
 * - Единую архитектуру с десктопом через contentStore
 */
const MobilePageLayer: React.FC = () => {
  const leftContent = useContentStore((state: { leftContent: string | null }) => state.leftContent);
  
  // Определяем какая страница активна
  const isMapActive = leftContent === 'map';
  const isPlannerActive = leftContent === 'planner';
  
  // Ref для отслеживания предыдущего состояния (для логирования)
  const prevContentRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (prevContentRef.current !== leftContent) {
      console.log('[MobilePageLayer] leftContent changed:', prevContentRef.current, '→', leftContent);
      prevContentRef.current = leftContent;
    }
  }, [leftContent]);
  
  // Управление видимостью Leaflet портала (#global-map-root)
  // Leaflet карта должна быть видна только когда Map активен
  // Когда Planner активен - скрываем Leaflet, чтобы Yandex карта была поверх
  useEffect(() => {
    const leafletPortal = document.getElementById('global-map-root');
    if (!leafletPortal) return;
    
    if (isPlannerActive) {
      // Скрываем Leaflet когда Planner активен
      leafletPortal.style.pointerEvents = 'none';
      leafletPortal.style.visibility = 'hidden';
    } else if (isMapActive) {
      // Показываем Leaflet когда Map активен
      leafletPortal.style.pointerEvents = 'auto';
      leafletPortal.style.visibility = 'visible';
    }
  }, [isMapActive, isPlannerActive]);
  
  // Обе страницы всегда смонтированы, видимость управляется через CSS
  // Это ключевое отличие от предыдущей реализации: страницы НЕ размонтируются
  
  return (
    <div className="relative w-full h-full">
      {/* Mobile Map Page - скрыта когда не активна */}
      <div 
        style={{ 
          visibility: isMapActive ? 'visible' : 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: isMapActive ? 'auto' : 'none',
        }}
      >
        <MobileMapPage />
      </div>
      
      {/* Mobile Planner Page - скрыт когда не активен */}
      <div 
        style={{ 
          visibility: isPlannerActive ? 'visible' : 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: isPlannerActive ? 'auto' : 'none',
        }}
      >
        <MobilePlannerPage />
      </div>
    </div>
  );
};

export default MobilePageLayer;
