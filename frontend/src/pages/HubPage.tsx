// frontend/src/pages/HubPage.tsx
// Route Hub — каталог паков сообщества с фильтрами, рейтингами и деталями
import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, ThumbsUp, ThumbsDown, Search,
  MapPin, Clock, Ruler, Crown, Package, ChevronDown, X,
  Share2, Loader2, Check, Navigation
} from 'lucide-react';
import CentreBackground from '../components/Centre/CentreBackground';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useIsMobile } from '../hooks/use-mobile';
import { useAuth } from '../contexts/AuthContext';
import {
  getHubPacks, getHubPack, ratePack, purchaseHubPack, getMyVote
} from '../services/routePackService';
import type { RoutePackSubmission, RouteKind, HubFilters } from '../types/routePackSubmission';
import { ROUTE_KIND_LABELS } from '../types/routePackSubmission';

// ─────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────

function formatDist(m?: number) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(0)} км` : `${m} м`;
}
function formatDur(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

// SVG-превью маршрута в миниатюре карточки
function MiniRouteSvg({ polyline, color = '#a78bfa' }: { polyline?: [number, number][]; color?: string }) {
  if (!polyline || polyline.length < 2) return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(167,139,250,0.3)', fontSize: 11,
    }}>
      нет маршрута
    </div>
  );

  const W = 200, H = 80, PAD = 8;
  const lons = polyline.map(p => p[1]);
  const lats = polyline.map(p => p[0]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const rangeX = maxLon - minLon || 1, rangeY = maxLat - minLat || 1;
  const step = Math.max(1, Math.floor(polyline.length / 60));
  const pts = polyline
    .filter((_, i) => i % step === 0 || i === polyline.length - 1)
    .map(([lat, lon]) => {
      const x = PAD + ((lon - minLon) / rangeX) * (W - PAD * 2);
      const y = PAD + (1 - (lat - minLat) / rangeY) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`mg-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none"
        stroke={`url(#mg-${color.replace('#', '')})`}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[0]?.split(',')[0]} cy={pts[0]?.split(',')[1]} r="4"
        fill="#22d3ee" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r="4"
        fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Карточка пака в Hub
