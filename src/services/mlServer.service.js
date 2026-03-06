import axios from "axios";

// ── Hugging Face Spaces URLs ────────────────────────────────────────────────
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "https://shivamdombe-ml-service.hf.space";
const CROP_ID_URL = process.env.CROP_IDENTIFIER_URL || "https://shivamdombe-crop-identifier.hf.space";
const ADVISORY_URL = process.env.ADVISORY_URL || "https://shivamdombe-appadvisory.hf.space";

// ----------------------------------------------------------------------
// 1️⃣  Check if Plant Disease Detection service is alive
// ----------------------------------------------------------------------
export const checkMLServerStatus = async () => {
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 10000 });
    const status = String(res.data?.status || "").toLowerCase();
    return status === "ready" || status === "ok";
  } catch {
    return false;
  }
};

// ----------------------------------------------------------------------
// 2️⃣  Wait for the ML service to start (HF cold start can take ~60 s)
// ----------------------------------------------------------------------
export const waitForMLServer = async (maxWait = 60000) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const alive = await checkMLServerStatus();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
};

// ----------------------------------------------------------------------
// 3️⃣  Verify all 3 HF Spaces are reachable
// ----------------------------------------------------------------------
export const startMLServer = async () => {
  console.log("Checking HF Spaces:");
  console.log("  ML Service   →", ML_SERVICE_URL);
  console.log("  Crop ID      →", CROP_ID_URL);
  console.log("  Advisory     →", ADVISORY_URL);

  const ready = await waitForMLServer(60000);
  if (!ready) {
    console.warn("⚠ Plant Disease Detection service not reachable — predictions may fail until it wakes up.");
  } else {
    console.log("✓ ML Service ready.");
  }
};

// ----------------------------------------------------------------------
// 4️⃣  Predict (Node → HF Space → result back to frontend)
// ----------------------------------------------------------------------
export const runPrediction = async (imageBase64) => {
  try {
    const res = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      { image: imageBase64 },
      { timeout: 60000 }
    );
    return res.data;
  } catch (err) {
    console.error("Prediction error:", err.message);
    throw new Error("Failed to get prediction from ML service");
  }
};

// Export URLs so other modules can use them directly
export { ML_SERVICE_URL, CROP_ID_URL, ADVISORY_URL };
