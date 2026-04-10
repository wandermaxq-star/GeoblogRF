import React, { useState } from 'react';
import { ArrowLeft, Send, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import CentreBackground from '../components/Centre/CentreBackground';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import apiClient from '../api/apiClient';

const PartnerApply: React.FC = () => {
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await apiClient.post('/api/partners/apply', { name, about });
      setStatus('ok');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Ошибка');
      setStatus('error');
    }
  };

  const content = (
    <>
      <div className="centre-static-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.95), rgba(234, 88, 12, 0.85))', color: '#fff' }}>
              <Users size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Стать партнёром</h2>
              <p style={{ margin: '2px 0 0 0', color: 'var(--text-accent)', fontSize: '13px' }}>
                Заявка на участие в программе ГеоБлог.рф
              </p>
            </div>
          </div>
          <Link to="/partners" style={backLinkStyle}>
            <ArrowLeft size={16} />
            <span>Назад к Партнёрам</span>
          </Link>
        </div>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content" style={{ display: 'grid', gap: '16px' }}>
          <div className="centre-glass-card" style={heroCardStyle}>
            <div style={pillStyle}>
              <Sparkles size={15} />
              onboarding партнёра
            </div>
            <h2 style={heroTitleStyle}>Подай заявку без отдельной админки</h2>
            <p style={heroTextStyle}>
              Расскажи, кто ты, какие маршруты ведёшь и как собираешься привлекать аудиторию. После модерации заявка попадёт в партнёрский workflow.
            </p>
          </div>

          {status === 'ok' ? (
            <div className="centre-glass-card" style={successCardStyle}>
              <div style={{ color: 'var(--glass-text)', fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>
                Заявка отправлена
              </div>
              <div style={{ color: 'var(--cg-text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
                Спасибо. Мы сохранили твою заявку и проверим её в админке партнёрской программы.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/pro" style={primaryLinkStyle}>Вернуться в PRO</Link>
                <Link to="/partner" style={secondaryLinkStyle}>Открыть партнёрскую панель</Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 0.8fr)', gap: '16px' }}>
              <form className="centre-glass-card" onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Никнейм / имя</label>
                  <input
                    style={fieldStyle}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например, Анна, гид по Золотому кольцу"
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>О себе / про проект</label>
                  <textarea
                    style={{ ...fieldStyle, minHeight: '150px', resize: 'vertical' }}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Опиши маршруты, свою аудиторию и как ты хочешь использовать партнёрскую программу"
                    required
                  />
                </div>

                {status === 'error' && <div style={errorBannerStyle}>{error}</div>}

                <button type="submit" style={{ ...primaryButtonStyle, opacity: status === 'sending' ? 0.7 : 1 }} disabled={status === 'sending'}>
                  <Send size={16} />
                  <span>{status === 'sending' ? 'Отправляем...' : 'Отправить заявку'}</span>
                </button>
              </form>

              <div className="centre-glass-card" style={sideCardStyle}>
                <div style={{ color: 'var(--glass-text)', fontWeight: 700, fontSize: '16px', marginBottom: '10px' }}>
                  Что указать в заявке
                </div>
                <div style={{ display: 'grid', gap: '8px', color: 'var(--cg-text-muted)', fontSize: '13px', lineHeight: 1.55 }}>
                  <div>Какие маршруты, города или форматы поездок ты уже ведёшь.</div>
                  <div>Есть ли у тебя блог, Telegram, VK, сайт или оффлайн-аудитория.</div>
                  <div>Какой тип контента ты хочешь продвигать: curated-паки, поездки, гидовые подборки.</div>
                  <div>Почему твоё участие полезно для каталога и конверсии в PRO.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <CentreBackground />
        <div className="h-full overflow-y-auto centre-mobile-page">
          {content}
        </div>
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        {content}
      </MirrorGradientContainer>
    </>
  );
};

const heroCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.08) 48%, rgba(15, 118, 110, 0.08) 100%)',
  borderColor: 'rgba(249, 115, 22, 0.22)',
};

const successCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(5, 150, 105, 0.08))',
  borderColor: 'rgba(16, 185, 129, 0.24)',
};

const sideCardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12), rgba(8, 145, 178, 0.08))',
  borderColor: 'rgba(59, 130, 246, 0.24)',
  alignSelf: 'start',
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--glass-text)',
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '8px',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--glass-text)',
  padding: '12px 14px',
  outline: 'none',
  fontSize: '14px',
};

const errorBannerStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.22)',
  background: 'rgba(239, 68, 68, 0.10)',
  color: 'var(--glass-text)',
  fontSize: '13px',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(14, 165, 233, 0.38)',
  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.28), rgba(15, 118, 110, 0.24))',
  color: 'var(--glass-text)',
  fontWeight: 700,
  cursor: 'pointer',
};

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--glass-text)',
  fontWeight: 600,
  textDecoration: 'none',
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

const secondaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--glass-text)',
  fontWeight: 600,
  textDecoration: 'none',
};

export default PartnerApply;
