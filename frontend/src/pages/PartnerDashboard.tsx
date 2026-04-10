import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BadgePercent, Copy, Sparkles, Users, Wallet, Map, Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import CentreBackground from '../components/Centre/CentreBackground';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { SimpleAuthorTiers, ProGuidePremiumTiers, ProGuidePackTiers } from '../data/partnerTiers';

// ============================================================
// Типы данных
// ============================================================

interface PartnerStats {
  referral_code: string | null;
  referred_users: number;
  total_commission: number;
  tier?: string;
  commission_rate?: string;
  total_events?: number;
  signup_events?: number;
  subscription_events?: number;
  paid_pack_sales?: number;
  next_paid_pack_bonus_in?: number;
}

interface ProgressData {
  ok: boolean;
  partner_role: 'simple' | 'pro_guide' | null;
  partner_status: string;
  is_simple_user: boolean;
  is_pro_guide: boolean;
  has_referral_link: boolean;
  simple_progress?: {
    level: string;
    commission: number;
    routes: number;
    needed_routes: number;
    votes: number;
    needed_votes: number;
    routes_pct: number;
    votes_pct: number;
    overall_pct: number;
    is_eligible: boolean;
    missing: string[];
  };
  guide_progress?: {
    premium_referrals: number;
    premium_tier: string;
    premium_commission: number;
    pack_sales: number;
    pack_tier: string;
    pack_commission: number;
  };
}

// ============================================================
// Главный компонент
// ============================================================

const PartnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    registerPanel();
    return () => unregisterPanel();
  }, [registerPanel, unregisterPanel]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Загружаем прогресс и статистику параллельно
    Promise.all([
      api.get<ProgressData>('/partners/progress'),
      api.get<PartnerStats>('/users/partner').catch(() => null),
    ])
      .then(([progressRes, statsRes]) => {
        if (progressRes.data?.ok) {
          setProgress(progressRes.data);
        }
        if (statsRes?.data) {
          setStats(statsRes.data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Не удалось загрузить данные партнёра');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const shareLink = useMemo(() => {
    if (!stats?.referral_code) return '';
    return `${window.location.origin}/?ref=${stats.referral_code}`;
  }, [stats?.referral_code]);

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (err) {
      console.error(err);
    }
  };

  // ============================================================
  // Рендер контента в зависимости от роли
  // ============================================================

  let content: React.ReactNode;

  if (!user) {
    content = <NotAuthorizedContent />;
  } else if (loading) {
    content = <LoadingContent />;
  } else if (error) {
    content = <ErrorContent error={error} />;
  } else if (!progress) {
    content = <NoDataContent />;
  } else if (progress.partner_role === 'pro_guide') {
    content = (
      <ProGuideContent
        progress={progress}
        stats={stats}
        shareLink={shareLink}
        copyState={copyState}
        onCopy={copyShareLink}
      />
    );
  } else {
    // Simple User или без роли
    content = <SimpleUserContent progress={progress} />;
  }

  if (isMobile) {
    return (
      <>
        <CentreBackground />
        <div className="h-full overflow-y-auto centre-mobile-page">{content}</div>
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">{content}</MirrorGradientContainer>
    </>
  );
};

// ============================================================
// Simple User — активный автор (БЕЗ реферальной ссылки)
// ============================================================

const SimpleUserContent: React.FC<{ progress: ProgressData }> = ({ progress }) => {
  const sp = progress.simple_progress;

  return (
    <PartnerPageShell
      title="Панель автора"
      subtitle="Твой прогресс и заработок на кураторских паках"
    >
      {/* Герой-карточка */}
      <div className="centre-glass-card" style={heroCardStyle}>
        <div style={pillStyle}>
          <Sparkles size={15} />
          Активный автор
        </div>
        <h2 style={heroTitleStyle}>Зарабатывай на своём контенте</h2>
        <p style={heroTextStyle}>
          Публикуй качественные маршруты, получай положительные оценки и зарабатывай
          до 25% с продаж своих кураторских паков. Чем лучше контент — тем выше ставка.
        </p>
      </div>

      {/* Текущий уровень */}
      <div className="centre-glass-card">
        <SectionTitle icon={<TrendingUp size={18} />} title="Твой уровень" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <MetricCard
            icon={<Star size={18} />}
            label="Уровень"
            value={sp?.level === 'expert' ? '🏆 Про-эксперт' : sp?.level === 'ambassador' ? '⭐ Амбассадор' : '🌱 Новичок'}
            accent="orange"
          />
          <MetricCard
            icon={<Wallet size={18} />}
            label="Комиссия с паков"
            value={`${sp?.commission || 15}%`}
            accent="teal"
          />
          <MetricCard
            icon={<Map size={18} />}
            label="Маршрутов"
            value={`${sp?.routes || 0} / ${sp?.needed_routes || 15}`}
            accent="blue"
          />
          <MetricCard
            icon={<Star size={18} />}
            label="Положительных оценок"
            value={`${sp?.votes || 0} / ${sp?.needed_votes || 20}`}
            accent="amber"
          />
        </div>
      </div>

      {/* Прогресс */}
      {sp && !sp.is_eligible && (
        <div className="centre-glass-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <SectionTitle icon={<TrendingUp size={18} />} title="Что нужно для следующего уровня" />
          <div style={{ display: 'grid', gap: '8px' }}>
            {sp.missing.map((m, i) => (
              <div key={i} style={missingItemStyle}>
                <span style={{ color: '#F59E0B' }}>→</span>
                <span style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sp?.is_eligible && (
        <div className="centre-glass-card" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.08)' }}>
          <SectionTitle icon={<Sparkles size={18} />} title="Максимальный уровень достигнут!" />
          <p style={{ color: 'var(--cg-text-muted)', fontSize: '14px' }}>
            Ты получаешь 25% с продаж своих кураторских паков. Продолжай создавать
            качественный контент и привлекать путешественников!
          </p>
        </div>
      )}

      {/* Таблица уровней */}
      <div className="centre-glass-card">
        <SectionTitle icon={<BadgePercent size={18} />} title="Система уровней" />
        <div style={{ display: 'grid', gap: '10px' }}>
          {SimpleAuthorTiers.map((tier) => (
            <div
              key={tier.level}
              style={{
                ...tierRowStyle,
                border: sp?.level === tier.level ? '1px solid rgba(16, 185, 129, 0.4)' : undefined,
                background: sp?.level === tier.level ? 'rgba(16, 185, 129, 0.08)' : undefined,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--glass-text)' }}>{tier.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)' }}>{tier.requirement}</div>
              </div>
              <div style={{ fontWeight: 800, color: tier.color, fontSize: '18px' }}>{tier.commission}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Инфо */}
      <div className="centre-glass-card" style={tipCardStyle}>
        <SectionTitle icon={<Sparkles size={18} />} title="Как это работает" />
        <div style={{ display: 'grid', gap: '8px', color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.55 }}>
          <div>• Публикуй маршруты и получай положительные оценки от пользователей</div>
          <div>• Достигай новых уровней: Новичок → Амбассадор → Про-эксперт</div>
          <div>• Создавай кураторские паки и зарабатывай 15–25% с каждой продажи</div>
          <div>• Максимум для активного автора — 25% комиссии</div>
        </div>
      </div>

      {/* Ссылка на заявку Pro Guide */}
      <div className="centre-glass-card" style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}>
        <SectionTitle icon={<Users size={18} />} title="Ты профессиональный гид?" />
        <p style={{ color: 'var(--cg-text-muted)', fontSize: '13px', marginBottom: '12px' }}>
          Если у тебя есть аудитория и опыт проведения туров, подай заявку на статус
          Про-Гида — получи доступ к реферальной программе и повышенные ставки до 30%.
        </p>
        <Link to="/partner/apply" style={primaryLinkStyle}>
          Подать заявку Про-Гида
        </Link>
      </div>
    </PartnerPageShell>
  );
};

// ============================================================
// Pro Guide — профессиональный гид (ЕСТЬ реферальная ссылка)
// ============================================================

const ProGuideContent: React.FC<{
  progress: ProgressData;
  stats: PartnerStats | null;
  shareLink: string;
  copyState: 'idle' | 'copied';
  onCopy: () => void;
}> = ({ progress, stats, shareLink, copyState, onCopy }) => {
  const gp = progress.guide_progress;

  return (
    <PartnerPageShell
      title="Панель Про-Гида"
      subtitle="Реферальная программа, продажи паков и статистика"
    >
      {/* Герой-карточка */}
      <div className="centre-glass-card" style={heroCardStyle}>
        <div style={pillStyle}>
          <Sparkles size={15} />
          Про-Гид
        </div>
        <h2 style={heroTitleStyle}>Твой реферальный контур готов</h2>
        <p style={heroTextStyle}>
          Приглашай пользователей по реферальной ссылке, продавай кураторские паки
          и получай комиссию до 30%. Все инструменты в одной панели.
        </p>
        <div style={highlightBoxStyle}>
          <div style={highlightLabelStyle}>Твой уровень</div>
          <div style={highlightValueStyle}>👑 Про-Гид</div>
          <div style={highlightSubtextStyle}>
            Премиум: {gp?.premium_commission || 0}% | Паки: {gp?.pack_commission || 0}%
          </div>
        </div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <MetricCard
          icon={<BadgePercent size={18} />}
          label="Реферальный код"
          value={stats?.referral_code || '—'}
          accent="orange"
        />
        <MetricCard
          icon={<Users size={18} />}
          label="Премиум-рефералов"
          value={String(gp?.premium_referrals || 0)}
          accent="teal"
        />
        <MetricCard
          icon={<Wallet size={18} />}
          label="Продаж паков"
          value={String(gp?.pack_sales || 0)}
          accent="blue"
        />
        <MetricCard
          icon={<BarChart3 size={18} />}
          label="Начислено комиссий"
          value={`${stats?.total_commission || 0} ₽`}
          accent="amber"
        />
      </div>

      {/* Реферальная ссылка */}
      <div className="centre-glass-card">
        <SectionTitle icon={<Copy size={18} />} title="Реферальная ссылка" />
        <p style={mutedTextStyle}>
          Используй эту ссылку в постах, соцсетях и анонсах. По ней будет привязан твой код.
        </p>
        <div style={inputShellStyle}>
          <input readOnly value={shareLink} style={inputStyle} />
          <button type="button" onClick={onCopy} style={copyButtonStyle}>
            {copyState === 'copied' ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      </div>

      {/* Таблица ставок */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Премиум-рефералы */}
        <div className="centre-glass-card">
          <SectionTitle icon={<Users size={18} />} title="Ставки: Премиум-рефералы" />
          <div style={{ display: 'grid', gap: '8px' }}>
            {ProGuidePremiumTiers.map((tier) => (
              <TierRow
                key={tier.threshold}
                label={`≥ ${tier.threshold} подписчиков`}
                value={`${tier.commission}%`}
                isActive={gp?.premium_commission === tier.commission}
              />
            ))}
          </div>
        </div>

        {/* Продажи паков */}
        <div className="centre-glass-card">
          <SectionTitle icon={<Wallet size={18} />} title="Ставки: Продажи паков" />
          <div style={{ display: 'grid', gap: '8px' }}>
            {ProGuidePackTiers.map((tier) => (
              <TierRow
                key={tier.threshold}
                label={`≥ ${tier.threshold} продаж`}
                value={`${tier.commission}%`}
                isActive={gp?.pack_commission === tier.commission}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Советы */}
      <div className="centre-glass-card" style={tipCardStyle}>
        <SectionTitle icon={<Sparkles size={18} />} title="Рекомендации" />
        <div style={{ display: 'grid', gap: '8px', color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.55 }}>
          <div>• Размещай ссылку в описании маршрутов и соцсетях</div>
          <div>• Создавай эксклюзивные кураторские паки — до 30% комиссии</div>
          <div>• Привлекай премиум-подписчиков — до 25% ежемесячно</div>
        </div>
      </div>
    </PartnerPageShell>
  );
};

// ============================================================
// Вспомогательные компоненты
// ============================================================

const TierRow: React.FC<{ label: string; value: string; isActive?: boolean }> = ({ label, value, isActive }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 12px',
      borderRadius: '10px',
      background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
      border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <span style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>{label}</span>
    <strong style={{ color: isActive ? '#10B981' : 'var(--glass-text)', fontSize: '15px' }}>{value}</strong>
  </div>
);

const NotAuthorizedContent: React.FC = () => (
  <PartnerPageShell title="Партнёрская панель" subtitle="Панель доступна только после входа в аккаунт.">
    <div className="centre-glass-card" style={heroCardStyle}>
      <div style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
        Нужен вход в аккаунт
      </div>
      <div style={{ color: 'var(--cg-text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '18px' }}>
        Сначала авторизуйся, затем вернись в партнёрский раздел.
      </div>
      <Link to="/login" style={primaryLinkStyle}>Перейти ко входу</Link>
    </div>
  </PartnerPageShell>
);

const LoadingContent: React.FC = () => (
  <PartnerPageShell title="Партнёрская панель" subtitle="Загружаю статистику...">
    <div className="centre-glass-card" style={heroCardStyle}>Загрузка данных...</div>
  </PartnerPageShell>
);

const ErrorContent: React.FC<{ error: string }> = ({ error }) => (
  <PartnerPageShell title="Партнёрская панель" subtitle="Ошибка">
    <div className="centre-glass-card" style={errorCardStyle}>{error}</div>
  </PartnerPageShell>
);

const NoDataContent: React.FC = () => (
  <PartnerPageShell title="Партнёрская панель" subtitle="Нет данных">
    <div className="centre-glass-card" style={heroCardStyle}>Пока нет данных партнёра.</div>
  </PartnerPageShell>
);

const PartnerPageShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <>
    <div className="centre-static-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.95), rgba(234, 88, 12, 0.85))',
            color: '#fff',
          }}
        >
          <Users size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p style={{ margin: '2px 0 0 0', color: 'var(--text-accent)', fontSize: '13px' }}>{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="centre-scroll-area">
      <div className="centre-content" style={{ display: 'grid', gap: '16px' }}>
        {children}
      </div>
    </div>
  </>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
    <div style={{ color: 'var(--text-accent)', flexShrink: 0 }}>{icon}</div>
    <h3 style={{ margin: 0, color: 'var(--glass-text)', fontSize: '16px', fontWeight: 700 }}>{title}</h3>
  </div>
);

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'orange' | 'teal' | 'blue' | 'amber' | 'purple' | 'pink';
}> = ({ icon, label, value, accent }) => {
  const accentMap: Record<string, string> = {
    orange: 'linear-gradient(145deg, rgba(249, 115, 22, 0.18), rgba(234, 88, 12, 0.08))',
    teal: 'linear-gradient(145deg, rgba(20, 184, 166, 0.18), rgba(13, 148, 136, 0.08))',
    blue: 'linear-gradient(145deg, rgba(59, 130, 246, 0.18), rgba(37, 99, 235, 0.08))',
    amber: 'linear-gradient(145deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.08))',
    purple: 'linear-gradient(145deg, rgba(168, 85, 247, 0.18), rgba(147, 51, 234, 0.08))',
    pink: 'linear-gradient(145deg, rgba(236, 72, 153, 0.18), rgba(219, 39, 119, 0.08))',
  };

  return (
    <div className="centre-glass-card" style={{ background: accentMap[accent] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-accent)', marginBottom: '8px' }}>
        {icon}
        <span style={{ fontSize: '11px', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ color: 'var(--glass-text)', fontWeight: 800, fontSize: '20px', lineHeight: 1.2 }}>{value}</div>
    </div>
  );
};

// ============================================================
// Стили
// ============================================================

const heroCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.08) 48%, rgba(15, 118, 110, 0.08) 100%)',
  borderColor: 'rgba(249, 115, 22, 0.22)',
};

const errorCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(185, 28, 28, 0.08))',
  borderColor: 'rgba(239, 68, 68, 0.22)',
  color: 'var(--glass-text)',
};

const tipCardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12), rgba(8, 145, 178, 0.08))',
  borderColor: 'rgba(59, 130, 246, 0.24)',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 10px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.16)',
  color: 'var(--glass-text)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '12px',
};

