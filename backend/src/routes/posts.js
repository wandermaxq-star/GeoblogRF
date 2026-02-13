// backend/routes/posts.js
import express from 'express';
import { optionalAuthenticateToken } from '../middleware/optionalAuth.js';
import pool from '../../db.js';
import logger from '../../logger.js';

const router = express.Router();

// GET /api/posts - Получить все посты
router.get('/posts', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search, sort = 'created_at DESC' } = req.query;

    // Проверяем наличие колонок likes_count и comments_count
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name IN ('likes_count', 'comments_count')
    `);

    const hasLikesCount = checkColumns.rows.some(r => r.column_name === 'likes_count');
    const hasCommentsCount = checkColumns.rows.some(r => r.column_name === 'comments_count');

    // Формируем SELECT с учетом наличия колонок
    const likesCountExpr = hasLikesCount ? 'COALESCE(p.likes_count, 0)' : '0';
    const commentsCountExpr = hasCommentsCount ? 'COALESCE(p.comments_count, 0)' : '0';

    // Проверяем наличие колонки photo_urls
    const checkPhotoUrls = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'photo_urls'
    `);
    const hasPhotoUrls = checkPhotoUrls.rows.length > 0;
    const photoUrlsExpr = hasPhotoUrls ? 'p.photo_urls' : 'NULL as photo_urls';

    // Проверяем наличие колонки status
    const checkStatus = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'status'
    `);
    const hasStatus = checkStatus.rows.length > 0;

    // Проверяем наличие дополнительных колонок
    const checkAdditionalColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name IN ('content_type', 'constructor_data', 'payload', 'template')
    `);
    const hasContentType = checkAdditionalColumns.rows.some(r => r.column_name === 'content_type');
    const hasConstructorData = checkAdditionalColumns.rows.some(r => r.column_name === 'constructor_data');
    const hasPayload = checkAdditionalColumns.rows.some(r => r.column_name === 'payload');
    const hasTemplate = checkAdditionalColumns.rows.some(r => r.column_name === 'template');

    // ⚠️ КРИТИЧЕСКИ ВАЖНО: Фильтруем ТОЛЬКО активные посты для обычных пользователей!
    // Админы могут видеть все посты через специальный запрос
    const userId = req.user?.id;
    let userRole = 'guest';
    if (userId) {
      try {
        const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        userRole = userResult.rows[0]?.role || 'registered';
      } catch (err) {
        console.warn('Ошибка проверки роли в GET /posts:', err);
        // Явно обрабатываем ошибку и оставляем роль гостя
        userRole = 'guest';
      }
    }
    const isAdmin = userRole === 'admin';

    // Для обычных пользователей - ТОЛЬКО active посты
    // Для админов - все посты (если не указан параметр status)
    const requestedStatus = req.query.status;
    let statusFilter = '';
    if (hasStatus) {
      const allowedStatuses = ['active', 'pending', 'revision', 'rejected', 'archived'];
      if (isAdmin && requestedStatus) {
        // Валидируем статус перед использованием в SQL, чтобы предотвратить инъекции
        if (!allowedStatuses.includes(requestedStatus)) {
          return res.status(400).json({ message: 'Invalid status filter' });
        }
        // Админ может запросить конкретный статус - безопасная фильтрация после проверки
        statusFilter = `AND p.status = '${requestedStatus}'`;
        logger.info(`🔍 Фильтр статуса для админа: ${requestedStatus}`);
      } else if (!isAdmin) {
        // Обычные пользователи видят ТОЛЬКО active (без NULL!)
        statusFilter = "AND p.status = 'active'";
      }
      // Для админов без параметра - показываем все (нет фильтра)
    }
    const statusExpr = hasStatus ? ', p.status' : '';

    logger.info(`📊 GET /posts: роль=${userRole}, админ=${isAdmin}, фильтр=${statusFilter || 'нет'}`);

    // Формируем дополнительные поля
    const additionalFields = [];
    if (hasContentType) additionalFields.push('p.content_type');
    if (hasConstructorData) additionalFields.push('p.constructor_data');
    if (hasPayload) additionalFields.push('p.payload');
    if (hasTemplate) additionalFields.push('p.template');
    const additionalFieldsExpr = additionalFields.length > 0 ? ', ' + additionalFields.join(', ') : '';

    let query = `
      SELECT 
        p.id,
        p.title,
        p.body,
        p.author_id,
        u.username as author_name,
        p.created_at,
        p.updated_at,
        p.marker_id,
        p.route_id,
        p.event_id,
        ${photoUrlsExpr},
        ${likesCountExpr} as likes_count,
        ${commentsCountExpr} as comments_count,
        false as is_liked
        ${statusExpr}
        ${additionalFieldsExpr}
      FROM posts p
      LEFT JOIN users u ON u.id::text = p.author_id
      WHERE 1=1 ${statusFilter}
    `;

    const params = [];
    let paramIndex = 1;

    // Поиск по тексту
    if (search) {
      query += ` AND (p.title ILIKE $${paramIndex} OR p.body ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Сортировка
    const validSortFields = ['created_at', 'updated_at', 'title'];
    const sortField = sort.split(' ')[0];
    const sortDirection = sort.split(' ')[1] || 'DESC';

    // Для likes_count используем вычисляемое значение
    if (sortField === 'likes_count' && hasLikesCount) {
      query += ` ORDER BY ${likesCountExpr} ${sortDirection}`;
    } else if (validSortFields.includes(sortField)) {
      query += ` ORDER BY p.${sortField} ${sortDirection}`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }

    // Лимит и оффсет
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number.parseInt(limit), Number.parseInt(offset));

    const result = await pool.query(query, params);

    // Обрабатываем результаты - преобразуем массивы и JSON
    const processedRows = result.rows.map((row, index) => {
      // Преобразуем photo_urls из массива в строку, если нужно
      if (row.photo_urls) {
        if (Array.isArray(row.photo_urls)) {
          row.photo_urls = row.photo_urls.filter(url => url && url.trim()).join(',');
        } else if (typeof row.photo_urls === 'string') {
          // Убеждаемся, что строка не пустая
          row.photo_urls = row.photo_urls.trim() || null;
        }
      }

      // Логируем для отладки (только для первых нескольких постов)
      if (index < 3 && row.photo_urls) {
        logger.info(`📸 photo_urls из БД для поста ${row.id}:`, {
          type: typeof row.photo_urls,
          value: row.photo_urls.substring(0, 100),
          length: row.photo_urls.length
        });
      }
      // Парсим JSON поля, если они есть
      if (row.constructor_data && typeof row.constructor_data === 'string') {
        try {
          row.constructor_data = JSON.parse(row.constructor_data);
        } catch (e) {
          console.warn(`Не удалось распарсить constructor_data для поста ${row.id}:`, e);
          // Оставляем исходную строку
        }
      }
      if (row.payload && typeof row.payload === 'string') {
        try {
          row.payload = JSON.parse(row.payload);
        } catch (e) {
          console.warn(`Не удалось распарсить payload для поста ${row.id}:`, e);
          // Оставляем исходную строку
        }
      }
      return row;
    });

    // Получаем общее количество постов для пагинации
    let countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      WHERE 1=1 ${statusFilter}
    `;

    const countParams = [];
    let countParamIndex = 1;
    if (search) {
      countQuery += ` AND (p.title ILIKE $${countParamIndex} OR p.body ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = Number.parseInt(countResult.rows[0].total);

    logger.info(`📊 GET /posts: возвращено ${processedRows.length} постов из ${total} всего`);
    if (processedRows.length > 0) {
      logger.info('📝 Пример поста:', {
        id: processedRows[0].id,
        title: processedRows[0].title?.substring(0, 50),
        author_name: processedRows[0].author_name,
        status: processedRows[0].status,
        has_photo_urls: !!processedRows[0].photo_urls,
        has_content_type: !!processedRows[0].content_type,
        has_constructor_data: !!processedRows[0].constructor_data
      });
    }

    res.json({
      data: processedRows,
      total: total
    });
  } catch (err) {
    console.error('Ошибка при получении постов:', err);
    res.status(500).json({ message: 'Ошибка сервера при получении постов.' });
  }
});

// GET /api/posts/:id - Получить пост по ID
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем наличие колонок likes_count и comments_count
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name IN ('likes_count', 'comments_count')
    `);

    const hasLikesCount = checkColumns.rows.some(r => r.column_name === 'likes_count');
    const hasCommentsCount = checkColumns.rows.some(r => r.column_name === 'comments_count');

    const likesCountExpr = hasLikesCount ? 'COALESCE(p.likes_count, 0)' : '0';
    const commentsCountExpr = hasCommentsCount ? 'COALESCE(p.comments_count, 0)' : '0';

    // Проверяем наличие колонки photo_urls
    const checkPhotoUrls = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'photo_urls'
    `);
    const hasPhotoUrls = checkPhotoUrls.rows.length > 0;
    const photoUrlsExpr = hasPhotoUrls ? 'p.photo_urls' : 'NULL as photo_urls';

    const result = await pool.query(`
      SELECT 
        p.id,
        p.title,
        p.body,
        p.author_id,
        u.username as author_name,
        p.created_at,
        p.updated_at,
        p.marker_id,
        p.route_id,
        p.event_id,
        ${photoUrlsExpr},
        ${likesCountExpr} as likes_count,
        ${commentsCountExpr} as comments_count,
        false as is_liked
      FROM posts p
      LEFT JOIN users u ON u.id::text = p.author_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    // Обрабатываем photo_urls для единичного поста
    const post = result.rows[0];
    if (post.photo_urls) {
      if (Array.isArray(post.photo_urls)) {
        post.photo_urls = post.photo_urls.filter(url => url && url.trim()).join(',');
      } else if (typeof post.photo_urls === 'string') {
        post.photo_urls = post.photo_urls.trim() || null;
      }
    }

    logger.info(`📸 GET /posts/:id - photo_urls для поста ${post.id}:`, {
      type: typeof post.photo_urls,
      value: post.photo_urls ? post.photo_urls.substring(0, 100) : 'null',
      hasValue: !!post.photo_urls
    });

    res.json(post);
  } catch (err) {
    console.error('Ошибка при получении поста:', err);
    res.status(500).json({ message: 'Ошибка сервера при получении поста.' });
  }
});

