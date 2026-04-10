// frontend/src/types/routePackSubmission.ts
// Типы для Route Pack Builder — заявки авторов и Hub

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'revision';
export type RouteKind = 'federal' | 'regional' | 'event';

export const ROUTE_KIND_LABELS: Record<RouteKind, string> = {
  federal:  'Федеральный маршрут',
  regional: 'Региональный маршрут',
  event:    'Событийный пакет',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending:  'На модерации',
  approved: 'Опубликован',
  rejected: 'Отклонён',
  revision: 'На доработке',
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, string> = {
  pending:  '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  revision: '#8B5CF6',
};

// Waypoint внутри submission (упрощённая версия — без regionId, estimatedTileWeightMb)
export interface RoutePackWaypoint {
  id: string;
  title: string;
  coordinates: [number, number];
  note?: string;
  isRequired: boolean;
}

// Вариант поездки внутри submission
export interface SubmissionVariant {
  id: string;
  title: string;
  summary: string;
  durationLabel: string;
  distanceLabel: string;
  estimatedBaseSizeMb: number;
}

// Полная заявка (как возвращает API)
export interface RoutePackSubmission {
  id: string;
  author_id?: string;
  author_name?: string;
  author_email?: string;
  author_bio?: string;
  title: string;
  subtitle: string;
  summary: string;
  route_kind: RouteKind;
  tags: string[];
  highlight: string;
  hero_metric: string;
  polyline?: [number, number][];
  waypoints: RoutePackWaypoint[];
  variants: SubmissionVariant[];
  distance_meters?: number;
  duration_seconds?: number;
  price: number;
  is_exclusive: boolean;
  status: SubmissionStatus;
  moderation_comment?: string;
  submitted_at: string;
  reviewed_at?: string;
  published_at?: string;
  download_count: number;
  purchase_count: number;
  rating_avg: number;
  rating_count: number;
  tile_pack_ready: boolean;
  tile_pack_size_mb?: number;
  tile_pack_url?: string;
}

// Данные, которые собирает RoutePackageBuilder перед отправкой
export interface RoutePackBuilderData {
  title: string;
  subtitle: string;
  summary: string;
  route_kind: RouteKind;
  tags: string[];
  highlight: string;
  hero_metric: string;
  polyline: [number, number][];
  waypoints: RoutePackWaypoint[];
  distance_meters: number;
  duration_seconds: number;
  variants: SubmissionVariant[];
  price: number;
  is_exclusive: boolean;
}

// Фильтры для Hub каталога
export interface HubFilters {
  kind?: RouteKind | '';
  free?: 'true' | 'false' | '';
  sort?: 'popular' | 'new' | 'rating';
  q?: string;
  limit?: number;
  offset?: number;
}
