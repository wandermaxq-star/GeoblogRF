import fetch from 'node-fetch';

async function simpleTest() {
  try {
    console.log('🔍 Простой тест авторизации...');
    
    const response = await fetch('http://localhost:3002/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      }),
    });
    
    console.log('📡 Статус:', response.status);
    console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('📡 Ответ:', text);
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('✅ Успех!');
      console.log('👤 Пользователь:', data.user);
      console.log('🔑 Токен получен:', !!data.token);
    } else {
      console.log('❌ Ошибка:', response.status);
    }
    
  } catch (err) {
    console.error('❌ Исключение:', err.message);
  }
}

simpleTest();