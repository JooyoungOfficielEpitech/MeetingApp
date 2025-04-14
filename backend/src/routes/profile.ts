import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt';
const db = require('../../models');
const User = db.User;
const Match = db.Match;
const { Op } = require("sequelize");

// --- ★ Define Request Type Structure Locally ★ ---
interface AuthenticatedRequestWithFiles extends Request {
    // Define structure added by authenticateToken
    user?: {
      userId: number;
      email: string;
      status?: string;
    };
    files?: { // Define structure added by multer.fields
        profilePictures?: Express.Multer.File[];
        businessCard?: Express.Multer.File[];
    };
    // Add session type if needed within this file
    // session?: import('express-session').Session & Partial<import('express-session').SessionData> & { ... };
}
// ---------------------------------------------

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
// @ts-ignore // Ignore overload error for this handler
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
// @ts-ignore // Ignore overload error for this handler
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
        let hasUpdates = false;
        for (const key of allowedUpdates) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) { // More robust check
                // Allow setting null explicitly for fields like dob, weight etc.
                updates[key] = req.body[key]; 
                hasUpdates = true;
            }
        }
        console.log('Applying updates:', updates);

        // Update user only if there are fields to update
        if (hasUpdates) {
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

            // ★ Update status to pending_approval and clear rejection reason after any profile update ★
            await user.update({
                status: 'pending_approval',
                rejectionReason: null
            });
            console.log(`User ${userId} status set to pending_approval and rejection reason cleared after profile update.`);
            // ---------------------------------------------------------------------------------------

        } else {
            console.log(`No updatable fields provided for user ${userId}. Skipping update.`);
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
// @ts-ignore // Ignore overload error for this handler
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

// --- Multer Configuration (Copied and adapted from auth.ts for regular users) ---
const uploadsBaseDir = path.join(__dirname, '..', '..', 'uploads');
const profileUploadDir = path.join(uploadsBaseDir, 'profiles');
const cardUploadDir = path.join(uploadsBaseDir, 'business_cards');
fs.mkdirSync(profileUploadDir, { recursive: true });
fs.mkdirSync(cardUploadDir, { recursive: true });
console.log(`[Profile Multer] Ensured upload directories exist.`);

type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: DestinationCallback) => {
        let uploadPath = '';
        if (file.fieldname === 'profilePictures') uploadPath = profileUploadDir;
        else if (file.fieldname === 'businessCard') uploadPath = cardUploadDir;
        else return cb(new Error('Invalid field name for file upload'), '');
        cb(null, uploadPath);
    },
    filename: (req: any, file: Express.Multer.File, cb: FileNameCallback) => {
        // ★ Use userId from token for filename ★
        const userId = req.user?.userId || 'unknown-user'; 
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = `${userId}-${file.fieldname}-${uniqueSuffix}${extension}`;
        console.log(`[Profile Multer] Generating filename: ${filename} for user: ${userId}`);
        cb(null, filename);
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Invalid file type, only images are allowed!'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 4 } });
// --- End Multer Configuration ---

// --- ★ NEW Endpoint for Regular Signup Profile Completion ★ ---
/**
 * @swagger
 * /api/profile/complete-regular:
 *   post:
 *     summary: Complete user profile after regular signup (with file uploads)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: [] # Requires JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [age, height, mbti, gender, profilePictures, businessCard]
 *             properties:
 *               age: { type: integer }
 *               height: { type: integer }
 *               mbti: { type: string, maxLength: 4 }
 *               gender: { type: string, enum: ['male', 'female'] }
 *               profilePictures: { type: array, items: { type: string, format: binary }, maxItems: 3 }
 *               businessCard: { type: string, format: binary }
 *     responses:
 *       200: { description: 'Profile completed successfully', content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       400: { description: 'Validation errors or missing files' }
 *       401: { description: 'Unauthorized (token missing or invalid)' }
 *       404: { description: 'User not found' }
 *       500: { description: 'Server error' }
 */
// @ts-ignore // Ignore overload error for this handler
router.post(
    '/complete-regular',
    authenticateToken as express.RequestHandler, 
    upload.fields([ // Apply multer AFTER auth
        { name: 'profilePictures', maxCount: 3 },
        { name: 'businessCard', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userId = (req as any).user?.userId;
        const files = (req as any).files;

        console.log(`[POST /api/profile/complete-regular] Processing request for user ID: ${userId}`);

        if (!userId) {
            console.error('[complete-regular] Error: userId missing after authenticateToken.');
            res.status(401).json({ message: 'Authentication failed: User ID not found.' });
            return;
        }

        const cleanupFiles = () => {
             console.warn(`[complete-regular] Cleaning up uploaded files for failed request (User ID: ${userId}).`);
             if (files?.profilePictures) files.profilePictures.forEach((f: Express.Multer.File) => { try { fs.unlinkSync(f.path); } catch (e) { console.error(`Error deleting ${f.path}:`, e); }});
             if (files?.businessCard) files.businessCard.forEach((f: Express.Multer.File) => { try { fs.unlinkSync(f.path); } catch (e) { console.error(`Error deleting ${f.path}:`, e); }});
        };

        // --- Validation ---
        const { age, height, mbti, gender } = req.body;
        const errors: string[] = [];
        if (!age || isNaN(parseInt(age)) || parseInt(age) < 19) errors.push('Valid age (19+) is required.');
        if (!height || isNaN(parseInt(height)) || parseInt(height) < 100) errors.push('Valid height (>= 100cm) is required.');
        if (!mbti || !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('Valid MBTI (4 letters) is required.');
        if (!gender || !['male', 'female'].includes(gender.toLowerCase())) errors.push('Valid gender (male/female) is required.');
        if (!files?.profilePictures || files.profilePictures.length === 0) errors.push('At least one profile picture required.');
        else if (files.profilePictures.length > 3) errors.push('Maximum 3 profile pictures allowed.');
        if (!files?.businessCard || files.businessCard.length === 0) errors.push('Business card image required.');
        else if (files.businessCard.length > 1) errors.push('Only one business card image allowed.');

        if (errors.length > 0) {
             console.warn(`[complete-regular] Validation failed for user ${userId}:`, errors);
             cleanupFiles();
             res.status(400).json({ message: 'Validation failed', errors });
             return;
        }
        // --- End Validation ---

        try {
            const user = await User.findByPk(userId);
            if (!user) {
                console.error(`[complete-regular] Error: User not found for ID: ${userId}`);
                cleanupFiles();
                res.status(404).json({ message: 'User associated with this token not found.' });
                return;
            }
            
            // Check if profile already completed (optional, maybe allow updates?)
            // if (user.status !== 'pending_profile_completion') { ... }

            // Prepare file paths
            if (!files || !files.profilePictures || !files.businessCard) { // Simplified check after validation
                 console.error('[complete-regular] Internal Server Error: File objects missing after validation.');
                 cleanupFiles();
                 res.status(500).json({ message: 'Internal server error processing uploaded files.' });
                 return;
            }
            const profileImageUrls = files.profilePictures.map((file: Express.Multer.File) => `/uploads/profiles/${path.basename(file.path)}`);
            const businessCardImageUrl = `/uploads/business_cards/${path.basename(files.businessCard[0].path)}`;

            // --- Update user record --- 
            await user.update({
                age: parseInt(age),
                height: parseInt(height),
                mbti: mbti.toUpperCase(),
                gender: gender.toLowerCase(),
                profileImageUrls: profileImageUrls,
                businessCardImageUrl: businessCardImageUrl,
                status: 'pending_approval', // Set status to pending after completion
                rejectionReason: null, // ★ Clear rejection reason upon successful completion/resubmission ★
                occupation: false, // Keep occupation false until admin approves
            });
            console.log(`[complete-regular] User ${userId} profile completed, status set to pending_approval, rejection reason cleared.`);
            // -------------------------

            // --- Generate NEW token with pending_approval status --- 
            const payload = {
                userId: user.id,
                email: user.email, // Email shouldn't change here
                status: 'pending_approval', // Use the new status
                gender: user.gender // Include updated gender
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            // -------------------------------------------------------

            // Prepare user response
            const updatedUser = await User.findByPk(userId, { attributes: { exclude: ['passwordHash', 'googleId', 'kakaoId'] } }); // Fetch updated user data

            res.status(200).json({
                message: 'Profile information submitted successfully. Waiting for administrator approval.',
                token: token, // Send the new token
                user: updatedUser // Send updated user data
            });

        } catch (error: any) {
            console.error(`[POST /api/profile/complete-regular] Error processing profile completion for user ${userId}:`, error);
            cleanupFiles();
            // Handle specific DB errors if needed
             if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeDatabaseError') {
                res.status(500).json({ message: 'Database error during profile update.' });
             } else {
                 next(error);
             }
        }
    }
);
// --- ★ End NEW Endpoint ★ ---

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