    import pg from 'pg';
    import dotenv from 'dotenv';
    import logger from './logger.js';

    dotenv.config(); // Загружаем переменные окружения из .env

    function parseNumberEnv(name, fallback) {
      const rawValue = process.env[name];
      if (!rawValue) {
        return fallback;
      }

      const parsedValue = Number.parseInt(rawValue, 10);
      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function isTransientDbConnectionError(err) {
      if (!err) {
        return false;
      }

      return [
        'ECONNRESET',
        'EPIPE',
        'ETIMEDOUT',
        '57P01',
        '57P02',
        '57P03'
      ].includes(err.code) || /Connection terminated unexpectedly/i.test(err.message || '');
    }

    const pool = new pg.Pool({
      user: process.env.DB_USER || 'bestuser_temp',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_DATABASE || 'bestsite',
      password: process.env.DB_PASSWORD || '55555',
      port: parseNumberEnv('DB_PORT', 5432),
      // Таймауты подключения для pool'я
      connectionTimeoutMillis: parseNumberEnv('DB_CONNECTION_TIMEOUT_MS', 5000), // 5 сек на установление соединения
      idleTimeoutMillis: parseNumberEnv('DB_IDLE_TIMEOUT_MS', 30000), // 30 сек до разрыва неиспользуемого соединения
      maxLifetimeSeconds: parseNumberEnv('DB_MAX_LIFETIME_SECONDS', 300),
      // Правильные настройки кодировки для node-postgres
      client_encoding: 'utf8',
      // node-postgres использует keepAlive/keepAliveInitialDelayMillis, а не keepalives/keepalivesIdle.
      keepAlive: true,
      keepAliveInitialDelayMillis: parseNumberEnv('DB_KEEPALIVE_INITIAL_DELAY_MS', 10000)
    });

    pool.on('error', (err) => {
      const logPayload = {
        code: err?.code,
        error: err?.message,
        host: pool.options?.host,
        database: pool.options?.database
      };

      if (isTransientDbConnectionError(err)) {
        logger.warn('[db] Transient pool error', logPayload);
        return;
      }

      logger.error('[db] Pool error', logPayload);
      // По умолчанию в продакшн выходим при фатальной ошибке БД.
      // Для локальной разработки без БД можно установить FAIL_ON_DB_ERROR=true, чтобы поведение было фатальным.
      if (process.env.FAIL_ON_DB_ERROR === 'true') {
        process.exit(-1); // Выходим из процесса при необходимости
      }
      // В режиме разработки не завершаем процесс — даём серверу подняться без БД.
    });

    pool.on('connect', (client) => {
      if (typeof client.connection?.stream?.setKeepAlive === 'function') {
        client.connection.stream.setKeepAlive(true, parseNumberEnv('DB_KEEPALIVE_INITIAL_DELAY_MS', 10000));
      }
    });

    export { isTransientDbConnectionError };

    export default pool;