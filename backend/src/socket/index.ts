import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
const db = require('../../models'); // Adjust path as needed
const User = db.User;
const Match = db.Match;
import { handleConnection } from './handlers'; // 핸들러 함수 import
import { Gender } from './state'; // 상태 관리 import
import { JWT_SECRET } from '../config/jwt'; // Import from config

export let io: SocketIOServer; // Export io instance

export function initSocket(server: HttpServer) {
    io = new SocketIOServer(server, {
        cors: {
            origin: "http://localhost:3000", // 설정 파일로 이동 고려
            methods: ["GET", "POST"]
        }
    });

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

            // 2. Check if matchId was provided
            if (matchIdFromAuth) {
                console.log(`[AuthMiddleware] Verifying participation for user ${userIdFromToken} in match ${matchIdFromAuth}...`);
                // 3. Fetch the match details from DB
                const match = await Match.findOne({ where: { matchId: matchIdFromAuth } });

                // 4. Validate match existence and participation
                if (!match) {
                    console.error(`[AuthMiddleware] Unauthorized: Match not found (${matchIdFromAuth})`);
                    return next(new Error('Unauthorized: Invalid chat room'));
                }
                if (match.user1Id !== userIdFromToken && match.user2Id !== userIdFromToken) {
                    console.error(`[AuthMiddleware] Unauthorized: User ${userIdFromToken} is not a participant of match ${matchIdFromAuth}`);
                    return next(new Error('Unauthorized: Not a participant of this chat room'));
                }
                console.log(`[AuthMiddleware] User ${userIdFromToken} verified as participant of match ${matchIdFromAuth}. Active status: ${match.isActive}`);
            } else {
                console.log('[AuthMiddleware] No matchId provided, assuming main page connection.');
            }

            // 5. Fetch user status (gender, occupation) from DB
            let userGender: Gender | null = null;
            let isOccupied: boolean = false;
            try {
                const user = await User.findByPk(userIdFromToken, { attributes: ['id', 'gender', 'occupation'] });
                if (user) {
                    userGender = (user.gender && ['male', 'female', 'other'].includes(user.gender)) ? user.gender as Gender : null;
                    isOccupied = user.occupation === true; // Source of truth for occupation
                    console.log(`[AuthMiddleware] User ${userIdFromToken} status from DB - Gender: ${userGender}, Occupation: ${isOccupied}`);
                } else {
                    console.warn(`[AuthMiddleware] User ${userIdFromToken} NOT found in DB during auth. Rejecting.`);
                    return next(new Error('Authentication error: User not found'));
                }
            } catch (dbError: any) {
                console.error(`[AuthMiddleware] DB error fetching user ${userIdFromToken} status:`, dbError);
                return next(new Error('Server error: Could not verify user status'));
            }

            // 6. Store user info on the socket
            (socket as any).user = { userId: userIdFromToken, gender: userGender, isOccupied: isOccupied, initialMatchId: matchIdFromAuth }; // Pass fetched status
            console.log(`[AuthMiddleware] Stored user info on socket:`, (socket as any).user);

            next(); // Allow connection

        } catch (jwtError: any) {
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
    io.on('connection', (socket) => handleConnection(socket, io));
    // ----------------------------------

    console.log('Socket.IO server initialized and connection handler attached.');
    return io; // Return the initialized instance
} 