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

// Side-effect import: ensure Leaflet MarkerCluster plugin is loaded and styles are bundled.
// We use dynamic import so it executes after Leaflet was attached to window.
void import('leaflet.markercluster').catch(() => { /* ignore - plugin may be missing in some envs */ });
void import('leaflet.markercluster/dist/MarkerCluster.css').catch(() => { /* ignore */ });
void import('leaflet.markercluster/dist/MarkerCluster.Default.css').catch(() => { /* ignore */ });

console.debug('[leafletInit] Leaflet initialized globally (markercluster import attempted)');