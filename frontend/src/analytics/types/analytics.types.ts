/**
 * Типы для комплексной системы аналитики
 */

// ========== Product Analytics ==========

export interface PerformanceMetrics {
  app_load_time: number;
  map_load_time: number;
  error_rate: number;
  crash_rate: number;
  core_web_vitals?: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
  };
}

export interface BusinessMetrics {
  dau: number; // Daily Active Users
  mau: number; // Monthly Active Users
  wau: number; // Weekly Active Users
  retention: Record<string, number>; // Day 1, Day 7, Day 30
  conversion_funnels: FunnelData[];
  user_growth: {
    new_users: number;
    growth_rate: number;
    churn_rate: number;
  };
}

export interface RevenueMetrics {
  arpu: number; // Average Revenue Per User
  ltv: number; // Lifetime Value
  conversion_rates: Record<string, number>;
  revenue_trends?: {
    period: string;
    revenue: number;
  }[];
}

export interface ProductAnalytics {
  performance: PerformanceMetrics;
  business: BusinessMetrics;
  revenue: RevenueMetrics;
  timestamp: number;
}

// ========== Behavioral Analytics ==========

export interface RoutePattern {
  route_id: string;
  popularity_score: number;
  region: string;
  seasonality: string[];
  user_segments: string[];
  avg_rating: number;
  views_count: number;
}

export interface SeasonalDestination {
  destination: string;
  region: string;
  peak_seasons: string[];
  interest_trend: {
    month: string;
    interest_level: number;
  }[];
}

export type MovementType = 'explorer' | 'planner' | 'follower' | 'casual';

export interface TravelPatterns {
  popular_routes: RoutePattern[];
  seasonal_destinations: SeasonalDestination[];
  user_movement_types: {
    type: MovementType;
    percentage: number;
    avg_routes_per_user: number;
  }[];
}

export interface SearchBehavior {
  query: string;
  frequency: number;
  results_clicked: number;
  avg_time_to_click: number;
  region?: string;
}

export interface ConsumptionMetrics {
  avg_time_on_content: number;
  scroll_depth: {
    '25%': number;
    '50%': number;
    '75%': number;
    '100%': number;
  };
  bounce_rate: number;
  return_rate: number;
}

export interface EngagementTrigger {
  trigger_type: 'image' | 'title' | 'location' | 'hashtag' | 'author';
  effectiveness_score: number;
  usage_count: number;
}

export interface ContentBehavior {
  search_patterns: SearchBehavior[];
  consumption_depth: ConsumptionMetrics;
  engagement_triggers: EngagementTrigger[];
}

export interface ShareBehavior {
  content_type: 'post' | 'marker' | 'route' | 'event';
  share_channel: 'internal' | 'external';
  share_rate: number;
  avg_shares_per_content: number;
}

export interface InfluenceNetwork {
  user_id: string;
  username: string;
  influence_score: number;
  followers_count: number;
  content_created: number;
  engagement_rate: number;
}

export interface CommunityInteraction {
  interaction_type: 'like' | 'comment' | 'share' | 'save';
  frequency: number;
  peak_hours: number[];
  content_types: string[];
}

export interface SocialBehavior {
  sharing_patterns: ShareBehavior[];
  influence_networks: InfluenceNetwork[];
  community_interactions: CommunityInteraction[];
}

export interface BehavioralAnalytics {
  travel_patterns: TravelPatterns;
  content_behavior: ContentBehavior;
  social_behavior: SocialBehavior;
  timestamp: number;
}

// ========== Technical Monitoring ==========

export interface ErrorData {
  error_id: string;
  error_message: string;
  error_type: string;
  component: string;
  browser: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  frequency: number;
  first_seen: number;
  last_seen: number;
  stack_trace?: string;
}

export interface PerformanceData {
  metric_name: string;
  value: number;
  threshold: number;
  status: 'good' | 'needs_improvement' | 'poor';
  component?: string;
  timestamp: number;
}

