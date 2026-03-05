import express from 'express';
import {
    triggerScrape,
    getLatestPrices,
    searchPrices,
    getPriceHistory,
    getPricePrediction,
    getMyCropPrices,
    getFilters,
    getMarketStatsCtrl,
} from '../controllers/market.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// ── Protected by auth ─────────────────────────────────────────────────────────

// GET /api/v1/market/latest?commodity=Soybean&state=Maharashtra
router.get('/latest', protect, getLatestPrices);

// GET /api/v1/market/search?commodity=Onion&state=Maharashtra&district=Nashik
router.get('/search', protect, searchPrices);

// GET /api/v1/market/history/:commodity?state=&district=
router.get('/history/:commodity', protect, getPriceHistory);

// GET /api/v1/market/predict/:commodity?district=Nashik
router.get('/predict/:commodity', protect, getPricePrediction);

// GET /api/v1/market/my-crops (farmer only)
router.get('/my-crops', protect, authorizeRoles('farmer'), getMyCropPrices);

// GET /api/v1/market/filters
router.get('/filters', protect, getFilters);

// GET /api/v1/market/stats
router.get('/stats', protect, getMarketStatsCtrl);

// POST /api/v1/market/scrape — manually trigger scrape cycle (farmer or admin)
router.post('/scrape', protect, authorizeRoles('admin', 'farmer'), triggerScrape);

// Legacy alias so old frontend code still works
router.post('/fetch-daily', protect, authorizeRoles('admin', 'farmer'), triggerScrape);

export default router;
