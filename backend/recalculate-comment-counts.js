#!/usr/bin/env node
/**
 * 🔧 Скрипт для переподсчета комментариев в скіччиках posts.comments_count
 * 
 * Применяет для всех постов:
 * comments_count = COUNT(comments WHERE post_id=$1 AND status='active' AND is_public=true)
 */

import pool from './db.js';
import logger from './logger.js';

async function recalculateCommentCounts() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Обновляем все посты с корректным количеством одобрённых видимых комментариев
    const updateQuery = `
      UPDATE posts
      SET comments_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE post_id = posts.id
          AND status = 'active'
          AND is_public = true
      )
      WHERE status = 'active';
    `;

    const result = await client.query(updateQuery);
    
    // Явно показываем поменьше статистики
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_posts,
        SUM(COALESCE(comments_count, 0)) as total_comments,
        AVG(COALESCE(comments_count, 0))::numeric(10,2) as avg_comments_per_post,
        MAX(COALESCE(comments_count, 0)) as max_comments
      FROM posts
      WHERE status = 'active';
    `);

    await client.query('COMMIT');

    logger.info(`✅ Переподсчёт завершён!`);
    logger.info(`   Обновлено постов: ${result.rowCount}`);
    logger.info(`   Статистика: ${JSON.stringify(stats.rows[0])}`);

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('❌ Ошибка переподсчета:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

recalculateCommentCounts();
