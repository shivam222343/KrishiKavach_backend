import express from 'express';
import { getWeatherForFarmer } from '../controllers/weather.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Define the route: GET request to the root ('/') of this router
// protect: Ensures a user must be logged in.
// authorizeRoles('farmer'): Ensures only users with the 'farmer' role can access this.
router.route('/').get(protect, authorizeRoles('farmer'), getWeatherForFarmer);

export default router;