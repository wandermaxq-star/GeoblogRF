import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
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
import GlobalLoadingOverlay from './components/GlobalLoadingOverlay';
import { useAuth } from './contexts/AuthContext';
import { useIsMobile } from './hooks/use-mobile';
import WelcomeModalWrapper from './components/Gamification/WelcomeModalWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import ConditionalPage from './components/Mobile/ConditionalPage';

// Ленивая загрузка тяжёлых компонентов
const HomePage = lazy(() => import('./pages/HomePage'));
const Home = lazy(() => import('./pages/Home'));
// Map и Planner загружаются через PersistentMaps для сохранения состояния
const PersistentMaps = lazy(() => import('./pages/PersistentMaps'));
const Calendar = lazy(() => import('./pages/Calendar'));
// Блоги объединены с постами в единую ленту
// const Blog = lazy(() => import('./pages/Blog'));
// Posts - загружаем сразу (не lazy) для главной страницы, чтобы он монтировался немедленно
// Это критично для автоматической загрузки данных
import Posts from './pages/Posts';
const Activity = lazy(() => import('./pages/Activity'));
const Chat = lazy(() => import('./pages/Chat'));
const Friends = lazy(() => import('./pages/Friends'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CentrePage = lazy(() => import('./pages/CentrePage'));

// Мобильные версии страниц
// IndexPage загружаем сразу (не lazy) - это главная страница, должна загружаться быстро
import MobileIndexPage from './pages/Mobile/IndexPage';
const MobilePostsPage = lazy(() => import('./pages/Mobile/PostsPage'));
const MobileMapPage = lazy(() => import('./pages/Mobile/MapPage'));
const MobilePlannerPage = lazy(() => import('./pages/Mobile/PlannerPage'));
const MobileActivityPage = lazy(() => import('./pages/Mobile/ActivityPage'));
const MobileProfilePage = lazy(() => import('./pages/Mobile/ProfilePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ModerationPage = lazy(() => import('./pages/ModerationPage'));
const OfflineMapTest = lazy(() => import('./pages/OfflineMapTest'));

// Компонент загрузки
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Загрузка...</p>
    </div>
  </div>
);

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
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
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
                  <GlobalLoadingOverlay />
                <Routes>
              {/* Страница авторизации */}
              <Route path="/login" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <HomePage />
                </Suspense>
              } />

              {/* Тестовая страница офлайн-карт — отдельно, без GuestLayout */}
              <Route path="/offline-map-test" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <OfflineMapTest />
                </Suspense>
              } />
              
              {/* Основное приложение - доступно всем (гостевой режим + авторизованные) */}
              <Route path="/" element={<GuestLayout />}>
                {/* Главная страница - мобильная версия с лентой активности */}
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
                {/* Map и Planner используют PersistentMaps для сохранения состояния карты */}
                <Route path="map" element={
                  <ConditionalPage 
                    mobile={MobileMapPage} 
                    desktop={PersistentMaps} 
                  />
                } />
                <Route path="planner" element={
                  <ConditionalPage 
                    mobile={MobilePlannerPage} 
                    desktop={PersistentMaps} 
                  />
                } />
                <Route path="calendar" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <Calendar />
                  </Suspense>
                } />
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
                  <Suspense fallback={<LoadingSpinner />}>
                    <ConditionalPage 
                      mobile={MobileProfilePage} 
                      desktop={ProfilePage} 
                    />
                  </Suspense>
                } />
                <Route path="centre" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <CentrePage />
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
          <WelcomeModalWrapper />
        </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}