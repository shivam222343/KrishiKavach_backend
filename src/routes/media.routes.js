import express from 'express';
import { uploadMedia } from '../controllers/media.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';

const router = express.Router();
router.use(protect);

router.post('/', uploadSingle('file'), uploadMedia);

export default router;
