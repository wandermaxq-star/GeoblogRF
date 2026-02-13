import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import logger from '../../logger.js';

export const authenticateToken = (req, res, next) => {
  try {
    // Логируем все запросы к аналитике для отладки
    const isAnalyticsRequest = req.path?.includes('/analytics');
    if (isAnalyticsRequest) {
      logger.info('🔐 Middleware authenticateToken для /analytics');
      logger.info('🔐 Path:', req.path);
      logger.info('🔐 Method:', req.method);
      logger.info('🔐 Headers:', Object.keys(req.headers));
      logger.info('🔐 Authorization header:', req.headers['authorization'] ? 'present' : 'missing');
    }
    
    // Логируем только для офлайн постов для отладки
    const isOfflinePost = req.path?.includes('/offline-posts');
    if (isOfflinePost) {
      logger.info('🔐 Middleware authenticateToken для /offline-posts');
      logger.info('🔐 Headers:', Object.keys(req.headers));
      logger.info('🔐 Authorization header:', req.headers['authorization'] ? 'present' : 'missing');
    }
    
    const authHeader = req.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      if (isOfflinePost) {
        console.error('❌ Токен не предоставлен');
      }
      return res.status(401).json({ 
        message: 'Токен доступа не предоставлен' 
      });
    }

    if (isOfflinePost) {
      logger.info('🔐 Токен извлечен, проверяем валидность...');
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      if (isOfflinePost) {
        console.error('❌ Токен недействителен');
      }
      return res.status(403).json({ 
        message: 'Недействительный токен' 
      });
    }

    if (isOfflinePost) {
      logger.info('✅ Токен валиден, user:', decoded.id);
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Ошибка в authenticateToken middleware:', error);
    return res.status(500).json({ 
      message: 'Ошибка проверки авторизации',
      error: error.message 
    });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Требуется авторизация' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Недостаточно прав' 
      });
    }

    next();
  };
};
