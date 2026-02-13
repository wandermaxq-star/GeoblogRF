import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../../logger.js';
import { 
  checkForDuplicateMarkers,
  getNearbyIncompleteMarkers,
  checkUserCanCreateMarker
} from '../utils/markerDuplication.js';

const router = express.Router();

/**
 * POST /api/markers/check-duplicates
 * Проверка на дублирование меток перед созданием
 */
router.post('/markers/check-duplicates', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, title, category, excludeMarkerId } = req.body;

    // Валидация входных данных
    if (!latitude || !longitude || !title) {
      return res.status(400).json({
        success: false,
        message: 'Обязательные поля: latitude, longitude, title'
      });
    }

    // Проверяем лимиты пользователя
    const userLimitCheck = await checkUserCanCreateMarker(req.user.id, latitude, longitude);
    
    if (!userLimitCheck.canCreate) {
      return res.status(429).json({
        success: false,
        reason: userLimitCheck.reason,
        message: userLimitCheck.message,
        retryAfter: userLimitCheck.retryAfter
      });
    }

    // Проверяем дублирование
    const duplicationCheck = await checkForDuplicateMarkers(
      latitude, 
      longitude, 
      title,
      {
        category,
        excludeMarkerId,
        radius: 150, // 150 метров
        similarityThreshold: 0.6
      }
    );

    // Получаем неполные метки поблизости для предложения улучшения
    const nearbyIncomplete = await getNearbyIncompleteMarkers(
      latitude, 
      longitude, 
      category,
      300 // 300 метров для поиска неполных
    );

    res.json({
      success: true,
      data: {
        canCreate: duplicationCheck.analysis.canProceed,
        riskLevel: duplicationCheck.analysis.riskLevel,
        requiresConfirmation: duplicationCheck.analysis.requiresConfirmation || false,
        duplication: {
          hasDuplicates: duplicationCheck.hasDuplicates,
          duplicatesCount: duplicationCheck.duplicatesCount,
          duplicates: duplicationCheck.duplicates,
          analysis: duplicationCheck.analysis,
          recommendation: duplicationCheck.recommendation
        },
        alternatives: {
          incompleteNearby: nearbyIncomplete,
          suggestions: duplicationCheck.recommendation.alternatives || []
        },
        userLimits: {
          recentCount: userLimitCheck.recentCount || 0,
          remainingToday: userLimitCheck.remainingToday || 0
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка при проверке дублирования меток:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при проверке дублирования',
      error: error.message
    });
  }
});

/**
 * GET /api/markers/nearby-incomplete
 * Получить неполные метки поблизости для предложения улучшения
 */
router.get('/markers/nearby-incomplete', authenticateToken, async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      category, 
      radius = 500,
      limit = 10
    } = req.query;

    // Валидация
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Обязательные параметры: latitude, longitude'
      });
    }

    const markers = await getNearbyIncompleteMarkers(
      parseFloat(latitude),
      parseFloat(longitude),
      category,
      parseInt(radius)
    );

    res.json({
      success: true,
      data: {
        markers: markers.slice(0, parseInt(limit)),
        count: markers.length,
        filters: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          category,
          radius: parseInt(radius)
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка при поиске неполных меток:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при поиске неполных меток',
      error: error.message
    });
  }
});

/**
 * GET /api/markers/user-limits/:userId
 * Проверить лимиты пользователя на создание меток
 */
router.get('/markers/user-limits/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.query;

    // Проверяем права доступа
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для просмотра лимитов пользователя'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Обязательные параметры: latitude, longitude'
      });
    }

    const limitCheck = await checkUserCanCreateMarker(
      userId,
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      data: limitCheck
    });

  } catch (error) {
    logger.error('Ошибка при проверке лимитов пользователя:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при проверке лимитов',
      error: error.message
    });
  }
});

/**
 * POST /api/markers/validate-creation
 * Комплексная валидация создания метки
 */
router.post('/markers/validate-creation', authenticateToken, async (req, res) => {
  try {
// SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original: // SONAR-AUTO-FIX (javascript:S1854): original: // SONAR-AUTO-FIX (javascript:S1481): original:     const { latitude, longitude, title, category, description } = req.body;
    const userId = req.user.id;

    // Базовая валидация
    const validationErrors = [];
    
    if (!latitude || !longitude) {
      validationErrors.push('Необходимо указать координаты метки');
    }
    
    if (!title || title.trim().length < 3) {
      validationErrors.push('Название должно содержать минимум 3 символа');
    }
    
    if (title && title.length > 100) {
      validationErrors.push('Название не должно превышать 100 символов');
    }

    if (!category) {
      validationErrors.push('Необходимо выбрать категорию метки');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: validationErrors
      });
    }

    // Проверяем лимиты пользователя
    const userLimitCheck = await checkUserCanCreateMarker(userId, latitude, longitude);
    
    // Проверяем дублирование
    const duplicationCheck = await checkForDuplicateMarkers(
      latitude, 
      longitude, 
      title,
      { category }
    );

    // Получаем неполные метки поблизости
    const nearbyIncomplete = await getNearbyIncompleteMarkers(
      latitude, 
      longitude, 
      category
    );

    // Определяем финальный результат валидации
    const canCreate = userLimitCheck.canCreate && duplicationCheck.analysis.canProceed;
    const issues = [];
    const warnings = [];
    const suggestions = [];

    // Анализируем проблемы
    if (!userLimitCheck.canCreate) {
      issues.push({
        type: 'rate_limit',
        severity: 'error',
        message: userLimitCheck.message
      });
    }

    if (duplicationCheck.analysis.riskLevel === 'critical') {
      issues.push({
        type: 'duplicate',
        severity: 'error',
        message: duplicationCheck.analysis.message
      });
    }

    if (duplicationCheck.analysis.riskLevel === 'high') {
      warnings.push({
        type: 'potential_duplicate',
        severity: 'warning',
        message: duplicationCheck.analysis.message
      });
    }

    if (nearbyIncomplete.length > 0) {
      suggestions.push({
        type: 'improve_existing',
        message: `Рядом есть ${nearbyIncomplete.length} неполных меток. Рассмотрите возможность их улучшения.`,
        markers: nearbyIncomplete.slice(0, 3)
      });
    }

    res.json({
      success: true,
      data: {
        canCreate,
        validation: {
          passed: canCreate,
          issues,
          warnings,
          suggestions
        },
        duplication: duplicationCheck,
        userLimits: userLimitCheck,
        alternatives: {
          incompleteNearby: nearbyIncomplete,
          duplicates: duplicationCheck.duplicates
        },
        recommendation: duplicationCheck.recommendation
      }
    });

  } catch (error) {
    logger.error('Ошибка при валидации создания метки:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при валидации',
      error: error.message
    });
  }
});

export default router;


