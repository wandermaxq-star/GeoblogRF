import http from 'http';

const postData = JSON.stringify({
  email: 'Testuser@example.com',
  password: TEST_PWD
});

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
  }`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    });
});

req.on('error', (e) => {
  });

req.write(postData);
req.end(); 