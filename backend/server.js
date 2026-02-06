import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { authenticateToken } from './src/middleware/auth.js';

// ОТЛАДОЧНЫЙ ЛОГ - проверяем, что сервер запускается из правильного файла
// Импорт маршрутов
import userRoutes from './src/routes/userRoutes.js';
import eventRoutes from './src/routes/eventRoutes.js';
import markerRoutes from './src/routes/marker.js';
import logger from './logger.js';
import routesRouter from './src/routes/routes.js';
import placesRoutes from './src/routes/places.js';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import HashtagChatServer from './hashtag-chat-server-integrated.js';

// Импорт роутов друзей
import friendsRoutes from './src/routes/friends.js';
// Импорт роутов блогов
import blogRoutes from './src/routes/blogRoutes.js';
// Импорт роутов книг
import bookRoutes from './src/routes/bookRoutes.js';
// Импорт роутов активности
import activityRoutes from './src/routes/activityRoutes.js';
import zonesRoutes from './src/routes/zones.js';
import ratingsRoutes from './src/routes/ratings.js';
import routeRatingsRoutes from './src/routes/routeRatings.js';
import markerCompletenessRoutes from './src/routes/markerCompleteness.js';
import markerDuplicationRoutes from './src/routes/markerDuplication.js';
import eventGamificationRoutes from './src/routes/eventGamification.js';
import postsRoutes from './src/routes/posts.js';
import smsStatsRoutes from './src/routes/smsStats.js';
import gamificationRoutes from './src/routes/gamificationRoutes.js';
import globalGoalsRoutes from './src/routes/globalGoalsRoutes.js';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import uploadRoutes from './src/routes/uploadRoutes.js';
import moderationRoutes from './src/routes/moderationRoutes.js';
import adminStatsRoutes from './src/routes/adminStatsRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import offlinePostsRoutes from './src/routes/offlinePostsRoutes.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = Number(process.env.SERVER_PORT) || 3002;

