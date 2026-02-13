import pool from '../../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке для офлайн постов
const OFFLINE_POSTS_DIR = path.join(__dirname, '../../../uploads/offline-posts');

// Создаём папку если её нет
if (!fs.existsSync(OFFLINE_POSTS_DIR)) {
  fs.mkdirSync(OFFLINE_POSTS_DIR, { recursive: true });
}

/**
 * Создаёт заглушку поста в БД (без изображений и трека)
 * POST /api/offline-posts
 * Body: { text: string, regionId: string, hasImages: boolean, hasTrack: boolean }
 */
export const createOfflinePost = async (req, res) => {
  // Логируем в самом начале, даже до try-catch
  logger.info('🚀 ===== НАЧАЛО createOfflinePost =====');
  logger.info('📥 Метод:', req.method);
  logger.info('📥 URL:', req.url);
  logger.info('📥 Path:', req.path);
  logger.info('📥 User:', req.user ? { id: req.user.id, role: req.user.role } : 'null');
  logger.info('📥 Body keys:', Object.keys(req.body || {}));
  logger.info('📥 Body:', req.body);
  
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      console.error('❌ Нет userId в req.user');
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const { text, title, regionId, hasImages = false, hasTrack = false } = req.body;
    logger.info('📥 Параметры запроса:', { 
      text: text?.substring(0, 50), 
      title: title || '(не указан)', 
      regionId, 
      hasImages, 
      hasTrack 
    });

    // Валидация
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Текст поста обязателен' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ message: 'Текст поста не должен превышать 5000 символов' });
    }

    if (!regionId || typeof regionId !== 'string') {
      return res.status(400).json({ message: 'regionId обязателен' });
    }

    // Проверяем наличие колонки status в таблице posts
    const checkStatus = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'status'
    `);
    const hasStatus = checkStatus.rows.length > 0;

    // Проверяем тип колонки id (может быть bigint/SERIAL или UUID)
    const checkIdType = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'id'
    `);
    const idType = checkIdType.rows[0]?.data_type || 'bigint';
    const isUuidId = idType === 'uuid';
    
    logger.info('📝 Тип колонки id:', idType, 'isUuid:', isUuidId);

    // Создаём запись в БД со статусом pending_images
    // НЕ указываем id - БД сама сгенерирует его (SERIAL/BIGSERIAL или UUID)
    let insertQuery;
    let queryParams;
    
    // Проверяем наличие колонки title
    const checkTitle = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'title'
    `);
    const hasTitle = checkTitle.rows.length > 0;
    logger.info(`📊 Проверка колонки 'title' в 'posts': ${hasTitle ? 'ЕСТЬ' : 'НЕТ'}`);

    if (hasStatus) {
      // Если есть колонка status, добавляем её
      // Используем 'pending' вместо 'pending_images' - это стандартный статус для постов на модерации
      if (hasTitle) {
        insertQuery = `
          INSERT INTO posts (
            title,
            body, 
            author_id, 
            created_at, 
            updated_at,
            status
          ) VALUES (
            $1, $2, $3, NOW(), NOW(), $4
          ) RETURNING id
        `;
        queryParams = [title || null, text, userId, 'pending'];
      } else {
        insertQuery = `
          INSERT INTO posts (
            body, 
            author_id, 
            created_at, 
            updated_at,
            status
          ) VALUES (
            $1, $2, NOW(), NOW(), $3
          ) RETURNING id
        `;
        queryParams = [text, userId, 'pending'];
      }
    } else {
      // Если колонки status нет, не добавляем её
      if (hasTitle) {
        insertQuery = `
          INSERT INTO posts (
            title,
            body, 
            author_id, 
            created_at, 
            updated_at
          ) VALUES (
            $1, $2, $3, NOW(), NOW()
          ) RETURNING id
        `;
        queryParams = [title || null, text, userId];
      } else {
        insertQuery = `
          INSERT INTO posts (
            body, 
            author_id, 
            created_at, 
            updated_at
          ) VALUES (
            $1, $2, NOW(), NOW()
          ) RETURNING id
        `;
        queryParams = [text, userId];
      }
    }

    logger.info('📝 SQL запрос:', insertQuery);
    logger.info('📝 Параметры:', queryParams);
    logger.info('📝 Статус, который будет установлен:', queryParams[queryParams.length - 1] || 'не указан');

    let result;
    try {
      result = await pool.query(insertQuery, queryParams);
      logger.info('✅ SQL запрос выполнен успешно');
      
      // Сразу проверяем, какой статус был установлен в БД
      if (result.rows && result.rows.length > 0 && hasStatus) {
        const createdId = result.rows[0].id;
        const statusCheck = await pool.query(
          'SELECT status FROM posts WHERE id = $1',
          [createdId]
        );
        if (statusCheck.rows.length > 0) {
          const actualStatus = statusCheck.rows[0].status;
          logger.info(`🔍 Проверка статуса сразу после INSERT: ${actualStatus || 'NULL'}`);
          if (actualStatus !== 'pending') {
            console.error(`❌ КРИТИЧНО: Статус поста ${createdId} = '${actualStatus}', а должен быть 'pending'!`);
            console.error(`❌ Возможно, в БД установлено значение по умолчанию 'active' для колонки status`);
            console.error(`❌ Или есть триггер, который меняет статус автоматически`);
            // Пытаемся исправить статус вручную
            try {
              await pool.query(
                'UPDATE posts SET status = $1 WHERE id = $2',
                ['pending', createdId]
              );
              logger.info(`✅ Статус поста ${createdId} исправлен на 'pending' вручную`);
            } catch (fixError) {
              console.error(`❌ Не удалось исправить статус:`, fixError);
            }
          } else {
            logger.info(`✅ Статус поста ${createdId} корректно установлен как 'pending'`);
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Ошибка выполнения SQL запроса:', dbError);
      console.error('❌ Детали ошибки:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint
      });
      return res.status(500).json({ 
        message: 'Ошибка создания поста в базе данных',
        error: dbError.message 
      });
    }
    
    // Проверяем, что пост был создан
    if (!result.rows || result.rows.length === 0) {
      console.error('❌ Пост не был создан в БД. Результат запроса:', result);
      return res.status(500).json({ message: 'Ошибка создания поста в базе данных' });
    }
    
    const createdPostId = result.rows[0].id;
    logger.info(`✅ Пост создан в БД с ID: ${createdPostId}`);
    
    // ВАЖНО: Если колонки status нет, но мы создали пост без статуса,
    // нужно убедиться, что пост будет виден в модерации
    // Для этого проверяем статус созданного поста
    if (!hasStatus) {
      console.warn(`⚠️ ВНИМАНИЕ: Колонка 'status' отсутствует в таблице 'posts'!`);
      console.warn(`⚠️ Пост ${createdPostId} создан БЕЗ статуса и НЕ будет виден в модерации!`);
      console.warn(`⚠️ Необходимо выполнить миграцию: backend/src/migrations/add-status-to-posts.sql`);
    } else {
      // Проверяем, что статус установлен правильно
      const statusCheck = await pool.query(
        'SELECT status FROM posts WHERE id = $1',
        [createdPostId]
      );
      if (statusCheck.rows.length > 0) {
        const actualStatus = statusCheck.rows[0].status;
        logger.info(`✅ Статус поста ${createdPostId}: ${actualStatus || 'NULL'}`);
        if (actualStatus !== 'pending') {
          console.warn(`⚠️ ВНИМАНИЕ: Статус поста не 'pending'! Пост может не попасть в модерацию!`);
        }
      }
    }
    
    // Используем созданный ID для всех дальнейших операций
    // Преобразуем в строку для использования в путях (может быть bigint или UUID)
    const postId = createdPostId.toString();
    
    // Создаём папку для этого поста
    try {
      const postDir = path.join(OFFLINE_POSTS_DIR, postId);
      if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
        logger.info(`✅ Создана папка для поста: ${postDir}`);
      }
    } catch (dirError) {
      console.error('⚠️ Ошибка создания папки (не критично):', dirError);
      // Не критично, продолжаем
    }

    // Сохраняем метаданные о том, что ожидается загрузка
    // Можно использовать отдельную таблицу или расширить posts
    // Пока сохраняем в отдельную таблицу offline_post_metadata
    try {
      logger.info('📝 Создание таблицы offline_post_metadata (если не существует)...');
      
      // Проверяем тип id в таблице posts, чтобы использовать правильный тип для post_id
      const idTypeCheck = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'posts' 
          AND column_name = 'id'
      `);
      const postsIdType = idTypeCheck.rows[0]?.data_type || 'bigint';
      const postIdColumnType = postsIdType === 'uuid' ? 'UUID' : 'BIGINT';
      
      logger.info(`📝 Тип post_id в метаданных: ${postIdColumnType} (соответствует типу posts.id: ${postsIdType})`);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS offline_post_metadata (
          post_id ${postIdColumnType} PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
          region_id VARCHAR(255),
          has_images BOOLEAN DEFAULT false,
          has_track BOOLEAN DEFAULT false,
          images_uploaded INTEGER DEFAULT 0,
          images_expected INTEGER DEFAULT 0,
          track_uploaded BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      logger.info('✅ Таблица offline_post_metadata проверена/создана');

      logger.info('📝 Вставка метаданных...');
      await pool.query(`
        INSERT INTO offline_post_metadata (
          post_id, region_id, has_images, has_track, images_expected
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (post_id) DO UPDATE SET
          region_id = EXCLUDED.region_id,
          has_images = EXCLUDED.has_images,
          has_track = EXCLUDED.has_track,
          images_expected = EXCLUDED.images_expected
      `, [postId, regionId, hasImages, hasTrack, hasImages ? 0 : 0]);
      logger.info('✅ Метаданные сохранены');
    } catch (metaError) {
      console.error('⚠️ Ошибка создания метаданных (не критично):', metaError);
      console.error('⚠️ Детали:', {
        message: metaError.message,
        code: metaError.code,
        detail: metaError.detail
      });
      // Не критично, продолжаем
    }

    logger.info(`✅ Создан офлайн пост: ${postId}, ожидается: images=${hasImages}, track=${hasTrack}`);
    
    // ВАЖНО: НЕ вызываем checkAndUpdatePostStatus здесь!
    // Пост должен остаться со статусом 'pending' до загрузки всех частей
    // checkAndUpdatePostStatus вызывается только после загрузки изображений или трека
    
    // НЕ запускаем автоматический ИИ-анализ для офлайн постов при создании
    // ИИ-анализ будет запущен только после полной загрузки всех частей поста
    // Это предотвращает автоматическое одобрение неполных постов
    
    // Возвращаем ответ с ID поста
    const responseData = {
      id: postId,
      uploadUrl: `/api/posts/${postId}/images`
    };
    
    logger.info('📤 Отправляем ответ клиенту:', responseData);
    logger.info(`⚠️ Пост ${postId} создан со статусом 'pending' и НЕ будет автоматически одобрен`);
    
    res.status(201).json(responseData);
  } catch (error) {
    console.error('❌ ===== КРИТИЧЕСКАЯ ОШИБКА создания офлайн поста =====');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error hint:', error.hint);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('❌ ===== КОНЕЦ ОШИБКИ =====');
    
    // Отправляем ответ с деталями ошибки
    const errorResponse = {
      message: 'Ошибка создания поста',
      error: error.message
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.details = {
        name: error.name,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      };
    }
    
    res.status(500).json(errorResponse);
  }
};

