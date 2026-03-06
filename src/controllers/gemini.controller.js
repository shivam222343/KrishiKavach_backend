import asyncHandler from "express-async-handler";
import { getCropDiseaseInfo, chatWithAI, getCropManagementInfo, getWeatherCropImpact, getMarketPrices, getSeedAndYieldAdvice } from "../services/gemini.service.js";
import axios from "axios";
import FormData from "form-data";
import User from "../models/user.model.js";
import ProcessingCenter from "../models/processingCenter.model.js";

/**
 * POST /api/v1/disease-info/crop-info
 * Body: { cropName, diseaseName, language }
 */
export const fetchCropDiseaseInfo = asyncHandler(async (req, res) => {
    const { cropName, diseaseName, language = "en" } = req.body;

    if (!cropName || !diseaseName) {
        res.status(400);
        throw new Error("cropName and diseaseName are required.");
    }

    const user = await User.findById(req.user._id).lean();

    // Fetch all in parallel so one doesn't slow down or block the other
    const results = await Promise.allSettled([
        getCropDiseaseInfo(cropName, diseaseName, language, user?.groqApiKey),
        (async () => {
            const ADVISORY_URL = process.env.ADVISORY_URL || "https://shivamdombe-appadvisory.hf.space";
            const langMap = { en: "English", hi: "Hindi", mr: "Marathi" };
            const languageName = langMap[language] || "English";

            const fd = new FormData();
            fd.append("query", `${cropName} ${diseaseName} treatment control`);
            fd.append("language", languageName);
            fd.append("max_duration", "20");

            const mlRes = await axios.post(`${ADVISORY_URL}/youtube-search`, fd, {
                headers: fd.getHeaders(),
                timeout: 12000
            });

            return mlRes.data?.success ? mlRes.data.videos : [];
        })(),
        (async () => {
            const ADVISORY_URL = process.env.ADVISORY_URL || "https://shivamdombe-appadvisory.hf.space";
            const langMap = { en: "English", hi: "Hindi", mr: "Marathi" };
            const languageName = langMap[language] || "English";

            const fd = new FormData();
            fd.append("query", `${cropName} yield recovery boost fertilizers`);
            fd.append("language", languageName);
            fd.append("max_duration", "20");

            const mlRes = await axios.post(`${ADVISORY_URL}/youtube-search`, fd, {
                headers: fd.getHeaders(),
                timeout: 12000
            });

            return mlRes.data?.success ? mlRes.data.videos : [];
        })()
    ]);

    const info = results[0].status === 'fulfilled' ? results[0].value : null;
    const videos = results[1].status === 'fulfilled' ? results[1].value : [];
    const recoveryVideos = results[2].status === 'fulfilled' ? results[2].value : [];

    // ── Log Video Links in Backend (Gemini Path) ──
    console.log(`[YouTube Search - Gemini Path] Crop: ${cropName}, Disease: ${diseaseName}`);
    console.log(`[Treatment Videos]: ${videos.length} found. Status: ${results[1].status}`);
    console.log(`[Recovery Videos]: ${recoveryVideos.length} found. Status: ${results[2].status}`);

    if (videos.length > 0) console.log(`Links: ${videos.map(v => `https://youtu.be/${v.id}`).join(', ')}`);

    if (results[0].status === 'rejected') console.error("AI Crop Info Failed:", results[0].reason?.message);
    if (results[1].status === 'rejected') console.error("YouTube Treatment Search Failed:", results[1].reason?.message);
    if (results[2].status === 'rejected') console.error("YouTube Recovery Search Failed:", results[2].reason?.message);

    res.json({
        success: true,
        info,
        videos,
        recoveryVideos,
        aiError: results[0].status === 'rejected' ? results[0].reason?.message : null
    });
});

/**
 * POST /api/v1/disease-info/chat
 * Body: { messages: [{role, content}], context?: string, language?: string }
 */
export const chatbot = asyncHandler(async (req, res) => {
    const { messages, context = "", language = "en" } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400);
        throw new Error("messages array is required.");
    }

    const user = await User.findById(req.user._id).lean();
    const reply = await chatWithAI(messages, context, language, user?.groqApiKey);
    res.json({ success: true, reply });
});

