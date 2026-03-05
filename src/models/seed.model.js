import mongoose from 'mongoose';

const seedSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true }, // e.g. Cotton, Grapes
    variety: { type: String },
    description: { type: String },
    price: { type: Number },
    unit: { type: String, default: 'kg' },
    images: { type: [String], default: [] },
    company: { type: String },
    isVerified: { type: Boolean, default: true },
    recommendationTags: [String], // for future AI matching
}, { timestamps: true });

const Seed = mongoose.model('Seed', seedSchema);
export default Seed;
