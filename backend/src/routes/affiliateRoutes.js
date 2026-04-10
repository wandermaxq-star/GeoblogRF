import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getPartnerData } from '../controllers/affiliateController.js';
import {
  applyForPartner,
  applyAsProGuide,
  getApplicationStatus,
  getPartnerProgress,
} from '../controllers/partnerController.js';
import { updatePartnerStatus, listApplications, getAdminStats } from '../controllers/adminAffiliateController.js';

const router = express.Router();

// ── Партнёрский дашборд (аффилиатная статистика) ────────────────────────────
router.get('/me', authenticateToken, getPartnerData);

// ── Прогресс к партнёрству (лестница достижений) ────────────────────────────
router.get('/progress', authenticateToken, getPartnerProgress);

// ── Заявки ──────────────────────────────────────────────────────────────────
router.get('/application', authenticateToken, getApplicationStatus);
router.post('/apply', authenticateToken, applyForPartner);
router.post('/apply-guide', authenticateToken, applyAsProGuide);

// ── Административное управление ─────────────────────────────────────────────
router.get('/admin/stats', authenticateToken, requireRole(['admin']), getAdminStats);
router.get('/admin/applications', authenticateToken, requireRole(['admin']), listApplications);
router.patch('/admin/status', authenticateToken, requireRole(['admin']), updatePartnerStatus);

export default router;
