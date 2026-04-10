/**
 * Утилита для проверки согласия на аналитику
 * Используется во всех аналитических сервисах для проверки флага analytics_opt_out
 */

import { useAuth } from '../../contexts/AuthContext';
import storageService from '../../services/storageService';

/**
 * Проверяет, разрешена ли аналитика для текущего пользователя
 * @param user - Объект пользователя из AuthContext
 * @returns {boolean} - true если аналитика разрешена, false если отключена
 */
export const isAnalyticsEnabled = (user: any): boolean => {
  // КРИТИЧНО: Для гостей аналитика отключена (сервер требует авторизацию)
  // Гости могут использовать app без аналитики
  if (!user) {
    return false;
  }

  // Если analytics_opt_out = true, аналитика отключена
  return !user.analytics_opt_out;
};

/**
 * Получить текущее состояние согласия на аналитику
 * Используется в компонентах для проверки без хука
 */
export const getAnalyticsConsent = (): boolean => {
  try {
    // Пытаемся получить пользователя из storageService
    const savedUser = storageService.getItem('user') || storageService.getItem('user_in_session') || storageService.getItem('user');
    if (!savedUser) {
      // КРИТИЧНО: Для гостей аналитика отключена (сервер требует авторизацию)
      return false;
    }

    const user = JSON.parse(savedUser);
    return !user.analytics_opt_out;
  } catch {
    // В случае ошибки отключаем аналитику (fail-closed для гостей)
    return false;
  }
};

