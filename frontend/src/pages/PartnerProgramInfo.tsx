import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Users, Wallet, TrendingUp, Check, Globe } from 'lucide-react';
import CentreBackground from '../components/Centre/CentreBackground';
import { partnerTiers } from '../data/partnerTiers';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';

const PartnerProgramInfo: React.FC = () => {
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  const tierBenefits: Record<string, string[]> = {
    newbie: ['Реферальная ссылка', 'Базовая статистика', 'Поддержка'],
    expert: ['Выделение профиля', 'Бейдж «Гид-партнёр»', 'Приоритет в каталоге', 'Бонусы'],
    top: ['Персональный менеджер', 'Lifetime 5–10%', 'Эксклюзивные возможности'],
    pro_guide: ['Персональный менеджер', 'Проактивный запуск', 'Эксклюзивная поддержка']
  };

  const tiers = partnerTiers.map((tier) => ({
    ...tier,
    minReq: tier.minReq || tier.hint,
    commission: tier.packs,
    benefits: tierBenefits[tier.id] ?? [],
    marked: tier.id === 'expert'
  }));

  // реальные примеры дохода партнёра по шагам
  // 349₽ × количество подписок × ставка комиссии
  const earnings = [
    { users: 10, monthly: '≈ 350 ₽', label: '10 подписчиков × 15%' },
    { users: 25, monthly: '≈ 1 310 ₽', label: '25 подписчиков × 15%' },
    { users: 50, monthly: '≈ 3 490 ₽', label: '50 подписчиков × 20%' },
    { users: 100, monthly: '≈ 8 725 ₽', label: '100+ подписчиков × 25%' }
  ];
  // styling helpers for earning cards
  const earningsCardStyle = (index: number) => {
    const base: React.CSSProperties = { borderColor: 'rgba(249, 115, 22, 0.2)' };
    switch (index) {
      case 1: // bronze
        return { ...base, borderColor: '#cd7f32', background: 'rgba(205,127,50,0.05)' };
      case 2: // silver
        return { ...base, borderColor: '#c0c0c0', background: 'rgba(192,192,192,0.05)' };
      case 3: // gold
        return { ...base, borderColor: '#ffd700', background: 'rgba(255,215,0,0.08)' };
      default:
        return base; // white/default
    }
  };
  const cardLabelColor = (index: number) => {
    switch (index) {
      case 1: return '#cd7f32';
      case 2: return '#555';
      case 3: return '#b8860b';
      default: return 'var(--text-accent)';
    }
  };
  const cardValueColor = (index: number) => {
    switch (index) {
      case 1: return '#cd7f32';
      case 2: return '#999';
      case 3: return '#b8860b';
      default: return 'rgb(249, 115, 22)';
    }
  };
  const benefits = [
    { icon: '🎯', title: 'Монетизируй свой контент', desc: 'Приглашай через свою уникальную ссылку и получай комиссию' },
    { icon: '📈', title: 'Растуми доход', desc: 'Начни с 15% и достигни 25% комиссии при высокой активности' },
    { icon: '🗺️', title: 'Продвигай маршруты', desc: 'Создавай curated-пакеты и зарабатывай на каждой приведённой подписке' },
    { icon: '👥', title: 'Сообщество гидов', desc: 'Присоединись к сообществу локальных экспертов по всей России' },
    { icon: '💼', title: 'Профиль партнёра', desc: 'Выделенный профиль с бейджем и приоритетом в каталоге' },
    { icon: '⏰', title: 'Flexible график', desc: 'Зарабатывай в удобное время, без фиксированного плана' }
  ];

  const faqItems = [
    {
      q: 'Кто может стать партнёром?',
      a: 'Любой, кто создал минимум 3 качественных маршрута, путеводителя или метки. Или гид со своим curated-пакетом.'
    },
    {
      q: 'Как часто выплачиваются комиссии?',
      a: 'Комиссии рассчитываются ежемесячно. Выплаты начиная с суммы 1500 ₽, автоматически на карту по СБП или другим способам.'
    },
    {
      q: 'Что если пользователь отменит подписку?',
      a: 'Комиссия считается только за активные платежи. Если подписка отменена в течение пробного периода, комиссия не начисляется.'
    },
    {
      q: 'Можно ли отслеживать прогресс?',
      a: 'Да! В панели партнёра видна вся статистика в реальном времени: клики, регистрации, подписки, комиссия.'
    },
    {
      q: 'Есть ли ограничения?',
      a: 'Запрещены спам, накрутки и обман. Мы оставляем право приостановить выплаты при нарушениях.'
    },
    {
      q: 'Как начать?',
      a: 'Просто нажми "Подать заявку" внизу. Заполни форму, укажи свои маршруты — и ориентируйся на одобрение!'
    }
  ];

  const heroCardStyle = {
    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.10) 100%)',
    borderColor: 'rgba(249, 115, 22, 0.25)'
  };

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.15)',
    color: 'var(--glass-text)',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '16px'
  };

  const primaryActionStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgb(249, 115, 22) 0%, rgb(234, 88, 12) 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
  };

  const tierCardStyle = (color: string, marked: boolean) => ({
    background: marked
      ? `linear-gradient(135deg, rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2) 0%, rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.05) 100%)`
      : 'rgba(255,255,255,0.05)',
    borderColor: marked ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.4)` : 'rgba(255,255,255,0.1)',
    borderWidth: marked ? '2px' : '1px',
    transform: marked ? 'scale(1.02)' : 'scale(1)'
  });

  const content = (
    <>
      <div className="centre-static-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.95), rgba(234, 88, 12, 0.85))', color: '#fff', fontSize: '20px' }}>
            💰
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Партнёрская программа</h2>
            <p style={{ margin: '2px 0 0 0', color: 'var(--text-accent)', fontSize: '13px' }}>
              Зарабатывай на маршрутах и подписках
            </p>
          </div>
        </div>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content" style={{ display: 'grid', gap: '20px' }}>

          {/* HERO блок */}
          <div className="centre-glass-card" style={heroCardStyle}>
            <div style={pillStyle}>
              <Sparkles size={15} />
              ГеоПартнёр
            </div>
            <h1 style={{ color: 'var(--glass-text)', fontSize: isMobile ? '24px' : '32px', margin: '0 0 12px 0', lineHeight: 1.2 }}>
              Монетизируй свои маршруты и аудиторию
            </h1>
            <p style={{ color: 'var(--cg-text-muted)', fontSize: isMobile ? '13px' : '15px', lineHeight: 1.6, margin: '0 0 20px 0', maxWidth: '600px' }}>
              Получай комиссию от каждой подписки, привлечённой через твою реферальную ссылку. Начни зарабатывать с первого дня.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/partner/apply" style={{ ...primaryActionStyle, textDecoration: 'none', color: '#fff' }}>
                <Users size={18} />
                <span>Подать заявку</span>
              </Link>
              <Link to="/partner" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'var(--glass-text)', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', textDecoration: 'none', cursor: 'pointer' }}>
                <span>Моя панель</span>
              </Link>
            </div>
          </div>

          {/* Примеры заработков */}
          <div>
            <h3 style={{ color: 'var(--glass-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 14px 0' }}>📊 Примеры заработков</h3>
            {/* earnings blocks: first three in row, fourth gold centered below */}
          {isMobile ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {earnings.map((e, i) => (
                <div key={i} className="centre-glass-card" style={earningsCardStyle(i)}>
                  <div style={{ color: cardLabelColor(i), fontSize: '12px', marginBottom: '8px' }}>{e.label}</div>
                  <div style={{ color: cardValueColor(i), fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{e.monthly}</div>
                  <div style={{ color: 'var(--cg-text-muted)', fontSize: '11px' }}>примерный доход партнёра по указанной ставке комиссии</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                {earnings.slice(0, 3).map((e, i) => (
                  <div key={i} className="centre-glass-card" style={earningsCardStyle(i)}>
                    <div style={{ color: cardLabelColor(i), fontSize: '12px', marginBottom: '8px' }}>{e.label}</div>
                    <div style={{ color: cardValueColor(i), fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{e.monthly}</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '11px' }}>примерный доход партнёра по указанной ставке комиссии</div>
                  </div>
                ))}
              </div>
              {earnings[3] && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                  <div className="centre-glass-card" style={{ ...earningsCardStyle(3), boxShadow: '0 0 8px rgba(255,215,0,0.6)' }}>
                    <div style={{ color: cardLabelColor(3), fontSize: '12px', marginBottom: '8px' }}>{earnings[3].label}</div>
                    <div style={{ color: cardValueColor(3), fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{earnings[3].monthly}</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '11px' }}>примерный доход партнёра по указанной ставке комиссии</div>
                  </div>
                </div>
              )}
            </>
          )}
          </div>

          {/* Уровни партнеров */}
          <div>
            <h3 style={{ color: 'var(--glass-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 14px 0' }}>🎯 Уровни партнеров</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
              {tiers.map((tier, i) => (
                <div key={i} className="centre-glass-card" style={{...tierCardStyle(tier.color || '#ffffff', tier.marked || false), minHeight: '280px', display: 'flex', flexDirection: 'column' }}>
                  {tier.marked && (
                    <div style={{ display: 'inline-block', background: tier.color || '#000', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, marginBottom: '10px', width: 'fit-content' }}>
                      РЕКОМЕНДУЕМ
                    </div>
                  )}
                  <div style={{ color: 'var(--glass-text)', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{tier.name}</div>
                  <div style={{ color: 'var(--cg-text-muted)', fontSize: '11px', marginBottom: '12px' }}>Требование: {tier.minReq}</div>
                  <div style={{ color: tier.color, fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>{tier.commission}</div>
                  <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)', lineHeight: 1.6, flex: 1 }}>
                    {tier.benefits.map((b, j) => (
                      <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ color: tier.color }}>✓</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Преимущества */}
          <div>
            <h3 style={{ color: 'var(--glass-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 14px 0' }}>✨ Почему это выгодно?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
              {benefits.map((b, i) => (
                <div key={i} className="centre-glass-card" style={{ borderColor: 'rgba(15, 118, 110, 0.2)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{b.icon}</div>
                  <div style={{ color: 'var(--glass-text)', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{b.title}</div>
                  <div style={{ color: 'var(--cg-text-muted)', fontSize: '12px', lineHeight: 1.5 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Как это работает */}
          <div>
            <h3 style={{ color: 'var(--glass-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 14px 0' }}>🚀 Как это работает?</h3>
            <div className="centre-glass-card" style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.3)', color: '#0EA5E9', fontWeight: 700, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ color: 'var(--glass-text)', fontWeight: 700, marginBottom: '4px' }}>Подай заявку</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>Расскажи о себе, своих маршрутах и аудитории</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.3)', color: '#0EA5E9', fontWeight: 700, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ color: 'var(--glass-text)', fontWeight: 700, marginBottom: '4px' }}>Получи реф-ссылку</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>После одобрения заявки получи уникальный код для приглашения</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.3)', color: '#0EA5E9', fontWeight: 700, flexShrink: 0 }}>3</div>
                  <div>
                    <div style={{ color: 'var(--glass-text)', fontWeight: 700, marginBottom: '4px' }}>Делись в соцсетях</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>Публикуй в Telegram, VK, TikTok, Instagram. Люди переходят по твоей ссылке</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.3)', color: '#0EA5E9', fontWeight: 700, flexShrink: 0 }}>4</div>
                  <div>
                    <div style={{ color: 'var(--glass-text)', fontWeight: 700, marginBottom: '4px' }}>Зарабатывай комиссию</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>15 %, 20 % или 25 % от каждой подписки, привлечённой по твоей ссылке</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.3)', color: '#0EA5E9', fontWeight: 700, flexShrink: 0 }}>5</div>
                  <div>
                    <div style={{ color: 'var(--glass-text)', fontWeight: 700, marginBottom: '4px' }}>Выведи деньги</div>
                    <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px' }}>Ежемесячные выплаты (минимум 1500 ₽) на карту по СБП</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h3 style={{ color: 'var(--glass-text)', fontSize: '18px', fontWeight: 700, margin: '0 0 14px 0' }}>❓ Частые вопросы</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {faqItems.map((item, i) => (
                <details key={i} className="centre-glass-card" style={{ cursor: 'pointer', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <summary style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: '14px', userSelect: 'none', outline: 'none' }}>
                    {item.q}
                  </summary>
                  <div style={{ color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.6, marginTop: '10px' }}>
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* FINAL CTA */}
          <div className="centre-glass-card" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(20, 184, 166, 0.12) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎯</div>
            <h2 style={{ color: 'var(--glass-text)', fontSize: isMobile ? '18px' : '22px', margin: '0 0 8px 0' }}>Готов начать?</h2>
            <p style={{ color: 'var(--cg-text-muted)', fontSize: '14px', margin: '0 0 16px 0' }}>
              Прими участие в программе ГеоБлог и получай комиссию с каждого приглашённого подписчика
            </p>
            <Link to="/partner/apply" style={{ ...primaryActionStyle, textDecoration: 'none', color: '#fff' }}>
              <Sparkles size={18} />
              <span>Подать заявку сейчас</span>
              <ArrowRight size={18} />
            </Link>
          </div>

        </div>
      </div>
    </>
  );

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        {content}
      </MirrorGradientContainer>
    </>
  );
};

export default PartnerProgramInfo;
