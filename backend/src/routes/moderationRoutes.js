import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getPendingContent,
  approveContent,
  rejectContent,
  hideContent,
  getModerationStats
} from '../controllers/moderationController.js';
import {
  getContentForReview,
  analyzeContent,
  setAdminVerdict,
  getAIStats,
  getModerationCounts
} from '../controllers/aiModerationController.js';
import {
  getModerationHistory,
  getContentDetails
} from '../controllers/moderationHistoryController.js';
import {
  getModerationTasks,
  getModerationTasksCount
} from '../controllers/moderationTasksController.js';
import { getRejectionReasons } from '../config/rejectionReasons.js';
import {
  revisionContent as facadeRevision,
  approveLocalContent as facadeApproveLocal,
} from '../services/moderationFacade.js';
import logger from '../../logger.js';

const router = express.Router();

// Все маршруты требуют авторизации и роли admin
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ===== ИИ-МОДЕРАЦИЯ (полуавтоматическая) =====
router.get('/ai/:contentType/review', getContentForReview);
router.post('/ai/:contentType/:contentId/analyze', analyzeContent);
router.post('/ai/decisions/:decisionId/verdict', setAdminVerdict);
router.get('/ai/stats', getAIStats);
router.get('/ai/counts', getModerationCounts);

// ===== РУЧНАЯ МОДЕРАЦИЯ =====
router.get('/stats', getModerationStats);
router.get('/rejection-reasons', (req, res) => {
  res.json(getRejectionReasons());
});

// ===== ЗАДАЧИ МОДЕРАЦИИ =====
router.get('/tasks/:contentType', getModerationTasks);
router.get('/tasks-count', getModerationTasksCount);

// ===== ИСТОРИЯ МОДЕРАЦИИ =====
router.get('/history/:contentType', getModerationHistory);
router.get('/:contentType/:contentId/details', getContentDetails);

// ===== CRUD модерации =====
router.get('/:contentType/pending', getPendingContent);
router.post('/:contentType/:id/approve', approveContent);
router.post('/:contentType/:id/reject', rejectContent);
router.post('/:contentType/:id/hide', hideContent);

// ── Отправить на доработку (через фасад) ────────────────────────────
router.post('/:contentType/:id/revision', async (req, res) => {
  try {
    const { contentType, id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    const result = await facadeRevision(contentType, id, adminId, reason);
    res.json({ message: 'Контент отправлен на доработку.', content: result.content });
  } catch (error) {
    logger.error('Ошибка отправки на доработку:', error);
    const status = error.message.includes('не найден') ? 404 : 500;
    res.status(status).json({ message: error.message || 'Ошибка сервера.' });
  }
});

// ── Одобрение локального контента (из localStorage гостя, через фасад) ──
router.post('/approve-local', async (req, res) => {
  try {
    const { content_type, content_data, author_id } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!content_type || !content_data) {
      return res.status(400).json({ message: 'Не указан тип контента или данные контента.' });
    }

    const result = await facadeApproveLocal(content_type, content_data, author_id, adminId);

    res.json({
      message: 'Контент одобрен и опубликован.',
      content: result.content,
      id: result.id,
      success: true,
    });
  } catch (error) {
    logger.error('Ошибка одобрения локального контента:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера.' });
  }
});

export default router;



