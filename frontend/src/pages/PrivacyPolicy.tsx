/**
 * PrivacyPolicy — Политика конфиденциальности
 * Desktop: glass-панель поверх анимированного gradient-фона (orbs)
 * Mobile: glass-страница
 * Поддерживает 3 темы: light, dark, emerald
 */

import React, { useEffect } from 'react';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import CentreBackground from '../components/Centre/CentreBackground';
import { useIsMobile } from '../hooks/use-mobile';
import { Lock, Database, Shield, Eye, Trash, Download } from 'lucide-react';

export default function PrivacyPolicy() {
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
          <PrivacyPolicyMobile />
        </div>
      </>
    );
  }

  return (
    <>
      <CentreBackground />
      <MirrorGradientContainer className="centre-mode">
        <PrivacyPolicyDesktop />
      </MirrorGradientContainer>
    </>
  );
}

/**
 * Desktop: glass-панель в centre-mode
 */
function PrivacyPolicyDesktop() {
  return (
    <>
      {/* Заголовок */}
      <div className="centre-static-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <h2>Политика конфиденциальности</h2>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="centre-scroll-area">
        <div className="centre-content space-y-5">
          <PrivacyPolicyContent />
        </div>
      </div>
    </>
  );
}

/**
 * Mobile: glassmorphism в мобильном стиле
 */
function PrivacyPolicyMobile() {
  return (
    <MirrorGradientContainer className="centre-mode">
      <div className="centre-static-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <h2>Политика конфиденциальности</h2>
        </div>
      </div>

      <div className="centre-scroll-area">
        <div className="centre-content space-y-4">
          <PrivacyPolicyContent />
        </div>
      </div>
    </MirrorGradientContainer>
  );
}

/**
 * Контент политики конфиденциальности
 */
