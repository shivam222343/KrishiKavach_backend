import asyncHandler from 'express-async-handler';
import AgronomistProfile from '../models/agronomistProfile.model.js';
import User from '../models/user.model.js';
import Location from '../models/location.model.js';

// --- Get Agronomist Profile ---
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await AgronomistProfile.findOne({ user: req.user.id })
    .populate({
      path: 'user',
      populate: {
        path: 'profilePhoto',
        select: 'url',
      },
    });
  res.json(profile);
});

// --- Update Professional Info ---
export const updateProfile = asyncHandler(async (req, res) => {
  const { qualification, experience, availability, bio, fullName, language, district, taluka } = req.body;
  
  // Update agronomist profile
  const profile = await AgronomistProfile.findOneAndUpdate(
    { user: req.user.id },
    { qualification, experience, availability, bio },
    { new: true }
  ).populate('user');
  
  // Update user details if provided
  if (fullName || language || district || taluka) {
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (language) updateData.language = language;
    if (district !== undefined || taluka !== undefined) {
      updateData.address = {
        district: district !== undefined ? district : profile.user.address?.district || '',
        taluka: taluka !== undefined ? taluka : profile.user.address?.taluka || '',
      };
    }
    
    await User.findByIdAndUpdate(req.user.id, updateData);
    await profile.populate('user');
  }
  
  res.json(profile);
});

// --- Admin: Verify / Reject Agronomist ---
export const verifyAgronomist = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'verified' or 'rejected'
  const profile = await AgronomistProfile.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('user');
  res.json(profile);
});

// Add this to your existing agronomist.controller.js

// --- Find Local Experts for Farmer ---
export const findLocalExperts = asyncHandler(async (req, res) => {
  // 1. Get the logged-in farmer's district from their profile
  const farmer = await User.findById(req.user.id);
  if (!farmer || !farmer.address?.district) {
    return res.status(400).json({ message: "Farmer's district not found in profile." });
  }
  const farmerDistrict = farmer.address.district.trim().toLowerCase();

  // 2. Find verified agronomists and populate user + profile photo
  const expertProfiles = await AgronomistProfile.find({
    status: 'verified',
  }).populate({
    path: 'user',
    select: 'fullName mobileNumber address profilePhoto',
    populate: {
      path: 'profilePhoto',
      select: 'url',
    },
  });

  // 3. Filter agronomists that share the same district and format response
  const localExperts = expertProfiles
    .filter(profile => {
      const agronomistDistrict = profile.user?.address?.district?.trim().toLowerCase();
      return profile.user && agronomistDistrict && agronomistDistrict === farmerDistrict;
    })
    .map(profile => ({
      id: profile._id,
      fullName: profile.user.fullName,
      mobileNumber: profile.user.mobileNumber,
      district: profile.user.address?.district || '',
      profilePhotoUrl: profile.user.profilePhoto?.url || null,
      qualification: profile.qualification,
      experience: profile.experience,
    }));

  res.json(localExperts);
});

// --- Find Local Farmers for Agronomist ---
export const findLocalFarmers = asyncHandler(async (req, res) => {
  // 1. Get the logged-in agronomist's district from their profile
  const agronomist = await User.findById(req.user.id);
  if (!agronomist || !agronomist.address?.district) {
    return res.status(400).json({ message: "Agronomist's district not found in profile." });
  }
  const agronomistDistrict = agronomist.address.district.trim().toLowerCase();

  // 2. Find farmers with the same district and populate profile photo
  const farmers = await User.find({
    role: 'farmer',
  })
    .select('fullName mobileNumber address profilePhoto')
    .populate({
      path: 'profilePhoto',
      select: 'url',
    });

  // 3. Filter farmers that share the same district and format response
  const localFarmers = farmers
    .filter(farmer => {
      const farmerDistrict = farmer.address?.district?.trim().toLowerCase();
      return farmerDistrict && farmerDistrict === agronomistDistrict;
    })
    .map(farmer => ({
      id: farmer._id,
      fullName: farmer.fullName,
      mobileNumber: farmer.mobileNumber,
      district: farmer.address?.district || '',
      profilePhotoUrl: farmer.profilePhoto?.url || null,
    }));

  res.json(localFarmers);
});