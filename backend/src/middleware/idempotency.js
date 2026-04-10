import logger from '../../logger.js';

// Простое кэширование idempotency ключей в памяти (в продакшене используйте Redis)
const idempotencyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Middleware для защиты от повторных запросов (idempotency).
 * Требует заголовок X-Idempotency-Key или X-Request-Id.
 * Если ключ уже обработан, возвращает предыдущий ответ.
 */
export const idempotencyMiddleware = (req, res, next) => {
  // Пропускаем GET, HEAD, OPTIONS запросы, так как они идемпотентны по природе
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['x-request-id'];
  if (!idempotencyKey) {
    // Если ключ не предоставлен, пропускаем (можно требовать ключ, но для совместимости пропускаем)
    return next();
  }

  const cacheKey = `${req.method}:${req.originalUrl}:${idempotencyKey}`;
  const cached = idempotencyCache.get(cacheKey);

  if (cached) {
    // Проверяем, не истек ли TTL
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info(`Idempotency hit for ${cacheKey}`);
      // Возвращаем кэшированный ответ
      res.status(cached.status).set(cached.headers).json(cached.body);
      return;
    } else {
      // Удаляем устаревшую запись
      idempotencyCache.delete(cacheKey);
    }
  }

  // Перехватываем оригинальный res.json и res.end для кэширования ответа
  const originalJson = res.json;
  const originalEnd = res.end;
  const originalStatus = res.status;
  const originalSet = res.set;

  let responseBody = null;
  let responseStatus = 200;
  const responseHeaders = {};

  res.status = function (code) {
    responseStatus = code;
    return originalStatus.call(this, code);
  };

  res.set = function (field, value) {
    if (typeof field === 'object') {
      Object.assign(responseHeaders, field);
    } else {
      responseHeaders[field] = value;
    }
    return originalSet.call(this, field, value);
  };

  res.json = function (body) {
    responseBody = body;
    // Кэшируем ответ
    idempotencyCache.set(cacheKey, {
      timestamp: Date.now(),
      status: responseStatus,
      headers: { ...responseHeaders },
      body: responseBody
    });
    logger.info(`Idempotency cached for ${cacheKey}`);
    return originalJson.call(this, body);
  };

  res.end = function (chunk, encoding) {
    if (chunk && !responseBody) {
      // Если ответ отправлен через res.end (например, текст)
      responseBody = chunk.toString();
      idempotencyCache.set(cacheKey, {
        timestamp: Date.now(),
        status: responseStatus,
        headers: { ...responseHeaders },
        body: responseBody
      });
      logger.info(`Idempotency cached for ${cacheKey} (end)`);
    }
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Очистка устаревших записей кэша (можно вызывать периодически)
 */
export const cleanupIdempotencyCache = () => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      idempotencyCache.delete(key);
    }
  }
};

// Запускаем периодическую очистку каждые 10 минут
setInterval(cleanupIdempotencyCache, 10 * 60 * 1000);