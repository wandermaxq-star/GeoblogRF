/// <reference types="leaflet" />

import 'leaflet';
import 'leaflet.vectorgrid';

declare module 'leaflet' {
  interface VectorGridOptions extends L.GridLayerOptions {
    vectorTileLayerStyles?: Record<string, PathOptions | ((properties: Record<string, unknown>, zoom: number) => PathOptions) | PathOptions[]>;
    interactive?: boolean;
    maxNativeZoom?: number;
    minNativeZoom?: number;
    rendererFactory?: unknown;
    getFeatureId?: (feature: unknown) => string | number;
  }

  interface VectorGrid extends GridLayer {
    setFeatureStyle(id: string | number, style: PathOptions): this;
    resetFeatureStyle(id: string | number): this;
  }

  interface VectorGridStatic {
    protobuf(url: string, options?: VectorGridOptions): VectorGrid;
    slicer(geojson: unknown, options?: VectorGridOptions): VectorGrid;
  }

  const vectorGrid: VectorGridStatic;
}

export {};
