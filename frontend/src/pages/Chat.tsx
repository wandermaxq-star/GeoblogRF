import { useState, useEffect } from 'react';
import { RoomAccordion } from "../components/chat/RoomAccordion";
import { ChatMain } from "../components/chat/ChatMain";
import { ParticipantsPanel } from "../components/chat/ParticipantsPanel";
import { Room, Message, User, RouteRoom, EventRoom, CreateRouteRoomData, CreateEventRoomData } from '../types/chat';
import { FaBars, FaUsers, FaTimes, FaComments } from 'react-icons/fa';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import '../styles/PageLayout.css';

// API URL для загрузки комнат
const API_BASE_URL = ''; // Используем относительный путь через Vite proxy

// Демо-пользователь для временного использования
const DEMO_USER: User = {
  id: '1',
  name: 'Тестовый пользователь',
  avatar: null,
  status: 'online',
  role: 'member',
  joinedAt: new Date()
};

const Chat = () => {
  const { registerPanel, unregisterPanel } = usePanelRegistration();
  
  // Регистрируем панели при монтировании компонента
  useEffect(() => {
    registerPanel(); // Основная панель чата
    registerPanel(); // Левая панель настроек
    registerPanel(); // Правая панель участников
    return () => {
      unregisterPanel(); // Основная панель
      unregisterPanel(); // Левая панель
      unregisterPanel(); // Правая панель
    };
  }, [registerPanel, unregisterPanel]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({});
  const [currentUser] = useState<User>(DEMO_USER);

  // Функция загрузки комнат из API
  const loadRoomsFromAPI = async () => {
    try {
      // Загружаем активные комнаты
      const activeResponse = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms`);
      if (!activeResponse.ok) {
        // Возвращаем пустой массив вместо ошибки
        setRooms([]);
        return;
      }
      const activeRooms = await activeResponse.json();
      // Загружаем удалённые комнаты пользователя
      const deletedResponse = await fetch(`${API_BASE_URL}/api/chat/deleted-rooms?userId=${currentUser.id}`);
      let deletedRooms = [];
      if (deletedResponse.ok) {
        deletedRooms = await deletedResponse.json();
        }

      // Объединяем все комнаты
      const allRooms = [...activeRooms, ...deletedRooms];

      // Преобразуем API комнаты в формат Room
      const transformedRooms: Room[] = allRooms.map((apiRoom: any) => ({
        id: apiRoom.id.toString(),
        name: apiRoom.title,
        description: apiRoom.description || '',
        type: 'public' as const,
        participants: [DEMO_USER],
        createdAt: new Date(apiRoom.created_at),
        createdBy: '1',
        isArchived: apiRoom.is_archived || false,
        isDeleted: !!apiRoom.deleted_at
      }));

      setRooms(transformedRooms);
      // Устанавливаем первую активную комнату как текущую
      const activeRoom = transformedRooms.find(room => !room.isDeleted && !room.isArchived);
      if (activeRoom) {
        setCurrentRoom(activeRoom);
        // Загружаем сообщения для первой комнаты
        try {
          const response = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms/${activeRoom.id}/messages`);

          if (response.ok) {
            const apiMessages = await response.json();
            // Преобразуем API сообщения в формат Message
            const transformedMessages: Message[] = apiMessages.map((apiMsg: any) => ({
              id: apiMsg.id.toString(),
              content: apiMsg.message,
              author: {
                id: apiMsg.user_id.toString(),
                name: `Пользователь ${apiMsg.user_id}`,
                avatar: null,
                status: 'online',
                role: 'member',
                joinedAt: new Date()
              },
              roomId: activeRoom.id,
              timestamp: new Date(apiMsg.created_at),
              isEdited: false,
              attachments: [],
              reactions: []
            }));

            setMessages(prev => ({
              ...prev,
              [activeRoom.id]: transformedMessages
            }));
          }
        } catch (error) {
          }
      }
    } catch (error) {
      }
  };

  // Функция загрузки сообщений для конкретной комнаты
  const loadMessagesForRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms/${roomId}/messages`);
      
      if (response.ok) {
        const apiMessages = await response.json();
        // Преобразуем API сообщения в формат Message
        const transformedMessages: Message[] = apiMessages.map((apiMsg: any) => ({
          id: apiMsg.id.toString(),
          content: apiMsg.message,
          author: {
            id: apiMsg.user_id?.toString() || '0',
            name: `Пользователь ${apiMsg.user_id ?? ''}`.trim(),
            avatar: null,
            status: 'online',
            role: 'member',
            joinedAt: new Date(),
          },
          roomId: roomId,
          timestamp: new Date(apiMsg.created_at),
          isEdited: false,
          attachments: apiMsg.image_url ? [apiMsg.image_url] : [],
          reactions: [],
        }));
        
        setMessages(prev => ({ ...prev, [roomId]: transformedMessages }));
        } else {
        }
    } catch (error) {
      }
  };

  // Загружаем комнаты из API при монтировании компонента
  useEffect(() => {
    loadRoomsFromAPI();
  }, []);

  // Обработчики
  const handleCreateRoom = async (roomData: Omit<Room, 'id' | 'createdAt'>) => {
    try {
      // Для hashtag-комнат используем имя как хэштег/тег
      const payload = {
        hashtag: roomData.name,
        title: roomData.name.startsWith('#') ? roomData.name : `#${roomData.name}`,
        description: roomData.description ?? null,
      };

      const response = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create room (${response.status})`);
      }

      const created = await response.json();

      const createdRoom: Room = {
        id: created.id.toString(),
        name: created.title,
        description: created.description || '',
        type: 'public',
        participants: [currentUser],
        createdAt: new Date(created.created_at),
        createdBy: currentUser.id,
        isArchived: false,
      };

      setRooms(prev => [createdRoom, ...prev]);
      setCurrentRoom(createdRoom);
      setMessages(prev => ({ ...prev, [createdRoom.id]: [] }));
    } catch (e) {
      alert('Не удалось создать комнату');
    }
  };

  // Создание комнаты маршрута
  const handleCreateRouteRoom = async (roomData: CreateRouteRoomData) => {
    try {
      const payload = {
        hashtag: `route-${roomData.routeId}`,
        title: `🗺️ ${roomData.name}`,
        description: roomData.description,
        type: 'route',
        routeId: roomData.routeId,
        routeData: roomData.routeData,
        category: roomData.category,
        tags: roomData.tags,
        isPrivate: roomData.isPrivate,
      };

      const response = await fetch(`${API_BASE_URL}/api/chat/route-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create route room (${response.status})`);
      }

      const created = await response.json();

      const createdRoom: RouteRoom = {
        id: created.id.toString(),
        name: created.title,
        description: created.description || '',
        type: 'route',
        routeId: roomData.routeId,
        routeData: roomData.routeData,
        participants: [currentUser],
        createdAt: new Date(created.created_at),
        createdBy: currentUser.id,
        isArchived: false,
        isActive: true,
        canJoin: true,
        category: roomData.category as any,
        tags: roomData.tags,
      };

      setRooms(prev => [createdRoom, ...prev]);
      setCurrentRoom(createdRoom);
      setMessages(prev => ({ ...prev, [createdRoom.id]: [] }));
    } catch (e) {
      alert('Не удалось создать комнату маршрута');
    }
  };

  // Создание комнаты события
  const handleCreateEventRoom = async (roomData: CreateEventRoomData) => {
    try {
      const payload = {
        hashtag: `event-${Date.now()}`,
        title: `📅 ${roomData.name}`,
        description: roomData.description,
        type: 'event',
        eventData: roomData.eventData,
        category: roomData.category,
        tags: roomData.tags,
        isPrivate: roomData.isPrivate,
      };

      const response = await fetch(`${API_BASE_URL}/api/chat/event-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create event room (${response.status})`);
      }

      const created = await response.json();

      const createdRoom: EventRoom = {
        id: created.id.toString(),
        name: created.title,
        description: created.description || '',
        type: 'event',
        eventId: created.id.toString(),
        eventData: {
          ...roomData.eventData,
          currentParticipants: 1,
          organizer: currentUser,
        },
        participants: [currentUser],
        createdAt: new Date(created.created_at),
        createdBy: currentUser.id,
        isArchived: false,
        isActive: true,
        canJoin: true,
        category: roomData.category as any,
        tags: roomData.tags,
        startDate: roomData.eventData.startDate,
        endDate: roomData.eventData.endDate,
        maxParticipants: roomData.eventData.maxParticipants,
        currentParticipants: 1,
        location: {
          city: roomData.eventData.location.address.split(',')[0] || 'Неизвестно',
          country: roomData.eventData.location.address.split(',').pop()?.trim() || 'Неизвестно',
          coordinates: roomData.eventData.location.coordinates,
        },
      };

      setRooms(prev => [createdRoom, ...prev]);
      setCurrentRoom(createdRoom);
      setMessages(prev => ({ ...prev, [createdRoom.id]: [] }));
    } catch (e) {
      alert('Не удалось создать комнату события');
    }
  };

  // Присоединение к комнате
  const handleJoinRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      if (response.ok) {
        // Обновляем список участников комнаты
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, participants: [...room.participants, currentUser] }
              : room
          )
        );
        }
    } catch (error) {
      }
  };

  // Покидание комнаты
  const handleLeaveRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      if (response.ok) {
        // Удаляем пользователя из списка участников
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, participants: room.participants.filter(p => p.id !== currentUser.id) }
              : room
          )
        );
        }
    } catch (error) {
      }
  };

  // Обработчик выбора комнаты
  const handleRoomSelect = (room: Room) => {
    setCurrentRoom(room);
    setSidebarOpen(false); // Закрываем левую панель
    setParticipantsOpen(false); // Закрываем панель участников
    
    // Загружаем сообщения для выбранной комнаты
    if (messages[room.id]) {
      } else {
      loadMessagesForRoom(room.id);
    }
  };

  const handleSendMessage = async (content: string, roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/hashtag-rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, user_id: Number(currentUser.id), username: currentUser.name }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const apiMsg = await response.json();
      const saved: Message = {
        id: apiMsg.id?.toString() || Date.now().toString(),
        content: apiMsg.message ?? content,
        author: currentUser,
        roomId,
        timestamp: new Date(apiMsg.created_at ?? Date.now()),
        isEdited: false,
        replyTo: undefined,
        attachments: apiMsg.image_url ? [apiMsg.image_url] : [],
        reactions: [],
        canEdit: true,
        canDelete: true,
      };

      setMessages(prev => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), saved],
      }));
    } catch (e) {
      }
  };

  // Архивировать комнату
  const archiveRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/archive/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        // Обновляем состояние комнат
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, isArchived: true }
              : room
          )
        );
        
        // Если текущая комната была заархивирована, выбираем другую
        if (currentRoom?.id === roomId) {
          const nextRoom = rooms.find(room => !room.isArchived && !room.isDeleted && room.id !== roomId);
          setCurrentRoom(nextRoom || null);
        }
        
        // Перезагружаем комнаты для обновления списка
        loadRoomsFromAPI();
      }
    } catch (error) {
      }
  };

  // Удалить комнату
  const deleteRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/delete/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        // Обновляем состояние комнат
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, isDeleted: true }
              : room
          )
        );
        
        // Если текущая комната была удалена, выбираем другую
        if (currentRoom?.id === roomId) {
          const nextRoom = rooms.find(room => !room.isArchived && !room.isDeleted && room.id !== roomId);
          setCurrentRoom(nextRoom || null);
        }
        
        // Перезагружаем комнаты для обновления списка
        loadRoomsFromAPI();
      }
    } catch (error) {
      }
  };

  // Восстановить удалённую комнату
  const restoreRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/restore/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        // Обновляем состояние комнат
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, isDeleted: false }
              : room
          )
        );
        
        // Перезагружаем комнаты для обновления списка
        loadRoomsFromAPI();
      }
    } catch (error) {
      }
  };

  // Раскомментировать комнату
  const unarchiveRoom = async (roomId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/unarchive/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        // Обновляем состояние комнат
        setRooms(prevRooms => 
          prevRooms.map(room => 
            room.id === roomId 
              ? { ...room, isArchived: false }
              : room
          )
        );
        
        // Перезагружаем комнаты для обновления списка
        loadRoomsFromAPI();
      }
    } catch (error) {
      }
  };

  // Обработчики управления участниками
  const handlePromoteUser = (userId: string) => {
    // TODO: Реализовать API для повышения пользователя
  };

  const handleBanUser = (userId: string) => {
    // TODO: Реализовать API для исключения пользователя
  };

  const handleInviteUser = () => {
    // TODO: Реализовать модальное окно для приглашения
  };

  return (
    <MirrorGradientContainer className="page-layout-container">
      {/* Основная область контента */}
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            {/* Кнопки управления по бокам чата */}
            <div
              className="page-side-buttons left"
              style={{
                '--left-button-size': '47px',
                '--left-button-border-width': '2px',
                '--left-button-border-color': '#8E9093',
                '--left-button-bg': '#FFFFFF',
              } as React.CSSProperties}
            >
              <button
                className="page-side-button left"
                onClick={() => setSidebarOpen(true)}
                title="Настройки чата"
              >
                <FaBars className="text-gray-600" size={20} />
              </button>
            </div>

            <div
              className="page-side-buttons right"
              style={{
                '--right-top': '50%',
                '--right-translateY': '-50%',
                '--right-offset': '17px',
                '--right-gap': '15px',
                '--right-button-size': '47px',
                '--right-button-border-width': '2px',
                '--right-button-border-color': '#8E9093',
                '--right-button-bg': '#ffffff',
              } as React.CSSProperties}
            >
              <button
                className="page-side-button right"
                onClick={() => setParticipantsOpen(true)}
                title="Участники"
              >
                <FaUsers className="text-gray-600" size={20} />
              </button>
            </div>

            {/* Основной чат */}
            <div className="h-full relative">
              <div className="map-content-container">
                {/* Заголовок контента */}
                <div className="map-content-header">
                  <div className="flex items-center justify-center w-full">
                    <div className="flex items-center space-x-2">
                      <FaComments className="w-5 h-5 text-slate-400" />
                      <h1 className="text-lg font-semibold text-slate-800">Чат</h1>
                    </div>
                  </div>
                </div>
                {/* Область контента */}
                <div className="map-area">
                  <div className="full-height-content">
                    <ChatMain
                      room={currentRoom}
                      messages={currentRoom ? messages[currentRoom.id] || [] : []}
                      currentUser={currentUser}
                      onSendMessage={handleSendMessage}
                      onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
                      showParticipants={false}
                      onReact={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                    />
                  </div>
                </div>
              </div>

              {/* Левая выдвигающаяся панель (внутри чата) */}
              <div className={`page-slide-panel left ${sidebarOpen ? 'open' : ''}`}>
                <div className="page-slide-panel-header left">
                  <h2 className="text-xl font-semibold text-center flex-1">Настройки чата</h2>
                  <button
                    className="page-slide-panel-close"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
                <div className="page-slide-panel-content">
                  <RoomAccordion
                    rooms={rooms}
                    currentRoom={currentRoom}
                    currentUser={currentUser}
                    onRoomSelect={handleRoomSelect}
                    onCreateRoom={handleCreateRoom}
                    onCreateRouteRoom={handleCreateRouteRoom}
                    onCreateEventRoom={handleCreateEventRoom}
                    onArchiveRoom={archiveRoom}
                    onDeleteRoom={deleteRoom}
                    onRestoreRoom={restoreRoom}
                    onUnarchiveRoom={unarchiveRoom}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                  />
                </div>
              </div>

              {/* Правая выдвигающаяся панель (внутри чата) */}
              <div className={`page-slide-panel right ${participantsOpen ? 'open' : ''}`}>
                <div className="page-slide-panel-header right">
                  <button
                    className="page-slide-panel-close"
                    onClick={() => setParticipantsOpen(false)}
                  >
                    <FaTimes size={14} />
                  </button>
                  <h2 className="text-xl font-semibold text-center flex-1">Список участников</h2>
                  <div className="w-6"></div> {/* Пустой div для баланса */}
                </div>
                <div className="page-slide-panel-content">
                  {currentRoom && (
                    <ParticipantsPanel
                      room={currentRoom}
                      currentUser={currentUser}
                      onPromoteUser={handlePromoteUser}
                      onKickUser={handleBanUser}
                      onInviteUser={handleInviteUser}
                    />
                  )}
                </div>
              </div>

              {/* Затемнение при открытых панелях */}
              <div className={`page-overlay ${(sidebarOpen || participantsOpen) ? 'active' : ''}`} />
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );
};

export default Chat;
