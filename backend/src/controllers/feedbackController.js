import db from '../../db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Контроллер для управления жалобами и предложениями
 */

// Отправить жалобу или предложение
export const submitFeedback = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const userId = req.user?.id || req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ message: 'Не удалось получить ID пользователя' });
    }

    const {
      type, // 'complaint' | 'suggestion'
      category, // 'content' | 'bug' | 'feature' | 'other'
      content_type,
      content_id,
      content_title,
      message,
    } = req.body;

    if (!type || !message) {
      return res.status(400).json({ message: 'Необходимы поля: type, message' });
    }

    if (!['complaint', 'suggestion'].includes(type)) {
      return res.status(400).json({ message: 'Некорректный тип feedback' });
    }

    if (!['content', 'bug', 'feature', 'other'].includes(category)) {
      return res.status(400).json({ message: 'Некорректная категория' });
    }

    const id = uuidv4();

    // Получаем данные пользователя
    const userResult = await db.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    const userName = userResult.rows[0]?.name || 'Анонимный пользователь';
    const userEmail = userResult.rows[0]?.email || 'unknown@example.com';

    // Вставляем в БД
    await db.query(
      `INSERT INTO feedback (id, user_id, user_name, user_email, type, category, content_type, content_id, content_title, message, status, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        id,
        userId,
        userName,
        userEmail,
        type,
        category,
        content_type || null,
        content_id || null,
        content_title || null,
        message,
        'new',
        'medium',
      ]
    );

    res.json({ ok: true, id });
  } catch (err) {
    console.error('Ошибка при отправке feedback:', err);
    res.status(500).json({ message: 'Ошибка при отправке feedback' });
  }
};

// Получить список feedback для админа
export const getFeedbackList = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const { type, status, category, sort = 'created_at DESC', limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM feedback WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (type && ['complaint', 'suggestion'].includes(type)) {
      query += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (status && ['new', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (category && ['content', 'bug', 'feature', 'other'].includes(category)) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ` ORDER BY ${sort}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Получаем общее количество
    let countQuery = 'SELECT COUNT(*) FROM feedback WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (type && ['complaint', 'suggestion'].includes(type)) {
      countQuery += ` AND type = $${countParamCount}`;
      countParams.push(type);
      countParamCount++;
    }

    if (status && ['new', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }

    if (category && ['content', 'bug', 'feature', 'other'].includes(category)) {
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
      countParamCount++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Ошибка при получении feedback:', err);
    res.status(500).json({ message: 'Ошибка при получении feedback' });
  }
};

// Получить один feedback по ID
export const getFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM feedback WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feedback не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка при получении feedback:', err);
    res.status(500).json({ message: 'Ошибка при получении feedback' });
  }
};

// Обновить статус feedback
export const updateFeedbackStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const { id } = req.params;
    const { status, priority, admin_response } = req.body;
    const adminId = req.user?.id || req.user?.user_id;

    if (!status || !['new', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Некорректный статус' });
    }

    let query = 'UPDATE feedback SET status = $1';
    const params = [status, id];
    let paramCount = 3;

    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      query += `, priority = $${paramCount}`;
      params.splice(2, 0, priority);
      paramCount++;
    }

    if (status === 'resolved') {
      query += `, resolved_at = NOW()`;
    }

    if (admin_response) {
      query += `, admin_response = $${paramCount}`;
      params.splice(params.length - 1, 0, admin_response);
      paramCount++;
    }

    if (adminId) {
      query += `, admin_id = $${paramCount}`;
      params.splice(params.length - 1, 0, adminId);
    }

    query += ` WHERE id = $${params.length}`;

    await db.query(query, params);

    res.json({ ok: true });
  } catch (err) {
    console.error('Ошибка при обновлении feedback:', err);
    res.status(500).json({ message: 'Ошибка при обновлении feedback' });
  }
};

// Получить статистику для админ-панели
export const getFeedbackStats = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'new' AND type = 'complaint') as new_complaints,
        COUNT(*) FILTER (WHERE status = 'new' AND type = 'suggestion') as new_suggestions,
        COUNT(*) FILTER (WHERE type = 'complaint') as total_complaints,
        COUNT(*) FILTER (WHERE type = 'suggestion') as total_suggestions,
        COUNT(*) FILTER (WHERE status = 'new') as total_new
      FROM feedback
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка при получении статистики feedback:', err);
    res.status(500).json({ message: 'Ошибка при получении статистики feedback' });
  }
};
