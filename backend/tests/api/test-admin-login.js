import http from 'http';
import { ADMIN_PWD } from '../test-credentials.js';

// Тестируем вход с новым простым пользователем
const testData = {
  email: 'admin@test.com',
  password: ADMIN_PWD
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/users/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Origin': 'http://localhost:5173',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

}`);
const req = http.request(options, (res) => {
  Object.keys(res.headers).forEach(key => {
    });
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      );
      
      if (res.statusCode === 200) {
        // Тестируем получение профиля
        testProfile(response.token);
      } else {
        }
    } catch (error) {
      }
  });
});

req.on('error', (e) => {
  });

req.write(postData);
req.end();

// Функция для тестирования получения профиля
function testProfile(token) {
  const profileOptions = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/users/profile',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const profileReq = http.request(profileOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (res.statusCode === 200) {
          );
        } else {
          }
      } catch (error) {
        }
    });
  });

  profileReq.on('error', (e) => {
    });

  profileReq.end();
} 