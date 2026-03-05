/**
 * AI service — uses Groq API (OpenAI-compatible).
 * GROK_API_KEY in .env must be your Groq API key (gsk_...).
 */
import OpenAI from "openai";

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  hinglish: "Hinglish (Hindi written in English script with a mix of English words)",
};

const createClient = (userApiKey = null) => {
  const apiKey = userApiKey || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("No Groq API key found. Please configure it in your profile.");
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
};

const stripFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

/**
 * Robustly parse a JSON string coming from an LLM.
 * Handles:
 *  1. Markdown code fences (```json ... ```)
 *  2. Devanagari / Gujarati / Bengali / etc. digits that break JSON.parse
 *     e.g. १ २ ३ ४ -> 1 2 3 4
 *  3. Fallback: extract the outermost { ... } block if surrounding prose slips in.
 */
const DEVANAGARI_DIGIT_MAP = {
  // Devanagari  \u0966-\u096f
  '\u0966': '0', '\u0967': '1', '\u0968': '2', '\u0969': '3', '\u096a': '4',
  '\u096b': '5', '\u096c': '6', '\u096d': '7', '\u096e': '8', '\u096f': '9',
  // Gujarati     \u0ae6-\u0aef
  '\u0ae6': '0', '\u0ae7': '1', '\u0ae8': '2', '\u0ae9': '3', '\u0aea': '4',
  '\u0aeb': '5', '\u0aec': '6', '\u0aed': '7', '\u0aee': '8', '\u0aef': '9',
  // Bengali      \u09e6-\u09ef
  '\u09e6': '0', '\u09e7': '1', '\u09e8': '2', '\u09e9': '3', '\u09ea': '4',
  '\u09eb': '5', '\u09ec': '6', '\u09ed': '7', '\u09ee': '8', '\u09ef': '9',
  // Arabic-Indic \u0660-\u0669
  '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
  '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
};

