import Activity from '../models/Activity.js';

// Получить ленту активности
const getActivityFeed = async (req, res) => {
  try {
    const user_id = req.user.id;
    const {
      limit = 20,
      offset = 0,
      activity_types,
      target_types,
      only_unread = false
    } = req.query;

    // Парсим массивы из query параметров
    const parsedActivityTypes = activity_types ? activity_types.split(',') : null;
    const parsedTargetTypes = target_types ? target_types.split(',') : null;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      activity_types: parsedActivityTypes,
      target_types: parsedTargetTypes,
      only_unread: only_unread === 'true'
    };

    const activities = await Activity.getFeed(user_id, options);

    res.json({
      success: true,
      data: activities,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: activities.length === options.limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении ленты активности'
    });
  }
};

// Получить статистику активности
const getActivityStats = async (req, res) => {
  try {
    const user_id = req.user.id;
    const stats = await Activity.getStats(user_id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении статистики'
    });
  }
};

// Создать активность (для внутреннего использования)
const createActivity = async (req, res) => {
  try {
    const {
      user_id,
      activity_type,
      target_type,
      target_id,
      metadata = {},
      is_public = true
    } = req.body;

    // Валидация обязательных полей
    if (!user_id || !activity_type || !target_type) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные поля: user_id, activity_type, target_type'
      });
    }

    const activity = await Activity.create({
      user_id,
      activity_type,
      target_type,
      target_id,
      metadata,
      is_public
    });

    res.status(201).json({
      success: true,
      data: activity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при создании активности'
    });
  }
};

// Отметить активность как прочитанную
const markAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id: activity_id } = req.params;

    await Activity.markAsRead(user_id, activity_id);

    res.json({
      success: true,
      message: 'Активность отмечена как прочитанная'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при отметке активности'
    });
  }
};

// Отметить все активности как прочитанные
const markAllAsRead = async (req, res) => {
  try {
    const user_id = req.user.id;
    const count = await Activity.markAllAsRead(user_id);

    res.json({
      success: true,
      message: `Отмечено как прочитанные: ${count} активностей`,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при отметке активностей'
    });
  }
};

// Получить настройки приватности
const getPrivacySettings = async (req, res) => {
  try {
    const user_id = req.user.id;
    const settings = await Activity.getPrivacySettings(user_id);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении настроек'
    });
  }
};

// Обновить настройки приватности
const updatePrivacySettings = async (req, res) => {
  try {
    const user_id = req.user.id;
    const settings = req.body;

    // Валидация настроек
    const validVisibilityOptions = ['public', 'friends', 'private', 'anonymous'];
    const visibilityFields = [
      'room_created_visibility', 'room_joined_visibility',
      'post_created_visibility', 'post_published_visibility',
      'marker_created_visibility', 'route_created_visibility',
      'route_shared_visibility', 'event_created_visibility',
      'event_joined_visibility', 'achievement_earned_visibility',
      'level_up_visibility', 'challenge_completed_visibility',
      'profile_updated_visibility', 'friend_added_visibility'
    ];

    for (const field of visibilityFields) {
      if (settings[field] && !validVisibilityOptions.includes(settings[field])) {
        return res.status(400).json({
          success: false,
          error: `Недопустимое значение для ${field}: ${settings[field]}`
        });
      }
    }

    const updatedSettings = await Activity.updatePrivacySettings(user_id, settings);

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Настройки приватности обновлены'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при обновлении настроек'
    });
  }
};

// Удалить активность
const deleteActivity = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id: activity_id } = req.params;
    const is_admin = req.user.role === 'admin'; // Предполагаем, что есть поле role

    const deleted = await Activity.delete(activity_id, user_id, is_admin);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Активность не найдена или у вас нет прав на её удаление'
      });
    }

    res.json({
      success: true,
      message: 'Активность удалена'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при удалении активности'
    });
  }
};

// Вспомогательная функция для создания активности (для использования в других контроллерах)
const createActivityHelper = async (user_id, activity_type, target_type, target_id = null, metadata = {}) => {
  try {
    // Получаем настройки приватности пользователя
    const privacySettings = await Activity.getPrivacySettings(user_id);
    
    // Определяем публичность на основе настроек
    let is_public = true;
    if (privacySettings) {
      const visibilityField = `${activity_type}_visibility`;
      const visibility = privacySettings[visibilityField];
      is_public = visibility === 'public' || visibility === 'anonymous';
    }

    return await Activity.create({
      user_id,
      activity_type,
      target_type,
      target_id,
      metadata,
      is_public
    });
  } catch (error) {
    // Не выбрасываем ошибку, чтобы не нарушить основной процесс
    return null;
  }
};

export {
  getActivityFeed,
  getActivityStats,
  createActivity,
  markAsRead,
  markAllAsRead,
  getPrivacySettings,
  updatePrivacySettings,
  deleteActivity,
  createActivityHelper
};