/**
 * POST /api/v1/disease-info/crop-management
 * Body: { cropName, area, areaUnit, language }
 */
export const cropManagement = asyncHandler(async (req, res) => {
    const { cropName, area, areaUnit = "acres", language = "en" } = req.body;

    if (!cropName || !area) {
        res.status(400);
        throw new Error("cropName and area are required.");
    }

    const user = await User.findById(req.user._id).lean();
    const info = await getCropManagementInfo(cropName, parseFloat(area), areaUnit, language, user?.groqApiKey);
    res.json({ success: true, info });
});

/**
 * POST /api/v1/disease-info/weather-crop-impact
 * Body: { cropName, currentWeather, dailyForecast, language }
 */
export const weatherCropImpact = asyncHandler(async (req, res) => {
    const { cropName, currentWeather, dailyForecast, language = "en" } = req.body;

    if (!cropName || !currentWeather || !dailyForecast) {
        res.status(400);
        throw new Error("cropName, currentWeather, and dailyForecast are required.");
    }

    const user = await User.findById(req.user._id).lean();
    const impact = await getWeatherCropImpact(cropName, currentWeather, dailyForecast, language, user?.groqApiKey);
    res.json({ success: true, impact });
});

/**
 * POST /api/v1/disease-info/market-prices
 * Body: { commodity, district?, state? }
 * Uses user's profile district/state if not provided.
 */
export const marketPrices = asyncHandler(async (req, res) => {
    const { commodity, district: bodyDistrict, state: bodyState } = req.body;

    if (!commodity) {
        res.status(400);
        throw new Error("commodity is required.");
    }

    // Use profile location if caller didn't pass one
    let district = bodyDistrict;
    let state = bodyState;
    if (!district || !state) {
        const user = await User.findById(req.user._id).lean();
        district = district || user?.address?.district || "Nashik";
        state = state || "Maharashtra"; // default
    }

    const user = await User.findById(req.user._id).lean();
    let data = await getMarketPrices(commodity, district, state, user?.groqApiKey);

    // --- INTEGRATE FACILITY PRICES ---
    try {
        const userLoc = user?.location?.coordinates || [0, 0];
        const nearbyFacilities = await ProcessingCenter.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: userLoc },
                    $maxDistance: 100 * 1000 // 100km radius
                }
            },
            "marketPrices.crop": { $regex: new RegExp(commodity, 'i') }
        }).lean();

        if (nearbyFacilities.length > 0) {
            const facilityMarkets = nearbyFacilities.map(f => {
                const cropPrice = f.marketPrices.find(p =>
                    p.crop.toLowerCase().includes(commodity.toLowerCase())
                );
                return {
                    marketName: f.name,
                    modalPrice: cropPrice ? cropPrice.price : 0,
                    district: f.city || "Nearby",
                    distance: "Verified Facility",
                    arrivalQty: "Direct",
                    isFacility: true,
                    contact: f.contact
                };
            }).filter(m => m.modalPrice > 0);

            // Merge with localMarkets, prioritizing facilities at the top
            data.localMarkets = [...facilityMarkets, ...(data.localMarkets || [])];
        }
    } catch (facilityErr) {
        console.error("[Market] Facility integration failed:", facilityErr.message);
    }

    res.json({ success: true, data });
});

/**
 * POST /api/v1/disease-info/seed-advice
 * Body: { farmInfo, language }
 */
export const fetchSeedAndYieldAdvice = asyncHandler(async (req, res) => {
    const { farmInfo, language = "en" } = req.body;

    if (!farmInfo) {
        res.status(400);
        throw new Error("farmInfo is required.");
    }

    // Auto-populate address from user profile if missing
    if (!farmInfo.address) {
        const user = await User.findById(req.user._id).lean();
        farmInfo.address = user?.address;
    }

    const user = await User.findById(req.user._id).lean();
    const advice = await getSeedAndYieldAdvice(farmInfo, language, user?.groqApiKey);
    res.json({ success: true, advice });
});
