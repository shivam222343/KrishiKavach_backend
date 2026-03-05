import asyncHandler from "express-async-handler";
import DiseaseReport from "../models/diseaseReport.model.js";
import Crop from "../models/crop.model.js";
import Media from "../models/media.model.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { analyzeCropDisease, identifyCropWithAI } from "../services/diseaseDetection.service.js";
import { sendWhatsAppReport } from "../services/whatsapp.service.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

// --------------------------------------------------------------
// 🏠 LOCAL ML SERVER CONFIG (FastAPI running app.py on port 8000)
// --------------------------------------------------------------
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://localhost:8000";

// Supported crops for the new model
const SUPPORTED_CROPS = ["Banana", "Chilli", "Radish", "Groundnut", "Cauliflower"];

// --------------------------------------------------------------
// ✔ PREDICTION REQUEST TO LOCAL FASTAPI ML SERVER
// --------------------------------------------------------------
const requestPrediction = async ({ buffer, originalName, mimeType, cropName }) => {
  const formData = new FormData();

  formData.append("file", buffer, {
    filename: originalName || "upload.jpg",
    contentType: mimeType || "image/jpeg",
  });

  if (cropName) formData.append("crop", cropName);

  return axios.post(`${ML_SERVER_URL}/predict`, formData, {
    headers: formData.getHeaders(),
    timeout: 30000,
  });
};

// --------------------------------------------------------------
// ✔ CREATE REPORT USING GEMINI (for detailed analysis after ML)
// --------------------------------------------------------------
export const createReport = asyncHandler(async (req, res) => {
  const { cropId, reportLanguage } = req.body;

  const crop = await Crop.findById(cropId);
  if (!crop) return res.status(404).json({ message: "Crop not found" });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "Please upload images." });
  }

  // Upload images
  const mediaIds = [];
  for (const file of req.files) {
    const upload = await uploadToCloudinary(file, "disease-reports");
    const mediaDoc = await Media.create({ url: upload.secure_url });
    mediaIds.push(mediaDoc._id);
  }

  // Gemini analysis
  const analysis = await analyzeCropDisease(
    req.files,
    { cropName: crop.name, cropVariety: crop.variety },
    reportLanguage || "en"
  );

  const report = await DiseaseReport.create({
    farmer: req.user.id,
    crop: crop._id,
    images: mediaIds,
    reportLanguage,
    analysis,
    reportStatus: "pending_action",
  });

  res.status(201).json({ message: "Report created", report });
});

// --------------------------------------------------------------
// ✔ GET REPORTS OF FARMER
// --------------------------------------------------------------
export const getFarmerReports = asyncHandler(async (req, res) => {
  const reports = await DiseaseReport.find({ farmer: req.user.id })
    .populate("crop images assignedAgronomist");

  res.json(reports);
});

// --------------------------------------------------------------
// ✔ MARK REPORT AS TREATED
// --------------------------------------------------------------
export const markReportTreated = asyncHandler(async (req, res) => {
  const report = await DiseaseReport.findById(req.params.id);

  if (!report || report.farmer.toString() !== req.user.id) {
    return res.status(404).json({ message: "Report not found" });
  }

  report.reportStatus = "treated";
  await report.save();

  res.json({ message: "Report marked as treated", report });
});

// --------------------------------------------------------------
// ✔ DELETE REPORT
// --------------------------------------------------------------
export const deleteReport = asyncHandler(async (req, res) => {
  const report = await DiseaseReport.findById(req.params.id);

  if (!report || report.farmer.toString() !== req.user.id) {
    return res.status(404).json({ message: "Report not found" });
  }

  await DiseaseReport.findByIdAndDelete(req.params.id);

  res.json({ message: "Report deleted successfully" });
});

