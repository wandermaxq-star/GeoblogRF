// frontend/src/components/Profile/MyPacksSection.tsx
// Секция «Мои паки» в профиле пользователя
import React, { useEffect, useState } from 'react';
import {
  Package, Plus, Trash2, Edit3, ChevronRight, Loader2,
  AlertCircle, Check, Crown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMyPacks, deletePack, becomeAuthor
} from '../../services/routePackService';
import type { RoutePackSubmission, SubmissionStatus } from '../../types/routePackSubmission';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../../types/routePackSubmission';

const STATUS_ICON: Record<SubmissionStatus, string> = {
  pending: '⏳',
  approved: '✅',
  rejected: '❌',
  revision: '🔄',
};

const MyPacksSection: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [packs, setPacks] = useState<RoutePackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [becomingAuthor, setBecomingAuthor] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isAuthor = (user as any)?.is_pack_author;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getMyPacks()
      .then(setPacks)
      .catch(() => setError('Не удалось загрузить паки'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleBecomeAuthor = async () => {
    setBecomingAuthor(true);
    setError('');
    try {
      await becomeAuthor();
      updateUser({ is_pack_author: true } as any);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally { setBecomingAuthor(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить пак? Это действие нельзя отменить.')) return;
    setDeletingId(id);
    try {
      await deletePack(id);
      setPacks(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message || 'Ошибка при удалении');
    } finally { setDeletingId(null); }
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
        Войдите чтобы просматривать свои паки
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--glass-text)' }}>
          Мои паки маршрутов
        </h4>
        <a href="/hub" style={{
          fontSize: 12, color: 'var(--text-accent)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          Маршрутный Хаб <ChevronRight size={12} />
        </a>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#EF4444', fontSize: 13,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Если не автор — CTA */}
      {!isAuthor && (
        <div style={{
          padding: '20px', borderRadius: 14, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))',
          border: '1px solid rgba(167,139,250,0.2)',
        }}>
          <Crown size={28} style={{ color: '#a78bfa', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--glass-text)', marginBottom: 6 }}>
            Станьте автором паков
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 14, lineHeight: 1.6 }}>
            Создавайте и продавайте маршруты сообществу.
            Зарабатывайте 70% от каждой продажи.
          </div>
          <button
            onClick={handleBecomeAuthor}
            disabled={becomingAuthor}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 10, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.7), rgba(167,139,250,0.7))',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
              opacity: becomingAuthor ? 0.7 : 1,
            }}
          >
            {becomingAuthor ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            {becomingAuthor ? 'Обработка...' : 'Стать автором'}
          </button>
        </div>
      )}

      {/* Кнопка создать новый пак */}
      {isAuthor && (
        <a href="/planner" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px', borderRadius: 10, textDecoration: 'none',
          background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
          transition: 'all 0.2s',
        }}>
          <Plus size={16} />
          Новый пак — открыть Планировщик
        </a>
      )}

      {/* Список паков */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : packs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '24px 0',
          color: 'rgba(255,255,255,0.35)', fontSize: 13,
        }}>
          <Package size={32} style={{ marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
          У вас пока нет паков
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {packs.map(pack => {
            const statusColor = SUBMISSION_STATUS_COLORS[pack.status as SubmissionStatus] || '#888';
            const statusLabel = SUBMISSION_STATUS_LABELS[pack.status as SubmissionStatus] || pack.status;

            return (
              <div key={pack.id} style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--glass-text)',
                      marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {STATUS_ICON[pack.status as SubmissionStatus] || '📦'} {pack.title}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99,
                        background: `${statusColor}22`, color: statusColor,
                        fontWeight: 700,
                      }}>
                        {statusLabel}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        {pack.price === 0 ? 'Бесплатный' : `${pack.price} ₽`}
                      </span>
                      {pack.download_count > 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          📥 {pack.download_count}
                        </span>
                      )}
                    </div>
                    {/* Комментарий модератора */}
                    {pack.moderation_comment && pack.status === 'revision' && (
                      <div style={{
                        marginTop: 6, fontSize: 11, color: '#F59E0B',
                        background: 'rgba(245,158,11,0.08)', borderRadius: 6,
                        padding: '4px 8px', lineHeight: 1.5,
                      }}>
                        💬 {pack.moderation_comment}
                      </div>
                    )}
                    {pack.moderation_comment && pack.status === 'rejected' && (
                      <div style={{
                        marginTop: 6, fontSize: 11, color: '#EF4444',
                        background: 'rgba(239,68,68,0.08)', borderRadius: 6,
                        padding: '4px 8px', lineHeight: 1.5,
                      }}>
                        ❌ {pack.moderation_comment}
                      </div>
                    )}
                  </div>

                  {/* Кнопки */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(pack.status === 'pending' || pack.status === 'revision') && (
                      <button
                        onClick={() => handleDelete(pack.id)}
                        disabled={deletingId === pack.id}
                        style={{
                          padding: '6px', borderRadius: 7, cursor: 'pointer',
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: '#EF4444',
                        }}
                        title="Удалить пак"
                      >
                        {deletingId === pack.id
                          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Trash2 size={14} />
                        }
                      </button>
                    )}
                    {pack.status === 'approved' && (
                      <a href={`/hub?pack=${pack.id}`} style={{
                        padding: '6px', borderRadius: 7, cursor: 'pointer',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        color: '#10B981', display: 'flex', alignItems: 'center',
                        textDecoration: 'none',
                      }} title="Открыть в Хабе">
                        <ChevronRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Статистика автора (только если есть одобренные паки) */}
      {isAuthor && packs.some(p => p.status === 'approved') && (
        <div style={{
          padding: '14px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(34,211,238,0.07), rgba(167,139,250,0.07))',
          border: '1px solid rgba(167,139,250,0.15)',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            Статистика автора
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22d3ee' }}>
                {packs.filter(p => p.status === 'approved').length}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>опубликовано</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa' }}>
                {packs.reduce((s, p) => s + (p.download_count || 0), 0)}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>скачиваний</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPacksSection;
