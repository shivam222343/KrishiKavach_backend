import axios from 'axios';

/**
 * WhatsApp Service for Krishi Kavach
 * 
 * To enable real automated background sending, you need a Twilio account or similar.
 * 1. Get TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER
 * 2. Uncomment the Twilio section below.
 */

export const sendWhatsAppReport = async ({ to, farmerName, cropName, diseaseName, confidence, imageURL, summary }) => {
    const message = `*Krishi Kavach - Crop Disease Report* 🌾\n\n` +
        `Hello *${farmerName}*,\n\n` +
        `Our AI has analyzed your crop. Here are the details:\n\n` +
        `🌿 *Crop:* ${cropName}\n` +
        `🚨 *Detected Disease:* ${diseaseName}\n` +
        `✅ *Confidence:* ${confidence}%\n\n` +
        `📝 *Analysis:* ${summary || 'Please check the app for detailed treatment and prevention steps.'}\n\n` +
        `🖼️ *Image URL:* ${imageURL}\n\n` +
        `Stay protected with Krishi Kavach! 🛡️`;

    console.log(`[WhatsApp] Sending report to ${to}...`);
    console.log(`[WhatsApp] Message: ${message}`);

    // ------------- TWILIO IMPLEMENTATION (UNCOMMENT TO ENABLE) -------------
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. 'whatsapp:+14155238886'
  
    if (!accountSid || !authToken) {
      console.warn("[WhatsApp] Twilio credentials missing. Skipping send.");
      return false;
    }
  
    try {
      const client = require('twilio')(accountSid, authToken);
      await client.messages.create({
        body: message,
        from: fromNumber,
        to: `whatsapp:${to.startsWith('+') ? to : '+91' + to}`
      });
      return true;
    } catch (err) {
      console.error("[WhatsApp] Twilio send failed:", err.message);
      return false;
    }
    */

    return true; // Mock success
};
