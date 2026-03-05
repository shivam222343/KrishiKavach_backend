import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    district: { type: String, required: true },
    taluka: { type: String, required: true },
    geo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number], // [Longitude, Latitude]
        required: true,
        // FIX: Added coordinate validation
        validate: [
          (val) => Array.isArray(val) && val.length === 2 && isFinite(val[0]) && isFinite(val[1]),
          'Coordinates must be an array of two numbers [longitude, latitude]',
        ],
      },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true } 
  }
);

locationSchema.index({ geo: '2dsphere' });
locationSchema.index({ district: 1, taluka: 1 }, { unique: true });

const Location = mongoose.model('Location', locationSchema);
export default Location;