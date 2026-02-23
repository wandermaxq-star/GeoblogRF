-- Миграция: создание таблицы комментариев с поддержкой вложенных ответов и модерации
-- users.id = UUID, posts.id = BIGINT
-- Выполнить: psql -U postgres -d bestsite -f create_comments_table.sql

CREATE TABLE IF NOT EXISTS comments (
  id            SERIAL PRIMARY KEY,
  post_id       BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  parent_id     INTEGER REFERENCES comments(id) ON DELETE CASCADE,

  -- Статус модерации: pending → approved/rejected
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'rejected', 'revision')),
  is_public     BOOLEAN NOT NULL DEFAULT false,

  -- Лайки на комментарий
  likes_count   INTEGER NOT NULL DEFAULT 0,

  -- Служебные колонки модерации
  moderated_at  TIMESTAMP,
  moderated_by  UUID REFERENCES users(id),

  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_comments_post_id   ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id  ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id  ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_status     ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Лайки пользователей на комментарии
CREATE TABLE IF NOT EXISTS comment_likes (
  id         SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user    ON comment_likes(user_id);