const heroTitleStyle: React.CSSProperties = {
  color: 'var(--glass-text)',
  margin: '0 0 10px 0',
  fontSize: '24px',
  lineHeight: 1.15,
};

const heroTextStyle: React.CSSProperties = {
  color: 'var(--cg-text-muted)',
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.6,
};

const highlightBoxStyle: React.CSSProperties = {
  minWidth: '220px',
  borderRadius: '18px',
  padding: '16px 18px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
  marginTop: '16px',
};

const highlightLabelStyle: React.CSSProperties = {
  color: 'var(--text-accent)',
  fontSize: '11px',
  fontWeight: 700,
  marginBottom: '8px',
};

const highlightValueStyle: React.CSSProperties = {
  color: 'var(--glass-text)',
  fontSize: '22px',
  fontWeight: 800,
  marginBottom: '4px',
};

const highlightSubtextStyle: React.CSSProperties = {
  color: 'var(--cg-text-muted)',
  fontSize: '12px',
};

const mutedTextStyle: React.CSSProperties = {
  color: 'var(--cg-text-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  margin: '0 0 12px 0',
};

const inputShellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  padding: '12px',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: '240px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--glass-text)',
  fontSize: '13px',
};

const copyButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.10)',
  color: 'var(--glass-text)',
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(14, 165, 233, 0.38)',
  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.28), rgba(15, 118, 110, 0.24))',
  color: 'var(--glass-text)',
  fontWeight: 700,
  textDecoration: 'none',
};

const missingItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'rgba(245,158,11,0.06)',
  border: '1px solid rgba(245,158,11,0.15)',
};

const tierRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

export default PartnerDashboard;
