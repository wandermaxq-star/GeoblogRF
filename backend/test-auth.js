// Тестовый скрипт для проверки логина и профиля
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';

async function test() {
  console.log('1. Тестируем логин...');
  
  // Логинимся с обновлёнными данными
  const loginRes = await fetch(`${API_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: 'alice@example.com', 
      password: 'password123' 
    })
  });
  
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login response:', JSON.stringify(loginData, null, 2));
  
  if (!loginData.token) {
    console.log('ERROR: No token received');
    return;
  }
  
  const token = loginData.token;
  console.log('\n2. Тестируем профиль с токеном...');
  
  const profileRes = await fetch(`${API_URL}/api/users/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Profile status:', profileRes.status);
  const profileData = await profileRes.json();
  console.log('Profile response:', JSON.stringify(profileData, null, 2));
}

test().catch(console.error);
