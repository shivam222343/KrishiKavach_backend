import mongoose from 'mongoose';

const URI = "mongodb+srv://chaitanyaraut701:chaitanya123@cluster0.sin3c.mongodb.net/test?retryWrites=true&w=majority";

async function checkData() {
    try {
        console.log('Connecting to:', URI);
        await mongoose.connect(URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const Crop = mongoose.model('Crop', new mongoose.Schema({ farmer: mongoose.Schema.Types.ObjectId, cropName: String }));
        const crops = await Crop.find().lean();
        console.log('--- Crops in DB (raw) ---');
        console.log(JSON.stringify(crops, null, 2));

        const User = mongoose.model('User', new mongoose.Schema({ fullName: String }));
        const users = await User.find().lean();
        console.log('--- Users in DB (raw) ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkData();
