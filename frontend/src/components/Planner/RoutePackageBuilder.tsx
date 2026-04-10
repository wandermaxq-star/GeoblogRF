// frontend/src/components/Planner/RoutePackageBuilder.tsx
// Главный UI для упаковки маршрута в пак — Route Pack Builder
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Package, X, ChevronRight, ChevronLeft, Check, AlertCircle,
  MapPin, Tag, DollarSign, ClipboardList, Loader2, Send, Star
} from 'lucide-react';
import { submitPack } from '../../services/routePackService';
import type { RouteKind, RoutePackWaypoint, RoutePackBuilderData } from '../../types/routePackSubmission';
import { getRoutePolyline } from '../../services/routingService';
import type { MarkerData } from '../../types/marker';

// ─────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────

const AUTHOR_SHARE = 70;
const DRAFT_KEY = 'route_pack_builder_draft';

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(0)} км`;
  return `${meters} м`;
}
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

// SVG-превью маршрута из массива координат
function RouteSvgPreview({ polyline }: { polyline: [number, number][] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  if (!polyline || polyline.length < 2) {
    return (
      <div style={{
        height: 120, borderRadius: 12,
        background: 'rgba(139,92,246,0.08)',
        border: '1px dashed rgba(139,92,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(139,92,246,0.5)', fontSize: 13,
      }}>
        Маршрут не загружен
      </div>
    );
  }

  // Нормализуем координаты под SVG canvas 280×100
  const W = 280, H = 100, PAD = 10;
  const lons = polyline.map(p => p[1]);
  const lats = polyline.map(p => p[0]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const rangeX = maxLon - minLon || 1;
  const rangeY = maxLat - minLat || 1;
  // Отображаем каждые N точек чтобы не перегружать
  const step = Math.max(1, Math.floor(polyline.length / 120));
  const pts = polyline
    .filter((_, i) => i % step === 0 || i === polyline.length - 1)
    .map(([lat, lon]) => {
      const x = PAD + ((lon - minLon) / rangeX) * (W - PAD * 2);
      const y = PAD + (1 - (lat - minLat) / rangeY) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ borderRadius: 12, background: 'rgba(15,23,42,0.6)', display: 'block' }}>
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Shadow */}
      <polyline points={pts.join(' ')} fill="none"
        stroke="rgba(167,139,250,0.25)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Main neon line */}
      <polyline points={pts.join(' ')} fill="none"
        stroke="url(#routeGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
        filter="url(#glow)" />
      {/* Start dot */}
      <circle cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r="5"
        fill="#22d3ee" stroke="#fff" strokeWidth="1.5" />
      {/* End dot */}
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="5"
        fill="#a78bfa" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Компоненты шагов
// ─────────────────────────────────────────────────────────────

interface StepperProps {
  current: number;
  labels: string[];
}
function Stepper({ current, labels }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: i < current
                ? 'linear-gradient(135deg, #22d3ee, #a78bfa)'
                : i === current
                  ? 'linear-gradient(135deg, #22d3ee55, #a78bfa55)'
                  : 'rgba(255,255,255,0.08)',
              border: i === current ? '2px solid #a78bfa' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              color: i <= current ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.25s ease',
            }}>
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <span style={{
              fontSize: 10, color: i === current ? '#a78bfa' : 'rgba(255,255,255,0.35)',
              fontWeight: i === current ? 700 : 400, whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div style={{
              flex: 1, height: 2,
              background: i < current
                ? 'linear-gradient(90deg, #22d3ee, #a78bfa)'
                : 'rgba(255,255,255,0.08)',
              marginBottom: 20, transition: 'background 0.25s ease',
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── ШАГ 1: Базовая информация ───────────────────────────────
interface Step1Props {
  data: RoutePackBuilderData;
  onChange: (partial: Partial<RoutePackBuilderData>) => void;
}
function Step1Info({ data, onChange }: Step1Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FieldGroup label="Название пака" hint={`${data.title.length}/80 символов`}>
        <input
          value={data.title}
          onChange={e => onChange({ title: e.target.value.slice(0, 80) })}
          placeholder="Например: Золотое кольцо — 7 дней"
          style={inputStyle}
        />
      </FieldGroup>

      <FieldGroup label="Подзаголовок" hint={`${data.subtitle.length}/120`}>
        <input
          value={data.subtitle}
          onChange={e => onChange({ subtitle: e.target.value.slice(0, 120) })}
          placeholder="Краткое описание в одну строку"
          style={inputStyle}
        />
      </FieldGroup>

      <FieldGroup label="Описание" hint={`${data.summary.length}/500`}>
        <textarea
          value={data.summary}
          onChange={e => onChange({ summary: e.target.value.slice(0, 500) })}
          placeholder="Подробнее о маршруте, что увидит путешественник..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </FieldGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FieldGroup label="Тип маршрута">
          <select
            value={data.route_kind}
            onChange={e => onChange({ route_kind: e.target.value as RouteKind })}
            style={inputStyle}
          >
            <option value="regional">Региональный</option>
            <option value="federal">Федеральный</option>
            <option value="event">Событийный</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Главная фраза" hint="до 60 символов">
          <input
            value={data.highlight}
            onChange={e => onChange({ highlight: e.target.value.slice(0, 60) })}
            placeholder="«Лучшие храмы России»"
            style={inputStyle}
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Ключевая метрика" hint="до 50 символов">
        <input
          value={data.hero_metric}
          onChange={e => onChange({ hero_metric: e.target.value.slice(0, 50) })}
          placeholder="1200 км · 14 дней · 23 точки"
          style={inputStyle}
        />
      </FieldGroup>

      <TagInput tags={data.tags} onChange={tags => onChange({ tags })} />
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      onChange([...tags, t]);
      setInput('');
    }
  };
  return (
    <FieldGroup label="Теги" hint={`${tags.length}/8`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {tags.map(tag => (
          <span key={tag} style={{
            padding: '3px 10px 3px 10px', borderRadius: 999,
            background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.3)',
            color: '#a78bfa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Добавить тег (Enter)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={add} disabled={!input.trim() || tags.length >= 8}
          style={{
            ...btnSecondaryStyle, padding: '0 14px',
            opacity: (!input.trim() || tags.length >= 8) ? 0.4 : 1,
          }}>
          +
        </button>
      </div>
    </FieldGroup>
  );
}

// ─── ШАГ 2: Маршрут и waypoints ─────────────────────────────
interface Step2Props {
  data: RoutePackBuilderData;
  onChange: (partial: Partial<RoutePackBuilderData>) => void;
}
function Step2Route({ data, onChange }: Step2Props) {
  const [newWpTitle, setNewWpTitle] = useState('');

  const addWaypoint = () => {
    if (!newWpTitle.trim()) return;
    const wp: RoutePackWaypoint = {
      id: `wp-${Date.now()}`,
      title: newWpTitle.trim(),
      coordinates: [0, 0],
      isRequired: false,
    };
    onChange({ waypoints: [...data.waypoints, wp] });
    setNewWpTitle('');
  };

  const toggleRequired = (id: string) => {
    onChange({
      waypoints: data.waypoints.map(wp =>
        wp.id === id ? { ...wp, isRequired: !wp.isRequired } : wp
      ),
    });
  };

  const removeWaypoint = (id: string) => {
    onChange({ waypoints: data.waypoints.filter(wp => wp.id !== id) });
  };

  const updateNote = (id: string, note: string) => {
    onChange({
      waypoints: data.waypoints.map(wp => wp.id === id ? { ...wp, note } : wp),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* SVG Preview */}
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Предпросмотр маршрута
        </div>
        <RouteSvgPreview polyline={data.polyline} />
        {data.distance_meters > 0 && (
          <div style={{
            display: 'flex', gap: 16, marginTop: 8,
            fontSize: 13, color: 'rgba(255,255,255,0.6)',
          }}>
            <span>📏 {formatDistance(data.distance_meters)}</span>
            {data.duration_seconds > 0 && <span>⏱ {formatDuration(data.duration_seconds)}</span>}
          </div>
        )}
      </div>

      {/* Waypoints */}
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Точки маршрута ({data.waypoints.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.waypoints.map((wp, i) => (
            <div key={wp.id} style={{
              padding: '10px 12px', borderRadius: 10,
              background: wp.isRequired ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${wp.isRequired ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: wp.note !== undefined ? 6 : 0 }}>
                <MapPin size={12} style={{ color: '#22d3ee', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                  {i + 1}. {wp.title}
                </span>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: wp.isRequired ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={wp.isRequired}
                    onChange={() => toggleRequired(wp.id)}
                    style={{ accentColor: '#22d3ee' }}
                  />
                  Обязательная
                </label>
                <button onClick={() => removeWaypoint(wp.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.7)', padding: 0 }}>
                  <X size={14} />
                </button>
              </div>
              <input
                value={wp.note || ''}
                onChange={e => updateNote(wp.id, e.target.value)}
                placeholder="Заметка о точке (опционально)"
                style={{ ...inputStyle, fontSize: 11, padding: '5px 8px' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={newWpTitle}
            onChange={e => setNewWpTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWaypoint(); } }}
            placeholder="Название новой точки"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addWaypoint} disabled={!newWpTitle.trim()} style={{
            ...btnSecondaryStyle, padding: '0 16px',
            opacity: !newWpTitle.trim() ? 0.4 : 1,
          }}>
            + Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ШАГ 3: Монетизация ──────────────────────────────────────
interface Step3Props {
  data: RoutePackBuilderData;
  onChange: (partial: Partial<RoutePackBuilderData>) => void;
}
function Step3Monetization({ data, onChange }: Step3Props) {
  const isFree = data.price === 0;
  const exampleSales = 10;
  const authorProfit = Math.round(data.price * AUTHOR_SHARE / 100) * exampleSales;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Free / Paid toggle */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: '🎁 Бесплатный', value: 0 },
          { label: '💳 Платный', value: data.price || 299 },
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => onChange({ price: opt.value })}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              border: (isFree ? opt.value === 0 : opt.value !== 0)
                ? '2px solid #a78bfa'
                : '2px solid rgba(255,255,255,0.12)',
              background: (isFree ? opt.value === 0 : opt.value !== 0)
                ? 'rgba(167,139,250,0.15)'
                : 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 14,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!isFree && (
        <FieldGroup label="Цена (₽)" hint="от 100 до 10 000 ₽, шаг 50">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min={100} max={2000} step={50}
              value={data.price}
              onChange={e => onChange({ price: parseInt(e.target.value) })}
              style={{ flex: 1, accentColor: '#a78bfa' }}
            />
            <div style={{
              minWidth: 80, textAlign: 'center',
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', fontWeight: 800, fontSize: 18,
            }}>
              {data.price} ₽
            </div>
          </div>
        </FieldGroup>
      )}

      {/* Exclusive toggle */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: data.is_exclusive ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${data.is_exclusive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={data.is_exclusive}
          onChange={e => onChange({ is_exclusive: e.target.checked })}
          style={{ accentColor: '#F59E0B', width: 16, height: 16 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: data.is_exclusive ? '#F59E0B' : 'rgba(255,255,255,0.8)' }}>
            ⭐ Эксклюзивный пак гида
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            Отображается с особой отметкой в Hub
          </div>
        </div>
      </label>

      {/* Revenue info */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>
          Распределение выручки
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}>{AUTHOR_SHARE}%</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>вам (автору)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{100 - AUTHOR_SHARE}%</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>платформе</div>
          </div>
        </div>
        {!isFree && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(16,185,129,0.08)',
            fontSize: 12, color: 'rgba(255,255,255,0.6)',
          }}>
            💡 При {exampleSales} продажах по {data.price}₽ ваш заработок составит{' '}
            <strong style={{ color: '#10B981' }}>{authorProfit.toLocaleString('ru-RU')} ₽</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ШАГ 4: Чеклист качества ─────────────────────────────────
interface CheckItem {
  id: string;
  label: string;
  pass: boolean;
  required: boolean;
}
function Step4Checklist({ data }: { data: RoutePackBuilderData }) {
  const checks: CheckItem[] = [
    { id: 'points', label: 'Маршрут содержит минимум 2 точки', pass: data.polyline.length >= 2, required: true },
    { id: 'distance', label: 'Дистанция более 5 км', pass: data.distance_meters >= 5000, required: true },
    { id: 'title', label: 'Название заполнено (мин. 5 символов)', pass: data.title.trim().length >= 5, required: true },
    { id: 'summary', label: 'Описание заполнено (мин. 30 символов)', pass: data.summary.trim().length >= 30, required: true },
    { id: 'tags', label: 'Добавлен хотя бы 1 тег', pass: data.tags.length > 0, required: true },
    { id: 'waypoints', label: 'Точки маршрута добавлены', pass: data.waypoints.length > 0, required: false },
    { id: 'hero', label: 'Заполнена ключевая метрика', pass: data.hero_metric.trim().length > 0, required: false },
    { id: 'subtitle', label: 'Заполнен подзаголовок', pass: data.subtitle.trim().length > 0, required: false },
  ];

  const requiredPassed = checks.filter(c => c.required).every(c => c.pass);
  const totalPassed = checks.filter(c => c.pass).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Прогресс */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: requiredPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${requiredPassed ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: requiredPassed ? '#10B981' : '#EF4444',
          marginBottom: 6,
        }}>
          {requiredPassed
            ? '✅ Пак готов к публикации'
            : '⚠️ Заполните обязательные поля'}
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${(totalPassed / checks.length) * 100}%`,
            background: requiredPassed ? '#10B981' : '#F59E0B',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
          {totalPassed} из {checks.length} пунктов выполнено
        </div>
      </div>

      {/* Список */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {checks.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: c.pass
                ? 'rgba(16,185,129,0.06)'
                : c.required
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(255,255,255,0.03)',
              border: `1px solid ${c.pass
                ? 'rgba(16,185,129,0.15)'
                : c.required
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s ease',
              animationDelay: `${i * 0.05}s`,
            }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: c.pass
                ? 'rgba(16,185,129,0.2)'
                : c.required
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(255,255,255,0.08)',
            }}>
              {c.pass
                ? <Check size={11} color="#10B981" />
                : c.required
                  ? <AlertCircle size={11} color="#EF4444" />
                  : <AlertCircle size={11} color="rgba(255,255,255,0.25)" />
              }
            </div>
            <span style={{
              fontSize: 13,
              color: c.pass
                ? 'rgba(255,255,255,0.85)'
                : c.required
                  ? 'rgba(239,68,68,0.9)'
                  : 'rgba(255,255,255,0.4)',
            }}>
              {c.label}
            </span>
            {!c.required && (
              <span style={{
                marginLeft: 'auto', fontSize: 10,
                color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap',
              }}>
                рекомендуется
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Общие стили
// ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.9)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  fontFamily: 'inherit',
};

function FieldGroup({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────

export interface RoutePackBuilderProps {
  // Вариант А: из Planner (готовая полилиния)
  polyline?: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
  initialWaypoints?: Array<{ title: string; coordinates: [number, number] }>;
  // Вариант Б: из Избранного (маршрут строится сам)
  sourceMarkers?: MarkerData[];
  onClose: () => void;
}

const STEP_LABELS = ['Информация', 'Маршрут', 'Монетизация', 'Проверка'];

export default function RoutePackageBuilder({
  polyline,
  distanceMeters,
  durationSeconds,
  initialWaypoints = [],
  sourceMarkers,
  onClose,
}: RoutePackBuilderProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildingRoute, setBuildingRoute] = useState(!!sourceMarkers && sourceMarkers.length >= 2);

  // Инициализация данных (с учётом черновика из localStorage)
  const [data, setData] = useState<RoutePackBuilderData>(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as RoutePackBuilderData;
        // Всегда используем свежий polyline из Planner
        return { ...parsed, polyline: polyline ?? [], distance_meters: distanceMeters ?? 0, duration_seconds: durationSeconds ?? 0 };
      }
    } catch {}
    const initDist = distanceMeters ?? 0;
    const initDur = durationSeconds ?? 0;
    return {
      title: '',
      subtitle: '',
      summary: '',
      route_kind: 'regional',
      tags: [],
      highlight: '',
      hero_metric: initDist > 0
        ? `${formatDistance(initDist)}${initDur > 0 ? ' · ' + formatDuration(initDur) : ''}`
        : '',
      polyline: polyline ?? [],
      waypoints: initialWaypoints.map((wp, i) => ({
        id: `init-${i}`,
        title: wp.title,
        coordinates: wp.coordinates,
        isRequired: i === 0 || i === initialWaypoints.length - 1,
      })),
      distance_meters: initDist,
      duration_seconds: initDur,
      variants: [{
        id: 'v1',
        title: 'Основной маршрут',
        summary: '',
        durationLabel: initDur > 0 ? formatDuration(initDur) : '',
        distanceLabel: initDist > 0 ? formatDistance(initDist) : '',
        estimatedBaseSizeMb: Math.max(10, Math.round(initDist / 10000)),
      }],
      price: 0,
      is_exclusive: false,
    };
  });

  // Строим маршрут сами, если переданы sourceMarkers (из Избранного)
  useEffect(() => {
    if (!sourceMarkers || sourceMarkers.length < 2) return;
    setBuildingRoute(true);
    const points: [number, number][] = sourceMarkers.map(m => [m.latitude, m.longitude]);
    getRoutePolyline(points, 'driving-car', 'fastest')
      .then(poly => {
        // Считаем приблизительное расстояние по полилинии
        let distM = 0;
        for (let i = 1; i < poly.length; i++) {
          const [lat1, lon1] = poly[i - 1];
          const [lat2, lon2] = poly[i];
          const R = 6371000;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          distM += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        const wps = sourceMarkers.map((m, i) => ({
          id: `src-${m.id}`,
          title: m.title,
          coordinates: [m.latitude, m.longitude] as [number, number],
          isRequired: i === 0 || i === sourceMarkers.length - 1,
        }));
        updateData({
          polyline: poly,
          distance_meters: Math.round(distM),
          waypoints: wps,
          hero_metric: `${formatDistance(Math.round(distM))} · ${sourceMarkers.length} точек`,
        });
      })
      .catch(err => setError('Не удалось построить маршрут: ' + (err?.message ?? '')))
      .finally(() => setBuildingRoute(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосохранение черновика
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const updateData = useCallback((partial: Partial<RoutePackBuilderData>) => {
    setData(prev => ({ ...prev, ...partial }));
  }, []);

  // Проверка готовности к публикации
  const canSubmit =
    data.polyline.length >= 2 &&
    data.distance_meters >= 5000 &&
    data.title.trim().length >= 5 &&
    data.summary.trim().length >= 30 &&
    data.tags.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitPack(data);
      setSubmitted(result);
      // Очистить черновик
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Экран загрузки маршрута (sourceMarkers mode) ─────────
  if (buildingRoute) {
    return (
      <div style={overlayStyle}>
        <div style={{
          ...modalStyle, alignItems: 'center', justifyContent: 'center',
          minHeight: 240, gap: 16,
        }}>
          <Loader2 size={36} style={{ color: '#22d3ee', animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Строим маршрут…
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {sourceMarkers?.length ?? 0} точек · ORS routing
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Экран успеха ─────────────────────────────────────────
  if (submitted) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #22d3ee33, #10B98133)',
              border: '2px solid #10B981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Check size={28} color="#10B981" />
            </div>
            <h2 style={{ color: 'rgba(255,255,255,0.95)', margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>
              Пак отправлен!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }}>
              Маршрутный пак «{data.title}» передан на модерацию.
              После одобрения он появится в Hub и станет доступен другим путешественникам.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '11px 24px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #22d3ee55, #a78bfa55)',
                  border: '1px solid rgba(167,139,250,0.4)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Основной UI ──────────────────────────────────────────
  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* Шапка */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 24px 0', marginBottom: 20, flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.2))',
            border: '1px solid rgba(167,139,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
              Упаковать маршрут
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Route Pack Builder
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Степпер */}
        <div style={{ padding: '0 24px', flexShrink: 0 }}>
          <Stepper current={step} labels={STEP_LABELS} />
        </div>

        {/* Контент шага */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {step === 0 && <Step1Info data={data} onChange={updateData} />}
          {step === 1 && <Step2Route data={data} onChange={updateData} />}
          {step === 2 && <Step3Monetization data={data} onChange={updateData} />}
          {step === 3 && <Step4Checklist data={data} />}
        </div>

        {/* Ошибка */}
        {error && (
          <div style={{
            margin: '0 24px', padding: '10px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444', fontSize: 13, flexShrink: 0,
          }}>
            {error}
          </div>
        )}

        {/* Навигация */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px 20px', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 16,
        }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              ...btnSecondaryStyle,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: step === 0 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={16} /> Назад
          </button>

          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(34,211,238,0.8), rgba(167,139,250,0.8))',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              Далее <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              style={{
                padding: '10px 24px', borderRadius: 10, cursor: canSubmit ? 'pointer' : 'default',
                background: canSubmit
                  ? 'linear-gradient(135deg, #10B981, #22d3ee)'
                  : 'rgba(255,255,255,0.08)',
                border: `1px solid ${canSubmit ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
                fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
                boxShadow: canSubmit ? '0 0 20px rgba(16,185,129,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {submitting
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Отправка...</>
                : <><Send size={16} /> Опубликовать</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Стили overlay и modal ─────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2000,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 620,
  maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  background: 'rgba(10,15,30,0.95)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(139,92,246,0.25)',
  borderRadius: 20,
  boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)',
  overflow: 'hidden',
};
