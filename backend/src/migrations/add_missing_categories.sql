-- Добавление недостающих категорий в перечисление marker_category
-- Выполните этот скрипт в базе данных

-- Сначала создаем новый тип с расширенным списком категорий
CREATE TYPE marker_category_new AS ENUM (
    'restaurant', 'hotel', 'attraction', 'nature', 'culture', 'entertainment', 'transport', 'service', 'other',
    'hidden_gems', 'instagram', 'non_tourist', 'summer2025', 'winter2025', 'newyear', 'family', 'romantic', 
    'budget', 'trekking', 'gastrotour', 'ecotourism', 'excursions', 'user_poi', 'post', 'event'
);

-- Обновляем существующие записи (если есть)
UPDATE map_markers SET category = 'other'::text WHERE category NOT IN (
    'restaurant', 'hotel', 'attraction', 'nature', 'culture', 'entertainment', 'transport', 'service', 'other'
);

-- Изменяем тип колонки
ALTER TABLE map_markers 
    ALTER COLUMN category TYPE marker_category_new 
    USING category::text::marker_category_new;

-- Удаляем старый тип
DROP TYPE marker_category;

-- Переименовываем новый тип
ALTER TYPE marker_category_new RENAME TO marker_category;
