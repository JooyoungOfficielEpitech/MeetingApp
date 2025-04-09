import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware'; // Assuming auth middleware exists
import { Op } from 'sequelize';
const db = require('../../models');
const Match = db.Match;

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
router.get('/active', (async (req: Request, res: Response, next: NextFunction) => {
    console.log('[/api/matches/active] Received request. Checking req.user...');
    console.log('req.user:', (req as any).user); // Log the entire user object attached by middleware

    try {
        // Directly extract userId, expecting a number from JWT payload
        const userId = (req as any).user?.userId;
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


export default router; 