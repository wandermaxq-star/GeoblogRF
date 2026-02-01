// src/services/map_facade/types.ts

// Domain (vendor-agnostic) representation of a point: [lat, lng]
export type DomainGeoPoint = [number, number];

// Domain bounds: can be either tuple [[minLat, minLng], [maxLat, maxLng]]
// or an object { southWest, northEast } for convenience
export type DomainGeoBounds = [DomainGeoPoint, DomainGeoPoint] | { southWest: DomainGeoPoint; northEast: DomainGeoPoint; };

// Common polyline style
export interface PolylineStyle {
  color?: string;
  weight?: number;
  opacity?: number;
}

// Adapter handle for objects drawn on map (polyline/marker)
export interface IMapObjectHandle {
  id: string;
  remove(): void;
}
