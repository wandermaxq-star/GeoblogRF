-- Расширенные типы активности для WayAtom
-- Полный комплекс взаимодействий для всех сущностей проекта

-- Обновление ENUM типов активности
ALTER TYPE activity_type ADD VALUE 'chat_created';           -- Создание чата
ALTER TYPE activity_type ADD VALUE 'chat_joined';             -- Присоединение к чату
ALTER TYPE activity_type ADD VALUE 'chat_left';               -- Покинул чат
ALTER TYPE activity_type ADD VALUE 'chat_message_sent';       -- Отправил сообщение в чат
ALTER TYPE activity_type ADD VALUE 'chat_archived';            -- Архивировал чат
ALTER TYPE activity_type ADD VALUE 'chat_restored';            -- Восстановил чат

-- События
ALTER TYPE activity_type ADD VALUE 'event_updated';            -- Обновил событие
ALTER TYPE activity_type ADD VALUE 'event_cancelled';          -- Отменил событие
ALTER TYPE activity_type ADD VALUE 'event_completed';          -- Завершил событие
ALTER TYPE activity_type ADD VALUE 'event_left';               -- Покинул событие

-- Маршруты
ALTER TYPE activity_type ADD VALUE 'route_updated';            -- Обновил маршрут
ALTER TYPE activity_type ADD VALUE 'route_deleted';            -- Удалил маршрут
ALTER TYPE activity_type ADD VALUE 'route_favorited';          -- Добавил маршрут в избранное
ALTER TYPE activity_type ADD VALUE 'route_unfavorited';       -- Убрал маршрут из избранного
ALTER TYPE activity_type ADD VALUE 'route_rated';              -- Оценил маршрут
ALTER TYPE activity_type ADD VALUE 'route_commented';          -- Прокомментировал маршрут

-- Метки
ALTER TYPE activity_type ADD VALUE 'marker_updated';           -- Обновил метку
ALTER TYPE activity_type ADD VALUE 'marker_deleted';           -- Удалил метку
ALTER TYPE activity_type ADD VALUE 'marker_favorited';         -- Добавил метку в избранное
ALTER TYPE activity_type ADD VALUE 'marker_unfavorited';       -- Убрал метку из избранного
ALTER TYPE activity_type ADD VALUE 'marker_rated';             -- Оценил метку
ALTER TYPE activity_type ADD VALUE 'marker_commented';         -- Прокомментировал метку
ALTER TYPE activity_type ADD VALUE 'marker_visited';           -- Посетил метку

-- Публикации (posts)
ALTER TYPE activity_type ADD VALUE 'post_updated';             -- Обновил пост
ALTER TYPE activity_type ADD VALUE 'post_deleted';             -- Удалил пост
ALTER TYPE activity_type ADD VALUE 'post_favorited';           -- Добавил пост в избранное
ALTER TYPE activity_type ADD VALUE 'post_unfavorited';         -- Убрал пост из избранного
ALTER TYPE activity_type ADD VALUE 'post_rated';               -- Оценил пост
ALTER TYPE activity_type ADD VALUE 'post_commented';           -- Прокомментировал пост
ALTER TYPE activity_type ADD VALUE 'post_liked';               -- Лайкнул пост
ALTER TYPE activity_type ADD VALUE 'post_unliked';             -- Убрал лайк с поста

-- Пользователи и социальные взаимодействия
ALTER TYPE activity_type ADD VALUE 'user_followed';            -- Подписался на пользователя
ALTER TYPE activity_type ADD VALUE 'user_unfollowed';          -- Отписался от пользователя
ALTER TYPE activity_type ADD VALUE 'user_blocked';             -- Заблокировал пользователя
ALTER TYPE activity_type ADD VALUE 'user_unblocked';           -- Разблокировал пользователя
ALTER TYPE activity_type ADD VALUE 'friend_removed';           -- Удалил из друзей
ALTER TYPE activity_type ADD VALUE 'friend_request_sent';      -- Отправил запрос в друзья
ALTER TYPE activity_type ADD VALUE 'friend_request_accepted';  -- Принял запрос в друзья
ALTER TYPE activity_type ADD VALUE 'friend_request_declined';  -- Отклонил запрос в друзья

