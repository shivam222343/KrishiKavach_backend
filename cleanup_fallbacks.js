import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Delete Processing Centers that are fallbacks
        const deletedCenters = await mongoose.connection.collection('processingcenters').deleteMany({
            $or: [
                { externalId: { $in: ['fallback_1', 'scr_1', 'scr_2', 'scr_3'] } },
                { source: { $in: ['Fallback', 'Scraped/IndiaMart', 'Scraped/TradeIndia', 'Scraped/Directories'] } },
                { name: /Fallback/i }
            ]
        });
        console.log(`Deleted ${deletedCenters.deletedCount} fallback processing centers`);

        // 2. Delete Listings that point to Fallback destinations or are just legacy/broken
        const deletedListings = await mongoose.connection.collection('supplychainlistings').deleteMany({
            $or: [
                { destinationName: /Fallback/i },
                { cropType: "Sugar", destinationName: "" } // Example broken listings seen earlier
            ]
        });
        console.log(`Deleted ${deletedListings.deletedCount} fallback listings`);

        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (err) {
        console.error(err);
    }
}

cleanup();
