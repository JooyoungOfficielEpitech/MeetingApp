import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // Import Google Strategy
import jwt from 'jsonwebtoken'; // Import jwt for token generation
import { Socket } from 'socket.io'; // Import Socket type

// --- Import User model --- 
const db = require('../models'); // Adjust path if needed
const User = db.User;
// -------------------------


// --- JWT Secret --- 
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME'; // Reuse or define a specific one
// ------------------

const app = express();
const server = http.createServer(app);

// --- CORS Configuration --- 
const corsOptions = {
  origin: 'http://localhost:3000', // Allow only the frontend origin
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow common methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  credentials: true // Allow cookies/authorization headers
};
app.use(cors(corsOptions)); // Use cors middleware with specific options
// Handle preflight requests for all routes
// app.options('*', cors(corsOptions)); // Optional: More explicit preflight handling if needed
// --------------------------

// --- Session Configuration --- 
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_fallback_secret_change_me', // Use env variable
    resave: false,
    saveUninitialized: false, // Changed to false: don't save sessions until something is stored
    // Configure session store for production (e.g., connect-redis, connect-mongo)
    // cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production (HTTPS)
  })
);
// ---------------------------

// --- Passport Configuration ---
app.use(passport.initialize());
app.use(passport.session());

// --- Passport Serialization/Deserialization (Updated) --- 
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    // Retrieve the full user object from the database using the ID
    const user = await User.findByPk(id); // Use actual User model
    done(null, user); // Pass the user object or null if not found
  } catch (error) {
    done(error);
  }
});
// ----------------------------------------------------

// --- Google OAuth 2.0 Strategy Configuration (Updated) --- 
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback",
    scope: ['profile', 'email'],
    passReqToCallback: true // Pass req object to the callback
  },
  async (req: any, accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google Profile Received:', profile);

      let user = await User.findOne({ where: { googleId: profile.id } });

      if (user) {
        // Existing user found
        console.log('Existing user found via Google:', user.toJSON());
        return done(null, user); 
      } else {
        // New user - Store profile temporarily
        console.log('New user via Google, pending profile completion.');
        const pendingProfile = {
            provider: 'google',
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
        };
        req.session.pendingSocialProfile = pendingProfile; 
        
        // Explicitly save the session before calling done
        req.session.save((err: any) => {
            if (err) {
                console.error("Session save error before signaling pending profile:", err);
                return done(err, false);
            }
            console.log('Session saved with pending profile.');
            // Signal that authentication is okay, but no user object yet
            return done(null, false); 
        });
      }
    } catch (error) {
      console.error('Error in Google Strategy callback:', error);
      return done(error, false);
    }
  }
));
// ----------------------------------------------- 

// --- In-memory storage for connected users and waiting users --- 
interface ConnectedUser {
    userId: number;
    socketId: string;
    gender: Gender | null; // Use Gender type
}

type Gender = 'male' | 'female' | 'other'; // Define Gender type

const connectedUsers = new Map<string, ConnectedUser>();
const waitingUsers: Record<Gender, ConnectedUser[]> = { // Use Record for type safety
    male: [],
    female: [],
    other: [],
};
// ---------------------------------------------------------------

const io = new SocketIOServer(server, {
    cors: {
        origin: "http://localhost:3000", 
        methods: ["GET", "POST"]
    }
});

// --- Socket.IO Authentication Middleware --- 
io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
    console.log("Socket trying to connect with token:", token ? "Present" : "Missing");

    if (!token) {
        console.error("Socket connection error: No token provided.");
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        console.log("Socket authenticated for user ID:", decoded.userId);
        
        const user = await User.findByPk(decoded.userId, { attributes: ['id', 'gender'] }); 
        if (!user) {
             console.error(`Socket connection error: User not found for ID ${decoded.userId}`);
             return next(new Error('Authentication error: User not found'));
        }
        
        // Ensure gender is of type Gender or null
        const userGender = (user.gender && ['male', 'female', 'other'].includes(user.gender)) ? user.gender as Gender : null;

        // Store user info associated with this socket
        (socket as any).user = { userId: decoded.userId, gender: userGender }; 
        next();
    } catch (err) {
        console.error("Socket connection error: Invalid token.", err);
        next(new Error('Authentication error: Invalid token'));
    }
});
// -------------------------------------------

