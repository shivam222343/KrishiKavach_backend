import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Crop from './src/models/crop.model.js';
import User from './src/models/user.model.js';

dotenv.config();

async function checkData() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const crops = await Crop.find().populate('farmer', 'fullName');
    console.log('--- Crops in DB ---');
    console.log(JSON.stringify(crops, null, 2));

    const users = await User.find({}, 'fullName mobileNumber');
    console.log('--- Users in DB ---');
    console.log(JSON.stringify(users, null, 2));

    await mongoose.disconnect();
}

checkData();