/**
 * Загружает изображения для поста
 * POST /api/posts/:id/images
 * Multipart form-data: images[] (массив файлов)
 */
export const uploadPostImages = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const { id: postId } = req.params;
    // Multer с upload.array() всегда возвращает req.files как массив
    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Необходимо загрузить хотя бы одно изображение' });
    }

    // Проверяем, что пост существует и принадлежит пользователю
    const postCheck = await pool.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    if (postCheck.rows[0].author_id !== userId) {
      return res.status(403).json({ message: 'Нет доступа к этому посту' });
    }

    // Проверяем метаданные
    let metadata;
    try {
      const metaResult = await pool.query(
        'SELECT * FROM offline_post_metadata WHERE post_id = $1',
        [postId]
      );
      metadata = metaResult.rows[0];
    } catch (metaError) {
      console.warn('Метаданные не найдены, создаём:', metaError);
      metadata = null;
    }

    // Проверяем лимиты
    if (files.length > 10) {
      return res.status(400).json({ message: 'Максимум 10 изображений на пост' });
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      return res.status(413).json({ message: 'Суммарный размер файлов превышает 50 МБ' });
    }

    // Сохраняем файлы
    const postDir = path.join(OFFLINE_POSTS_DIR, postId);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    const savedPaths = [];
    for (const file of files) {
      // Проверяем MIME-тип
      if (!file.mimetype.match(/^image\/(jpeg|png)$/)) {
        return res.status(400).json({ 
          message: `Неподдерживаемый формат: ${file.mimetype}. Разрешены только JPEG и PNG` 
        });
      }

      // Генерируем безопасное имя файла
      const fileExt = path.extname(file.originalname) || (file.mimetype === 'image/jpeg' ? '.jpg' : '.png');
      const fileName = `${randomUUID()}${fileExt}`;
      const filePath = path.join(postDir, fileName);

      // Перемещаем файл
      fs.renameSync(file.path, filePath);

      // Сохраняем полный URL для доступа к изображению
      // Используем базовый URL из переменных окружения или формируем из запроса
      const baseUrl = process.env.API_URL || process.env.BASE_URL || 
                     (req.protocol + '://' + req.get('host'));
      const relativePath = `/uploads/offline-posts/${postId}/${fileName}`;
      const fullUrl = `${baseUrl}${relativePath}`;
      savedPaths.push(fullUrl);
    }

    // Обновляем photo_urls в таблице posts
    const checkPhotoUrls = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'photo_urls'
    `);
    const hasPhotoUrls = checkPhotoUrls.rows.length > 0;

    if (hasPhotoUrls) {
      // Получаем текущие пути или создаём новый массив
      const currentPost = await pool.query('SELECT photo_urls FROM posts WHERE id = $1', [postId]);
      const currentUrls = currentPost.rows[0]?.photo_urls || '';
      const existingUrls = currentUrls ? (typeof currentUrls === 'string' ? currentUrls.split(',') : currentUrls) : [];
      const allUrls = [...existingUrls, ...savedPaths].filter(Boolean);
      const urlsString = allUrls.join(',');

      await pool.query(
        'UPDATE posts SET photo_urls = $1, updated_at = NOW() WHERE id = $2',
        [urlsString, postId]
      );
    }

    // Обновляем метаданные
    if (metadata) {
      const newImagesUploaded = (metadata.images_uploaded || 0) + files.length;
      await pool.query(`
        UPDATE offline_post_metadata 
        SET images_uploaded = $1, updated_at = NOW()
        WHERE post_id = $2
      `, [newImagesUploaded, postId]);
    }

    // Проверяем, все ли части загружены, чтобы перевести в awaiting_moderation
    await checkAndUpdatePostStatus(postId);

    logger.info(`✅ Загружено ${files.length} изображений для поста ${postId}`);

    res.status(200).json({
      message: 'Изображения успешно загружены',
      uploaded: files.length,
      paths: savedPaths
    });
  } catch (error) {
    console.error('Ошибка загрузки изображений:', error);
    res.status(500).json({ message: 'Ошибка загрузки изображений', error: error.message });
  }
};

/**
 * Загружает трек (GeoJSON) для поста
 * PUT /api/posts/:id/track
 * Body: { track: GeoJSON object }
 */
export const uploadPostTrack = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const { id: postId } = req.params;
    const { track } = req.body;

    if (!track || typeof track !== 'object') {
      return res.status(400).json({ message: 'Трек должен быть валидным GeoJSON объектом' });
    }

    // Проверяем, что пост существует и принадлежит пользователю
    const postCheck = await pool.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    if (postCheck.rows[0].author_id !== userId) {
      return res.status(403).json({ message: 'Нет доступа к этому посту' });
    }

    // Проверяем наличие колонки для трека (можно использовать payload или создать отдельную колонку)
    // Пока сохраняем в payload как JSON
    const checkPayload = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'payload'
    `);
    const hasPayload = checkPayload.rows.length > 0;

    if (hasPayload) {
      await pool.query(
        'UPDATE posts SET payload = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(track), postId]
      );
    } else {
      // Если нет payload, создаём отдельную таблицу для треков
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS post_tracks (
            post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
            track_data JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);

        await pool.query(`
          INSERT INTO post_tracks (post_id, track_data)
          VALUES ($1, $2)
          ON CONFLICT (post_id) DO UPDATE SET
            track_data = EXCLUDED.track_data,
            updated_at = NOW()
        `, [postId, JSON.stringify(track)]);
      } catch (trackError) {
        console.error('Ошибка сохранения трека:', trackError);
        return res.status(500).json({ message: 'Ошибка сохранения трека' });
      }
    }

    // Обновляем метаданные
    try {
      await pool.query(`
        UPDATE offline_post_metadata 
        SET track_uploaded = true, updated_at = NOW()
        WHERE post_id = $1
      `, [postId]);
    } catch (metaError) {
      console.warn('Ошибка обновления метаданных трека:', metaError);
    }

    // Проверяем, все ли части загружены
    await checkAndUpdatePostStatus(postId);

    logger.info(`✅ Трек загружен для поста ${postId}`);

    res.status(200).json({
      message: 'Трек успешно загружен',
      postId
    });
  } catch (error) {
    console.error('Ошибка загрузки трека:', error);
    res.status(500).json({ message: 'Ошибка загрузки трека', error: error.message });
  }
};