const normalizeAndParseJSON = (raw) => {
  // 1. Strip markdown fences
  let text = stripFences(raw);

  // 2. Replace regional digits with ASCII equivalents
  text = text.replace(/[\u0966-\u096f\u0ae6-\u0aef\u09e6-\u09ef\u0660-\u0669]/g,
    (ch) => DEVANAGARI_DIGIT_MAP[ch] || ch);

  // 3. Try direct parse
  try {
    return JSON.parse(text);
  } catch (_) {
    // 4. Fallback: extract the outermost { ... } block
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`Unable to parse JSON from LLM response: ${text.slice(0, 200)}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  KRISHI KAVACH PROJECT KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────
const PROJECT_KNOWLEDGE = `
# Krishi Kavach — Complete Project Knowledge Base

## What is Krishi Kavach?
Krishi Kavach (meaning "Crop Shield" in Hindi) is an advanced agricultural platform built for Indian farmers.
It helps farmers detect crop diseases using AI, get weather forecasts, connect with local agronomists, manage their crops, and receive expert advisories — all in one place.
The app supports three languages: English, Hindi (हिंदी), and Marathi (मराठी).

## User Roles
1. **Farmer** — The primary user. Can detect crop diseases, manage crops, view weather, read advisories, and connect with local agronomists.
2. **Agronomist** — A verified agricultural expert. Can view local farmer profiles, provide advice, and manage their professional profile.
3. **Admin** — Platform administrator. Can manage farmers and agronomists, verify accounts, and oversee the system.

## Key Features & Pages

### 🏠 Home Page (/)
- Welcome page explaining what Krishi Kavach does
- Role selection cards: Farmer, Agronomist, Admin
- Feature highlights: Crop Management, Weather Forecast, Expert Advice
- Get Started / Go to Dashboard buttons

### 🔐 Authentication
- **Login (/login)**: Mobile number + password login. Supports JWT-based secure authentication with refresh tokens.
- **Register (/register)**: Full registration with name, mobile, role, location on map, optional ID proof for agronomists.

### 🌾 Farmer Dashboard (/farmer)
- Overview of all farmer features
- Quick cards linking to: My Crops, Disease Detection, Weather, Advisories
- Shows list of verified agronomists available in the farmer's district
- Location-based personalization — farmer sets their location on a map

### 🔬 Crop Disease Detection & Reports (/farmer/disease-reports)
- The flagship feature. Farmer selects a crop (Banana, Chilli, Radish, Groundnut, Cauliflower) and uploads a photo
- AI (YOLO model running on local Python server) detects diseases with a confidence score
- Supported diseases per crop:
  - Banana: Bract Mosaic Virus, Cordana Leaf Spot, Insect Pest Damage, Moko Disease, Panama Wilt, Pestalotiopsis Leaf Spot, Sigatoka, Yellow Sigatoka, Healthy
  - Cauliflower: Black Rot, Bacterial Spot Rot, Downy Mildew, Healthy
  - Chilli: Anthracnose, Leaf Curl, Leaf Spot, Whitefly Infestation, Yellowing, Healthy
  - Groundnut: Early Leaf Spot, Early Rust, Late Leaf Spot, Nutrition Deficiency, Rust, Healthy
  - Radish: Black Leaf Spot, Downy Mildew, Flea Beetle Damage, Mosaic Virus, Healthy
- After detection, Groq AI (Llama 3.3) provides detailed info: symptoms, causes, why disease occurs, treatment, prevention, natural remedies
- Results are saved as disease reports. Past reports can be viewed and deleted.
- An AI confidence < 50% or exactly 100% means the image was unprocessable

### 🌱 My Crops (/farmer/crops)
- Farmer can add, view, and delete their crops
- Keeps track of what crops they are growing

### 🌤️ Weather Page (/farmer/weather)
- Shows current weather conditions for the farmer's farm location
- 7-day weather forecast with temperature, humidity, wind speed, precipitation
- Auto-refreshes; uses OpenWeatherMap API
- Helps farmer plan irrigation, harvesting, spraying schedules

### 📋 Advisories Page (/farmer/advisories)
- Farm advisories and tips curated for Indian farmers
- Seasonal farming advice, pest alerts, best practices

### 👨‍💼 Agronomist Dashboard (/agronomist)
- Verified agricultural experts can see farmers in their area
- View farmer profiles and crop information
- Manage their professional agronomist profile

### 🛡️ Admin Dashboard (/admin)
- Manage all farmers (/admin/farmers)
- Manage all agronomists (/admin/agronomists), verify or reject their accounts
- Platform oversight

### 👤 Profile Page (/profile or /farmer/profile)
- View and edit: full name, mobile number, profile photo
- Change password
- Update farm location on an interactive map
- Language settings: switch between English, Hindi, Marathi

## Technology Used
- **Frontend**: React.js (Vite), TailwindCSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas
- **AI Disease Detection**: YOLO model (Python FastAPI local server)
- **AI Chat & Info**: Groq API (Llama 3.3 70B model)
- **Weather**: OpenWeatherMap API
- **Image Storage**: Cloudinary
- **Maps**: Leaflet.js / OpenStreetMap
- **Authentication**: JWT (access + refresh tokens)

## How to Use Krishi Kavach
1. Register as Farmer (or other role) with your mobile number and location
2. Login with your mobile number and password
3. Select your language (English / Hindi / Marathi)
4. Go to Disease Reports to scan your crop photo for diseases
5. Check Weather for your farm area
6. Read Advisories for seasonal tips
7. Find local Agronomists in your district on the Farmer Dashboard

## Benefits for Indian Farmers
- Early disease detection saves crops before damage spreads
- Free to use, no expensive lab testing needed
- Works in local languages (Hindi, Marathi)
- Connects farmers directly with certified agricultural experts nearby
- Weather forecasting helps in irrigation and spray planning
- Keeps a history of all disease detections for reference
`;

// ─────────────────────────────────────────────────────────────────────────────
//  1. STRUCTURED DISEASE / CARE INFO
// ─────────────────────────────────────────────────────────────────────────────
export const getCropDiseaseInfo = async (cropName, diseaseName, language = "en", userApiKey = null) => {
  const client = createClient(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";
  const isHealthy = diseaseName?.toLowerCase().includes("healthy");

  const prompt = isHealthy
    ? `You are an expert agricultural advisor for Indian farmers.
The AI model detected that the ${cropName} plant appears HEALTHY.
Provide comprehensive care tips for the farmer in ${langName}.
Return ONLY a valid JSON object (no markdown, no code fences):
{
  "title": "short heading in ${langName}",
  "summary": "2-3 sentence overview explaining why the plant is healthy and what keeps it that way, in ${langName}",
  "symptoms": [],
  "causes": [],
  "whyCausesDisease": [],
  "treatment": ["detailed care tip 1", "detailed care tip 2", "detailed care tip 3", "care tip 4"],
  "prevention": ["preventive measure 1", "preventive measure 2", "preventive measure 3", "preventive measure 4"],
  "severity": "None",
  "naturalRemedies": ["natural care tip 1", "natural care tip 2", "natural care tip 3"],
  "yieldImpact": "Brief note on why current health will maximize yield in ${langName}",
  "yieldRecoveryTips": ["tip to further boost yield 1 in ${langName}"]
}
All text values must be in ${langName}. Provide 3-5 items per array.`

    : `You are a senior agricultural plant pathologist and advisor for Indian farmers.
A crop disease AI model detected "${diseaseName}" in a "${cropName}" plant.
Provide comprehensive, practical, farmer-friendly information in ${langName}.
Return ONLY a valid JSON object (no markdown, no code fences):
{
  "title": "Disease name in ${langName}",
  "summary": "2-3 sentence overview of this disease, its impact and urgency in ${langName}",
  "symptoms": [
    "Detailed visible symptom 1 (colour, texture, where on plant) in ${langName}",
    "Detailed visible symptom 2 in ${langName}",
    "Detailed visible symptom 3 in ${langName}",
    "Detailed visible symptom 4 in ${langName}"
  ],
  "causes": [
    "Root cause 1 (pathogen name if applicable) in ${langName}",
    "Root cause 2 (environmental / host factor) in ${langName}",
    "Root cause 3 in ${langName}"
  ],
  "whyCausesDisease": [
    "Explain in simple language HOW cause 1 leads to the disease symptoms — why does it harm the plant? in ${langName}",
    "Explain WHY high humidity / certain weather conditions trigger this disease in ${langName}",
    "Explain WHY the pathogen spreads easily from plant to plant in ${langName}"
  ],
  "treatment": [
    "Step-by-step treatment 1 with specific product names if applicable in ${langName}",
    "Step-by-step treatment 2 in ${langName}",
    "Step-by-step treatment 3 in ${langName}",
    "Step-by-step treatment 4 in ${langName}"
  ],
  "prevention": [
    "Preventive measure 1 with exact timing/frequency in ${langName}",
    "Preventive measure 2 in ${langName}",
    "Preventive measure 3 in ${langName}",
    "Preventive measure 4 in ${langName}"
  ],
  "severity": "Medium",
  "naturalRemedies": [
    "Natural/organic remedy 1 with preparation instructions in ${langName}",
    "Natural/organic remedy 2 in ${langName}",
    "Natural/organic remedy 3 in ${langName}"
  ],
  "yieldImpact": "Specific percentage or description of crop loss if untreated in ${langName}",
  "yieldRecoveryTips": [
    "Tip to recover lost yield 1 (e.g. micronutrient spray) in ${langName}",
    "Tip 2 in ${langName}",
    "Tip 3 in ${langName}"
  ]
}
For severity choose exactly one of: "Low", "Medium", or "High".
All text values must be in ${langName}. Provide 3-5 items per array.
Be specific, practical and use simple farmer-friendly language.
CRITICAL: Use only ASCII digits (0-9) inside the JSON. Never use Devanagari (१२३) or regional numerals.`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  return normalizeAndParseJSON(response.choices[0].message.content);
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. GLOBAL CHATBOT — page-aware, project-scoped
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Array}  messages      [{role, content}]
 * @param {string} pageContext   Current page description passed from frontend
 * @param {string} language      "en" | "hi" | "mr"
 * @returns {string}
 */
export const chatWithAI = async (messages, pageContext = "", language = "en", userApiKey = null) => {
  try {
    const client = createClient(userApiKey);
    const langName = LANGUAGE_NAMES[language] || "English";

    const systemPrompt = `You are **Krishi Kavach AI Assistant** — a smart, friendly, and helpful chatbot embedded inside the Krishi Kavach agricultural platform built for Indian farmers.

${PROJECT_KNOWLEDGE}

## Current User Context
${pageContext ? `The user is currently on: ${pageContext}` : "The user is navigating the Krishi Kavach platform."}

## Your Behavior Rules (STRICTLY FOLLOW THESE)
1. **Language**: Always respond in ${langName}. Use simple, friendly language that a rural Indian farmer can understand.
2. **Scope**: You ONLY answer questions related to:
   - Krishi Kavach app features and how to use them
   - Crop diseases, treatment, prevention, natural remedies
   - Farming advice, crop care, irrigation, fertilizers, pesticides
   - Weather interpretation for farming
   - Agricultural best practices for Indian conditions
   - The current page the user is on and what they can do there
3. **Off-topic guard**: If someone asks something NOT related to farming, agriculture, or Krishi Kavach (e.g., movies, sports, politics, coding, general knowledge), politely respond in ${langName} that you can only help with farming and Krishi Kavach-related topics, and suggest a relevant farming question they could ask instead.
4. **Be helpful**: Give complete, actionable answers. Use bullet points for readability.
5. **Page awareness**: Use the current page context to give specific, relevant guidance. For example, on the Weather page, explain how to interpret weather for farming decisions.
6. **Safety**: When recommending chemicals/pesticides, always mention safety precautions.
7. **Encourage sustainable farming**: Recommend organic/natural options alongside chemical treatments.
8. **Honest**: If you don't know something specific, say so and suggest consulting a local agronomist.
9. **Warm tone**: Be encouraging and respectful. Farmers work hard — be their supportive advisor.`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }).catch(async (err) => {
      console.error("[!] AI Chat Error (Primary Model):", err.message);
      // Fallback to a smaller/faster model if 70B fails
      return client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.4,
        max_tokens: 1000,
      });
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("[!!] Fatal AI Service Error:", error.message);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. CROP MANAGEMENT INFO
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} cropName   - e.g. "Wheat"
 * @param {number} area       - e.g. 2.5
 * @param {string} areaUnit   - "acres" | "hectares" | "guntha"
 * @param {string} language   - "en" | "hi" | "mr"
 * @returns {object}          - Structured crop management guide
 */
export const getCropManagementInfo = async (cropName, area, areaUnit, language = "en", userApiKey = null) => {
  const client = createClient(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `You are an expert agricultural advisor for Indian farmers.
A farmer wants complete crop management guidance for growing "${cropName}" on ${area} ${areaUnit} of land.

Provide comprehensive, practical, farmer-friendly information in ${langName}.
Return ONLY a valid JSON object (no markdown, no code fences):
{
  "cropName": "${cropName}",
  "overview": "2-3 sentence summary of this crop and its importance in India in ${langName}",
  "bestSeason": "Best sowing season and months for this crop in India in ${langName}",
  "soilRequirements": {
    "type": "Ideal soil type in ${langName}",
    "ph": "Ideal pH range",
    "preparation": ["Soil preparation step 1 in ${langName}", "step 2", "step 3"]
  },
  "seedsRequired": "Estimated seeds/seedlings required for ${area} ${areaUnit} in ${langName} (with quantities)",
  "sowingMethod": "How to sow/plant this crop in ${langName}",
  "spacing": "Row and plant spacing in ${langName}",
  "irrigation": {
    "frequency": "How often to water in ${langName}",
    "method": "Best irrigation method (drip/flood/sprinkler) in ${langName}",
    "criticalStages": ["Critical watering stage 1 in ${langName}", "stage 2"]
  },
  "fertilizers": [
    {"name": "Fertilizer 1 name", "quantity": "Quantity for ${area} ${areaUnit}", "timing": "When to apply in ${langName}", "purpose": "Purpose in ${langName}"},
    {"name": "Fertilizer 2 name", "quantity": "Quantity for ${area} ${areaUnit}", "timing": "When to apply in ${langName}", "purpose": "Purpose in ${langName}"},
    {"name": "Fertilizer 3 name", "quantity": "Quantity for ${area} ${areaUnit}", "timing": "When to apply in ${langName}", "purpose": "Purpose in ${langName}"}
  ],
  "growthStages": [
    {"stage": "Stage name in ${langName}", "duration": "Duration in days", "care": "Care needed at this stage in ${langName}"},
    {"stage": "Stage 2 name", "duration": "Duration", "care": "Care needed"},
    {"stage": "Stage 3 name", "duration": "Duration", "care": "Care needed"},
    {"stage": "Stage 4 name", "duration": "Duration", "care": "Care needed"}
  ],
  "pestControl": [
    {"pest": "Common pest/disease name in ${langName}", "symptoms": "Symptoms in ${langName}", "remedy": "Treatment in ${langName}"}
  ],
  "harvest": {
    "duration": "Days from sowing to harvest in ${langName}",
    "signs": "Signs the crop is ready to harvest in ${langName}",
    "method": "How to harvest in ${langName}",
    "expectedYield": "Expected yield for ${area} ${areaUnit} in ${langName} (in kg/quintal)"
  },
  "estimatedCost": "Rough estimated total cost for ${area} ${areaUnit} in INR in ${langName}",
  "estimatedProfit": "Rough estimated profit/income for ${area} ${areaUnit} in ${langName}",
  "tips": ["Important success tip 1 in ${langName}", "tip 2", "tip 3", "tip 4"],
  "commonMistakes": ["Mistake to avoid 1 in ${langName}", "mistake 2", "mistake 3"],
  "durationDays": 120
}
All text values must be in ${langName}. Be specific with quantities scaled to ${area} ${areaUnit}. Use actual numbers. Keep language simple and farmer-friendly.
CRITICAL: Use only ASCII digits (0-9) in all JSON numeric values and quantity strings. Never use Devanagari (१२३) or any other regional numeral script inside the JSON.`;


  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return normalizeAndParseJSON(response.choices[0].message.content);
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. WEATHER CROP IMPACT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} cropName        - e.g. "Wheat"
 * @param {object} currentWeather  - { temperature, humidity, windSpeed, precipitation, weatherCode }
 * @param {Array}  dailyForecast   - [{ date, maxTemp, minTemp, precipitation, precipitationProbability, weatherCode }]
 * @param {string} language        - "en" | "hi" | "mr"
 * @returns {object}               - Structured impact analysis
 */
export const getWeatherCropImpact = async (cropName, currentWeather, dailyForecast, language = "en", userApiKey = null) => {
  const client = createClient(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const weatherSummary = `Current conditions: Temp=${currentWeather.temperature}°C, Feels=${currentWeather.feelsLike}°C, Humidity=${currentWeather.humidity}%, Wind=${currentWeather.windSpeed}km/h, Rain=${currentWeather.precipitation}mm today.`;
  const forecastSummary = dailyForecast
    .slice(0, 7)
    .map((d, i) => `Day${i + 1}(${d.date}): Max=${d.maxTemp}°C Min=${d.minTemp}°C Rain=${d.precipitation}mm Prob=${d.precipitationProbability}%`)
    .join(" | ");

  const prompt = `You are a senior agricultural meteorologist and crop advisor for Indian farmers.
Analyze the following weather data and explain how it will specifically impact "${cropName}" cultivation.
Respond ONLY in ${langName}.

Weather Data:
${weatherSummary}
7-Day Forecast: ${forecastSummary}

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "overallStatus": "one of: Excellent / Good / Moderate / Caution / Critical",
  "overallMessage": "1-2 sentence overall weather impact summary for ${cropName} in ${langName}",
  "overallScore": 75,
  "impacts": [
    {
      "factor": "Temperature",
      "icon": "🌡️",
      "currentValue": "${currentWeather.temperature}°C",
      "status": "one of: optimal / warning / danger / good",
      "impact": "How this temperature specifically affects ${cropName} growth, flowering, or yield in ${langName}",
      "recommendation": "Specific action farmer should take in ${langName}"
    },
    {
      "factor": "Humidity",
      "icon": "💧",
      "currentValue": "${currentWeather.humidity}%",
      "status": "one of: optimal / warning / danger / good",
      "impact": "How this humidity specifically affects ${cropName} — disease risk, fungal threats, etc. in ${langName}",
      "recommendation": "Specific action for humidity management in ${langName}"
    },
    {
      "factor": "Wind Speed",
      "icon": "💨",
      "currentValue": "${currentWeather.windSpeed} km/h",
      "status": "one of: optimal / warning / danger / good",
      "impact": "How this wind speed affects ${cropName} — lodging risk, pollination, spray drift, etc. in ${langName}",
      "recommendation": "Specific wind-related advice for ${cropName} in ${langName}"
    },
    {
      "factor": "Rainfall",
      "icon": "🌧️",
      "currentValue": "${currentWeather.precipitation} mm",
      "status": "one of: optimal / warning / danger / good",
      "impact": "How current and upcoming rainfall specifically affects ${cropName} water requirements, root health, and disease in ${langName}",
      "recommendation": "Irrigation or drainage advice for ${cropName} in ${langName}"
    }
  ],
  "weeklyAdvisory": [
    {
      "day": "Day label (e.g. Today, Tomorrow, Mon)",
      "alert": "Critical action or observation needed for ${cropName} on this specific day based on forecast in ${langName}",
      "alertLevel": "one of: info / warning / danger"
    }
  ],
  "keyRisks": [
    "Specific risk 1 for ${cropName} based on this week's weather in ${langName}",
    "Specific risk 2 in ${langName}",
    "Specific risk 3 in ${langName}"
  ],
  "immediateActions": [
    "Most urgent action to take today for ${cropName} in ${langName}",
    "Second action in ${langName}",
    "Third action in ${langName}"
  ],
  "bestTimeForActivities": {
    "spraying": "Best days this week for spraying pesticides/fertilizers based on forecast in ${langName}",
    "irrigation": "Irrigation schedule based on rainfall forecast in ${langName}",
    "harvesting": "If crop is near harvest, best days based on weather in ${langName}, or note it's not harvest season"
  }
}
For overallScore: 0-100 (100 = perfect weather for this crop). All text in ${langName}. Provide 7 entries in weeklyAdvisory (one per forecast day). Be specific — not generic farming advice, but advice tailored to ${cropName} and the exact weather data provided.
CRITICAL: Use only ASCII digits (0-9) inside the JSON. Never use Devanagari (१२३) or regional numerals.`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 2500,
  });

  return normalizeAndParseJSON(response.choices[0].message.content);
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. MARKET PRICES — AI-generated realistic price intelligence
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} commodity   - e.g. "Soybean"
 * @param {string} district    - User's district from profile
 * @param {string} state       - User's state
 * @returns {object}           - { localMarkets, majorMarkets, priceHistory, summary }
 */
export const getMarketPrices = async (commodity, district = "Nashik", state = "Maharashtra", userApiKey = null) => {
  const client = createClient(userApiKey);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const prompt = `You are an expert Indian agricultural market analyst with deep knowledge of mandi prices across India.
Today's date: ${todayStr}

Provide realistic, accurate commodity price intelligence for "${commodity}" based on current Indian market conditions.
District: ${district}, State: ${state}

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "commodity": "${commodity}",
  "unit": "quintal",
  "district": "${district}",
  "state": "${state}",
  "summary": "1-2 sentence market overview including trend for ${commodity} in ${state} right now",
  "trend": "rising",
  "trendPercent": 2.5,
  "localMarkets": [
    {
      "marketName": "Main market name in or near ${district}",
      "district": "${district}",
      "distance": "0 km (local)",
      "minPrice": 4200,
      "maxPrice": 4800,
      "modalPrice": 4500,
      "arrivalQty": "1200 quintals",
      "quality": "A"
    },
    {
      "marketName": "Nearest mandi 2",
      "district": "Nearby district name",
      "distance": "25 km",
      "minPrice": 4100,
      "maxPrice": 4700,
      "modalPrice": 4400,
      "arrivalQty": "800 quintals",
      "quality": "B"
    },
    {
      "marketName": "Nearest mandi 3",
      "district": "Another nearby district",
      "distance": "45 km",
      "minPrice": 4300,
      "maxPrice": 4900,
      "modalPrice": 4550,
      "arrivalQty": "2000 quintals",
      "quality": "A"
    },
    {
      "marketName": "Nearest mandi 4",
      "district": "4th nearby district",
      "distance": "60 km",
      "minPrice": 4000,
      "maxPrice": 4600,
      "modalPrice": 4300,
      "arrivalQty": "500 quintals",
      "quality": "C"
    }
  ],
  "majorMarkets": [
    { "marketName": "Top India market 1", "city": "City", "state": "State", "modalPrice": 4600, "trend": "rising", "note": "High arrivals" },
    { "marketName": "Top India market 2", "city": "City", "state": "State", "modalPrice": 4350, "trend": "stable", "note": "Stable demand" },
    { "marketName": "Top India market 3", "city": "City", "state": "State", "modalPrice": 4500, "trend": "rising", "note": "Export demand" },
    { "marketName": "Top India market 4", "city": "City", "state": "State", "modalPrice": 4150, "trend": "falling", "note": "Oversupply" },
    { "marketName": "Top India market 5", "city": "City", "state": "State", "modalPrice": 4700, "trend": "rising", "note": "Premium quality" },
    { "marketName": "Top India market 6", "city": "City", "state": "State", "modalPrice": 4250, "trend": "stable", "note": "Normal season" }
  ],
  "priceHistory": [
    { "date": "YYYY-MM-DD", "price": 4300 }
  ],
  "seasonalInsight": "Key seasonal factor affecting ${commodity} price right now",
  "bestTimeToSell": "Advice on when farmer should sell for maximum profit",
  "mspInfo": "MSP information for ${commodity} if applicable"
}

