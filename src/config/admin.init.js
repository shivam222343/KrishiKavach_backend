import User from '../models/user.model.js';

// Admin details to be created in database
const ADMIN_DETAILS = {
  fullName: 'Chaitanya Raut',
  mobileNumber: '8446595203',
  password: 'chaitanya@123',
  role: 'admin',
  language: 'en',
  address: {
    district: 'Satara',
    taluka: 'Phaltan',
  },
};

// Initialize admin user in database
export const initializeAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      role: 'admin', 
      mobileNumber: ADMIN_DETAILS.mobileNumber 
    });

    if (existingAdmin) {
      let needsUpdate = false;
      
      // Check and update fields if needed
      if (existingAdmin.fullName !== ADMIN_DETAILS.fullName) {
        existingAdmin.fullName = ADMIN_DETAILS.fullName;
        needsUpdate = true;
      }
      if (existingAdmin.address?.district !== ADMIN_DETAILS.address.district ||
          existingAdmin.address?.taluka !== ADMIN_DETAILS.address.taluka) {
        existingAdmin.address = ADMIN_DETAILS.address;
        needsUpdate = true;
      }
      if (existingAdmin.language !== ADMIN_DETAILS.language) {
        existingAdmin.language = ADMIN_DETAILS.language;
        needsUpdate = true;
      }
      
      // Verify password is correct by attempting to match it
      const passwordMatches = await existingAdmin.matchPassword(ADMIN_DETAILS.password);
      if (!passwordMatches) {
        // Password doesn't match - update it
        existingAdmin.passwordHash = ADMIN_DETAILS.password; // Will be hashed by pre-save hook
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await existingAdmin.save();
        console.log('✅ Admin user updated in database');
      } else {
        console.log('✅ Admin user already exists in database');
      }
      return existingAdmin;
    }

    // Create new admin user
    const adminUser = await User.create({
      fullName: ADMIN_DETAILS.fullName,
      mobileNumber: ADMIN_DETAILS.mobileNumber,
      passwordHash: ADMIN_DETAILS.password, // Will be hashed by pre-save hook
      role: ADMIN_DETAILS.role,
      language: ADMIN_DETAILS.language,
      address: ADMIN_DETAILS.address,
    });

    console.log('✅ Admin user created in database');
    return adminUser;
  } catch (error) {
    console.error('❌ Error initializing admin user:', error.message);
    // Don't throw - allow server to start even if admin init fails
    return null;
  }
};