// ─────────────────────────────────────────────────────────────
interface HubPackCardProps {
  pack: RoutePackSubmission;
  onClick: () => void;
  compact?: boolean;
}
function HubPackCard({ pack, onClick, compact }: HubPackCardProps) {
  const priceLabel = pack.price === 0 ? 'БЕСПЛАТНО' : `${pack.price} ₽`;
  const priceColor = pack.price === 0 ? '#10B981' : '#22d3ee';

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.2s ease',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(167,139,250,0.3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      {/* SVG превью */}
      <div style={{
        height: 90, background: 'rgba(15,23,42,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', overflow: 'hidden',
      }}>
        <MiniRouteSvg polyline={pack.polyline} />
        {/* Бейджи */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
          <span style={{
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            color: priceColor, fontWeight: 800, fontSize: 11,
            border: `1px solid ${priceColor}44`,
          }}>
            {priceLabel}
          </span>
        </div>
        {pack.is_exclusive && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <span style={{
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(245,158,11,0.2)', backdropFilter: 'blur(4px)',
              color: '#F59E0B', fontWeight: 700, fontSize: 11,
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Crown size={10} />EXCLUSIVE
            </span>
          </div>
        )}
      </div>

      {/* Контент */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4, lineHeight: 1.3 }}>
          {pack.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          {pack.highlight || pack.subtitle}
        </div>

        {/* Метрики */}
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
          {pack.distance_meters && <span>📏 {formatDist(pack.distance_meters)}</span>}
          {pack.duration_seconds && <span>⏱ {formatDur(pack.duration_seconds)}</span>}
          <span style={{ marginLeft: 'auto', color: ROUTE_KIND_LABELS[pack.route_kind] ? 'rgba(255,255,255,0.35)' : 'transparent' }}>
            {ROUTE_KIND_LABELS[pack.route_kind]}
          </span>
        </div>

        {/* Рейтинг + Автор */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ThumbsUp size={12} style={{ color: '#10B981' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              {pack.rating_avg > 0 ? pack.rating_avg.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              ({pack.rating_count})
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {pack.author_name}
          </span>
        </div>

        {/* Теги */}
        {pack.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
            {pack.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                padding: '2px 7px', borderRadius: 999,
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.4)', fontSize: 10,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Детальный modal пака
// ─────────────────────────────────────────────────────────────
function HubPackDetailModal({
  pack: initialPack,
  onClose,
  onOpenInPlanner,
}: {
  pack: RoutePackSubmission;
  onClose: () => void;
  onOpenInPlanner: (pack: RoutePackSubmission) => void;
}) {
  const { user } = useAuth();
  const [pack, setPack] = useState(initialPack);
  const [myVote, setMyVote] = useState<1 | -1 | null>(null);
  const [voting, setVoting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Загружаем полные данные (с polyline)
    getHubPack(pack.id).then(setPack).catch(() => {});
    if (user) getMyVote(pack.id).then(setMyVote).catch(() => {});
  }, [pack.id, user]);

  const handleVote = async (vote: 1 | -1) => {
    if (!user || voting) return;
    setVoting(true);
    try {
      const res = await ratePack(pack.id, vote);
      setPack(prev => ({ ...prev, rating_avg: res.rating_avg, rating_count: res.rating_count }));
      setMyVote(myVote === vote ? null : vote);
    } catch {} finally { setVoting(false); }
  };

  const handlePurchase = async () => {
    if (!user || purchasing) return;
    setPurchasing(true);
    try {
      await purchaseHubPack(pack.id);
      setPurchased(true);
    } catch {} finally { setPurchasing(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/hub?pack=${pack.id}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 680, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(10,15,30,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: pack.price === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(34,211,238,0.15)',
                  color: pack.price === 0 ? '#10B981' : '#22d3ee',
                  border: `1px solid ${pack.price === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(34,211,238,0.3)'}`,
                }}>
                  {pack.price === 0 ? 'БЕСПЛАТНО' : `${pack.price} ₽`}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11,
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)',
                }}>
                  {ROUTE_KIND_LABELS[pack.route_kind]}
                </span>
                {pack.is_exclusive && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Crown size={10} /> EXCLUSIVE
                  </span>
                )}
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.95)', lineHeight: 1.3 }}>
                {pack.title}
              </h2>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                {pack.subtitle}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', flexShrink: 0, padding: 4, marginTop: -4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {/* SVG Preview */}
          <div style={{ height: 140, background: 'rgba(15,23,42,0.6)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <MiniRouteSvg polyline={pack.polyline} />
          </div>

          {/* Метрики */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { icon: <Ruler size={14} />, label: 'Дистанция', value: formatDist(pack.distance_meters) },
              { icon: <Clock size={14} />, label: 'Время', value: formatDur(pack.duration_seconds) },
              { icon: <ThumbsUp size={14} />, label: 'Рейтинг', value: pack.rating_avg > 0 ? `${pack.rating_avg.toFixed(1)} (${pack.rating_count})` : 'нет' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  {m.icon}
                  <span style={{ fontSize: 10 }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Описание */}
          {pack.summary && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: '0 0 16px' }}>
              {pack.summary}
            </p>
          )}

          {/* Точки маршрута */}
          {pack.waypoints?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                Точки маршрута ({pack.waypoints.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pack.waypoints.slice(0, 8).map((wp, i) => (
                  <div key={wp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                  }}>
                    <MapPin size={12} style={{ color: '#22d3ee', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                      {i + 1}. {wp.title}
                    </span>
                    {wp.isRequired && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, color: '#22d3ee',
                        background: 'rgba(34,211,238,0.1)', padding: '2px 6px', borderRadius: 99,
                      }}>
                        обязательная
                      </span>
                    )}
                  </div>
                ))}
                {pack.waypoints.length > 8 && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    и ещё {pack.waypoints.length - 8} точек...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Автор */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Автор</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{pack.author_name}</div>
            {pack.author_bio && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{pack.author_bio}</div>}
          </div>

          {/* Теги */}
          {pack.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {pack.tags.map(tag => (
                <span key={tag} style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', fontSize: 12,
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '14px 24px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
        }}>
          {/* Лайки */}
          {user && (
            <>
              <button disabled={voting} onClick={() => handleVote(1)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: myVote === 1 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${myVote === 1 ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: myVote === 1 ? '#10B981' : 'rgba(255,255,255,0.6)',
              }}>
                <ThumbsUp size={14} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{pack.rating_count > 0 ? pack.rating_count : ''}</span>
              </button>
              <button disabled={voting} onClick={() => handleVote(-1)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: myVote === -1 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${myVote === -1 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: myVote === -1 ? '#EF4444' : 'rgba(255,255,255,0.6)',
              }}>
                <ThumbsDown size={14} />
              </button>
            </>
          )}

          {/* Поделиться */}
          <button onClick={handleCopy} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            color: copied ? '#10B981' : 'rgba(255,255,255,0.6)',
          }}>
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span style={{ fontSize: 12 }}>{copied ? 'Скопировано!' : 'Поделиться'}</span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Открыть в Plannero */}
          <button onClick={() => onOpenInPlanner(pack)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13,
          }}>
            <Navigation size={14} /> Открыть в Planner
          </button>

          {/* Купить / уже куплен */}
          {pack.price > 0 && !purchased && (
            <button onClick={handlePurchase} disabled={!user || purchasing} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 10, cursor: user ? 'pointer' : 'default',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.8), rgba(167,139,250,0.8))',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
              opacity: !user ? 0.5 : 1,
            }}>
              {purchasing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {purchasing ? 'Покупка...' : `Купить — ${pack.price} ₽`}
            </button>
          )}
          {pack.price === 0 && (
            <button onClick={() => onOpenInPlanner(pack)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.8), rgba(34,211,238,0.8))',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
            }}>
              Использовать бесплатно
            </button>
          )}
          {purchased && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#10B981', fontWeight: 700, fontSize: 13,
            }}>
              <Check size={16} /> Куплено!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Фильтры Hub
