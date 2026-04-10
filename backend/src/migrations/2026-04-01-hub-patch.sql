-- Патч: таблица покупок паков маршрутов
-- Запуск: node backend/src/migrations/run-hub-patch.js

CREATE TABLE IF NOT EXISTS user_purchased_route_packs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id       UUID    NOT NULL REFERENCES route_pack_submissions(id) ON DELETE CASCADE,
  source        TEXT    NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'free', 'gift')),
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_urp_user ON user_purchased_route_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_urp_pack ON user_purchased_route_packs(pack_id);
