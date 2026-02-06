// КРИТИЧНО: React должен загружаться первым, до всех остальных модулей
import React from 'react'
// Явно импортируем createContext, чтобы убедиться, что React полностью загружен
if (typeof React.createContext === 'undefined') {
  throw new Error('React is not properly loaded. createContext is undefined.');
}
import ReactDOM from 'react-dom/client'
import App from './App'

// Инициализация i18n должна быть выполнена как можно раньше
import './i18n';

// Во время разработки (codespaces / preview) манифест может переадресовываться
// на страницы авторизации хоста (например, github.dev) и вызывать CORS ошибки в консоли.
// Удаляем ссылку на manifest в деве, чтобы не шуметь в логах и не ломать поведение.
if (typeof document !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.parentNode) {
      manifestLink.parentNode.removeChild(manifestLink);
      console.debug('[main] Removed manifest link in dev to avoid CORS errors');
    }
  } catch (e) { /* ignore */ }
}

// Критические стили загружаем сразу
// Шаг 3: Интеграция глобальной точки входа стилей
import './styles/index.css';
import './index.css'
import './styles/popup.css'

// Стили Leaflet загружаем динамически только когда нужны
// import 'leaflet/dist/leaflet.css'
// import 'leaflet.markercluster/dist/MarkerCluster.css'
// import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import { logFrontend } from './api/apiClient';
import ErrorBoundary from './components/ErrorBoundary';

// КРИТИЧНО: Предзагружаем скрипт Yandex Maps сразу при старте приложения
// Это ускорит загрузку Planner, так как скрипт уже будет загружен
(function preloadYandexMaps() {
  // Проверяем, не загружен ли уже скрипт
  if (typeof window !== 'undefined' && !window.ymaps) {
    const existingScript = document.querySelector('script[src*="api-maps.yandex.ru"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://api-maps.yandex.ru/2.1/?apikey=36b83eab-e2fd-41bd-979d-b9044cfffeab&lang=ru_RU';
      script.async = true;
      script.defer = true;
      // Начинаем загрузку скрипта в фоне
      document.head.appendChild(script);
      if (process.env.NODE_ENV === 'development') {
      }
    }
  }
})();

// Функция для проверки, является ли ошибка ошибкой расширения браузера
function isBrowserExtensionError(msg: string | Event, reason?: any): boolean {
  const errorMessage = typeof msg === 'string' 
    ? msg 
    : reason?.message || reason?.toString() || '';
  
  const errorString = errorMessage.toLowerCase();
  
  // Проверяем все известные паттерны ошибок расширений браузера
  return (
    errorString.includes('message channel closed') ||
    errorString.includes('runtime.lasterror') ||
    errorString.includes('runtime.lastError') ||
    errorString.includes('asynchronous response') ||
    errorString.includes('extension context invalidated') ||
    errorString.includes('receiving end does not exist') ||
    errorString.includes('message port closed')
  );
}

// Глобальный обработчик синхронных ошибок
window.onerror = function (msg, url, line, col, error) {
  // Игнорируем ошибки расширений браузера
  if (isBrowserExtensionError(msg)) {
    return true; // Предотвращаем вывод ошибки в консоль
  }
  
  // Логируем только реальные ошибки приложения
  if (process.env.NODE_ENV === 'development') {
  }
  logFrontend(`JS Error: ${msg} at ${url}:${line}:${col}`, { stack: error?.stack });
  return false; // Позволяем браузеру обработать ошибку стандартным способом
};

// Глобальный обработчик необработанных промисов (Promise rejections)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  
  // Игнорируем ошибки расширений браузера
  if (isBrowserExtensionError('', reason)) {
    event.preventDefault(); // Предотвращаем вывод ошибки в консоль
    return;
  }
  
  // Логируем только реальные ошибки приложения
  if (process.env.NODE_ENV === 'development') {
  }
  
  // Можно добавить логирование реальных ошибок приложения
  if (reason && typeof reason === 'object' && reason.message) {
    logFrontend(`Unhandled Promise Rejection: ${reason.message}`, { 
      stack: reason.stack,
      reason: reason.toString()
    });
  }
});

// Обработка ошибок Service Workers (если используются)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('error', (event: Event) => {
    const errorEvent = event as ErrorEvent;
    if (isBrowserExtensionError(errorEvent.message || '', errorEvent.error)) {
      event.preventDefault();
      return;
    }
  });
  
  navigator.serviceWorker.addEventListener('messageerror', (event: Event) => {
    // Игнорируем ошибки message channel в Service Workers
    if (isBrowserExtensionError('', event)) {
      event.preventDefault();
      return;
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
