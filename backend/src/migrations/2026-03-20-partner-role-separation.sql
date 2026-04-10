-- ============================================================
-- Миграция: разделение Simple User и Pro Guide
-- Дата: 2026-03-20
-- ============================================================

-- 1. Добавляем partner_role в таблицу users
--    simple   — активный автор (без реферальной ссылки)
--    pro_guide — профессиональный гид (с реферальной ссылкой)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS partner_role VARCHAR(20) DEFAULT NULL
    CHECK (partner_role IN ('simple', 'pro_guide'));

-- 2. Добавляем флаг разрешения на pro_guide
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro_guide_allowed BOOLEAN DEFAULT FALSE;

-- 3. Мигрируем существующие данные:
--    partner_status = 'partner' → partner_role = 'simple'
--    partner_status = 'pro_guide' → partner_role = 'pro_guide'
UPDATE users
SET partner_role = 'simple'
WHERE partner_status = 'partner' AND partner_role IS NULL;

UPDATE users
SET partner_role = 'pro_guide', is_pro_guide_allowed = TRUE
WHERE partner_status = 'pro_guide' AND partner_role IS NULL;

-- 4. Обновляем partner_status для соответствия новой модели:
--    none → none (без изменений)
--    pending → pending (без изменений)
--    partner → заменяется на simple/ambassador/expert в зависимости от прогресса
--    pro_guide → pro_guide (без изменений)

-- 5. Индекс для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_users_partner_role ON users(partner_role);

-- ============================================================
-- Новая модель статусов:
--
-- partner_status (внешний статус для UI):
--   none       — не партнёр
--   pending    — заявка на рассмотрении
--   novice     — новичок (simple, начальный уровень)
--   ambassador — амбассадор (simple, средний уровень)
--   expert     — про-эксперт (simple, максимальный уровень)
--   pro_guide  — профессиональный гид
--
-- partner_role (внутренняя роль для логики):
--   simple     — активный автор (НЕТ referral_code)
--   pro_guide  — профессиональный гид (ЕСТЬ referral_code)
-- ============================================================

-- 6. Расширяем CHECK constraint для partner_status
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_partner_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_partner_status_check
  CHECK (partner_status IN ('none', 'pending', 'novice', 'ambassador', 'expert', 'pro_guide'));

-- 7. Обновляем существующих партнёров на основе их прогресса
--    Это будет сделано через API при следующем запросе прогресса
