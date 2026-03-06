import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function listListings() {
    await mongoose.connect(process.env.MONGODB_URI);
    const listings = await mongoose.connection.collection('supplychainlistings').find({}).toArray();
    console.log(JSON.stringify(listings.map(l => ({
        _id: l._id,
        cropType: l.cropType,
        city: l.city,
        destinationName: l.destinationName,
        destinationCoords: l.destinationCoords
    })), null, 2));
    await mongoose.disconnect();
}
listListings();
