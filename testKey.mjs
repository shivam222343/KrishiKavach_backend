/**
 * Quick test — run from backend/ folder:
 *   node testKey.mjs
 */
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const key = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", key ? `✅ FOUND (${key.slice(0, 10)}... len=${key.length})` : "❌ NOT FOUND");

if (!key) process.exit(1);

const ai = new GoogleGenAI({});   // picks up GEMINI_API_KEY automatically

console.log("Calling Gemini 2.0 Flash...");
const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Return this JSON exactly: { "status": "ok", "message": "Gemini is working!" }`,
    config: { responseMimeType: "application/json" },
});

console.log("Response:", response.text);
console.log("✅ Gemini API is working correctly!");
