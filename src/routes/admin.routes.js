import express from 'express';
import {
  listFarmers,
  listAgronomists,
  deleteFarmer,
  deleteAgronomist,
  listFacilities, addFacility, updateFacility, deleteFacility,
  listSeeds, addSeed, updateSeed, deleteSeed,
  listFertilizers, addFertilizer, updateFertilizer, deleteFertilizer
} from '../controllers/admin.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));

router.get('/farmers', listFarmers);
router.delete('/farmers/:id', deleteFarmer);

router.get('/agronomists', listAgronomists);
router.delete('/agronomists/:id', deleteAgronomist);

router.get('/facilities', listFacilities);
router.post('/facilities', addFacility);
router.patch('/facilities/:id', updateFacility);
router.delete('/facilities/:id', deleteFacility);

router.get('/seeds', listSeeds);
router.post('/seeds', addSeed);
router.patch('/seeds/:id', updateSeed);
router.delete('/seeds/:id', deleteSeed);

router.get('/fertilizers', listFertilizers);
router.post('/fertilizers', addFertilizer);
router.patch('/fertilizers/:id', updateFertilizer);
router.delete('/fertilizers/:id', deleteFertilizer);

export default router;
