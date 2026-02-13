import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import databaseConfig from './database.config.simple.cjs';
const pool = new Pool(databaseConfig);

class ChatWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // userId -> WebSocket
    this.rooms = new Map(); // roomId -> Set of userIds
    
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  async handleConnection(ws, req) {
    try {
      // Получаем токен из URL параметров
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      
      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      // Проверяем токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.userId;

      // Сохраняем соединение
      this.clients.set(userId, ws);
      
      // Получаем чаты пользователя и подписываем на них
      const userRooms = await this.getUserRooms(userId);
      userRooms.forEach(roomId => {
        this.joinRoom(userId, roomId);
      });

      ws.on('message', (data) => {
        this.handleMessage(userId, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(userId);
      });

      ws.on('error', (error) => {
        this.handleDisconnect(userId);
      });

    } catch (error) {
      ws.close(1008, 'Authentication failed');
    }
  }

  async getUserRooms(userId) {
    try {
      const query = 'SELECT room_id FROM chat_participants WHERE user_id = $1';
      const result = await pool.query(query, [userId]);
      return result.rows.map(row => row.room_id);
    } catch (error) {
      return [];
    }
  }

  joinRoom(userId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);
  }

  leaveRoom(userId, roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  async handleMessage(userId, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'send_message':
          await this.handleSendMessage(userId, message);
          break;
          
        case 'join_room':
          this.joinRoom(userId, message.roomId);
          this.broadcastToRoom(message.roomId, {
            type: 'user_joined',
            userId,
            roomId: message.roomId
          });
          break;
          
        case 'leave_room':
          this.leaveRoom(userId, message.roomId);
          this.broadcastToRoom(message.roomId, {
            type: 'user_left',
            userId,
            roomId: message.roomId
          });
          break;
          
        case 'typing_start':
          this.broadcastToRoom(message.roomId, {
            type: 'typing_start',
            userId,
            roomId: message.roomId
          });
          break;
          
        case 'typing_stop':
          this.broadcastToRoom(message.roomId, {
            type: 'typing_stop',
            userId,
            roomId: message.roomId
          });
          break;
          
        default:
          }
    } catch (error) {
      }
  }

  async handleSendMessage(userId, message) {
    try {
      const { roomId, content, messageType = 'text', replyToId = null, fileUrls = null } = message;
      
      // Сохраняем сообщение в базу данных
      const query = `
        INSERT INTO chat_messages (room_id, sender_id, content, message_type, reply_to_id, file_urls)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const result = await pool.query(query, [roomId, userId, content, messageType, replyToId, fileUrls]);
      const savedMessage = result.rows[0];
      
      // Обновляем last_activity в чате
      await pool.query(
        'UPDATE chat_rooms SET last_activity = NOW() WHERE id = $1',
        [roomId]
      );
      
      // Отправляем сообщение всем участникам чата
      this.broadcastToRoom(roomId, {
        type: 'new_message',
        message: {
          ...savedMessage,
          sender_name: await this.getUserName(userId),
          sender_avatar: await this.getUserAvatar(userId)
        }
      });
      
    } catch (error) {
      }
  }

  async getUserName(userId) {
    try {
      const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.name || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  async getUserAvatar(userId) {
    try {
      const result = await pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.avatar || null;
    } catch (error) {
      return null;
    }
  }

  broadcastToRoom(roomId, message) {
    if (!this.rooms.has(roomId)) return;
    
    const roomUsers = this.rooms.get(roomId);
    roomUsers.forEach(userId => {
      const client = this.clients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  handleDisconnect(userId) {
    // Удаляем из всех комнат
    this.rooms.forEach((users, roomId) => {
      if (users.has(userId)) {
        users.delete(userId);
        this.broadcastToRoom(roomId, {
          type: 'user_disconnected',
          userId,
          roomId
        });
      }
    });
    
    // Удаляем клиента
    this.clients.delete(userId);
  }

  // Метод для отправки системных сообщений
  sendToUser(userId, message) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  // Метод для получения статистики
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
      totalRoomParticipants: Array.from(this.rooms.values()).reduce((sum, users) => sum + users.size, 0)
    };
  }
}

export default ChatWebSocketServer;

