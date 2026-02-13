import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3002/api';

// Тестовые данные для входа (используем созданного тестового пользователя)
const testUser = {
  email: 'testapi@example.com',
  password: TEST_PWD
};

async function testAPIEndpoints() {
  try {
    console.log('🧪 Тестируем API endpoints...\n');
    
    // 1. Попробуем войти в систему
    console.log('1️⃣ Тестируем авторизацию...');
    const loginResponse = await fetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });
    
    if (!loginResponse.ok) {
      console.log(`❌ Авторизация не удалась: ${loginResponse.status}`);
      console.log('ℹ️ Создаем тестового пользователя...');
      
      // Попробуем создать пользователя
      const registerResponse = await fetch(`${BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...testUser,
          username: 'testuser'
        })
      });
      
      if (!registerResponse.ok) {
        console.log(`❌ Регистрация не удалась: ${registerResponse.status}`);
        return;
      }
      
      console.log('✅ Тестовый пользователь создан');
      
      // Повторяем вход
      const loginResponse2 = await fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testUser)
      });
      
      if (!loginResponse2.ok) {
        console.log(`❌ Повторная авторизация не удалась: ${loginResponse2.status}`);
        return;
      }
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (!token) {
      console.log('❌ Токен не получен');
      return;
    }
    
    console.log('✅ Авторизация успешна\n');
    
    // 2. Тестируем /api/routes
    console.log('2️⃣ Тестируем /api/routes...');
    const routesResponse = await fetch(`${BASE_URL}/routes`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (routesResponse.ok) {
      const routes = await routesResponse.json();
      console.log(`✅ /api/routes работает (найдено ${routes.length} маршрутов)`);
    } else {
      console.log(`❌ /api/routes ошибка: ${routesResponse.status}`);
      const errorText = await routesResponse.text();
      console.log(`   Детали: ${errorText}`);
    }
    
    // 3. Тестируем /api/activity
    console.log('3️⃣ Тестируем /api/activity...');
    const activityResponse = await fetch(`${BASE_URL}/activity`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (activityResponse.ok) {
      const activity = await activityResponse.json();
      console.log(`✅ /api/activity работает (найдено ${activity.length} активностей)`);
    } else {
      console.log(`❌ /api/activity ошибка: ${activityResponse.status}`);
      const errorText = await activityResponse.text();
      console.log(`   Детали: ${errorText}`);
    }
    
    // 4. Тестируем /api/markers
    console.log('4️⃣ Тестируем /api/markers...');
    const markersResponse = await fetch(`${BASE_URL}/markers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (markersResponse.ok) {
      const markers = await markersResponse.json();
      console.log(`✅ /api/markers работает (найдено ${markers.length} меток)`);
    } else {
      console.log(`❌ /api/markers ошибка: ${markersResponse.status}`);
      const errorText = await markersResponse.text();
      console.log(`   Детали: ${errorText}`);
    }
    
    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

testAPIEndpoints();
