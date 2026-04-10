import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { LoadingProvider } from './contexts/LoadingContext';
// global loading indicator was used for development testing and has been removed
import {
  LazyHomePage, LazyHome, LazyChat,
  LazyActivity, LazyCentrePage, LazyFriends, LazyModerationPage,
  LazyUserAgreement, LazyPrivacyPolicy, LazyAnalyticsDashboard, LazyAdminDashboard
} from './components/LazyComponents';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import PartnerDashboard from './pages/PartnerDashboard';
import PartnerApply from './pages/PartnerApply';
import PartnersPage from './pages/PartnersPage';
// Posts загружается статически для быстрой загрузки проекта с фокусом на контенте
import Posts from './pages/Posts';
import { FEATURES } from './config/features';
import {
  PageLoadingFallback, MapLoadingFallback, BlogLoadingFallback, ModerationLoadingFallback,
  AnalyticsLoadingFallback, AdminLoadingFallback
} from './components/LoadingFallback';
import PersistentMaps from './pages/PersistentMaps';
import ProfileRoutes from './pages/ProfileRoutes';
import ProfilePage from './pages/ProfilePage';
import Favorites from './pages/Favorites';

const AppRoutes = () => {
  return (
    <LoadingProvider>
    {/* Global loading overlay removed as it was only needed for testing */}
    <Routes>
      <Route path="/" element={<Suspense fallback={<PageLoadingFallback />}><LazyHomePage /></Suspense>} />
      <Route path="/home" element={<Suspense fallback={<PageLoadingFallback />}><LazyHome /></Suspense>} />
      {/* Оба пути ведут в контейнер, который не размонтирует карты */}
      <Route path="/map" element={<PersistentMaps />} />
      <Route path="/planner" element={<PersistentMaps />} />
      {/* /calendar переехал в EventPanel — открывается через contentStore на /map */}
      <Route path="/calendar" element={<Navigate to="/map" replace />} />
      {/* Posts загружается статически для быстрой загрузки проекта с фокусом на контенте */}
      <Route path="/posts" element={<Posts />} />
      {/* Блоги отключены - используем только posts */}
      {FEATURES.CHAT_ENABLED && (
        <Route path="/chat" element={<Suspense fallback={<PageLoadingFallback />}><LazyChat /></Suspense>} />
      )}
      <Route path="/activity" element={<Suspense fallback={<PageLoadingFallback />}><LazyActivity /></Suspense>} />
      <Route path="/centre" element={<Suspense fallback={<PageLoadingFallback />}><LazyCentrePage /></Suspense>} />
      <Route path="/friends" element={<Suspense fallback={<PageLoadingFallback />}><LazyFriends /></Suspense>} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/favorites" element={<Favorites />} />
      <Route path="/admin" element={<Suspense fallback={<AdminLoadingFallback />}><LazyAdminDashboard /></Suspense>} />
      <Route path="/admin/moderation" element={<Suspense fallback={<ModerationLoadingFallback />}><LazyModerationPage /></Suspense>} />
      <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
    <Route path="/partners" element={<PartnersPage />} />
    <Route path="/partner" element={<PartnerDashboard />} />
      <Route path="/partner/apply" element={<PartnerApply />} />
      <Route path="/legal/user-agreement" element={<Suspense fallback={<PageLoadingFallback />}><LazyUserAgreement /></Suspense>} />
      <Route path="/legal/privacy-policy" element={<Suspense fallback={<PageLoadingFallback />}><LazyPrivacyPolicy /></Suspense>} />
    <Route path="/analytics" element={<Suspense fallback={<AnalyticsLoadingFallback />}><LazyAnalyticsDashboard /></Suspense>} />
      <Route path="/profile/routes" element={<ProfileRoutes />} />
    </Routes>
    </LoadingProvider>
  );
};

export default AppRoutes;