/**
 * PartnersPage — страница /partners
 *
 * Состояния:
 *  - не авторизован           → лендинг с описанием программы
 *  - авторизован, статус none → лестница прогресса + форма Про-Гида
 *  - статус pending           → «заявка на рассмотрении»
 *  - статус partner           → кнопка перейти в дашборд
 *  - статус pro_guide         → кнопка перейти в дашборд с пометкой Эксперта
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Wallet, ArrowRight, CheckCircle2,
  Clock, Sparkles, Mountain, Send, ChevronDown, ChevronUp,
  Map, Star, BadgeCheck,
} from 'lucide-react';
import CentreBackground from '../components/Centre/CentreBackground';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/apiClient';
import { partnerTiers } from '../data/partnerTiers';

// ── Типы ────────────────────────────────────────────────────────────────────

interface ProgressData {
  ok: boolean;
  username: string;
  partner_status: 'none' | 'pending' | 'partner' | 'pro_guide';
  stats: {
    published_routes: number;
    positive_votes: number;
    negative_votes: number;
    total_votes: number;
  };
  requirements: {
    routes_needed: number;
    positive_votes_needed: number;
  };
  progress: {
    routes_pct: number;
    votes_pct: number;
    overall_pct: number;
    routes_met: boolean;
    votes_met: boolean;
    is_eligible: boolean;
    missing: string[];
  };
  application: { id: number; status: string; application_type: string } | null;
}

// ── Главный компонент ────────────────────────────────────────────────────────

const PartnersPage: React.FC = () => {
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => unregisterPanel();
  }, [registerPanel, unregisterPanel]);

  const inner = isMobile ? <MobileView /> : <DesktopView />;

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        {inner}
      </MirrorGradientContainer>
    </>
  );
};

const DesktopView: React.FC = () => <PartnersContent />;
const MobileView: React.FC = () => (
  <div className="h-full overflow-y-auto centre-mobile-page">
    <PartnersContent />
  </div>
);

// ── Контент страницы ─────────────────────────────────────────────────────────

const PartnersContent: React.FC = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiClient
      .get<ProgressData>('/partners/progress')
      .then((r) => {
        if (r.data && r.data.ok) {
          setProgress(r.data);
        } else {
          // apiClient intercepts 500 and returns { data: null } — treat as error
          setError('Не удалось загрузить данные');
        }
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [user]);

  // Не авторизован — публичный лендинг
  if (!user) return <PublicLanding />;
  if (loading) return <Shell title="Партнёрская программа" subtitle="Загрузка..."><LoadingCard /></Shell>;
  if (error || !progress || !progress.progress) return <Shell title="Партнёрская программа" subtitle="Ошибка"><ErrorCard msg={error || 'Не удалось загрузить данные'} /></Shell>;

  const { partner_status } = progress;

  if (partner_status === 'partner' || partner_status === 'pro_guide') {
    return (
      <Shell
        title="Партнёрская программа"
        subtitle={partner_status === 'pro_guide' ? '👑 Эксперт ГеоБлог.рф' : '✅ Проверенный автор'}
      >
        <ActivePartnerCard status={partner_status} />
      </Shell>
    );
  }

  if (partner_status === 'pending') {
    return (
      <Shell title="Партнёрская программа" subtitle="Заявка на рассмотрении">
        <PendingCard application={progress.application} />
      </Shell>
    );
  }

  // none — основной экран с лестницей
  return (
    <Shell title="Партнёрская программа" subtitle="Создавай ценность. Получай признание.">
      <AboutCard />
      <ProgressLadder progress={progress} />
      <Path1Card progress={progress} />
      <ProGuideCallout />
      <FaqCard />
    </Shell>
  );
};

// ── Shell ────────────────────────────────────────────────────────────────────

const Shell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title, subtitle, children,
}) => (
  <div className="centre-scroll-area">
    <div className="centre-static-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={iconBoxStyle('#10B981')}>
          <Users size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--text-accent)', fontSize: '13px' }}>{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="centre-content" style={{ display: 'grid', gap: '16px' }}>
      {children}
    </div>
  </div>
);

// ── Публичный лендинг ────────────────────────────────────────────────────────

const PublicLanding: React.FC = () => (
  <Shell title="Партнёрская программа" subtitle="Создавай ценность. Получай признание.">
    <div className="centre-glass-card" style={heroCardStyle}>
      <div style={pillStyle}>
        <Sparkles size={14} />
        ГеоБлог.рф — партнёрам
      </div>
      <h2 style={heroTitleStyle}>🤝 Партнёрская программа</h2>
      <p style={heroTextStyle}>
        Лучшие маршруты создают те, кто путешествует с душой. Если твой контент помогает
        другим — мы хотим предложить тебе партнёрство с возможностью заработка на своём
        уникальном контенте.
      </p>
      <Link to="/login" style={primaryBtnStyle}>
        Войти и проверить прогресс <ArrowRight size={16} />
      </Link>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
      <BenefitCard icon={<Map size={20} />} title="15+ маршрутов" text="Публикуй качественные маршруты и наращивай портфолио" />
      <BenefitCard icon={<Star size={20} />} title="Положительные оценки" text="Маршруты, которые реально помогают путешественникам" />
      <BenefitCard icon={<Wallet size={20} />} title="15–25% комиссии" text="С каждого привлечённого подписчика и проданного пака" />
      <BenefitCard icon={<TrendingUp size={20} />} title="Рост вместе с нами" text="Чем больше продаж — тем выше ставка комиссии" />
    </div>

    <CommissionTable />
    <FaqCard />
  </Shell>
);

// ── О программе (краткая карточка) ──────────────────────────────────────────

const AboutCard: React.FC = () => (
  <div className="centre-glass-card" style={heroCardStyle}>
    <div style={pillStyle}>
      <Sparkles size={14} />
      партнёрская программа
    </div>
    <h2 style={heroTitleStyle}>Два пути к партнёрству</h2>
    <p style={heroTextStyle}>
      Выбери свой путь: органически вырасти внутри платформы, набирая опыт и аудиторию,
      или подай заявку профессионального гида — если у тебя уже есть аудитория и опыт вне ГеоБлог.
    </p>
  </div>
);

// ── Лестница прогресса (Путь 1) ──────────────────────────────────────────────

const ProgressLadder: React.FC<{ progress: ProgressData }> = ({ progress }) => {
  const { stats, requirements, progress: p } = progress;

  return (
    <div className="centre-glass-card">
      <div style={sectionTitleStyle}>
        <TrendingUp size={18} />
        <span>Мой прогресс к партнёрству</span>
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>
        {/* Маршруты */}
        <ProgressRow
          label="Опубликованные маршруты"
          current={stats.published_routes}
          required={requirements.routes_needed}
          pct={p.routes_pct}
          met={p.routes_met}
          hint={`${stats.published_routes} из ${requirements.routes_needed} маршрутов`}
        />

        {/* Голоса */}
        <ProgressRow
          label="Положительные оценки маршрутов"
          current={stats.positive_votes}
          required={requirements.positive_votes_needed}
          pct={p.votes_pct}
          met={p.votes_met}
          hint={`${stats.positive_votes} из ${requirements.positive_votes_needed} оценок`}
        />
      </div>

      {/* Общий прогресс */}
      <div style={{ marginTop: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--cg-text-muted)' }}>Общий прогресс</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: p.is_eligible ? '#10B981' : 'var(--glass-text)' }}>
            {p.overall_pct}%
          </span>
        </div>
        <div style={progressBarTrackStyle}>
          <div
            style={{
              ...progressBarFillStyle,
              width: `${p.overall_pct}%`,
              background: p.is_eligible
                ? 'linear-gradient(90deg, #10B981, #059669)'
                : 'linear-gradient(90deg, #F59E0B, #D97706)',
            }}
          />
        </div>
      </div>

      {p.is_eligible && (
        <div style={eligibleBannerStyle}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>Все требования выполнены! Подай заявку в блоке ниже ↓</span>
        </div>
      )}

      {!p.is_eligible && p.missing.length > 0 && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '6px' }}>
          {p.missing.map((m) => (
            <div key={m} style={missingItemStyle}>
              <span style={{ color: '#F59E0B' }}>→</span>
              <span style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProgressRow: React.FC<{
  label: string; current: number; required: number;
  pct: number; met: boolean; hint: string;
}> = ({ label, pct, met, hint }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ fontSize: '13px', color: 'var(--glass-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {met && <CheckCircle2 size={14} color="#10B981" />}
        {label}
      </span>
      <span style={{ fontSize: '12px', color: met ? '#10B981' : 'var(--cg-text-muted)' }}>
        {hint}
      </span>
    </div>
    <div style={progressBarTrackStyle}>
      <div
        style={{
          ...progressBarFillStyle,
          width: `${pct}%`,
          background: met
            ? 'linear-gradient(90deg, #10B981, #059669)'
            : 'linear-gradient(90deg, rgba(249,115,22,0.8), rgba(249,115,22,0.5))',
        }}
      />
    </div>
  </div>
);

// ── Путь 1: Органический ─────────────────────────────────────────────────────

const Path1Card: React.FC<{ progress: ProgressData }> = ({ progress }) => {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !about.trim()) return;
    setStatus('sending');
    try {
      await apiClient.post('/partners/apply', { name, about });
      setStatus('ok');
    } catch (reqErr: any) {
      setErrMsg(reqErr?.response?.data?.message || 'Ошибка при отправке');
      setStatus('error');
    }
  };

  const isEligible = progress?.progress?.is_eligible ?? false;

  return (
    <div className="centre-glass-card">
      <div style={sectionTitleStyle}>
        <TrendingUp size={18} />
        <span>🚀 Путь 1: Ты уже в проекте</span>
      </div>
      <p style={{ color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
        Если ты активный пользователь, который создаёт маршруты — когда требования будут выполнены,
        мы предложим тебе статус Партнёра. Ты также можешь подать заявку самостоятельно.
      </p>

      <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
        {[
          'Открывается доступ к дашборду создателя',
          'Сможешь публиковать платные паки',
          'Получишь реферальный процент (15–25%)',
          'Бейдж «Проверенный автор» в профиле',
        ].map((item) => (
          <div key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={15} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: '13px', color: 'var(--cg-text-muted)' }}>{item}</span>
          </div>
        ))}
      </div>

      {status === 'ok' ? (
        <div style={successBannerStyle}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>Заявка отправлена! Ожидай ответа в течение 3–5 рабочих дней.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Твоё имя / никнейм</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к тебе обращаться?"
              style={inputStyle}
              disabled={!isEligible || status === 'sending'}
              title={!isEligible ? 'Выполни все требования, чтобы подать заявку' : undefined}
            />
          </div>
          <div>
            <label style={labelStyle}>Расскажи о себе и маршрутах</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Какие маршруты ты создаёшь, что тебя мотивирует, как помогаешь путешественникам..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              disabled={!isEligible || status === 'sending'}
            />
          </div>
          {status === 'error' && (
            <div style={{ color: '#EF4444', fontSize: '13px' }}>{errMsg}</div>
          )}
          <button
            type="submit"
            disabled={!isEligible || !name.trim() || !about.trim() || status === 'sending'}
            style={isEligible ? primaryBtnStyle : disabledBtnStyle}
          >
            <Send size={15} />
            {status === 'sending' ? 'Отправка...' : 'Подать заявку'}
          </button>
          {!isEligible && (
            <p style={{ fontSize: '12px', color: 'var(--cg-text-muted)', margin: 0 }}>
              Форма активируется, когда все требования будут выполнены.
            </p>
          )}
        </form>
      )}
    </div>
  );
};

const ProGuideCallout: React.FC = () => (
  <div className="centre-glass-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
    <div style={sectionTitleStyle}>
      <Mountain size={18} />
      <span>🏔️ Если ты опытный гид</span>
    </div>
    <p style={{ color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
      На этой странице приведены цели и проценты только для активных авторов, которые развивают свой контент в ГеоБлоге.
      Если у тебя уже есть своя аудитория, канал и ты хочешь предложить эксклюзивные пакеты — заполни заявку, и мы пришлём индивидуальное предложение.
    </p>
    <ul style={{ color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.6, marginLeft: '20px', marginBottom: '12px' }}>
      <li>Выделенная канал-реферальная ссылка</li>
      <li>Ставки по подпискам: 10‑25% для Paid Premium (10/25/50/100+)</li>
      <li>Ставки по кураторским пакам: 15‑30% (10/25/50/100+)</li>
      <li>Условия согласуются с менеджером</li>
    </ul>
    <Link to="/partner/apply" style={{ ...primaryBtnStyle, textDecoration: 'none' }}>
      Заполнить заявку профессионального гида
    </Link>
  </div>
);

const CommissionTable: React.FC = () => (
  <div className="centre-glass-card">
    <div style={sectionTitleStyle}>
      <Wallet size={18} />
      <span>Система комиссий</span>
    </div>
    <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
      {partnerTiers.map(({ id, name, packs, referrals, sub, hint }) => (
        <div key={id} style={commRowStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--glass-text)' }}>{name}</div>
            <div style={{ fontSize: '11px', color: 'var(--cg-text-muted)' }}>{hint}</div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
            <CommCell label="Паки" val={packs} />
            <CommCell label="Рефсылка" val={referrals} />
            <CommCell label="Подписки" val={sub} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CommCell: React.FC<{ label: string; val: string }> = ({ label, val }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '15px', fontWeight: 700, color: 'rgb(249,115,22)' }}>{val}</div>
    <div style={{ fontSize: '10px', color: 'var(--cg-text-muted)' }}>{label}</div>
  </div>
);

// ── Статус: заявка на рассмотрении ──────────────────────────────────────────

const PendingCard: React.FC<{ application: ProgressData['application'] }> = ({ application }) => (
  <div className="centre-glass-card" style={heroCardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <Clock size={28} color="#F59E0B" />
      <h3 style={{ margin: 0, color: 'var(--glass-text)' }}>Заявка на рассмотрении</h3>
    </div>
    <p style={{ color: 'var(--cg-text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
      Мы проверим качество твоего контента и свяжемся с тобой в течение 3–5 рабочих дней.
      {application && ` Тип заявки: ${application.application_type === 'pro_guide' ? 'Про-Гид' : 'Органический путь'}.`}
    </p>
    <p style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>
      Вопросы? Пишите: <strong>partners@geoblog.rf</strong>
    </p>
  </div>
);

// ── Статус: активный партнёр ─────────────────────────────────────────────────

const ActivePartnerCard: React.FC<{ status: 'partner' | 'pro_guide' }> = ({ status }) => (
  <div className="centre-glass-card" style={heroCardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      {status === 'pro_guide'
        ? <span style={{ fontSize: '28px' }}>👑</span>
        : <CheckCircle2 size={28} color="#10B981" />}
      <h3 style={{ margin: 0, color: 'var(--glass-text)' }}>
        {status === 'pro_guide' ? 'Эксперт ГеоБлог.рф' : 'Проверенный автор'}
      </h3>
    </div>
    <p style={{ color: 'var(--cg-text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
      {status === 'pro_guide'
        ? 'Ты Pro-Гид с повышенной комиссией и персональным менеджером. Все инструменты доступны в панели.'
        : 'Статус Партнёра активен. Создавай паки, отслеживай рефералов и выводи комиссию в дашборде.'}
    </p>
    <Link to="/partner" style={primaryBtnStyle}>
      Перейти в партнёрскую панель <ArrowRight size={16} />
    </Link>
  </div>
);

// ── FAQ ──────────────────────────────────────────────────────────────────────

const faqItems = [
  { q: 'Как быстро рассматривается заявка?', a: '3–5 рабочих дней. Мы проверяем качество контента и связываемся по email.' },
  { q: 'Когда я смогу вывести комиссию?', a: 'После одобрения в каждом расчётном периоде. Минимальная сумма выплаты — 1 000 ₽.' },
  { q: 'Можно ли одновременно быть и Pro-подписчиком и Партнёром?', a: 'Да. Это независимые статусы. Партнёр дополнительно может оформить Pro, чтобы использовать офлайн-карты.' },
  { q: 'Что такое Про-Гид?', a: 'Статус по персональному приглашению для профессиональных гидов с аудиторией. Повышенные ставки и персональный менеджер.' },
  { q: 'Как считается рейтинг?', a: 'Мы учитываем количество опубликованных маршрутов и сумму положительных оценок от других пользователей.' },
];

const FaqCard: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="centre-glass-card">
      <div style={sectionTitleStyle}>
        <span style={{ fontSize: '16px' }}>❓</span>
        <span>Частые вопросы</span>
      </div>
      <div style={{ marginTop: '12px', display: 'grid', gap: '4px' }}>
        {faqItems.map((item, i) => (
          <div key={i} style={faqItemStyle}>
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              style={faqQStyle}
            >
              <span>{item.q}</span>
              {openIdx === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openIdx === i && (
              <p style={{ margin: '6px 0 4px', color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                {item.a}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Вспомогательные компоненты ───────────────────────────────────────────────

const BenefitCard: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="centre-glass-card" style={{ padding: '16px' }}>
    <div style={{ color: 'rgb(249,115,22)', marginBottom: '8px' }}>{icon}</div>
    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--glass-text)', marginBottom: '4px' }}>{title}</div>
    <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)', lineHeight: 1.5 }}>{text}</div>
  </div>
);

const LoadingCard: React.FC = () => (
  <div className="centre-glass-card" style={heroCardStyle}>
    <span style={{ color: 'var(--cg-text-muted)' }}>Загрузка данных партнёра...</span>
  </div>
);

const ErrorCard: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="centre-glass-card" style={{ ...heroCardStyle, borderColor: 'rgba(239,68,68,0.3)' }}>
    <span style={{ color: '#EF4444' }}>{msg}</span>
  </div>
);

// ── Стили ────────────────────────────────────────────────────────────────────

const iconBoxStyle = (color: string): React.CSSProperties => ({
  width: 34, height: 34,
  borderRadius: 12, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
  color: '#fff',
  flexShrink: 0,
});

const heroCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(249,115,22,0.05))',
  border: '1px solid rgba(16,185,129,0.2)',
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'rgba(249,115,22,0.12)',
  color: 'rgb(249,115,22)',
  fontSize: '11px', fontWeight: 600,
  padding: '3px 10px', borderRadius: '20px',
  marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: '20px', fontWeight: 800,
  color: 'var(--glass-text)', margin: '0 0 8px',
};

const heroTextStyle: React.CSSProperties = {
  color: 'var(--cg-text-muted)', fontSize: '14px',
  lineHeight: 1.65, margin: '0 0 18px',
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  fontSize: '15px', fontWeight: 700, color: 'var(--glass-text)',
  marginBottom: '12px',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderRadius: '10px',
  background: 'linear-gradient(135deg, rgba(249,115,22,0.9), rgba(234,88,12,0.8))',
  color: '#fff', fontWeight: 700, fontSize: '14px',
  border: 'none', cursor: 'pointer', textDecoration: 'none',
};

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--cg-text-muted)',
  cursor: 'not-allowed',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
  color: 'var(--glass-text)', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px',
  color: 'var(--cg-text-muted)', marginBottom: '5px', fontWeight: 500,
};

const progressBarTrackStyle: React.CSSProperties = {
  height: '6px', borderRadius: '3px',
  background: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%', borderRadius: '3px',
  transition: 'width 0.4s ease',
};

const eligibleBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
  color: '#10B981', fontSize: '14px', fontWeight: 600,
};

const successBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '12px 16px', borderRadius: '10px',
  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
  color: '#10B981', fontSize: '14px', fontWeight: 600,
};

const missingItemStyle: React.CSSProperties = {
  display: 'flex', gap: '8px',
  padding: '6px 10px', borderRadius: '8px',
  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
};

const accordionHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', background: 'none', border: 'none',
  cursor: 'pointer', padding: 0, color: 'inherit',
};

const commRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderRadius: '10px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
  gap: '12px', flexWrap: 'wrap',
};

const faqItemStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  padding: '8px 0',
};

const faqQStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', background: 'none', border: 'none',
  cursor: 'pointer', color: 'var(--glass-text)', fontSize: '14px',
  fontWeight: 600, textAlign: 'left', gap: '8px', padding: 0,
};

export default PartnersPage;
