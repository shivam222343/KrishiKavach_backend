import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';
import Media from '../models/media.model.js';
import AgronomistProfile from '../models/agronomistProfile.model.js';
import ProcessingCenter from '../models/processingCenter.model.js';
import Seed from '../models/seed.model.js';
import Fertilizer from '../models/fertilizer.model.js';
import { deleteFromCloudinary } from '../services/cloudinary.service.js';

const removeMediaById = async (mediaId) => {
  if (!mediaId) return;
  const media = await Media.findById(mediaId);
  if (!media) return;
  if (media.publicId) {
    try {
      await deleteFromCloudinary(media.publicId);
    } catch (err) {
      console.error('Failed to delete media from Cloudinary:', err.message);
    }
  }
  await media.deleteOne();
};

// --- List All Farmers ---
export const listFarmers = asyncHandler(async (req, res) => {
  const farmers = await User.find({ role: 'farmer' }).select('-passwordHash').sort({ createdAt: -1 });
  res.json(farmers);
});

// --- List All Agronomists ---
export const listAgronomists = asyncHandler(async (req, res) => {
  // Chain all .populate() calls together in a single statement
  const agronomists = await AgronomistProfile.find()
    .populate('user', 'fullName mobileNumber address profilePhoto')
    .populate('idProof', 'url contentType');

  res.status(200).json(agronomists);
});

// --- Delete Farmer ---
export const deleteFarmer = asyncHandler(async (req, res) => {
  const farmer = await User.findOne({ _id: req.params.id, role: 'farmer' });
  if (!farmer) {
    return res.status(404).json({ message: 'Farmer not found' });
  }

  if (farmer.profilePhoto) {
    await removeMediaById(farmer.profilePhoto);
  }

  await farmer.deleteOne();
  res.json({ message: 'Farmer deleted successfully' });
});

// --- Delete Agronomist ---
export const deleteAgronomist = asyncHandler(async (req, res) => {
  const agronomist = await User.findOne({ _id: req.params.id, role: 'agronomist' });
  if (!agronomist) {
    return res.status(404).json({ message: 'Agronomist not found' });
  }

  const profile = await AgronomistProfile.findOne({ user: agronomist._id });
  if (profile) {
    if (profile.idProof) {
      await removeMediaById(profile.idProof);
    }
    await profile.deleteOne();
  }

  if (agronomist.profilePhoto) {
    await removeMediaById(agronomist.profilePhoto);
  }

  await agronomist.deleteOne();
  res.json({ message: 'Agronomist deleted successfully' });
});

// --- Processing Centers (Facilities) ---
export const listFacilities = asyncHandler(async (req, res) => {
  const facilities = await ProcessingCenter.find().sort({ createdAt: -1 });
  res.json(facilities);
});

export const addFacility = asyncHandler(async (req, res) => {
  const { name, type, location, city, contact, images, marketPrices } = req.body;
  const facility = await ProcessingCenter.create({
    name, type, location, city, contact, images, marketPrices, source: 'Admin'
  });
  res.status(201).json(facility);
});

export const updateFacility = asyncHandler(async (req, res) => {
  const facility = await ProcessingCenter.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!facility) return res.status(404).json({ message: 'Facility not found' });
  res.json(facility);
});

export const deleteFacility = asyncHandler(async (req, res) => {
  await ProcessingCenter.findByIdAndDelete(req.params.id);
  res.json({ message: 'Facility deleted' });
});

// --- Seeds ---
export const listSeeds = asyncHandler(async (req, res) => {
  const seeds = await Seed.find().sort({ createdAt: -1 });
  res.json(seeds);
});

export const addSeed = asyncHandler(async (req, res) => {
  const seed = await Seed.create(req.body);
  res.status(201).json(seed);
});

export const updateSeed = asyncHandler(async (req, res) => {
  const seed = await Seed.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(seed);
});

export const deleteSeed = asyncHandler(async (req, res) => {
  await Seed.findByIdAndDelete(req.params.id);
  res.json({ message: 'Seed deleted' });
});

// --- Fertilizers ---
export const listFertilizers = asyncHandler(async (req, res) => {
  const fertilizers = await Fertilizer.find().sort({ createdAt: -1 });
  res.json(fertilizers);
});

export const addFertilizer = asyncHandler(async (req, res) => {
  const fertilizer = await Fertilizer.create(req.body);
  res.status(201).json(fertilizer);
});

export const updateFertilizer = asyncHandler(async (req, res) => {
  const fertilizer = await Fertilizer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(fertilizer);
});

export const deleteFertilizer = asyncHandler(async (req, res) => {
  await Fertilizer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Fertilizer deleted' });
});
