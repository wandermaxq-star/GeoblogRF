/**
 * Типы для административной панели
 */

export interface AdminMenuItemType {
  id: string;
  label: string;
  icon: string;
  section: 'moderation' | 'analytics' | 'partners' | 'packs' | 'hub' | 'settings';
  badge?: number;
  badgeColor?: 'orange' | 'red' | 'blue' | 'green' | 'yellow';
  subItems?: AdminMenuItemType[];
}

export interface AdminNotifications {
  moderation: {
    posts: number;
    events: number;
    markers: number;
    routes: number;
    comments: number;
    markerComments: number;
  };
  partners: {
    applications: number;
    payouts_pending: number;
    refunds_pending: number;
  };
  feedback: {
    new_complaints: number;
    new_suggestions: number;
  };
  analytics: number;
  hub: {
    packs_pending: number;
  };
}

export interface Partner {
  id: string;
  user_id: string;
  name: string;
  email: string;
  partner_status: 'none' | 'pending' | 'novice' | 'ambassador' | 'expert' | 'pro_guide';
  partner_role: 'simple' | 'pro_guide' | null;
  referral_code?: string;
  commission_rate: number;
  total_earned: number;
  total_referrals: number;
  created_at: string;
  is_pro_guide_allowed: boolean;
}

export interface PartnerApplication {
  id: string;
  user_id: string;
  application_type: 'organic' | 'pro_guide';
  status: 'new' | 'approved' | 'rejected';
  name: string;
  email: string;
  about?: string;
  city?: string;
  phone?: string;
  audience_url?: string;
  experience_years?: number;
  audience_size?: number;
  current_formats?: string;
  pack_ideas?: string;
  has_partners?: string;
  motivation?: string;
  routes_count?: number;
  positive_votes?: number;
  total_votes?: number;
  reviewer_id?: string;
  reviewed_at?: string;
  reviewer_note?: string;
  created_at: string;
}

export interface AffiliateEvent {
  id: string;
  referred_user_id: string;
  referrer_id: string;
  event_type: 'signup' | 'first_subscription' | 'paid_pack' | 'paid_premium_referral' | 'curated_pack_sale';
  amount: number;
  commission_due: number;
  status: 'pending' | 'paid' | 'rejected';
  created_at: string;
}

export interface AffiliatePayout {
  id: string;
  referrer_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: 'calculated' | 'sent' | 'paid';
  created_at: string;
}

export interface AffiliateRefund {
  id: string;
  referrer_id: string;
  original_event_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Feedback {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: 'complaint' | 'suggestion';
  category: 'content' | 'bug' | 'feature' | 'other';
  content_type?: 'post' | 'marker' | 'event' | 'comment' | null;
  content_id?: string;
  content_title?: string;
  message: string;
  status: 'new' | 'in_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high';
  admin_response?: string;
  admin_id?: string;
  created_at: string;
  resolved_at?: string;
}
