import pool from '../database/config.js';
import logger from '../../logger.js';

// Получить все блоги
const getAllBlogs = async (req, res) => {
  try {
    const query = `
      SELECT 
        bp.*,
        u.username as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.status = 'published'
      ORDER BY bp.created_at DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Получить блог по ID
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        bp.*,
        u.username as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts bp
      LEFT JOIN users u ON bp.author_id = u.id
      WHERE bp.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Блог не найден' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Создать новый блог
const createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      status: requestedStatus = 'draft'
    } = req.body;
    
    const author_id = req.user.id;
    
    // Проверяем роль пользователя - только админ может создавать сразу активные блоги
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [author_id]);
    const userRole = userResult.rows[0]?.role || 'registered';
    const isAdmin = userRole === 'admin';
    
    // Устанавливаем статус: если статус 'published', то админ может сразу 'active', остальные - 'pending'
    // Если статус 'draft', оставляем как есть
    let finalStatus = requestedStatus;
    if (requestedStatus === 'published') {
      finalStatus = isAdmin ? 'active' : 'pending';
    }
    logger.info(`📊 Статус блога: ${finalStatus} (пользователь: ${userRole}, админ: ${isAdmin}, запрошен: ${requestedStatus})`);
    
    const query = `
      INSERT INTO blog_posts (
        author_id, title, content, excerpt, cover_image_url, 
        tags, related_route_id, related_markers, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      author_id,
      title,
      content,
      excerpt,
      cover_image_url,
      tags || [],
      related_route_id,
      related_markers || [],
      finalStatus
    ];
    
    const result = await pool.query(query, values);
    const createdBlog = result.rows[0];
    
    // Автоматический анализ ИИ только для pending контента
    if (finalStatus === 'pending') {
      try {
        const { autoAnalyzeContent } = await import('../middleware/autoModeration.js');
        autoAnalyzeContent('blogs', createdBlog.id, createdBlog).catch(err => {
          console.error('Ошибка автоматического анализа блога:', err);
        });
      } catch (err) {
        console.warn('Не удалось запустить автоматический анализ блога:', err.message);
      }
    }
    
    // Увеличиваем счетчик просмотров
    await pool.query(
      'UPDATE blog_posts SET views_count = views_count + 1 WHERE id = $1',
      [createdBlog.id]
    );
    
    res.status(201).json(createdBlog);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Обновить блог
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      status
    } = req.body;
    
    const author_id = req.user.id;
    
    // Проверяем, что пользователь является автором блога
    const checkQuery = 'SELECT author_id FROM blog_posts WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Блог не найден' });
    }
    
    if (checkResult.rows[0].author_id !== author_id) {
      return res.status(403).json({ error: 'Нет прав для редактирования' });
    }
    
    const query = `
      UPDATE blog_posts SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        excerpt = COALESCE($3, excerpt),
        cover_image_url = COALESCE($4, cover_image_url),
        tags = COALESCE($5, tags),
        related_route_id = COALESCE($6, related_route_id),
        related_markers = COALESCE($7, related_markers),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;
    
    const values = [
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      status,
      id
    ];
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Удалить блог
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const author_id = req.user.id;
    
    // Проверяем права доступа
    const checkQuery = 'SELECT author_id FROM blog_posts WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Блог не найден' });
    }
    
    if (checkResult.rows[0].author_id !== author_id) {
      return res.status(403).json({ error: 'Нет прав для удаления' });
    }
    
    await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
    res.json({ message: 'Блог успешно удален' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Получить блоги пользователя
const getUserBlogs = async (req, res) => {
  try {
    const author_id = req.user.id;
    
    const query = `
      SELECT * FROM blog_posts 
      WHERE author_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [author_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Получить черновики пользователя
const getUserDrafts = async (req, res) => {
  try {
    const author_id = req.user.id;
    
    const query = `
      SELECT * FROM blog_posts 
      WHERE author_id = $1 AND status = 'draft'
      ORDER BY updated_at DESC
    `;
    
    const result = await pool.query(query, [author_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Сохранить черновик
const saveDraft = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      constructor_data // Новое поле для данных конструктора
    } = req.body;
    
    const author_id = req.user.id;
    
    const query = `
      INSERT INTO blog_posts (
        author_id, title, content, excerpt, cover_image_url, 
        tags, related_route_id, related_markers, status, constructor_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
      RETURNING *
    `;
    
    const values = [
      author_id,
      title || '',
      content || '',
      excerpt || '',
      cover_image_url || '',
      tags || [],
      related_route_id || null,
      related_markers || [],
      JSON.stringify(constructor_data || {})
    ];
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Обновить черновик
const updateDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      constructor_data
    } = req.body;
    
    const author_id = req.user.id;
    
    // Проверяем, что пользователь является автором черновика
    const checkQuery = 'SELECT author_id, status FROM blog_posts WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Черновик не найден' });
    }
    
    if (checkResult.rows[0].author_id !== author_id) {
      return res.status(403).json({ error: 'Нет прав для редактирования' });
    }
    
    if (checkResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Можно обновлять только черновики' });
    }
    
    const query = `
      UPDATE blog_posts SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        excerpt = COALESCE($3, excerpt),
        cover_image_url = COALESCE($4, cover_image_url),
        tags = COALESCE($5, tags),
        related_route_id = COALESCE($6, related_route_id),
        related_markers = COALESCE($7, related_markers),
        constructor_data = COALESCE($8, constructor_data),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;
    
    const values = [
      title,
      content,
      excerpt,
      cover_image_url,
      tags,
      related_route_id,
      related_markers,
      JSON.stringify(constructor_data || {}),
      id
    ];
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Лайкнуть блог
const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    
    // Проверяем, не лайкнул ли уже пользователь
    const existingLike = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, user_id]
    );
    
    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: 'Блог уже лайкнут' });
    }
    
    // Добавляем лайк
    await pool.query(
      'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
      [id, user_id]
    );
    
    // Увеличиваем счетчик лайков
    await pool.query(
      'UPDATE blog_posts SET likes_count = likes_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ message: 'Блог лайкнут' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Убрать лайк с блога
const unlikeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    
    // Удаляем лайк
    const result = await pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, user_id]
    );
    
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Лайк не найден' });
    }
    
    // Уменьшаем счетчик лайков
    await pool.query(
      'UPDATE blog_posts SET likes_count = likes_count - 1 WHERE id = $1',
      [id]
    );
    
    res.json({ message: 'Лайк убран' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// ВРЕМЕННЫЙ ENDPOINT ДЛЯ ОЧИСТКИ БЛОГОВ (ТОЛЬКО ДЛЯ РАЗРАБОТКИ!)
const clearAllBlogs = async (req, res) => {
  try {
    // Удаляем все блоги
    const deleteResult = await pool.query('DELETE FROM blog_posts');
    // Сбросим автоинкремент
    await pool.query('ALTER SEQUENCE blog_posts_id_seq RESTART WITH 1');
    // Проверяем результат
    const checkResult = await pool.query('SELECT COUNT(*) as count FROM blog_posts');
    res.json({ 
      message: 'Все блоги очищены!', 
      deleted: deleteResult.rowCount,
      remaining: checkResult.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

export {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getUserBlogs,
  getUserDrafts,
  saveDraft,
  updateDraft,
  likeBlog,
  unlikeBlog,
  clearAllBlogs
};

