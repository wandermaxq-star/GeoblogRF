/**
 * Инициализация Leaflet для глобального доступа через window.L
 * Этот модуль должен быть импортирован ПЕРЕД любыми модулями использующими mapFacade или projectManager
 * чтобы Leaflet был доступен до инициализации карты.
 */

// Импортируем Leaflet через ESM
import * as LeafletModule from 'leaflet';

// Leaflet может экспортироваться по-разному в зависимости от сборщика
const Leaflet = (LeafletModule as any).default || (LeafletModule as any);

// Сохраняем в window для обратной совместимости с кодом использующим window.L
if (typeof window !== 'undefined' && Leaflet) {
    (window as any).L = Leaflet;
}

// Также экспортируем Leaflet для использования через import
export { Leaflet };

export default Leaflet;

// Исправляем проблему с иконками Leaflet
if (Leaflet && Leaflet.Icon && Leaflet.Icon.Default) {
    delete (Leaflet.Icon.Default.prototype as any)._getIconUrl;
    Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
}

// Подключаем плагин MarkerCluster — он расширяет L объектом L.markerClusterGroup
// Импорт должен быть ПОСЛЕ установки window.L, т.к. плагин читает L из window
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

console.debug('[leafletInit] Leaflet initialized globally');