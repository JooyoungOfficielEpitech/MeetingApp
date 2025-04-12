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
import { Op } from 'sequelize'; // Import Op for SQL operations
import bcrypt from 'bcrypt'; // Import bcrypt
import { Request, Response, NextFunction } from 'express';

// --- Import User model --- 
const db = require('../models'); // Adjust path if needed
const User = db.User;
const Match = db.Match; // Match 모델 import 추가
const Message = db.Message; // Message 모델 import 추가
const MatchingWaitList = db.MatchingWaitList; // Import MatchingWaitList
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
// Define Gender type again
type Gender = 'male' | 'female' | 'other'; 

interface ConnectedUser {
    userId: number;
    socketId: string;
    gender: Gender | null; 
    isOccupied: boolean; // Track if the user is currently in an active match
}

// Map stores all connected users
export const connectedUsers = new Map<string, ConnectedUser>();
// Array stores only FEMALE users actively waiting for a match
export const waitingUsers: ConnectedUser[] = []; 
// ---------------------------------------------------------------

const io = new SocketIOServer(server, {
    cors: {
        origin: "http://localhost:3000", 
        methods: ["GET", "POST"]
    }
});

// --- Middleware to attach io to request --- 
const attachIo = (req: Request, res: Response, next: NextFunction) => {
  (req as any).io = io; // Attach io instance to the request object
  next();
};
// ----------------------------------------

// --- Socket.IO Authentication Middleware ---
io.use(async (socket: Socket, next) => {
    console.log(`[AuthMiddleware] Connection attempt by Socket ID: ${socket.id}`);
    const token = socket.handshake.auth.token;
    const matchIdFromAuth = socket.handshake.auth.matchId; // Get matchId from client auth

    console.log(`[AuthMiddleware] Received Auth - Token: ${!!token}, MatchID: ${matchIdFromAuth || 'N/A'}`);

    if (!token) {
        console.error("[AuthMiddleware] Socket connection error: No token provided.");
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        // 1. Verify the JWT token
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        const userIdFromToken = decoded.userId;
        console.log("[AuthMiddleware] Token verified for user ID:", userIdFromToken);

        // 2. Check if matchId was provided (required for chat rooms, optional for main page)
        if (matchIdFromAuth) {
            console.log(`[AuthMiddleware] Verifying participation for user ${userIdFromToken} in match ${matchIdFromAuth}...`);
            // 3. Fetch the match details from DB
            const match = await Match.findOne({ where: { matchId: matchIdFromAuth } });

            // 4. Validate match existence, participation, and active status
            if (!match) {
                console.error(`[AuthMiddleware] Unauthorized: Match not found (${matchIdFromAuth})`);
                return next(new Error('Unauthorized: Invalid chat room'));
            }
            if (match.user1Id !== userIdFromToken && match.user2Id !== userIdFromToken) {
                console.error(`[AuthMiddleware] Unauthorized: User ${userIdFromToken} is not a participant of match ${matchIdFromAuth}`);
                return next(new Error('Unauthorized: Not a participant of this chat room'));
            }
            if (!match.isActive) {
                console.warn(`[AuthMiddleware] Connection denied: Match ${matchIdFromAuth} is inactive.`);
                return next(new Error('Unauthorized: This chat room is no longer active'));
            }
            console.log(`[AuthMiddleware] User ${userIdFromToken} verified as active participant of match ${matchIdFromAuth}.`);
        } else {
             // If no matchId is provided, it might be the main page connection. Allow for now.
             console.log('[AuthMiddleware] No matchId provided, assuming main page connection.');
        }

        // 5. Fetch user status (gender, occupation) - Keep existing logic for this
        let userGender: Gender | null = null;
        let isOccupied: boolean = false;
        try {
            const user = await User.findByPk(userIdFromToken, { attributes: ['id', 'gender', 'occupation'] });
            if (user) {
                userGender = (user.gender && ['male', 'female', 'other'].includes(user.gender)) ? user.gender as Gender : null;
                isOccupied = user.occupation === true;
                console.log(`[AuthMiddleware] User ${userIdFromToken} status - Gender: ${userGender}, Occupation: ${isOccupied}`);
            } else {
                console.warn(`[AuthMiddleware] User ${userIdFromToken} NOT found in DB when fetching status (after token/match verification).`);
            }
        } catch (dbError: any) {
            console.error(`[AuthMiddleware] DB error fetching user ${userIdFromToken} status:`, dbError);
            // Allow connection even if status fetch fails? Or reject?
            // For now, allow but status might be inaccurate.
        }

        // 6. Store user info on the socket
        (socket as any).user = { userId: userIdFromToken, gender: userGender, isOccupied: isOccupied }; 
        console.log(`[AuthMiddleware] Stored user info on socket:`, (socket as any).user);

        next(); // Allow connection if all checks passed

    } catch (jwtError: any) {
        // Handle JWT verification errors (invalid token, expired)
        console.error("[AuthMiddleware] JWT Verification Error:", jwtError.message);
        let errorMessage = 'Authentication error: Invalid token';
        if (jwtError.name === 'TokenExpiredError') {
            errorMessage = 'Authentication error: Token expired';
        } else if (jwtError.name === 'JsonWebTokenError') {
            errorMessage = `Authentication error: ${jwtError.message}`;
        }
        next(new Error(errorMessage));
    }
});
// -------------------------------------------

