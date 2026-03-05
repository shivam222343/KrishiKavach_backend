import express from 'express';
import { getAdvisoriesForFarmer } from '../controllers/advisory.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();
router.route('/').get(protect, authorizeRoles('farmer'), getAdvisoriesForFarmer);
export default router;