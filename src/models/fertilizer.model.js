import mongoose from 'mongoose';

const fertilizerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true }, // e.g. Organic, Chemical
    cropType: { type: String }, // e.g. Sugar, Cotton (for specific guidance)
    components: { type: String },
    description: { type: String },
    price: { type: Number },
    unit: { type: String, default: 'kg' },
    images: { type: [String], default: [] },
    company: { type: String },
    isVerified: { type: Boolean, default: true },
    recommendationTags: [String], // for future AI matching
}, { timestamps: true });

const Fertilizer = mongoose.model('Fertilizer', fertilizerSchema);
export default Fertilizer;
