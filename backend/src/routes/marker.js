// backend/routes/marker.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateMarker } from '../middleware/validation.js';
import pool from '../../db.js';
import { checkPointAgainstZones } from '../utils/zoneGuard.js';
import { isWithinRussiaBounds } from '../middleware/russiaValidation.js';
import logger from '../../logger.js';

const router = express.Router();

// GET /api/markers - Получить все маркеры
router.get('/markers', async (req, res) => {
  try {
    // Получаем только активные и публичные маркеры
    const result = await pool.query(`
      SELECT *, used_in_blogs FROM map_markers 
      WHERE is_active = true AND visibility = 'public'
      ORDER BY created_at DESC
    `);
    // Логируем creator_id, is_active и visibility для каждого маркера
    result.rows.forEach((marker, index) => {
      logger.info(`Marker ${index}: creator_id: ${marker.creator_id}, is_active: ${marker.is_active}, visibility: ${marker.visibility}`);
    });
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера при получении маркеров.' });
  }
});

// GET /api/markers/nearby - получить маркеры в радиусе (анти-дубликаты)
router.get('/markers/nearby', async (req, res) => {
  const { lat, lng, radius = 50 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ message: 'lat и lng обязательны' });
  }
  try {
    const rMeters = Math.min(Math.max(parseInt(radius, 10) || 50, 10), 1000);
    const query = `
      SELECT *, distance
      FROM (
        SELECT *,
          (6371000 * 2 * ASIN(
            SQRT(
              POWER(SIN((radians($1) - radians(latitude)) / 2), 2) +
              COS(radians(latitude)) * COS(radians($1)) *
              POWER(SIN((radians($2) - radians(longitude)) / 2), 2)
            )
          )) AS distance
        FROM map_markers
        WHERE is_active = true AND visibility = 'public'
      ) AS markers_with_distance
      WHERE distance <= $3
      ORDER BY distance ASC
      LIMIT 50;
    `;
    const result = await pool.query(query, [Number(lat), Number(lng), rMeters]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера при поиске ближайших маркеров.' });
  }
});

// GET /api/markers/bounds - получить маркеры в области (для ленивой загрузки)
router.get('/markers/bounds', async (req, res) => {
  const { north, south, east, west, categories, limit = 100 } = req.query;
  
  if (!north || !south || !east || !west) {
    return res.status(400).json({ message: 'north, south, east, west обязательны' });
  }
  
  try {
    let query = `
      SELECT * FROM map_markers 
      WHERE is_active = true AND visibility = 'public'
      AND latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
    `;
    
    const params = [Number(south), Number(north), Number(west), Number(east)];
    let paramIndex = 5;
    
    // Фильтр по категориям
    if (categories) {
      const categoryList = categories.split(',').map(cat => cat.trim());
      query += ` AND category = ANY($${paramIndex})`;
      params.push(categoryList);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера при получении маркеров по области.' });
  }
});

// GET /api/markers/user/photos - Получить все фото пользователя из его маркеров
// ВАЖНО: Этот маршрут должен быть ПЕРЕД /markers/:id, иначе Express перехватит его как /markers/:id с id='user'
router.get('/markers/user/photos', authenticateToken, async (req, res) => {
  try {
    const creator_id = req.user.id;
    
    const result = await pool.query(`
      SELECT DISTINCT unnest(photo_urls) as photo_url
      FROM map_markers 
      WHERE creator_id = $1 
        AND photo_urls IS NOT NULL 
        AND array_length(photo_urls, 1) > 0
      ORDER BY photo_url
    `, [creator_id]);
    
    const photos = result.rows.map(row => row.photo_url).filter(url => url);
    
    res.json({ photos });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера при получении фото пользователя.', error: err.message });
  }
});

// GET /api/markers/:id - Получить маркер по ID
// ВАЖНО: Этот маршрут должен быть ПОСЛЕ всех специфичных маршрутов (user/photos, bounds, nearby)
router.get('/markers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM map_markers 
      WHERE id = $1 AND is_active = true AND visibility = 'public'
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Маркер не найден' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера при получении маркера.' });
  }
});

