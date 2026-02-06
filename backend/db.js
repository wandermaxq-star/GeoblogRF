    import pg from 'pg';
    import dotenv from 'dotenv';

    dotenv.config(); // Загружаем переменные окружения из .env

    const pool = new pg.Pool({
      user: process.env.DB_USER || 'bestuser_temp',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_DATABASE || 'bestsite',
      password: process.env.DB_PASSWORD || '55555',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      // Правильные настройки кодировки для node-postgres
      client_encoding: 'utf8'
    });

    pool.on('error', (err) => {
      console.error('[db] Pool error:', err);
      // По умолчанию в продакшн выходим при фатальной ошибке БД.
      // Для локальной разработки без БД можно установить FAIL_ON_DB_ERROR=true, чтобы поведение было фатальным.
      if (process.env.FAIL_ON_DB_ERROR === 'true') {
        process.exit(-1); // Выходим из процесса при необходимости
      }
      // В режиме разработки не завершаем процесс — даём серверу подняться без БД.
    });

    export default pool;