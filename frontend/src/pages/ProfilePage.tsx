// frontend/src/pages/ProfilePage.tsx
/**
 * ProfilePage — Личный кабинет
 * Desktop: glass-панель поверх анимированного gradient-фона (orbs)
 * Mobile: m-glass-page + m-glass-card (отдельная страница)
 *
 * Поддерживает 3 темы: light, dark, emerald
 * Использует glass-стили и CSS-переменные
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import CentreBackground from '../components/Centre/CentreBackground';
import CentreLevelCard from '../components/Centre/CentreLevelCard';
import { useIsMobile } from '../hooks/use-mobile';
import { User, Mail, LogOut, Star, MapPin, Calendar, PenLine, Heart, Bell, BarChart3, Settings, Users, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DeleteAccountModal from '../components/DeleteAccountModal';
import apiClient from '../api/apiClient';
import { useContentStore } from '../stores/contentStore';

/* ──────────────── COMPONENT ──────────────── */

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  // Для mobile-профиля принудительно ставим body-класс, чтобы CSS цвета применялся

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--glass-text-secondary)' }}>
        Загрузка...
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <CentreBackground />
        <div className="h-full overflow-y-auto centre-mobile-page">
          <ProfilePageMobile user={user} logout={logout} />
        </div>
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode profile-mode">
        <ProfilePageDesktop user={user} logout={logout} />
      </MirrorGradientContainer>
    </>
  );
}

interface ProfilePageInnerProps {
  user: any;
  logout: () => void;
}

/**
 * Контент вкладки "Профиль"
 */
function ProfileContent({ user }: { user: any }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Профиль (уровень, прогресс, ранг) */}
      <CentreLevelCard
        showRole
        role={user.role}
        partnerTier={user.partnerTier}
      />

      {/* Контактная информация */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-2 text-sm cg-text-muted">
          <Mail className="w-4 h-4" />
          {user.email}
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-2 gap-4">
        <QuickActionCard
          icon={<MapPin className="w-5 h-5" />}
          title="Мои посты"
          description="Управляйте публикациями"
          onClick={() => navigate('/posts')}
          color="rgba(59, 130, 246, 1)"
        />
        <QuickActionCard
          icon={<Star className="w-5 h-5" />}
          title="Избранное"
          description="Сохранённые места"
          onClick={() => navigate('/favorites')}
          color="rgba(249, 115, 22, 1)"
        />
        <QuickActionCard
          icon={<Calendar className="w-5 h-5" />}
          title="Календарь"
          description="События и планы"
          onClick={() => {
            // Открываем EventPanel на карте вместо /calendar
            const { setLeftContent, setRightContent } = useContentStore.getState();
            setLeftContent('map');
            setRightContent('calendar');
            navigate('/map');
          }}
          color="rgba(147, 51, 234, 1)"
        />
        <QuickActionCard
          icon={<PenLine className="w-5 h-5" />}
          title="Центр влияния"
          description="Подробнее в Центре влияния"
          onClick={() => navigate('/centre')}
          color="rgba(16, 185, 129, 1)"
        />
      </div>

      {/* Прогресс к партнёрству */}
      <PartnerProgressWidget />
    </>
  );
}

/**
 * Мини-виджет прогресса к партнёрству
 */
