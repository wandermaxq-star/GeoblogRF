import pool from '../../db.js';
// SONAR-AUTO-FIX (javascript:S1128): original: // SONAR-AUTO-FIX (javascript:S1128): original: import { requireRole } from '../middleware/auth.js';

/**
 * Единый контроллер модерации для всех типов контента
 */

// Получить контент на модерации по типу
// ⚠️ ВАЖНО: Показывает только контент БЕЗ ИИ-анализа (для ручной модерации)
// Контент с ИИ-анализом должен обрабатываться через ИИ-помощника
export const getPendingContent = async (req, res) => {
  try {
    const { contentType } = req.params; // events, posts, routes, markers, blogs, comments, chats
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let query;
    let tableName;

    switch (contentType) {
      case 'events':
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'events';
        query = `
          SELECT e.*, u.username as creator_name 
          FROM events e 
          LEFT JOIN users u ON e.creator_id = u.id 
          WHERE e.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd 
              WHERE amd.content_type = 'events' 
                AND amd.content_id::text = e.id::text
            )
          ORDER BY e.created_at DESC
        `;
        break;
      
      case 'posts':
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'posts';
        query = `
          SELECT p.*, u.username as creator_name 
          FROM posts p 
          LEFT JOIN users u ON p.author_id::text = u.id::text 
          WHERE p.status = 'pending'
            AND (
              -- Показываем посты БЕЗ ИИ-решения (для ручной модерации)
              NOT EXISTS (
                SELECT 1 FROM ai_moderation_decisions amd 
                WHERE amd.content_type = 'posts' 
                  AND amd.content_id::text = p.id::text
              )
              -- ИЛИ посты с ИИ-решением, но где админ ещё не поставил вердикт
              OR EXISTS (
                SELECT 1 FROM ai_moderation_decisions amd 
                WHERE amd.content_type = 'posts' 
                  AND amd.content_id::text = p.id::text
                  AND amd.admin_verdict = 'pending'
              )
            )
          ORDER BY p.created_at DESC
        `;
        break;
      
      case 'routes':
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'travel_routes';
        query = `
          SELECT r.*, u.username as creator_name 
          FROM travel_routes r 
          LEFT JOIN users u ON r.creator_id = u.id 
          WHERE r.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd 
              WHERE amd.content_type = 'routes' 
                AND amd.content_id::text = r.id::text
            )
          ORDER BY r.created_at DESC
        `;
        break;
      
      case 'markers':
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'map_markers';
        query = `
          SELECT m.*, u.username as creator_name 
          FROM map_markers m 
          LEFT JOIN users u ON m.creator_id = u.id 
          WHERE m.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd 
              WHERE amd.content_type = 'markers' 
                AND amd.content_id::text = m.id::text
            )
          ORDER BY m.created_at DESC
        `;
        break;
      
      // Legacy 'blogs' removed — blogs migrated to posts and are handled by the 'posts' case above.
      // case 'blogs': removed.
      
      case 'comments':
        // Проверяем наличие таблицы
        const commentsTableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'comments'
          )
        `);
        if (!commentsTableExists.rows[0].exists) {
          return res.json([]);
        }
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'comments';
        query = `
          SELECT c.*, u.username as creator_name 
          FROM comments c 
          LEFT JOIN users u ON c.author_id = u.id 
          WHERE c.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd 
              WHERE amd.content_type = 'comments' 
                AND amd.content_id::text = c.id::text
            )
          ORDER BY c.created_at DESC
        `;
        break;
      
      case 'chats':
        // Проверяем наличие таблицы
        const chatsTableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'chat_messages'
          )
        `);
        if (!chatsTableExists.rows[0].exists) {
          return res.json([]);
        }
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1854): original:         tableName = 'chat_messages';
        query = `
          SELECT m.*, u.username as creator_name 
          FROM chat_messages m 
          LEFT JOIN users u ON m.user_id = u.id 
          WHERE m.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM ai_moderation_decisions amd 
              WHERE amd.content_type = 'chats' 
                AND amd.content_id::text = m.id::text
            )
          ORDER BY m.created_at DESC
        `;
        break;
      
      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error(`Ошибка получения контента на модерации (${req.params.contentType}):`, error);
    res.status(500).json({ message: 'Ошибка сервера при получении контента на модерации.' });
  }
};

