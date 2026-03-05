import axios from 'axios';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches weather data from the Open-Meteo API.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} lang - Preferred language (optional)
 * @returns {Promise<object>} The weather data from the API.
 */
export const getWeatherData = async (lat, lon, lang = 'en') => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        // Request current weather and key agricultural data
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
        // Request daily forecast data for today and next 7 days (8 days total)
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
        // Set forecast days to 8 (today + next 7 days)
        forecast_days: 8,
        timezone: 'auto', // Automatically detect timezone for accurate daily forecasts
        language: lang     // Added to support language parameter from controller
      },
    });

    return response.data;
  } catch (error) {
    console.error('Open-Meteo API Error:', error.response?.data?.reason || error.message);
    throw new Error('Could not retrieve weather information.');
  }
};
