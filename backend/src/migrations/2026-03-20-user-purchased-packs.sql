-- Миграция: таблица покупок curated-паков пользователя

CREATE TABLE IF NOT EXISTS user_purchased_route_packs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'direct', -- direct|guide-offer|admin
  UNIQUE (user_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_user_purchased_route_packs_user ON user_purchased_route_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchased_route_packs_pack ON user_purchased_route_packs(pack_id);
