-- ============================================================
-- Миграция: системa статуса партнёра и прогресса
-- Дата: 2026-03-19
-- ============================================================

-- 1. Добавляем partner_status в таблицу users
--    none       — обычный пользователь
--    pending    — заявка подана, ждёт модерации
--    partner    — одобренный партнёр (Путь 1: из активных пользователей)
--    pro_guide  — Про-Гид (Путь 2: профессиональный гид, по приглашению)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS partner_status VARCHAR(20) NOT NULL DEFAULT 'none'
    CHECK (partner_status IN ('none', 'pending', 'partner', 'pro_guide'));

-- 2. Расширяем partner_applications для формы Про-Гида
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS application_type VARCHAR(20) NOT NULL DEFAULT 'organic'
    CHECK (application_type IN ('organic', 'pro_guide')),
  ADD COLUMN IF NOT EXISTS city          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS audience_url  TEXT,        -- соцсети / сайт
  ADD COLUMN IF NOT EXISTS experience_years SMALLINT,
  ADD COLUMN IF NOT EXISTS audience_size INTEGER,     -- подписчики/год
  ADD COLUMN IF NOT EXISTS current_formats TEXT,      -- какие форматы сейчас
  ADD COLUMN IF NOT EXISTS pack_ideas    TEXT,        -- идеи для паков
  ADD COLUMN IF NOT EXISTS has_partners  TEXT,        -- партнёры с бонусами
  ADD COLUMN IF NOT EXISTS motivation    TEXT,        -- почему хочет сотрудничать
  ADD COLUMN IF NOT EXISTS reviewer_id   UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT;

-- 3. Снимок прогресса пользователя при подаче заявки (органической)
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS routes_count    INTEGER,
  ADD COLUMN IF NOT EXISTS positive_votes  INTEGER,
  ADD COLUMN IF NOT EXISTS total_votes     INTEGER;

-- 4. Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_users_partner_status ON users(partner_status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_type ON partner_applications(application_type);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_user ON partner_applications(user_id);

-- 5. Обновляем статус у пользователей, чьи заявки уже одобрены
UPDATE users u
SET partner_status = 'partner'
FROM partner_applications pa
WHERE pa.user_id = u.id
  AND pa.status = 'approved'
  AND u.partner_status = 'none';

-- 6. Обновляем статус у пользователей с pending-заявками
UPDATE users u
SET partner_status = 'pending'
FROM partner_applications pa
WHERE pa.user_id = u.id
  AND pa.status = 'new'
  AND u.partner_status = 'none';

-- ============================================================
-- Требования для органического Пути 1:
--   - travel_routes с status='active' у пользователя >= 15
--   - суммарный счёт положительных голосов >= 20
--     (route_ratings WHERE vote=1, маршруты данного пользователя)
-- Эти условия проверяются в коде partnersProgressController.js
-- ============================================================
