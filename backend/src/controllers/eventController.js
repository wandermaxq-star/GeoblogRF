import pool from '../../db.js';
import { isWithinRussiaBounds } from '../middleware/russiaValidation.js';
import fetch from 'node-fetch';
import logger from '../../logger.js';

// Функция геокодирования адреса через Yandex Geocoder
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    return null;
  }

  try {
    const yandexApiKey = process.env.VITE_YANDEX_MAPS_API_KEY || process.env.YANDEX_MAPS_API_KEY;
    if (!yandexApiKey) {
      console.warn('Yandex Maps API key not found, skipping geocoding');
      return null;
    }

    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${yandexApiKey}&format=json&geocode=${encodeURIComponent(address)}&lang=ru_RU&results=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Geoblog/1.0'
      },
      signal: AbortSignal.timeout(5000) // 5 секунд таймаут
    });

    if (!response.ok) {
      console.warn(`Yandex Geocoder error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data?.response?.GeoObjectCollection?.featureMember?.length > 0) {
      const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
      const pos = geoObject.Point.pos.split(' ').map(Number); // 'lon lat'
      const [longitude, latitude] = pos;

      // Проверяем, что координаты в пределах РФ
      if (isWithinRussiaBounds(latitude, longitude)) {
        return { latitude, longitude };
      }
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Создание события
export const createEvent = async (req, res) => {
  const {
    title,
    description,
    start_datetime,
    end_datetime,
    location,
    category,
    max_participants,
    is_public,
    photo_urls,
    hashtags,
    event_type = 'meetup',
    timezone = 'UTC',
    price = 0,
    is_recurring = false,
    recurrence_rule,
    cover_image_url,
    requires_approval = false,
    status = 'active',
    // Поля для внешних событий
    external_id,
    external_source,
    external_url,
    image_url,
    attendees_count,
    organizer,
    latitude,
    longitude
  } = req.body;

  // Поддерживаем создание событий для неавторизованных пользователей (отложенная модерация)
  const creator_id = req.user?.id || null;

  try {
    // Получаем имя создателя (если пользователь авторизован)
    let author_name = 'Гость';
    if (creator_id) {
      const userResult = await pool.query(
        'SELECT username FROM users WHERE id = $1',
        [creator_id]
      );
      author_name = userResult.rows[0]?.username || 'Неизвестный автор';
    }

    // Определяем финальный статус события.
    // Безопасность: админ может указывать статус, но только из allowlist.
    const allowedStatuses = ['active', 'pending', 'revision', 'rejected', 'archived'];
    let finalStatus;
    if (creator_id) {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [creator_id]);
      const userRole = userResult.rows[0]?.role || 'registered';
      if (userRole === 'admin') {
        // Если админ передал статус и он разрешён — применять, иначе по умолчанию 'active'
        finalStatus = (typeof status === 'string' && allowedStatuses.includes(status)) ? status : 'active';
      } else {
        finalStatus = 'pending';
      }
    } else {
      finalStatus = 'pending';
    }

    // Геокодирование: если координаты не указаны (null, undefined, 0, 0) или невалидны, но есть location, пытаемся геокодировать
    let finalLatitude = latitude;
    let finalLongitude = longitude;

    // Проверяем, что координаты валидны (не null, не undefined, не 0,0, и в пределах РФ)
    const hasValidCoordinates =
      finalLatitude != null &&
      finalLongitude != null &&
      !isNaN(finalLatitude) &&
      !isNaN(finalLongitude) &&
      finalLatitude !== 0 &&
      finalLongitude !== 0 &&
      isWithinRussiaBounds(finalLatitude, finalLongitude);

    // Если координаты невалидны, но есть location, пытаемся геокодировать
    if (!hasValidCoordinates && location) {
      const geocoded = await geocodeAddress(location);
      if (geocoded) {
        finalLatitude = geocoded.latitude;
        finalLongitude = geocoded.longitude;
        logger.info(`✅ Геокодирование успешно для "${location}": [${finalLatitude}, ${finalLongitude}]`);
      } else {
        console.warn(`⚠️ Не удалось геокодировать адрес "${location}"`);
        // Оставляем null - событие будет создано без координат
        finalLatitude = null;
        finalLongitude = null;
      }
    } else if (!hasValidCoordinates) {
      // Если координаты невалидны и нет location, оставляем null
      finalLatitude = null;
      finalLongitude = null;
    }

    const result = await pool.query(
      `INSERT INTO events (
        creator_id, title, description, event_type, start_datetime, end_datetime, 
        location, category, max_participants, is_public, photo_urls, hashtags, 
        author_name, created_at, updated_at, participants_count, likes_count, comments_count,
        timezone, price, is_recurring, recurrence_rule, cover_image_url, requires_approval, status,
        external_id, external_source, external_url, image_url, attendees_count, organizer, latitude, longitude
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), 0, 0, 0,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
      ) RETURNING *`,
      [
        creator_id, title, description, event_type, start_datetime, end_datetime,
        location, category, max_participants, is_public, photo_urls, hashtags, author_name,
        timezone, price, is_recurring, recurrence_rule, cover_image_url, requires_approval, finalStatus,
        external_id, external_source, external_url, image_url, attendees_count, organizer, finalLatitude, finalLongitude
      ]
    );

    const createdEvent = result.rows[0];

    // Автоматический анализ ИИ только для событий на модерации (pending)
    // Админские события (active) не требуют анализа
    if (finalStatus === 'pending') {
      try {
        const { autoAnalyzeContent } = await import('../middleware/autoModeration.js');
        autoAnalyzeContent('events', createdEvent.id, createdEvent).catch(err => {
          console.error('Ошибка автоматического анализа события:', err);
        });
      } catch (err) {
        // Игнорируем ошибки импорта/анализа
        console.warn('Не удалось запустить автоматический анализ события:', err.message);
      }
    } else {
      logger.info('✅ Событие создано админом, модерация не требуется');
    }

    res.status(201).json(createdEvent);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при создании события.' });
  }
};

// Получение всех событий
export const getEvents = async (req, res) => {
  try {
    const { status, pending } = req.query;
    const userId = req.user?.id || req.user?.userId || null;

    let query;
    let params;

    // Если запрашиваются события на модерации
    if (pending === 'true' || status === 'pending') {
      query = `
        SELECT e.*, e.is_user_modified, e.used_in_blogs, u.username as creator_name 
        FROM events e 
        LEFT JOIN users u ON e.creator_id = u.id 
        WHERE e.status = 'pending'
        ORDER BY e.created_at DESC
      `;
      params = [];
    } else {
      // Обычные события (только активные и публичные)
      query = `
        SELECT e.*, e.is_user_modified, e.used_in_blogs, u.username as creator_name 
        FROM events e 
        LEFT JOIN users u ON e.creator_id = u.id 
        WHERE (e.is_public = true AND (e.status = 'active' OR e.status IS NULL)) 
           OR e.creator_id = $1
        ORDER BY e.start_datetime ASC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    // Фильтруем события только в пределах РФ (кроме событий на модерации)
    const russiaEvents = result.rows.filter(event => {
      if (event.status === 'pending') {
        return true; // События на модерации показываем все
      }
      if (event.latitude && event.longitude) {
        return isWithinRussiaBounds(event.latitude, event.longitude);
      }
      return true; // Если нет координат, оставляем событие
    });

    res.json(russiaEvents);
  } catch (error) {
    console.error('Ошибка получения событий:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении событий.' });
  }
};

