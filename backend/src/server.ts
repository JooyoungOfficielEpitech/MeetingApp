import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express from 'express';
import http from 'http';
// import { Server as SocketIOServer } from 'socket.io'; // Removed: Handled in socket/index.ts
// import swaggerUi from 'swagger-ui-express'; // Removed: Used in config/swagger
// import swaggerJsdoc from 'swagger-jsdoc'; // Removed: Used in config/swagger
// import cors from 'cors'; // Removed: Imported from config/cors
// import session from 'express-session'; // Removed: Imported from config/session
import passport from 'passport'; // Still needed for authenticate calls
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // Removed: Configured in config/passport
import jwt from 'jsonwebtoken'; // Still needed for signing tokens
// import { Socket } from 'socket.io'; // Removed: No longer directly used here
import { authenticateToken } from './middleware/authMiddleware'; // Keep if used by HTTP routes
// import { Op } from 'sequelize'; // Removed: Not directly used here
// import bcrypt from 'bcrypt'; // Removed: Used only in utils/ensureAdmin
import { Request, Response, NextFunction } from 'express';
// import path from 'path'; // Removed: Used in config/static
// import fs from 'fs'; // Removed: Used in config/static

// --- Import DB models (adjust path if needed) ---
// import db from './db/models'; // Assuming ES Module export
const db = require('../models'); // Use require if models index uses CommonJS export
// const User = db.User; // Removed: Only needed in config/passport and utils/ensureAdmin
// const Match = db.Match; // Removed: Used only in socket handlers
// const Message = db.Message; // Removed: Used only in socket handlers
// const MatchingWaitList = db.MatchingWaitList; // Removed: Used only in socket handlers
// -------------------------

// --- Import Socket.IO logic ---
import { initSocket, io } from './socket'; // Import the initializer and the io instance
// ----------------------------

// --- Import Configs ---
import { corsMiddleware } from './config/cors';
import { sessionMiddleware } from './config/session';
import { setupStaticFiles } from './config/static';
import { configurePassport } from './config/passport'; // Import Passport config function
import { setupSwagger } from './config/swagger'; // Import Swagger setup function
// TODO: Import JWT config

// --- Import Middleware ---
import { attachIo } from './middleware/attachIo'; // Import attachIo middleware

// --- Import Utils ---
import { ensureAdminUser } from './utils/ensureAdmin'; // Import ensureAdminUser utility

const app = express();
const server = http.createServer(app);

// --- Initialize Socket.IO ---
initSocket(server); // Pass the HTTP server to the initializer
// --------------------------

// --- Apply Config Middlewares ---
app.use(corsMiddleware); // Use imported CORS middleware
app.use(sessionMiddleware); // Use imported Session middleware

// --- Configure and Initialize Passport ---
configurePassport(); // Call the configuration function
app.use(passport.initialize());
app.use(passport.session());
// --------------------------------------

// --- JSON Body Parser ---
app.use(express.json());
// ------------------------

// --- Static File Serving ---
setupStaticFiles(app); // Use imported setup function
// -----------------------------

// --- Passport Setup (Removed: Moved to config/passport.ts) ---
// passport.serializeUser(...);
// passport.deserializeUser(...);
// passport.use(new GoogleStrategy(...));
// -----------------------------------------------

// --- Middleware to attach io to request (Removed: Moved to middleware/attachIo.ts) ---
// const attachIo = ...

// --- Socket.IO Authentication Middleware (Removed: Moved to socket/index.ts) ---
// -------------------------------------------

// --- Socket.IO Connection Handling (Removed: Moved to socket/handlers.ts and initiated in socket/index.ts) ---
// ----------------------------------

// Export the io instance (Removed: Exported from socket/index.ts)
// ----------------------------------

// --- Setup Swagger ---
setupSwagger(app); // Use the imported setup function
// ---------------------

// Apply io attachment middleware BEFORE the admin routes
app.use('/api/admin', attachIo); // Use imported attachIo middleware

// Import and use routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import matchesRouter from './routes/matches';
import mainRoutes from './routes/main';
import adminRoutes from './routes/admin';
import messagesRoutes from './routes/messages';

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/matches', matchesRouter);
app.use('/api/main', mainRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messagesRoutes);

const PORT = process.env.PORT || 3001;

/**
 * @swagger
 * /:
 *   get:
 *     summary: Check if the backend server is running
 *     tags: [Server Status]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Backend server is running!
 */
app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

/**
 * @swagger
 * tags:
 *   name: Example
 *   description: Example API endpoint
 */

/**
 * @swagger
 * /hello:
 *   get:
 *     summary: Returns a simple hello message
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: A hello message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello from the backend!
 */
app.get('/hello', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

// --- Server Start ---
if (process.env.NO_SERVER_START !== 'true') {
    server.listen(PORT, async () => {
        console.log(`Server listening on *:${PORT}`);
        console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);

        try {
            await db.sequelize.authenticate(); // db needed
            console.log('Database connection established successfully.');
            await ensureAdminUser(); // Call the imported utility function
        } catch (error) {
            console.error('Unable to connect to the database or ensure admin user:', error);
        }
    });
}

// supertest를 위한 올바른 export 설정
export { app, server }; 