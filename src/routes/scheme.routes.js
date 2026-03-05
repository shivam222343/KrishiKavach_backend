import express from 'express';
import { getSchemes } from '../controllers/scheme.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/recommendations', protect, getSchemes);

export default router;
