import pool from '../../db.js';

class Activity {
  // Создание новой активности
  static async create({
    user_id,
    activity_type,
    target_type,
    target_id = null,
    metadata = {},
    is_public = true
  }) {
    try {
      const query = `
        INSERT INTO activity_feed (
          user_id, activity_type, target_type, target_id, metadata, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [user_id, activity_type, target_type, target_id, JSON.stringify(metadata), is_public];
      const result = await pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Получение ленты активности пользователя
  static async getFeed(user_id, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        activity_types = null,
        target_types = null,
        only_unread = false
      } = options;

      let query = `
        SELECT 
          af.id,
          af.user_id,
          af.activity_type,
          af.target_type,
          af.target_id,
          af.metadata,
          af.is_public,
          af.created_at,
          u.username,
          u.avatar_url,
          COALESCE(ars.is_read, false) as is_read,
          ars.read_at
        FROM activity_feed af
        JOIN users u ON af.user_id = u.id
        LEFT JOIN activity_read_status ars ON af.id = ars.activity_id AND ars.user_id = $1
        WHERE af.is_public = true
      `;

      const values = [user_id];
      let paramIndex = 2;

      // Фильтр по типам активности
      if (activity_types && activity_types.length > 0) {
        query += ` AND af.activity_type = ANY($${paramIndex})`;
        values.push(activity_types);
        paramIndex++;
      }

      // Фильтр по типам целей
      if (target_types && target_types.length > 0) {
        query += ` AND af.target_type = ANY($${paramIndex})`;
        values.push(target_types);
        paramIndex++;
      }

      // Фильтр только непрочитанных
      if (only_unread) {
        query += ` AND (ars.is_read = false OR ars.is_read IS NULL)`;
      }

      query += ` ORDER BY af.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limit, offset);

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Получение статистики активности
  static async getStats(user_id) {
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM activity_feed WHERE is_public = true) as total_activities,
          (SELECT COUNT(*) FROM activity_feed af
           LEFT JOIN activity_read_status ars ON af.id = ars.activity_id AND ars.user_id = $1
           WHERE af.is_public = true AND (ars.is_read = false OR ars.is_read IS NULL)) as unread_activities,
          (SELECT COUNT(*) FROM activity_feed 
           WHERE is_public = true AND activity_type IN ('chat_created', 'chat_joined', 'friend_request_accepted')) as messages_count,
          (SELECT COUNT(*) FROM activity_feed 
           WHERE is_public = true AND activity_type IN ('system_maintenance', 'system_update_available', 'system_update_completed', 'system_feature_added', 'system_feature_removed', 'system_security_alert', 'system_performance_boost')) as system_count
      `;
      
      const result = await pool.query(query, [user_id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Отметка активности как прочитанной
  static async markAsRead(user_id, activity_id) {
    try {
      const query = `
        INSERT INTO activity_read_status (user_id, activity_id, is_read, read_at)
        VALUES ($1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, activity_id) 
        DO UPDATE SET 
          is_read = true,
          read_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await pool.query(query, [user_id, activity_id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Отметка всех активностей как прочитанных
  static async markAllAsRead(user_id) {
    try {
      const query = `
        INSERT INTO activity_read_status (user_id, activity_id, is_read, read_at)
        SELECT $1, af.id, true, CURRENT_TIMESTAMP
        FROM activity_feed af
        WHERE af.is_public = true
        AND af.id NOT IN (
          SELECT activity_id FROM activity_read_status WHERE user_id = $1
        )
        ON CONFLICT (user_id, activity_id) 
        DO UPDATE SET 
          is_read = true,
          read_at = CURRENT_TIMESTAMP
      `;

      const result = await pool.query(query, [user_id]);
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  // Получение настроек приватности пользователя
  static async getPrivacySettings(user_id) {
    try {
      const query = `
        SELECT * FROM activity_privacy_settings 
        WHERE user_id = $1
      `;

      const result = await pool.query(query, [user_id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Обновление настроек приватности
  static async updatePrivacySettings(user_id, settings) {
    try {
      const {
        room_created_visibility,
        room_joined_visibility,
        post_created_visibility,
        post_published_visibility,
        marker_created_visibility,
        route_created_visibility,
        route_shared_visibility,
        event_created_visibility,
        event_joined_visibility,
        achievement_earned_visibility,
        level_up_visibility,
        challenge_completed_visibility,
        profile_updated_visibility,
        friend_added_visibility,
        email_notifications,
        push_notifications,
        in_app_notifications,
        show_activity_duration
      } = settings;

      const query = `
        INSERT INTO activity_privacy_settings (
          user_id, room_created_visibility, room_joined_visibility,
          post_created_visibility, post_published_visibility,
          marker_created_visibility, route_created_visibility,
          route_shared_visibility, event_created_visibility,
          event_joined_visibility, achievement_earned_visibility,
          level_up_visibility, challenge_completed_visibility,
          profile_updated_visibility, friend_added_visibility,
          email_notifications, push_notifications, in_app_notifications,
          show_activity_duration
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          room_created_visibility = EXCLUDED.room_created_visibility,
          room_joined_visibility = EXCLUDED.room_joined_visibility,
          post_created_visibility = EXCLUDED.post_created_visibility,
          post_published_visibility = EXCLUDED.post_published_visibility,
          marker_created_visibility = EXCLUDED.marker_created_visibility,
          route_created_visibility = EXCLUDED.route_created_visibility,
          route_shared_visibility = EXCLUDED.route_shared_visibility,
          event_created_visibility = EXCLUDED.event_created_visibility,
          event_joined_visibility = EXCLUDED.event_joined_visibility,
          achievement_earned_visibility = EXCLUDED.achievement_earned_visibility,
          level_up_visibility = EXCLUDED.level_up_visibility,
          challenge_completed_visibility = EXCLUDED.challenge_completed_visibility,
          profile_updated_visibility = EXCLUDED.profile_updated_visibility,
          friend_added_visibility = EXCLUDED.friend_added_visibility,
          email_notifications = EXCLUDED.email_notifications,
          push_notifications = EXCLUDED.push_notifications,
          in_app_notifications = EXCLUDED.in_app_notifications,
          show_activity_duration = EXCLUDED.show_activity_duration,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [
        user_id, room_created_visibility, room_joined_visibility,
        post_created_visibility, post_published_visibility,
        marker_created_visibility, route_created_visibility,
        route_shared_visibility, event_created_visibility,
        event_joined_visibility, achievement_earned_visibility,
        level_up_visibility, challenge_completed_visibility,
        profile_updated_visibility, friend_added_visibility,
        email_notifications, push_notifications, in_app_notifications,
        show_activity_duration
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Удаление активности (только для автора или админа)
  static async delete(activity_id, user_id, is_admin = false) {
    try {
      let query = `
        DELETE FROM activity_feed 
        WHERE id = $1
      `;
      const values = [activity_id];

      if (!is_admin) {
        query += ` AND user_id = $2`;
        values.push(user_id);
      }

      const result = await pool.query(query, values);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }
}

export default Activity;
