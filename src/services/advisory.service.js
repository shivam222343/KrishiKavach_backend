import OpenAI from "openai";
import { getWeatherData } from "./weather.service.js";
import Crop from "../models/crop.model.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * AI service - uses Groq's Llama models for advisories.
 */
const createClient = () => {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("No Groq API key found in .env");
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
};

/**
 * Generates AI-powered weather advisories for a user's crops.
 */
export const generateAdvisories = async (user) => {
  try {
    const [lon, lat] = user.location.coordinates;
    const userCrops = await Crop.find({ farmer: user._id });

    if (userCrops.length === 0) return [];

    const weatherData = await getWeatherData(lat, lon);
    const cropNames = userCrops.map((c) => c.cropName);
    const weatherForecastString = JSON.stringify(weatherData.daily, null, 2);

    const prompt = `
      You are an expert agronomist for Indian agriculture. 
      Analyze the provided 7-day weather forecast for a farmer in Maharashtra growing these crops: ${cropNames.join(", ")}.

      Forecast Data: ${weatherForecastString}

      Identify potential threats (disease, pests, waterlogging, heat stress, etc.) for each crop.
      Return a JSON array of objects with this structure:
      [
        {
          "cropName": "string",
          "threatLevel": "Low" | "Medium" | "High",
          "threat": "string",
          "recommendation": "string",
          "impactDay": "YYYY-MM-DD"
        }
      ]
    `;

    const client = createClient();
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const advisories = JSON.parse(content);

    // Handle case where LLM returns object with array inside
    return Array.isArray(advisories) ? advisories : Object.values(advisories)[0];
  } catch (error) {
    console.error("Error generating Groq advisory:", error.message);
    return [
      {
        cropName: "System Alert",
        threatLevel: "Medium",
        threat: "Could not generate AI advisory at this time.",
        recommendation: "Please try again later.",
        impactDay: new Date().toISOString().split("T")[0],
      },
    ];
  }
};
