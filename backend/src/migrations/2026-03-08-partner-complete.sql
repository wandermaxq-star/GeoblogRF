-- Финальная миграция для полноты функционала партнёрской программы

-- дополняем partner_applications недостающими полями
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS about TEXT;

-- дополняем affiliate_events нужными полями для более точной статистики
ALTER TABLE affiliate_events
  ADD COLUMN IF NOT EXISTS commission_due NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- обновляем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_affiliate_events_referrer ON affiliate_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_referred_user ON affiliate_events(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_status ON affiliate_events(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_events_event_type ON affiliate_events(event_type);

-- индекс на user + event_type для проверки дублей
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_events_unique_signup
  ON affiliate_events(referred_user_id, event_type)
  WHERE event_type = 'signup';

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_events_unique_subscription
  ON affiliate_events(referred_user_id, event_type)
  WHERE event_type = 'first_subscription';