// POST /api/markers - Создать новый маркер
router.post('/markers', authenticateToken, validateMarker, async (req, res) => {
  const { 
    title, category, description, address, hashtags, photoUrls, 
    latitude, longitude, metadata, marker_type = 'standard', visibility = 'public'
  } = req.body;
  const creator_id = req.user.id;
  
  // Проверяем роль пользователя - только админ может создавать сразу активные метки
  let userRole = 'registered';
  let isAdmin = false;
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [creator_id]);
    userRole = userResult.rows[0]?.role || 'registered';
    isAdmin = userRole === 'admin';
  } catch (err) {
    console.warn('Ошибка проверки роли пользователя:', err);
  }
  
  // Устанавливаем статус: админ может сразу 'active', остальные - 'pending' (требуют модерации)
  const finalStatus = isAdmin ? 'active' : 'pending';
  logger.info(`📊 Статус метки: ${finalStatus} (пользователь: ${userRole}, админ: ${isAdmin})`);
  
  // Логируем входящие данные для диагностики
  logger.info('📝 POST /api/markers - Входящие данные:', {
    title,
    category,
    latitude: typeof latitude === 'number' ? latitude : `(${typeof latitude}) ${latitude}`,
    longitude: typeof longitude === 'number' ? longitude : `(${typeof longitude}) ${longitude}`,
    photoUrls: typeof photoUrls === 'string' ? `строка: "${photoUrls}"` : `массив: [${Array.isArray(photoUrls) ? photoUrls.join(', ') : 'не массив'}]`,
    hasPhotoUrls: !!photoUrls,
    status: finalStatus
  });
  
  try {
    // Проверка российских границ
    if (typeof longitude === 'number' && typeof latitude === 'number') {
      const isWithinBounds = isWithinRussiaBounds(Number(latitude), Number(longitude));
      logger.info('🌍 Проверка границ РФ:', { latitude, longitude, isWithinBounds });
      if (!isWithinBounds) {
        return res.status(422).json({ 
          message: 'Маркер должен находиться в пределах Российской Федерации',
          coordinates: { latitude, longitude }
        });
      }
    } else {
      logger.info('⚠️ Координаты не являются числами:', { latitude, longitude, latType: typeof latitude, lngType: typeof longitude });
    }

    // Проверка зон (если есть загруженные зоны)
    if (typeof longitude === 'number' && typeof latitude === 'number') {
      const zones = await checkPointAgainstZones(Number(longitude), Number(latitude));
      if (zones && zones.length) {
        const hasCritical = zones.some(z => (z.severity || 'restricted') === 'critical');
        if (hasCritical) {
          return res.status(422).json({ message: 'Локация попадает в критическую зону. Создание запрещено.', zones });
        }
        // Для restricted/warning — добавим пометку в metadata
        let meta = {};
        if (metadata) {
          if (typeof metadata === 'string') {
            try {
              meta = JSON.parse(metadata);
            } catch {
              meta = { value: metadata };
            }
          } else if (typeof metadata === 'object') {
            meta = metadata;
          }
        }
          meta.restrictedZones = zones;
        metadata = meta; // Обновляем переменную metadata для дальнейшего использования
      }
    }
    // Обрабатываем photoUrls - если это строка, разбиваем на массив
    let photo_urls = [];
    if (photoUrls) {
      if (typeof photoUrls === 'string') {
        photo_urls = photoUrls.split(',').map(url => url.trim()).filter(url => url);
      } else if (Array.isArray(photoUrls)) {
        photo_urls = photoUrls;
      }
    }

    // Обрабатываем hashtags - если это строка, разбиваем на массив
    let hashtags_array = [];
    if (hashtags) {
      if (typeof hashtags === 'string') {
        hashtags_array = hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(hashtags)) {
        hashtags_array = hashtags;
      }
    }

    // Обрабатываем metadata - должен быть JSON строкой
    let metadataString = '{}';
    if (metadata) {
      if (typeof metadata === 'string') {
        try {
          JSON.parse(metadata); // Проверяем, что это валидный JSON
          metadataString = metadata;
        } catch {
          metadataString = JSON.stringify({ value: metadata });
        }
      } else if (typeof metadata === 'object') {
        metadataString = JSON.stringify(metadata);
      }
    }

    // Проверяем наличие колонки status
    const checkStatus = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'map_markers' AND column_name = 'status'
    `);
    const hasStatus = checkStatus.rows.length > 0;
    
    let query, values;
    if (hasStatus) {
      query = `
        INSERT INTO map_markers (
          title, category, description, address, hashtags, photo_urls, 
          creator_id, latitude, longitude, metadata, marker_type, visibility, is_active, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title, category, description, address, hashtags_array, photo_urls, 
                creator_id, latitude, longitude, metadataString, marker_type, visibility, finalStatus];
    } else {
      query = `
        INSERT INTO map_markers (
          title, category, description, address, hashtags, photo_urls, 
          creator_id, latitude, longitude, metadata, marker_type, visibility, is_active,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW()) 
        RETURNING *
      `;
      values = [title, category, description, address, hashtags_array, photo_urls, 
                creator_id, latitude, longitude, metadataString, marker_type, visibility];
    }
    
    const result = await pool.query(query, values);
    const createdMarker = result.rows[0];
    
    // Автоматический анализ ИИ только для pending контента
    if (finalStatus === 'pending' && hasStatus) {
      try {
        const { autoAnalyzeContent } = await import('../middleware/autoModeration.js');
        autoAnalyzeContent('markers', createdMarker.id, createdMarker).catch(err => {
          console.error('Ошибка автоматического анализа метки:', err);
        });
      } catch (err) {
        console.warn('Не удалось запустить автоматический анализ метки:', err.message);
      }
    }
    
    res.status(201).json(createdMarker);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка при добавлении метки', error: err.message });
  }
});

export default router;
