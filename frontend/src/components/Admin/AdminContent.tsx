import React from 'react';
import ModerationHistoryPanel from './ModerationHistoryPanel';
import AnalyticsDashboard from '../../analytics/dashboard/pages/AnalyticsDashboard';
import CuratedRoutePacksPanel from './CuratedRoutePacksPanel';
import FeedbackPanel from './FeedbackPanel';
import PackSubmissionsPanel from './PackSubmissionsPanel';
import {
  PartnersListPanel,
  PartnersApplicationsPanel,
  AffiliateEventsPanel,
  PayoutsPanel,
  RefundsPanel
} from './Partners';

interface AdminContentProps {
  activeItem: string;
}

const AdminContent: React.FC<AdminContentProps> = ({ activeItem }) => {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8">
        {/* МОДЕРАЦИЯ */}
        {activeItem === 'moderation-overview' && <ModerationHistoryPanel />}
        {activeItem === 'moderation-posts' && (
          <ModerationHistoryPanel defaultContentType="posts" />
        )}
        {activeItem === 'moderation-events' && (
          <ModerationHistoryPanel defaultContentType="events" />
        )}
        {activeItem === 'moderation-markers' && (
          <ModerationHistoryPanel defaultContentType="markers" />
        )}
        {activeItem === 'moderation-marker-comments' && (
          <ModerationHistoryPanel defaultContentType="marker_comments" />
        )}
        {activeItem === 'moderation-routes' && (
          <ModerationHistoryPanel defaultContentType="routes" />
        )}
        {activeItem === 'moderation-comments' && (
          <ModerationHistoryPanel defaultContentType="comments" />
        )}

        {/* АНАЛИТИКА */}
        {activeItem === 'analytics-overview' && <AnalyticsDashboard initialView="executive" />}
        {activeItem === 'analytics-executive' && <AnalyticsDashboard initialView="executive" />}
        {activeItem === 'analytics-product' && <AnalyticsDashboard initialView="product" />}
        {activeItem === 'analytics-technical' && (
          <AnalyticsDashboard initialView="technical" />
        )}

        {/* ПАРТНЁРЫ */}
        {activeItem === 'partners-overview' && <PartnersListPanel />}
        {activeItem === 'partners-list' && <PartnersListPanel />}
        {activeItem === 'partners-applications' && <PartnersApplicationsPanel />}
        {activeItem === 'partners-events' && <AffiliateEventsPanel />}
        {activeItem === 'partners-payouts' && <PayoutsPanel />}
        {activeItem === 'partners-refunds' && <RefundsPanel />}

        {/* ПАКЕТЫ */}
        {activeItem === 'packs-overview' && <CuratedRoutePacksPanel />}
        {activeItem === 'packs-curated' && <CuratedRoutePacksPanel />}

        {/* ПАК-САБМИШЕНЫ (пользовательские паки) */}
        {activeItem === 'hub-packs-overview' && <PackSubmissionsPanel />}
        {activeItem === 'hub-packs-pending' && <PackSubmissionsPanel />}

        {/* ОБРАТНАЯ СВЯЗЬ */}
        {activeItem === 'feedback-all' && <FeedbackPanel />}
        {activeItem === 'feedback-complaints' && <FeedbackPanel filterType="complaint" />}
        {activeItem === 'feedback-suggestions' && <FeedbackPanel filterType="suggestion" />}

        {/* ЯВНАЯ ОШИБКА, ЕСЛИ НИЧЕГО НЕ НАЙДЕНО */}
        {!activeItem && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Выберите раздел из меню слева</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContent;
