-- Таблица настроек приватности активности
CREATE TABLE IF NOT EXISTS activity_privacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Настройки видимости по типам активности
    room_created_visibility VARCHAR(20) DEFAULT 'public' CHECK (room_created_visibility IN ('public', 'friends', 'private', 'anonymous')),
    room_joined_visibility VARCHAR(20) DEFAULT 'public' CHECK (room_joined_visibility IN ('public', 'friends', 'private', 'anonymous')),
    post_created_visibility VARCHAR(20) DEFAULT 'public' CHECK (post_created_visibility IN ('public', 'friends', 'private', 'anonymous')),
    post_published_visibility VARCHAR(20) DEFAULT 'public' CHECK (post_published_visibility IN ('public', 'friends', 'private', 'anonymous')),
    marker_created_visibility VARCHAR(20) DEFAULT 'public' CHECK (marker_created_visibility IN ('public', 'friends', 'private', 'anonymous')),
    route_created_visibility VARCHAR(20) DEFAULT 'public' CHECK (route_created_visibility IN ('public', 'friends', 'private', 'anonymous')),
    route_shared_visibility VARCHAR(20) DEFAULT 'public' CHECK (route_shared_visibility IN ('public', 'friends', 'private', 'anonymous')),
    event_created_visibility VARCHAR(20) DEFAULT 'public' CHECK (event_created_visibility IN ('public', 'friends', 'private', 'anonymous')),
    event_joined_visibility VARCHAR(20) DEFAULT 'public' CHECK (event_joined_visibility IN ('public', 'friends', 'private', 'anonymous')),
    achievement_earned_visibility VARCHAR(20) DEFAULT 'public' CHECK (achievement_earned_visibility IN ('public', 'friends', 'private', 'anonymous')),
    level_up_visibility VARCHAR(20) DEFAULT 'public' CHECK (level_up_visibility IN ('public', 'friends', 'private', 'anonymous')),
    challenge_completed_visibility VARCHAR(20) DEFAULT 'public' CHECK (challenge_completed_visibility IN ('public', 'friends', 'private', 'anonymous')),
    profile_updated_visibility VARCHAR(20) DEFAULT 'friends' CHECK (profile_updated_visibility IN ('public', 'friends', 'private', 'anonymous')),
    friend_added_visibility VARCHAR(20) DEFAULT 'friends' CHECK (friend_added_visibility IN ('public', 'friends', 'private', 'anonymous')),
    
    -- Настройки уведомлений
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    in_app_notifications BOOLEAN DEFAULT true,
    
    -- Настройки времени показа
    show_activity_duration INTEGER DEFAULT 7 CHECK (show_activity_duration IN (1, 7, 30, 365)), -- дни
    
    -- Время создания и обновления
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальность - один пользователь = одна запись настроек
    UNIQUE(user_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_activity_privacy_user_id ON activity_privacy_settings(user_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_activity_privacy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activity_privacy_updated_at
    BEFORE UPDATE ON activity_privacy_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_privacy_updated_at();
