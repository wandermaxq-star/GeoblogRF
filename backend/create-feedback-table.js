import db from './db.js';

/**
 * Скрипт для создания таблицы feedback (жалоб и предложений)
 */

async function createFeedbackTable() {
  try {
    console.log('📋 Создаю таблицу feedback...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        type VARCHAR(20) NOT NULL CHECK (type IN ('complaint', 'suggestion')),
        category VARCHAR(20) NOT NULL CHECK (category IN ('content', 'bug', 'feature', 'other')),
        content_type VARCHAR(50),
        content_id UUID,
        content_title VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'resolved', 'dismissed')),
        priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        admin_id UUID,
        admin_response TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
      CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
    `);

    console.log('✅ Таблица feedback успешно создана!');
  } catch (err) {
    console.error('❌ Ошибка при создании таблицы feedback:', err);
    process.exit(1);
  }
}

createFeedbackTable().then(() => {
  console.log('✅ Готово!');
  process.exit(0);
});
