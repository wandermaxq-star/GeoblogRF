import styled, { css, createGlobalStyle } from 'styled-components';

// Типы для пропсов
interface MapContainerProps {
  $isFullscreen?: boolean;
  $isTwoPanel?: boolean;
}

export const MapContainer = styled.div<MapContainerProps>`
  /* Располагаем карту фиксированно под шапкой и растягиваем на весь экран */
  position: fixed !important;
  top: var(--facade-map-top, 0px);
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: calc(100vh - var(--facade-map-top, 0px)) !important;
  min-height: 320px;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  z-index: 0;
  will-change: transform;
  pointer-events: auto;
  max-width: none !important;
  overflow: visible !important;

  /* Двухоконный режим - карта занимает всю ширину левой панели */
  ${props => props.$isTwoPanel && css`
    width: 100% !important;
    height: calc(100vh - var(--facade-map-top, 0px)) !important;
    right: auto !important;
  `}

  /* Полноэкранный режим (по умолчанию) */
  ${props => props.$isFullscreen && css`
    width: 100vw !important;
    height: calc(100vh - var(--facade-map-top, 0px)) !important;
  `}

  /* Класс для скрытия карты (только Posts + Activity) */
  &.map-hidden {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  /* Двухоконный режим */
  &.two-panel-mode {
    width: 100% !important;
    height: calc(100vh - var(--facade-map-top, 0px)) !important;
    
    /* Leaflet контейнер в двухоконном режиме */
    .leaflet-container {
      width: 100% !important;
      height: 100% !important;
    }
  }

  /* Однооконный режим (полный экран) */
  &.single-panel-mode {
    width: 100vw !important;
    height: calc(100vh - var(--facade-map-top, 0px)) !important;
    
    /* Leaflet контейнер в полноэкранном режиме */
    .leaflet-container {
      width: 100vw !important;
      height: calc(100vh - var(--facade-map-top, 0px)) !important;
    }
  }
`;

// MapContainerClasses больше не используется - объединён в MapContainer
export const MapContainerClasses = styled.div``;

export const MapWrapper = styled.div.attrs(() => ({
  // Убеждаемся, что элемент имеет правильные атрибуты
}))`
  width: 100%;
  height: 100%;
  min-height: 400px;
  margin: 0 !important;
  padding: 0 !important;
  top: 0 !important;
  left: 0 !important;
  background: transparent !important;

  .marker-cluster-custom {
    background: none;
    border: none;
  }

  .marker-cluster {
    background: #3498db;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
    width: 40px;
    height: 40px;
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  /* Стили для временной метки - черно-белая стильная иконка */
  .temp-marker-icon {
    background-color: rgba(0, 0, 0, 0.7);
    width: 25px;
    height: 25px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    color: white;
    font-weight: bold;
  }

  .custom-marker {
    .marker-content {
      padding: 8px;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);

      &.light {
        background: white;
        color: #333;
      }

      &.dark {
        background: #2c3e50;
        color: white;
      }

      .marker-title {
        font-weight: bold;
        margin-bottom: 4px;
      }

      .marker-description {
        font-size: 12px;
      }
    }
  }
`;

export const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .loading-content {
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const ErrorMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
  z-index: 1000;

  button {
    margin-top: 10px;
    padding: 8px 16px;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: #2980b9;
    }
  }
`;

// Определяем стили для оберток Leaflet попапа, используя класс custom-marker-popup
export const CustomPopupStyles = styled.div`
  // Этот компонент не будет рендериться, он только для определения глобальных/областных стилей
  // Применяем эти стили к попапу, используя его класс
  &.custom-marker-popup {
    .leaflet-popup-content-wrapper {
      padding: 0 !important; /* Убираем стандартный отступ Leaflet */
      border-radius: 8px !important; /* Применяем скругление ко всем углам */
      background: #fff; /* Белый фон */
      box-shadow: 0 3px 14px rgba(0,0,0,0.4);
      pointer-events: auto; /* Позволяем взаимодействовать с содержимым */
      width: 240px; /* Жестко задаем ширину обертки (примерно A4) */
      max-height: none !important;
      overflow: visible !important;
      transform: translateZ(0); /* Аппаратное ускорение */
      will-change: transform; /* Оптимизация для анимаций */
      transition: all 0.3s ease;
    }

    &.selected .leaflet-popup-content-wrapper {
      border: 2px solid #ff9800;
      box-shadow: 0 0 12px 2px #ff9800, 0 0 20px 4px rgba(255, 152, 0, 0.3);
      animation: popupGlowing 2s ease-in-out infinite alternate;
      border-radius: 8px !important; /* Сохраняем скругление для выбранных попапов */
    }

    @keyframes popupGlowing {
      from {
        box-shadow: 0 0 12px 2px #ff9800, 0 0 20px 4px rgba(255, 152, 0, 0.3);
      }
      to {
        box-shadow: 0 0 16px 3px #ff9800, 0 0 30px 6px rgba(255, 152, 0, 0.5);
      }
    }

    .leaflet-popup-content {
      margin: 0 !important; /* Убираем внутренний отступ */
      padding: 16px !important; /* Добавляем внутренние отступы для контента внутри попапа */
      width: 100% !important; /* Контент занимает всю доступную ширину обертки */
      display: flex !important; /* Используем flexbox для вертикального расположения содержимого */
      flex-direction: column !important;
      max-height: 300px !important; /* Задаем максимальную высоту (можно будет настроить) */
      overflow-y: auto !important; /* Включаем прокрутку по вертикали */
      box-sizing: border-box; /* Учитываем padding и border в размере */
    }

    /* Убираем стили с самого внешнего .leaflet-popup, если они там были применены */
    &.leaflet-popup {
      max-height: none !important;
      overflow-y: visible !important;
      overflow-x: hidden !important;
    }
    
    /* Дополнительно убеждаемся, что все углы попапа скруглены */
    .leaflet-popup-tip {
      border-radius: 2px;
    }
  }
