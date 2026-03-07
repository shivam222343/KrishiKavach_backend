/**
 * AI service — uses Google Gemini 1.5 Pro API.
 * GEMINI_API_KEY in .env must be your Google AI key.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  hinglish: "Hinglish",
};

/**
 * Multi-Provider Client Factory (Gemini preferred, Groq fallback)
 */
const createAIModel = (userApiKey = null) => {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No AI API key found. Please configure it in your profile.");

  // Detect Provider: Groq keys usually start with 'gsk_'
  const isGroq = apiKey.startsWith('gsk_') || apiKey.includes('groq');

  if (isGroq) {
    console.log(`[AI] Using Groq Provider (Llama 3.3 70b)`);
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    return {
      provider: 'groq',
      generateContent: async (prompt) => {
        const res = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        return { response: { text: () => res.choices[0].message.content } };
      },
      // Chat completion simplified for now
      chat: async (messages, systemPrompt) => {
        const res = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
          ],
          model: "llama-3.3-70b-versatile",
        });
        return res.choices[0].message.content;
      }
    };
  }

  console.log(`[AI] Using Gemini Provider (Nano Banana)`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "nano-banana-pro-preview" });
  return {
    provider: 'gemini',
    model, // original model for specific methods
    generateContent: async (prompt) => model.generateContent(prompt),
    chat: async (messages, systemPrompt) => {
      const chat = model.startChat({
        history: messages.slice(0, -1).map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
      });
      const result = await chat.sendMessage([{ text: systemPrompt }, { text: messages[messages.length - 1].content }]);
      return result.response.text();
    }
  };
};

const stripFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

const DEVANAGARI_DIGIT_MAP = {
  '\u0966': '0', '\u0967': '1', '\u0968': '2', '\u0969': '3', '\u096a': '4',
  '\u096b': '5', '\u096c': '6', '\u096d': '7', '\u096e': '8', '\u096f': '9',
};

const normalizeAndParseJSON = (raw) => {
  let text = stripFences(raw);
  text = text.replace(/[\u0966-\u096f]/g, (ch) => DEVANAGARI_DIGIT_MAP[ch] || ch);

  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(text.slice(start, end + 1));
      }
    } catch (innerError) {
      console.error("[AI] JSON Parse failed:", innerError.message, "Raw:", text.slice(0, 100));
    }
    // Return a structured safe fallback instead of throwing
    return {
      summary: "Market analysis temporarily unavailable.",
      trend: "stable",
      trendPercent: 0,
      localMarkets: [],
      majorMarkets: [],
      priceHistory: []
    };
  }
};

const PROJECT_KNOWLEDGE = `
Krishi Kavach is an AI-powered agricultural platform for Indian farmers.
Features: Disease detection (Tri-Model Ensemble), Weather impact analysis, Market prices, Govt schemes, and Agronomist consultation.
Infrastructure: Node.js Backend, React Frontend, Python ML Server (FastAPI).
AI Providers: Gemini 1.5 Pro (Primary Advisory), YOLOv8/EfficientNet/MobileNet (ML Detection).
`;

/**
 * 1. STRUCTURED DISEASE ADVISORY (Gemini 1.5 Pro)
 */
export const getCropDiseaseInfo = async (cropName, diseaseName, language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";
  const isHealthy = diseaseName?.toLowerCase().includes("healthy");

  const prompt = isHealthy
    ? `Agricultural Advisor: ${cropName} is HEALTHY. Provide care tips in ${langName}.
Return JSON: { "title", "summary", "symptoms": [], "causes": [], "treatment": [], "prevention": [], "severity": "None", "naturalRemedies": [], "yieldImpact", "yieldRecoveryTips": [] }`
    : `Agricultural Pathologist: ${diseaseName} in ${cropName}. 
Provide detailed advisory in ${langName} using this structure:
Return JSON:
{
  "title": "${diseaseName} in ${cropName}",
  "summary": "Impact and urgency in ${langName}",
  "symptoms": ["Visible sign 1", "Visible sign 2", "Visible sign 3"],
  "causes": ["Root pathogen", "Environmental factors"],
  "treatment": ["Step-by-step chemical treatment", "Biological/Organic treatment"],
  "prevention": ["Future-proofing step 1", "Future-proofing step 2"],
  "severity": "Low/Medium/High",
  "naturalRemedies": ["Organic remedy details"],
  "yieldImpact": "Percentage loss if untreated",
  "yieldRecoveryTips": ["How to boost yield post-recovery"]
}
CRITICAL: Use standard numbers (0-9). Language: ${langName}.`;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};

/**
 * 2. GLOBAL CHATBOT
 */
export const chatWithAI = async (messages, pageContext = "", language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const systemPrompt = `You are Krishi Kavach AI. Respond in ${langName}. Scope: Farming and Krishi Kavach app. Knowledge: ${PROJECT_KNOWLEDGE}. Context: ${pageContext}`;

  const lastMsg = messages[messages.length - 1].content;
  const reply = await model.chat(messages, systemPrompt);
  return reply.trim();
};

