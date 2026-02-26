import express from 'express';
import friendsController from '../controllers/friendsController.js';

const router = express.Router();

// Получить список друзей
router.get('/', friendsController.getFriends);

// Получить входящие заявки в друзья
router.get('/requests/incoming', friendsController.getIncomingRequests);

// Получить исходящие заявки в друзья
router.get('/requests/outgoing', friendsController.getOutgoingRequests);

// Отправить заявку в друзья
router.post('/request', friendsController.sendFriendRequest);

// Принять заявку в друзья
router.post('/accept/:requestId', friendsController.acceptFriendRequest);

// Отклонить заявку в друзья
router.post('/reject/:requestId', friendsController.rejectFriendRequest);

// Удалить из друзей
router.delete('/:friendshipId', friendsController.removeFriend);

// Поиск пользователей для добавления в друзья
router.get('/search', friendsController.searchUsers);

export default router;


