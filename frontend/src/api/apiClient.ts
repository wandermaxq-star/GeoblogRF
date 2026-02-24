import axios from 'axios';
import storageService from '../services/storageService';

// Определяем timeout в зависимости от устройства
// Для мобильных устройств увеличиваем timeout из-за медленного интернета
const getTimeout = (): number => {
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    // Для мобильных устройств увеличиваем timeout до 30 секунд
    // Для десктопа оставляем 10 секунд
    return isMobile ? 30000 : 10000;
  }
  return 10000;
};

const apiClient = axios.create({
  baseURL: '/api', // Используем относительный путь через Vite proxy
  timeout: getTimeout(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
});

// Интерсептор для автоматического добавления токена авторизации
apiClient.interceptors.request.use((config) => {
  // Берём токен из storageService
  const token = storageService.getItem('token');
  
  // Проверяем валидность токена перед использованием
  if (token) {
    try {
      // Парсим токен и проверяем, не истёк ли он
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // Если токен истёк, удаляем его из localStorage
      if (payload.exp && payload.exp < now) {
        // console.warn('⚠️ Токен истёк, удаляем из storageService');
        storageService.removeItem('token');
        storageService.removeItem('user');
        // Не добавляем токен к запросу
        return config;
      }
      
      // Добавляем токен только если он валидный
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Если токен невалидный (не JSON, повреждён), удаляем его
      // console.warn('⚠️ Токен невалидный, удаляем из localStorage:', error);
      storageService.removeItem('token');
      storageService.removeItem('user');
      // Не добавляем токен к запросу
    }
  }
  
  return config;
});

// Интерсептор для обработки ответов
apiClient.interceptors.response.use(
  (response) => {
    // Логируем успешные ответы для отладки (только для офлайн постов)
    // if (response.config?.url?.includes('/offline-posts')) {
    //   console.log('✅ Успешный ответ от сервера (офлайн посты):', {
    //     status: response.status,
    //     hasData: !!response.data,
    //     data: response.data,
    //     headers: response.headers
    //   });
    // }
    return response;
  },
  (error) => {
    // Для модерации и админ-панели НЕ глушим ошибки — админ должен видеть проблемы
    const isAdminRequest = error.config?.url?.includes('/pending') || 
                          error.config?.url?.includes('/approve') || 
                          error.config?.url?.includes('/reject') ||
                          error.config?.url?.includes('/revision') ||
                          error.config?.url?.includes('/moderation');
    
    if (isAdminRequest) {
      // Для любых админ/модерационных запросов пробрасываем ВСЕ ошибки (401, 403, 500 и т.д.)
      return Promise.reject(error);
    }
    
    // Игнорируем 500 ошибки - это проблемы бэкенда, не должны блокировать работу
    // НО не для критичных запросов (офлайн посты, авторизация)
    const isCriticalRequest = error.config?.url?.includes('/offline-posts') ||
                             error.config?.url?.includes('/login') ||
                             error.config?.url?.includes('/register');
    
    if (error.response?.status === 500 && !isCriticalRequest) {
      // Возвращаем пустой ответ вместо ошибки, чтобы не ломать работу приложения
      return Promise.resolve({ data: null, status: 500 });
    }
    
    // Для логина и регистрации не игнорируем ошибки подключения
    const isAuthRequest = error.config?.url?.includes('/login') || 
                         error.config?.url?.includes('/register') ||
                         error.config?.url?.includes('/verify-sms');
    
    // Для офлайн постов не игнорируем ошибки авторизации
    const isOfflinePostRequest = error.config?.url?.includes('/offline-posts') ||
                                 error.config?.url?.includes('/posts/') && error.config?.method === 'post';
    
    if (isAuthRequest || isOfflinePostRequest) {
      // Для авторизации и офлайн постов пробрасываем ошибки дальше
      return Promise.reject(error);
    }
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Failed to fetch')) {
      // Возвращаем пустой ответ вместо ошибки (только для не-авторизационных запросов)
      return Promise.resolve({ data: null, status: 0 });
    }
    
    if (error.response?.status === 401) {
      // Для 401 ошибок - возвращаем пустой ответ для гостевого режима
      // Гости могут создавать контент через optionalAuthenticateToken на backend
      // Но не для авторизационных запросов и офлайн постов
      if (!isAuthRequest && !isOfflinePostRequest) {
        return Promise.resolve({ data: null, status: 401 });
      }
      // Для офлайн постов пробрасываем ошибку дальше
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export function logFrontend(message: string, meta: any = {}) {
  }