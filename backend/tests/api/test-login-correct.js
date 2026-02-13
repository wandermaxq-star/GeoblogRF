import http from 'http';
import { TEST_PWD } from '../test-credentials.js';

// Тестируем разные варианты данных для входа
const testCases = [
  {
    name: 'Testuser@example.com с test123',
    data: {
      email: 'Testuser@example.com',
      password: TEST_PWD
    }
  },
  {
    name: 'test@example.com с password123',
    data: {
      email: 'test@example.com',
      password: TEST_PWD
    }
  },
  {
    name: 'newuser@example.com (проверим)',
    data: {
      email: 'newuser@example.com',
      password: TEST_PWD
    }
  }
];

async function testLogin(testCase) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase.data);
    
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/users/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = JSON.parse(data);
        resolve({
          status: res.statusCode,
          success: res.statusCode === 200,
          response: response,
          testCase: testCase.name
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  for (const testCase of testCases) {
    try {
      const result = await testLogin(testCase);
      if (result.success) {
        } else {
        }
      } catch (error) {
      }
  }
}

runTests(); 