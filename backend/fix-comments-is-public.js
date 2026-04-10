#!/usr/bin/env node
/**
 * 🔧 Скрипт для исправления is_public для существующих одобренных комментариев
 */

import pool from './db.js';
import logger from './logger.js';

async function fixCommentVisibility() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Устанавливаем is_public=true для всех активных комментариев
    const updateComments = await client.query(`
      UPDATE comments
      SET is_public = true
      WHERE status = 'active' AND is_public = false;
    `);

    logger.info(`✅ Исправлены комментарии: ${updateComments.rowCount} шт (is_public=false → true)`);

    // 2. Пересчитываем счётчики для всех постов
    const updatePosts = await client.query(`
      UPDATE posts
      SET comments_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE post_id = posts.id
          AND status = 'active'
          AND is_public = true
      )
      WHERE status = 'active';
    `);

    logger.info(`✅ Переподсчитаны посты: ${updatePosts.rowCount} шт`);

    // 3. Статистика
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

    logger.info(`\n📊 Финальная статистика:`);
    logger.info(`   Постов: ${stats.rows[0].total_posts}`);
    logger.info(`   Всего комментариев: ${stats.rows[0].total_comments}`);
    logger.info(`   Среднее на пост: ${stats.rows[0].avg_comments_per_post}`);
    logger.info(`   Макс на посте: ${stats.rows[0].max_comments}`);

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('❌ Ошибка:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCommentVisibility();
