import pool from './db.js';

async function checkActivityTables() {
  try {
    console.log('🔍 Проверяем таблицы системы активности...\n');
    
    const tables = ['activity_read_status', 'activity_privacy_settings'];
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        console.log(`✅ ${table}: существует (${result.rows[0].count} записей)`);
      } catch (err) {
        console.log(`❌ ${table}: НЕ существует`);
        console.log(`   Ошибка: ${err.message}\n`);
        
        // Создаем недостающие таблицы
        if (table === 'activity_read_status') {
          console.log('🔧 Создаем таблицу activity_read_status...');
          try {
            await pool.query(`
              CREATE TABLE activity_read_status (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, activity_id)
              )
            `);
            console.log('✅ Таблица activity_read_status создана');
          } catch (createErr) {
            console.log(`❌ Ошибка создания activity_read_status: ${createErr.message}`);
          }
        }
        
        if (table === 'activity_privacy_settings') {
          console.log('🔧 Создаем таблицу activity_privacy_settings...');
          try {
            await pool.query(`
              CREATE TABLE activity_privacy_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                room_created_visibility VARCHAR(20) DEFAULT 'public',
                room_joined_visibility VARCHAR(20) DEFAULT 'public',
                post_created_visibility VARCHAR(20) DEFAULT 'public',
                post_published_visibility VARCHAR(20) DEFAULT 'public',
                marker_created_visibility VARCHAR(20) DEFAULT 'public',
                route_created_visibility VARCHAR(20) DEFAULT 'public',
                route_shared_visibility VARCHAR(20) DEFAULT 'public',
                event_created_visibility VARCHAR(20) DEFAULT 'public',
                event_joined_visibility VARCHAR(20) DEFAULT 'public',
                achievement_earned_visibility VARCHAR(20) DEFAULT 'public',
                level_up_visibility VARCHAR(20) DEFAULT 'public',
                challenge_completed_visibility VARCHAR(20) DEFAULT 'public',
                profile_updated_visibility VARCHAR(20) DEFAULT 'public',
                friend_added_visibility VARCHAR(20) DEFAULT 'public',
                email_notifications BOOLEAN DEFAULT true,
                push_notifications BOOLEAN DEFAULT true,
                in_app_notifications BOOLEAN DEFAULT true,
                show_activity_duration BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
              )
            `);
            console.log('✅ Таблица activity_privacy_settings создана');
          } catch (createErr) {
            console.log(`❌ Ошибка создания activity_privacy_settings: ${createErr.message}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkActivityTables();
