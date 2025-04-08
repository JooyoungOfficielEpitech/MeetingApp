import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware'; // Import the middleware
const db = require('../../models');
const User = db.User;

// Extend Express Request type to include user property
interface AuthenticatedRequest extends Request {
    user?: { userId: string; email: string };
}

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User Profile
 *   description: Operations related to the logged-in user's profile
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the profile of the currently logged-in user
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile' # Define UserProfile schema later
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// @ts-expect-error // Suppress persistent Express type overload error
router.get('/me', authenticateToken, (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
            return;
        }

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['passwordHash'] }
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json(user);
        return;

    } catch (error) {
        console.error('Error fetching user profile:', error);
        next(error);
    }
}) as RequestHandler);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update the profile of the currently logged-in user
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               dob: { type: string, format: date }
 *               weight: { type: number }
 *               address1: { type: string }
 *               address2: { type: string }
 *               occupation: { type: string }
 *               income: { type: string }
 *               # Add other updatable fields, exclude email, password, profilePic etc.
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// @ts-expect-error // Suppress persistent Express type overload error
router.put('/me', authenticateToken, (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Define allowed fields to update
        const allowedUpdates = ['name', 'dob', 'weight', 'address1', 'address2', 'occupation', 'income'];
        const updates: { [key: string]: any } = {};

        // Filter request body to include only allowed fields
        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // Update user (Sequelize handles partial updates)
        await user.update(updates);

        // Recalculate age if dob was updated
        if (updates.dob) {
            try {
                const birthDate = new Date(updates.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                if (!isNaN(age) && age >= 0) {
                     await user.update({ age: age });
                } else {
                     await user.update({ age: null }); // Or handle invalid date differently
                }
            } catch (error) {
                console.error("Error calculating age on update:", error);
                 await user.update({ age: null }); // Handle error case
            }
        }

        // Refetch user data to return the updated profile (excluding password)
        const updatedUser = await User.findByPk(userId, {
             attributes: { exclude: ['passwordHash'] }
        });

        res.json(updatedUser);
        return;

    } catch (error) {
        console.error('Error updating user profile:', error);
        next(error);
    }
}) as RequestHandler);

// --- Swagger Schema Definition (Add this later in server.ts or a dedicated file) ---
/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id: { type: integer, readOnly: true }
 *         email: { type: string, format: email, readOnly: true }
 *         name: { type: string }
 *         dob: { type: string, format: date }
 *         age: { type: integer, readOnly: true }
 *         weight: { type: number, format: float, nullable: true }
 *         phone: { type: string, nullable: true }
 *         address1: { type: string, nullable: true }
 *         address2: { type: string, nullable: true }
 *         occupation: { type: string, nullable: true }
 *         income: { type: string, nullable: true }
 *         profilePictureUrl: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *   securitySchemes:
 *      bearerAuth:
 *          type: http
 *          scheme: bearer
 *          bearerFormat: JWT
 */
// -----------------------------------------------------------------------------------

export default router; 