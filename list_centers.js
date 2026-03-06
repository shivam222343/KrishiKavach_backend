import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function listCenters() {
    await mongoose.connect(process.env.MONGODB_URI);
    const centers = await mongoose.connection.collection('processingcenters').find({}).toArray();
    console.log(JSON.stringify(centers.map(c => ({ _id: c._id, name: c.name, externalId: c.externalId, source: c.source })), null, 2));
    await mongoose.disconnect();
}
listCenters();
