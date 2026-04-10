import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../../db.js';
import { checkLineAgainstZones } from '../utils/lazyZoneGuard.js';
import { getRussiaBounds, isWithinRussiaBounds } from '../middleware/russiaValidation.js';
import logger from '../../logger.js';

// Проверка маршрута на соответствие границам РФ
const validateRouteBounds = (routeData) => {
  if (!routeData.points || !Array.isArray(routeData.points)) {
    return { valid: true };
  }

  const invalidPoints = routeData.points.filter(point => {
    if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
      return !isWithinRussiaBounds(point.latitude, point.longitude);
    }
    return false;
  });

  if (invalidPoints.length > 0) {
    return {
      valid: false,
      message: `Маршрут содержит ${invalidPoints.length} точек за пределами РФ`,
      invalidPoints: invalidPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))
    };
  }

  return { valid: true };
};

const normalizeRouteData = (rawRouteData) => {
  try {
    return typeof rawRouteData === 'string'
      ? JSON.parse(rawRouteData)
      : (rawRouteData || null);
  } catch (error) {
    logger.warn('Ошибка парсинга route_data:', error);
    return null;
  }
};

const normalizeWaypoints = (waypoints) => {
  if (!Array.isArray(waypoints)) {
    return [];
  }

  return waypoints.filter((waypoint) => waypoint && waypoint.id !== null);
};

const toRouteResponse = (route) => {
  const normalizedWaypoints = normalizeWaypoints(route.waypoints);
  const coordinates = normalizedWaypoints
    .filter((waypoint) => waypoint.latitude && waypoint.longitude)
    .map((waypoint) => [waypoint.longitude, waypoint.latitude]);

  return {
    ...route,
    route_data: normalizeRouteData(route.route_data),
    coordinates,
    distance: route.total_distance ?? route.distance ?? null,
    duration: route.estimated_duration ?? route.duration ?? null,
    total_distance: route.total_distance ?? route.distance ?? null,
    estimated_duration: route.estimated_duration ?? route.duration ?? null,
    author_id: route.creator_id ?? route.author_id ?? null,
    points: normalizedWaypoints,
    waypoints: normalizedWaypoints,
  };
};

const router = express.Router();

