import mongoose from 'mongoose';

const supplyChainListingSchema = new mongoose.Schema(
    {
        farmerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        cropType: {
            type: String,
            required: true,
            index: true
        },
        quantity: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            default: 'tons'
        },
        price: {
            type: Number,
            required: true
        },
        city: { type: String, index: true }, 
        yieldAmount: { type: String }, // total yield amount
        neededAmount: { type: String }, // amount for which collab is needed
        contactPhone: { type: String },
        listingImage: { type: String }, // URL to image
        destinationName: { type: String },
        destinationCoords: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number] } // [lng, lat]
        },
        preferredTransport: { type: String }, // e.g. Tractor, Truck
        availabilityDate: {
            type: Date,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [Longitude, Latitude]
                required: true
            }
        },
        description: String,
        status: {
            type: String,
            enum: ['Active', 'Sold', 'Expired'],
            default: 'Active'
        }
    },
    { timestamps: true }
);

supplyChainListingSchema.index({ location: '2dsphere' });

const SupplyChainListing = mongoose.model('SupplyChainListing', supplyChainListingSchema);
export default SupplyChainListing;
