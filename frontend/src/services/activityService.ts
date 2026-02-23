import apiClient from '../api/apiClient';

export interface ActivityItem {
  id: string;
  user_id: string;
  activity_type: string;
  target_type: string;
  target_id?: string;
  metadata: Record<string, any>;
  is_public: boolean;
  created_at: string;
  username: string;
  avatar_url?: string;
  is_read: boolean;
  read_at?: string;
}

export interface ActivityStats {
  total_activities: number;
  unread_activities: number;
  message_activities: number;
  system_activities: number;
}

export interface ActivityFeedResponse {
  success: boolean;
  data: ActivityItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface PrivacySettings {
  // room/blog visibility убрано — не используется в ленте
  marker_created_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  route_created_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  route_shared_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  event_created_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  event_joined_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  achievement_earned_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  level_up_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  challenge_completed_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  profile_updated_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  friend_added_visibility: 'public' | 'friends' | 'private' | 'anonymous';
  email_notifications: boolean;
  push_notifications: boolean;
  in_app_notifications: boolean;
  show_activity_duration: number;
}

export interface ActivityFilters {
  limit?: number;
  offset?: number;
  activity_types?: string[];
  target_types?: string[];
  only_unread?: boolean;
}

class ActivityService {
  // Получить ленту активности
  async getActivityFeed(filters: ActivityFilters = {}): Promise<ActivityFeedResponse> {
    const params = new URLSearchParams();
    
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.activity_types?.length) params.append('activity_types', filters.activity_types.join(','));
    if (filters.target_types?.length) params.append('target_types', filters.target_types.join(','));
    if (filters.only_unread) params.append('only_unread', 'true');

    const response = await apiClient.get(`/activity?${params.toString()}`);
    return response.data;
  }

  // Получить статистику активности
  async getActivityStats(): Promise<ActivityStats> {
    const response = await apiClient.get('/activity/stats');
    return response.data.data;
  }

  // Создать активность
  async createActivity(activityData: {
    user_id: string;
    activity_type: string;
    target_type: string;
    target_id?: string;
    metadata?: Record<string, any>;
    is_public?: boolean;
  }) {
    const response = await apiClient.post('/activity', activityData);
    return response.data;
  }

  // Вспомогательная функция для создания активности
  async createActivityHelper(
    activityType: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, any>,
    isPublic: boolean = true
  ) {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('jwt');
      if (!token) {
        return;
      }

      // Получаем ID пользователя из токена (JWT декодирование)
      let user_id = 'current_user';
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        user_id = payload.user_id || payload.id || payload.sub || 'current_user';
      } catch (e) {
        }
      
