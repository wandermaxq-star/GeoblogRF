-- Создание ENUM типов для activity_feed

-- Типы активности
CREATE TYPE activity_type AS ENUM (
    'room_created',           -- Создание комнаты
    'room_joined',            -- Присоединение к комнате
    'post_created',           -- Создание поста
    'post_published',         -- Публикация поста
    'marker_created',         -- Создание метки
    'route_created',          -- Создание маршрута
    'route_shared',           -- Поделился маршрутом
    'event_created',          -- Создание события
    'event_joined',           -- Присоединение к событию
    'achievement_earned',     -- Получение достижения
    'level_up',               -- Повышение уровня
    'challenge_completed',    -- Завершение челленджа
    'profile_updated',        -- Обновление профиля
    'friend_added',           -- Добавление друга
    'system_update',          -- Системное обновление
    'system_announcement'     -- Системное объявление
);

-- Типы целей
CREATE TYPE target_type AS ENUM (
    'room',                   -- Комната
    'post',                   -- Пост
    'marker',                 -- Метка
    'route',                  -- Маршрут
    'event',                  -- Событие
    'achievement',            -- Достижение
    'user',                   -- Пользователь
    'system'                  -- Система
);

-- Категории достижений
CREATE TYPE achievement_category AS ENUM (
    'social',                 -- Социальные
    'content',                -- Контент
    'travel',                 -- Путешествия
    'exploration',            -- Исследования
    'community',              -- Сообщество
    'system'                  -- Системные
);

-- Редкость достижений
CREATE TYPE achievement_rarity AS ENUM (
    'common',                 -- Обычные
    'uncommon',               -- Необычные
    'rare',                   -- Редкие
    'epic',                   -- Эпические
    'legendary'               -- Легендарные
);