// --- Socket.IO Connection Handling --- 
io.on('connection', (socket: any) => {
    const userId: number = socket.user.userId;
    const userGender: Gender | null = socket.user.gender;
    let currentMatchId: string | null = null; // Variable to store the room the user is in

    console.log(`User connected: ${userId} (Socket ID: ${socket.id}, Gender: ${userGender})`);

    const userInfo: ConnectedUser = { userId: userId, socketId: socket.id, gender: userGender };
    connectedUsers.set(socket.id, userInfo);

    // --- Matching Logic --- 
    socket.on('start-matching', () => {
        console.log(`User ${userId} requested matching.`);
        // setError(null); // Removed undefined function call

        if (!userGender) { // Check if gender is null or undefined
             console.warn(`User ${userId} cannot match: Gender not set or invalid.`);
             socket.emit('matching-error', '성별 정보가 설정되지 않아 매칭을 시작할 수 없습니다.');
             return;
        }

        // Determine opponent gender (Only male/female for now)
        let opponentGender: Gender | null = null;
        if (userGender === 'male') {
            opponentGender = 'female';
        } else if (userGender === 'female') {
            opponentGender = 'male';
        }
        // TODO: Add logic for 'other' gender if needed.
        if (!opponentGender) {
             console.warn(`User ${userId} cannot match: Unsupported gender for matching (${userGender}).`);
             socket.emit('matching-error', '현재 성별(${userGender})은 매칭을 지원하지 않습니다.');
             return;
        }

        // Check if a suitable opponent is waiting
        if (waitingUsers[opponentGender].length > 0) {
            // --- Match Found --- 
            const opponent = waitingUsers[opponentGender].shift()!; 
            console.log(`Match found for User ${userId} with User ${opponent.userId}`);

            const matchId = `match-${userId}-${opponent.userId}-${Date.now()}`;

            io.to(socket.id).emit('match-success', { matchId: matchId, opponentId: opponent.userId });
            io.to(opponent.socketId).emit('match-success', { matchId: matchId, opponentId: userId });

        } else {
            // --- No Match Found - Add to Waiting List --- 
            const isAlreadyWaiting = waitingUsers[userGender].some((u: ConnectedUser) => u.userId === userId);
            if (!isAlreadyWaiting) {
                console.log(`User ${userId} added to waiting list (${userGender}).`);
                waitingUsers[userGender].push(userInfo);
                socket.emit('waiting-for-match');
            } else {
                console.log(`User ${userId} is already waiting.`);
                 socket.emit('already-waiting');
            }
        }
        console.log("Waiting Lists:", waitingUsers); 
    });

    // --- Chat Room Logic --- 
    socket.on('join-chat-room', (matchId: string) => {
        if (!matchId) {
            console.warn(`User ${userId} attempted to join null/undefined room.`);
            // Optionally emit an error back to the client
            // socket.emit('chat-error', 'Invalid Match ID provided.');
            return;
        }
        console.log(`User ${userId} (Socket: ${socket.id}) joining room: ${matchId}`);
        socket.join(matchId);
        currentMatchId = matchId; // Store the current room
        // Optional: Notify the other user in the room that someone joined?
        // socket.to(matchId).emit('opponent-joined');
         // Optional: Send chat history? (Requires storing history)
        // socket.emit('chat-history', getChatHistory(matchId));
    });

    socket.on('chat message', (data: { matchId: string; text: string }) => {
        const { matchId, text } = data;
        if (!matchId || !text || !currentMatchId || matchId !== currentMatchId) {
             console.warn(`Invalid chat message received from ${userId}. Data:`, data, `Current Room: ${currentMatchId}`);
             // socket.emit('chat-error', 'Invalid message or room.');
             return;
        }

        console.log(`Message from User ${userId} in room ${matchId}: ${text}`);

        // Prepare message object to broadcast
        const messageToSend = {
            senderId: userId, // Identify the sender
            sender: userId, // For client-side sender === 'me' logic maybe?
            text: text,
            timestamp: Date.now()
        };

        // Send message to all other clients in the same room
        socket.to(matchId).emit('chat message', messageToSend);

         // TODO: Store message in DB or cache for history
         // saveMessageToDatabase(matchId, messageToSend);
    });

    // --- User leaves chat room voluntarily ---
    socket.on('leave-chat-room', (matchId: string) => {
        if (!matchId || matchId !== currentMatchId) {
            console.warn(`User ${userId} tried to leave invalid room. Requested: ${matchId}, Current: ${currentMatchId}`);
            return;
        }
        console.log(`User ${userId} leaving room ${matchId} voluntarily.`);
        // Notify opponent first
        socket.to(matchId).emit('opponent-left-chat', { userId: userId });
        // Leave the socket.io room
        socket.leave(matchId);
        currentMatchId = null; // Clear current room state for this socket
    });

    // --- Handle Disconnection (e.g., closing tab, network issue) ---
    socket.on('disconnect', (reason: string) => {
        console.log(`User disconnected: ${userId} (Socket ID: ${socket.id}, Reason: ${reason})`);
        connectedUsers.delete(socket.id);
        
        // Remove user from waiting list if they were waiting
        if (userGender && waitingUsers[userGender]) {
             const waitingIndex = waitingUsers[userGender].findIndex((u: ConnectedUser) => u.socketId === socket.id);
             if (waitingIndex > -1) {
                 waitingUsers[userGender].splice(waitingIndex, 1);
                 console.log(`User ${userId} removed from waiting list (${userGender}) due to disconnect.`);
             }
        }
        console.log("Waiting Lists after disconnect:", waitingUsers);

        // --- Notify opponent if user was in a chat room --- 
        if (currentMatchId) {
             console.log(`User ${userId} disconnected from room ${currentMatchId}. Notifying opponent.`);
             // Send message to the room EXCEPT the disconnected socket
             socket.to(currentMatchId).emit('opponent-left-chat', { userId: userId }); // Changed event name
             // currentMatchId will be naturally cleared as the socket connection is gone
        }
        // -------------------------------------------------
    });

    // --- Add other event handlers --- 
});
// ----------------------------------

