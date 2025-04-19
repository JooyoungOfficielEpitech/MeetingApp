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
 * /api/matches/status:
 *   get:
 *     summary: Get the matching status for the current user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current matching status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isWaiting:
 *                   type: boolean
 *                   description: Whether the user is currently in the waiting list
 *                 activeMatch:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     matchId:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// @ts-ignore
router.get('/status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data in token.' });
    }
    const userId = req.user.userId;
    
    console.log(`[GET /api/matches/status] User ${userId} requested matching status.`);

    try {
        // 1. Check if user has an active match
        const activeMatch = await Match.findOne({
            where: {
                [Op.or]: [{ user1Id: userId }, { user2Id: userId }],
                isActive: true
            },
            attributes: ['matchId']
        });

        if (activeMatch) {
            console.log(`[Match Status] User ${userId} has active match: ${activeMatch.matchId}`);
            return res.status(200).json({
                isWaiting: false,
                activeMatch: {
                    matchId: activeMatch.matchId
                }
            });
        }

        // 2. Check if user is in waiting list
        const waitingEntry = await MatchingWaitList.findOne({
            where: { userId: userId }
        });

        if (waitingEntry) {
            console.log(`[Match Status] User ${userId} is in waiting list (gender: ${waitingEntry.gender}).`);
            return res.status(200).json({
                isWaiting: true,
                activeMatch: null
            });
        }

        // 3. User is neither in a match nor waiting
        console.log(`[Match Status] User ${userId} is not in a match or waiting list.`);
        return res.status(200).json({
            isWaiting: false,
            activeMatch: null
        });
        
    } catch (error) {
        console.error(`[GET /api/matches/status] Error for user ${userId}:`, error);
        next(error);
    }
});

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

        // Check credit balance for female users
        if (user.credit < 1) {
            return res.status(400).json({ message: 'Not enough credits. Need at least 1 credit to start matching.' });
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

        // Deduct 1 credit
        user.credit -= 1;
        await user.save();
        console.log(`[Match Start] Deducted 1 credit from female user ${userId}. New credit: ${user.credit}`);

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

/**
 * @swagger
 * /api/matches/join-queue:
 *   post:
 *     summary: Male users join the matching queue for 1 minute
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: Successfully joined the queue
 *       400:
 *         description: User already in queue, not enough credits, or has active match
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only male users can use this endpoint
 *       500:
 *         description: Server error
 */
// @ts-ignore
router.post('/join-queue', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user.userId !== 'number') {
        return res.status(401).json({ message: 'Unauthorized: Invalid user data in token.' });
    }
    const userId = req.user.userId;
    
    console.log(`[POST /api/matches/join-queue] User ${userId} requested to join matching queue.`);

    try {
        // 1. Check if male
        const user = await User.findByPk(userId);
        if (!user) {
            console.warn(`[Join Queue] User not found in DB: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.gender !== 'male') {
            console.warn(`[Join Queue] User ${userId} is not male (gender: ${user.gender}), cannot join queue.`);
            return res.status(403).json({ message: 'Only male users can join the matching queue.' });
        }

        // 2. Check if already has active match
        const existingMatch = await Match.findOne({ 
            where: { [Op.or]: [{ user1Id: userId }, { user2Id: userId }], isActive: true }
        });
        if (existingMatch) {
            console.warn(`[Join Queue] User ${userId} already has an active match: ${existingMatch.matchId}`);
            return res.status(400).json({ message: 'You already have an active match.' });
        }

        // 3. Check if already in waitlist
        const alreadyWaiting = await MatchingWaitList.findOne({ where: { userId } });
        if (alreadyWaiting) {
            console.warn(`[Join Queue] User ${userId} is already in the waitlist.`);
            return res.status(400).json({ message: 'You are already in the queue.' });
        }

        // 4. Check and deduct credit
        if (user.credit < 1) {
            return res.status(400).json({ message: 'Not enough credits. Need at least 1 credit to join the queue.' });
        }

        // Deduct 1 credit
        user.credit -= 1;
        await user.save();
        console.log(`[Join Queue] Deducted 1 credit from user ${userId}. New credit: ${user.credit}`);

        // 5. Add to waitlist
        await MatchingWaitList.create({ userId: userId, gender: 'male' });
        console.log(`[Join Queue] Added male user ${userId} to waitlist.`);

        // 6. Set timeout to remove from waitlist after 1 minute
        setTimeout(async () => {
            try {
                const removed = await MatchingWaitList.destroy({ where: { userId } });
                if (removed) {
                    console.log(`[Join Queue] Auto-removed male user ${userId} from waitlist after 1 minute.`);
                    
                    // Notify user via socket if connected
                    let userSocketId: string | null = null;
                    for (const [socketId, connectedUser] of connectedUsers.entries()) {
                        if (connectedUser.userId === userId) {
                            userSocketId = socketId;
                            break;
                        }
                    }
                    if (userSocketId) {
                        io.to(userSocketId).emit('match_update', { status: 'idle' });
                        console.log(`[Join Queue] Sent match_update (idle) to user ${userId} after queue timeout.`);
                    }
                }
            } catch (err) {
                console.error(`[Join Queue] Error removing user ${userId} from waitlist after timeout:`, err);
            }
        }, 60000); // 1 minute = 60000 ms

        // 7. Emit socket event for client UI update
        try {
            let userSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === userId) {
                    userSocketId = socketId;
                    break;
                }
            }
            if (userSocketId) {
                io.to(userSocketId).emit('match_update', { status: 'waiting' });
                console.log(`[Join Queue] Sent match_update (waiting) to user ${userId}.`);
            }
        } catch (socketError) {
            console.error('[Join Queue] Error emitting WebSocket update:', socketError);
        }

        return res.status(200).json({ 
            message: 'Successfully joined the matching queue. Will be removed after 1 minute.',
            creditsRemaining: user.credit
        });

    } catch (error) {
        console.error(`[POST /api/matches/join-queue] Error for user ${userId}:`, error);
        next(error);
    }
});

// --- ★ END NEW MATCHING FLOW ENDPOINTS ★ ---

// checkMatchAccess 미들웨어 추가 (로그인한 사용자가 매치에 접근할 권한이 있는지 확인)
const checkMatchAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || typeof req.user.userId !== 'number') {
      return res.status(401).json({ message: 'Unauthorized: Invalid user data in token' });
    }
    
    const userId = req.user.userId;
    const matchId = req.params.matchId;
    
    const match = await Match.findOne({
      where: {
        matchId,
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });
    
    if (!match) {
      return res.status(403).json({ message: 'You do not have access to this match' });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/matches/:matchId:
 *   get:
 *     summary: Get match details
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Match details
 *       404:
 *         description: Match not found
 *       401:
 *         description: Unauthorized (token missing or invalid)
 */
// @ts-ignore
router.get('/:matchId', authenticateToken, checkMatchAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const matchId = req.params.matchId;
        const match = await Match.findOne({
            where: { matchId },
            include: [
                { 
                    model: User, 
                    as: 'User1', 
                    attributes: ['id', 'name', 'nickname', 'gender', 'age', 'profileImageUrls', 'city', 'mbti', 'height', 'createdAt', 'occupation'] 
                },
                { 
                    model: User, 
                    as: 'User2', 
                    attributes: ['id', 'name', 'nickname', 'gender', 'age', 'profileImageUrls', 'city', 'mbti', 'height', 'createdAt', 'occupation'] 
                }
            ]
        });

        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }

        // Format users with nickname preference
        const user1 = match.User1 ? {
            id: match.User1.id,
            name: match.User1.nickname || match.User1.name,
            gender: match.User1.gender,
            age: match.User1.age,
            city: match.User1.city,
            mbti: match.User1.mbti,
            height: match.User1.height,
            occupation: match.User1.occupation,
            createdAt: match.User1.createdAt,
            profileImage: match.User1.profileImageUrls && match.User1.profileImageUrls.length > 0 
                ? match.User1.profileImageUrls[0] : null,
            profileImageUrls: match.User1.profileImageUrls || []
        } : null;

        const user2 = match.User2 ? {
            id: match.User2.id,
            name: match.User2.nickname || match.User2.name,
            gender: match.User2.gender,
            age: match.User2.age,
            city: match.User2.city,
            mbti: match.User2.mbti,
            height: match.User2.height,
            occupation: match.User2.occupation,
            createdAt: match.User2.createdAt,
            profileImage: match.User2.profileImageUrls && match.User2.profileImageUrls.length > 0 
                ? match.User2.profileImageUrls[0] : null,
            profileImageUrls: match.User2.profileImageUrls || []
        } : null;

        res.json({
            matchId: match.matchId,
            isActive: match.isActive,
            createdAt: match.createdAt,
            updatedAt: match.updatedAt,
            user1,
            user2
        });
    } catch (error) {
        next(error);
    }
});

export default router; 