import express from 'express';
import pool from '../../db.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../../logger.js';
import { 
  calculateMarkerCompleteness, 
  getStatusDescription,
  getPriorityImprovements,
  checkCompletenessLevelChange
} from '../utils/markerCompleteness.js';

const router = express.Router();

/**
 * GET /api/markers/:id/completeness
 * Получить анализ полноты заполнения метки
 */
router.get('/markers/:id/completeness', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем метку из базы данных
    const markerResult = await pool.query(`
      SELECT * FROM map_markers WHERE id = $1
    `, [id]);
    
    if (markerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Метка не найдена'
      });
    }
    
    const marker = markerResult.rows[0];
    
    // Рассчитываем полноту
    const completeness = calculateMarkerCompleteness(marker);
    const statusInfo = getStatusDescription(completeness.status);
    const priorityImprovements = getPriorityImprovements(marker);
    
    res.json({
      success: true,
      data: {
        markerId: id,
        completeness: {
          score: completeness.score,
          status: completeness.status,
          statusInfo,
          filledFields: completeness.filledRequiredFields,
          totalFields: completeness.totalRequiredFields,
          needsCompletion: completeness.needsCompletion
        },
        suggestions: completeness.suggestions,
        priorityImprovements,
        analysis: {
          currentScore: completeness.currentScore,
          maxPossibleScore: completeness.maxPossibleScore,
          completionPercentage: Math.round((completeness.filledRequiredFields / completeness.totalRequiredFields) * 100)
        }
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при анализе полноты метки:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при анализе полноты метки',
      error: error.message
    });
  }
});

/**
 * POST /api/markers/:id/update-completeness
 * Обновить расчет полноты метки после изменений
 */
router.post('/markers/:id/update-completeness', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем текущую метку
    const markerResult = await pool.query(`
      SELECT * FROM map_markers WHERE id = $1
    `, [id]);
    
    if (markerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Метка не найдена'
      });
    }
    
    const marker = markerResult.rows[0];
    const oldScore = marker.completeness_score || 0;
    
    // Рассчитываем новую полноту
    const completeness = calculateMarkerCompleteness(marker);
    
    // Проверяем изменение уровня
    const levelChange = checkCompletenessLevelChange(oldScore, completeness.score);
    
    // Обновляем поля в базе данных
    await pool.query(`
      UPDATE map_markers 
      SET 
        completeness_score = $1,
        required_fields_filled = $2,
        total_required_fields = $3,
        needs_completion = $4,
        completion_suggestions = $5
      WHERE id = $6
    `, [
      completeness.score,
      completeness.filledRequiredFields,
      completeness.totalRequiredFields,
      completeness.needsCompletion,
      JSON.stringify(completeness.suggestions),
      id
    ]);
    
    res.json({
      success: true,
      data: {
        markerId: id,
        oldScore,
        newScore: completeness.score,
        levelChange,
        completeness: {
          score: completeness.score,
          status: completeness.status,
          filledFields: completeness.filledRequiredFields,
          totalFields: completeness.totalRequiredFields,
          needsCompletion: completeness.needsCompletion
        },
        message: levelChange.improved ? 
          `Отлично! Полнота метки улучшена с ${oldScore}% до ${completeness.score}%` :
          `Полнота метки обновлена: ${completeness.score}%`
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при обновлении полноты метки:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении полноты метки',
      error: error.message
    });
  }
});

/**
 * GET /api/markers/incomplete
 * Получить список неполных меток для дополнения
 */
router.get('/markers/incomplete', authenticateToken, async (req, res) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      minScore = 0, 
      maxScore = 80,
      category,
      region 
    } = req.query;
    
    let query = `
      SELECT 
        id, title, description, category, latitude, longitude,
        completeness_score, needs_completion, completion_suggestions,
        creator_id, created_at
      FROM map_markers 
      WHERE is_active = true 
        AND needs_completion = true
        AND completeness_score >= $1 
        AND completeness_score <= $2
    `;
    
    const params = [minScore, maxScore];
    let paramIndex = 3;
    
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    // Исключаем метки текущего пользователя из предложений
    query += ` AND creator_id != $${paramIndex}`;
    params.push(req.user.id);
    paramIndex++;
    
    query += ` ORDER BY completeness_score DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Обогащаем данные анализом полноты
    const markersWithAnalysis = result.rows.map(marker => {
      const suggestions = marker.completion_suggestions ? 
        JSON.parse(marker.completion_suggestions) : [];
      
      return {
        ...marker,
        suggestions: suggestions.slice(0, 3), // Показываем только топ-3 предложения
        canContribute: true,
        estimatedImpact: suggestions.length > 0 ? 
          suggestions.reduce((sum, s) => sum + s.weight, 0) : 0
      };
    });
    
    res.json({
      success: true,
      data: {
        markers: markersWithAnalysis,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: markersWithAnalysis.length
        },
        filters: {
          minScore: parseInt(minScore),
          maxScore: parseInt(maxScore),
          category,
          region
        }
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при получении неполных меток:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении неполных меток',
      error: error.message
    });
  }
});

/**
 * POST /api/markers/batch-update-completeness
 * Массовое обновление полноты всех меток (для администраторов)
 */
router.post('/markers/batch-update-completeness', authenticateToken, async (req, res) => {
  try {
    // Проверяем права администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для выполнения операции'
      });
    }
    
    const { limit = 100 } = req.body;
    
    // Получаем метки для обновления
    const markersResult = await pool.query(`
      SELECT * FROM map_markers 
      WHERE is_active = true 
      ORDER BY updated_at DESC 
      LIMIT $1
    `, [limit]);
    
    let updatedCount = 0;
    const results = [];
    
    for (const marker of markersResult.rows) {
      try {
        const completeness = calculateMarkerCompleteness(marker);
        
        await pool.query(`
          UPDATE map_markers 
          SET 
            completeness_score = $1,
            required_fields_filled = $2,
            total_required_fields = $3,
            needs_completion = $4,
            completion_suggestions = $5
          WHERE id = $6
        `, [
          completeness.score,
          completeness.filledRequiredFields,
          completeness.totalRequiredFields,
          completeness.needsCompletion,
          JSON.stringify(completeness.suggestions),
          marker.id
        ]);
        
        updatedCount++;
        results.push({
          id: marker.id,
          title: marker.title,
          oldScore: marker.completeness_score || 0,
          newScore: completeness.score,
          status: completeness.status
        });
        
      } catch (markerError) {
        logger.error(`Ошибка при обновлении метки ${marker.id}:`, markerError);
      }
    }
    
    res.json({
      success: true,
      data: {
        updatedCount,
        totalProcessed: markersResult.rows.length,
        results: results.slice(0, 10), // Показываем первые 10 результатов
        message: `Успешно обновлено ${updatedCount} меток из ${markersResult.rows.length}`
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при массовом обновлении полноты:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при массовом обновлении полноты',
      error: error.message
    });
  }
});

export default router;
