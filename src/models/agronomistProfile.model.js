import mongoose from 'mongoose';

const agronomistProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    qualification: { type: String, required: true },
    experience: { type: Number, required: true },
    idProof: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    availability: { type: String, enum: ['available', 'unavailable'], default: 'available' },
    bio: { type: String, maxlength: 500 },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

agronomistProfileSchema.index({ status: 1, availability: 1 });

const AgronomistProfile = mongoose.model('AgronomistProfile', agronomistProfileSchema);
export default AgronomistProfile;