/**
 * Проверяет, все ли части поста загружены, и переводит в awaiting_moderation
 */
async function checkAndUpdatePostStatus(postId) {
  try {
    const metadata = await pool.query(
      'SELECT * FROM offline_post_metadata WHERE post_id = $1',
      [postId]
    );

    if (metadata.rows.length === 0) {
      return; // Нет метаданных, пропускаем
    }

    const meta = metadata.rows[0];
    const checkStatus = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name = 'status'
    `);
    const hasStatus = checkStatus.rows.length > 0;

    if (!hasStatus) {
      return; // Нет колонки status
    }

    // Проверяем условия:
    // 1. Если has_images = true, то images_uploaded должен быть > 0
    // 2. Если has_track = true, то track_uploaded должен быть true
    const imagesReady = !meta.has_images || (meta.images_uploaded > 0);
    const trackReady = !meta.has_track || meta.track_uploaded;

    if (imagesReady && trackReady) {
      // Все части загружены
      // ВАЖНО: НЕ меняем статус автоматически!
      // Пост должен остаться со статусом 'pending' до ручного одобрения админом
      // Это предотвращает автоматическую публикацию постов
      
      const currentStatus = await pool.query(
        'SELECT status FROM posts WHERE id = $1',
        [postId]
      );
      
      if (currentStatus.rows.length > 0) {
        const existingStatus = currentStatus.rows[0].status;
        logger.info(`✅ Пост ${postId} готов к модерации. Текущий статус: ${existingStatus || 'pending'}`);
        logger.info(`⚠️ Пост НЕ будет автоматически одобрен - требуется ручная модерация админом`);
        
        // НЕ меняем статус - оставляем как есть ('pending')
        // Пост должен пройти модерацию через админ-панель
      }
    } else {
      logger.info(`⏳ Пост ${postId} еще не готов: imagesReady=${imagesReady}, trackReady=${trackReady}`);
    }
  } catch (error) {
    console.error('Ошибка проверки статуса поста:', error);
  }
}

/**
 * Получает статус поста (для проверки модерации)
 * GET /api/posts/:id/status
 */
export const getPostStatus = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user?.id;

    const post = await pool.query(
      'SELECT id, author_id, status FROM posts WHERE id = $1',
      [postId]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    const postData = post.rows[0];

    // Только автор или админ могут видеть статус
    if (userId && (postData.author_id === userId || req.user?.role === 'admin')) {
      res.json({
        status: postData.status || 'active',
        postId
      });
    } else {
      res.status(403).json({ message: 'Нет доступа к статусу поста' });
    }
  } catch (error) {
    console.error('Ошибка получения статуса поста:', error);
    res.status(500).json({ message: 'Ошибка получения статуса', error: error.message });
  }
};

