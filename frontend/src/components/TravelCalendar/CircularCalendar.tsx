import React, { useState, useMemo, useCallback, useRef, useId, useEffect } from 'react';
import { MockEvent } from './mockEvents';
import './CircularCalendar.css';

interface CircularCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  events: MockEvent[];
  selectedDate: Date | null;
  onDateClick: (day: number, month: number, year: number) => void;
  onSearchClick?: () => void;
  onAddEventClick?: () => void;
}

const MONTH_NAMES = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
];

// Цвета максимально близко к эталону
const MONTH_COLORS = [
  '#3B82F6', '#06B6D4', '#10B981', '#22C55E', '#84CC16', '#EAB308',
  '#F97316', '#EF4444', '#F43F5E', '#A855F7', '#6366F1', '#8B5CF6',
];
const MONTH_COLORS_DARK = [
  '#2563EB', '#0891B2', '#059669', '#16A34A', '#65A30D', '#CA8A04',
  '#EA580C', '#DC2626', '#E11D48', '#9333EA', '#4F46E5', '#7C3AED',
];

const WEEKDAY_LETTERS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

// SVG размеры
const SIZE = 800;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 370;
const R_INNER = 180; // Было 135, стало 180 — месяцы дальше от центра

const polar = (r: number, angleDeg: number) => ({
  x: CX + r * Math.cos((angleDeg * Math.PI) / 180),
  y: CY + r * Math.sin((angleDeg * Math.PI) / 180),
});

