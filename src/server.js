import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Resolve .env relative to this file so it works regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// .env is in backend/.env, and this file is in backend/src/server.js
// so we go up ONE level: ../.env
dotenv.config({ path: resolve(__dirname, '../.env') });

import app from './app.js';
import connectDB from './config/db.js';
import { initializeAdmin } from './config/admin.init.js';
import cron from 'node-cron';
import { Server } from 'socket.io';
import { runScrapeCycle } from './services/market.service.js';
import CollaborationChat from './models/collaborationChat.model.js';

const PORT = process.env.PORT || 5000;

// --- Start Server ---
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize admin user
    await initializeAdmin();

    // 3. Start Express server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`🌐 Visit: http://localhost:${PORT}`);
    });

    // --- Socket.io Integration ---
    const io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://krushikavach.netlify.app',
          'https://krushikavach.netlify.app/'
        ],
        credentials: true
      }
    });

    // Attach io to app for use in controllers
    app.set('socketio', io);

    io.on('connection', (socket) => {
      console.log('👤 New client connected:', socket.id);

      socket.on('join_chat', (chatId) => {
        socket.join(chatId);
        console.log(`🚪 Socket ${socket.id} joined chat: ${chatId}`);
      });

      socket.on('send_message', async (data) => {
        const { chatId, senderId, text } = data;
        try {
          const chat = await CollaborationChat.findById(chatId);
          if (chat) {
            const newMessage = { senderId, text, createdAt: new Date() };
            chat.messages.push(newMessage);
            await chat.save();

            // Broadcast to everyone in the room
            io.to(chatId).emit('receive_message', newMessage);
          }
        } catch (error) {
          console.error('❌ Socket error:', error.message);
        }
      });

      socket.on('disconnect', () => {
        console.log('👤 Client disconnected');
      });
    });

    server.timeout = 350000;

    // 4. Schedule commodity scrape every 2 hours
    console.log('📊 Market price scraper cron scheduled (every 2 hours)');
    cron.schedule('0 */2 * * *', async () => {
      console.log('[Cron] Running commodity price scrape cycle...');
      try {
        const result = await runScrapeCycle();
        console.log(`[Cron] Scrape done — saved: ${result.saved}, feed errors: ${result.errors?.length ?? 0}`);
      } catch (err) {
        console.error('[Cron] Scrape failed:', err.message);
      }
    });

  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
