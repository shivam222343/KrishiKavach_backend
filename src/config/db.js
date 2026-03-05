
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config(); // Load environment variables from .env

const connectDB = async () => {
  try {
    // Force set DNS servers to Google's to resolve Atlas SRV records correctly
    // This fixed the ECONNREFUSED querySrv error on certain networks
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4']);
      console.log("🌐 DNS servers set to Google (8.8.8.8) for database resolution");
    } catch (dnsErr) {
      console.warn("⚠️ Could not set custom DNS servers, using system defaults:", dnsErr.message);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