// Swagger definition
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MeetingApp API',
            version: '1.0.0',
            description: 'API documentation for the MeetingApp backend',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3001}`,
                description: 'Development server'
            }
        ]
    },
    // Path to the API docs (typically routes files)
    // For now, we'll point to this server file for the example
    apis: ['./src/server.ts', './src/routes/*.ts'], // Scan routes files too
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware to parse JSON bodies
app.use(express.json());

// Import and use routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';

// --- Google Auth Routes (Callback Updated with Custom Handler) --- 
// 1. Route to start Google authentication
app.get('/api/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Google callback route with custom callback handler
app.get('/api/auth/google/callback',
  (req: any, res, next) => { // Logging middleware (keep this)
      console.log('\n--- Entering /google/callback route ---');
      console.log('Session ID:', req.sessionID);
      console.log('Session Data BEFORE authenticate:', JSON.stringify(req.session, null, 2));
      next();
  },
  (req: any, res, next) => { // Replace final handler with this custom authenticate call
    passport.authenticate('google', async (err: any, user: any, info: any) => { // Add async here
      // This custom callback receives results from the strategy's done() call
      console.log('\n--- Inside passport.authenticate custom callback ---');
      console.log('Error:', err); 
      console.log('User object (from done):', user ? user.toJSON() : user); // Log user object safely
      console.log('Info:', info); // Additional info/messages from strategy
      console.log('Session Data IN custom callback:', JSON.stringify(req.session, null, 2)); 

      if (err) {
        console.error('Authentication Error from strategy:', err);
        return res.redirect('http://localhost:3000/?error=google_auth_error'); // Specific error for strategy failure
      }

      if (user) {
        // --- Existing User Login - Check Profile Completion ---
        console.log('Custom Callback: Existing user authenticated.', user.toJSON());

        // Check if essential profile info (e.g., gender) is missing
        const isProfileComplete = user.gender && ['male', 'female', 'other'].includes(user.gender); // Add other checks if needed (age, height etc.)

        // Generate JWT regardless
        const payload = { userId: user.id, email: user.email }; 
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        if (isProfileComplete) {
          // Profile is complete, redirect to main app area via auth callback page
          console.log('Profile complete. Redirecting to /auth/callback');
          return res.redirect(`http://localhost:3000/auth/callback?token=${token}`); // Standard login flow
        } else {
          // Profile is incomplete, redirect to profile edit page with token
          console.log('Profile incomplete. Redirecting to /profile for editing.');
          // We send the token here so the profile page can use it for auth immediately
          return res.redirect(`http://localhost:3000/profile?token=${token}`);
        }
        // -----------------------------------------------------
      
      } else if (req.session && req.session.pendingSocialProfile) {
        // --- New User - Redirect for Profile Completion --- 
        // done(null, false) was called, user is false, but we have session data
        console.log('Custom Callback: New user identified by session. Redirecting to complete profile.');
         // Option 1: Keep existing redirect if /signup/complete-profile page handles session data
         return res.redirect('http://localhost:3000/signup/complete-profile'); 
      
         // Option 2: Redirect to /profile and let it handle session data (requires frontend changes)
         // console.log('Redirecting new user to /profile with needsCompletion flag.');
         // return res.redirect('http://localhost:3000/profile?needsCompletion=true');

      } else {
        // --- Authentication Failed or Unexpected State --- 
        // This case might happen if done(null, false) was called WITHOUT setting session data properly,
        // or if the user explicitly denied access on Google's page.
        console.error('Custom Callback: Unexpected state or user denied access. User:', user, 'Session:', req.session);
        // Use the info object if available (might contain failure reasons from Google)
        const failureMsg = info?.message || 'authentication_failed_unexpected';
        return res.redirect(`http://localhost:3000/?error=${encodeURIComponent(failureMsg)}`);
      }
    })(req, res, next); // Important: Immediately invoke the middleware returned by passport.authenticate
  }
);
// --------------------------

app.use('/api/auth', authRoutes); 
app.use('/api/users', profileRoutes);

const PORT = process.env.PORT || 3001; // Use a different port than frontend

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

server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`); // Log Swagger URL
}); 