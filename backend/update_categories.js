const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'bestuser_temp',
  password: '55555',
  database: 'bestsite',
});

async function updateCategories() {
  const client = await pool.connect();
  
  try {
    // Создаем новый тип с расширенным списком категорий
    await client.query(`
      CREATE TYPE marker_category_new AS ENUM (
        'restaurant', 'hotel', 'attraction', 'nature', 'culture', 'entertainment', 'transport', 'service', 'other',
        'hidden_gems', 'instagram', 'non_tourist', 'summer2024', 'winter2024', 'newyear', 'family', 'romantic', 
        'budget', 'trekking', 'gastrotour', 'ecotourism', 'excursions', 'user_poi', 'post', 'event'
      );
    `);
    // Обновляем существующие записи (если есть)
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original:     const updateResult = await client.query(`
      UPDATE map_markers SET category = 'other'::text 
      WHERE category NOT IN (
        'restaurant', 'hotel', 'attraction', 'nature', 'culture', 'entertainment', 'transport', 'service', 'other'
      );
    `);
    // Изменяем тип колонки
    await client.query(`
      ALTER TABLE map_markers 
      ALTER COLUMN category TYPE marker_category_new 
      USING category::text::marker_category_new;
    `);
    // Удаляем старый тип
    await client.query('DROP TYPE marker_category;');
    // Переименовываем новый тип
    await client.query('ALTER TYPE marker_category_new RENAME TO marker_category;');
    } catch (error) {
    if (error.code === '42710') {
      } else if (error.code === '42704') {
      } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

updateCategories().catch(console.error);