-- Достижения и геймификация
ALTER TYPE activity_type ADD VALUE 'achievement_progress';     -- Прогресс по достижению
ALTER TYPE activity_type ADD VALUE 'level_milestone';          -- Достиг вехи уровня
ALTER TYPE activity_type ADD VALUE 'challenge_started';        -- Начал челлендж
ALTER TYPE activity_type ADD VALUE 'challenge_failed';         -- Провалил челлендж
ALTER TYPE activity_type ADD VALUE 'badge_earned';             -- Получил значок
ALTER TYPE activity_type ADD VALUE 'streak_started';          -- Начал серию
ALTER TYPE activity_type ADD VALUE 'streak_broken';            -- Прервал серию

-- Системные уведомления
ALTER TYPE activity_type ADD VALUE 'system_maintenance';       -- Техническое обслуживание
ALTER TYPE activity_type ADD VALUE 'system_update_available';  -- Доступно обновление
ALTER TYPE activity_type ADD VALUE 'system_update_completed';  -- Обновление завершено
ALTER TYPE activity_type ADD VALUE 'system_feature_added';     -- Добавлена новая функция
ALTER TYPE activity_type ADD VALUE 'system_feature_removed';   -- Удалена функция
ALTER TYPE activity_type ADD VALUE 'system_security_alert';    -- Предупреждение безопасности
ALTER TYPE activity_type ADD VALUE 'system_performance_boost'; -- Улучшение производительности

-- Модерация и безопасность
ALTER TYPE activity_type ADD VALUE 'content_reported';         -- Пожаловался на контент
ALTER TYPE activity_type ADD VALUE 'content_moderated';        -- Контент прошел модерацию
ALTER TYPE activity_type ADD VALUE 'content_rejected';         -- Контент отклонен
ALTER TYPE activity_type ADD VALUE 'user_warned';              -- Предупреждение пользователю
ALTER TYPE activity_type ADD VALUE 'user_suspended';           -- Блокировка пользователя
ALTER TYPE activity_type ADD VALUE 'user_unbanned';           -- Разблокировка пользователя

-- Интеграции и внешние сервисы
ALTER TYPE activity_type ADD VALUE 'integration_connected';    -- Подключил интеграцию
ALTER TYPE activity_type ADD VALUE 'integration_disconnected'; -- Отключил интеграцию
ALTER TYPE activity_type ADD VALUE 'api_key_generated';        -- Сгенерировал API ключ
ALTER TYPE activity_type ADD VALUE 'webhook_created';          -- Создал webhook
ALTER TYPE activity_type ADD VALUE 'export_completed';         -- Экспорт завершен
ALTER TYPE activity_type ADD VALUE 'import_completed';         -- Импорт завершен

-- Обновление типов целей
ALTER TYPE target_type ADD VALUE 'chat';                       -- Чат
ALTER TYPE target_type ADD VALUE 'message';                    -- Сообщение
ALTER TYPE target_type ADD VALUE 'comment';                    -- Комментарий
ALTER TYPE target_type ADD VALUE 'rating';                     -- Оценка
ALTER TYPE target_type ADD VALUE 'like';                       -- Лайк
ALTER TYPE target_type ADD VALUE 'badge';                      -- Значок
ALTER TYPE target_type ADD VALUE 'streak';                     -- Серия
ALTER TYPE target_type ADD VALUE 'integration';                 -- Интеграция
ALTER TYPE target_type ADD VALUE 'webhook';                    -- Webhook
ALTER TYPE target_type ADD VALUE 'export';                     -- Экспорт
ALTER TYPE target_type ADD VALUE 'import';                     -- Импорт
ALTER TYPE target_type ADD VALUE 'moderation';                 -- Модерация
ALTER TYPE target_type ADD VALUE 'report';                     -- Жалоба
ALTER TYPE target_type ADD VALUE 'api_key';                    -- API ключ
ALTER TYPE target_type ADD VALUE 'post';                       -- Пост