// GET /api/routes/:id - Получить маршрут по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const statusColumnResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'travel_routes' AND column_name = 'status'`
    );
    const hasStatus = statusColumnResult.rows.length > 0;
    
    const result = await pool.query(`
      SELECT 
        r.*,
        r.is_user_modified,
        r.used_in_blogs,
        json_agg(
          json_build_object(
            'id', rw.marker_id,
            'order_index', rw.order_index,
            'arrival_time', rw.arrival_time,
            'departure_time', rw.departure_time,
            'duration_minutes', rw.duration_minutes,
            'notes', rw.notes,
            'latitude', mm.latitude,
            'longitude', mm.longitude,
            'is_overnight', rw.is_overnight
          ) ORDER BY rw.order_index
        ) FILTER (WHERE rw.marker_id IS NOT NULL) as waypoints
      FROM travel_routes r
      LEFT JOIN route_waypoints rw ON r.id = rw.route_id
      LEFT JOIN map_markers mm ON rw.marker_id = mm.id
      WHERE r.id = $1
        ${hasStatus ? "AND r.status = 'active'" : ''}
      GROUP BY r.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Маршрут не найден' });
    }

    res.json(toRouteResponse(result.rows[0]));
  } catch (err) {
    logger.error('Ошибка при получении маршрута:', err);
    res.status(500).json({ message: 'Ошибка сервера при получении маршрута.' });
  }
});

// Получить все маршруты пользователя
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    // Получаем маршруты с их точками
    const result = await pool.query(`
      SELECT 
        r.*,
        r.is_user_modified,
        r.used_in_blogs,
        json_agg(
          json_build_object(
            'id', rw.marker_id,
            'order_index', rw.order_index,
            'arrival_time', rw.arrival_time,
            'departure_time', rw.departure_time,
            'duration_minutes', rw.duration_minutes,
            'notes', rw.notes,
            'latitude', mm.latitude,
            'longitude', mm.longitude,
            'is_overnight', rw.is_overnight
          ) ORDER BY rw.order_index
        ) FILTER (WHERE rw.marker_id IS NOT NULL) as waypoints
      FROM travel_routes r
      LEFT JOIN route_waypoints rw ON r.id = rw.route_id
      LEFT JOIN map_markers mm ON rw.marker_id = mm.id
      WHERE r.creator_id = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `, [userId]);
    
    // Преобразуем результат для фронтенда
    const routes = result.rows.map((row) => toRouteResponse(row));
    
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка при получении маршрутов', error: err.message });
  }
});

// Создать новый маршрут
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    title,
    description,
    start_date,
    end_date,
    transport_type,
    route_data,
    total_distance,
    estimated_duration,
    estimated_cost,
    difficulty_level,
    is_public = true,
    tags = [],
    waypoints = [] // массив точек маршрута: [{ marker_id, order_index, ... }]
  } = req.body;

  // Проверяем роль пользователя - только админ может создавать сразу активные маршруты
  let userRole = 'registered';
  let isAdmin = false;
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    userRole = userResult.rows[0]?.role || 'registered';
    isAdmin = userRole === 'admin';
  } catch (err) {
    logger.warn('Ошибка проверки роли пользователя:', err);
  }
  
  // Устанавливаем статус: админ может сразу 'active', остальные - 'pending' (требуют модерации)
  const finalStatus = isAdmin ? 'active' : 'pending';
  logger.info(`📊 Статус маршрута: ${finalStatus} (пользователь: ${userRole}, админ: ${isAdmin})`);

  try {
    // Проверка российских границ для маршрута
    const boundsValidation = validateRouteBounds(route_data);
    if (!boundsValidation.valid) {
      return res.status(422).json({
        message: boundsValidation.message,
        invalidPoints: boundsValidation.invalidPoints,
        russiaBounds: getRussiaBounds()
      });
    }

    // Проверка зон (если есть загруженные зоны)
    if (Array.isArray(waypoints) && waypoints.length >= 2) {
      // Собираем координаты из маркеров
      const markerIds = waypoints.map(wp => wp.marker_id).filter(Boolean);
      if (markerIds.length >= 2) {
        const markersResult = await pool.query(
          'SELECT longitude, latitude FROM map_markers WHERE id = ANY($1)',
          [markerIds]
        );
        if (markersResult.rows.length >= 2) {
          const coords = markersResult.rows.map(m => [Number(m.longitude), Number(m.latitude)]);
          const zones = await checkLineAgainstZones(coords);
          if (zones && zones.length) {
            const hasCritical = zones.some(z => (z.severity || 'restricted') === 'critical');
            if (hasCritical) {
              return res.status(422).json({ message: 'Маршрут проходит через критическую зону. Создание запрещено.', zones });
            }
            // Для restricted/warning — добавим пометку в metadata
            const metadata = { restrictedZones: zones };
            // Обновляем route_data с metadata
            const updatedRouteData = route_data ? { ...route_data, metadata } : { metadata };
            // Проверяем наличие колонки status
            const checkStatus = await pool.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'travel_routes' AND column_name = 'status'
            `);
            const hasStatus = checkStatus.rows.length > 0;
            
            // Пересоздаём маршрут с обновлёнными данными
            let query, values;
            if (hasStatus) {
              query = `
                INSERT INTO travel_routes (
                  creator_id, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, status, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING *
              `;
              values = [userId, title, description, start_date, end_date, transport_type, JSON.stringify(updatedRouteData), total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, finalStatus];
            } else {
              query = `
                INSERT INTO travel_routes (
                  creator_id, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *
              `;
              values = [userId, title, description, start_date, end_date, transport_type, JSON.stringify(updatedRouteData), total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags];
            }
            const routeResult = await pool.query(query, values);
            const route = routeResult.rows[0];
            // Вставляем точки маршрута (waypoints)
            for (const wp of waypoints) {
              await pool.query(
                `INSERT INTO route_waypoints (route_id, marker_id, order_index, arrival_time, departure_time, duration_minutes, notes, is_overnight)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [route.id, wp.marker_id, wp.order_index, wp.arrival_time, wp.departure_time, wp.duration_minutes, wp.notes, wp.is_overnight]
              );
            }
            res.status(201).json(route);
            return;
          }
        }
      }
    }
    // Проверяем наличие колонки status
    const checkStatus = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'travel_routes' AND column_name = 'status'
    `);
    const hasStatus = checkStatus.rows.length > 0;
    
    // 1. Вставляем маршрут
    let query, values;
    if (hasStatus) {
      query = `
        INSERT INTO travel_routes (
          creator_id, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING *
      `;
      values = [userId, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, finalStatus];
    } else {
      query = `
        INSERT INTO travel_routes (
          creator_id, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *
      `;
      values = [userId, title, description, start_date, end_date, transport_type, route_data, total_distance, estimated_duration, estimated_cost, difficulty_level, is_public, tags];
    }
    const routeResult = await pool.query(query, values);
    
    const route = routeResult.rows[0];
    
    // Автоматический анализ ИИ только для pending контента
    if (finalStatus === 'pending' && hasStatus) {
      try {
        const { autoAnalyzeContent } = await import('../middleware/autoModeration.js');
        autoAnalyzeContent('routes', route.id, route).catch(err => {
          logger.error('Ошибка автоматического анализа маршрута:', err);
        });
      } catch (err) {
        logger.warn('Не удалось запустить автоматический анализ маршрута:', err.message);
      }
    }
    
    // 2. Вставляем точки маршрута (waypoints)
    for (const wp of waypoints) {
      await pool.query(
        `INSERT INTO route_waypoints (route_id, marker_id, order_index, arrival_time, departure_time, duration_minutes, notes, is_overnight)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [route.id, wp.marker_id, wp.order_index, wp.arrival_time, wp.departure_time, wp.duration_minutes, wp.notes, wp.is_overnight]
      );
    }
    
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка при создании маршрута', error: err.message });
  }
});

// Удалить маршрут (и все его точки)
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const routeId = req.params.id;
  try {
    // Проверяем, что маршрут принадлежит пользователю
    const check = await pool.query('SELECT * FROM travel_routes WHERE id = $1 AND creator_id = $2', [routeId, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Маршрут не найден или нет доступа' });
    }
    // Каскадное удаление точек маршрута обеспечивается ON DELETE CASCADE
    await pool.query('DELETE FROM travel_routes WHERE id = $1', [routeId]);
    res.json({ message: 'Маршрут удалён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка при удалении маршрута', error: err.message });
  }
});

// (Опционально) Обновить маршрут
// router.put('/routes/:id', authenticateToken, async (req, res) => {
//   // ... реализовать по необходимости ...
// });

export default router;