// Одобрить контент
export const approveContent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { contentType, id } = req.params;
    const adminId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [adminId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tableName;
    let idColumn = 'id';
    let authorIdColumn;

    switch (contentType) {
      case 'events':
        tableName = 'events';
        authorIdColumn = 'creator_id';
        break;
      case 'posts':
        tableName = 'posts';
        authorIdColumn = 'author_id';
        break;
      case 'routes':
        tableName = 'travel_routes';
        authorIdColumn = 'creator_id';
        break;
      case 'markers':
        tableName = 'map_markers';
        authorIdColumn = 'creator_id';
        break;
      // Legacy 'blogs' support removed — handled via 'posts' case above.
      case 'comments':
        tableName = 'comments';
        authorIdColumn = 'user_id';
        break;
      case 'chats':
        tableName = 'chat_messages';
        authorIdColumn = 'user_id';
        break;
      default:
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    // Для posts id может быть строкой
    if (contentType === 'posts') {
      idColumn = 'id';
    }

    // Получаем контент перед обновлением
    const contentResult = await client.query(
      `SELECT * FROM ${tableName} WHERE ${idColumn}::text = $1`,
      [id]
    );

    if (contentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Контент не найден.' });
    }

    const content = contentResult.rows[0];
    const authorId = content[authorIdColumn];

    // Обновляем статус контента
    const result = await client.query(
      `UPDATE ${tableName} 
       SET status = 'active', 
           is_public = COALESCE(is_public, true),
           moderated_at = NOW(),
           moderated_by = $1,
           updated_at = NOW()
       WHERE ${idColumn}::text = $2
       RETURNING *`,
      [adminId, id]
    );

    // Маппинг типов контента на источники XP
    const xpSourceMap = {
      'events': 'event_created',
      'event': 'event_created',
      'posts': 'post_created',
      'post': 'post_created',
      'routes': 'route_created',
      'route': 'route_created',
      'markers': 'marker_created',
      'marker': 'marker_created',
      'comments': 'comment_created',
      'comment': 'comment_created',
      'chats': 'chat_created',
      'chat': 'chat_created'
    };

    const xpSource = xpSourceMap[contentType];
    let xpResult = null;

    // Начисляем XP автору, если он есть и это не админ
    if (authorId && xpSource) {
      // Проверяем, не начисляли ли уже XP за этот контент
      const existingAction = await client.query(
        `SELECT id FROM gamification_actions 
         WHERE user_id = $1 AND source = $2 AND content_id = $3`,
        [authorId, xpSource, id]
      );

      if (existingAction.rows.length === 0) {
        // Рассчитываем базовый XP (поддерживаем оба формата: 'events' и 'event')
        const contentTypeKey = contentType.endsWith('s') ? contentType : contentType + 's';
        const baseXP = {
          'events': 50,
          'posts': 50,
          'routes': 100,
          'markers': 30,
          'comments': 10,
          'chats': 5
        }[contentTypeKey] || {
          'event': 50,
          'post': 50,
          'route': 100,
          'marker': 30,
          'comment': 10,
          'chat': 5
        }[contentType] || 50;

        // Бонусы за качество
        let bonusXP = 0;
        if (content.photo_urls || content.cover_image_url || content.image_url) {
          bonusXP += 25; // За фото
        }
        if (content.description || content.body || content.content) {
          const desc = content.description || content.body || content.content || '';
          if (desc.length > 50) bonusXP += 15; // За описание
        }
        if (content.location || content.address || (content.latitude && content.longitude)) {
          bonusXP += 20; // За локацию
        }
        if (content.hashtags || content.tags) {
          bonusXP += 10; // За теги
        }

        const totalXP = baseXP + bonusXP;

        // Начисляем XP напрямую через логику геймификации
        try {
          // Проверяем уникальность действия
          const existingAction = await client.query(
            `SELECT id FROM gamification_actions 
             WHERE user_id = $1 AND source = $2 AND content_id = $3`,
            [authorId, xpSource, id]
          );

          if (existingAction.rows.length === 0) {
            // Получаем текущий уровень
            let levelResult = await client.query(
              'SELECT * FROM user_levels WHERE user_id = $1',
              [authorId]
            );

            if (levelResult.rows.length === 0) {
              // Создаём начальный уровень
              await client.query(
                `INSERT INTO user_levels (user_id, total_xp, current_level, current_level_xp, required_xp, rank)
                 VALUES ($1, 0, 1, 0, 100, 'novice')`,
                [authorId]
              );
              levelResult = await client.query(
                'SELECT * FROM user_levels WHERE user_id = $1',
                [authorId]
              );
            }

            const currentLevel = levelResult.rows[0];
            const newTotalXP = currentLevel.total_xp + totalXP;

            // Рассчитываем новый уровень
            const { calculateLevelFromTotalXP } = await import('../utils/xpCalculator.js');
            const newLevelData = calculateLevelFromTotalXP(newTotalXP);

            // Обновляем уровень пользователя
            await client.query(
              `UPDATE user_levels 
               SET total_xp = $1, current_level = $2, current_level_xp = $3, 
                   required_xp = $4, rank = $5, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $6`,
              [
                newTotalXP,
                newLevelData.level,
                newLevelData.currentLevelXP,
                newLevelData.requiredXP,
                newLevelData.rank,
                authorId
              ]
            );

            // Записываем в историю XP
            await client.query(
              `INSERT INTO xp_history (user_id, source, amount, content_id, content_type, metadata)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                authorId,
                xpSource,
                totalXP,
                id,
                contentType,
                JSON.stringify({
                  title: content.title,
                  hasPhoto: !!(content.photo_urls || content.cover_image_url),
                  moderated: true,
                  baseXP,
                  bonusXP
                })
              ]
            );

            // Записываем действие для проверки уникальности
            await client.query(
              `INSERT INTO gamification_actions (user_id, source, amount, content_id, content_type, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (user_id, source, content_id) DO NOTHING`,
              [
                authorId,
                xpSource,
                totalXP,
                id,
                contentType,
                JSON.stringify({
                  title: content.title,
                  hasPhoto: !!(content.photo_urls || content.cover_image_url),
                  moderated: true
                })
              ]
            );

            xpResult = {
              success: true,
              newLevel: newLevelData.level,
              levelUp: newLevelData.level > currentLevel.current_level,
              totalXP: newTotalXP,
              currentLevelXP: newLevelData.currentLevelXP,
              requiredXP: newLevelData.requiredXP,
              xpAmount: totalXP
            };
          } else {
            xpResult = {
              success: false,
              reason: 'already_awarded'
            };
          }
        } catch (xpError) {
          console.error('Ошибка начисления XP при одобрении контента:', xpError);
          // Не прерываем транзакцию, если XP не начислился
          xpResult = {
            success: false,
            error: xpError.message
          };
        }
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Контент ${contentType} ${id} одобрен админом ${adminId}`);
    if (xpResult) {
      console.log(`💰 XP начислено автору ${authorId}: ${xpResult.xpAmount} XP (уровень: ${xpResult.newLevel}, повышение: ${xpResult.levelUp ? 'да' : 'нет'})`);
    } else if (authorId) {
      console.log(`⚠️ XP не начислено автору ${authorId}: уже было начислено ранее`);
    } else {
      console.log(`⚠️ XP не начислено: нет автора (контент создан гостем)`);
    }

    res.json({ 
      message: 'Контент одобрен и опубликован.',
      content: result.rows[0],
      gamification: xpResult ? {
        xpAwarded: true,
        levelUp: xpResult.levelUp,
        newLevel: xpResult.newLevel,
        totalXP: xpResult.totalXP
      } : {
        xpAwarded: false,
        reason: authorId ? 'already_awarded' : 'no_author'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Ошибка одобрения контента (${req.params.contentType}):`, error);
    res.status(500).json({ message: 'Ошибка сервера при одобрении контента.' });
  } finally {
    client.release();
  }
};

// Отклонить контент
export const rejectContent = async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const { reason } = req.body || {};
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Необходимо указать причину отклонения.' });
    }

    let tableName;
    let idColumn = 'id';

    switch (contentType) {
      case 'events':
        tableName = 'events';
        break;
      case 'posts':
        tableName = 'posts';
        break;
      case 'routes':
        tableName = 'travel_routes';
        break;
      case 'markers':
        tableName = 'map_markers';
        break;
      case 'blogs':
        tableName = 'blog_posts';
        break;
      case 'comments':
        tableName = 'comments';
        break;
      case 'chats':
        tableName = 'chat_messages';
        break;
      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    // Для posts id может быть строкой
    if (contentType === 'posts') {
      idColumn = 'id';
    }

    // Получаем контент перед удалением (для логирования)
    const contentResult = await pool.query(
      `SELECT * FROM ${tableName} WHERE ${idColumn}::text = $1`,
      [id]
    );

    if (contentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Контент не найден.' });
    }

    // УДАЛЯЕМ контент из БД при отклонении (не сохраняем в БД)
    await pool.query(
      `DELETE FROM ${tableName} 
       WHERE ${idColumn}::text = $1
       RETURNING *`,
      [id]
    );

    console.log(`🗑️ Контент ${contentType} ${id} удален из БД после отклонения. Причина: ${reason}`);

    res.json({ 
      message: 'Контент отклонен и удален из базы данных.',
      deleted: true,
      reason: reason
    });
  } catch (error) {
    console.error(`Ошибка отклонения контента (${req.params.contentType}):`, error);
    res.status(500).json({ message: 'Ошибка сервера при отклонении контента.' });
  }
};

// Скрыть контент
export const hideContent = async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    let tableName;
    let idColumn = 'id';

    switch (contentType) {
      case 'events':
        tableName = 'events';
        break;
      case 'posts':
        tableName = 'posts';
        break;
      case 'routes':
        tableName = 'travel_routes';
        break;
      case 'markers':
        tableName = 'map_markers';
        break;
      case 'blogs':
        tableName = 'blog_posts';
        break;
      case 'comments':
        tableName = 'comments';
        break;
      case 'chats':
        tableName = 'chat_messages';
        break;
      default:
        return res.status(400).json({ message: 'Неверный тип контента.' });
    }

    const result = await pool.query(
      `UPDATE ${tableName} 
       SET status = 'hidden', 
           is_public = false,
           moderated_at = NOW(),
           moderated_by = $1,
           updated_at = NOW()
       WHERE ${idColumn} = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Контент не найден.' });
    }

    res.json({ 
      message: 'Контент скрыт.',
      content: result.rows[0]
    });
  } catch (error) {
    console.error(`Ошибка скрытия контента (${req.params.contentType}):`, error);
    res.status(500).json({ message: 'Ошибка сервера при скрытии контента.' });
  }
};

// Получить статистику модерации
export const getModerationStats = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    // Проверяем права администратора
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    // Получаем статистику по каждому типу контента
    const stats = {
      events: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      posts: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      routes: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      markers: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      blogs: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      comments: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      chats: { pending: 0, active: 0, rejected: 0, hidden: 0 },
      total: { pending: 0, active: 0, rejected: 0, hidden: 0 }
    };

    // События
    const eventsStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM events 
      GROUP BY status
    `);
    eventsStats.rows.forEach(row => {
      if (stats.events[row.status]) {
        stats.events[row.status] = parseInt(row.count);
        stats.total[row.status] += parseInt(row.count);
      }
    });

    // Посты
    const postsStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM posts 
      GROUP BY status
    `);
    postsStats.rows.forEach(row => {
      if (stats.posts[row.status]) {
        stats.posts[row.status] = parseInt(row.count);
        stats.total[row.status] += parseInt(row.count);
      }
    });

    // Маршруты
    const routesStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM travel_routes 
      GROUP BY status
    `);
    routesStats.rows.forEach(row => {
      if (stats.routes[row.status]) {
        stats.routes[row.status] = parseInt(row.count);
        stats.total[row.status] += parseInt(row.count);
      }
    });

    // Метки
    const markersStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM map_markers 
      GROUP BY status
    `);
    markersStats.rows.forEach(row => {
      if (stats.markers[row.status]) {
        stats.markers[row.status] = parseInt(row.count);
        stats.total[row.status] += parseInt(row.count);
      }
    });

    // Блоги
    const blogsStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM blog_posts 
      GROUP BY status
    `);
    blogsStats.rows.forEach(row => {
      if (stats.blogs[row.status]) {
        stats.blogs[row.status] = parseInt(row.count);
        stats.total[row.status] += parseInt(row.count);
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики модерации:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении статистики.' });
  }
};



