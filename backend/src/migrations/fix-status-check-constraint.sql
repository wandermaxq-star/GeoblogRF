-- Миграция: добавить 'revision' в CHECK constraint для статуса модерации
-- Нужна для корректной работы "Отправить на доработку"

-- Удаляем старые CHECK constraints и создаём новые с поддержкой 'revision'

-- POSTS
DO $$ BEGIN
  -- Удаляем существующий CHECK (если есть)
  ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
  -- Создаём новый с 'revision'
  ALTER TABLE posts ADD CONSTRAINT posts_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'posts: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;

-- TRAVEL_ROUTES
DO $$ BEGIN
  ALTER TABLE travel_routes DROP CONSTRAINT IF EXISTS travel_routes_status_check;
  ALTER TABLE travel_routes ADD CONSTRAINT travel_routes_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'travel_routes: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;

-- MAP_MARKERS
DO $$ BEGIN
  ALTER TABLE map_markers DROP CONSTRAINT IF EXISTS map_markers_status_check;
  ALTER TABLE map_markers ADD CONSTRAINT map_markers_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'map_markers: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;

-- EVENTS
DO $$ BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
  ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'events: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;

-- BLOG_POSTS
DO $$ BEGIN
  ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_status_check;
  ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'blog_posts: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;

-- COMMENTS
DO $$ BEGIN
  ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_status_check;
  ALTER TABLE comments ADD CONSTRAINT comments_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'hidden', 'draft', 'revision'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'comments: не удалось обновить CHECK constraint: %', SQLERRM;
END $$;
