const { Client } = require('pg');

function getConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printList(items, emptyMessage) {
  if (!items.length) {
    console.log(emptyMessage);
    return;
  }

  items.forEach((item) => console.log(`- ${item}`));
}

async function queryRows(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows;
}

async function run() {
  const config = getConnectionConfig();
  const hasConnectionTarget = Boolean(config.connectionString || (config.user && config.database));

  if (!hasConnectionTarget) {
    console.error('Не заданы параметры подключения к БД. Укажите DATABASE_URL или PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.');
    process.exitCode = 1;
    return;
  }

  const client = new Client(config);

  try {
    await client.connect();

    const tables = await queryRows(client, `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableNames = tables.map((row) => row.table_name);

    printSection('Таблицы');
    printList(tableNames, 'Таблицы не найдены.');

    const routeCandidates = tableNames.filter((name) => /route/i.test(name));
    printSection('Route-related таблицы');
    printList(routeCandidates, 'Route-related таблицы не найдены.');

    const suspiciousPairs = [];
    if (tableNames.includes('routes') && tableNames.includes('travel_routes')) {
      suspiciousPairs.push('Одновременно существуют tables routes и travel_routes. Нужна проверка домена маршрутов и единый source of truth.');
    }
    if (tableNames.includes('markers') && tableNames.includes('map_markers')) {
      suspiciousPairs.push('Одновременно существуют tables markers и map_markers. Нужна проверка, нет ли дублирующего домена меток.');
    }

    printSection('Явные конфликтные пары');
    printList(suspiciousPairs, 'Явные конфликтные пары по базовым эвристикам не найдены.');

    const columns = await queryRows(client, `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    printSection('Route-domain колонки');
    const routeColumns = columns.filter((row) => /route/i.test(row.table_name));
    if (!routeColumns.length) {
      console.log('Route-domain колонок не найдено.');
    } else {
      routeColumns.forEach((row) => {
        console.log(`- ${row.table_name}.${row.column_name} :: ${row.data_type}${row.is_nullable === 'YES' ? ' nullable' : ''}`);
      });
    }

    const foreignKeys = await queryRows(client, `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    printSection('Foreign keys route-domain');
    const routeForeignKeys = foreignKeys.filter((row) => /route/i.test(row.table_name) || /route/i.test(row.foreign_table_name));
    if (!routeForeignKeys.length) {
      console.log('Route-domain foreign keys не найдены.');
    } else {
      routeForeignKeys.forEach((row) => {
        console.log(`- ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
    }

    const indexes = await queryRows(client, `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    printSection('Route-domain индексы');
    const routeIndexes = indexes.filter((row) => /route/i.test(row.tablename) || /route/i.test(row.indexname));
    if (!routeIndexes.length) {
      console.log('Route-domain индексы не найдены.');
    } else {
      routeIndexes.forEach((row) => {
        console.log(`- ${row.tablename}: ${row.indexname}`);
      });
    }

    const rowCounts = [];
    for (const tableName of routeCandidates) {
      const rows = await queryRows(client, `SELECT COUNT(*)::int AS count FROM ${tableName}`);
      rowCounts.push(`${tableName}: ${rows[0]?.count ?? 0}`);
    }

    printSection('Route-domain объёмы');
    printList(rowCounts, 'Route-domain таблицы отсутствуют, считать нечего.');

    printSection('Итог');
    console.log('Schema audit завершён. Используйте этот вывод как фактологическую основу для чистки схемы, а не старые скрипты с жёстко зашитыми параметрами подключения.');
  } catch (error) {
    console.error('Ошибка schema audit:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

run();