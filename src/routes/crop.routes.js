import express from 'express';
import { addCrop, getCrops, deleteCrop, getCropsByFarmer } from '../controllers/crop.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(protect);

// Farmer routes
router.post('/', authorizeRoles('farmer'), addCrop);
router.get('/', authorizeRoles('farmer'), getCrops);
router.delete('/:id', authorizeRoles('farmer'), deleteCrop);

// Agronomist route to view farmer crops
router.get('/farmer/:farmerId', authorizeRoles('agronomist'), getCropsByFarmer);

export default router;
