/* DEPRECATED: this router was moved to archive because the project uses an inline upload
   handler in `server.js` (supports guest uploads). Keep this file in archive for
   reference — do NOT re-enable without reconciling authentication/behaviour. */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { upload, uploadImage, deleteImage } from '../controllers/uploadController.js';

const router = express.Router();

// NOTE: duplicate of inline `/api/upload/image` in server.js — left here for reference
router.post('/upload/image', authenticateToken, upload.single('image'), uploadImage);
router.delete('/upload/image/:filename', authenticateToken, deleteImage);

export default router;

