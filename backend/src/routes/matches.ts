import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware'; // 수정된 미들웨어 import
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
// @ts-ignore
router.get('/active', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
    console.log('[/api/matches/active] Received request. Checking req.user...');
    console.log('req.user:', req.user);

    try {
        const userId = req.user?.userId;
        console.log(`Extracted userId: ${userId}, Type: ${typeof userId}`);

        if (userId === undefined || userId === null || typeof userId !== 'number') {
            console.error('Unauthorized: User ID not found or invalid in req.user');
            return res.status(401).json({ message: 'Unauthorized: User ID not found or invalid in token' });
        }

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
            return res.json({ matchId: activeMatch.matchId });
        } else {
            console.log(`No active match found for user ID: ${userId}`);
            return res.status(404).json({ message: 'No active match found' });
        }

    } catch (error) {
        console.error(`Error fetching active match for user (userId from token: ${(req as any).user?.userId}):`, error);
        next(error); 
    }
}));

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
// @ts-ignore
router.post('/start', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data in token.' });
    }
    const userId = req.user.userId;
    
    console.log(`[POST /api/matches/start] User ${userId} requested to start matching.`);

    try {
        const user = await User.findByPk(userId);

        if (!user) {
            console.warn(`[Match Start] User not found in DB: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.gender !== 'female') {
            console.warn(`[Match Start] User ${userId} is not female (gender: ${user.gender}), cannot start match.`);
            return res.status(403).json({ message: 'Only female users can initiate matching.' });
        }

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
            return res.status(202).json({ message: 'Already searching for a match.' });
        }

        const availableMale = await MatchingWaitList.findOne({
            include: [{ model: User, as: 'User', where: { gender: 'male' }, required: true }], 
            order: [['createdAt', 'ASC']]
        });

        if (availableMale) {
            const maleUserId = availableMale.userId;
            console.log(`[Match Start] Immediate match found for User ${userId} with User ${maleUserId}.`);

            const matchId = `match-${userId}-${maleUserId}-${Date.now()}`;
            
            const sequelize = db.sequelize; 
            try {
                await sequelize.transaction(async (t: any) => {
                    const newMatch = await Match.create({
                        matchId: matchId,
                        user1Id: userId, 
                        user2Id: maleUserId,
                        isActive: true,
                        status: 'active' 
                    }, { transaction: t });

                    await MatchingWaitList.destroy({ 
                        where: { userId: [userId, maleUserId] }, 
                        transaction: t 
                    });
                    console.log(`[Match Start Transaction] Match ${matchId} created, users removed from waitlist.`);
                });

                try {
                    let femaleSocketId: string | null = null;
                    let maleSocketId: string | null = null;
                    for (const [socketId, connectedUser] of connectedUsers.entries()) {
                        if (connectedUser.userId === userId) femaleSocketId = socketId;
                        if (connectedUser.userId === maleUserId) maleSocketId = socketId;
                        if (femaleSocketId && maleSocketId) break;
                    }
                    const updatePayload = { status: 'matched', matchId: matchId };
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

                return res.status(200).json({ matchId: matchId });

            } catch (dbError) {
                console.error(`[Match Start] Error during immediate match DB transaction:`, dbError);
                return res.status(500).json({ message: 'Error processing immediate match.' });
            }

        } else {
            console.log(`[Match Start] No immediate match for ${userId}. Adding to waitlist (gender: female).`);
            try {
                await MatchingWaitList.create({ userId: userId, gender: 'female' }); 

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

                return res.status(202).json({ message: 'Searching for a match. Please wait.' });

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
// @ts-ignore
router.get('/check', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data.' });
    }
    const femaleUserId = req.user.userId;
    console.log(`[GET /api/matches/check] Female user ${femaleUserId} checking for match.`);

    const sequelize = db.sequelize;

    try {
        const availableMale = await MatchingWaitList.findOne({
            where: { gender: 'male' },
            order: sequelize.random(), 
            include: [{ model: User, as: 'User', attributes: ['id'] }]
        });

        if (!availableMale) {
            console.log(`[Match Check] No male users waiting for female user ${femaleUserId}.`);
            return res.status(204).send();
        }

        const maleUserId = availableMale.userId;
        console.log(`[Match Check] Found available male user ${maleUserId} for female user ${femaleUserId}. Attempting to create match.`);

        const result = await sequelize.transaction(async (t: any) => {
            const matchId = `match-${femaleUserId}-${maleUserId}-${Date.now()}`;
            const newMatch = await Match.create({
                matchId: matchId,
                user1Id: femaleUserId,
                user2Id: maleUserId,
                isActive: true,
                status: 'active' 
            }, { transaction: t });
            console.log(`[Match Check Transaction] Created Match: ${matchId}`);

            const deletedCount = await MatchingWaitList.destroy({
                where: {
                    userId: [femaleUserId, maleUserId]
                },
                transaction: t
            });
            console.log(`[Match Check Transaction] Removed ${deletedCount} entries from MatchingWaitList.`);
            
            if (deletedCount < 2) {
                console.warn(`[Match Check Transaction] Warning: Expected to remove 2 waitlist entries, but removed ${deletedCount}.`);
            }

            return newMatch.matchId;
        });

        console.log(`[Match Check] Successfully created match ${result} for users ${femaleUserId} and ${maleUserId}.`);

        try {
            let femaleSocketId: string | null = null;
            let maleSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === femaleUserId) {
                    femaleSocketId = socketId;
                }
                if (connectedUser.userId === maleUserId) {
                    maleSocketId = socketId;
                }
                if (femaleSocketId && maleSocketId) break;
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

        return res.status(200).json({ matchId: result });

    } catch (error: any) {
        console.error(`[GET /api/matches/check] Error for user ${femaleUserId}:`, error);
        if (error.message.includes('Transaction Rollback') || (error.original && error.original.message)) {
             console.error('[Match Check] Transaction failed:', error.original || error.message);
        }
        next(error);
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
// @ts-ignore
router.post('/stop', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data.' });
    }
    const userId = req.user?.userId;
    console.log(`[POST /api/matches/stop] User ${userId} requested to stop searching.`);

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const deletedCount = await MatchingWaitList.destroy({ where: { userId } });

        if (deletedCount > 0) {
            console.log(`[Match Stop] User ${userId} removed from waitlist.`);

            try {
                let userSocketId: string | null = null;
                for (const [socketId, connectedUser] of connectedUsers.entries()) {
                    if (connectedUser.userId === userId) {
                        userSocketId = socketId;
                        break;
                    }
                }
                if (userSocketId) {
                    io.to(userSocketId).emit('match_update', { status: 'idle' });
                    console.log(`[Match Stop] Sent match_update (idle) to user ${userId}.`);
                }
            } catch (socketError) {
                 console.error("[Match Stop] Error emitting WebSocket update:", socketError);
            }

            return res.status(200).json({ message: 'Stopped searching for a match.' });
        } else {
            console.log(`[Match Stop] User ${userId} was not found on the waitlist.`);
            return res.status(200).json({ message: 'You were not actively searching.' }); 
        }

    } catch (error) {
        console.error(`[POST /api/matches/stop] Error for user ${userId}:`, error);
        next(error);
    }
});

// --- ★ END NEW MATCHING FLOW ENDPOINTS ★ ---

export default router; 