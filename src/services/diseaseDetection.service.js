import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

/**
 * AI service - supports both Gemini (preferred) and Groq (backup).
 */
const createGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

const stripFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

const normalizeAndParseJSON = (raw) => {
  let text = stripFences(raw);
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`Unable to parse JSON from AI response: ${text.slice(0, 100)}`);
  }
};

/**
 * Identifies the crop and checks relevance using Gemini Vision capabilities.
 */
export const identifyCropWithAI = async (fileBuffer, mimeType) => {
  const base64Image = fileBuffer.toString("base64");
  const gemini = createGeminiClient();
  if (!gemini) throw new Error("GEMINI_API_KEY missing");

  try {
    console.log("[AI] identifying crop with Gemini Nano Banana...");
    const model = gemini.getGenerativeModel({ model: "nano-banana-pro-preview" });
    const prompt = `
      Analyze this agricultural image. Focus ONLY on the plant/leaf.
      1. Is this a plant/crop? (relevant: true/false)
      2. Identify the crop from this EXACT list: [Banana, Chilli, Radish, Groundnut, Cauliflower, Tomato, Potato, Corn, Grape, Apple, Orange, Pepper, Strawberry, Blueberry, Cherry, Peach, Squash, Raspberry, Soybean].
      If the crop is not in the list but is a plant, set relevant: true and specify the crop name.
      Return ONLY valid JSON:
      {
        "relevant": true,
        "detectedCrop": "Corn", 
        "confidence": 98.5,
        "explanation": "Brief reasoning"
      }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: mimeType || "image/jpeg" } }
    ]);
    return normalizeAndParseJSON(result.response.text());
  } catch (err) {
    console.error("[AI] Gemini identification failed:", err.message);
    throw err;
  }
};

/**
 * Analyzes crop disease using the best available Vision LLM (Gemini preferred).
 * Especially useful for crops not in our training set (like Corn).
 */
export const analyzeCropDisease = async (images, cropInfo, language) => {
  const gemini = createGeminiClient();
  if (!gemini) throw new Error("GEMINI_API_KEY missing");

  const targetLanguage = language === "mr" ? "Marathi" : language === "hi" ? "Hindi" : "English";
  const prompt = `
    Agricultural expert role. Analyze images of ${cropInfo.cropName}.
    Diagnosis in ${targetLanguage}. Return ONLY JSON:
    {
      "detectedDisease": "Disease Name (English)",
      "diagnosis": "Detailed explanation in ${targetLanguage}",
      "recommendation": "Step-by-step treatment in ${targetLanguage}"
    }
  `;

  try {
    console.log("[AI] expert analysis with Gemini Nano Banana...");
    const model = gemini.getGenerativeModel({ model: "nano-banana-pro-preview" });
    const imageParts = await Promise.all(images.map(async (file) => {
      const buffer = fs.readFileSync(file.path);
      return { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } };
    }));
    const result = await model.generateContent([prompt, ...imageParts]);
    return normalizeAndParseJSON(result.response.text());
  } catch (err) {
    console.error("[AI] Gemini analysis failed:", err.message);
    throw err;
  }
};
