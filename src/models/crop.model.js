import mongoose from 'mongoose';

const cropSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cropName: { type: String, required: true },
    cropVariety: { type: String },
    plantingDate: { type: Date, required: true },
    area: {
      value: { type: Number, required: true },
      unit: { type: String, required: true, enum: ['acres', 'hectares', 'guntha'] },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true } 
  }
);

cropSchema.index({ farmer: 1 });

const Crop = mongoose.model('Crop', cropSchema);
export default Crop;