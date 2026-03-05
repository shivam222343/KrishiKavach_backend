import express from 'express';
import { addLocation, listLocations } from '../controllers/location.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));

router.post('/', addLocation);
router.get('/', listLocations);

export default router;