`;

// Стили для обычных div попапов (не Leaflet)
export const CustomPopupStylesSelected = styled.div`
  // Базовые стили без дублирования
`;


export const PopupContainer = styled.div`
  width: 205px;
  height: 285px;
  display: flex;
  flex-direction: column;
  background-color: white;
  position: relative;
  padding: 12px;
  box-sizing: border-box;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 2px solid #ffffff; /* Белая рамка для стандартного попапа */
  border-radius: 8px;

  /* Оранжевая рамка для выбранных (избранных) маркеров */
  .selected > & {
    border: 2px solid #ff9800;
    box-shadow: 0 0 12px 2px #ff9800, 0 0 20px 4px rgba(255, 152, 0, 0.3);
    animation: popupSelectedGlow 2s ease-in-out infinite alternate;
  }

  @keyframes popupSelectedGlow {
    from { box-shadow: 0 0 12px 2px #ff9800, 0 0 20px 4px rgba(255, 152, 0, 0.3); }
    to { box-shadow: 0 0 16px 3px #ff9800, 0 0 30px 6px rgba(255, 152, 0, 0.5); }
  }
`;

export const CloseButton = styled.button`
  position: absolute; // Позиционируем относительно .leaflet-popup-content-wrapper
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 1.5em;
  color: #333;
  cursor: pointer;
  z-index: 10; // Чтобы был поверх контента
`;

export const PopupContent = styled.div`
  padding: 0;
  overflow: visible !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-wrap: break-word;
  line-height: 1.1;
`;

export const PopupHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  /* Убедимся, что содержимое хедера не вызывает горизонтального переполнения */
  overflow-wrap: break-word;
`;

export const PhotoBlock = styled.div`
  flex-shrink: 0; // Фото не должно сжиматься
  position: relative;
`;

export const Photo = styled.img`
  width: 60px; // Уменьшаем размер миниатюры фото
  height: 60px;
  object-fit: cover; // Обрезка фото, чтобы оно поместилось в квадрат
  border-radius: 4px;
  cursor: pointer;
`;

export const TitleRatingBlock = styled.div`
  flex-grow: 1; // Занимает все доступное пространство
  word-break: break-word; /* Добавляем перенос слов для длинных заголовков */
`;

export const Title = styled.h3`
  margin: 0 0 4px 0;
  font-size: 1em;
  font-weight: bold;
  line-height: 1.1;
  word-break: break-word; /* Добавляем перенос слов */
`;

export const Rating = styled.div`
  font-size: 0.85em;
  color: #f1c40f;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  line-height: 1.1;
  span {
    color: #333;
    white-space: nowrap;
    font-size: 0.9em;
  }
`;

export const Description = styled.div<{ $isExpanded?: boolean }>`
  font-size: 0.85em;
  line-height: 1.2;
  color: #555;
  word-break: break-word; /* Добавляем перенос слов */

  ${props => !props.$isExpanded && `
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3; /* Ограничение до 3 строк */
  `}
`;

export const MetaInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: #777;
  /* Убедимся, что мета-информация не вызывает горизонтального переполнения */
  overflow-wrap: break-word;
  line-height: 1.1;
`;

export const Author = styled.span`
  font-weight: bold;
  word-break: break-word; /* Добавляем перенос слов */
`;

export const DateInfo = styled.span`
  word-break: break-word; /* Добавляем перенос слов */
`;

export const Actions = styled.div`
  display: flex;
  justify-content: space-around;
  gap: 8px;
  flex-wrap: wrap; /* Позволяем кнопкам переноситься, если не помещаются */
  /* Убедимся, что кнопки действий не вызывают горизонтального переполнения */
  overflow-wrap: break-word;
`;

export const ActionButton = styled.button<{ buttonColor?: string }>`
  background: none;
  border: none;
  font-size: 0.8em;
  color: ${props => props.buttonColor || '#3498db'}; // Используем переданный цвет или дефолтный синий
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  word-break: break-word;

  &:hover {
    background-color: #f0f0f0;
  }
`;

export const Hashtags = styled.div`
  display: flex;
  flex-wrap: nowrap;
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  gap: 6px;
  width: 100%;
  cursor: pointer;
`;

export const Hashtag = styled.span`
  font-size: 0.8em;
  background-color: #ecf0f1;
  color: #555;
  padding: 3px 8px;
  border-radius: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #d1eaff;
  }
`;

// LegendButton больше не используется - заменен на простую кнопку без фона в Map.tsx
export const LegendButton = styled.button`
  /* Устаревший компонент - не используется */
  display: none;
`;

export const SearchBarContainer = styled.div`
  display: flex;
  align-items: center;
  background: linear-gradient(90deg, #e0e7ff 0%, #f0f4ff 100%);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border: 2px solid #7faaff;
  padding: 12px 24px;
  width: 33.333%;
  min-width: 200px;
  max-width: 100%;
  transition: box-shadow 0.2s, border-color 0.2s;
  &:focus-within {
    box-shadow: 0 0 0 3px #a5b4fc;
    border-color: #3b82f6;
    background: linear-gradient(90deg, #dbeafe 0%, #e0e7ff 100%);
  }
`;

export const GlobalMarkerStyles = styled.div`
  /* Каплевидные маркеры — стили задаются inline в createMarkerIconHTML */
  .marker-icon, .marker-base {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
  }
  /* Сброс дефолтных стилей Leaflet для div-icon (белый фон, бордер) */
  .leaflet-div-icon {
    background: transparent !important;
    border: none !important;
  }
  .marker-user-poi {
    border: 2px solid #e67e22;
  }
  .marker-commercial {
    /* Золотая рамка для коммерческих меток */
    border: 3px solid #ffd700 !important;
    box-shadow: 0 0 10px #ffd700;
  }
  .marker-promoted {
    /* Фиолетовая пульсация для продвигаемых меток */
    animation: pulse-promoted 1.5s infinite;
    transform: scale(1.2); /* Делаем их чуть больше */
    z-index: 200 !important; /* Всегда наверху */
  }
  .marker-hot {
    animation: pulse 2s infinite;
    box-shadow: 0 0 5px 5px rgba(255, 165, 0, 0.5);
    transform: scale(1.1);
    z-index: 100;
  }
  .marker-pending {
    /* Оранжевая пульсация для меток на модерации */
    animation: pulse-pending 2s infinite;
    box-shadow: 0 0 5px 5px rgba(255, 152, 0, 0.5);
    border: 3px solid #ff9800 !important;
    z-index: 150;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(255,165,0,0.7); }
    70% { box-shadow: 0 0 0 10px rgba(255,165,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,165,0,0); }
  }
  @keyframes pulse-promoted {
    0% { box-shadow: 0 0 0 0 rgba(142, 68, 173, 0.7); }
    70% { box-shadow: 0 0 0 12px rgba(142, 68, 173, 0); }
    100% { box-shadow: 0 0 0 0 rgba(142, 68, 173, 0); }
  }
  @keyframes pulse-pending {
    0% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(255, 152, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
  }
`;

export const BookmarkButton = styled.button`
  position: absolute;
  top: 6px;
  left: 6px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  z-index: 2;
  opacity: 0.9;
  transition: opacity 0.2s;
  &:hover {
    opacity: 1;
  }
`;

export const MapTypeButton = styled.button`
  position: absolute;
  bottom: 80px;
  left: 20px;
  background: #fff;
  color: #3498db;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-size: 1.7em;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #f0f0f0;
  }
`;

// Добавляем стили для слоев пробок и велодорожек как styled-components
export const TrafficLayer = styled.div`
  .traffic-layer {
    mix-blend-mode: multiply;
  }
`;

export const BikeLanesLayer = styled.div`
  .bike-lanes-layer {
    mix-blend-mode: overlay;
  }
`;

/* Глобальные стили для всех Leaflet попапов */
export const GlobalLeafletPopupStyles = createGlobalStyle`
  .leaflet-popup-content-wrapper {
    border-radius: 8px !important;
  }
  .leaflet-popup-tip {
    border-radius: 2px;
  }

  /* Кастомный попап маркера — убираем Leaflet-хром, чтобы MarkerPopup рендерился без двойной рамки */
  .custom-marker-popup .leaflet-popup-content-wrapper {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
    border: none !important;
  }
  .custom-marker-popup .leaflet-popup-tip-container {
    display: none !important;
  }
  .custom-marker-popup .leaflet-popup-content {
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
  }
  .custom-marker-popup .leaflet-popup-close-button {
    display: none !important;
  }

  /* Убедимся, что элементы управления Leaflet отображаются поверх стеклянных панелей */
  .leaflet-control {
    z-index: 1300 !important;
  }
`;