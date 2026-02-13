import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3002';

async function testChatAPI() {
  try {
    // Тест 1: Проверяем доступность сервера
    const response = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms`);
    let rooms = [];
    if (response.ok) {
      rooms = await response.json();
      if (rooms.length > 0) {
        `);
      }
    }

    // Тест 2: Проверяем отправку сообщения
    if (response.ok && rooms.length > 0) {
      const roomId = rooms[0].id; // Используем ID комнаты, а не хэштег
      const messageData = {
        message: 'Тестовое сообщение от API',
        user_id: 1,
        username: 'testuser',
        reply_to: null
      };

      const messageResponse = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      });

      if (messageResponse.ok) {
        const newMessage = await messageResponse.json();
        } else {
        const error = await messageResponse.text();
        }
    }

    // Тест 3: Проверяем получение сообщений
    if (response.ok && rooms.length > 0) {
      const roomId = rooms[0].id; // Используем ID комнаты, а не хэштег
      const messagesResponse = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms/${roomId}/messages`);
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        if (messages.length > 0) {
          }
      } else {
        const error = await messagesResponse.text();
        }
    }

  } catch (error) {
    }
}

// Запускаем тест
testChatAPI();