// --- Socket.IO Connection Handling ---
io.on('connection', (socket: any) => {
    // Ensure user object exists from middleware before proceeding
    if (!socket.user || !socket.user.userId) {
        console.error("Connection handler: User info missing on socket. Disconnecting.");
        socket.disconnect(true); 
        return;
    }

    const userId: number = socket.user.userId;
    const userGender: Gender | null = socket.user.gender;
    let isOccupied: boolean = socket.user.isOccupied;
    const initialMatchId: string | null = socket.handshake.auth.matchId;
    let currentMatchId: string | null = null;

    console.log(`User connected: ${userId} (Gender: ${userGender}, Initial Occupied: ${isOccupied}, Socket ID: ${socket.id}). InitialMatchId: ${initialMatchId || 'N/A'}`);

    // Update connectedUsers map
    const userInfo: ConnectedUser = { userId, socketId: socket.id, gender: userGender, isOccupied };
    connectedUsers.set(socket.id, userInfo);
    console.log('[Connection] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(${u.gender}, occ:${u.isOccupied})`)); // More detailed log

    // Define sendChatHistory here so it's accessible by attemptMatch
    const sendChatHistory = async (matchIdToSendFor: string | null) => {
        if (!matchIdToSendFor) { return; }
        try {
            const history = await Message.findAll({ where: { matchId: matchIdToSendFor }, order: [['createdAt', 'ASC']], attributes: ['senderId', 'text', 'createdAt'] });
            const formattedHistory = history.map((msg: any) => ({ senderId: msg.senderId, text: msg.text, timestamp: msg.createdAt.getTime() }));
            socket.emit('chat-history', formattedHistory);
            console.log(`Sent chat history (${formattedHistory.length} messages) for match ${matchIdToSendFor}`);
        } catch (error) {
            console.error(`Error fetching/sending chat history for ${matchIdToSendFor}:`, error);
            socket.emit('error', '채팅 기록 로딩 오류');
        }
    };

    // --- Matching Logic (Triggered ONLY by Female Users) --- 
    socket.on('start-matching', async () => {
        // Guard clauses: Check if female, not occupied, not already waiting
        if (userGender !== 'female') {
            console.warn(`User ${userId} (Gender: ${userGender}) tried to emit 'start-matching'. Ignoring.`);
            return;
        }
        if (isOccupied) {
            console.warn(`User ${userId} is already occupied. Cannot start matching.`);
            socket.emit('matching-error', '이미 매칭된 상태입니다.');
            return;
        }
        if (waitingUsers.some(u => u.userId === userId)) {
            console.log(`User ${userId} is already in the female waiting list.`);
            socket.emit('already-waiting');
            return;
        }

        console.log(`Female user ${userId} requested matching.`);

        // Find an available male user from the DATABASE WAITLIST
        let availableMaleEntry: any = null;
        try {
            // Find any user in the waitlist
            availableMaleEntry = await MatchingWaitList.findOne({ 
                // You might want to add an order clause, e.g., oldest entry first
                // order: [[ 'createdAt', 'ASC' ]]
            });
        } catch (dbError: any) {
            console.error(`Error finding available male user in MatchingWaitList for user ${userId}:`, dbError);
            socket.emit('matching-error', '매칭 상대를 찾는 중 오류가 발생했습니다.');
            return;
        }

        if (availableMaleEntry) {
            const opponentUserId = availableMaleEntry.userId;
            console.log(`Match found for Female User ${userId} with Male User ${opponentUserId} from DB WaitList.`);
            const matchId = `match-${userId}-${opponentUserId}-${Date.now()}`;
            
            // --- Remove male from DB WaitList FIRST --- 
            try {
                 await MatchingWaitList.destroy({ where: { userId: opponentUserId } });
                 console.log(`Removed Male ${opponentUserId} from MatchingWaitList.`);
            } catch (destroyError: any) {
                 console.error(`Error removing male ${opponentUserId} from waitlist:`, destroyError);
                 socket.emit('matching-error', '매칭 상대를 대기 목록에서 제거하는 중 오류 발생.');
                 return; // Stop matching if we can't remove
            }
            // -----------------------------------------

            // Find opponent's socket ID if they are currently connected
            let opponentSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === opponentUserId) {
                    opponentSocketId = socketId;
                    break;
                }
            }
            console.log(`Opponent ${opponentUserId} is ${opponentSocketId ? 'ONLINE' : 'OFFLINE'}.`);

            try {
                // --- DB Updates --- 
                await Match.create({ matchId: matchId, user1Id: userId, user2Id: opponentUserId, isActive: true });
                console.log('New match record created in DB:', matchId);
                await User.update({ occupation: true }, { where: { id: userId } });
                await User.update({ occupation: true }, { where: { id: opponentUserId } });
                console.log(`Set DB occupation=true for users ${userId} and ${opponentUserId}`);

                // --- Update In-Memory State (connectedUsers map) --- 
                const initiatorInfo = connectedUsers.get(socket.id);
                if (initiatorInfo) initiatorInfo.isOccupied = true;
                 isOccupied = true; // Update local variable for initiator
                if (opponentSocketId) { 
                    const opponentInfo = connectedUsers.get(opponentSocketId);
                    if (opponentInfo) opponentInfo.isOccupied = true;
                    console.log(`Set Map isOccupied=true for users ${userId} and ONLINE opponent ${opponentUserId}.`);
                } else {
                    console.log(`Set Map isOccupied=true for user ${userId}. Opponent ${opponentUserId} is offline.`);
                }
                console.log('[DB WaitList Match Success] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));

            } catch (dbError: any) {
                console.error('Error during match creation or user status update (DB Find WaitList):', dbError);
                 io.to(socket.id).emit('matching-error', '매치 생성 또는 상태 업데이트 중 오류 발생.');
                 // IMPORTANT: Put male back in waitlist if subsequent DB updates fail
                 MatchingWaitList.findOrCreate({ where: { userId: opponentUserId } })
                    .catch((err: any) => console.error("Failed to put male back in waitlist on error:", err)); // Typed error
                 return;
            }

            // --- Notify Users & Join Room --- 
            io.to(socket.id).emit('match-success', { matchId: matchId, opponentId: opponentUserId });
            socket.join(matchId);
            currentMatchId = matchId; 
            console.log(`User ${userId} joined room ${matchId}. Sent match-success.`);
            sendChatHistory(currentMatchId);

            if (opponentSocketId) {
                const opponentSocket = io.sockets.sockets.get(opponentSocketId);
                if (opponentSocket) {
                    io.to(opponentSocketId).emit('match-success', { matchId: matchId, opponentId: userId });
                    opponentSocket.join(matchId);
                    console.log(`ONLINE Opponent User ${opponentUserId} joined room ${matchId}. Sent match-success.`);
                } else {
                    console.warn(`Opponent socket ${opponentSocketId} (User ${opponentUserId}) disappeared before joining room ${matchId}.`);
                }
            }

        } else {
            // No available male user found in WaitList, add the female user to the memory waiting list
            console.log(`No available male opponent found in DB WaitList, adding Female User ${userId} to memory waiting list.`);
            const currentUserInfo = connectedUsers.get(socket.id);
            if (currentUserInfo) {
               if (!waitingUsers.some((u) => u.userId === userId)) {
                   waitingUsers.push(currentUserInfo);
               } else {
                   console.log(`User ${userId} is already in the female waiting list.`);
               }
               console.log("Waiting List (Females waiting for Males):", waitingUsers.map(u => u.userId));
               socket.emit('waiting-for-match');
            } else {
                console.error(`Could not find user info for ${userId} in connectedUsers map before adding to memory waiting list.`);
                socket.emit('matching-error', '서버 오류: 사용자 정보를 찾을 수 없습니다.');
            }
        }
    });

    // --- Auto-join Room and Fetch History on Initial Connect ---
    if (initialMatchId) {
        // Verify the match status before joining
        const verifyAndJoin = async () => {
            try {
                // Find the match by ID, regardless of isActive status initially
                const match = await Match.findOne({ where: { matchId: initialMatchId } });

                if (!match) {
                    // Case 1: Match doesn't exist at all
                    console.warn(`User ${userId} attempted to join non-existent match: ${initialMatchId}`);
                    socket.emit('error', '만료되었거나 유효하지 않은 채팅방입니다.'); 
                } else if (!match.isActive) {
                    // Case 2: Match exists but is already inactive (opponent likely left)
                    console.warn(`User ${userId} attempted to join an INACTIVE match: ${initialMatchId}`);
                    socket.emit('error', '상대방이 이미 채팅방을 나갔습니다.'); // More specific error message
                } else {
                    // Case 3: Match exists and is active - Proceed to join
                    socket.join(initialMatchId);
                    currentMatchId = initialMatchId; // Set server-side tracking
                    console.log(`User ${userId} joined active Socket.IO room: ${currentMatchId}`);
                    sendChatHistory(currentMatchId); // Send history
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
        let opponentUserId: number | null = null;
        let opponentSocketId: string | null = null; // Store opponent socket ID if found
        try {
            const match = await Match.findOne({ where: { matchId: matchId } });
            if (match) {
                opponentUserId = (match.user1Id === userId) ? match.user2Id : match.user1Id;

                // Find opponent's socket ID from connectedUsers map
                for (const [socketId, connectedUser] of connectedUsers.entries()) {
                    if (connectedUser.userId === opponentUserId) {
                        opponentSocketId = socketId;
                        break;
                    }
                }

                if (match.isActive) {
                    await match.update({ isActive: false }); 
                    console.log(`Match ${matchId} DEACTIVATED in DB by user ${userId}.`);
                    socket.to(matchId).emit('opponent-left-chat', { userId: userId }); 
                    console.log(`Notified room ${matchId} that user ${userId} has left permanently.`);

                    // Reset DB occupation status
                    await User.update({ occupation: false }, { where: { id: userId } });
                    if (opponentUserId) {
                        await User.update({ occupation: false }, { where: { id: opponentUserId } });
                        console.log(`Reset DB occupation=false for users ${userId} and ${opponentUserId}.`);
                    }

                    // --- Reset In-Memory State (isOccupied) --- 
                    const initiatorInfo = connectedUsers.get(socket.id);
                    if (initiatorInfo) initiatorInfo.isOccupied = false;
                    let opponentInfo = null;
                    if (opponentSocketId) opponentInfo = connectedUsers.get(opponentSocketId);
                    if (opponentInfo) opponentInfo.isOccupied = false;
                     // Update local isOccupied variable for the current socket
                    isOccupied = false;
                    console.log(`Reset Map isOccupied=false for users ${userId} and ${opponentUserId}.`);
                    console.log('[Force Leave] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));

                    // --- Add male user(s) back to MatchingWaitList --- 
                    let maleToAddBack: number | null = null;
                    if (userGender === 'male') maleToAddBack = userId;
                    else if (opponentInfo && opponentInfo.gender === 'male') maleToAddBack = opponentUserId;
                    
                    if (maleToAddBack) {
                        const maleId = maleToAddBack;
                        MatchingWaitList.findOrCreate({ where: { userId: maleId } })
                         .then(([entry, created]: [any, boolean]) => { 
                            if (created) console.log(`Male user ${maleId} added back to MatchingWaitList after match end.`);
                            // REMOVED: Immediate match attempt removed from here.
                            // It will be handled if/when the male user connects/reconnects.
                         })
                         .catch((error: any) => console.error(`Error adding male user ${maleId} back to waitlist:`, error));
                    }
                    // -----------------------------------------------------

                } else {
                    console.log(`Match ${matchId} was already inactive when user ${userId} tried to force leave.`);
                    // Optional: Reset occupation even if match was already inactive, as a safety measure?
                    // await User.update({ occupation: false }, { where: { id: userId } });
                    // if (opponentUserId) await User.update({ occupation: false }, { where: { id: opponentUserId } });
                }
            } else {
                console.warn(`Match ${matchId} not found in DB when trying to force leave.`);
                 // Safety measure: Reset leaving user's occupation if match not found
                 await User.update({ occupation: false }, { where: { id: userId } });
                 console.log(`Reset occupation=false for user ${userId} as match ${matchId} was not found.`);
            }
        } catch (error) {
            console.error(`Error during force leave for match ${matchId}:`, error);
            // Safety measure: Attempt to reset leaving user's occupation on error
            try {
               await User.update({ occupation: false }, { where: { id: userId } });
               console.log(`Reset occupation=false for user ${userId} after error during force leave.`);
            } catch (updateError) {
               console.error(`Failed to reset occupation for user ${userId} after force leave error:`, updateError);
            }
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
    socket.on('disconnect', async (reason: string) => { // Keep async if other async operations remain, otherwise remove
      console.log(`User disconnected: ${userId} (Socket ID: ${socket.id}, Reason: ${reason})`);
      const wasWaiting = waitingUsers.findIndex((u) => u.socketId === socket.id);
      if (wasWaiting > -1) {
             waitingUsers.splice(wasWaiting, 1);
             console.log(`Female user ${userId} removed from waiting list due to disconnect.`);
             console.log("Waiting List after disconnect:", waitingUsers.map(u => u.userId));
      }
      connectedUsers.delete(socket.id);
      console.log('[Disconnection] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));
    });
    // ----------------------------------------------------
});
// ----------------------------------

// --- Ensure Admin User Function --- 
const ensureAdminUser = async () => {
  const ADMIN_EMAIL = 'root@root.com';
  const ADMIN_PASSWORD = 'alpine'; // Store password securely in real app (e.g., env vars)

  try {
    const existingAdmin = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (!existingAdmin) {
      console.log(`Admin user (${ADMIN_EMAIL}) not found. Creating...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

      await User.create({
        email: ADMIN_EMAIL,
        passwordHash: passwordHash,
        name: 'Root Admin', // Provide a default name
        gender: 'other',   // Provide a default gender or make nullable in model
        isAdmin: true,     // Set as admin
        // Add defaults for other required fields if necessary
        occupation: 'Admin' // Example default
      });
      console.log(`Admin user (${ADMIN_EMAIL}) created successfully.`);

    } else {
        // Optionally ensure the existing user is marked as admin
        if (!existingAdmin.isAdmin) {
            console.log(`Existing user (${ADMIN_EMAIL}) found but is not admin. Updating...`);
            existingAdmin.isAdmin = true;
            await existingAdmin.save();
            console.log(`Admin user (${ADMIN_EMAIL}) updated to admin.`);
        } else {
             console.log(`Admin user (${ADMIN_EMAIL}) already exists.`);
        }
    }
  } catch (error) {
    console.error('Error ensuring admin user:', error);
  }
};
// --------------------------------

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

// Apply io attachment middleware BEFORE the admin routes
app.use('/api/admin', attachIo);

// Import and use routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import matchesRouter from './routes/matches';
import mainRoutes from './routes/main'; // Import the new main routes
import adminRoutes from './routes/admin'; // Import the new admin routes

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

        if (isProfileComplete) {
          // Profile is complete, generate token and redirect to main app area via auth callback page
          const payload = { 
              userId: user.id, 
              email: user.email,
              status: user.status // Include status here as well
          }; 
          const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
          console.log('Profile complete. Redirecting to /auth/callback with token containing status:', payload.status);
          return res.redirect(`http://localhost:3000/auth/callback?token=${token}`); // Standard login flow
        } else {
          // Profile is incomplete, redirect to complete profile page (use session, no token needed)
          console.log('Profile incomplete. Redirecting to /signup/complete-profile for completion.');
          // Store necessary info in session if not already there (e.g., if strategy didn't handle this case)
          // For consistency, ensure pendingSocialProfile is set even for existing users needing completion
          req.session.pendingSocialProfile = {
            provider: 'google', // or user.provider if available
            id: user.googleId, // Assuming googleId field exists
            email: user.email,
            name: user.name, // Include existing name if available
          };
          // Save session before redirecting
          req.session.save((err: any) => {
              if (err) {
                  console.error("Session save error before redirecting incomplete existing user:", err);
                  // Handle error appropriately, maybe redirect to an error page
                  return res.redirect('http://localhost:3000/?error=session_save_error');
              }
              console.log('Session saved for incomplete existing user. Redirecting...');
              return res.redirect(`http://localhost:3000/signup/complete-profile`); // Redirect without token
          });
        }
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
app.use('/api/profile', profileRoutes); // Applied authenticateToken within the router file for profile
app.use('/api/matches', matchesRouter); // Applied authenticateToken within the router file for matches
app.use('/api/main', mainRoutes);      // Applied authenticateToken within the router file for main
app.use('/api/admin', adminRoutes);      // Admin routes now have req.io available

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

server.listen(PORT, async () => { // Make the callback async
    console.log(`Server listening on *:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);

    // Ensure the database is connected and then ensure the admin user exists
    try {
        await db.sequelize.authenticate(); // Verify DB connection
        console.log('Database connection established successfully.');
        await ensureAdminUser(); // Call the function to check/create admin user
    } catch (error) {
        console.error('Unable to connect to the database or ensure admin user:', error);
    }
}); 