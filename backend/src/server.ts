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
import { authenticateToken } from './middleware/authMiddleware'; // Import authentication middleware

// --- Import User model --- 
const db = require('../models'); // Adjust path if needed
const User = db.User;
const Match = db.Match; // Match 모델 import 추가
const Message = db.Message; // Message 모델 import 추가
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
    console.log(`[AuthMiddleware] Connection attempt by Socket ID: ${socket.id}`);
    console.log(`[AuthMiddleware] Received handshake auth object:`, socket.handshake.auth); // Keep logging auth

    const token = socket.handshake.auth.token;
    const matchIdFromAuth = socket.handshake.auth.matchId; // Log received matchId

    console.log(`[AuthMiddleware] Token present: ${!!token}, Match ID from auth: ${matchIdFromAuth || 'MISSING!'}`);

    if (!token) {
        console.error("[AuthMiddleware] Socket connection error: No token provided.");
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        console.log("[AuthMiddleware] Token verified for user ID:", decoded.userId);

        const user = await User.findByPk(decoded.userId, { attributes: ['id', 'gender'] });
        if (!user) {
             console.error(`[AuthMiddleware] Socket connection error: User not found for ID ${decoded.userId}`);
             return next(new Error('Authentication error: User not found'));
        }

        const userGender = (user.gender && ['male', 'female', 'other'].includes(user.gender)) ? user.gender as Gender : null;

        // Store only user info, REMOVE initialMatchId storage from here
        (socket as any).user = { userId: decoded.userId, gender: userGender };
        console.log(`[AuthMiddleware] Stored user info on socket:`, (socket as any).user);

        next();
    } catch (err: any) {
        console.error("[AuthMiddleware] Socket connection error: Invalid token.", err.message); // Log specific error message
        next(new Error('Authentication error: Invalid token'));
    }
});
// -------------------------------------------

