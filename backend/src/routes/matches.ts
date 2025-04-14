import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware'; // Assuming auth middleware exists
import { Op, fn, literal } from 'sequelize';
const db = require('../../models');
const Match = db.Match;
const User = db.User;
const Message = db.Message; // Assuming message model for chat
const MatchingWaitList = db.MatchingWaitList; // ★ Assuming waitlist model exists ★
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs if needed
import { io } from '../socket'; // Import the io instance
import { connectedUsers } from '../socket/state'; // Import connected users map
// import { io, userSockets } from '../socket/server'; // Assuming socket server exists and exports these
const userSockets: Map<number, string> = new Map(); // Placeholder for user socket tracking
// import { AuthenticatedRequest } from '../middleware/authMiddleware'; // Import the interface

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Matches
 *   description: Operations related to matches/chat rooms
 */

/**
 * @swagger
 * /api/matches/active:
 *   get:
 *     summary: Get the active match for the current user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active match found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matchId:
 *                   type: string
 *                   description: The ID of the active match
 *       404:
 *         description: No active match found for the user
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/active', authenticateToken, (async (req: any, res: Response, next: NextFunction) => {
    console.log('[/api/matches/active] Received request. Checking req.user...');
    console.log('req.user:', req.user); // Access req.user directly

    try {
        // Directly extract userId, expecting a number from JWT payload
        const userId = req.user?.userId;
        console.log(`Extracted userId: ${userId}, Type: ${typeof userId}`); // Log extracted ID and its type

        // Check if userId exists and is a number
        if (userId === undefined || userId === null || typeof userId !== 'number') {
            console.error('Unauthorized: User ID not found or invalid in req.user');
            return res.status(401).json({ message: 'Unauthorized: User ID not found or invalid in token' });
        }

        // No need for parseInt anymore
        console.log(`Checking for active match for user ID: ${userId}`);

        const activeMatch = await Match.findOne({
            where: {
                [Op.or]: [
                    { user1Id: userId },
                    { user2Id: userId }
                ],
                isActive: true
            },
            order: [['createdAt', 'DESC']]
        });

        if (activeMatch) {
            console.log(`Active match found: ${activeMatch.matchId} for user ID: ${userId}`);
            res.json({ matchId: activeMatch.matchId });
        } else {
            console.log(`No active match found for user ID: ${userId}`);
            res.status(404).json({ message: 'No active match found' });
        }

    } catch (error) {
        console.error(`Error fetching active match for user (userId from token: ${(req as any).user?.userId}):`, error);
        next(error); 
    }
}) as RequestHandler);

// --- ★ NEW MATCHING FLOW ENDPOINTS ★ ---

/**
 * @swagger
 * /api/matches/start:
 *   post:
 *     summary: Start finding a match (female users only)
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: 'Match found immediately', content: { application/json: { schema: { properties: { matchId: { type: string } } } } } }
 *       202: { description: 'Added to waitlist, start periodic checking' }
 *       400: { description: 'User already in waitlist or active match / Only female users can start' }
 *       401: { description: 'Unauthorized' }
 *       403: { description: 'Forbidden (not a female user or other restriction)' }
 *       500: { description: 'Server error' }
 */
