import pool from '../../db.js';
import logger from '../../logger.js';


/**
 * Получить задачи модерации для конкретной страницы/типа контента
 * Возвращает список задач с информацией о пользователе и действии
 */
export const getModerationTasks = async (req, res) => {
  try {
    const { contentType } = req.params; // 'markers', 'events', 'routes', 'posts'
    const userId = req.user?.id || req.user?.userId;

    // Проверка прав администратора
    if (!userId) {
      return res.status(401).json({ message: 'Требуется авторизация.' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tasks = [];

    switch (contentType) {
      case 'markers': {
        // Новые метки на модерации
        const newMarkers = await pool.query(`
          SELECT 
            m.id,
            m.title,
            m.description,
            m.latitude,
            m.longitude,
            m.status,
            m.created_at,
            u.username as author_name,
            u.id as author_id,
            'new_marker' as task_type,
            amd.ai_suggestion,
            amd.ai_confidence,
            amd.ai_reason
          FROM map_markers m
          LEFT JOIN users u ON u.id::text = m.creator_id
          LEFT JOIN ai_moderation_decisions amd ON amd.content_type = 'markers' AND amd.content_id = m.id::text
          WHERE m.status = 'pending'
          ORDER BY m.created_at DESC
        `);

        // Жалобы на метки
        const markerComplaints = await pool.query(`
          SELECT 
            c.id,
            c.content_id as marker_id,
            c.reason,
            c.description,
            c.status,
            c.created_at,
            u.username as author_name,
            u.id as author_id,
            'complaint' as task_type,
            m.title as marker_title,
            m.latitude,
            m.longitude
          FROM complaints c
          LEFT JOIN users u ON u.id::text = c.user_id
          LEFT JOIN map_markers m ON m.id::text = c.content_id
          WHERE c.content_type = 'markers' AND c.status = 'pending'
          ORDER BY c.created_at DESC
        `);

        // Предложения по меткам
        const markerSuggestions = await pool.query(`
          SELECT 
            s.id,
            s.content_id as marker_id,
            s.suggestion_type,
            s.description,
            s.status,
            s.created_at,
            u.username as author_name,
            u.id as author_id,
            'suggestion' as task_type,
            m.title as marker_title,
            m.latitude,
            m.longitude
          FROM suggestions s
          LEFT JOIN users u ON u.id::text = s.user_id
          LEFT JOIN map_markers m ON m.id::text = s.content_id
          WHERE s.content_type = 'markers' AND s.status = 'pending'
          ORDER BY s.created_at DESC
        `);

        tasks = [
          ...newMarkers.rows.map(row => ({
            id: `marker_${row.id}`,
            type: 'new_marker',
            title: `${row.author_name || 'Пользователь'} добавил метку ${row.title}`,
            content: row,
            coordinates: [row.latitude, row.longitude],
            created_at: row.created_at
          })),
          ...markerComplaints.rows.map(row => ({
            id: `complaint_${row.id}`,
            type: 'complaint',
            title: `${row.author_name || 'Пользователь'} пожаловался на ${row.marker_title || 'метку'}`,
            content: row,
            coordinates: row.latitude && row.longitude ? [row.latitude, row.longitude] : null,
            created_at: row.created_at
          })),
          ...markerSuggestions.rows.map(row => ({
            id: `suggestion_${row.id}`,
            type: 'suggestion',
            title: `${row.author_name || 'Пользователь'} предложил изменения для ${row.marker_title || 'метки'}`,
            content: row,
            coordinates: row.latitude && row.longitude ? [row.latitude, row.longitude] : null,
            created_at: row.created_at
          }))
        ];
        break;
      }

      case 'events': {
        const newEvents = await pool.query(`
          SELECT 
            e.id,
            e.title,
            e.description,
            e.latitude,
            e.longitude,
            e.status,
            e.created_at,
            u.username as author_name,
            u.id as author_id,
            'new_event' as task_type
          FROM events e
          LEFT JOIN users u ON u.id::text = e.creator_id
          WHERE e.status = 'pending'
          ORDER BY e.created_at DESC
        `);

        tasks = newEvents.rows.map(row => ({
          id: `event_${row.id}`,
          type: 'new_event',
          title: `${row.author_name || 'Пользователь'} добавил событие ${row.title}`,
          content: row,
          coordinates: row.latitude && row.longitude ? [row.latitude, row.longitude] : null,
          created_at: row.created_at
        }));
        break;
      }

      case 'posts': {
        const newPosts = await pool.query(`
          SELECT 
            p.id,
            p.title,
            p.body,
            p.status,
            p.created_at,
            u.username as author_name,
            u.id as author_id,
            'new_post' as task_type
          FROM posts p
          LEFT JOIN users u ON u.id::text = p.author_id
          WHERE p.status = 'pending'
          ORDER BY p.created_at DESC
        `);

        tasks = newPosts.rows.map(row => ({
          id: `post_${row.id}`,
          type: 'new_post',
          title: `${row.author_name || 'Пользователь'} создал пост ${row.title || 'без названия'}`,
          content: row,
          coordinates: null,
          created_at: row.created_at
        }));
        break;
      }

      default:
        return res.status(400).json({ message: 'Неизвестный тип контента.' });
    }

    // Сортируем по дате создания (новые сначала)
    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      tasks,
      count: tasks.length
    });
  } catch (error) {
    logger.error('Ошибка получения задач модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

/**
 * Получить количество задач модерации для всех типов контента
 */
export const getModerationTasksCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Требуется авторизация.' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM map_markers WHERE status = 'pending') as markers,
        (SELECT COUNT(*) FROM events WHERE status = 'pending') as events,
        (SELECT COUNT(*) FROM posts WHERE status = 'pending') as posts
    `);

    const result = counts.rows[0] || { markers: 0, events: 0, posts: 0 };

    res.json({
      markers: parseInt(result.markers) || 0,
      events: parseInt(result.events) || 0,
      posts: parseInt(result.posts) || 0
    });
  } catch (error) {
    logger.error('Ошибка получения счётчиков задач модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

