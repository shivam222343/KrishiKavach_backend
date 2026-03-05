import { v2 as cloudinary } from 'cloudinary';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('⚠️  Cloudinary configuration is missing. Please check your environment variables.');
}

// Create a custom HTTPS agent with stable timeout
const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 120000, // 120 seconds
  keepAliveMsecs: 1000,
});

// Configure Cloudinary with timeout and retry settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 120000, // 120 seconds timeout
  api_proxy: process.env.CLOUDINARY_API_PROXY, // Optional proxy if needed
  https_agent: httpsAgent, // Use custom agent with stable timeout
});

/**
 * Upload file to Cloudinary with retry logic
 * @param {Object} file - File object with buffer
 * @param {string} folder - Cloudinary folder path
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = (file, folder, maxRetries = 3) => {
  return new Promise(async (resolve, reject) => {
    // Validate configuration before upload
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return reject(new Error('Cloudinary configuration is missing. Please check environment variables.'));
    }

    // Validate file buffer
    if (!file || !file.buffer) {
      return reject(new Error('Invalid file: buffer is missing'));
    }

    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await attemptUpload(file, folder, attempt);
        return resolve(result);
      } catch (error) {
        lastError = error;
        
        // If it's a timeout error and we have retries left, wait before retrying
        const isTimeoutError = error.http_code === 499 || 
                               error.name === 'TimeoutError' || 
                               error.message?.includes('timeout');
        
        if (isTimeoutError && attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = attempt * 1000; // 1s, 2s, 3s...
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // If not a timeout or last attempt, break
        if (!isTimeoutError || attempt === maxRetries) {
          break;
        }
      }
    }

    // All retries failed, return clean error message
    const errorMessage = lastError?.http_code === 499 || lastError?.message?.includes('timeout')
      ? 'Failed to upload image: The upload is taking too long. Please try again with a smaller file or check your internet connection.'
      : `Failed to upload image: ${lastError?.message || 'Unknown error occurred'}`;
    
    reject(new Error(errorMessage));
  });
};

/**
 * Single upload attempt
 * @param {Object} file - File object with buffer
 * @param {string} folder - Cloudinary folder path
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} Cloudinary upload result
 */
const attemptUpload = (file, folder, attempt) => {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let uploadStream;

    try {
      // Use upload_stream which is more efficient and handles timeouts better
      uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (error) {
            // Pass error to retry logic
            reject(error);
          } else if (!result) {
            reject(new Error('Cloudinary upload completed but no result returned'));
          } else {
            resolve(result);
          }
        }
      );

      // Set timeout for the entire operation (120 seconds)
      timeoutId = setTimeout(() => {
        if (uploadStream) {
          uploadStream.destroy();
        }
        const timeoutError = new Error('Cloudinary upload timeout');
        timeoutError.http_code = 499;
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, 120000); // 120 seconds total timeout

      // Handle stream errors
      uploadStream.on('error', (streamError) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(streamError);
      });

      // Write buffer to stream
      uploadStream.end(file.buffer);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    }
  });
};

export const deleteFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    // Validate configuration before delete
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return reject(new Error('Cloudinary configuration is missing. Please check environment variables.'));
    }

    cloudinary.uploader.destroy(publicId, { timeout: 30000 }, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        reject(new Error(`Failed to delete from Cloudinary: ${error.message || 'Unknown error'}`));
      } else {
        resolve(result);
      }
    });
  });
};
