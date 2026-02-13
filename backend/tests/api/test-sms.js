import fetch from 'node-fetch';

async function testSMSVerification() {
  console.log('🧪 Тестирование SMS-верификации...\n');

  try {
    // 1. Тест регистрации
    console.log('1️⃣ Тестируем регистрацию...');
    const registerResponse = await fetch('http://localhost:3002/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test-sms-new@example.com',
        username: 'test-sms-user-new',
        password: TEST_PWD,
        phone: '+79991234568',
        first_name: 'Тест',
        last_name: 'SMS'
      }),
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      console.error('❌ Ошибка регистрации:', error);
      return;
    }

    const registerData = await registerResponse.json();
    console.log('✅ Регистрация успешна:', registerData.message);
    console.log('📱 Требуется верификация SMS:', registerData.requiresVerification);
    console.log('👤 Пользователь:', registerData.user.username, registerData.user.phone);

    // 2. Тест повторной отправки SMS
    console.log('\n2️⃣ Тестируем повторную отправку SMS...');
    const resendResponse = await fetch('http://localhost:3002/api/users/resend-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '+79991234568'
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('❌ Ошибка повторной отправки:', error);
    } else {
      const resendData = await resendResponse.json();
      console.log('✅ SMS отправлен повторно:', resendData.message);
    }

    // 3. Тест верификации SMS (с неверным кодом)
    console.log('\n3️⃣ Тестируем верификацию SMS (неверный код)...');
    const verifyResponse = await fetch('http://localhost:3002/api/users/verify-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '+79991234568',
        code: '000000'
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      console.log('✅ Неверный код отклонен:', error.message);
    } else {
      console.log('❌ Неверный код принят (это ошибка!)');
    }

    // 4. Тест восстановления пароля
    console.log('\n4️⃣ Тестируем восстановление пароля...');
    const resetResponse = await fetch('http://localhost:3002/api/users/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '+79991234568'
      }),
    });

    if (!resetResponse.ok) {
      const error = await resetResponse.text();
      console.error('❌ Ошибка запроса восстановления:', error);
    } else {
      const resetData = await resetResponse.json();
      console.log('✅ Запрос восстановления отправлен:', resetData.message);
    }

    console.log('\n🎉 Все тесты SMS-верификации завершены!');
    console.log('\n📝 Проверьте логи сервера для SMS-кодов (в тестовом режиме)');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

testSMSVerification();
