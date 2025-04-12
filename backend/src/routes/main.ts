import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware'; // Assuming auth middleware exists
const db = require('../../models');
const User = db.User;
const Match = db.Match;

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Main
 *   description: Main page related operations
 */

// Define the expected response structure
interface ButtonStateResponse {
    button_display: string;
    active: boolean;
    matchId: string | null;
}

// Define the expected type for the request object after authentication
interface AuthenticatedRequest extends Request {
    user?: { userId: number };
}

/**
 * @swagger
 * /api/main/button-state:
 *   get:
 *     summary: Get the state for the main action button (Start Matching/Go to Chat)
 *     tags: [Main]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Button state determined successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 button_display:
 *                   type: string
 *                   description: Text to display on the button ("Start Matching" or "Go to Chat Room")
 *                   example: "Start Matching"
 *                 active:
 *                   type: boolean
 *                   description: Whether the button should be active (enabled) or inactive (disabled)
 *                   example: true
 *                 matchId:
 *                   type: string
 *                   nullable: true
 *                   description: The ID of the active match if button_display is "Go to Chat Room", otherwise null.
 *                   example: "match-1-3-1744378175225"
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

// Apply middleware and then the handler
router.get('/button-state', authenticateToken, (async (req: AuthenticatedRequest, res: Response<ButtonStateResponse>, next: NextFunction) => {
    // Type assertion is less safe, prefer optional chaining if possible
    const userId = req.user?.userId;

    if (!userId) {
        // Should be caught by middleware, but included for safety
        return res.status(401).json({ message: 'Unauthorized: User ID not found' } as any); // Cast to any to bypass strict type check if needed
    }

    try {
        const user = await User.findOne({ where: { id: userId }, attributes: ['id', 'gender', 'occupation'] });

        if (!user) {
            // Use status 404 for not found
            return res.status(404).json({ message: 'User not found' } as any); 
        }

        // --- Log retrieved user data --- 
        console.log(`[/button-state] User data from DB for ${userId}:`, JSON.stringify(user));
        console.log(`[/button-state] Checking occupation: ${user.occupation}, Type: ${typeof user.occupation}`);
        // --------------------------------

        let responseData: ButtonStateResponse = {
            button_display: '',
            active: false,
            matchId: null,
        };

        // Explicitly check for non-occupied states (false, 0, "0")
        const isNotOccupied = user.occupation === false || user.occupation === 0 || user.occupation === '0';

        if (!isNotOccupied) { // If NOT in the non-occupied states, consider occupied
            console.log(`[/button-state] User ${userId} is considered OCCUPIED (occupation: ${user.occupation}).`);
            const activeMatch = await Match.findOne({
                where: {
                    [Op.or]: [{ user1Id: userId }, { user2Id: userId }],
                    isActive: true,
                },
                order: [['createdAt', 'DESC']],
            });

            responseData = {
                button_display: 'Go to Chat Room',
                active: true,
                matchId: activeMatch ? activeMatch.matchId : null,
            };

            if (!activeMatch) {
                console.warn(`User ${userId} has occupation=true/1 but no active match found in DB!`);
            }
        } else {
            console.log(`[/button-state] User ${userId} is considered NOT OCCUPIED (occupation: ${user.occupation}).`);
            responseData = {
                button_display: 'Start Matching',
                active: user.gender === 'female',
                matchId: null,
            };
        }

        // Set headers to prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store'); // Typically for CDNs

        res.json(responseData);

    } catch (error) {
        console.error(`Error fetching button state for user ${userId}:`, error);
        next(error); // Pass error to the global error handler
    }
}) as RequestHandler); // Assert the async function to RequestHandler type

export default router; 