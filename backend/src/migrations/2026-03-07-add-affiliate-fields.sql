-- добавляем поля для партнёрской программы

ALTER TABLE users
  ADD COLUMN referral_code VARCHAR(8) UNIQUE,
  ADD COLUMN referred_by UUID REFERENCES users(id);

-- таблица событий рефералов
CREATE TABLE IF NOT EXISTS affiliate_events (
  id SERIAL PRIMARY KEY,
  referred_user_id UUID NOT NULL REFERENCES users(id),
  referrer_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  amount NUMERIC(10,2),
  commission_due NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- индекс для быстрого поиска по рефереру
CREATE INDEX ON affiliate_events(referrer_id);
CREATE INDEX ON affiliate_events(status);
