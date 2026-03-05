import asyncHandler from "express-async-handler";
import { checkMLServerStatus, startMLServer } from "../services/mlServer.service.js";

/**
 * Check ML server status and start if not running
 * @route GET /api/v1/ml-server/status
 */
export const getMLServerStatus = asyncHandler(async (req, res) => {
  try {
    const isRunning = await checkMLServerStatus();

    if (isRunning) {
      return res.json({
        mlServerStatus: "running",
      });
    }

    // ML server NOT running → Start the server
    try {
      await startMLServer();

      return res.json({
        mlServerStatus: "starting",
      });
    } catch (err) {
      console.error("Failed to start ML server:", err);

      return res.status(500).json({
        mlServerStatus: "error",
        message: "Failed to start ML server",
        error: err.message,
      });
    }

  } catch (error) {
    console.error("Error checking ML server:", error);

    return res.status(500).json({
      mlServerStatus: "error",
      message: "Error checking ML server status",
      error: error.message,
    });
  }
});
