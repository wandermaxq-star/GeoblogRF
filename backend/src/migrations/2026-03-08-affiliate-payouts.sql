-- Миграция для таблиц выплат партнёрам и заявок

-- дополняем affiliate_events столбцами для комиссии и статуса
ALTER TABLE affiliate_events
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- таблица выплат по периодам
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id SERIAL PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'calculated', -- calculated|sent|paid
  created_at TIMESTAMP DEFAULT NOW()
);

-- индекс для быстрого поиска по партнёру и статусу
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_referrer ON affiliate_payouts(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

-- таблица заявок на партнёрство
CREATE TABLE IF NOT EXISTS partner_applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'new', -- new|approved|rejected
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