const CircularCalendar: React.FC<CircularCalendarProps> = ({
  currentDate,
  onDateChange,
  onMonthChange,
  events,
  selectedDate,
  onDateClick,
  onSearchClick,
  onAddEventClick,
}) => {
  const year = currentDate.getFullYear();
  const [activeMonth, setActiveMonth] = useState(currentDate.getMonth());
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationAngle = -activeMonth * 30;
  // Уникальный ID экземпляра — предотвращает коллизию SVG gradient ID
  // при одновременном монтировании двух Calendar (leftPages + rightPages)
  const instanceId = useId().replace(/:/g, '');

  const getDaysInMonth = useCallback((monthIdx: number, yr: number) => {
    const daysCount = new Date(yr, monthIdx + 1, 0).getDate();
    const firstDay = new Date(yr, monthIdx, 1).getDay();
    const startPad = firstDay === 0 ? 6 : firstDay - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= daysCount; d++) days.push(d);
    return days;
  }, []);

  const segments = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const startAngle = -90 + i * 30;
      const endAngle = startAngle + 30;
      const midAngle = startAngle + 15;
      const p1 = polar(R_OUTER, startAngle);
      const p2 = polar(R_OUTER, endAngle);
      const p3 = polar(R_INNER, endAngle);
      const p4 = polar(R_INNER, startAngle);
      const d = [
        `M ${p1.x} ${p1.y}`,
        `A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y}`,
        `L ${p3.x} ${p3.y}`,
        `A ${R_INNER} ${R_INNER} 0 0 0 ${p4.x} ${p4.y}`,
        'Z',
      ].join(' ');

      const rMid = (R_OUTER + R_INNER) / 2 + 16; // Было +10, теперь +16 (примерно +3мм на SVG 800px)
      const miniPos = polar(rMid, midAngle);
      const daysArr = getDaysInMonth(i, year);
      const weeks: (number | null)[][] = [];
      for (let idx = 0; idx < daysArr.length; idx += 7) {
        weeks.push(daysArr.slice(idx, idx + 7));
      }

      const monthEvents = events.filter(ev => {
        const ed = new Date(ev.date);
        return ed.getMonth() === i && ed.getFullYear() === year;
      });
      const eventDays = new Set<number>();
      monthEvents.forEach(ev => {
        const ed = new Date(ev.date);
        if (ed.getMonth() === i) eventDays.add(ed.getDate());
      });

      return { index: i, d, color: MONTH_COLORS[i], colorDark: MONTH_COLORS_DARK[i], midAngle, miniPos, weeks, monthEvents, eventDays };
    });
  }, [year, events, getDaysInMonth]);

  const handleMonthClick = useCallback((monthIdx: number) => {
    if (monthIdx === activeMonth) {
      if (!isExpanded) setIsExpanded(true);
      return;
    }
    setIsExpanded(false);
    setActiveMonth(monthIdx);
    onMonthChange(new Date(year, monthIdx, 1));
  }, [year, onMonthChange, activeMonth, isExpanded]);

  const handleDayClick = useCallback((day: number | null, monthIdx: number) => {
    if (!day) return;
    onDateClick(day, monthIdx, year);
  }, [year, onDateClick]);

  const handlePrevYear = useCallback(() => {
    onDateChange(new Date(year - 1, activeMonth, 1));
  }, [year, activeMonth, onDateChange]);

  const handleNextYear = useCallback(() => {
    onDateChange(new Date(year + 1, activeMonth, 1));
  }, [year, activeMonth, onDateChange]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (isExpanded) return;
    setActiveMonth(prev => {
      if (e.deltaY > 0) return (prev + 1) % 12;
      return (prev - 1 + 12) % 12;
    });
  }, [isExpanded]);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isExpanded || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const distance = Math.hypot(dx, dy);
    const radius = Math.min(rect.width, rect.height) / 2;

    if (distance > radius) {
      setIsExpanded(false);
    }
  }, [isExpanded]);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const expandedWeeks = useMemo(() => {
    const days = getDaysInMonth(activeMonth, year);
    const weeks: (number | null)[][] = [];
    for (let idx = 0; idx < days.length; idx += 7) {
      weeks.push(days.slice(idx, idx + 7));
    }
    return weeks;
  }, [activeMonth, year, getDaysInMonth]);

  const expandedMonthTitle = useMemo(() => {
    const base = new Date(year, activeMonth, 1).toLocaleDateString('ru-RU', { month: 'long' });
    return base ? `${base.charAt(0).toUpperCase()}${base.slice(1)}` : '';
  }, [year, activeMonth]);

  const activeSegment = segments[activeMonth];

  return (
    <div className="ccal-wrapper" ref={wrapperRef}>
      <div
        ref={containerRef}
        className={`ccal-container ${isExpanded ? 'is-expanded' : ''}`}
        onClick={handleContainerClick}
      >
        {/* Вращающееся кольцо с белой подложкой внутри SVG */}
        <div
          className="ccal-ring"
          style={{ transform: `rotate(${rotationAngle}deg)` }}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="ccal-svg">
            {/* Белая подложка — только под кольцом */}
            <circle cx={CX} cy={CY} r={R_OUTER + 8} fill="#fff" opacity={1} />
            <defs>
              {segments.map(seg => (
                <linearGradient key={`grad-${seg.index}`} id={`seg-grad-${instanceId}-${seg.index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={seg.color} />
                  <stop offset="100%" stopColor={seg.colorDark} />
                </linearGradient>
              ))}
            </defs>
            {segments.map(seg => (
              <path
                key={seg.index}
                d={seg.d}
                fill={`url(#seg-grad-${instanceId}-${seg.index})`}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1.5}
                className={`ccal-segment ${seg.index === activeMonth ? 'active' : ''}`}
                onClick={() => handleMonthClick(seg.index)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </svg>

          {/* Мини-календари */}
          {segments.map(seg => {
            const leftPct = (seg.miniPos.x / SIZE) * 100;
            const topPct = (seg.miniPos.y / SIZE) * 100;
            const counterRotation = -rotationAngle;
            return (
              <div
                key={`mini-${seg.index}`}
                className={`ccal-mini ${seg.index === activeMonth ? 'active' : ''}`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: `translate(-50%, -50%) rotate(${counterRotation}deg)`,
                }}
                onClick={() => handleMonthClick(seg.index)}
              >
                <div className="ccal-mini-header">
                  <span className="ccal-mini-num">{String(seg.index + 1).padStart(2, '0')}</span>
                  <span className="ccal-mini-name">{MONTH_NAMES[seg.index]}</span>
                </div>
                <div className="ccal-mini-weekdays">
                  {WEEKDAY_LETTERS.map((wd, wi) => (
                    <span key={wi} className={`ccal-mini-wd ${wi >= 5 ? 'weekend' : ''}`}>{wd}</span>
                  ))}
                </div>
                <div className="ccal-mini-grid">
                  {seg.weeks.map((week, wi) => (
                    <div key={wi} className="ccal-mini-row">
                      {week.map((d, di) => {
                        const isToday = d === todayDay && seg.index === todayMonth && year === todayYear;
                        const isSelected = d !== null && selectedDate !== null &&
                          selectedDate.getDate() === d && selectedDate.getMonth() === seg.index && selectedDate.getFullYear() === year;
                        const hasEvent = d !== null && seg.eventDays.has(d);
                        return (
                          <button
                            key={di}
                            className={['ccal-mini-day', !d ? 'empty' : '', isToday ? 'today' : '', isSelected ? 'selected' : '', hasEvent ? 'has-event' : '', di >= 5 ? 'weekend' : ''].filter(Boolean).join(' ')}
                            onClick={(e) => { e.stopPropagation(); handleDayClick(d, seg.index); }}
                            disabled={!d}
                          >
                            {d || ''}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {seg.monthEvents.length > 0 && (
                  <div className="ccal-mini-badge">{seg.monthEvents.length}</div>
                )}
              </div>
            );
          })}
        </div>

        {isExpanded && (
          <div
            className={
              'ccal-expanded' +
              (expandedWeeks.length === 6 ? ' has-6-rows' : '')
            }
            style={{
              ['--month-color' as any]: activeSegment?.color || '#3B82F6',
            }}
          >
            <div className="ccal-expanded-header">
              <span className="ccal-expanded-title">
                <span className="ccal-expanded-title-month">{expandedMonthTitle}</span>
                <span className="ccal-expanded-title-year">{year}г</span>
              </span>
            </div>
            <div className="ccal-expanded-weekdays">
              {WEEKDAY_LETTERS.map((wd, wi) => (
                <span key={wi} className={`ccal-expanded-wd ${wi >= 5 ? 'weekend' : ''}`}>
                  {wd}
                </span>
              ))}
            </div>
            <div className="ccal-expanded-grid">
              {expandedWeeks.map((week, wi) => (
                <div key={wi} className="ccal-expanded-row">
                  {week.map((d, di) => {
                    const isToday = d === todayDay && activeMonth === todayMonth && year === todayYear;
                    const isSelected = d !== null && selectedDate !== null &&
                      selectedDate.getDate() === d && selectedDate.getMonth() === activeMonth && selectedDate.getFullYear() === year;
                    const hasEvent = d !== null && activeSegment?.eventDays?.has(d);
                    return (
                      <button
                        key={di}
                        className={[
                          'ccal-expanded-day',
                          !d ? 'empty' : '',
                          isToday ? 'today' : '',
                          isSelected ? 'selected' : '',
                          hasEvent ? 'has-event' : '',
                          di >= 5 ? 'weekend' : ''
                        ].filter(Boolean).join(' ')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(d, activeMonth);
                        }}
                        disabled={!d}
                      >
                        {d || ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Центр — НЕ вращается */}
        <div className="ccal-center">
          <button className="ccal-year-btn" onClick={handlePrevYear} aria-label="Предыдущий год">◀</button>
          <span className="ccal-year">{year}</span>
          <button className="ccal-year-btn" onClick={handleNextYear} aria-label="Следующий год">▶</button>
        </div>

        {/* Кнопки действий */}
        <div className="ccal-actions">
          {onSearchClick && (
            <button className="ccal-action-btn" onClick={onSearchClick}>
              <i className="fas fa-search" /> Поиск события
            </button>
          )}
          {onAddEventClick && (
            <button className="ccal-action-btn ccal-action-btn-primary" onClick={onAddEventClick}>
              <i className="fas fa-plus" /> Добавить событие
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CircularCalendar;

