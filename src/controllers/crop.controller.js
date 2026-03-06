import asyncHandler from 'express-async-handler';
import Crop from '../models/crop.model.js';

// --- Add Crop ---
export const addCrop = asyncHandler(async (req, res) => {
  const { cropName, cropVariety, plantingDate, area } = req.body;

  // Ensure area is structured correctly for the model
  const areaData = typeof area === 'object' ? area : { value: parseFloat(area), unit: 'acres' };

  const crop = await Crop.create({
    farmer: req.user.id,
    cropName,
    cropVariety,
    plantingDate,
    area: areaData,
  });

  console.log(`[Crops] New crop added for user ${req.user.id}: ${cropName}`);
  res.status(201).json({ message: 'Crop added', crop });
});

// --- Get All Crops for Farmer ---
export const getCrops = asyncHandler(async (req, res) => {
  console.log(`[Crops] Fetching crops for user ${req.user.id}...`);
  const crops = await Crop.find({ farmer: req.user.id }).sort({ createdAt: -1 });
  console.log(`[Crops] Found ${crops.length} crops for user ${req.user.id}`);
  res.json(crops);
});

// --- Delete Crop ---
export const deleteCrop = asyncHandler(async (req, res) => {
  const crop = await Crop.findById(req.params.id);
  if (!crop || crop.farmer.toString() !== req.user.id) return res.status(404).json({ message: 'Crop not found' });
  await crop.deleteOne();
  res.json({ message: 'Crop deleted' });
});

// --- Get Crops by Farmer ID (for Agronomist) ---
export const getCropsByFarmer = asyncHandler(async (req, res) => {
  const { farmerId } = req.params;
  const crops = await Crop.find({ farmer: farmerId }).populate('farmer', 'fullName');
  res.json(crops);
});