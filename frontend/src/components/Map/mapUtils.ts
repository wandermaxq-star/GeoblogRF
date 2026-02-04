/**
 * Вспомогательные функции для компонента Map
 * Вынесено из Map.tsx для улучшения читаемости
 */

// Use facade for creating layers instead of importing Leaflet directly
import { mapFacade } from '../../services/map_facade/index';

/**
 * Получает URL и attribution для базового слоя карты
 * @param mapType - тип карты: 'dark', 'satellite' или default
 * @returns объект с url и attribution
 */
export function getTileLayer(mapType: string) {
    if (mapType === 'dark') {
        return {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        };
    } else if (mapType === 'satellite') {
        return {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        };
    }
    return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    };
}

/**
 * Создает дополнительные слои для отображения пробок и велодорожек
 * @param showTraffic - показывать ли пробки
 * @param showBikeLanes - показывать ли велодорожки
 * @returns массив L.TileLayer
 */
export function getAdditionalLayers(showTraffic: boolean, showBikeLanes: boolean) {
    const layers: any[] = [];

    if (showTraffic) {
        // return a lightweight wrapper that will create and add a proper tile layer via the facade when addTo() is called
        const trafficWrapper = (() => {
            let created: any = null;
            return {
                addTo: (map: any) => {
                    created = mapFacade().addTileLayer('https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=YOUR_API_KEY', {
                        attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>',
                        opacity: 0.5,
                        className: 'traffic-layer'
                    });
                    return created;
                },
                getContainer: () => created?.getContainer?.()
            };
        })();
        layers.push(trafficWrapper);
    }

    if (showBikeLanes) {
        const bikeWrapper = (() => {
            let created: any = null;
            return {
                addTo: (map: any) => {
                    created = mapFacade().addTileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Rendering: <a href="https://www.cyclosm.org/">CyclOSM</a>',
                        opacity: 0.6,
                        className: 'bike-lanes-layer'
                    });
                    return created;
                },
                getContainer: () => created?.getContainer?.()
            };
        })();
        layers.push(bikeWrapper);
    }

    return layers;
}

/**
 * Создает визуальный индикатор для активного слоя (пробки/велодорожки)
 * @param layerType - тип слоя: 'traffic' или 'bike'
 * @returns HTML div элемент с индикатором
 */
export function createLayerIndicator(layerType: 'traffic' | 'bike') {
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.top = '10px';
    indicator.style.left = layerType === 'traffic' ? '10px' : '50px';
    indicator.style.background = layerType === 'traffic' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 128, 0, 0.7)';
    indicator.style.color = 'white';
    indicator.style.padding = '5px 10px';
    indicator.style.borderRadius = '5px';
    indicator.style.fontSize = '12px';
    indicator.style.zIndex = '1000';
    indicator.textContent = layerType === 'traffic' ? 'Пробки' : 'Велодорожки';
    return indicator;
}

/**
 * Конвертирует географические координаты в пиксельные координаты контейнера
 * @param map - экземпляр L.Map
 * @param latlng - географические координаты
 * @returns {x, y} пиксельные координаты относительно контейнера
 */
// Вариант с использованием фасада (если фасад доступен глобально или передается)
export function latLngToContainerPoint(mapFacade: any, latlng: any) {
    if (!mapFacade) return { x: 0, y: 0 };
    // Вызываем метод фасада, который абстрагирует доступ к инстансу карты
    try {
        const point = mapFacade().latLngToContainerPoint(latlng);
        return { x: point.x, y: point.y };
    } catch (e) {
        return { x: 0, y: 0 };
    }
}

/**
 * Категории маркеров с цветами и иконками
 * Используется для создания кастомных иконок
 */
export const markerCategoryStyles: { [key: string]: { color: string; icon: string; user?: boolean } } = {
    attraction: { color: '#3498db', icon: 'fa-star' },
    restaurant: { color: '#8B0000', icon: 'fa-utensils' },
    hotel: { color: '#8e44ad', icon: 'fa-hotel' },
    nature: { color: '#27ae60', icon: 'fa-leaf' },
    culture: { color: '#f1c40f', icon: 'fa-landmark' },
    entertainment: { color: '#f39c12', icon: 'fa-gem' },
    transport: { color: '#16a085', icon: 'fa-bus' },
    shopping: { color: '#e67e22', icon: 'fa-wallet' },
    healthcare: { color: '#e74c3c', icon: 'fa-heart' },
    education: { color: '#3498db', icon: 'fa-users' },
    service: { color: '#34495e', icon: 'fa-building' },
    other: { color: '#7f8c8d', icon: 'fa-question' },
    event: { color: '#9b59b6', icon: 'fa-calendar-check' },
    blog: { color: '#2ecc71', icon: 'fa-pen-nib' },
    route: { color: '#f39c12', icon: 'fa-route' },
    chat: { color: '#1abc9c', icon: 'fa-comment-dots' },
    user_poi: { color: '#e67e22', icon: 'fa-map-pin', user: true },
    default: { color: '#7f8c8d', icon: 'fa-map-marker-alt' }
};

/**
 * Создает HTML строку для Font Awesome иконки маркера
 * @param category - категория маркера
 * @param color - цвет маркера
 * @param size - размер иконки (по умолчанию 24)
 * @returns HTML строка с иконкой
 */
export function createMarkerIconHTML(category: string, color: string, size: number = 24): string {
    const style = markerCategoryStyles[category] || markerCategoryStyles.default;
    return `
    <div style="
      background-color: ${color || style.color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      border: 3px solid white;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    ">
      <i class="fas ${style.icon}" style="
        color: white;
        font-size: ${size * 0.5}px;
        transform: rotate(45deg);
      "></i>
    </div>
  `;
}

/**
 * Валидирует координаты маркера
 * @param latitude - широта
 * @param longitude - долгота
 * @returns true если координаты валидны
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
    return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
}
