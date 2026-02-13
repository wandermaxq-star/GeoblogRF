// Быстрая проверка подключения
console.log('Проверяем подключение к БД...');

import('./db.js').then(async (dbModule) => {
  const pool = dbModule.default;
  
  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ База данных работает:', result.rows[0].version);
    
    console.log('\nПроверяем таблицу событий...');
    const eventsResult = await pool.query('SELECT COUNT(*) FROM events');
    console.log('✅ Событий в базе:', eventsResult.rows[0].count);
    
    console.log('\nПроверяем utility функции...');
    const { calculateEventCompleteness, computeEventPoints } = await import('./src/utils/eventCompleteness.js');
    console.log('✅ Утилиты импортированы');
    
    // Тестируем функцию на реальном событии
    const eventResult = await pool.query('SELECT * FROM events LIMIT 1');
    if (eventResult.rows.length > 0) {
      const event = eventResult.rows[0];
      const completeness = calculateEventCompleteness(event);
      const points = computeEventPoints(event, completeness);
      console.log('\n✅ Тестовое событие:', event.title);
      console.log('Полнота:', completeness.score + '%', '(' + completeness.status + ')');
      console.log('Очки:', points.totalPoints + ' (базовые: ' + points.basePoints + ', бонус: ' + points.attachmentPoints + ')');
    } else {
      console.log('❌ Нет событий для тестирования');
    }
    
  } catch (error) {
    console.error('❌ Ошибка БД:', error.message);
  }
}).catch(error => {
  console.error('❌ Ошибка подключения:', error.message);
});
