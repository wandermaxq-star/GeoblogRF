-- ============================================================
-- Миграция: Route Pack Builder — финальный раздел проекта
-- Создано: апрель 2026
-- ============================================================

-- ============================================================
-- 1. Основная таблица заявок на публикацию паков
-- ============================================================
CREATE TABLE IF NOT EXISTS route_pack_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Мета-данные пака (заполняет автор в RoutePackageBuilder)
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  route_kind TEXT NOT NULL DEFAULT 'regional',
  tags TEXT[] DEFAULT '{}',
  highlight TEXT DEFAULT '',
  hero_metric TEXT DEFAULT '',

  -- Маршрут из Planner (polyline + waypoints в JSONB)
  polyline JSONB NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]',
  distance_meters INTEGER,
  duration_seconds INTEGER,

  -- Варианты поездки (минимум 1)
  variants JSONB NOT NULL DEFAULT '[]',

  -- Монетизация
  price INTEGER NOT NULL DEFAULT 0,
  is_exclusive BOOLEAN DEFAULT FALSE,

  -- Статус модерации
  status TEXT NOT NULL DEFAULT 'pending',
  moderation_comment TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMP,

  -- Статистика (накапливается после публикации)
  download_count INTEGER NOT NULL DEFAULT 0,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,

  -- Тайловый пак
  tile_pack_ready BOOLEAN NOT NULL DEFAULT FALSE,
  tile_pack_url TEXT,
  tile_pack_size_mb NUMERIC(8,2),

  CONSTRAINT chk_rps_status CHECK (status IN ('pending','approved','rejected','revision')),
  CONSTRAINT chk_rps_route_kind CHECK (route_kind IN ('federal','regional','event')),
  CONSTRAINT chk_rps_price CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rps_author     ON route_pack_submissions(author_id);
CREATE INDEX IF NOT EXISTS idx_rps_status     ON route_pack_submissions(status);
CREATE INDEX IF NOT EXISTS idx_rps_submitted  ON route_pack_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rps_published  ON route_pack_submissions(published_at DESC)
  WHERE status = 'approved';

-- ============================================================
-- 2. Рейтинги паков (лайк / дизлайк + опциональный отзыв)
-- ============================================================
CREATE TABLE IF NOT EXISTS route_pack_ratings (
  id SERIAL PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES route_pack_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  review TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_route_pack_ratings UNIQUE(pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rpr_pack ON route_pack_ratings(pack_id);
CREATE INDEX IF NOT EXISTS idx_rpr_user ON route_pack_ratings(user_id);

-- ============================================================
-- 3. Заработок авторов (история выплат за проданные паки)
-- ============================================================
CREATE TABLE IF NOT EXISTS author_earnings (
  id SERIAL PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id   UUID NOT NULL REFERENCES route_pack_submissions(id) ON DELETE CASCADE,
  buyer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gross_amount  INTEGER NOT NULL,   -- полная цена покупки (руб.)
  author_share  INTEGER NOT NULL,   -- доля автора (70%)
  platform_fee  INTEGER NOT NULL,   -- комиссия платформы (30%)
  earned_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_out      BOOLEAN NOT NULL DEFAULT FALSE,
  paid_out_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ae_author ON author_earnings(author_id);
CREATE INDEX IF NOT EXISTS idx_ae_pack   ON author_earnings(pack_id);
CREATE INDEX IF NOT EXISTS idx_ae_unpaid ON author_earnings(author_id, paid_out)
  WHERE paid_out = FALSE;

-- ============================================================
-- 4. Расширение таблицы users (авторские поля)
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pack_author         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS author_bio             TEXT,
  ADD COLUMN IF NOT EXISTS author_packs_published INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_total_earnings  INTEGER NOT NULL DEFAULT 0;
