import dotenv from 'dotenv';
import { getCropDiseaseInfo, chatWithAI } from './src/services/gemini.service.js';

dotenv.config();

async function runTest() {
  console.log("--- Testing Gemini Nano Banana Advisory ---");
  try {
    const advisory = await getCropDiseaseInfo("Banana", "Sigatoka", "en");
    console.log("✅ Advisory Success (JSON):", JSON.stringify(advisory, null, 2));
  } catch (err) {
    console.error("❌ Advisory Failed:", err.message);
  }

  console.log("\n--- Testing Gemini Nano Banana Chat ---");
  try {
    const response = await chatWithAI([{ role: 'user', content: 'What are the main features of Krishi Kavach?' }], "Home Page", "en");
    console.log("✅ Chat Success:", response);
  } catch (err) {
    console.error("❌ Chat Failed:", err.message);
  }
}

runTest();