export type CuratedRouteKind = 'federal' | 'regional' | 'event';

export interface CuratedRouteWaypoint {
  id: string;
  title: string;
  regionId: string;
  coordinates: [number, number];
  kind: 'city' | 'poi' | 'event_anchor';
  isRequired: boolean;
  isDefaultEnabled: boolean;
  estimatedTileWeightMb: number;
  note?: string;
}

export interface CuratedRouteVariant {
  id: string;
  title: string;
  summary: string;
  durationLabel: string;
  distanceLabel: string;
  estimatedBaseSizeMb: number;
  recommendedNights?: string;
  waypoints: CuratedRouteWaypoint[];
}

export interface CuratedRoutePack {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  routeKind: CuratedRouteKind;
  regions: string[];
  highlight: string;
  heroMetric: string;
  tags: string[];
  variants: CuratedRouteVariant[];
  price?: number; // в рублях
  discount?: number; // скидка в %
  exclusive?: boolean; // продаётся как эксклюзив от гида
}