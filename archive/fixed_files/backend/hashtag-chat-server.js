import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { Pool } from 'pg';
import databaseConfig from './database.config.simple.cjs';

const pool = new Pool(databaseConfig);

// Создаем HTTP сервер
const server = createServer((req, res) => {
  res.writeHead(200, { 
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end('Hashtag Chat WebSocket Server Running');
});

// Создаем WebSocket сервер
const wss = new WebSocketServer({ server });

// Хранилище клиентов и комнат
const clients = new Map(); // resourceId -> { connection, userId, username, avatar, roomSubscriptions }
const rooms = new Map(); // hashtag -> Set of resourceIds

class HashtagChatServer {
  constructor() {
    this.init();
  }

  init() {
    wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    const resourceId = Math.random().toString(36).substr(2, 9);
    
    // Сохраняем новое соединение
    clients.set(resourceId, {
      connection: ws,
      userId: null,
      username: null,
      avatar: null,
      roomSubscriptions: new Set()
    });

    `);

    ws.on('message', (data) => {
      this.handleMessage(resourceId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(resourceId);
    });

    ws.on('error', (error) => {
      this.handleDisconnect(resourceId);
    });
  }

  handleMessage(resourceId, data) {
    try {
      const message = JSON.parse(data);
      
      if (!message || !message.type) {
        return;
      }

      switch (message.type) {
        case 'join':
          this.handleJoinRoom(resourceId, message);
          break;
          
        case 'message':
          this.handleChatMessage(resourceId, message);
          break;
          
        case 'typing':
          this.handleTyping(resourceId, message);
          break;
          
        case 'leave':
          this.handleLeaveRoom(resourceId, message);
          break;
          
        default:
          }
    } catch (error) {
      }
  }

  handleJoinRoom(resourceId, data) {
    if (!data.room || !data.user_id || !data.username) {
      return;
    }

    const room = data.room;
    const userId = data.user_id;
    const username = data.username;
    const avatar = data.avatar || 'assets/images/default-avatar.svg';

    // Обновляем информацию о клиенте
    const client = clients.get(resourceId);
    if (client) {
      client.userId = userId;
      client.username = username;
      client.avatar = avatar;
    }

    // Создаем комнату, если она не существует
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }

    // Добавляем клиента в комнату
    rooms.get(room).add(resourceId);
    client.roomSubscriptions.add(room);

    // Обновляем количество онлайн пользователей в БД
    this.updateOnlineUsers(room);

    // Уведомляем всех в комнате о новом участнике
    this.broadcastToRoom(room, {
      type: 'user_joined',
      user_id: userId,
      username: username,
      avatar: avatar,
      room: room,
      online_users: rooms.get(room).size
    });

    }

  async handleChatMessage(resourceId, data) {
    if (!data.room || !data.message) {
      return;
    }

    const client = clients.get(resourceId);
    if (!client || !client.userId) {
      return;
    }

    const room = data.room;
    const message = data.message;
    const imageUrl = data.image_url || null;

    try {
      // Сохраняем сообщение в базу данных
      const query = `
        INSERT INTO hashtag_chat_messages (user_id, hashtag, message, image_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
      `;
      
      const result = await pool.query(query, [client.userId, room, message, imageUrl]);
      const savedMessage = result.rows[0];

      // Обновляем last_activity в комнате
      await pool.query(
        'UPDATE hashtag_chat_rooms SET last_activity = NOW() WHERE hashtag = $1',
        [room]
      );

      // Отправляем сообщение всем в комнате
      this.broadcastToRoom(room, {
        type: 'new_message',
        id: savedMessage.id,
        user_id: client.userId,
        username: client.username,
        avatar: client.avatar,
        message: message,
        image_url: imageUrl,
        room: room,
        created_at: savedMessage.created_at
      });

      } catch (error) {
      }
  }

  handleTyping(resourceId, data) {
    if (!data.room) return;

    const client = clients.get(resourceId);
    if (!client) return;

    this.broadcastToRoom(data.room, {
      type: 'typing',
      user_id: client.userId,
      username: client.username,
      room: data.room,
      is_typing: data.is_typing || false
    });
  }

  handleLeaveRoom(resourceId, data) {
    if (!data.room) return;

    const room = data.room;
    const client = clients.get(resourceId);
    
    if (client && client.roomSubscriptions.has(room)) {
      client.roomSubscriptions.delete(room);
      
      if (rooms.has(room)) {
        rooms.get(room).delete(resourceId);
        
        // Удаляем комнату, если она пустая
        if (rooms.get(room).size === 0) {
          rooms.delete(room);
        }
      }

      // Обновляем количество онлайн пользователей
      this.updateOnlineUsers(room);

      // Уведомляем остальных участников
      this.broadcastToRoom(room, {
        type: 'user_left',
        user_id: client.userId,
        username: client.username,
        room: room,
        online_users: rooms.has(room) ? rooms.get(room).size : 0
      });

      }
  }

  handleDisconnect(resourceId) {
    const client = clients.get(resourceId);
    if (!client) return;

    `);

    // Удаляем из всех комнат
    client.roomSubscriptions.forEach(room => {
      this.handleLeaveRoom(resourceId, { room });
    });

    // Удаляем клиента
    clients.delete(resourceId);
  }

  broadcastToRoom(room, message) {
    if (!rooms.has(room)) return;

    const roomClients = rooms.get(room);
    const messageStr = JSON.stringify(message);

    roomClients.forEach(resourceId => {
      const client = clients.get(resourceId);
      if (client && client.connection.readyState === 1) { // WebSocket.OPEN
        client.connection.send(messageStr);
      }
    });
  }

  async updateOnlineUsers(room) {
    try {
      const onlineCount = rooms.has(room) ? rooms.get(room).size : 0;
      await pool.query(
        'UPDATE hashtag_chat_rooms SET online_users = $1 WHERE hashtag = $2',
        [onlineCount, room]
      );
    } catch (error) {
      }
  }

  // Метод для получения статистики
  getStats() {
    return {
      connectedClients: clients.size,
      activeRooms: rooms.size,
      totalRoomParticipants: Array.from(rooms.values()).reduce((sum, clients) => sum + clients.size, 0)
    };
  }
}

// Создаем экземпляр сервера
const chatServer = new HashtagChatServer();

const PORT = 8080;
server.listen(PORT, () => {
  });

// Graceful shutdown
process.on('SIGINT', () => {
  wss.close();
  server.close();
  pool.end();
  process.exit(0);
});

export default HashtagChatServer;
