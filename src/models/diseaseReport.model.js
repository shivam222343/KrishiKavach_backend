import mongoose from 'mongoose';

const diseaseReportSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' }, // Made optional for ML predictions
    images: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    },
    // ML Prediction fields
    imageURL: { type: String }, // Cloudinary URL for ML predictions
    cropName: { type: String }, // Crop name for ML predictions (e.g., "apple", "tomato")
    prediction: { type: String }, // Disease name from ML (or "Healthy")
    confidence: { type: Number }, // Confidence percentage (0-100)
    // Existing fields
    detectedDisease: { type: String },
    diagnosis: { type: String },
    recommendation: { type: String },
    reportStatus: { type: String, enum: ['pending_action', 'treated'], default: 'pending_action' },
    farmerNotes: { type: String, maxlength: 1000 },
    reportLanguage: { type: String, enum: ['en', 'mr'] },
    analyzedAt: { type: Date },
    // FIX: Renamed to assignedAgronomist for standard clarity
    assignedAgronomist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true } 
  }
);

diseaseReportSchema.index({ farmer: 1, crop: 1, createdAt: -1 });

const DiseaseReport = mongoose.model('DiseaseReport', diseaseReportSchema);
export default DiseaseReport;