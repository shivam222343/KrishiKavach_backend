import express from "express";
import { getMLServerStatus } from "../controllers/mlServer.controller.js";

const router = express.Router();

// Public endpoint - no authentication required for ML server status check
router.get("/status", getMLServerStatus);

export default router;












