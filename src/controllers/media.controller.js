import asyncHandler from 'express-async-handler';
import Media from '../models/media.model.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const result = await uploadToCloudinary(req.file, req.body.folder || 'general');
  const media = await Media.create({
    url: result.secure_url,
    publicId: result.public_id,
    uploadedBy: req.user.id,
    contentType: req.file.mimetype,
    size: req.file.size,
  });
  res.status(201).json(media);
});
