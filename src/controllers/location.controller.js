import asyncHandler from 'express-async-handler';
import Location from '../models/location.model.js';

export const addLocation = asyncHandler(async (req, res) => {
  const { district, taluka, geo } = req.body;
  const location = await Location.create({ district, taluka, geo });
  res.status(201).json(location);
});

export const listLocations = asyncHandler(async (req, res) => {
  const locations = await Location.find();
  res.json(locations);
});
