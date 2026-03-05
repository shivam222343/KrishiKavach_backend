import axios from "axios";

// 🏠 Local ML server (FastAPI running crop_project/app.py on port 8000)
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://localhost:8000";

// ----------------------------------------------------------------------
// 1️⃣ Check if local ML server is alive
// ----------------------------------------------------------------------
export const checkMLServerStatus = async () => {
  try {
    const res = await axios.get(`${ML_SERVER_URL}/health`, { timeout: 5000 });
    const status = String(res.data?.status || "").toLowerCase();
    return status.includes("running");
  } catch {
    return false;
  }
};

// ----------------------------------------------------------------------
// 2️⃣ Wait for local ML server to start (short timeout — local is fast)
// ----------------------------------------------------------------------
export const waitForMLServer = async (maxWait = 10000) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const alive = await checkMLServerStatus();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
};

// ----------------------------------------------------------------------
// 3️⃣ "Start" — just verify the local server is reachable
// ----------------------------------------------------------------------
export const startMLServer = async () => {
  console.log("Checking local ML server at", ML_SERVER_URL);
  const ready = await waitForMLServer(10000);
  if (!ready) {
    throw new Error(
      "Local ML server is not running. " +
      "Please start it with: cd crop_project && python app.py"
    );
  }
  console.log("Local ML server is ready.");
};

// ----------------------------------------------------------------------
// 4️⃣ Predict (Node → local FastAPI → result back to frontend)
// ----------------------------------------------------------------------
export const runPrediction = async (imageBase64) => {
  try {
    const res = await axios.post(
      `${ML_SERVER_URL}/predict`,
      { image: imageBase64 },
      { timeout: 30000 }
    );
    return res.data;
  } catch (err) {
    console.error("Prediction error:", err.message);
    throw new Error("Failed to get prediction from local ML server");
  }
};