logger.info(`Старт инициализации сервера. Порт: ${PORT}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS middleware для разрешения запросов с frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

logger.info('Базовые middleware подключены');

// Логирование всех HTTP-запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Статические файлы
app.use(express.static('public'));
logger.info('Отдача статики настроена (папка public)');

// Статическая раздача для офлайн постов (без листинга директорий)
const offlinePostsUploadsDir = path.join(__dirname, 'uploads', 'offline-posts');
if (!fs.existsSync(offlinePostsUploadsDir)) {
  fs.mkdirSync(offlinePostsUploadsDir, { recursive: true });
}
app.use('/uploads/offline-posts', express.static(offlinePostsUploadsDir, {
  index: false,
  redirect: false
}));
logger.info('Отдача статики для офлайн постов настроена');

// Настройка Multer для загрузки файлов
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'image-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешена загрузка только изображений'), false);
    }
  }
});
logger.info('Хранилище для загрузок (multer) инициализировано');

// Тестовый маршрут
app.get('/', (req, res) => {
  res.send('Бэкенд Horizon Explorer запущен!');
});

// Health-check маршрут для проверки живости сервера и БД
app.get('/api/health', async (req, res) => {
  try {
    // Позволяем пропустить проверку БД в локальном режиме разработки
    if (process.env.SKIP_DB === 'true') {
      return res.json({ status: 'ok', port: PORT, db: 'skipped', uptime: process.uptime() });
    }
    // Лёгкий запрос к БД, чтобы проверить доступность
    await pool.query('SELECT 1');
    res.json({ status: 'ok', port: PORT, db: 'ok', uptime: process.uptime() });
  } catch (e) {
    logger.error('Health-check: ошибка соединения с БД', { error: e?.message });
    res.status(500).json({ status: 'error', port: PORT, db: 'error', message: e?.message });
  }
});

// Отладочный маршрут для проверки middleware
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works', headers: req.headers });
});

// API маршруты
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);

// Chat роуты будут загружены асинхронно
let chatRoutesLoaded = false;

// Общий endpoint для загрузки фото (без привязки к маркеру) - для использования в форме создания
// Этот endpoint должен быть ДО app.use('/api', markerRoutes), чтобы не конфликтовать
// Разрешаем загрузку без авторизации для гостевых пользователей (отложенная модерация)
app.post('/api/upload/image', (req, res, next) => {
  // Проверяем авторизацию опционально
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Если есть токен, проверяем его
    authenticateToken(req, res, (authErr) => {
      // Если токен невалидный, все равно разрешаем загрузку (гостевой режим)
      if (authErr) {
        req.user = null;
      }
      upload.single('image')(req, res, (err) => {
        if (err) {
          // Обработка ошибок multer
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                message: 'Размер файла превышает 10MB.',
                error: 'File too large'
              });
            }
            return res.status(400).json({
              message: `Ошибка загрузки: ${err.message}`,
              error: err.code
            });
          }
          // Ошибка фильтра файлов
          if (err.message === 'Разрешена загрузка только изображений') {
            return res.status(400).json({
              message: 'Разрешена загрузка только изображений.',
              error: 'Invalid file type'
            });
          }
          return next(err);
        }
        next();
      });
    });
  } else {
    // Если токена нет, разрешаем загрузку для гостя
    req.user = null;
    upload.single('image')(req, res, (err) => {
      if (err) {
        // Обработка ошибок multer
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: 'Размер файла превышает 10MB.',
              error: 'File too large'
            });
          }
          return res.status(400).json({
            message: `Ошибка загрузки: ${err.message}`,
            error: err.code
          });
        }
        // Ошибка фильтра файлов
        if (err.message === 'Разрешена загрузка только изображений') {
          return res.status(400).json({
            message: 'Разрешена загрузка только изображений.',
            error: 'Invalid file type'
          });
        }
        return res.status(400).json({
          message: `Ошибка загрузки: ${err.message}`,
          error: 'Upload error'
        });
      }
      next();
    });
  }
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Файл не был загружен.',
        error: 'No file uploaded'
      });
    }

    const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    logger.info(`Фото загружено: ${req.file.filename}, размер: ${req.file.size} bytes`);

    res.json({
      message: 'Фото успешно загружено',
      photoUrl: photoUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    logger.error('Ошибка загрузки фото:', error);
    // Удаляем файл при ошибке, если он был загружен
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Ошибка удаления файла:', unlinkError);
      }
    }
    res.status(500).json({
      message: 'Ошибка сервера при загрузке фото.',
      error: error.message
    });
  }
});

// Загрузка фото к маркеру
app.post('/api/markers/:id/photos', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: 'Файл не был загружен.' });
  }

  const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  try {
    const result = await pool.query(
      'UPDATE map_markers SET photo_urls = array_append(photo_urls, $1) WHERE id = $2 RETURNING *',
      [photoUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Маркер не найден.' });
    }

    res.json({
      message: 'Фото успешно загружено',
      marker: result.rows[0],
      photoUrl: photoUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера при загрузке фото.' });
  }
});

// Дублирующие API handlers удалены - используем routes
// Все endpoints для markers, events, users теперь в соответствующих routes

// Preflight для ORS
app.options('/ors/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Прокси для OpenRouteService API
app.post('/ors/v2/directions/:profile/geojson', async (req, res) => {
  try {
    const { profile } = req.params;
    const { coordinates, radiuses } = req.body || {};
    logger.info('ORS proxy request', { profile, coordinatesCount: Array.isArray(coordinates) ? coordinates.length : 0 });

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Invalid coordinates: need at least 2 points [lon,lat]' });
    }

    // Проверяем API ключ
    const apiKey = process.env.OPENROUTE_SERVICE_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjYwOGRiYTc1N2I2MzBlM2Q0NmY3NzAzOThlM2M1YjEwODQxNGU5ZmZiYTEwY2Q4YjRlZWU4YzRlIiwiaCI6Im11cm11cjY0In0=';

    const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates,
        radiuses: radiuses || coordinates.map(() => 500)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Если 429 (Rate Limit) — более понятное сообщение
      if (response.status === 429) {
        logger.warn('OpenRouteService API: Rate Limit Exceeded (429)');
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Превышен лимит запросов к OpenRouteService API. Попробуйте позже.',
          details: errorText
        });
      }
      logger.error('OpenRouteService API error:', { status: response.status, error: errorText });
      // ORS иногда возвращает 404 при некорректном пути/профиле — нормализуем до 400 для фронта
      const status = response.status === 404 ? 400 : response.status;
      return res.status(status).json({ error: 'OpenRouteService API error', details: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    logger.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', details: error.message });
  }
});

// API для маршрутов - теперь обрабатывается через routesRouter

app.use('/api', markerRoutes);
app.use('/api', routesRouter);
app.use('/api', placesRoutes);
app.use('/api', friendsRoutes);
app.use('/api', zonesRoutes);
app.use('/api', ratingsRoutes);
app.use('/api', routeRatingsRoutes);
app.use('/api', markerCompletenessRoutes);
app.use('/api', markerDuplicationRoutes);
app.use('/api', eventGamificationRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api', postsRoutes);
app.use('/api', offlinePostsRoutes);
app.use('/api/sms', smsStatsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/gamification/global', globalGoalsRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminStatsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Асинхронная функция для загрузки chat роутов
async function loadChatRoutes() {
  try {
    const chatModule = await import('./src/routes/chat.js');
    const chatRoutes = chatModule.default;
    app.use('/api/chat', chatRoutes);
    chatRoutesLoaded = true;
    logger.info('Маршруты чата успешно загружены');
    return true;
  } catch (error) {
    logger.error('Не удалось загрузить маршруты чата', { error: error?.message });
    return false;
  }
}

// Загружаем chat роуты и запускаем сервер
async function startServer() {
  try {
    logger.info('Запускаю сервер...');

    // Пробуем заранее пингнуть БД, чтобы выявить проблемы на старте
    try {
      if (process.env.SKIP_DB === 'true') {
        logger.info('SKIP_DB=true — пропускаю проверку соединения с БД (локальный режим без БД)');
      } else {
        await pool.query('SELECT 1');
        logger.info('Соединение с БД успешно проверено');
      }
    } catch (dbErr) {
      logger.error('Ошибка подключения к БД на старте', { error: dbErr?.message });
      // Не выходим, сервер всё равно поднимем, но health покажет проблему
    }

    // Загружаем chat роуты (не критично для старта)
    // await loadChatRoutes();

    // Запускаем HTTP сервер
    server.listen(PORT, () => {
      logger.info(`✅ Сервер запущен и слушает порт ${PORT}`);
      // Интегрируем WebSocket сервер
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original:         const chatWSS = new HashtagChatServer(server);
        logger.info('WebSocket сервер чата по хэштегам инициализирован');
      } catch (wsErr) {
        logger.error('Ошибка инициализации WebSocket сервера', { error: wsErr?.message });
      }
    });

    server.on('error', (err) => {
      logger.error('Ошибка HTTP сервера', { error: err?.message });
    });
  } catch (error) {
    logger.error('Критическая ошибка старта сервера', { error: error?.message });
    process.exit(1);
  }
}

// Запускаем сервер
startServer();

// Глобальные ловушки ошибок, чтобы процесс не «умирал» молча
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { error: err?.message, stack: err?.stack });
});


