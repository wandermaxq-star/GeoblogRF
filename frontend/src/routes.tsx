import { Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { LoadingProvider } from './contexts/LoadingContext';
import GlobalLoadingOverlay from './components/GlobalLoadingOverlay';
import {
  LazyHomePage, LazyHome, LazyCalendar, LazyChat,
  LazyActivity, LazyCentrePage, LazyFriends, LazyModerationPage,
  LazyUserAgreement, LazyPrivacyPolicy, LazyAnalyticsDashboard
} from './components/LazyComponents';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
// Posts загружается статически для быстрой загрузки проекта с фокусом на контенте
import Posts from './pages/Posts';
import { FEATURES } from './config/features';
import {
  PageLoadingFallback, MapLoadingFallback, BlogLoadingFallback, ModerationLoadingFallback,
  AnalyticsLoadingFallback
} from './components/LoadingFallback';
import PersistentMaps from './pages/PersistentMaps';
import ProfileRoutes from './pages/ProfileRoutes';

const AppRoutes = () => {
  return (
    <LoadingProvider>
    <GlobalLoadingOverlay />
    <Routes>
      <Route path="/" element={<Suspense fallback={<PageLoadingFallback />}><LazyHomePage /></Suspense>} />
      <Route path="/home" element={<Suspense fallback={<PageLoadingFallback />}><LazyHome /></Suspense>} />
      {/* Оба пути ведут в контейнер, который не размонтирует карты */}
      <Route path="/map" element={<PersistentMaps />} />
      <Route path="/planner" element={<PersistentMaps />} />
      <Route path="/calendar" element={<Suspense fallback={<PageLoadingFallback />}><LazyCalendar /></Suspense>} />
      {/* Posts загружается статически для быстрой загрузки проекта с фокусом на контенте */}
      <Route path="/posts" element={<Posts />} />
      {/* Блоги отключены - используем только posts */}
      {FEATURES.CHAT_ENABLED && (
        <Route path="/chat" element={<Suspense fallback={<PageLoadingFallback />}><LazyChat /></Suspense>} />
      )}
      <Route path="/activity" element={<Suspense fallback={<PageLoadingFallback />}><LazyActivity /></Suspense>} />
      <Route path="/centre" element={<Suspense fallback={<PageLoadingFallback />}><LazyCentrePage /></Suspense>} />
      <Route path="/friends" element={<Suspense fallback={<PageLoadingFallback />}><LazyFriends /></Suspense>} />
      {/* Удалён статический профиль. Профиль открывается как модалка через Sidebar/ProfilePanel */}
      <Route path="/admin/moderation" element={<Suspense fallback={<ModerationLoadingFallback />}><LazyModerationPage /></Suspense>} />
      <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
      <Route path="/legal/user-agreement" element={<Suspense fallback={<PageLoadingFallback />}><LazyUserAgreement /></Suspense>} />
      <Route path="/legal/privacy-policy" element={<Suspense fallback={<PageLoadingFallback />}><LazyPrivacyPolicy /></Suspense>} />
    <Route path="/analytics" element={<Suspense fallback={<AnalyticsLoadingFallback />}><LazyAnalyticsDashboard /></Suspense>} />
      <Route path="/profile/routes" element={<ProfileRoutes />} />
    </Routes>
    </LoadingProvider>
  );
};

export default AppRoutes;