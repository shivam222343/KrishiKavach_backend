import asyncHandler from 'express-async-handler';
import { getWeatherData } from '../services/weather.service.js';

/**
 * @desc    Get weather for the logged-in farmer
 * @route   GET /api/v1/weather
 * @access  Private (Farmer)
 */
export const getWeatherForFarmer = asyncHandler(async (req, res) => {
  // req.user is added by your 'protect' middleware
  const user = req.user;

  // Check if the user has a location stored in their profile
  const coords = user.location?.coordinates;
  if (!coords || !Array.isArray(coords) || coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
    return res.status(400).json({ message: 'User location invalid or not found. Please update profile map.' });
  }

  // MongoDB GeoJSON stores coordinates as [Longitude, Latitude]
  const [lon, lat] = coords;

  // Use the farmer's preferred language from their profile
  // Open-Meteo standard forecast doesn't use 'language' param for data, but we keep lang for future logic
  const lang = user.language || 'en';

  // Call the service to get data from the external API
  const weatherData = await getWeatherData(lat, lon, lang);

  res.status(200).json(weatherData);
});