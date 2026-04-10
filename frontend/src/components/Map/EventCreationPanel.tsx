import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import MapCreationPanelShell from './MapCreationPanelShell';
import { DiscoveredPlace } from '../../services/placeDiscoveryService';

export interface EventCreationPayload {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  category: string;
  location: string;
}

interface EventCreationPanelProps {
  coords: [number, number];
  discoveredPlace: DiscoveredPlace | null;
  isMobile: boolean;
  isTwoPanelMode: boolean;
  onSubmit: (payload: EventCreationPayload) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  { id: 'festival', label: 'Фестиваль' },
  { id: 'concert', label: 'Концерт' },
  { id: 'exhibition', label: 'Выставка' },
  { id: 'sport', label: 'Спорт' },
  { id: 'other', label: 'Другое' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const fieldStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'rgba(255,255,255,0.48)',
  padding: '9px 12px',
  outline: 'none',
  color: 'var(--glass-text, #111827)',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--glass-text-secondary, #6b7280)',
  marginBottom: 4,
};

const mobileStepperStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 10,
};

const mobileStepChipStyle = (isActive: boolean, accent: string): React.CSSProperties => ({
  flex: 1,
  borderRadius: 14,
  minHeight: 56,
  padding: '10px 12px',
  border: `1px solid ${isActive ? `${accent}55` : 'rgba(148, 163, 184, 0.18)'}`,
  background: isActive ? `linear-gradient(135deg, ${accent}18, rgba(255,255,255,0.72))` : 'rgba(255,255,255,0.5)',
  color: isActive ? 'var(--glass-text, #111827)' : 'var(--glass-text-secondary, #6b7280)',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  lineHeight: 1.15,
  boxSizing: 'border-box',
});

const mobileActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
};

