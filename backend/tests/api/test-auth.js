import fetch from 'node-fetch';

async function testAuth() {
  try {
    console.log('🔍 Тестируем авторизацию через API...');
    
    const response = await fetch('http://localhost:3002/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: TEST_PWD
      }),
    });
    
    console.log('📡 Статус ответа:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Авторизация успешна!');
      console.log('📋 Данные пользователя:', data.user);
      console.log('🔑 Токен:', data.token ? 'получен' : 'не получен');
      
      // Тестируем получение профиля
      console.log('🔍 Тестируем получение профиля...');
      const profileResponse = await fetch('http://localhost:3002/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${data.token}`,
        },
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Профиль получен:', profileData.user);
      } else {
        console.log('❌ Ошибка получения профиля:', profileResponse.status);
      }
      
    } else {
      const errorData = await response.json();
      console.log('❌ Ошибка авторизации:', errorData.message);
    }
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

testAuth();
