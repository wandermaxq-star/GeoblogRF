import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, LogOut, Star, MapPin, Calendar,
  PenLine, Settings, FileText,
  ChevronRight, Shield, Bell,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CentreBackground from '../../components/Centre/CentreBackground';
import CentreLevelCard from '../../components/Centre/CentreLevelCard';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import { useContentStore } from '../../stores/contentStore';

/* ─── Вспомогательная карточка ─── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`m-glass-card rounded-2xl p-4 ${className}`}
      style={{ marginBottom: '12px' }}
    >
      {children}
    </div>
  );
}

/* ─── Кнопка-строка внутри карточки ─── */
function Row({
  icon,
  label,
  onClick,
  iconColor = 'rgba(99,102,241,1)',
  right,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  iconColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-1 rounded-xl active:opacity-70 transition-opacity"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}22`, color: iconColor }}
      >
        {icon}
      </div>
      <span className="flex-1 text-left text-sm font-medium cg-text">{label}</span>
      {right ?? <ChevronRight className="w-4 h-4 cg-text-muted opacity-50" />}
    </button>
  );
}

/* ─── Главный компонент ─── */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user, logout, deleteAccount } = auth || {};
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const setLeftContent = useContentStore((state) => state.setLeftContent);
  const setRightContent = useContentStore((state) => state.setRightContent);

  const handleDelete = async () => {
    try {
      await deleteAccount?.();
      navigate('/');
    } catch (e) {
      console.error('Ошибка удаления аккаунта', e);
    }
  };

  return (
    <>
      {/* Тот же анимированный фон что у CentrePage */}
      <CentreBackground />

      {/* Контентный слой — centre-mobile-page даёт правильный полупрозрачный фон */}
      <div className="centre-mobile-page h-full overflow-y-auto">
        <div className="p-4 pb-24" style={{ maxWidth: '500px', margin: '0 auto' }}>

          {/* ── Карточка уровня — точно как в CentrePage ── */}
          <CentreLevelCard />

          {/* ── Быстрые переходы: 2×2 ── */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {[
              { icon: <PenLine className="w-5 h-5" />, label: 'Мои посты',  path: '/posts',     color: '#3B82F6' },
              { icon: <Star className="w-5 h-5" />,    label: 'Избранное',  path: '/favorites', color: '#F59E0B' },
              { icon: <Calendar className="w-5 h-5" />,label: 'Календарь', path: '/calendar',  color: '#8B5CF6' },
              { icon: <MapPin className="w-5 h-5" />,  label: 'Центр',     path: '/centre',    color: '#10B981' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  if (item.path === '/calendar') {
                    setLeftContent('map');
                    setRightContent('calendar');
                    navigate('/map');
                  } else {
                    navigate(item.path);
                  }
                }}
                className="m-glass-card rounded-xl flex flex-col items-center py-4 px-2 gap-2 active:scale-95 transition-transform"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}22`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-semibold cg-text">{item.label}</span>
              </button>
            ))}
          </div>

          {/* ── Настройки ── */}
          <Card>
            <p className="text-xs font-bold cg-text-muted uppercase tracking-wider mb-1 px-1">Настройки</p>
            <Row
              icon={<Bell className="w-4 h-4" />}
              label="Уведомления"
              iconColor="#6366f1"
              right={
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 rounded"
                  style={{ accentColor: '#6366f1' }}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            />
            <Row
              icon={<Shield className="w-4 h-4" />}
              label="Конфиденциальность"
              iconColor="#8B5CF6"
              onClick={() => navigate('/legal/privacy-policy')}
            />
          </Card>

          {/* ── Документы ── */}
          <Card>
            <p className="text-xs font-bold cg-text-muted uppercase tracking-wider mb-1 px-1">Документы</p>
            <Row
              icon={<FileText className="w-4 h-4" />}
              label="Пользовательское соглашение"
              iconColor="#3B82F6"
              onClick={() => navigate('/legal/user-agreement')}
            />
            <Row
              icon={<FileText className="w-4 h-4" />}
              label="Политика конфиденциальности"
              iconColor="#3B82F6"
              onClick={() => navigate('/legal/privacy-policy')}
            />
          </Card>

          {/* ── Выход ── */}
          {user && (
            <>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold mb-2 active:scale-95 transition-transform"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'rgba(239,68,68,1)',
                }}
              >
                <LogOut className="w-4 h-4" />
                Выйти из системы
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-medium mb-2 active:scale-95 transition-transform"
                style={{
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  color: 'rgba(239,68,68,0.7)',
                }}
              >
                <LogOut className="w-3.5 h-3.5 rotate-180" />
                Удалить аккаунт
              </button>
            </>
          )}

        </div>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default ProfilePage;