export interface TechnicalHealth {
  error_rate: number;
  errors_by_component: Record<string, number>;
  errors_by_browser: Record<string, number>;
  errors_by_device: Record<string, number>;
  performance_metrics: PerformanceData[];
  api_errors: {
    endpoint: string;
    error_count: number;
    error_rate: number;
  }[];
  pwa_installs?: number;
}

// ========== Gamification Analytics ==========

export interface GamificationMetrics {
  daily_goals_completion: number; // percentage
  achievement_unlock_rate: number; // percentage
  xp_sources: {
    source: string;
    percentage: number;
    total_xp: number;
  }[];
  level_distribution: {
    level: number;
    user_count: number;
  }[];
  problem_areas: {
    issue: string;
    affected_users_percentage: number;
  }[];
}

// ========== Content Analytics ==========

export interface ContentQuality {
  posts_with_photos: number; // percentage
  detailed_descriptions: number; // percentage
  reuse_rate: number; // percentage
  trends: {
    metric: string;
    current: number;
    previous: number;
    change: number;
    direction: 'up' | 'down' | 'stable';
  }[];
}

export interface EngagementMetrics {
  likes_per_view: number; // percentage
  sharing_rate: number; // percentage
  save_rate: number; // percentage
  comments_per_post: number;
  avg_engagement_time: number;
}

export interface ContentAnalytics {
  quality: ContentQuality;
  engagement: EngagementMetrics;
}

// ========== Common Types ==========

export interface FunnelData {
  stage: string;
  users: number;
  dropoff_rate: number;
  conversion_rate: number;
}

export interface UserJourneyEvent {
  user_id?: string; // Опционально, так как может быть анонимным
  event_type: string;
  timestamp: number;
  properties: Record<string, any>;
  session_id: string;
}

export interface MapBehaviorEvent {
  event_type: 'zoom' | 'pan' | 'marker_click' | 'route_planned' | 'layer_change';
  timestamp: number;
  properties: {
    zoom_level?: number;
    center?: [number, number];
    marker_id?: string;
    route_id?: string;
    layer_type?: string;
  };
  user_id?: string;
  session_id: string;
}

export interface ComprehensiveMetrics {
  product: ProductAnalytics;
  behavioral: BehavioralAnalytics;
  technical: TechnicalHealth;
  gamification: GamificationMetrics;
  content: ContentAnalytics;
  timestamp: number;

  // === Расширенные реальные данные из БД ===
  users?: UsersRealData;
  contentStats?: ContentRealData;
  moderation?: ModerationRealData;
  geography?: GeographyRealData;
  notifications?: NotificationRealData;
  gamificationExtended?: GamificationExtendedData;
}

// ========== Реальные данные из БД ==========

export interface UsersRealData {
  total: number;
  new_users: number;
  active_authors: number;
  silent_users: number;
  growth_rate: number;
  registrations_by_day: { day: string; count: number }[];
}

export interface ContentRealData {
  period: { posts: number; markers: number; events: number; routes: number; comments: number };
  totals: { posts: number; markers: number; events: number; routes: number; comments: number };
  posts_with_photos_pct: number;
  avg_comments_per_post: number;
  posts_by_day: { day: string; count: number }[];
  top_authors: { username: string; post_count: number }[];
  total_likes_period: number;
}

export interface ModerationRealData {
  posts: Record<string, number>;
  markers: Record<string, number>;
  events: Record<string, number>;
  routes: Record<string, number>;
  ai: { total_decisions: number; reviewed: number; accuracy_pct: number };
}

export interface GeographyRealData {
  by_category: { category: string; count: number }[];
  top_regions: { region: string; count: number }[];
  markers_without_coords: number;
}

export interface NotificationRealData {
  total: number;
  read: number;
  unread: number;
  read_rate_pct: number;
}

export interface GamificationExtendedData {
  avg_level: number;
  max_level: number;
  top_users: { username: string; total_xp: number; level: number }[];
  xp_by_day: { day: string; total_xp: number }[];
}

// ========== Time Range ==========

export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export interface AnalyticsFilters {
  time_range: TimeRange;
  region?: string;
  user_segment?: string;
  content_type?: 'post' | 'marker' | 'route' | 'event' | 'all';
}

