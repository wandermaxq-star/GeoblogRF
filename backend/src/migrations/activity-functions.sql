-- Функция для создания активности
CREATE OR REPLACE FUNCTION create_activity(
    p_user_id UUID,
    p_activity_type activity_type,
    p_target_type target_type,
    p_target_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_is_public BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
    v_privacy_setting VARCHAR(20);
BEGIN
    -- Получаем настройки приватности пользователя
    -- Сравниваем как текст, чтобы избежать ошибок при несовпадении значений enum в разных базах
    SELECT 
        CASE p_activity_type::text
            WHEN 'room_created' THEN room_created_visibility
            WHEN 'room_joined' THEN room_joined_visibility
            WHEN 'chat_created' THEN room_created_visibility
            WHEN 'chat_joined' THEN room_joined_visibility
            WHEN 'post_created' THEN post_created_visibility
            WHEN 'post_published' THEN post_published_visibility
            WHEN 'marker_created' THEN marker_created_visibility
            WHEN 'route_created' THEN route_created_visibility
            WHEN 'route_shared' THEN route_shared_visibility
            WHEN 'event_created' THEN event_created_visibility
            WHEN 'event_joined' THEN event_joined_visibility
            WHEN 'achievement_earned' THEN achievement_earned_visibility
            WHEN 'level_up' THEN level_up_visibility
            WHEN 'challenge_completed' THEN challenge_completed_visibility
            WHEN 'profile_updated' THEN profile_updated_visibility
            WHEN 'friend_added' THEN friend_added_visibility
            ELSE 'public'
        END
    INTO v_privacy_setting
    FROM activity_privacy_settings
    WHERE user_id = p_user_id;
    
    -- Если настройки не найдены, используем публичные
    IF v_privacy_setting IS NULL THEN
        v_privacy_setting := 'public';
    END IF;
    
    -- Определяем публичность на основе настроек
    p_is_public := v_privacy_setting IN ('public', 'anonymous');
    
    -- Создаем активность
    INSERT INTO activity_feed (
        user_id,
        activity_type,
        target_type,
        target_id,
        metadata,
        is_public
    ) VALUES (
        p_user_id,
        p_activity_type,
        p_target_type,
        p_target_id,
        p_metadata,
        p_is_public
    ) RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения активности пользователя
CREATE OR REPLACE FUNCTION get_user_activity_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_activity_types activity_type[] DEFAULT NULL,
    p_target_types target_type[] DEFAULT NULL
)
RETURNS TABLE (
    activity_id UUID,
    user_id UUID,
    username VARCHAR,
    avatar_url TEXT,
    activity_type activity_type,
    target_type target_type,
    target_id UUID,
    metadata JSONB,
    is_public BOOLEAN,
    created_at TIMESTAMP,
    is_read BOOLEAN,
    read_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        af.id as activity_id,
        af.user_id,
        u.username,
        u.avatar_url,
        af.activity_type,
        af.target_type,
        af.target_id,
        af.metadata,
        af.is_public,
        af.created_at,
        COALESCE(ars.is_read, false) as is_read,
        ars.read_at
    FROM activity_feed af
    JOIN users u ON af.user_id = u.id
    LEFT JOIN activity_read_status ars ON af.id = ars.activity_id AND ars.user_id = p_user_id
    WHERE 
        af.is_public = true
        AND (p_activity_types IS NULL OR af.activity_type = ANY(p_activity_types))
        AND (p_target_types IS NULL OR af.target_type = ANY(p_target_types))
    ORDER BY af.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения статистики активности
CREATE OR REPLACE FUNCTION get_activity_stats(p_user_id UUID)
RETURNS TABLE (
    total_activities BIGINT,
    unread_activities BIGINT,
    messages_count BIGINT,
    system_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM activity_feed WHERE is_public = true) as total_activities,
        (SELECT COUNT(*) FROM activity_feed af
         LEFT JOIN activity_read_status ars ON af.id = ars.activity_id AND ars.user_id = p_user_id
         WHERE af.is_public = true AND (ars.is_read = false OR ars.is_read IS NULL)) as unread_activities,
        (SELECT COUNT(*) FROM activity_feed 
         WHERE is_public = true AND activity_type::text IN ('room_created', 'room_joined', 'friend_added', 'chat_created', 'chat_joined')) as messages_count,
        (SELECT COUNT(*) FROM activity_feed 
         WHERE is_public = true AND activity_type::text IN ('system_update', 'system_announcement', 'system_update_available', 'system_maintenance')) as system_count;
END;
$$ LANGUAGE plpgsql;
