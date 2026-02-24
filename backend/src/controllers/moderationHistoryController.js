import pool from '../../db.js';
import logger from '../../logger.js';


/**
 * Контроллер для истории модерации
 * Показывает все посты с любым статусом для админа
 */

// Получить историю модерации для типа контента
export const getModerationHistory = async (req, res) => {
  try {
    const { contentType } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const { 
      status, 
      limit = 50, 
      offset = 0, 
      search,
      sort = 'created_at DESC'
    } = req.query;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tableName;
    let idColumn = 'id';
    let authorColumn;
    let titleColumn;
    let contentColumn;

    switch (contentType) {
      case 'events':
        tableName = 'events';
        authorColumn = 'creator_id';
        titleColumn = 'title';
        contentColumn = 'description';
        break;
      case 'posts':
        tableName = 'posts';
        authorColumn = 'author_id';
        titleColumn = 'title';
        contentColumn = 'body';
        break;
      case 'routes':
        tableName = 'travel_routes';
        authorColumn = 'creator_id';
        titleColumn = 'title';
        contentColumn = 'description';
        break;
      case 'markers':
        tableName = 'map_markers';
        authorColumn = 'creator_id';
        titleColumn = 'title';
        contentColumn = 'description';
        break;
      case 'comments':
        tableName = 'comments';
        authorColumn = 'author_id';
        titleColumn = 'content';
        contentColumn = 'content';
        break;
      default:
        return res.status(400).json({ message: 'Неизвестный тип контента.' });
    }

    // Формируем запрос с фильтрами
    let query = `
      SELECT 
        c.*,
        u.username as author_name,
        u.email as author_email,
        amd.id as ai_decision_id,
        amd.ai_suggestion,
        amd.ai_confidence,
        amd.ai_reason,
        amd.ai_category,
        amd.ai_issues,
        amd.admin_verdict,
        amd.admin_feedback,
        amd.reviewed_at,
        amd.created_at as ai_analyzed_at
        ${contentType === 'comments' ? ", p.title as source_title, 'posts' as source_type, c.post_id as source_id" : ''}
      FROM ${tableName} c
      LEFT JOIN users u ON u.id::text = c.${authorColumn}::text
      LEFT JOIN ai_moderation_decisions amd ON amd.content_type = $1 
        AND amd.content_id::text = c.${idColumn}::text
      ${contentType === 'comments' ? 'LEFT JOIN posts p ON c.post_id = p.id' : ''}
      WHERE 1=1
    `;

    const params = [contentType];
    let paramIndex = 2;

    // Фильтр по статусу
    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Поиск по тексту
    if (search) {
      query += ` AND (c.${titleColumn} ILIKE $${paramIndex} OR c.${contentColumn} ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Сортировка
    const validSortFields = ['created_at', 'updated_at', 'status', 'title'];
    const sortField = sort.split(' ')[0];
    const sortOrder = sort.includes('DESC') ? 'DESC' : 'ASC';
    const finalSortField = validSortFields.includes(sortField) ? sortField : 'created_at';
    query += ` ORDER BY c.${finalSortField} ${sortOrder}`;

    // Лимит и оффсет
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Получаем общее количество для пагинации
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ${tableName} c
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND c.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (c.${titleColumn} ILIKE $${countParamIndex} OR c.${contentColumn} ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Ошибка получения истории модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

// Получить детальную информацию о контенте с рекомендациями ИИ
export const getContentDetails = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tableName;
    let idColumn = 'id';
    let authorColumn;

    switch (contentType) {
      case 'events':
        tableName = 'events';
        authorColumn = 'creator_id';
        break;
      case 'posts':
        tableName = 'posts';
        authorColumn = 'author_id';
        break;
      case 'routes':
        tableName = 'travel_routes';
        authorColumn = 'creator_id';
        break;
      case 'markers':
        tableName = 'map_markers';
        authorColumn = 'creator_id';
        break;
      case 'comments':
        tableName = 'comments';
        authorColumn = 'author_id';
        break;
      default:
        return res.status(400).json({ message: 'Неизвестный тип контента.' });
    }

    // Получаем контент
    const contentResult = await pool.query(
      `SELECT c.*, u.username as author_name, u.email as author_email, u.role as author_role
       ${contentType === 'comments' ? ", p.title as source_title, 'posts' as source_type, c.post_id as source_id" : ''}
       FROM ${tableName} c
       LEFT JOIN users u ON u.id::text = c.${authorColumn}::text
       ${contentType === 'comments' ? 'LEFT JOIN posts p ON c.post_id = p.id' : ''}
       WHERE c.${idColumn}::text = $1`,
      [contentId]
    );

    if (contentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Контент не найден.' });
    }

    const content = contentResult.rows[0];

    // Получаем рекомендации ИИ
    const aiResult = await pool.query(
      `SELECT * FROM ai_moderation_decisions 
       WHERE content_type = $1 AND content_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [contentType, contentId]
    );

    const aiDecision = aiResult.rows[0] || null;

    // Получаем историю модерации (если есть)
    const moderationHistory = [];
    if (content.moderated_at) {
      moderationHistory.push({
        action: content.status,
        reason: content.moderation_reason,
        moderated_at: content.moderated_at,
        moderated_by: content.moderated_by
      });
    }

    res.json({
      content,
      aiDecision,
      moderationHistory
    });
  } catch (error) {
    logger.error('Ошибка получения деталей контента:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

