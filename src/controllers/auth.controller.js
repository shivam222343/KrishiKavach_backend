import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import AgronomistProfile from '../models/agronomistProfile.model.js';
import AuthSession from '../models/authSession.model.js';
import Media from '../models/media.model.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';
import { generateTokens } from '../services/auth.service.js';

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const userObj = userDoc.toObject();
  delete userObj.passwordHash;
  return userObj;
};

// --- Registration (Farmer / Agronomist / Admin) ---
export const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    mobileNumber,
    password,
    role,
    language,
    district,
    taluka,
    qualification,
    experience,
    longitude,
    latitude,
  } = req.body;

  // Prevent registration of admin accounts - admin must be created via initialization
  if (role === 'admin') {
    return res.status(400).json({
      message: 'Admin accounts cannot be registered through this endpoint.',
    });
  }

  // Default role to 'farmer' if not provided
  const userRole = role || 'farmer';

  // Check if user already exists
  const existing = await User.findOne({ mobileNumber });
  if (existing) {
    return res.status(400).json({ message: 'Mobile number is already registered.' });
  }

  // Validate agronomist-specific required fields
  if (userRole === 'agronomist') {
    if (!qualification || !experience) {
      return res.status(400).json({ 
        message: 'Qualification and experience are required for agronomist registration.' 
      });
    }
    if (!longitude || !latitude) {
      return res.status(400).json({ 
        message: 'Location is required for agronomist registration. Please select your location on the map.' 
      });
    }
    if (!req.file) {
      return res.status(400).json({ 
        message: 'ID proof document is required for agronomist registration.' 
      });
    }
  }

  // Build location object if provided
  let locationObject;
  if (longitude && latitude) {
    locationObject = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };
  }

  // Create user with basic info
  const user = await User.create({
    fullName,
    mobileNumber,
    passwordHash: password, // Will be hashed by pre-save hook
    role: userRole,
    language: language || 'en',
    location: locationObject,
    address: { district, taluka },
  });

  // --- AGRONOMIST REGISTRATION LOGIC ---
  if (userRole === 'agronomist') {
    try {
      const result = await uploadToCloudinary(req.file, 'id_proofs');
      const idProofMedia = await Media.create({
        url: result.secure_url,
        publicId: result.public_id,
        uploadedBy: user._id,
        contentType: req.file.mimetype,
      });

      await AgronomistProfile.create({
        user: user._id,
        qualification,
        experience: Number(experience) || 0,
        idProof: idProofMedia._id,
        status: 'pending',
      });
    } catch (uploadError) {
      await User.findByIdAndDelete(user._id);
      console.error('Agronomist profile creation failed:', uploadError);
      return res.status(500).json({ message: 'Could not process registration. Please try again.' });
    }
  }

  res.status(201).json({
    message:
      userRole === 'agronomist'
        ? 'Registration successful. Your profile is now pending verification.'
        : 'Registered successfully.',
    user: sanitizeUser(user),
  });
});

// --- Login (mobileNumber + password) ---
export const login = asyncHandler(async (req, res) => {
  const { mobileNumber, password } = req.body;

  const user = await User.findOne({ mobileNumber });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  // Compare password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  // Access control for agronomist
  if (user.role === 'agronomist') {
    const profile = await AgronomistProfile.findOne({ user: user._id });

    if (!profile || profile.status !== 'verified') {
      const message =
        profile?.status === 'rejected'
          ? 'Your application has been rejected. Please contact support.'
          : 'Your account is waiting for admin approval.';
      return res.status(403).json({ message });
    }
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  await AuthSession.create({
    user: user._id,
    refreshTokenHash: await bcrypt.hash(refreshToken, 10),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  res.json({ accessToken, refreshToken, user: sanitizeUser(user) });
});

// --- Refresh Token ---
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const session = await AuthSession.findOne({ user: payload.userId });
    if (!session) return res.status(401).json({ message: 'Session not found' });

    const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!valid) return res.status(401).json({ message: 'Invalid token' });

    const accessToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// --- Logout ---
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await AuthSession.deleteMany({ user: payload.userId });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
});
