/**
 * UserAgreement — Пользовательское соглашение
 * Desktop: glass-панель поверх анимированного gradient-фона (orbs)
 * Mobile: glass-страница
 * Поддерживает 3 темы: light, dark, emerald
 */

import React, { useEffect } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import CentreBackground from '../components/Centre/CentreBackground';
import { useIsMobile } from '../hooks/use-mobile';
import { FileText, Shield, Users, AlertTriangle, Gavel } from 'lucide-react';

export default function UserAgreement() {
  const isMobile = useIsMobile();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel();
    return () => {
      unregisterPanel();
    };
  }, [registerPanel, unregisterPanel]);

  if (isMobile) {
    return (
      <>
        <CentreBackground />
        <div className="h-full overflow-y-auto centre-mobile-page">
          <UserAgreementMobile />
        </div>
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        <UserAgreementDesktop />
      </MirrorGradientContainer>
    </>
  );
}

/**
 * Desktop: glass-панель в centre-mode
 */
function UserAgreementDesktop() {
  return (
    <>
      {/* Заголовок */}
      <div className="centre-static-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h2>Пользовательское соглашение</h2>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-5">
          <UserAgreementContent />
        </div>
      </div>
    </>
  );
}

/**
 * Mobile: glassmorphism в мобильном стиле
 */
function UserAgreementMobile() {
  return (
    <MirrorGradientContainer className="centre-mode">
      <div className="centre-static-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h2>Пользовательское соглашение</h2>
        </div>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content space-y-4">
          <UserAgreementContent />
        </div>
      </div>
    </MirrorGradientContainer>
  );
}

/**
 * Контент пользовательского соглашения
 */
function UserAgreementContent() {
  return (
    <div className="space-y-5">
      {/* Section 1 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">1. Общие положения</h3>
        </div>
        <p className="cg-text-muted text-sm mb-3 leading-relaxed">
          Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между администрацией платформы Horizon Explorer (далее — «Платформа») и пользователями (далее — «Пользователь») при использовании сервиса.
        </p>
        <p className="cg-text-muted text-sm leading-relaxed">
          Используя Платформу, вы подтверждаете, что прочитали, поняли и согласны соблюдать условия настоящего Соглашения.
        </p>
      </div>

      {/* Section 2 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">2. Описание сервиса</h3>
        </div>
        <p className="cg-text-muted text-sm mb-3">
          Horizon Explorer — это интерактивная платформа для создания, планирования и обмена маршрутами путешествий, включающая:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li>Интерактивные карты с возможностью создания меток</li>
          <li>Планировщик маршрутов с интеграцией событий</li>
          <li>Систему блогов для публикации путевых заметок</li>
          <li>Календарь событий и активностей</li>
          <li>Социальные функции: чаты, лента активности, друзья</li>
          <li>Систему модерации и безопасности</li>
        </ul>
      </div>

      {/* Section 3 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">3. Права и обязанности пользователей</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold cg-text mb-2">3.1 Права пользователей:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Создавать и публиковать контент в соответствии с правилами</li>
              <li>Использовать все функции платформы в рамках лицензии</li>
              <li>Обращаться в службу поддержки</li>
              <li>Удалять свой аккаунт и данные</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">3.2 Обязанности пользователей:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Предоставлять достоверную информацию при регистрации</li>
              <li>Соблюдать правила использования платформы</li>
              <li>Не нарушать права других пользователей</li>
              <li>Не размещать запрещенный контент</li>
              <li>Соблюдать законодательство РФ</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 4 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Gavel className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">4. Запрещенный контент</h3>
        </div>
        <p className="cg-text-muted text-sm mb-3">
          На платформе запрещено размещение следующего контента:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li>Материалы, нарушающие законодательство РФ</li>
          <li>Контент, содержащий ненормативную лексику или оскорбления</li>
          <li>Материалы, нарушающие авторские права</li>
          <li>Спам, реклама без согласования</li>
          <li>Информация о военных объектах или частных территориях</li>
          <li>Персональные данные третьих лиц без согласия</li>
          <li>Контент, пропагандирующий насилие или экстремизм</li>
        </ul>
      </div>

      {/* Section 5 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">5. Интеллектуальная собственность</h3>
        <p className="cg-text-muted text-sm mb-3 leading-relaxed">
          Пользователи сохраняют права на созданный ими контент, но предоставляют платформе неисключительную лицензию на его использование для функционирования сервиса.
        </p>
        <p className="cg-text-muted text-sm leading-relaxed">
          Платформа и все её элементы (дизайн, код, функциональность) являются интеллектуальной собственностью администрации.
        </p>
      </div>

      {/* Section 6 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">6. Ответственность и ограничения</h3>
        <p className="cg-text-muted text-sm mb-3">
          Платформа предоставляется «как есть». Администрация не несет ответственности за:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li>Точность информации, размещенной пользователями</li>
          <li>Временные технические сбои</li>
          <li>Действия третьих лиц</li>
          <li>Ущерб от использования платформы</li>
        </ul>
      </div>

      {/* Section 7 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">7. Модерация и блокировки</h3>
        <p className="cg-text-muted text-sm mb-3">
          Администрация оставляет за собой право:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li>Модерировать контент пользователей</li>
          <li>Удалять нарушающий правила контент</li>
          <li>Временно или постоянно блокировать аккаунты</li>
          <li>Предупреждать пользователей о нарушениях</li>
        </ul>
      </div>

      {/* Section 8 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">8. Изменения соглашения</h3>
        <p className="cg-text-muted text-sm mb-3 leading-relaxed">
          Администрация может изменять условия настоящего Соглашения. Пользователи будут уведомлены об изменениях через платформу.
        </p>
        <p className="cg-text-muted text-sm leading-relaxed">
          Продолжение использования платформы после изменений означает согласие с новыми условиями.
        </p>
      </div>

      {/* Contact Section */}
      <div className="centre-glass-card" style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      }}>
        <h3 className="text-lg font-bold cg-text mb-4" style={{ color: 'rgba(59, 130, 246, 1)' }}>
          Контакты
        </h3>
        <p className="cg-text-muted text-sm mb-4">
          По вопросам, связанным с настоящим Соглашением, обращайтесь:
        </p>
        <div className="space-y-2 text-sm cg-text-muted">
          <p><strong style={{ color: 'var(--glass-text)' }}>Email:</strong> support@horizon-explorer.com</p>
          <p><strong style={{ color: 'var(--glass-text)' }}>Телефон:</strong> +7 (XXX) XXX-XX-XX</p>
          <p><strong style={{ color: 'var(--glass-text)' }}>Адрес:</strong> г. Москва, ул. Примерная, д. 1</p>
        </div>
      </div>
    </div>
  );
}
