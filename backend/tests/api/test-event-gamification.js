import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3002';

async function testEventGamification() {
  console.log('=== Тестирование системы геймификации событий ===');

  try {
    // 1. Создаем тестового пользователя (если нужно)
    console.log('1. Создание пользователя для теста...');
    
    const userData = {
      username: 'gamification_test_user',
      email: 'gamification_test@test.com',
      password: TEST_PWD
    };

    const userResponse = await fetch(`${API_BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (userResponse.status === 409) {
      console.log('   Пользователь уже существует, используем существующие данные...');
      // Попытаемся войти
      const loginResponse = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password
        })
      });
      
      if (!loginResponse.ok) {
        throw new Error(`Ошибка входа: ${loginResponse.status}`);
      }
      
      const loginResult = await loginResponse.json();
      var token = loginResult.token;
    } else if (!userResponse.ok) {
      const errorData = await userResponse.json();
      throw new Error(`Ошибка создания пользователя: ${errorData.message}`);
    } else {
      const userResult = await userResponse.json();
      var token = userResult.token;
    }

    console.log('   ✓ Пользователь готов');

    // 2. Создаем тестовое событие
    console.log('2. Создание тестового события...');
    
    const eventData = {
      title: 'Тест геймификации событий',
      description: 'Это тестовое событие для проверки системы геймификации и начисления очков за полноту заполнения.',
      start_datetime: new Date(Date.now() + 7*24*60*60*1000).toISOString(), // через неделю
      end_datetime: new Date(Date.now() + 7*24*60*60*1000 + 60*60*1000).toISOString(), // через неделю + час
      location: 'Тестовое место',
      category: 'cultural',
      photo_urls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      hashtags: ['тест', 'геймификация', 'события'],
      organizer: 'Тестовый организатор',
      latitude: 55.7558,
      longitude: 37.6176,
      is_public: true
    };

    const eventResponse = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(eventData)
    });

    if (!eventResponse.ok) {
      const errorData = await eventResponse.json();
      throw new Error(`Ошибка создания события: ${errorData.message}`);
    }

    const eventResult = await eventResponse.json();
    const eventId = eventResult.id;
    console.log(`   ✓ Событие создано с ID: ${eventId}`);

    // 3. Проверяем полноту события
    console.log('3. Проверка полноты события...');
    
    const completenessResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}/completeness`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!completenessResponse.ok) {
      const errorData = await completenessResponse.json();
      throw new Error(`Ошибка получения полноты: ${errorData.message}`);
    }

    const completenessResult = await completenessResponse.json();
    console.log(`   ✓ Полнота: ${completenessResult.data.completeness.score}% (${completenessResult.data.completeness.status})`);

    // 4. Начисляем очки
    console.log('4. Начисление очков...');
    
    const pointsResponse = await fetch(`${API_BASE_URL}/api/events/${eventId}/award-points`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (!pointsResponse.ok) {
      const errorData = await pointsResponse.json();
      throw new Error(`Ошибка начисления очков: ${errorData.message}`);
    }

    const pointsResult = await pointsResponse.json();
    console.log(`   ✓ Очки начислены: ${pointsResult.data.points.totalPoints} очков`);

    // 5. Проверяем состояние пользователя
    console.log('5. Проверка состояния пользователя...');
    
    const profileResponse = await fetch(`${API_BASE_URL}/api/users/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResponse.ok) {
      const profileResult = await profileResponse.json();
      console.log(`   ✓ Баланс очков пользователя: ${profileResult.user?.rating_points || 0}`);
    }

    console.log('\n=== Все тесты прошли успешно! ===');
    console.log(`Событие ID: ${eventId}`);
    console.log(`Используйте этот ID для тестирования в frontend: (window as any).__lastCreatedEventId = '${eventId}';`);

  } catch (error) {
    console.error('Ошибка тестирования:', error.message);
  }
}

testEventGamification();
