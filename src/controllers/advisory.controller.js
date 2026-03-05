import asyncHandler from 'express-async-handler';
import { generateAdvisories } from '../services/advisory.service.js';

export const getAdvisoriesForFarmer = asyncHandler(async (req, res) => {
  const advisories = await generateAdvisories(req.user);
  res.status(200).json(advisories);
});