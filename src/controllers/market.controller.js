/**
 * controllers/market.controller.js
 * Handles all /api/v1/market routes.
 */

import {
    runScrapeCycle,
    searchMarketPrices,
    getLatestByDistrict,
    getCommodityPriceHistory,
    predictPrices,
    getDistinctFilterValues,
    getMarketStats,
    getLatestPricesForCrops,
} from '../services/market.service.js';
import Crop from '../models/crop.model.js';

// ── POST /market/scrape ───────────────────────────────────────────────────────
/** Manually trigger the scrape cycle (farmer or admin) */
export const triggerScrape = async (req, res) => {
    try {
        const result = await runScrapeCycle();
        res.json({
            success: true,
            message: `Scrape cycle complete. Saved ${result.saved} new price records.`,
            ...result,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/latest?commodity=Soybean&state=Maharashtra ───────────────────
/** Latest price per district for a given commodity */
export const getLatestPrices = async (req, res) => {
    try {
        const { commodity, state } = req.query;
        if (!commodity) return res.status(400).json({ success: false, message: 'commodity query param required' });

        const rows = await getLatestByDistrict(commodity, state);
        res.json({ success: true, commodity, state: state || 'All', count: rows.length, results: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/search ────────────────────────────────────────────────────────
export const searchPrices = async (req, res) => {
    try {
        const {
            commodity, state, district,
            startDate, endDate,
            page = 1, limit = 48,
        } = req.query;

        const data = await searchMarketPrices({
            commodity, state, district, startDate, endDate,
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 200),
        });
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/history/:commodity ────────────────────────────────────────────
export const getPriceHistory = async (req, res) => {
    try {
        const { commodity } = req.params;
        const { state, district } = req.query;
        const history = await getCommodityPriceHistory(commodity, { state, district });
        res.json({ success: true, commodity, count: history.length, history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/predict/:commodity ────────────────────────────────────────────
export const getPricePrediction = async (req, res) => {
    try {
        const { commodity } = req.params;
        const { district } = req.query;
        const result = await predictPrices(commodity, district);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/my-crops ──────────────────────────────────────────────────────
export const getMyCropPrices = async (req, res) => {
    try {
        const crops = await Crop.find({ farmer: req.user._id }).lean();
        const cropNames = [...new Set(crops.map((c) => c.cropName))];
        if (!cropNames.length) {
            return res.json({ success: true, prices: [], message: 'No crops in your list.' });
        }
        const prices = await getLatestPricesForCrops(cropNames);
        res.json({ success: true, cropNames, prices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/filters ───────────────────────────────────────────────────────
export const getFilters = async (req, res) => {
    try {
        const filters = await getDistinctFilterValues();
        res.json({ success: true, ...filters });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /market/stats ─────────────────────────────────────────────────────────
export const getMarketStatsCtrl = async (req, res) => {
    try {
        const stats = await getMarketStats();
        res.json({ success: true, ...stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
