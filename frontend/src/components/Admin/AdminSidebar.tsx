import React from 'react';
import { AdminMenuItemType, AdminNotifications } from '../../types/AdminTypes';

interface AdminSidebarProps {
  activeSection: string;
  activeItem: string;
  onSelectItem: (item: AdminMenuItemType) => void;
  notifications: AdminNotifications;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  activeItem,
  onSelectItem,
  notifications,
}) => {
  const menuItems: AdminMenuItemType[] = [
    {
      id: 'moderation-overview',
      label: 'Модерация',
      icon: '📋',
      section: 'moderation',
      badge:
        notifications.moderation.posts +
        notifications.moderation.events +
        notifications.moderation.markers,
      badgeColor: 'orange',
      subItems: [
        {
          id: 'moderation-posts',
          label: 'Посты',
          icon: '📝',
          section: 'moderation',
          badge: notifications.moderation.posts,
          badgeColor: 'orange',
        },
        {
          id: 'moderation-events',
          label: 'События',
          icon: '📅',
          section: 'moderation',
          badge: notifications.moderation.events,
          badgeColor: 'orange',
        },
        {
          id: 'moderation-markers',
          label: 'Метки',
          icon: '📍',
          section: 'moderation',
          badge: notifications.moderation.markers,
          badgeColor: 'orange',
        },
        {
          id: 'moderation-marker-comments',
          label: 'Комментарии метак',
          icon: '💭',
          section: 'moderation',
          badge: notifications.moderation.markerComments,
          badgeColor: 'yellow',
        },
        {
          id: 'moderation-routes',
          label: 'Маршруты',
          icon: '🛤️',
          section: 'moderation',
          badge: notifications.moderation.routes,
          badgeColor: 'orange',
        },
        {
          id: 'moderation-comments',
          label: 'Комментарии',
          icon: '💬',
          section: 'moderation',
          badge: notifications.moderation.comments,
          badgeColor: 'orange',
        },
      ],
    },
    {
      id: 'analytics-overview',
      label: 'Аналитика',
      icon: '📊',
      section: 'analytics',
      badge: notifications.analytics,
      badgeColor: 'blue',
      subItems: [
        {
          id: 'analytics-executive',
          label: 'Для руководства',
          icon: '🎯',
          section: 'analytics',
        },
        {
          id: 'analytics-product',
          label: 'Продакт-команда',
          icon: '🎮',
          section: 'analytics',
        },
        {
          id: 'analytics-technical',
          label: 'Техническая',
          icon: '⚡',
          section: 'analytics',
        },
      ],
    },
    {
      id: 'partners-overview',
      label: 'Партнёры',
      icon: '🤝',
      section: 'partners',
      badge:
        notifications.partners.applications +
        notifications.partners.payouts_pending,
      badgeColor: 'red',
      subItems: [
        {
          id: 'partners-list',
          label: 'Список партнёров',
          icon: '👥',
          section: 'partners',
        },
        {
          id: 'partners-applications',
          label: 'Заявки Pro Guide',
          icon: '📋',
          section: 'partners',
          badge: notifications.partners.applications,
          badgeColor: 'red',
        },
        {
          id: 'partners-events',
          label: 'События доходов',
          icon: '💰',
          section: 'partners',
        },
        {
          id: 'partners-payouts',
          label: 'Выплаты',
          icon: '💸',
          section: 'partners',
          badge: notifications.partners.payouts_pending,
          badgeColor: 'red',
        },
        {
          id: 'partners-refunds',
          label: 'Возвраты',
          icon: '↩️',
          section: 'partners',
        },
      ],
    },
    {
      id: 'feedback-overview',
      label: 'Обратная связь',
      icon: '💬',
      section: 'moderation',
      badge: notifications.feedback?.new_complaints + notifications.feedback?.new_suggestions || 0,
      badgeColor: 'green',
      subItems: [
        {
          id: 'feedback-all',
          label: 'Все сообщения',
          icon: '💬',
          section: 'moderation',
        },
        {
          id: 'feedback-complaints',
          label: 'Жалобы',
          icon: '🚨',
          section: 'moderation',
          badge: notifications.feedback?.new_complaints || 0,
          badgeColor: 'green',
        },
        {
          id: 'feedback-suggestions',
          label: 'Предложения',
          icon: '💡',
          section: 'moderation',
          badge: notifications.feedback?.new_suggestions || 0,
          badgeColor: 'green',
        },
      ],
    },
    {
      id: 'hub-packs-overview',
      label: 'Паки сообщества',
      icon: '🌐',
      section: 'hub',
      badge: notifications.hub?.packs_pending || 0,
      badgeColor: 'orange',
      subItems: [
        {
          id: 'hub-packs-pending',
          label: 'На модерации',
          icon: '📦',
          section: 'hub',
          badge: notifications.hub?.packs_pending || 0,
          badgeColor: 'orange',
        },
        {
          id: 'hub-packs-overview',
          label: 'Все паки',
          icon: '🗺️',
          section: 'hub',
        },
      ],
    },
    {
      id: 'settings-overview',
      label: 'Настройки',
      icon: '⚙️',
      section: 'settings',
      subItems: [
        {
          id: 'settings-general',
          label: 'Основные',
          icon: '⚙️',
          section: 'settings',
        },
      ],
    },
  ];

  const renderMenuItem = (item: AdminMenuItemType, level: number = 0) => {
    const isActive = activeItem === item.id;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isParentActive = activeSection === item.section;

    return (
      <div key={item.id}>
        <button
          onClick={() => onSelectItem(item)}
          className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
            isActive
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
              : isParentActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold text-white ${
                  item.badgeColor === 'orange'
                    ? 'bg-orange-600'
                    : item.badgeColor === 'red'
                    ? 'bg-red-600'
                    : item.badgeColor === 'blue'
                    ? 'bg-blue-600'
                    : item.badgeColor === 'yellow'
                    ? 'bg-yellow-500'
                    : 'bg-green-600'
                }`}
              >
                {item.badge}
              </span>
            )}
          </div>
        </button>

        {hasSubItems && isParentActive && (
          <div className="ml-2 mt-1 space-y-1">
            {item.subItems!.map((subItem) => renderMenuItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto h-screen">
      {/* Заголовок */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">🛠️ Админ-панель</h1>
        <p className="text-sm text-gray-500 mt-1">Управление приложением</p>
      </div>

      {/* Меню */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <p className="text-xs text-gray-500 text-center">
          GеоБлог.РФ Admin Portal
        </p>
      </div>
    </div>
  );
};

export default AdminSidebar;
