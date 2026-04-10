import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GuestProvider } from './contexts/GuestContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { NotificationProvider } from './components/Notifications/NotificationProvider';
import { AnalyticsProvider } from './components/AnalyticsProvider';
import MainLayout from './layouts/MainLayout';
import MobileLayout from './layouts/MobileLayout';
import { LoadingProvider } from './contexts/LoadingContext';
// GlobalLoadingOverlay formerly showed test indicators while pages loaded; removed
import { useAuth } from './contexts/AuthContext';
import { useIsMobile } from './hooks/use-mobile';
const WelcomeModalWrapper = lazy(() => import('./components/Gamification/WelcomeModalWrapper'));
import ErrorBoundary from './components/ErrorBoundary';
import ConditionalPage from './components/Mobile/ConditionalPage';

// Ленивая загрузка тяжёлых компонентов
const HomePage = lazy(() => import('./pages/HomePage'));
const Home = lazy(() => import('./pages/Home'));
// Map и Planner загружаются через PersistentMaps для сохранения состояния
const PersistentMaps = lazy(() => import('./pages/PersistentMaps'));
// Calendar удалён — /calendar редиректит на /map (EventPanel)
// Блоги объединены с постами в единую ленту
// const Blog = lazy(() => import('./pages/Blog'));
// Posts - загружаем сразу (не lazy) для главной страницы, чтобы он монтировался немедленно
// Это критично для автоматической загрузки данных
import Posts from './pages/Posts';
const Activity = lazy(() => import('./pages/Activity'));
const Chat = lazy(() => import('./pages/Chat'));
const Friends = lazy(() => import('./pages/Friends'));
// ProfilePage слишком критична, загружаем её статически, чтобы избежать ошибок
import ProfilePage from './pages/ProfilePage';
const CentrePage = lazy(() => import('./pages/CentrePage'));
const FavoritesPage = lazy(() => import('./pages/Favorites'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const ProPage = lazy(() => import('./pages/ProPage'));
const HubPage = lazy(() => import('./pages/HubPage'));
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard'));
const PartnerApply = lazy(() => import('./pages/PartnerApply'));
const PartnerProgramInfo = lazy(() => import('./pages/PartnerProgramInfo'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

// Мобильные версии страниц
// IndexPage - lazy, загрузится мгновенно при необходимости (только на мобильных)
const MobileIndexPage = lazy(() => import('./pages/Mobile/IndexPage'));
const MobilePostsPage = lazy(() => import('./pages/Mobile/PostsPage'));
// MobilePageLayer - контейнер для Map и Planner (обе страницы всегда смонтированы)
const MobilePageLayer = lazy(() => import('./pages/MobilePageLayer'));
const MobileActivityPage = lazy(() => import('./pages/Mobile/ActivityPage'));
const MobileProfilePage = lazy(() => import('./pages/Mobile/ProfilePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ModerationPage = lazy(() => import('./pages/ModerationPage'));
const OfflineMapTest = lazy(() => import('./pages/OfflineMapTest'));
const OfflinePage = lazy(() => import('./pages/OfflinePage'));

// Компонент загрузки
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Загрузка...</p>
    </div>
  </div>
);

// Компонент для авторизации - БЕЗ MainLayout, полный экран
function AuthLayout() {
  return (
    <div className="auth-layout" style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      position: 'relative'
    }}>
      <Outlet />
    </div>
  );
}

// Компонент для гостевого режима с полным функционалом
function GuestLayout() {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return <MobileLayout />;
  }
  
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}

// Компонент для защищённых маршрутов с Layout (только для авторизованных)
function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  const isMobile = useIsMobile();

  // Пока идёт восстановление сессии (token есть, user загружается) — показываем splash
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-page, #0f172a)' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
          Загрузка...
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <HomePage />;
  }
  
  if (isMobile) {
    return <MobileLayout />;
  }
  
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <GamificationProvider>
          <NotificationProvider>
            <AnalyticsProvider>
          <GuestProvider>
            <LayoutProvider>
              <FavoritesProvider>
                <LoadingProvider>
                {/* overlay disabled */}
                <Routes>
              {/* Тестовая страница офлайн-карт — отдельно, без GuestLayout */}
              <Route path="/offline-map-test" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <OfflineMapTest />
                </Suspense>
              } />

              {/* Офлайн карты регионов — интерактивная SVG-карта */}
              <Route path="/offline" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <OfflinePage />
                </Suspense>
              } />
              
              {/* === АВТОРИЗАЦИЯ: БЕЗ MainLayout === */}
              {/* Auth страницы должны быть ОТДЕЛЬНО, чтобы не было Topbar/Sidebar */}
              <Route path="/" element={<AuthLayout />}>
                <Route path="login" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <LoginPage />
                  </Suspense>
                } />
                {/* /register рендерит LoginPage — она сама переключается в режим register по URL */}
                <Route path="register" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <LoginPage />
                  </Suspense>
                } />
                <Route path="auth" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <AuthPage />
                  </Suspense>
                } />
              </Route>
              
              {/* === ОСНОВНОЕ ПРИЛОЖЕНИЕ: С MainLayout === */}
              {/* Все остальные страницы используют GuestLayout (которая оборачивает в MainLayout) */}
              <Route path="/" element={<GuestLayout />}>
                {/* Posts загружается сразу для главной страницы, чтобы данные начали загружаться немедленно */}
                <Route index element={
                  <ConditionalPage 
                    mobile={MobileIndexPage} 
                    desktop={Posts} 
                  />
                } />
                {/* Старая приветственная страница доступна по /home */}
                <Route path="home" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <Home />
                  </Suspense>
                } />
                {/* Map и Planner используют MobilePageLayer для сохранения состояния карты на мобильных */}
                {/* Desktop версия использует PersistentMaps */}
                <Route path="map" element={
                  <ConditionalPage 
                    mobile={MobilePageLayer} 
                    desktop={PersistentMaps} 
                  />
                } />
                <Route path="planner" element={
                  <ConditionalPage 
                    mobile={MobilePageLayer} 
                    desktop={PersistentMaps} 
                  />
                } />
                <Route path="calendar" element={<Navigate to="/map" replace />} />
                {/* Посты доступны также по /posts для обратной совместимости */}
                <Route path="posts" element={
                  <ConditionalPage 
                    mobile={MobilePostsPage} 
                    desktop={Posts} 
                  />
                } />
                <Route path="activity" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ConditionalPage 
                      mobile={MobileActivityPage} 
                      desktop={Activity} 
                    />
                  </Suspense>
                } />
                <Route path="chat" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <Chat />
                  </Suspense>
                } />
                <Route path="friends" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <Friends />
                  </Suspense>
                } />
                <Route path="profile" element={
                    <ConditionalPage 
                      mobile={MobileProfilePage} 
                      desktop={ProfilePage} 
                    />
                } />
                <Route path="centre" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <CentrePage />
                  </Suspense>
                } />
                <Route path="favorites" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <FavoritesPage />
                  </Suspense>
                } />
                <Route path="legal/privacy-policy" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PrivacyPolicy />
                  </Suspense>
                } />
                <Route path="legal/user-agreement" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <UserAgreement />
                  </Suspense>
                } />
                <Route path="pro" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ProPage />
                  </Suspense>
                } />
                <Route path="hub" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <HubPage />
                  </Suspense>
                } />
                <Route path="partners" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnersPage />
                  </Suspense>
                } />
                <Route path="partner" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnerDashboard />
                  </Suspense>
                } />
                <Route path="partner/apply" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnerApply />
                  </Suspense>
                } />
                <Route path="partner/program-info" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnerProgramInfo />
                  </Suspense>
                } />
                <Route path="admin" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <AdminDashboard />
                  </Suspense>
                } />
                {/* Администрирование */}
                <Route path="admin/moderation" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ModerationPage />
                  </Suspense>
                } />
              </Route>
                </Routes>
                </LoadingProvider>
              </FavoritesProvider>
            </LayoutProvider>
          </GuestProvider>
          </AnalyticsProvider>
          </NotificationProvider>
          <Suspense fallback={null}><WelcomeModalWrapper /></Suspense>
        </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}