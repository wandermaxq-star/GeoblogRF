// ============================================================
// Конфигурация партнёрской программы
// Разделение: Simple User (активный автор) vs Pro Guide (проф. гид)
// ============================================================

// Simple User — активный автор, НЕТ реферальной ссылки
// Заработок только на кураторских паках
export const SimpleAuthorTiers = [
  {
    level: 'novice',
    name: '🌱 Новичок',
    threshold: 0,
    commission: 15,
    requirement: 'Начальный уровень',
    color: '#3B82F6',
  },
  {
    level: 'ambassador',
    name: '⭐ Амбассадор',
    threshold: 8, // 8 маршрутов + 10 голосов
    commission: 20,
    requirement: '8 маршрутов, 10 положительных оценок',
    color: '#10B981',
  },
  {
    level: 'expert',
    name: '🏆 Про-эксперт',
    threshold: 15, // 15 маршрутов + 20 голосов
    commission: 25,
    requirement: '15 маршрутов, 20 положительных оценок',
    color: '#F59E0B',
  },
] as const;

// Pro Guide — профессиональный гид, ЕСТЬ реферальная ссылку
// Отдельные метрики: Premium referrals и Pack sales

export const ProGuidePremiumTiers = [
  { threshold: 10, commission: 10, name: 'Старт' },
  { threshold: 25, commission: 15, name: 'Развитие' },
  { threshold: 50, commission: 20, name: 'Эксперт' },
  { threshold: 100, commission: 25, name: 'Топ' },
] as const;

export const ProGuidePackTiers = [
  { threshold: 10, commission: 15, name: 'Старт' },
  { threshold: 25, commission: 20, name: 'Развитие' },
  { threshold: 50, commission: 25, name: 'Эксперт' },
  { threshold: 100, commission: 30, name: 'Топ' },
] as const;

// Legacy-экспорт для обратной совместимости (будет удалён)
export interface PartnerTier {
  id: string;
  name: string;
  minReq: string;
  packs: string;
  referrals: string;
  sub: string;
  hint: string;
  color?: string;
  benefits?: string[];
}

export const partnerTiers: PartnerTier[] = [
  {
    id: 'novice',
    name: '🌱 Новичок',
    minReq: 'Начальный уровень',
    packs: '15%',
    referrals: '—',
    sub: '—',
    hint: 'Для активных авторов',
    color: '#3B82F6',
  },
  {
    id: 'ambassador',
    name: '⭐ Амбассадор',
    minReq: '8 маршрутов, 10 оценок',
    packs: '20%',
    referrals: '—',
    sub: '—',
    hint: 'Для активных авторов',
    color: '#10B981',
  },
  {
    id: 'expert',
    name: '🏆 Про-эксперт',
    minReq: '15 маршрутов, 20 оценок',
    packs: '25%',
    referrals: '—',
    sub: '—',
    hint: 'Максимум для авторов',
    color: '#F59E0B',
  },
  {
    id: 'pro_guide',
    name: '👑 Про-Гид',
    minReq: 'По приглашению',
    packs: '15–30%',
    referrals: '10–25%',
    sub: '10–25%',
    hint: 'Для профессиональных гидов',
    color: '#A855F7',
  },
];

// Хелперы для определения комиссии
export function getSimpleAuthorCommission(routes: number, positiveVotes: number): { level: string; commission: number } {
  if (routes >= 15 && positiveVotes >= 20) {
    return { level: 'expert', commission: 25 };
  }
  if (routes >= 8 && positiveVotes >= 10) {
    return { level: 'ambassador', commission: 20 };
  }
  return { level: 'novice', commission: 15 };
}

export function getProGuidePremiumCommission(premiumReferrals: number): { tier: string; commission: number } {
  if (premiumReferrals >= 100) return { tier: 'top', commission: 25 };
  if (premiumReferrals >= 50) return { tier: 'expert', commission: 20 };
  if (premiumReferrals >= 25) return { tier: 'growth', commission: 15 };
  if (premiumReferrals >= 10) return { tier: 'start', commission: 10 };
  return { tier: 'none', commission: 0 };
}

export function getProGuidePackCommission(packSales: number): { tier: string; commission: number } {
  if (packSales >= 100) return { tier: 'top', commission: 30 };
  if (packSales >= 50) return { tier: 'expert', commission: 25 };
  if (packSales >= 25) return { tier: 'growth', commission: 20 };
  if (packSales >= 10) return { tier: 'start', commission: 15 };
  return { tier: 'none', commission: 0 };
}