// --------------------------------------------------------------
// 🌾 DISEASE DETECTION USING LOCAL YOLO MODEL
// Supported: Banana, Chilli, Radish, Groundnut, Cauliflower
// --------------------------------------------------------------
export const detectDiseaseML = asyncHandler(async (req, res) => {
  const { cropName } = req.body;

  if (!req.file) return res.status(400).json({ message: "Please upload an image." });
  if (!cropName) return res.status(400).json({ message: "Provide crop name." });

  // No rigid validation here, let the ML server handle crop-specific logic
  const normalizedCrop = cropName;

  try {
    let prediction = "Unknown";
    let confidence = 0;
    let mlData = {};
    let isAiAnalyzed = false;

    // --- Phase 1: Local ML Server (Fast) ---
    // Only try local ML if it's a supported crop to save time/resources
    if (SUPPORTED_CROPS.includes(normalizedCrop)) {
      try {
        const mlResponse = await requestPrediction({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          cropName: normalizedCrop,
        });
        mlData = mlResponse.data;
        prediction = mlData.predicted_class || mlData.class || mlData.disease || "Unknown";
        let conf = parseFloat(mlData.confidence || 0);
        confidence = conf <= 1 ? (conf * 100) : conf;
      } catch (err) {
        console.warn("[ML] Local server unavailable or failed:", err.message);
      }
    }

    // --- Phase 2: AI Vision Fallback (Gemini/Groq) ---
    // Trigger if: low confidence, unknown result, or unsupported crop (like Corn)
    if (confidence < 50 || prediction === "Unknown" || !SUPPORTED_CROPS.includes(normalizedCrop)) {
      console.log(`[*] Low confidence (${confidence}%) or unsupported crop. Triggering AI Vision analysis...`);
      try {
        // We need a path for analyzeCropDisease, so we save temp or use req.file
        // Since analyzeCropDisease expects an array of file objects with .path, we create a temporary one
        const tempPath = `public/uploads/temp_${Date.now()}.jpg`;
        fs.writeFileSync(tempPath, req.file.buffer);

        const aiAnalysis = await analyzeCropDisease([{ path: tempPath }], { cropName: normalizedCrop }, req.user.language || "en");

        prediction = aiAnalysis.detectedDisease;
        confidence = 95.0; // High confidence from LLM
        mlData.details = { diagnosis: aiAnalysis.diagnosis, recommendation: aiAnalysis.recommendation };
        isAiAnalyzed = true;

        // Cleanup temp file
        fs.unlinkSync(tempPath);
      } catch (aiErr) {
        console.error("[AI] Vision analysis failed:", aiErr.message);
      }
    }

    // Normalize confidence to 2 decimals
    confidence = Number(confidence.toFixed(2));

    // Upload image to Cloudinary for permanent storage
    const cloudinaryResult = await uploadToCloudinary(req.file, "disease-reports");

    const report = await DiseaseReport.create({
      farmer: req.user.id,
      cropName: normalizedCrop,
      prediction,
      confidence,
      imageURL: cloudinaryResult.secure_url,
      reportStatus: "pending_action",
    });

    // Clean up prediction name for YouTube Search
    const friendlyPrediction = prediction
      .replace(/^(banana|chilli|radish|groundnut|cauliflower|apple|tomato|potato|corn|grape|peach|pepper|soybean|strawberry|squash)_/i, '')
      .replace(/___/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const searchQuery = `${normalizedCrop} ${friendlyPrediction}`;
    const lang = req.user.language || "en";
    const langMap = { en: "English", hi: "Hindi", mr: "Marathi" };
    const languageName = langMap[lang] || "English";
    const groundingPrefix = lang === "mr" ? "शेती आणि पीक " : lang === "hi" ? "कृषि और फसल " : "Agriculture farming crop ";

    // Parallel fetch recommendations
    const videoResults = await Promise.allSettled([
      (async () => {
        const query = `${groundingPrefix}${searchQuery} treatment control management`;
        const fd = new FormData();
        fd.append("query", query);
        fd.append("language", languageName);
        fd.append("max_duration", "20");
        const mlRes = await axios.post(`${ML_SERVER_URL}/youtube-search`, fd, { headers: fd.getHeaders(), timeout: 12000 });
        return mlRes.data?.success ? mlRes.data.videos : [];
      })(),
      (async () => {
        const query = `${groundingPrefix}${normalizedCrop} yield recovery growth boost fertilizers`;
        const fd = new FormData();
        fd.append("query", query);
        fd.append("language", languageName);
        fd.append("max_duration", "20");
        const mlRes = await axios.post(`${ML_SERVER_URL}/youtube-search`, fd, { headers: fd.getHeaders(), timeout: 12000 });
        return mlRes.data?.success ? mlRes.data.videos : [];
      })()
    ]);

    const videos = videoResults[0].status === 'fulfilled' ? videoResults[0].value : [];
    const recoveryVideos = videoResults[1].status === 'fulfilled' ? videoResults[1].value : [];

    res.json({
      success: true,
      message: isAiAnalyzed ? "Disease detected via AI analysis" : "Disease detected",
      yield_estimation: mlData.yield_estimation || "N/A",
      details: mlData.details || {},
      videos,
      recoveryVideos,
      report: {
        _id: report._id,
        prediction,
        confidence,
        cropName: normalizedCrop,
        imageURL: report.imageURL,
        createdAt: report.createdAt,
      },
    });

    // ── WhatsApp Automation (Background) ──
    try {
      if (req.user.mobileNumber) {
        sendWhatsAppReport({
          to: req.user.mobileNumber,
          farmerName: req.user.fullName,
          cropName: normalizedCrop,
          diseaseName: prediction,
          confidence: confidence,
          imageURL: report.imageURL,
          summary: mlData.details?.diagnosis || "",
        });
      }
    } catch (wsErr) {
      console.error("[WhatsApp] Automation trigger failed:", wsErr.message);
    }

  } catch (error) {
    console.error("ML prediction error:", error.message);

    // Check if ML server is not running
    if (error.code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED")) {
      return res.status(503).json({
        message: "ML server is not running. Please start it: cd crop_project && python app.py",
        error: "ML_SERVER_OFFLINE",
      });
    }

    return res.status(500).json({
      message: "ML prediction failed",
      error: error.message,
    });
  }
});

// --------------------------------------------------------------
// 🌾 CROP IDENTIFICATION & RELEVANCE CHECK
// --------------------------------------------------------------
export const identifyCropML = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please upload an image." });

  try {
    console.log(`[*] Sending ID request to Gemini AI for superior accuracy`);
    const aiResult = await identifyCropWithAI(req.file.buffer, req.file.mimetype);

    // For debugging and tracking
    console.log(`[+] AI Result: Relevant=${aiResult.relevant}, Crop=${aiResult.detectedCrop} (${aiResult.confidence}%)`);

    // Normalize detected crop name to match frontend IDs
    if (aiResult.detectedCrop) {
      aiResult.detectedCrop = aiResult.detectedCrop
        .replace(/_\(maize\)/i, '')
        .replace(/,.*$/i, '')
        .replace(/_/g, ' ')
        .split(' ')[0]; // Take first word (e.g. "Corn" from "Corn (maize)")

      // Capitalize
      aiResult.detectedCrop = aiResult.detectedCrop.charAt(0).toUpperCase() + aiResult.detectedCrop.slice(1).toLowerCase();
    }

    res.json(aiResult);
  } catch (error) {
    console.error("AI Identification error:", error.message);

    // Fallback to local ML server if Gemini fails
    try {
      console.log(`[*] Falling back to local ML Server: ${ML_SERVER_URL}/identify-crop`);
      const formData = new FormData();
      formData.append("file", req.file.buffer, {
        filename: req.file.originalname || "upload.jpg",
        contentType: req.file.mimetype || "image/jpeg",
      });

      const mlResponse = await axios.post(`${ML_SERVER_URL}/identify-crop`, formData, {
        headers: formData.getHeaders(),
        timeout: 10000,
      });

      let resData = mlResponse.data;
      if (resData.detectedCrop) {
        resData.detectedCrop = resData.detectedCrop
          .replace(/_\(maize\)/i, '')
          .replace(/,.*$/i, '')
          .replace(/_/g, ' ')
          .split(' ')[0];
        resData.detectedCrop = resData.detectedCrop.charAt(0).toUpperCase() + resData.detectedCrop.slice(1).toLowerCase();
      }

      res.json(resData);
    } catch (fallbackError) {
      res.status(500).json({
        message: "Crop identification failed",
        error: fallbackError.message,
        primaryError: error.message
      });
    }
  }
});
