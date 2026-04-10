import express from 'express';
import { 
  register, login, getProfile, updateProfile, updateAvatar,
  subscribeUser,
  verifySMS, resendSMS, requestPasswordReset, confirmPasswordReset,
  deleteAccount
} from '../controllers/userController.js';
import { getPartnerData } from '../controllers/affiliateController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRegister, validateLogin, validateProfileUpdate } from '../middleware/validation.js';

const router = express.Router();

// Публичные маршруты с валидацией
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// Подписка (пользователь должен быть авторизован)
router.post('/subscribe', authenticateToken, subscribeUser);

// SMS-верификация (публичные маршруты)
router.post('/verify-sms', verifySMS);
router.post('/resend-sms', resendSMS);
router.post('/request-password-reset', requestPasswordReset);
router.post('/confirm-password-reset', confirmPasswordReset);

// Защищенные маршруты с валидацией
router.get('/profile', authenticateToken, getProfile);
router.get('/partner', authenticateToken, getPartnerData);
router.put('/profile', authenticateToken, validateProfileUpdate, updateProfile);
router.patch('/profile', authenticateToken, updateProfile); // PATCH для частичного обновления (например, analytics_opt_out)
router.put('/avatar', authenticateToken, updateAvatar);

// Удаление/деактивация аккаунта
router.delete('/', authenticateToken, deleteAccount);

export default router;
