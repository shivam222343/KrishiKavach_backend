import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/user.model.js'; // Adjust path if necessary

dotenv.config();

// --- CONFIGURE THESE VALUES ---
const ADMIN_MOBILE_NUMBER = '9123456782'; // The mobile number of the admin account
const NEW_PASSWORD = 'chaitanya@123'; // Your new temporary password
// ------------------------------

const resetPassword = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file.');
    return;
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected.');

    const adminUser = await User.findOne({ mobileNumber: ADMIN_MOBILE_NUMBER });

    if (!adminUser) {
      console.error(`❌ Admin user with mobile number ${ADMIN_MOBILE_NUMBER} not found.`);
      return;
    }

    console.log(`Found admin: ${adminUser.fullName}. Hashing new password...`);

    // Manually hash the new password
    const salt = await bcrypt.genSalt(10);
    adminUser.passwordHash = await bcrypt.hash(NEW_PASSWORD, salt);

    await adminUser.save();
    console.log(`✅ Password for ${adminUser.fullName} has been successfully reset!`);
    console.log('🔑 You can now log in with the new password.');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
};

resetPassword();