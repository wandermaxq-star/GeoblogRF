import fetch from 'node-fetch';

async function testSMSSendLimits() {
  console.log('🧪 Тестируем систему лимитов SMS...\n');

  const testPhone = '+79991234599';

  try {
    // Тест 1: Первая отправка - должна пройти
    console.log('1️⃣ Первая отправка SMS...');
    let response = await fetch('http://localhost:3002/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'limit-test-1@example.com',
        username: 'limit-test-1',
        password: TEST_PWD,
        phone: testPhone,
        first_name: 'Тест',
        last_name: 'Лимитов'
      }),
    });

    if (response.ok) {
      console.log('✅ Первая отправка успешна');
    } else {
      const error = await response.json();
      console.log('❌ Ошибка:', error.message);
    }

    // Тест 2: Вторая отправка сразу - должна пройти
    console.log('\n2️⃣ Вторая отправка SMS...');
    response = await fetch('http://localhost:3002/api/users/resend-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    if (response.ok) {
      console.log('✅ Вторая отправка успешна');
    } else {
      const error = await response.json();
      console.log('❌ Ошибка:', error.message);
    }

    // Тест 3: Третья отправка сразу - должна пройти
    console.log('\n3️⃣ Третья отправка SMS...');
    response = await fetch('http://localhost:3002/api/users/resend-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    if (response.ok) {
      console.log('✅ Третья отправка успешна');
    } else {
      const error = await response.json();
      console.log('❌ Ошибка:', error.message);
    }

    // Тест 4: Четвертая отправка - должна быть заблокирована (лимит 3 за 5 минут)
    console.log('\n4️⃣ Четвертая отправка SMS (лимит 3 за 5 минут)...');
    response = await fetch('http://localhost:3002/api/users/resend-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    if (response.status === 429) {
      const error = await response.json();
      console.log('✅ Лимит работает! Получен ответ 429:', error.message);
      console.log('⏰ Retry-After:', error.retryAfter);
    } else if (response.ok) {
      console.log('❌ Лимит не сработал - отправка прошла (неожиданно)');
    } else {
      const error = await response.json();
      console.log('❌ Другая ошибка:', error.message);
    }

    console.log('\n🎉 Тест завершен!');
    console.log('\n📝 Ожидаемое поведение:');
    console.log('   - Первые 3 SMS: ✅ успешно');
    console.log('   - 4-я SMS: ❌ заблокирована (HTTP 429)');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testSMSSendLimits();



