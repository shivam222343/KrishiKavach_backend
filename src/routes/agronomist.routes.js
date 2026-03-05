import express from 'express';
import { getProfile, updateProfile, verifyAgronomist, findLocalExperts, findLocalFarmers } from '../controllers/agronomist.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/me', authorizeRoles('agronomist'), getProfile);
router.put('/me', authorizeRoles('agronomist'), updateProfile);

// Admin routes
router.put('/:id/verify', authorizeRoles('admin'), verifyAgronomist);
router.get('/local', authorizeRoles('farmer'), findLocalExperts);
router.get('/farmers', authorizeRoles('agronomist'), findLocalFarmers);


export default router;
