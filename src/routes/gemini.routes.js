import express from "express";
import { fetchCropDiseaseInfo, chatbot, cropManagement, weatherCropImpact, marketPrices, fetchSeedAndYieldAdvice } from "../controllers/gemini.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Protected — only logged-in users can call AI endpoints
router.use(protect);

// POST /api/v1/disease-info/crop-info
router.post("/crop-info", fetchCropDiseaseInfo);

// POST /api/v1/disease-info/chat
router.post("/chat", chatbot);

// POST /api/v1/disease-info/crop-management
router.post("/crop-management", cropManagement);

// POST /api/v1/disease-info/weather-crop-impact
router.post("/weather-crop-impact", weatherCropImpact);

// POST /api/v1/disease-info/market-prices
router.post("/market-prices", marketPrices);

// POST /api/v1/disease-info/seed-advice
router.post("/seed-advice", fetchSeedAndYieldAdvice);

export default router;