router.post('/start', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
    // Access req.user, check for its existence and properties
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data in token.' });
    }
    const userId = req.user.userId;
    
    console.log(`[POST /api/matches/start] User ${userId} requested to start matching.`);

    try {
        // Fetch the user from DB to get the gender
        const user = await User.findByPk(userId);

        if (!user) {
            console.warn(`[Match Start] User not found in DB: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        // 1. Check if user is female using DB data
        if (user.gender !== 'female') {
            console.warn(`[Match Start] User ${userId} is not female (gender: ${user.gender}), cannot start match.`);
            return res.status(403).json({ message: 'Only female users can initiate matching.' });
        }

        // 2. Check if user is already in an active match or on the waitlist
        const existingMatch = await Match.findOne({ 
            where: { [Op.or]: [{ user1Id: userId }, { user2Id: userId }], isActive: true }
        });
        if (existingMatch) {
            console.warn(`[Match Start] User ${userId} is already in an active match: ${existingMatch.matchId}`);
            return res.status(400).json({ message: 'You are already in an active match.', matchId: existingMatch.matchId });
        }

        const alreadyWaiting = await MatchingWaitList.findOne({ where: { userId } });
        if (alreadyWaiting) {
            console.warn(`[Match Start] User ${userId} is already on the waitlist.`);
            // If already waiting, perhaps just return the waiting status
            return res.status(202).json({ message: 'Already searching for a match.' });
        }

        // 3. Try to find an immediate match (male user on waitlist)
        const availableMale = await MatchingWaitList.findOne({
            include: [{ model: User, as: 'User', where: { gender: 'male' }, required: true }], 
            order: [['createdAt', 'ASC']] // Optional: FIFO matching
        });

        if (availableMale) {
            // --- IMMEDIATE MATCH FOUND --- 
            const maleUserId = availableMale.userId;
            console.log(`[Match Start] Immediate match found for User ${userId} with User ${maleUserId}.`);

            const matchId = `match-${userId}-${maleUserId}-${Date.now()}`;
            
            // Use a transaction for atomicity
            const sequelize = db.sequelize; 
            try {
                await sequelize.transaction(async (t: any) => {
                    // Create Match record
                    const newMatch = await Match.create({
                        matchId: matchId,
                        user1Id: userId, 
                        user2Id: maleUserId,
                        isActive: true,
                        status: 'active' 
                    }, { transaction: t });

                    // Remove both users from waitlist
                    await MatchingWaitList.destroy({ 
                        where: { userId: [userId, maleUserId] }, 
                        transaction: t 
                    });
                    console.log(`[Match Start Transaction] Match ${matchId} created, users removed from waitlist.`);
                    // Return matchId from transaction scope if needed elsewhere, though not needed for response here
                });
                // --- Transaction End --- 

                // --- Notify users via WebSocket AFTER successful transaction --- 
                try {
                    let femaleSocketId: string | null = null;
                    let maleSocketId: string | null = null;
                    for (const [socketId, connectedUser] of connectedUsers.entries()) {
                        if (connectedUser.userId === userId) femaleSocketId = socketId;
                        if (connectedUser.userId === maleUserId) maleSocketId = socketId;
                        if (femaleSocketId && maleSocketId) break;
                    }
                    const updatePayload = { status: 'matched', matchId: matchId }; // Use matchId directly
                    if (femaleSocketId) {
                        io.to(femaleSocketId).emit('match_update', updatePayload);
                        console.log(`[Match Start] Sent match_update (matched) to female user ${userId} (Socket ${femaleSocketId}).`);
                    }
                    if (maleSocketId) {
                        io.to(maleSocketId).emit('match_update', updatePayload);
                        console.log(`[Match Start] Sent match_update (matched) to male user ${maleUserId} (Socket ${maleSocketId}).`);
                    }
                } catch (socketError) {
                    console.error("[Match Start] Error emitting WebSocket update for immediate match:", socketError);
                }
                // ----------------------------------

                // Respond to the female user who initiated
                res.status(200).json({ matchId: matchId });

            } catch (dbError) { // Catch errors from the transaction
                console.error(`[Match Start] Error during immediate match DB transaction:`, dbError);
                return res.status(500).json({ message: 'Error processing immediate match.' });
            }

        } else {
            // --- NO IMMEDIATE MATCH - ADD TO WAITLIST --- 
            console.log(`[Match Start] No immediate match for ${userId}. Adding to waitlist (gender: female).`);
            // Wrap in try-catch for safety
            try {
                await MatchingWaitList.create({ userId: userId, gender: 'female' }); 

                // --- Notify female user they are waiting --- 
                try {
                    let femaleSocketId: string | null = null;
                    for (const [socketId, connectedUser] of connectedUsers.entries()) {
                        if (connectedUser.userId === userId) {
                            femaleSocketId = socketId;
                            break;
                        }
                    }
                    if (femaleSocketId) {
                        io.to(femaleSocketId).emit('match_update', { status: 'finding' });
                        console.log(`[Match Start] Sent match_update (finding) to user ${userId}.`);
                    }
                } catch (socketError) {
                     console.error("[Match Start] Error emitting WebSocket update for waiting status:", socketError);
                }
                // ----------------------------------------
                res.status(202).json({ message: 'Searching for a match. Please wait.' });

            } catch (waitlistError) {
                 console.error(`[Match Start] Error adding user ${userId} to waitlist:`, waitlistError);
                 return res.status(500).json({ message: 'Error adding to waitlist.' });
            }
        }

    } catch (error) {
        console.error(`[POST /api/matches/start] Error for user ${userId}:`, error);
        next(error);
    }
});

/**
 * @swagger
 * /api/matches/check:
 *   get:
 *     summary: Check if a match has been found for the waiting user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: 'Match found', content: { application/json: { schema: { properties: { matchId: { type: string } } } } } }
 *       204: { description: 'No match found yet' }
 *       401: { description: 'Unauthorized' }
 *       404: { description: 'User not found or not currently searching' }
 *       500: { description: 'Server error' }
 */
router.get('/check', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
    // Access req.user, check for its existence and properties
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data in token.' });
    }
    const femaleUserId = req.user.userId;
    console.log(`[GET /api/matches/check] Female user ${femaleUserId} checking for match.`);

    // Get Sequelize instance for transaction and random function
    const sequelize = db.sequelize; // Assuming db object holds the sequelize instance

    try {
        // Find one random male user from the waitlist
        const availableMale = await MatchingWaitList.findOne({
            where: { gender: 'male' },
            // Use sequelize.random() for cross-DB compatibility (or specific function like fn('RAND') for MySQL)
            order: sequelize.random(), 
            include: [{ model: User, as: 'User', attributes: ['id'] }] // Include User just to confirm, only need id
        });

        if (!availableMale) {
            // No male user waiting
            console.log(`[Match Check] No male users waiting for female user ${femaleUserId}.`);
            return res.status(204).send(); // No Content
        }

        const maleUserId = availableMale.userId;
        console.log(`[Match Check] Found available male user ${maleUserId} for female user ${femaleUserId}. Attempting to create match.`);

        // --- Match Found - Create Match and Remove from Waitlist (Transaction) --- 
        const result = await sequelize.transaction(async (t: any) => { // Use 'any' or import Transaction type
            // 1. Create the Match record
            const matchId = `match-${femaleUserId}-${maleUserId}-${Date.now()}`;
            const newMatch = await Match.create({
                matchId: matchId,
                user1Id: femaleUserId, // User who initiated the check
                user2Id: maleUserId,   // The matched user
                isActive: true,
                status: 'active' 
            }, { transaction: t });
            console.log(`[Match Check Transaction] Created Match: ${matchId}`);

            // 2. Remove BOTH users from the waitlist
            const deletedCount = await MatchingWaitList.destroy({
                where: {
                    userId: [femaleUserId, maleUserId]
                },
                transaction: t
            });
            console.log(`[Match Check Transaction] Removed ${deletedCount} entries from MatchingWaitList.`);
            
            // Check if expected number of entries were removed
            if (deletedCount < 2) { // Should ideally remove 2 entries
                // This might happen in rare race conditions, log a warning
                console.warn(`[Match Check Transaction] Warning: Expected to remove 2 waitlist entries, but removed ${deletedCount}.`);
                // Depending on policy, you might want to throw an error here to rollback
                // throw new Error('Failed to remove both users from waitlist correctly.');
            }

            // 3. Return the matchId from the transaction
            return newMatch.matchId;
        });
        // --- Transaction End --- 

        console.log(`[Match Check] Successfully created match ${result} for users ${femaleUserId} and ${maleUserId}.`);

        // --- Notify users via WebSocket --- 
        try {
            // Find sockets for both users
            let femaleSocketId: string | null = null;
            let maleSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === femaleUserId) {
                    femaleSocketId = socketId;
                }
                if (connectedUser.userId === maleUserId) {
                    maleSocketId = socketId;
                }
                if (femaleSocketId && maleSocketId) break; // Found both
            }

            const updatePayload = { status: 'matched', matchId: result };

            if (femaleSocketId) {
                io.to(femaleSocketId).emit('match_update', updatePayload);
                console.log(`[Match Check] Sent match_update to female user ${femaleUserId} (Socket ${femaleSocketId})`);
            }
            if (maleSocketId) {
                io.to(maleSocketId).emit('match_update', updatePayload);
                console.log(`[Match Check] Sent match_update to male user ${maleUserId} (Socket ${maleSocketId})`);
            }
        } catch (socketError) {
            console.error("[Match Check] Error emitting WebSocket update:", socketError);
        }
        // ----------------------------------

        // Return the new match ID
        res.status(200).json({ matchId: result });

    } catch (error: any) {
        console.error(`[GET /api/matches/check] Error for user ${femaleUserId}:`, error);
        // Check if it's a transaction rollback error or something else
        if (error.message.includes('Transaction Rollback') || (error.original && error.original.message)) {
             console.error('[Match Check] Transaction failed:', error.original || error.message);
        }
        next(error); // Pass to global error handler
    }
});

/**
 * @swagger
 * /api/matches/stop:
 *   post:
 *     summary: Stop searching for a match
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: 'Stopped searching for a match successfully' }
 *       401: { description: 'Unauthorized' }
 *       404: { description: 'User not found or was not searching' }
 *       500: { description: 'Server error' }
 */
router.post('/stop', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    console.log(`[POST /api/matches/stop] User ${userId} requested to stop searching.`);

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        // Remove user from waitlist
        const deletedCount = await MatchingWaitList.destroy({ where: { userId } });

        if (deletedCount > 0) {
            console.log(`[Match Stop] User ${userId} removed from waitlist.`);

            // --- Notify user via WebSocket --- 
            try {
                let userSocketId: string | null = null;
                for (const [socketId, connectedUser] of connectedUsers.entries()) {
                    if (connectedUser.userId === userId) {
                        userSocketId = socketId;
                        break;
                    }
                }
                if (userSocketId) {
                    io.to(userSocketId).emit('match_update', { status: 'idle' }); // Send idle status
                    console.log(`[Match Stop] Sent match_update (idle) to user ${userId}.`);
                }
            } catch (socketError) {
                 console.error("[Match Stop] Error emitting WebSocket update:", socketError);
            }
            // ----------------------------------

            res.status(200).json({ message: 'Stopped searching for a match.' });
        } else {
            console.log(`[Match Stop] User ${userId} was not found on the waitlist.`);
            // No need to emit if user wasn't waiting
            res.status(200).json({ message: 'You were not actively searching.' }); 
        }

    } catch (error) {
        console.error(`[POST /api/matches/stop] Error for user ${userId}:`, error);
        next(error);
    }
});

// --- ★ END NEW MATCHING FLOW ENDPOINTS ★ ---

export default router; 