      await this.createActivity({
        user_id,
        activity_type: activityType,
        target_type: targetType,
        target_id: targetId,
        metadata,
        is_public: isPublic
      });
      
      } catch (error) {
      }
  }

  // Отметить активность как прочитанную
  async markAsRead(activityId: string) {
    const response = await apiClient.put(`/activity/${activityId}/read`);
    return response.data;
  }

  // Отметить все активности как прочитанные
  async markAllAsRead() {
    const response = await apiClient.put('/activity/read-all');
    return response.data;
  }

  // Получить настройки приватности
  async getPrivacySettings(): Promise<PrivacySettings> {
    const response = await apiClient.get('/activity/privacy');
    return response.data.data;
  }

  // Обновить настройки приватности
  async updatePrivacySettings(settings: Partial<PrivacySettings>) {
    const response = await apiClient.put('/activity/privacy', settings);
    return response.data;
  }

  // Удалить активность
  async deleteActivity(activityId: string) {
    const response = await apiClient.delete(`/activity/${activityId}`);
    return response.data;
  }

  // Получить иконку для типа активности
  getActivityIcon(activityType: string): string {
    const iconMap: Record<string, string> = {
      // События
      'event_created': 'FaCalendarPlus',
      'event_joined': 'FaCheckCircle',
      'event_updated': 'FaEdit',
      'event_cancelled': 'FaTimesCircle',
      'event_completed': 'FaCheckDouble',
      'event_left': 'FaUserMinus',
      
      // Маршруты
      'route_created': 'FaRoute',
      'route_shared': 'FaShare',
      'route_updated': 'FaEdit',
      'route_deleted': 'FaTrash',
      'route_favorited': 'FaHeart',
      'route_unfavorited': 'FaHeartBroken',
      'route_rated': 'FaStar',
      'route_commented': 'FaComment',
      
      // Метки
      'marker_created': 'FaMapMarkerAlt',
      'marker_updated': 'FaEdit',
      'marker_deleted': 'FaTrash',
      'marker_favorited': 'FaHeart',
      'marker_unfavorited': 'FaHeartBroken',
      'marker_rated': 'FaStar',
      'marker_commented': 'FaComment',
      'marker_visited': 'FaCheckCircle',
      
      // Пользователи и социальные взаимодействия
      'user_followed': 'FaUserFriends',
      'user_unfollowed': 'FaUserMinus',
      'user_blocked': 'FaBan',
      'user_unblocked': 'FaCheckCircle',
      'friend_added': 'FaUserFriends',
      'friend_removed': 'FaUserMinus',
      'friend_request_sent': 'FaUserPlus',
      'friend_request_accepted': 'FaCheckCircle',
      'friend_request_declined': 'FaTimesCircle',
      
      // Достижения и геймификация
      'achievement_earned': 'FaBell', // Красный колокольчик для "выполнил действие"
      'achievement_progress': 'FaChartLine',
      'level_up': 'FaArrowUp',
      'level_milestone': 'FaTrophy',
      'challenge_started': 'FaPlay',
      'challenge_completed': 'FaBullseye',
      'challenge_failed': 'FaTimes',
      'badge_earned': 'FaMedal',
      'streak_started': 'FaFire',
      'streak_broken': 'FaSnowflake',
      
      // Системные уведомления
      'system_update': 'FaCog',
      'system_announcement': 'FaBullhorn',
      'system_maintenance': 'FaTools',
      'system_update_available': 'FaDownload',
      'system_update_completed': 'FaCheckCircle',
      'system_feature_added': 'FaPlus',
      'system_feature_removed': 'FaMinus',
      'system_security_alert': 'FaShieldAlt',
      'system_performance_boost': 'FaRocket',
      
      // Модерация и безопасность
      'content_reported': 'FaFlag',
      'content_moderated': 'FaCheckCircle',
      'content_flagged': 'FaFlag',
      'content_approved': 'FaCheckCircle',
      'content_hidden': 'FaEyeSlash',
      'content_blocked': 'FaBan',
      'content_published': 'FaGlobe',
      'spam_detected': 'FaExclamationTriangle',
      'fake_review_detected': 'FaUserSecret',
      'content_rejected': 'FaTimesCircle',
      'user_warned': 'FaExclamationTriangle',
      'user_suspended': 'FaBan',
      'user_unbanned': 'FaCheckCircle',
      
      // Интеграции и внешние сервисы
      'integration_connected': 'FaLink',
      'integration_disconnected': 'FaUnlink',
      'api_key_generated': 'FaKey',
      'webhook_created': 'FaLink', // Используем FaLink вместо FaWebhook
      'export_completed': 'FaDownload',
      'import_completed': 'FaUpload',
      
      // Профиль
      'profile_updated': 'FaUserEdit'
    };
    return iconMap[activityType] || 'FaBell';
  }

  // Получить цвет для типа активности
  getActivityColor(activityType: string): string {
    const colorMap: Record<string, string> = {
      // События - зеленый
      'event_created': '#28A745',
      'event_joined': '#28A745',
      'event_updated': '#28A745',
      'event_cancelled': '#DC3545',
      'event_completed': '#28A745',
      'event_left': '#6C757D',
      
      // Маршруты - оранжевый
      'route_created': '#FD7E14',
      'route_shared': '#424242', // Насыщенно-серый для "поделился маршрутом"
      'route_updated': '#FD7E14',
      'route_deleted': '#DC3545',
      'route_favorited': '#E83E8C',
      'route_unfavorited': '#6C757D',
      'route_rated': '#FFC107',
      'route_commented': '#17A2B8',
      
      // Метки - фиолетовый
      'marker_created': '#6F42C1',
      'marker_updated': '#6F42C1',
      'marker_deleted': '#DC3545',
      'marker_favorited': '#E83E8C',
      'marker_unfavorited': '#6C757D',
      'marker_rated': '#FFC107',
      'marker_commented': '#17A2B8',
      'marker_visited': '#28A745',
      
      // Пользователи и социальные взаимодействия - синий
      'user_followed': '#007BFF',
      'user_unfollowed': '#6C757D',
      'user_blocked': '#DC3545',
      'user_unblocked': '#28A745',
      'friend_added': '#007BFF',
      'friend_removed': '#6C757D',
      'friend_request_sent': '#007BFF',
      'friend_request_accepted': '#28A745',
      'friend_request_declined': '#DC3545',
      
      // Достижения и геймификация - красный/золотой
      'achievement_earned': '#F44336', // Красный колокольчик для "выполнил действие"
      'achievement_progress': '#FF9800',
      'level_up': '#FF9800',
      'level_milestone': '#FFD700',
      'challenge_started': '#FF9800',
      'challenge_completed': '#28A745',
      'challenge_failed': '#DC3545',
      'badge_earned': '#FFD700',
      'streak_started': '#FF5722',
      'streak_broken': '#6C757D',
      
      // Системные уведомления - фиолетовый
      'system_update': '#6F42C1',
      'system_announcement': '#6F42C1',
      'system_maintenance': '#6C757D',
      'system_update_available': '#17A2B8',
      'system_update_completed': '#28A745',
      'system_feature_added': '#28A745',
      'system_feature_removed': '#DC3545',
      'system_security_alert': '#DC3545',
      'system_performance_boost': '#28A745',
      
      // Модерация и безопасность - красный
      'content_reported': '#DC3545',
      'content_moderated': '#28A745',
      'content_flagged': '#FFC107',
      'content_approved': '#28A745',
      'content_hidden': '#DC3545',
      'content_blocked': '#DC3545',
      'content_published': '#28A745',
      'spam_detected': '#DC3545',
      'fake_review_detected': '#FFC107',
      'content_rejected': '#DC3545',
      'user_warned': '#FFC107',
      'user_suspended': '#DC3545',
      'user_unbanned': '#28A745',
      
      // Интеграции и внешние сервисы - зеленый
      'integration_connected': '#28A745',
      'integration_disconnected': '#6C757D',
      'api_key_generated': '#17A2B8',
      'webhook_created': '#17A2B8',
      'export_completed': '#28A745',
      'import_completed': '#28A745',
      
      // Профиль - синий
      'profile_updated': '#007BFF'
    };
    return colorMap[activityType] || '#757575';
  }

  // Получить текст для типа активности
  getActivityText(activityType: string, _metadata: Record<string, any> = {}): string {
    const textMap: Record<string, string> = {
      // События
      'event_created': 'опубликовал событие',
      'event_joined': 'присоединился к событию',
      'event_updated': 'обновил событие',
      'event_cancelled': 'отменил событие',
      'event_completed': 'завершил событие',
      'event_left': 'покинул событие',
      
      // Маршруты
      'route_created': 'опубликовал маршрут',
      'route_shared': 'поделился маршрутом',
      'route_updated': 'обновил маршрут',
      'route_deleted': 'удалил маршрут',
      'route_favorited': 'добавил маршрут в избранное',
      'route_unfavorited': 'убрал маршрут из избранного',
      'route_rated': 'оценил маршрут',
      'route_commented': 'прокомментировал маршрут',
      
      // Метки
      'marker_created': 'опубликовал метку',
      'marker_updated': 'обновил метку',
      'marker_deleted': 'удалил метку',
      'marker_favorited': 'добавил метку в избранное',
      'marker_unfavorited': 'убрал метку из избранного',
      'marker_rated': 'оценил метку',
      'marker_commented': 'прокомментировал метку',
      'marker_visited': 'посетил метку',
      
      // Пользователи и социальные взаимодействия
      'user_followed': 'подписался на пользователя',
      'user_unfollowed': 'отписался от пользователя',
      'user_blocked': 'заблокировал пользователя',
      'user_unblocked': 'разблокировал пользователя',
      'friend_added': 'добавил друга',
      'friend_removed': 'удалил из друзей',
      'friend_request_sent': 'отправил запрос в друзья',
      'friend_request_accepted': 'принял запрос в друзья',
      'friend_request_declined': 'отклонил запрос в друзья',
      
      // Достижения и геймификация
      'achievement_earned': 'выполнил действие', // Изменено с "получил достижение" на "выполнил действие"
      'achievement_progress': 'прогресс по достижению',
      'level_up': 'повысил уровень',
      'level_milestone': 'достиг вехи уровня',
      'challenge_started': 'начал челлендж',
      'challenge_completed': 'завершил челлендж',
      'challenge_failed': 'провалил челлендж',
      'badge_earned': 'получил значок',
      'streak_started': 'начал серию',
      'streak_broken': 'прервал серию',
      
      // Системные уведомления
      'system_update': 'системное обновление',
      'system_announcement': 'системное объявление',
      'system_maintenance': 'техническое обслуживание',
      'system_update_available': 'доступно обновление',
      'system_update_completed': 'обновление завершено',
      'system_feature_added': 'добавлена новая функция',
      'system_feature_removed': 'удалена функция',
      'system_security_alert': 'предупреждение безопасности',
      'system_performance_boost': 'улучшение производительности',
      
      // Модерация и безопасность
      'content_reported': 'пожаловался на контент',
      'content_moderated': 'контент прошел модерацию',
      'content_flagged': 'контент помечен как проблемный',
      'content_approved': 'контент одобрен',
      'content_hidden': 'контент скрыт',
      'content_blocked': 'контент заблокирован',
      'content_published': 'контент опубликован',
      'spam_detected': 'обнаружен спам',
      'fake_review_detected': 'обнаружен фейковый отзыв',
      'content_rejected': 'контент отклонен',
      'user_warned': 'предупреждение пользователю',
      'user_suspended': 'блокировка пользователя',
      'user_unbanned': 'разблокировка пользователя',
      
      // Интеграции и внешние сервисы
      'integration_connected': 'подключил интеграцию',
      'integration_disconnected': 'отключил интеграцию',
      'api_key_generated': 'сгенерировал API ключ',
      'webhook_created': 'создал webhook',
      'export_completed': 'экспорт завершен',
      'import_completed': 'импорт завершен',
      
      // Профиль
      'profile_updated': 'обновил профиль'
    };
    return textMap[activityType] || 'выполнил действие';
  }

  // Форматировать время
  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    
    return date.toLocaleDateString('ru-RU');
  }
}

export const activityService = new ActivityService();