function PrivacyPolicyContent() {
  return (
    <div className="space-y-5">
      {/* Section 1 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">1. Какие данные мы собираем</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold cg-text mb-2">1.1 Персональные данные:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Имя пользователя и email при регистрации</li>
              <li>Пароль (в зашифрованном виде)</li>
              <li>Аватар и настройки профиля</li>
              <li>Дата регистрации и последней активности</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">1.2 Данные активности:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Созданные метки и их координаты</li>
              <li>Планируемые маршруты</li>
              <li>Публикации в блогах</li>
              <li>События в календаре</li>
              <li>Сообщения в чатах</li>
              <li>Лента активности</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">1.3 Технические данные:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>IP-адрес и информация о браузере</li>
              <li>Время посещения и действия на сайте</li>
              <li>Cookies и локальное хранилище</li>
              <li>Данные о производительности</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">2. Как мы используем ваши данные</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold cg-text mb-2">2.1 Основные цели:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Предоставление функциональности платформы</li>
              <li>Персонализация пользовательского опыта</li>
              <li>Обеспечение безопасности и модерации</li>
              <li>Улучшение качества сервиса</li>
              <li>Техническая поддержка пользователей</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">2.2 Аналитика и улучшения:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Анализ использования функций платформы</li>
              <li>Выявление и исправление ошибок</li>
              <li>Оптимизация производительности</li>
              <li>Разработка новых функций</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 3 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">3. Защита данных</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold cg-text mb-2">3.1 Технические меры:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Шифрование данных при передаче (HTTPS)</li>
              <li>Хеширование паролей с солью</li>
              <li>Регулярные резервные копии</li>
              <li>Мониторинг безопасности</li>
              <li>Ограничение доступа к данным</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">3.2 Организационные меры:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Обучение сотрудников по защите данных</li>
              <li>Политики доступа и безопасности</li>
              <li>Регулярные аудиты безопасности</li>
              <li>Планы реагирования на инциденты</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 4 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">4. Передача данных третьим лицам</h3>
        <p className="cg-text-muted text-sm mb-3">
          Мы не продаем и не передаем ваши персональные данные третьим лицам, за исключением:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li>Служб геокодирования (Nominatim, Overpass API) для определения мест</li>
          <li>Провайдеров хостинга и облачных сервисов</li>
          <li>Служб аналитики (анонимизированные данные)</li>
          <li>По требованию правоохранительных органов</li>
          <li>При согласии пользователя</li>
        </ul>
      </div>

      {/* Section 5 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">5. Ваши права</h3>
        </div>
        <p className="cg-text-muted text-sm mb-3">
          В соответствии с GDPR и российским законодательством, вы имеете право:
        </p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
          <li><strong style={{ color: 'var(--glass-text)' }}>Доступ:</strong> Получить копию ваших данных</li>
          <li><strong style={{ color: 'var(--glass-text)' }}>Исправление:</strong> Обновить неточные данные</li>
          <li><strong style={{ color: 'var(--glass-text)' }}>Удаление:</strong> Удалить ваш аккаунт и данные</li>
          <li><strong style={{ color: 'var(--glass-text)' }}>Ограничение:</strong> Ограничить обработку данных</li>
          <li><strong style={{ color: 'var(--glass-text)' }}>Портативность:</strong> Экспортировать ваши данные</li>
          <li><strong style={{ color: 'var(--glass-text)' }}>Возражение:</strong> Отказаться от обработки</li>
        </ul>
      </div>

      {/* Section 6 */}
      <div className="centre-glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Trash className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-lg font-bold cg-text">6. Хранение и удаление данных</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold cg-text mb-2">6.1 Сроки хранения:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Активные аккаунты: до удаления пользователем</li>
              <li>Неактивные аккаунты: 3 года</li>
              <li>Логи безопасности: 1 год</li>
              <li>Резервные копии: 30 дней</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold cg-text mb-2">6.2 Удаление данных:</h4>
            <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm">
              <li>Полное удаление при запросе пользователя</li>
              <li>Анонимизация для аналитических целей</li>
              <li>Безопасное удаление с серверов</li>
              <li>Уведомление о завершении процесса</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 7 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">7. Cookies и отслеживание</h3>
        <p className="cg-text-muted text-sm mb-3">Мы используем cookies для:</p>
        <ul className="list-disc list-inside space-y-1 cg-text-muted text-sm mb-3">
          <li>Аутентификации пользователей</li>
          <li>Сохранения настроек</li>
          <li>Аналитики использования</li>
          <li>Улучшения производительности</li>
        </ul>
        <p className="cg-text-muted text-sm">
          Вы можете отключить cookies в настройках браузера, но это может ограничить функциональность платформы.
        </p>
      </div>

      {/* Section 8 */}
      <div className="centre-glass-card">
        <h3 className="text-lg font-bold cg-text mb-4">8. Изменения политики</h3>
        <p className="cg-text-muted text-sm mb-3">
          Мы можем обновлять настоящую политику конфиденциальности. О существенных изменениях мы уведомим через платформу или email.
        </p>
        <p className="cg-text-muted text-sm">
          Рекомендуем периодически проверять актуальную версию политики.
        </p>
      </div>

      {/* Contact Section */}
      <div className="centre-glass-card" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      }}>
        <h3 className="text-lg font-bold cg-text mb-4" style={{ color: 'rgba(16, 185, 129, 1)' }}>
          Контакты по вопросам конфиденциальности
        </h3>
        <p className="cg-text-muted text-sm mb-4">
          По вопросам обработки персональных данных обращайтесь:
        </p>
        <div className="space-y-2 text-sm cg-text-muted mb-4">
          <p><strong style={{ color: 'var(--glass-text)' }}>Email:</strong> privacy@horizon-explorer.com</p>
          <p><strong style={{ color: 'var(--glass-text)' }}>DPO (Data Protection Officer):</strong> dpo@horizon-explorer.com</p>
          <p><strong style={{ color: 'var(--glass-text)' }}>Телефон:</strong> +7 (XXX) XXX-XX-XX</p>
          <p><strong style={{ color: 'var(--glass-text)' }}>Адрес:</strong> г. Москва, ул. Примерная, д. 1</p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
          <p className="text-xs cg-text-muted">
            <strong style={{ color: 'var(--glass-text)' }}>Время ответа:</strong> Мы обязуемся ответить на ваши запросы в течение 30 дней в соответствии с GDPR.
          </p>
        </div>
      </div>
    </div>
  );
}