// ─────────────────────────────────────────────────────────────
function HubFiltersBar({
  filters, onChange
}: {
  filters: HubFilters;
  onChange: (f: Partial<HubFilters>) => void;
}) {
  const kinds: { value: RouteKind | ''; label: string }[] = [
    { value: '', label: 'Все типы' },
    { value: 'regional', label: 'Региональные' },
    { value: 'federal', label: 'Федеральные' },
    { value: 'event', label: 'Событийные' },
  ];
  const sorts: { value: HubFilters['sort']; label: string }[] = [
    { value: 'popular', label: 'Популярные' },
    { value: 'new', label: 'Новые' },
    { value: 'rating', label: 'По рейтингу' },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Поиск */}
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
        <Search size={14} style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
        }} />
        <input
          value={filters.q || ''}
          onChange={e => onChange({ q: e.target.value, offset: 0 })}
          placeholder="Поиск..."
          style={{
            width: '100%', padding: '8px 10px 8px 30px', boxSizing: 'border-box',
            borderRadius: 8, background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Тип маршрута */}
      <select
        value={filters.kind || ''}
        onChange={e => onChange({ kind: e.target.value as RouteKind | '', offset: 0 })}
        style={{
          padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'inherit',
        }}
      >
        {kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>

      {/* Цена */}
      <select
        value={filters.free || ''}
        onChange={e => onChange({ free: e.target.value as '' | 'true' | 'false', offset: 0 })}
        style={{
          padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'inherit',
        }}
      >
        <option value="">Любая цена</option>
        <option value="true">Бесплатные</option>
        <option value="false">Платные</option>
      </select>

      {/* Сортировка */}
      <select
        value={filters.sort || 'popular'}
        onChange={e => onChange({ sort: e.target.value as HubFilters['sort'], offset: 0 })}
        style={{
          padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'inherit',
        }}
      >
        {sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Основной компонент HubContent
// ─────────────────────────────────────────────────────────────
function HubContent({ compact }: { compact: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<RoutePackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPack, setSelectedPack] = useState<RoutePackSubmission | null>(null);
  const [filters, setFilters] = useState<HubFilters>({
    sort: 'popular', limit: 12, offset: 0,
  });

  const loadPacks = useCallback(async (f: HubFilters, append = false) => {
    setLoading(true);
    try {
      const result = await getHubPacks(f);
      setPacks(prev => append ? [...prev, ...result] : result);
      setHasMore(result.length === (f.limit || 12));
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadPacks(filters);
  }, [filters.kind, filters.free, filters.sort, filters.q]);

  const updateFilters = (partial: Partial<HubFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  };

  const loadMore = () => {
    const newFilters = { ...filters, offset: (filters.offset || 0) + (filters.limit || 12) };
    setFilters(newFilters);
    loadPacks(newFilters, true);
  };

  const handleOpenInPlanner = (pack: RoutePackSubmission) => {
    try {
      sessionStorage.setItem('hub_pack_to_load', JSON.stringify({
        id: pack.id,
        title: pack.title,
        waypoints: pack.waypoints,
        polyline: pack.polyline,
      }));
    } catch {}
    navigate('/planner');
  };

  return (
    <>
      {/* Заголовок */}
      <div className="centre-static-header">
        <div style={{ fontSize: compact ? '24px' : '32px', marginBottom: compact ? '8px' : '12px' }}>
          <Globe size={compact ? 28 : 36} style={{ color: '#22d3ee' }} />
        </div>
        <h1 style={{ fontSize: compact ? '20px' : '28px', fontWeight: '700', color: 'var(--glass-text)', margin: '0 0 4px 0' }}>
          Маршрутный Хаб
        </h1>
        <p style={{ fontSize: compact ? '12px' : '14px', color: 'var(--text-accent)', margin: '0' }}>
          Паки от сообщества путешественников
        </p>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content" style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '16px' }}>

          {/* Фильтры */}
          <div className="centre-glass-card">
            <HubFiltersBar filters={filters} onChange={updateFilters} />
          </div>

          {/* Сетка паков */}
          <div className="centre-glass-card">
            {loading && packs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Загрузка паков...</div>
              </div>
            ) : packs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Package size={40} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                  Паков пока нет
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                  Станьте первым автором!
                </div>
                <a href="/planner" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.6), rgba(167,139,250,0.6))',
                  color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                }}>
                  <Navigation size={14} /> Создать маршрут
                </a>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '12px',
                  marginBottom: hasMore ? 16 : 0,
                }}>
                  {packs.map(pack => (
                    <HubPackCard
                      key={pack.id}
                      pack={pack}
                      compact={compact}
                      onClick={() => setSelectedPack(pack)}
                    />
                  ))}
                </div>

                {/* Load more */}
                {hasMore && (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      style={{
                        padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13,
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronDown size={14} />}
                      Загрузить ещё
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* CTA для авторов */}
          <div className="centre-glass-card" style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))',
            border: '1px solid rgba(167,139,250,0.2)',
            textAlign: 'center',
          }}>
            <Package size={24} style={{ color: '#a78bfa', marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              Поделитесь своим маршрутом
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Постройте маршрут в Планировщике, упакуйте его и публикуйте для всего сообщества.
              Зарабатывайте 70% с каждой продажи.
            </p>
            <a href="/planner" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(34,211,238,0.7), rgba(167,139,250,0.7))',
              color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}>
              <Navigation size={14} /> Открыть Планировщик
            </a>
          </div>
        </div>
      </div>

      {/* Детальный modal */}
      {selectedPack && (
        <HubPackDetailModal
          pack={selectedPack}
          onClose={() => setSelectedPack(null)}
          onOpenInPlanner={handleOpenInPlanner}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Экспорт страницы
// ─────────────────────────────────────────────────────────────
const HubPage: React.FC = () => {
  const isMobile = useIsMobile();
  usePanelRegistration();

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        <Suspense fallback={<div className="centre-scroll-area" />}>
          <HubContent compact={isMobile} />
        </Suspense>
      </MirrorGradientContainer>
    </>
  );
};

export default HubPage;
