// frontend/src/components/Admin/PackSubmissionsPanel.tsx
// Панель модерации пользовательских паков маршрутов
import React, { useEffect, useState, useCallback } from 'react';
import {
  getAdminSubmissions, approvePack, rejectPack, sendToRevision
} from '../../services/routePackService';
import type { RoutePackSubmission, SubmissionStatus } from '../../types/routePackSubmission';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS, ROUTE_KIND_LABELS } from '../../types/routePackSubmission';
import { Check, X, RotateCcw, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';

// ─── SVG мини-превью маршрута ────────────────────────────────────────────────
function SmallRouteSvg({ polyline }: { polyline?: [number, number][] }) {
  if (!polyline || polyline.length < 2) return <span className="text-gray-400 text-xs">нет маршрута</span>;

  const W = 160, H = 60, PAD = 6;
  const lons = polyline.map(p => p[1]);
  const lats = polyline.map(p => p[0]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const rangeX = maxLon - minLon || 1, rangeY = maxLat - minLat || 1;
  const step = Math.max(1, Math.floor(polyline.length / 40));
  const pts = polyline
    .filter((_, i) => i % step === 0 || i === polyline.length - 1)
    .map(([lat, lon]) => {
      const x = PAD + ((lon - minLon) / rangeX) * (W - PAD * 2);
      const y = PAD + (1 - (lat - minLat) / rangeY) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 6 }}>
      <polyline points={pts.join(' ')} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      <circle cx={pts[0]?.split(',')[0]} cy={pts[0]?.split(',')[1]} r="4" fill="#22d3ee" />
      <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r="4" fill="#a78bfa" />
    </svg>
  );
}

// ─── Модалка с комментарием ───────────────────────────────────────────────────
function CommentModal({
  title, onConfirm, onClose
}: { title: string; onConfirm: (comment: string) => void; onClose: () => void }) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="font-bold text-gray-900 text-lg mb-3">{title}</h3>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Укажите причину или рекомендации..."
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-purple-500"
        />
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 text-sm font-medium">
            Отмена
          </button>
          <button onClick={() => onConfirm(comment)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold shadow hover:opacity-90">
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Строка-карточка одного пака ──────────────────────────────────────────────
function SubmissionRow({
  pack, onAction
}: {
  pack: RoutePackSubmission;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<'reject' | 'revision' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doApprove = async () => {
    setLoading(true);
    try { await approvePack(pack.id); onAction(); }
    catch (e: any) { setError(e.message || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const doReject = async (comment: string) => {
    setLoading(true); setModal(null);
    try { await rejectPack(pack.id, comment); onAction(); }
    catch (e: any) { setError(e.message || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const doRevision = async (comment: string) => {
    setLoading(true); setModal(null);
    try { await sendToRevision(pack.id, comment); onAction(); }
    catch (e: any) { setError(e.message || 'Ошибка'); }
    finally { setLoading(false); }
  };

  const statusColor = SUBMISSION_STATUS_COLORS[pack.status as SubmissionStatus] || 'gray';
  const statusLabel = SUBMISSION_STATUS_LABELS[pack.status as SubmissionStatus] || pack.status;

  return (
    <>
      {modal === 'reject' && (
        <CommentModal
          title="Отклонить пак — укажите причину"
          onConfirm={doReject}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'revision' && (
        <CommentModal
          title="Отправить на доработку — укажите замечания"
          onConfirm={doRevision}
          onClose={() => setModal(null)}
        />
      )}

      <div className={`border rounded-xl mb-3 overflow-hidden transition-all ${
        expanded ? 'border-purple-300 shadow-md' : 'border-gray-200'
      }`}>
        {/* Заголовок строки */}
        <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpanded(v => !v)}>
          {/* SVG */}
          <div className="flex-shrink-0">
            <SmallRouteSvg polyline={pack.polyline} />
          </div>

          {/* Основная инфа */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-gray-900 text-sm">{pack.title}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold`}
                style={{ background: `${statusColor}22`, color: statusColor }}>
                {statusLabel}
              </span>
              {pack.is_exclusive && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                  EXCLUSIVE
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Автор: <span className="font-medium">{pack.author_name}</span>
              {' · '}
              {ROUTE_KIND_LABELS[pack.route_kind]}
              {' · '}
              {pack.price === 0 ? 'Бесплатный' : `${pack.price} ₽`}
              {pack.distance_meters && ` · ${(pack.distance_meters / 1000).toFixed(0)} км`}
            </div>
          </div>

          {/* Кнопки действий */}
          {pack.status === 'pending' && (
            <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <button disabled={loading} onClick={doApprove}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Одобрить
              </button>
              <button disabled={loading} onClick={() => setModal('revision')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow">
                <RotateCcw size={12} />
                Доработка
              </button>
              <button disabled={loading} onClick={() => setModal('reject')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow">
                <X size={12} />
                Отклонить
              </button>
            </div>
          )}

          <div className="text-gray-400 flex-shrink-0 ml-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Детали */}
        {expanded && (
          <div className="border-t border-gray-100 p-4 bg-gray-50 text-sm text-gray-700">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 text-xs">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {pack.summary && (
              <div className="mb-3">
                <span className="font-semibold text-gray-900">Описание: </span>
                {pack.summary}
              </div>
            )}
            {pack.tags?.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {pack.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {pack.waypoints?.length > 0 && (
              <div className="mb-3">
                <span className="font-semibold text-gray-900">Точки ({pack.waypoints.length}): </span>
                {pack.waypoints.slice(0, 5).map((wp, i) => (
                  <span key={wp.id}>{i > 0 ? ' → ' : ''}{wp.title}</span>
                ))}
                {pack.waypoints.length > 5 && <span> и ещё {pack.waypoints.length - 5}...</span>}
              </div>
            )}
            {pack.moderation_comment && (
              <div className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 mt-2">
                <b>Предыдущий комментарий модератора:</b> {pack.moderation_comment}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Главный компонент панели ─────────────────────────────────────────────────
const PackSubmissionsPanel: React.FC = () => {
  const [status, setStatus] = useState<SubmissionStatus | 'all'>('pending');
  const [packs, setPacks] = useState<RoutePackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAdminSubmissions(status === 'all' ? undefined : status);
      setPacks(list);
      // Пересчитаем счётчики по статусам
      const counts: Record<string, number> = {};
      for (const p of list) {
        counts[p.status] = (counts[p.status] || 0) + 1;
      }
      setTotal(prev => ({ ...prev, ...counts }));
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const statuses: { value: SubmissionStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'pending', label: 'Ожидают' },
    { value: 'approved', label: 'Одобрены' },
    { value: 'rejected', label: 'Отклонены' },
    { value: 'revision', label: 'На доработке' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Паки маршрутов</h2>
          <p className="text-gray-500 text-sm mt-1">Модерация пользовательских паков</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">
          <RotateCcw size={14} />
          Обновить
        </button>
      </div>

      {/* Фильтр по статусу */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statuses.map(s => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              status === s.value
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.label}
            {s.value === 'pending' && total['pending'] > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                {total['pending']}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <div className="flex justify-center items-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-3" />
          Загрузка...
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <div className="font-semibold text-gray-600">Нет паков с таким статусом</div>
        </div>
      ) : (
        <div>
          {packs.map(pack => (
            <SubmissionRow key={pack.id} pack={pack} onAction={load} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PackSubmissionsPanel;