const EventCreationPanel: React.FC<EventCreationPanelProps> = ({
  coords,
  discoveredPlace,
  isMobile,
  isTwoPanelMode,
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('festival');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState(0);

  useEffect(() => {
    setTitle('');
    setStartDate(todayIso());
    setEndDate('');
    setDescription('');
    setCategory('festival');
    setLocation('');
    setError(null);
    setMobileStep(0);
  }, [coords[0], coords[1]]);

  useEffect(() => {
    if (!discoveredPlace) {
      return;
    }

    setLocation((current) => current || discoveredPlace.address || discoveredPlace.name || '');
  }, [discoveredPlace]);

  const summary = useMemo(() => {
    if (discoveredPlace?.name || discoveredPlace?.address) {
      return `${discoveredPlace.name || 'Место события'}${discoveredPlace.address ? ` · ${discoveredPlace.address}` : ''}`;
    }

    return `Координаты: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
  }, [coords, discoveredPlace]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      if (isMobile) {
        setMobileStep(0);
      }
      setError('Введите название события');
      return;
    }

    if (!startDate) {
      if (isMobile) {
        setMobileStep(1);
      }
      setError('Укажите дату начала');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        category,
        location: location.trim(),
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Не удалось добавить событие');
    } finally {
      setSaving(false);
    }
  };

  const mobileSteps = [
    {
      id: 'base',
      label: '1/3',
      title: 'Основа',
      hint: 'Название события и его тип.',
      content: (
        <>
          {discoveredPlace && (
            <div style={{ borderRadius: 16, padding: 12, background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.14)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 4 }}>Точка события</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--glass-text, #111827)' }}>{discoveredPlace.name || 'Выбранное место'}</div>
              <div style={{ fontSize: 12, marginTop: 3, color: 'var(--glass-text-secondary, #6b7280)' }}>{discoveredPlace.address}</div>
            </div>
          )}

          <div>
            <div style={labelStyle}>Название события</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} placeholder="Например, вечерний концерт у набережной" autoFocus />
          </div>

          <div>
            <div style={labelStyle}>Категория</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
              {CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </>
      ),
    },
    {
      id: 'time',
      label: '2/3',
      title: 'Когда и где',
      hint: 'Дата старта, дата окончания и площадка.',
      content: (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div>
              <div style={labelStyle}>Дата начала</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <div style={labelStyle}>Дата окончания</div>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Место</div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle} placeholder="Адрес или название площадки" />
          </div>
        </>
      ),
    },
    {
      id: 'details',
      label: '3/3',
      title: 'Описание',
      hint: 'Коротко объясните, что будет происходить.',
      content: (
        <div>
          <div style={labelStyle}>Описание</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldStyle, minHeight: 150, resize: 'vertical' }} placeholder="Коротко опишите, что будет происходить" />
        </div>
      ),
    },
  ];

  const isLastMobileStep = mobileStep === mobileSteps.length - 1;
  const mobileFooter = isMobile ? (
    <div style={mobileActionsStyle}>
      <button
        type="button"
        onClick={() => {
          if (mobileStep === 0) {
            onCancel();
            return;
          }

          setMobileStep((current) => Math.max(0, current - 1));
        }}
        style={{
          flex: 1,
          borderRadius: 14,
          border: '1px solid rgba(148, 163, 184, 0.22)',
          background: 'rgba(255,255,255,0.78)',
          color: 'var(--glass-text-secondary, #6b7280)',
          padding: '11px 14px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {mobileStep === 0 ? 'Отмена' : 'Назад'}
      </button>
      {isLastMobileStep ? (
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1.2,
            borderRadius: 14,
            border: '1px solid rgba(139, 92, 246, 0.18)',
            background: saving ? 'rgba(139,92,246,0.45)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            color: '#fff',
            padding: '11px 14px',
            cursor: saving ? 'default' : 'pointer',
            fontWeight: 700,
            boxShadow: '0 14px 28px rgba(139, 92, 246, 0.22)',
          }}
        >
          {saving ? 'Сохраняем...' : 'Добавить событие'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMobileStep((current) => Math.min(mobileSteps.length - 1, current + 1))}
          style={{
            flex: 1.2,
            borderRadius: 14,
            border: '1px solid rgba(139, 92, 246, 0.18)',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            color: '#fff',
            padding: '11px 14px',
            cursor: 'pointer',
            fontWeight: 700,
            boxShadow: '0 14px 28px rgba(139, 92, 246, 0.22)',
          }}
        >
          Далее
        </button>
      )}
    </div>
  ) : null;

  return (
    <MapCreationPanelShell
      title="Добавить событие"
      subtitle={summary}
      icon={<CalendarPlus size={18} />}
      accentColor="#8b5cf6"
      isMobile={isMobile}
      isTwoPanelMode={isTwoPanelMode}
      onClose={onCancel}
      footer={mobileFooter}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14, minHeight: isMobile ? '100%' : undefined }}>
        {isMobile ? (
          <>
            <div style={mobileStepperStyle}>
              {mobileSteps.map((step, index) => (
                <button key={step.id} type="button" onClick={() => setMobileStep(index)} style={{ ...mobileStepChipStyle(index === mobileStep, '#8b5cf6'), boxShadow: index === mobileStep ? '0 12px 24px rgba(139, 92, 246, 0.16)' : 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, lineHeight: 1 }}>{step.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.15, color: index === mobileStep ? '#6d28d9' : undefined }}>{step.title}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, lineHeight: 1.35, marginTop: -2, marginBottom: 0, color: 'var(--glass-text-secondary, #6b7280)' }}>
              {mobileSteps[mobileStep].hint}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {mobileSteps[mobileStep].content}

              {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}
            </div>
          </>
        ) : (
          <>
            {discoveredPlace && (
              <div style={{ borderRadius: 16, padding: 12, background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.14)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 4 }}>Точка события</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--glass-text, #111827)' }}>{discoveredPlace.name || 'Выбранное место'}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: 'var(--glass-text-secondary, #6b7280)' }}>{discoveredPlace.address}</div>
              </div>
            )}

            <div>
              <div style={labelStyle}>Название события</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} placeholder="Например, вечерний концерт у набережной" autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={labelStyle}>Дата начала</div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <div style={labelStyle}>Дата окончания</div>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={fieldStyle} />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Категория</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
                {CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Место</div>
              <input value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle} placeholder="Адрес или название площадки" />
            </div>

            <div>
              <div style={labelStyle}>Описание</div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldStyle, minHeight: 110, resize: 'vertical' }} placeholder="Коротко опишите, что будет происходить" />
            </div>

            {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  border: '1px solid rgba(148, 163, 184, 0.22)',
                  background: 'rgba(255,255,255,0.34)',
                  color: 'var(--glass-text-secondary, #6b7280)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  border: '1px solid rgba(139, 92, 246, 0.18)',
                  background: saving ? 'rgba(139,92,246,0.45)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  color: '#fff',
                  padding: '12px 14px',
                  cursor: saving ? 'default' : 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 14px 28px rgba(139, 92, 246, 0.22)',
                }}
              >
                {saving ? 'Сохраняем...' : 'Добавить событие'}
              </button>
            </div>
          </>
        )}
      </form>
    </MapCreationPanelShell>
  );
};

export default EventCreationPanel;