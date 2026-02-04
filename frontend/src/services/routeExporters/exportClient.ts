import routesApi from '../../api/routesApi';
import serializers, { toGPX, toKML, toGeoJSONFeatureCollection } from './serializers';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Попытаться получить экспорт с сервера, иначе сгенерировать локально и скачать.
 */
export async function exportRouteAndDownload(route: any, format: 'gpx' | 'kml' | 'geojson', options?: any) {
  // Попытка server-side export
  try {
    const res = await routesApi.exportRoute(route.id, format, options);
    if (res && res.data) {
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' });
      const filename = `${route.metadata?.name || route.id}.${format}`;
      downloadBlob(blob, filename);
      return;
    }
  } catch (e) {
    // silent fallback to client-side — логим только короткое сообщение, чтобы не спамить стектрейсами
    console.warn('Server export failed, falling back to client serialization:', (e as any)?.message || e);
  }

  // Fallback: serialize locally
  try {
    let content: string | object;
    let mime = 'application/octet-stream';
    if (format === 'gpx') {
      content = toGPX(route, { includeElevation: options?.includeElevation, includeTimestamps: options?.includeTimestamps });
      mime = 'application/gpx+xml';
    } else if (format === 'kml') {
      content = toKML(route);
      mime = 'application/vnd.google-earth.kml+xml';
    } else {
      content = JSON.stringify(toGeoJSONFeatureCollection(Array.isArray(route) ? route : [route]), null, 2);
      mime = 'application/geo+json';
    }

    const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content)], { type: mime });
    const filename = `${route.metadata?.name || route.id}.${format}`;
    downloadBlob(blob, filename);
  } catch (err) {
    console.error('Failed to serialize route for download', err);
    throw err;
  }
}

export default {
  exportRouteAndDownload,
};
