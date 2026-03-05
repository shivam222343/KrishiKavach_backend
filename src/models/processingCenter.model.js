import mongoose from 'mongoose';

const processingCenterSchema = new mongoose.Schema({
    externalId: { type: String, unique: true }, // OSM ID or Scraped ID
    name: { type: String, required: true },
    type: { type: String, default: 'Processing Center' },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [lng, lat]
    },
    city: { type: String },
    contact: { type: String },
    website: { type: String },
    images: { type: [String], default: [] }, // Array for carousel
    marketPrices: [{
        crop: String,
        price: Number,
        unit: { type: String, default: 'kg' },
        date: { type: Date, default: Date.now }
    }],
    source: { type: String, default: 'External' },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

processingCenterSchema.index({ location: '2dsphere' });

const ProcessingCenter = mongoose.model('ProcessingCenter', processingCenterSchema);
export default ProcessingCenter;