/**
 * 3. CROP MANAGEMENT
 */
export const getCropManagementInfo = async (cropName, area, areaUnit, language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Agricultural consultant: Guide for ${cropName} on ${area} ${areaUnit} in ${langName}. 
Return JSON with full management lifecycle (Soil, Seed, Sowing, Irrigation, Fertilizers, Pest, Harvest, Cost/Profit).`;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};

/**
 * 4. WEATHER IMPACT
 */
export const getWeatherCropImpact = async (cropName, currentWeather, dailyForecast, language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Agricultural Meteorologist: Analyze the impact of weather on ${cropName} in ${langName} (${language}).
Current Weather Data: ${JSON.stringify(currentWeather)}
7-Day Forecast Data: ${JSON.stringify(dailyForecast)}

Return ONLY valid JSON in this exact structure:
{
  "overallStatus": "Excellent" | "Good" | "Moderate" | "Caution" | "Critical",
  "overallScore": number (0-100),
  "overallMessage": "General summary sentence in ${langName}",
  "impacts": [
    {
      "factor": "Temperature",
      "currentValue": "28°C",
      "status": "optimal" | "good" | "warning" | "danger",
      "icon": "🌡️",
      "impact": "Detailed explanation of impact in ${langName}",
      "recommendation": "What to do in ${langName}"
    },
    { "factor": "Humidity", "currentValue": "65%", "status": "good", "icon": "💧", "impact": "...", "recommendation": "..." },
    { "factor": "Wind", "currentValue": "12km/h", "status": "optimal", "icon": "💨", "impact": "...", "recommendation": "..." }
  ],
  "immediateActions": ["Action 1 in ${langName}", "Action 2 in ${langName}"],
  "keyRisks": ["Risk 1 in ${langName}", "Risk 2 in ${langName}"],
  "weeklyAdvisory": [
    { "day": "Monday", "alertLevel": "info" | "warning" | "danger", "advice": "Advice for this day in ${langName}" }
  ]
}
CRITICAL: Return ONLY JSON. Ensure all lists are non-empty arrays. Use ${langName} for all text.`;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};

/**
 * 5. MARKET PRICES
 */
export const getMarketPrices = async (commodity, district = "Nashik", state = "Maharashtra", userApiKey = null) => {
  const model = createAIModel(userApiKey);

  const prompt = `Market Analyst: realistic commodity prices for ${commodity} in ${district}, ${state}.
Return JSON only: { "summary": string, "trend": "rising"|"falling"|"stable", "trendPercent": number, "localMarkets": [{ "marketName": string, "modalPrice": number, "minPrice": number, "maxPrice": number, "district": string, "distance": string, "arrivalQty": string }], "majorMarkets": [{ "marketName": string, "city": string, "state": string, "modalPrice": number }], "priceHistory": [{ "date": "YYYY-MM-DD", "price": number }], "seasonalInsight": string, "bestTimeToSell": string }.
IMPORTANT: summary, seasonalInsight, and bestTimeToSell MUST be strings, NOT objects.`;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};

/**
 * 6. SEED & YIELD
 */
export const getSeedAndYieldAdvice = async (farmInfo, language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Consultant: Seed/Yield for ${JSON.stringify(farmInfo)} in ${langName}.
Return JSON: seedRecommendations[], yieldAnalysis, marketContext.`;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};

/**
 * 7. GOVT SCHEMES
 */
export const getRecommendedSchemes = async (user, language = "en", userApiKey = null) => {
  const model = createAIModel(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `
    Agricultural Govt Advisor: Provide 5 tailored government schemes for farmer "${user.fullName}" 
    living in "${user.address?.district || 'India'}". 
    Context: The farmer is looking for support in ${language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English'}.
    
    Return ONLY valid JSON in this structure:
    {
      "summary": "A brief overview (2 sentences) of how these schemes help this specific farmer.",
      "recommendations": [
        {
          "id": "unique_string_id",
          "title": "Full Scheme Name",
          "shortDescription": "20-word summary",
          "tags": ["Subsidy", "Irrigation", "Technology"],
          "lastDate": "D-M-YYYY or 'Ongoing'",
          "eligibility": "Who can apply?",
          "relevanceReason": "Why this matches this farmer's profile?",
          "benefits": ["Benefit 1", "Benefit 2"],
          "documentsRequired": ["Aadhaar", "Land Records"],
          "applicationSteps": ["Step 1", "Step 2"],
          "websiteUrl": "https://pib.gov.in"
        }
      ]
    }
    All content (except keys/URLs) MUST be in ${langName}.
  `;

  const result = await model.generateContent(prompt);
  return normalizeAndParseJSON(result.response.text());
};