RULES:
- localMarkets: REAL mandi names geographically near ${district}, ${state}
- majorMarkets: actual top 6 commodity markets in India for ${commodity}
- priceHistory: exactly 30 entries going back 30 days from ${todayStr} with realistic daily fluctuations
- All prices in INR per quintal, realistic for Feb 2026 India
- trendPercent: % change over past 7 days (positive = rising)`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 3000,
  });

  const data = normalizeAndParseJSON(response.choices[0].message.content);

  // Fix priceHistory dates to be accurate
  if (Array.isArray(data.priceHistory)) {
    data.priceHistory = data.priceHistory.slice(0, 30).map((row, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return { date: d.toISOString().slice(0, 10), price: row.price || row.modalPrice || 4000 };
    });
  }

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. SEED & YIELD ADVICE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} farmInfo - { totalArea, soilType, irrigationType, address, farmingStage, targetYield, primaryCrops }
 * @param {string} language - "en" | "hi" | "mr"
 */
export const getSeedAndYieldAdvice = async (farmInfo, language = "en", userApiKey = null) => {
  const client = createClient(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `You are a professional agricultural consultant for Indian farmers.
Context:
Crop(s): ${farmInfo.primaryCrops?.join(", ")}
Farm Area: ${farmInfo.totalArea?.value} ${farmInfo.totalArea?.unit}
Soil: ${farmInfo.soilType}
Irrigation: ${farmInfo.irrigationType}
Location: ${farmInfo.address?.taluka}, ${farmInfo.address?.district}
Current Stage: ${farmInfo.farmingStage}
${farmInfo.targetYield ? `User's Target Yield: ${farmInfo.targetYield}` : ""}

