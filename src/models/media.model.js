import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contentType: { type: String, required: true },
    // FIX: Clarified units in comment
    size: { type: Number }, // Size in bytes
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true } 
  }
);

const Media = mongoose.model('Media', mediaSchema);
export default Media;