import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createListing,
    getNearbyListings,
    sendRequest,
    updateRequestStatus,
    getMyCollaborations,
    getExternalProcessingCenters,
    deleteListing,
    getMyListings,
    updateListingStatus
} from '../controllers/supplyChain.controller.js';

const router = express.Router();

router.use(protect); // All supply chain routes require authentication

router.post('/listings', createListing);
router.get('/listings/nearby', getNearbyListings);
router.get('/listings/my-listings', getMyListings);
router.patch('/listings/status/:id', updateListingStatus);
router.delete('/listings/:id', deleteListing);
router.get('/external/processing-centers', getExternalProcessingCenters);
router.post('/collaboration/request', sendRequest);
router.patch('/collaboration/status', updateRequestStatus);
router.get('/collaboration/my-stats', getMyCollaborations);

export default router;
