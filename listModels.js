import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No GEMINI_API_KEY found");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log("--- Available Models ---");
        if (data.models) {
            data.models.forEach(m => console.log(`${m.name} - ${m.supportedGenerationMethods}`));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (err) {
        console.error("Failed to list models:", err.message);
    }
}

listModels();