// Получение события по ID
export const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    // Проверяем, является ли ID числом (старый формат) или UUID
    const isNumeric = /^\d+$/.test(id);

    let result;
    if (isNumeric) {
      // Если ID числовой, ищем по старому формату (может быть external_id или другой числовой идентификатор)
      // Сначала пробуем найти по id как числу
      result = await pool.query(`
        SELECT e.*, e.is_user_modified, e.used_in_blogs, u.username as creator_name 
        FROM events e 
        LEFT JOIN users u ON e.creator_id = u.id 
        WHERE e.id::text = $1 OR e.external_id::text = $1
      `, [id]);
    } else {
      // Если ID не числовой, ищем как UUID
      result = await pool.query(`
        SELECT e.*, e.is_user_modified, e.used_in_blogs, u.username as creator_name 
        FROM events e 
        LEFT JOIN users u ON e.creator_id = u.id 
        WHERE e.id = $1
      `, [id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения события:', error);
    // Если ошибка связана с форматом UUID, возвращаем 400
    if (error.message && error.message.includes('invalid input syntax for type uuid')) {
      return res.status(400).json({
        message: 'Неверный формат ID события.',
        error: 'Invalid event ID format'
      });
    }
    res.status(500).json({ message: 'Ошибка сервера при получении события.' });
  }
};

// Поиск внешних событий
export const searchExternalEvents = async (req, res) => {
  const {
    location,
    latitude,
    longitude,
    radius = 25,
    start_date,
    end_date,
    category,
    query,
    limit = 20
  } = req.query;

  try {
    // Здесь будет интеграция с внешними API
    // Пока возвращаем заглушку
    const mockEvents = [
      {
        id: 'external_1',
        title: 'Конференция по технологиям',
        description: 'Ежегодная конференция разработчиков',
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: { address: 'Москва, ул. Тверская, 1' },
        category: 'technology',
        source: 'eventbrite',
        attendees_count: 150,
        price: 'Бесплатно',
        organizer: 'Tech Community'
      }
    ];

    res.json(mockEvents);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при поиске событий.' });
  }
};

// Обновление события
// Одобрение события (модерация)
export const approveEvent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || req.user?.userId;

  try {
    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    const result = await pool.query(
      `UPDATE events 
       SET status = 'active', 
           is_public = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    res.json({
      message: 'Событие одобрено и опубликовано.',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка одобрения события:', error);
    res.status(500).json({ message: 'Ошибка сервера при одобрении события.' });
  }
};

// Отклонение события (модерация)
export const rejectEvent = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const userId = req.user?.id || req.user?.userId;

  try {
    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    const result = await pool.query(
      `UPDATE events 
       SET status = 'rejected', 
           is_public = false,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    // TODO: Сохранить причину отклонения в отдельной таблице или поле

    res.json({
      message: 'Событие отклонено.',
      event: result.rows[0],
      reason: reason || 'Не указана'
    });
  } catch (error) {
    console.error('Ошибка отклонения события:', error);
    res.status(500).json({ message: 'Ошибка сервера при отклонении события.' });
  }
};

export const updateEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    start_datetime,
    end_datetime,
    location,
    category,
    max_participants,
    is_public,
    photo_urls,
    hashtags,
    event_type,
    cover_image_url,
    image_url,
    status
  } = req.body;

  try {
    // Проверяем, что пользователь является создателем события
    const eventResult = await pool.query(
      'SELECT creator_id FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    // Разрешаем редактирование всем авторизованным пользователям (можно изменить на проверку creator_id)
    // if (eventResult.rows[0].creator_id !== req.user.id) {
    //   return res.status(403).json({ message: 'Нет прав для редактирования этого события.' });
    // }

    // Обрабатываем photo_urls: если это массив, преобразуем в строку или массив PostgreSQL
    let finalPhotoUrls = photo_urls;
    if (Array.isArray(photo_urls)) {
      // Если массив, сохраняем как массив PostgreSQL
      finalPhotoUrls = photo_urls;
    } else if (typeof photo_urls === 'string') {
      // Если строка, оставляем как есть
      finalPhotoUrls = photo_urls;
    }

    // Определяем главное фото: cover_image_url имеет приоритет над image_url
    const finalCoverImageUrl = cover_image_url || image_url || null;

    const result = await pool.query(
      `UPDATE events SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_datetime = COALESCE($3, start_datetime),
        end_datetime = COALESCE($4, end_datetime),
        location = COALESCE($5, location),
        category = COALESCE($6, category),
        max_participants = COALESCE($7, max_participants),
        is_public = COALESCE($8, is_public),
        photo_urls = COALESCE($9, photo_urls),
        hashtags = COALESCE($10, hashtags),
        event_type = COALESCE($11, event_type),
        cover_image_url = COALESCE($12, cover_image_url),
        image_url = COALESCE($13, image_url),
        status = COALESCE($14, status),
        updated_at = NOW()
      WHERE id = $15 RETURNING *`,
      [title, description, start_datetime, end_datetime, location, category,
        max_participants, is_public, finalPhotoUrls, hashtags, event_type,
        finalCoverImageUrl, finalCoverImageUrl, status, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления события:', error);
    res.status(500).json({ message: 'Ошибка сервера при обновлении события.' });
  }
};

// Удаление события
export const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    // Проверяем, что пользователь является создателем события
    const eventResult = await pool.query(
      'SELECT creator_id FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    if (eventResult.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ message: 'Нет прав для удаления этого события.' });
    }

    await pool.query('DELETE FROM events WHERE id = $1', [id]);

    res.json({ message: 'Событие успешно удалено.' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при удалении события.' });
  }
};

// Присоединение к событию
export const joinEvent = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    // Проверяем, что событие существует и публичное
    const eventResult = await pool.query(
      'SELECT id, is_public, max_participants, participants_count FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Событие не найдено.' });
    }

    const event = eventResult.rows[0];

    if (!event.is_public) {
      return res.status(403).json({ message: 'Это событие не является публичным.' });
    }

    if (event.max_participants && event.participants_count >= event.max_participants) {
      return res.status(400).json({ message: 'Достигнуто максимальное количество участников.' });
    }

    // Проверяем, не присоединился ли уже пользователь
    const existingParticipant = await pool.query(
      'SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (existingParticipant.rows.length > 0) {
      return res.status(400).json({ message: 'Вы уже присоединились к этому событию.' });
    }

    // Добавляем участника
    await pool.query(
      'INSERT INTO event_participants (event_id, user_id, joined_at) VALUES ($1, $2, NOW())',
      [id, user_id]
    );

    // Увеличиваем счетчик участников
    await pool.query(
      'UPDATE events SET participants_count = participants_count + 1 WHERE id = $1',
      [id]
    );

    res.json({ message: 'Вы успешно присоединились к событию.' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при присоединении к событию.' });
  }
};