// POST /api/posts - Создать новый пост
// ⚠️ ВАЖНО: optionalAuthenticateToken позволяет гостям создавать посты, но они идут на модерацию!
router.post('/posts', optionalAuthenticateToken, async (req, res) => {
  // Гости могут создавать посты, но они всегда идут на модерацию
  const author_id = req.user?.id || null;
  const isGuest = !author_id;

  logger.info('🔍 НАЧАЛО ПРОВЕРКИ РОЛИ И СТАТУСА');
  // SONAR-AUTO-FIX (javascript:S1854): original:   logger.info(`   Пользователь из токена: ${isGuest ? 'ГОСТЬ (нет токена или невалидный)' : author_id}`);
  logger.info(`   Токен в заголовке: ${req.headers['authorization'] ? 'есть' : 'нет'}`);

  let userRole = isGuest ? 'guest' : 'registered';
  let isAdmin = false;
  let finalStatus = 'pending';
  // SONAR-AUTO-FIX (javascript:S1854): original:   let finalStatus = 'pending';
  // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:   let finalStatus = 'pending'; // ПО УМОЛЧАНИЮ ВСЕГДА PENDING!

  if (!isGuest && author_id) {
    // Проверяем роль только для авторизованных пользователей
    // ВАЖНО: проверяем роль из БД, а не из токена (токен может быть подделан)
    try {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [author_id]);
      if (userResult.rows.length > 0) {
        userRole = userResult.rows[0]?.role || 'registered';
        isAdmin = userRole === 'admin';
        // ТОЛЬКО АДМИН может создавать сразу активные посты!
        finalStatus = isAdmin ? 'active' : 'pending';
        logger.info(`   ✅ Роль из БД: ${userRole}, АДМИН: ${isAdmin}`);
      } else {
        // Пользователь не найден в БД - обрабатываем как гостя
        console.warn(`   ⚠️ Пользователь ${author_id} не найден в БД, обрабатываем как гостя`);
        userRole = 'guest';
        isAdmin = false;
        finalStatus = 'pending';
      }
    } catch (roleError) {
      console.error('❌ ОШИБКА ПРОВЕРКИ РОЛИ:', roleError);
      // При ошибке - всегда pending (безопаснее)
      userRole = 'guest';
      isAdmin = false;
      finalStatus = 'pending';
    }
  } else {
    // Гости ВСЕГДА создают посты со статусом pending
    finalStatus = 'pending';
    logger.info('   Гость создаёт пост - статус: pending');
  }

  logger.info(`👤 ФИНАЛЬНАЯ РОЛЬ: ${userRole}, АДМИН: ${isAdmin}, СТАТУС: ${finalStatus}`);

  try {
    const { title, body, marker_id, route_id, event_id, photo_urls } = req.body;

    logger.info('📝 POST /api/posts - Входящие данные:', {
      title,
      body: body ? `${body.substring(0, 100)}...` : 'пусто',
      marker_id,
      route_id,
      event_id,
      photo_urls: photo_urls ? (typeof photo_urls === 'string' ? photo_urls.substring(0, 100) : 'массив') : 'нет',
      author_id,
      finalStatus // Добавляем статус в логи
    });

    // Проверяем наличие колонок одним запросом
    let hasPhotoUrls = false;
    let hasStatus = false;
    try {
      const checkColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'posts' 
          AND column_name IN ('photo_urls', 'status')
      `);
      hasPhotoUrls = checkColumns.rows.some(r => r.column_name === 'photo_urls');
      hasStatus = checkColumns.rows.some(r => r.column_name === 'status');
      logger.info(`📊 КОЛОНКИ: photo_urls = ${hasPhotoUrls}, status = ${hasStatus}`);
    } catch (colError) {
      console.error('❌ ОШИБКА ПРОВЕРКИ КОЛОНОК:', colError);
    }

    logger.info(`✅ ФИНАЛЬНОЕ РЕШЕНИЕ: статус = "${finalStatus}", роль = "${userRole}"`);

    // Преобразуем photo_urls в строку, если это массив
    let photoUrlsString = null;
    if (photo_urls) {
      if (Array.isArray(photo_urls)) {
        photoUrlsString = photo_urls.filter(url => url && url.trim()).join(',');
      } else if (typeof photo_urls === 'string') {
        photoUrlsString = photo_urls.trim();
      }
    }

    logger.info('📸 Обработка photo_urls:', {
      original: photo_urls ? (typeof photo_urls === 'string' ? photo_urls.substring(0, 100) : 'массив') : 'null',
      processed: photoUrlsString ? photoUrlsString.substring(0, 100) : 'null',
      type: typeof photo_urls
    });

    // Формируем запрос с учетом наличия колонок
    let query, values;
    if (hasPhotoUrls && hasStatus) {
      query = `
        INSERT INTO posts (
          title, body, author_id, marker_id, route_id, event_id, photo_urls, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title || null, body || null, author_id, marker_id || null, route_id || null, event_id || null, photoUrlsString, finalStatus];
    } else if (hasPhotoUrls) {
      query = `
        INSERT INTO posts (
          title, body, author_id, marker_id, route_id, event_id, photo_urls,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title || null, body || null, author_id, marker_id || null, route_id || null, event_id || null, photoUrlsString];
    } else if (hasStatus) {
      query = `
        INSERT INTO posts (
          title, body, author_id, marker_id, route_id, event_id, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title || null, body || null, author_id, marker_id || null, route_id || null, event_id || null, finalStatus];
    } else {
      query = `
        INSERT INTO posts (
          title, body, author_id, marker_id, route_id, event_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title || null, body || null, author_id, marker_id || null, route_id || null, event_id || null];
    }

    logger.info('📤 Выполняем запрос:', query.substring(0, 200) + '...');
    logger.info('📤 Параметры:', values.length, 'значений, статус:', finalStatus);

    const result = await pool.query(query, values);
    const createdPost = result.rows[0];

    logger.info('✅ Пост создан в БД:', {
      id: createdPost.id,
      title: createdPost.title,
      status: createdPost.status || 'нет статуса (колонка отсутствует)',
      marker_id: createdPost.marker_id,
      route_id: createdPost.route_id,
      event_id: createdPost.event_id,
      photo_urls: createdPost.photo_urls ? 'есть' : 'нет'
    });

    // ⚠️ ВАЖНО: ИИ-анализ запускается для ВСЕГО контента со статусом 'pending'
    // Это основной способ модерации - ИИ анализирует первым, админ проверяет его работу
    if (finalStatus === 'pending') {
      try {
        logger.info(`🤖 ИИ-помощник: запуск анализа для поста ${createdPost.id}...`);
        const { autoAnalyzeContent } = await import('../middleware/autoModeration.js');
        // Запускаем анализ асинхронно (не блокируем ответ пользователю)
        autoAnalyzeContent('posts', createdPost.id, createdPost)
          .then(() => {
            logger.info(`✅ ИИ-помощник: анализ поста ${createdPost.id} завершён, рекомендация сохранена`);
          })
          .catch(err => {
            console.error(`❌ ИИ-помощник: ошибка анализа поста ${createdPost.id}:`, err);
          });
      } catch (err) {
        console.error('❌ ИИ-помощник: не удалось запустить анализ поста:', err.message);
      }
    } else {
      logger.info('ℹ️ Пост создан админом со статусом active, ИИ-анализ не требуется');
    }

    // Добавляем photo_urls в ответ, если его нет в базе
    const responseData = { ...createdPost };
    if (!hasPhotoUrls && photo_urls) {
      responseData.photo_urls = photo_urls;
    }

    res.status(201).json(responseData);
  } catch (err) {
    console.error('❌ Ошибка при создании поста:', err);
    res.status(500).json({ message: 'Ошибка при создании поста', error: err.message });
  }
});

export default router;


