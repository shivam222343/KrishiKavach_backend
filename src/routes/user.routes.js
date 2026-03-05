import express from 'express';
import { getProfile, updateProfile, updateLocation, changePassword, deleteProfilePhoto, uploadProfilePhoto, updateFarmInfo } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadProfilePhoto as uploadProfilePhotoMiddleware } from '../middleware/upload.middleware.js';


const router = express.Router();

router.use(protect);

router.get('/me', getProfile);
router.put('/update', updateProfile);
router.put('/update-location', updateLocation);
router.put('/update-farm-info', updateFarmInfo);
router.put('/change-password', changePassword);
router.post('/upload-photo', uploadProfilePhotoMiddleware('photo'), uploadProfilePhoto);
router.delete('/delete-photo', deleteProfilePhoto);


export default router;