// --- Socket.IO Connection Handling ---
io.on('connection', (socket: any) => {
    // Ensure user object exists from middleware before proceeding
    if (!socket.user || !socket.user.userId) {
        console.error("Connection handler: User info missing on socket. Disconnecting.");
        socket.disconnect(true); // Force disconnect if auth middleware failed unexpectedly
        return;
    }

    const userId: number = socket.user.userId;
    const userGender: Gender | null = socket.user.gender;
    // Read matchId DIRECTLY from handshake.auth within the connection handler
    const initialMatchId: string | null = socket.handshake.auth.matchId;
    let currentMatchId: string | null = null;

    console.log(`User connected: ${userId} (Socket ID: ${socket.id}). Read initialMatchId from handshake.auth: ${initialMatchId || 'N/A'}`);

    // --- Define sendChatHistory function (remains the same scope) ---
    const sendChatHistory = async (matchIdToSendFor: string | null) => {
        if (!matchIdToSendFor) {
            console.log("sendChatHistory called with null matchId, skipping.");
            return;
        }
        try {
            console.log(`Fetching chat history for match: ${matchIdToSendFor}`);
            const history = await Message.findAll({
                where: { matchId: matchIdToSendFor },
                order: [['createdAt', 'ASC']],
                attributes: ['senderId', 'text', 'createdAt'],
            });
            const formattedHistory = history.map((msg: any) => ({
                 senderId: msg.senderId,
                 text: msg.text,
                 timestamp: msg.createdAt.getTime(),
            }));
            console.log(`Sending chat history (${formattedHistory.length} messages) to user ${userId} for match ${matchIdToSendFor}`);
            socket.emit('chat-history', formattedHistory);
        } catch (error) {
            console.error(`Error fetching chat history for match ${matchIdToSendFor}:`, error);
            socket.emit('error', '채팅 기록을 불러오는 중 오류가 발생했습니다.');
        }
    };
    // ---------------------------------------------------------

    // --- Auto-join Room and Fetch History on Initial Connect ---
    if (initialMatchId) {
        // Verify the match is still active before joining
        const verifyAndJoin = async () => {
            try {
                const match = await Match.findOne({ where: { matchId: initialMatchId, isActive: true } });
                if (match) {
                    socket.join(initialMatchId);
                    currentMatchId = initialMatchId; // Set server-side tracking
                    console.log(`User ${userId} joined active Socket.IO room: ${currentMatchId}`);
                    sendChatHistory(currentMatchId); // Send history
                } else {
                    console.warn(`User ${userId} attempted to join inactive or non-existent match: ${initialMatchId}`);
                    socket.emit('error', '만료되었거나 유효하지 않은 채팅방입니다.');
                }
            } catch (error) {
                 console.error(`Error verifying match ${initialMatchId} for user ${userId}:`, error);
                 socket.emit('error', '채팅방 상태 확인 중 오류 발생');
            }
        };
        verifyAndJoin();
    } else {
         console.warn(`User ${userId} connected without an initialMatchId in handshake.auth.`);
    }
    // ---------------------------------------------------------

    const userInfo: ConnectedUser = { userId: userId, socketId: socket.id, gender: userGender };
    connectedUsers.set(socket.id, userInfo);

    // --- Matching Logic --- 
    socket.on('start-matching', async () => {
        console.log(`User ${userId} requested matching.`);

        if (!userGender) {
             console.warn(`User ${userId} cannot match: Gender not set or invalid.`);
             socket.emit('matching-error', '성별 정보가 설정되지 않아 매칭을 시작할 수 없습니다.');
             return;
        }

        let opponentGender: Gender | null = null;
        if (userGender === 'male') opponentGender = 'female';
        else if (userGender === 'female') opponentGender = 'male';
        
        if (!opponentGender) {
             console.warn(`User ${userId} cannot match: Unsupported gender for matching (${userGender}).`);
             socket.emit('matching-error', '현재 성별(${userGender})은 매칭을 지원하지 않습니다.');
             return;
        }

        if (waitingUsers[opponentGender].length > 0) {
            const opponent = waitingUsers[opponentGender].shift()!;
            console.log(`Match found for User ${userId} with User ${opponent.userId}`);
            const matchId = `match-${userId}-${opponent.userId}-${Date.now()}`;
            try {
                 await Match.create({ matchId: matchId, user1Id: userId, user2Id: opponent.userId, isActive: true });
                 console.log('New match record created in DB:', matchId);
            } catch (dbError) {
                console.error('Error creating Match record in DB:', dbError);
                 io.to(socket.id).emit('matching-error', '매치 정보를 기록하는 중 오류가 발생했습니다.');
                 io.to(opponent.socketId).emit('matching-error', '매치 정보를 기록하는 중 오류가 발생했습니다.');
                 waitingUsers[opponentGender].unshift(opponent);
                 console.log(`Opponent ${opponent.userId} put back in waiting list due to DB error.`);
                 return;
            }
            io.to(socket.id).emit('match-success', { matchId: matchId, opponentId: opponent.userId });
            io.to(opponent.socketId).emit('match-success', { matchId: matchId, opponentId: userId });
            socket.join(matchId);
            const opponentSocket = io.sockets.sockets.get(opponent.socketId);
            if (opponentSocket) {
                 opponentSocket.join(matchId);
                 console.log(`User ${opponent.userId} also joined room ${matchId}`);
                 currentMatchId = matchId; // Set currentMatchId for the initiator
                 // --- Call sendChatHistory here after successful match ---
                 sendChatHistory(currentMatchId);
                 // ------------------------------------------------------
            } else {
                 console.warn(`Opponent socket ${opponent.socketId} not found during match setup.`);
                 try {
                      await Match.update({ isActive: false }, { where: { matchId: matchId } });
                      console.log(`Match record ${matchId} deactivated due to missing opponent socket during match setup.`);
                  } catch (updateError) {
                       console.error(`Error deactivating match record ${matchId}:`, updateError);
                  }
                  io.to(socket.id).emit('matching-error', '매칭된 상대방과의 연결에 실패했습니다.');
                  return;
            }
        } else {
            console.log(`No opponent found for ${userGender}, adding User ${userId} to waiting list.`);
             if (!waitingUsers[userGender].some((u: ConnectedUser) => u.userId === userId)) {
                waitingUsers[userGender].push(userInfo);
             } else {
                console.log(`User ${userId} is already in the waiting list.`);
             }
             console.log("Waiting Lists:", waitingUsers);
             socket.emit('waiting-for-match');
        }
    });

    // --- Handle Chat Messages --- 
    socket.on('chat message', async (data: { matchId: string, text: string }) => {
         const { matchId: messageMatchId, text } = data;

         // Validate against the server's tracked currentMatchId for this socket
         if (!userId || messageMatchId !== currentMatchId) { // Use currentMatchId set by server
             console.warn(`User ${userId} msg rejected. MsgMatchId: ${messageMatchId}, Server's currentMatchId: ${currentMatchId}`);
             socket.emit('error', '메시지를 보낼 수 없는 방입니다.'); // Send specific error
             return;
         }

         // Additional check: Ensure match is still active in DB before saving/sending
         try {
             const match = await Match.findOne({ where: { matchId: messageMatchId, isActive: true } });
             if (!match) {
                 console.warn(`Match ${messageMatchId} is not active. Message from ${userId} rejected.`);
                 socket.emit('error', '비활성화된 채팅방에는 메시지를 보낼 수 없습니다.');
                 return;
             }

            const trimmedText = text.trim();
            if (!trimmedText || trimmedText.length === 0 || trimmedText.length > 500) {
                 console.warn(`User ${userId} sent invalid message text.`);
                 socket.emit('error', '메시지 내용이 유효하지 않습니다.');
                 return;
            }

            console.log(`Saving message from user ${userId} for match ${messageMatchId}`);
            const newMessage = await Message.create({
                matchId: messageMatchId,
                senderId: userId,
                text: trimmedText,
                timestamp: new Date()
            });
            console.log(`Message saved with ID: ${newMessage.id}`);

            const messageToSendToClient = {
                 senderId: userId,
                 text: trimmedText,
                 timestamp: newMessage.createdAt.getTime(),
            };

            console.log(`Broadcasting message to room ${messageMatchId} (excluding sender ${userId})`);
            socket.to(messageMatchId).emit('chat message', messageToSendToClient);
            console.log(`Broadcast successful for message ID: ${newMessage.id}`);

         } catch (error: any) {
             console.error(`[ERROR] Failed processing 'chat message' for match ${messageMatchId} from user ${userId}:`, error);
             socket.emit('error', '메시지 저장 또는 전송 중 오류 발생');
         }
    });

    // --- Handle Force Leaving Chat Room (Permanent) ---
    socket.on('force-leave-chat', async (matchId: string) => {
        console.log(`User ${userId} requested to FORCE LEAVE chat room: ${matchId}`);
        try {
            const match = await Match.findOne({ where: { matchId: matchId } });
            if (match) {
                if (match.isActive) {
                    await match.update({ isActive: false }); // Deactivate the match
                    console.log(`Match ${matchId} DEACTIVATED in DB by user ${userId}.`);
                    socket.to(matchId).emit('opponent-left-chat', { userId: userId }); // Use existing event name
                    console.log(`Notified room ${matchId} that user ${userId} has left permanently.`);
                } else {
                    console.log(`Match ${matchId} was already inactive when user ${userId} tried to force leave.`);
                }
            } else {
                console.warn(`Match ${matchId} not found in DB when trying to force leave.`);
            }
        } catch (error) {
            console.error(`Error deactivating match ${matchId} on force leave:`, error);
        } finally {
             socket.leave(matchId);
             console.log(`User ${userId} left Socket.IO room: ${matchId}`);
             if (currentMatchId === matchId) {
                 currentMatchId = null;
             }
        }
    });
    // -----------------------------------------------

    // --- Handle Disconnection (Unexpected or Back Button) ---
    socket.on('disconnect', (reason: string) => {
      console.log(`User disconnected: ${userId} (Socket ID: ${socket.id}, Reason: ${reason})`);
      connectedUsers.delete(socket.id);
      const disconnectedMatchId = currentMatchId;

      // Remove user from waiting list if they were waiting
      if (userGender && waitingUsers[userGender]) {
            const waitingIndex = waitingUsers[userGender].findIndex((u: ConnectedUser) => u.socketId === socket.id);
            if (waitingIndex > -1) {
                waitingUsers[userGender].splice(waitingIndex, 1);
                console.log(`User ${userId} removed from waiting list (${userGender}) due to disconnect.`);
            }
      }
      console.log("Waiting Lists after disconnect:", waitingUsers);

      // DO NOT notify opponent or deactivate match on simple disconnect
      if (disconnectedMatchId) {
           console.log(`Socket for user ${userId} disconnected (Reason: ${reason}) while associated with room ${disconnectedMatchId}. No action taken.`);
      }
    });
    // ----------------------------------------------------
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
import matchesRouter from './routes/matches';

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
app.use('/api/profile', authenticateToken, profileRoutes); // Apply authenticateToken middleware
app.use('/api/matches', authenticateToken, matchesRouter); // Register matches routes with authentication

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