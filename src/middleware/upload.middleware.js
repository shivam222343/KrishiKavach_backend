import multer from "multer";

const storage = multer.memoryStorage();

// Configure multer limits for better file handling
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB limit
};

// File filter for images and PDFs (for ID proofs, disease reports, etc.)
const fileFilter = (req, file, cb) => {
  // Accept images (jpeg, png) and PDFs
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false); // Reject the file
  }
};

// File filter for images only (for profile photos)
const imageFileFilter = (req, file, cb) => {
  // Accept only images (jpeg, png)
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png'
  ) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG images are allowed for profile photos.'), false); // Reject the file
  }
};

// Middleware for a single file upload (general purpose - accepts images and PDFs)
export const uploadSingle = (fieldName) => multer({ storage, fileFilter, limits }).single(fieldName);

// Middleware for profile photo upload (images only)
export const uploadProfilePhoto = (fieldName) => multer({ storage, fileFilter: imageFileFilter, limits }).single(fieldName);

// Middleware for multiple file uploads (used for disease reports)
export const uploadMultiple = (fieldName, maxCount = 5) => multer({ storage, fileFilter, limits }).array(fieldName, maxCount);