Task:
1. Suggest 3 specific high-quality seed varieties suitable for these conditions.
2. Provide realistic yield expectations (in quintals/hectare or relevant unit) for these crops in this location.
3. If the user is at the 'starting' stage, suggest techniques to maximize initial yield.
4. If 'growing' or 'harvested', provide benchmarking against average yields for this district.

Return ONLY a valid JSON object:
{
  "seedRecommendations": [
    {
      "name": "Variety Name",
      "features": "Why it fits soil/climate in ${langName}",
      "duration": "Duration in days",
      "yieldPotential": "Potential yield in ${langName}",
      "storeType": "Typically available at ${langName}",
      "searchQuery": "Search term for seed image"
    }
  ],
  "yieldAnalysis": {
    "estimatedYield": "Suggested yield based on location/crops in ${langName}",
    "benchmarks": "How this compares to district average in ${langName}",
    "optimizationTips": ["Tip 1 in ${langName}", "Tip 2"]
  },
  "marketContext": "Current market demand for these crops in ${langName}"
}
All text in ${langName}. Use ASCII digits. No markdown.`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 2000,
  });

  return normalizeAndParseJSON(response.choices[0].message.content);
};
// ─────────────────────────────────────────────────────────────────────────────
//  7. GOVERNMENT SCHEMES RECOMMENDATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} user - User profile data
 * @param {string} language - "en" | "hi" | "mr"
 */
export const getRecommendedSchemes = async (user, language = "en", userApiKey = null) => {
  const client = createClient(userApiKey);
  const langName = LANGUAGE_NAMES[language] || "English";
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are a specialized Indian Government Schemes advisor for farmers.
Current Date: ${today}

Context of the Farmer:
- Name: ${user.fullName}
- Location: ${user.address?.taluka}, ${user.address?.district}
- Farm Size: ${user.farmInfo?.totalArea?.value} ${user.farmInfo?.totalArea?.unit}
- Crops: ${user.farmInfo?.primaryCrops?.join(", ")}
- Irrigation: ${user.farmInfo?.irrigationType}
- Soil: ${user.farmInfo?.soilType}

Your task is to recommend 5 highly relevant, REAL, and CURRENT (March 2026) Indian Government agriculture schemes for this specific farmer.
Use the following real schemes if they fit: PM-KISAN, PMFBY (Crop Insurance), Kisan Credit Card (KCC), PM-KUSUM (Solar Pumps), Soil Health Card, PKVY (Organic Farming), Agriculture Infrastructure Fund (AIF).

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "recommendations": [
    {
      "id": "unique-slug",
      "title": "Scheme Name in ${langName}",
      "shortDescription": "1-sentence catchy description in ${langName}",
      "benefits": ["Benefit 1 in ${langName}", "Benefit 2"],
      "eligibility": "Who can apply based on this farmer's profile in ${langName}",
      "documentsRequired": ["Aadhaar Card", "Land records", "Bank Passbook", "..."],
      "applicationSteps": ["Step 1 in ${langName}", "Step 2", "..."],
      "lastDate": "Real or estimated last date (e.g. 31 March 2026) in ${langName}",
      "websiteUrl": "Actual direct scheme application URL (not just portal)",
      "officialPortal": "Official government portal URL",
      "imageKeywords": "4-5 descriptive English keywords for a high-quality, professional image representing this scheme (e.g. 'modern solar panel farm field', 'indian woman farmer receiving gold coins', 'soil testing laboratory equipment', 'organic vegetable harvest indian farmer')",
      "tags": ["Subsidy", "Insurance", "Solar", "..." ],
      "relevanceReason": "Why this specific scheme is good for this farmer specifically in ${langName}"
    }
  ],
  "summary": "Short 2-sentence encouraging summary in ${langName} for ${user.fullName}"
}
All text values must be in ${langName}. Use ASCII digits. Be highly specific and helpful.`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 2500,
  });

  return normalizeAndParseJSON(response.choices[0].message.content);
};