function PartnerProgressWidget() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/partners/progress')
      .then((r) => setData(r.data))
      .catch(() => {/* тихо игнорируем */});
  }, []);

  if (!data) return null;

  const { partner_status, simple_progress: progress, stats, requirements } = data;

  if (partner_status === 'partner' || partner_status === 'pro_guide') {
    return (
      <div className="centre-glass-card" style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{partner_status === 'pro_guide' ? '👑' : '✅'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--glass-text)' }}>
                {partner_status === 'pro_guide' ? 'Эксперт ГеоБлог.рф' : 'Проверенный партнёр'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)' }}>Партнёрский статус активен</div>
            </div>
          </div>
          <Link
            to="/partner"
            style={{
              fontSize: '12px', color: 'rgb(249,115,22)', fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Панель →
          </Link>
        </div>
      </div>
    );
  }

  if (partner_status === 'pending') {
    return (
      <div className="centre-glass-card" style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⏳</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--glass-text)' }}>Заявка на рассмотрении</div>
            <div style={{ fontSize: '12px', color: 'var(--cg-text-muted)' }}>3–5 рабочих дней</div>
          </div>
        </div>
      </div>
    );
  }

  // none — показываем прогресс-бар
  if (!progress || !stats || !requirements) return null;

  return (
    <div className="centre-glass-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp className="w-4 h-4" style={{ color: 'rgb(249,115,22)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--glass-text)' }}>Прогресс к партнёрству</span>
        </div>
        <Link to="/partners" style={{ fontSize: '12px', color: 'rgb(249,115,22)', fontWeight: 600, textDecoration: 'none' }}>
          Подробнее →
        </Link>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        <MiniProgressRow
          label={`Маршруты ${stats.published_routes}/${requirements.routes_needed}`}
          pct={progress.routes_pct}
          met={progress.routes_met}
        />
        <MiniProgressRow
          label={`Оценки ${stats.positive_votes}/${requirements.positive_votes_needed}`}
          pct={progress.votes_pct}
          met={progress.votes_met}
        />
      </div>

      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--cg-text-muted)' }}>Общий прогресс</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: progress.is_eligible ? '#10B981' : 'var(--glass-text)' }}>
          {progress.overall_pct}%
        </span>
      </div>
      <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${progress.overall_pct}%`,
          background: progress.is_eligible
            ? 'linear-gradient(90deg, #10B981, #059669)'
            : 'linear-gradient(90deg, rgb(249,115,22), rgba(249,115,22,0.5))',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {progress.is_eligible && (
        <Link
          to="/partners"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '12px', padding: '8px 16px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.9), rgba(5,150,105,0.8))',
            color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
          }}
        >
          🎉 Требования выполнены! Подать заявку
        </Link>
      )}
    </div>
  );
}

function MiniProgressRow({ label, pct, met }: { label: string; pct: number; met: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: met ? '#10B981' : 'var(--cg-text-muted)' }}>{label}</span>
        <span style={{ fontSize: '11px', color: met ? '#10B981' : 'var(--cg-text-muted)' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '2px',
          width: `${pct}%`,
          background: met ? '#10B981' : 'rgba(249,115,22,0.7)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

/**
 * Контент вкладки "Статистика"
 */
function StatsContent() {
  return (
    <>
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
          }}>
            <BarChart3 className="w-5 h-5" style={{ color: 'rgba(16, 185, 129, 1)' }} />
          </div>
          <div>
            <h3 className="font-bold cg-text">Статистика</h3>
            <p className="text-xs cg-text-muted">Ваши достижения</p>
          </div>
        </div>

        <div className="space-y-3">
          <StatItem label="Всего постов" value="24" icon={<PenLine className="w-4 h-4" />} color="rgba(59, 130, 246, 1)" />
          <StatItem label="Получено лайков" value="156" icon={<Heart className="w-4 h-4" />} color="rgba(239, 68, 68, 1)" />
          <StatItem label="Комментариев" value="42" icon={<User className="w-4 h-4" />} color="rgba(147, 51, 234, 1)" />
          <StatItem label="Сохранённых мест" value="18" icon={<Star className="w-4 h-4" />} color="rgba(249, 115, 22, 1)" />
        </div>
      </div>

      <div className="centre-glass-card text-center py-8">
        <p className="cg-text-muted">Более детальная статистика скоро появится...</p>
      </div>
    </>
  );
}

/**
 * Контент вкладки "Настройки"
 */
function SettingsContent({ user, logout }: { user: any; logout: () => void }) {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { deleteAccount } = useAuth();

  const handleDelete = async () => {
    try {
      await deleteAccount();
      // после удаления контекст logout уже вызван, перенаправляем на главную
      navigate('/');
    } catch (e) {
      console.error('Ошибка удаления аккаунта', e);
    }
  };

  return (
    <>
      {/* Информация о пользователе */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))'
          }}>
            <User className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          </div>
          <div>
            <h3 className="font-bold cg-text">Информация</h3>
            <p className="text-xs cg-text-muted">Ваши данные</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs cg-text-muted mb-1 block">Имя пользователя</label>
            <div className="px-3 py-2 rounded-lg" style={{
              backgroundColor: 'var(--glass-l2-bg)',
              borderColor: 'var(--glass-l2-border)',
              color: 'var(--glass-text)'
            }}>
              {user.username}
            </div>
          </div>
          <div>
            <label className="text-xs cg-text-muted mb-1 block">Email</label>
            <div className="px-3 py-2 rounded-lg" style={{
              backgroundColor: 'var(--glass-l2-bg)',
              borderColor: 'var(--glass-l2-border)',
              color: 'var(--glass-text)'
            }}>
              {user.email}
            </div>
          </div>
        </div>
      </div>

      {/* Настройки уведомлений */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.2))'
          }}>
            <Bell className="w-5 h-5" style={{ color: 'rgba(249, 115, 22, 1)' }} />
          </div>
          <div>
            <h3 className="font-bold cg-text">Уведомления</h3>
            <p className="text-xs cg-text-muted">Настройки оповещений</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm cg-text">Уведомления о модерации</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded" style={{ accentColor: 'var(--text-accent)' }} />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm cg-text">Уведомления о новых комментариях</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded" style={{ accentColor: 'var(--text-accent)' }} />
          </label>
        </div>
      </div>

      {/* Юридические документы */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))'
          }}>
            <Settings className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          </div>
          <div>
            <h3 className="font-bold cg-text">Документы</h3>
            <p className="text-xs cg-text-muted">Пользовательское соглашение и политика</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => navigate('/legal/user-agreement')}
            className="w-full text-left p-3 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--glass-l2-bg)',
              border: '1px solid var(--glass-l2-border)',
              color: 'var(--glass-text)'
            }}
          >
            Пользовательское соглашение
          </button>
          <button
            onClick={() => navigate('/legal/privacy-policy')}
            className="w-full text-left p-3 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--glass-l2-bg)',
              border: '1px solid var(--glass-l2-border)',
              color: 'var(--glass-text)'
            }}
          >
            Политика конфиденциальности
          </button>
        </div>
      </div>

      {/* Кнопка выхода */}
      <button
        onClick={logout}
        className="w-full centre-glass-card flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderColor: 'rgba(239, 68, 68, 0.4)',
          color: 'rgba(239, 68, 68, 1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        }}
      >
        <LogOut className="w-4 h-4" />
        Выйти из системы
      </button>

      {/* Кнопка удаления аккаунта */}
      <button
        onClick={() => setShowDeleteModal(true)}
        className="w-full centre-glass-card flex items-center justify-center gap-2 py-3 mt-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderColor: 'rgba(239, 68, 68, 0.4)',
          color: 'rgba(239, 68, 68, 1)'
        }}
      >
        <LogOut className="w-4 h-4 rotate-180" />
        Удалить аккаунт
      </button>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

/**
 * Карточка быстрого действия
 */
function QuickActionCard({ icon, title, description, onClick, color }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="centre-glass-card flex flex-col items-center text-center p-4 transition-all hover:scale-105"
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{
        backgroundColor: `${color}20`,
        color
      }}>
        {icon}
      </div>
      <div className="font-semibold cg-text text-sm mb-1">{title}</div>
      <div className="text-xs cg-text-muted">{description}</div>
    </button>
  );
}

/**
 * Элемент статистики
 */
function StatItem({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{
      backgroundColor: 'var(--glass-l2-bg)',
      borderColor: 'var(--glass-l2-border)'
    }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <span className="text-sm cg-text">{label}</span>
      </div>
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

/**
 * Desktop: glass-панель в centre-mode
 */
function ProfilePageDesktop({ user, logout }: ProfilePageInnerProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'settings'>('profile');

  return (
    <>
      {/* Заголовок */}
      <div className="centre-static-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <h2>Личный кабинет</h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>
            {user.username}
          </p>
        </div>
      </div>

      {/* Навигация по вкладкам */}
      <div className="border-b" style={{ borderColor: 'var(--glass-l1-border)' }}>
        <div className="flex">
          {[
            { id: 'profile' as const, label: 'Профиль', icon: <User className="w-4 h-4" /> },
            { id: 'stats' as const, label: 'Статистика', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'settings' as const, label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--text-accent)' : 'var(--glass-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--text-accent)' : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--glass-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--glass-text-secondary)';
                }
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-5">
          {activeTab === 'profile' && <ProfileContent user={user} />}
          {activeTab === 'stats' && <StatsContent />}
          {activeTab === 'settings' && <SettingsContent user={user} logout={logout} />}
        </div>
      </div>
    </>
  );
}

/**
 * Mobile: glassmorphism в мобильном стиле
 */
function ProfilePageMobile({ user, logout }: ProfilePageInnerProps) {
  const navigate = useNavigate();

  return (
    <MirrorGradientContainer className="centre-mode profile-mode">
      <div className="centre-static-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <h2>Профиль</h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--glass-text-secondary)' }}>{user.username}</p>
        </div>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content space-y-4">
          <ProfileContent user={user} />

          <div className="centre-glass-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
              }}>
                <BarChart3 className="w-5 h-5" style={{ color: 'rgba(16, 185, 129, 1)' }} />
              </div>
              <div>
                <h3 className="font-bold cg-text">Геймификация</h3>
                <p className="text-xs cg-text-muted">Перейдите в Центр влияния для подробностей</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/centre')}
              className="w-full text-center py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--glass-l2-bg)',
                border: '1px solid var(--glass-l2-border)',
                color: 'var(--glass-text)'
              }}
            >
              Открыть Центр влияния
            </button>
          </div>

          <SettingsContent user={user} logout={logout} />
        </div>
      </div>
    </MirrorGradientContainer>
  );
}
