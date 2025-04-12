import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
const db = require('../../models');
const User = db.User;
const Match = db.Match;
const { Op } = require("sequelize");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User Profile
 *   description: Operations related to the logged-in user's profile
 */

/**
 * @swagger
 * /api/profile/me:
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
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.userId;
    console.log(`[GET /api/profile/me] Request for user ID: ${userId}`);

    if (!userId) {
        res.status(401).json({ message: 'User ID not found in token' });
        return; // Return void
    }

    try {
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'email',
                'name',
                'gender',
                'dob',
                'age',
                'height',
                'mbti',
                'occupation',
                'profilePictureUrl',
                'status' // Include the status field
                // Exclude passwordHash, googleId, etc.
            ]
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return; // Return void
        }
        
        console.log('[GET /api/profile/me] Found user:', user.toJSON()); // Log found user
        res.status(200).json(user);
        // No explicit return needed

    } catch (error) {
        console.error(`[GET /api/profile/me] Error fetching profile for user ${userId}:`, error);
        next(error); // Pass to global error handler
    }
});

/**
 * @swagger
 * /api/profile/me:
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
router.put('/me', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
    console.log('[/api/profile/me PUT] Received request. req.user:', (req as any).user);
    try {
        const userId = (req as any).user?.userId;
        console.log(`Extracted userId for update: ${userId}, Type: ${typeof userId}`);

        if (userId === undefined || userId === null || typeof userId !== 'number') {
            console.error('Unauthorized: User ID not found or invalid for update');
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log(`Attempting to find user for update, PK: ${userId}`);
        const user = await User.findByPk(userId);
        if (!user) {
            console.log(`User not found for update, ID: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Define allowed fields to update - ADD gender, height, mbti
        const allowedUpdates = ['name', 'dob', 'weight', 'address1', 'address2', 'occupation', 'income', 'gender', 'height', 'mbti', 'phone']; // Added missing fields
        const updates: { [key: string]: any } = {};

        console.log('Request body for update:', req.body);
        // Filter request body to include only allowed fields
        for (const key of allowedUpdates) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) { // More robust check
                // Allow setting null explicitly for fields like dob, weight etc.
                updates[key] = req.body[key]; 
            }
        }
        console.log('Applying updates:', updates);

        // Update user (Sequelize handles partial updates)
        await user.update(updates);
        console.log(`User ${userId} updated successfully with fields:`, Object.keys(updates));

        // Recalculate age if dob was updated
        if ('dob' in updates) { 
            console.log('DOB updated, recalculating age...');
            try {
                 if (updates.dob) { 
                    const birthDate = new Date(updates.dob);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    if (!isNaN(age) && age >= 0) {
                         await user.update({ age: age });
                         console.log(`Age recalculated and updated to: ${age}`);
                    } else {
                         console.warn('Invalid date resulted in invalid age for user:', userId);
                         await user.update({ age: null }); 
                         console.log('Age set to null due to invalid DOB calculation.');
                    }
                } else {
                    await user.update({ age: null });
                    console.log('DOB set to null, age also set to null.');
                }
            } catch (error) {
                console.error("Error calculating/updating age:", error);
                 await user.update({ age: null }); 
                 console.log('Age set to null due to error during calculation.');
            }
        }

        console.log(`Refetching updated user profile for ID: ${userId}`);
        const updatedUser = await User.findByPk(userId, {
             attributes: { exclude: ['passwordHash'] }
        });

        console.log('Sending updated user profile back to client.');
        return res.json(updatedUser);

    } catch (error) {
        console.error('Error updating user profile:', error);
        next(error);
    }
}) as RequestHandler);

/**
 * @swagger
 * /api/profile/me:
 *   delete:
 *     summary: Deactivate the currently logged-in user account (soft delete)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: User account deactivated successfully.
 *       401:
 *         description: Unauthorized (token missing or invalid).
 *       404:
 *         description: User not found.
 *       500:
 *         description: Server error during deactivation.
 */
router.delete('/me', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
    console.log('[/api/profile/me DELETE] Received request. req.user:', (req as any).user);
    try {
        const userId = (req as any).user?.userId;
        console.log(`Extracted userId for delete: ${userId}`);

        if (!userId || typeof userId !== 'number') {
            console.error('Unauthorized: User ID missing or invalid for delete.');
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log(`Finding user to delete, PK: ${userId}`);
        const user = await User.findByPk(userId);
        if (!user) {
            console.log(`User not found for deletion, ID: ${userId}`);
            // User might already be deleted, treat as success?
            return res.status(404).json({ message: 'User not found' });
        }

        // Soft delete the user
        await user.destroy(); // This triggers soft delete due to paranoid: true
        console.log(`User ${userId} soft deleted (deletedAt set).`);

        // Deactivate active matches involving this user
        console.log(`Deactivating active matches for user ${userId}...`);
        const [updateCount] = await Match.update(
            { isActive: false },
            {
                where: {
                    [Op.or]: [
                        { user1Id: userId },
                        { user2Id: userId }
                    ],
                    isActive: true
                }
            }
        );
        console.log(`Deactivated ${updateCount} active matches for user ${userId}.`);

        // Respond with success (No Content)
        return res.status(204).send();

    } catch (error) {
        console.error(`Error deleting user profile for ID ${ (req as any).user?.userId } :`, error);
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