import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt';
import { v4 as uuidv4 } from 'uuid';
import { deleteSupabaseFile } from '../utils/supabaseUploader';
import { validateProfileUpdate } from '../utils/profileValidator';
import {
    processProfileImages,
    processBusinessCard,
    prepareProfileUpdates,
    generateTokenAfterProfileUpdate,
    prepareUserResponse
} from '../services/profileService';

const db = require('../../models');
const User = db.User;
const Match = db.Match;
const { Op } = require("sequelize");
const MatchingWaitList = db.MatchingWaitList;

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
    console.log(`[GET /api/profile/me] Request for user ID: ${userId}, Type: ${typeof userId}`);

    if (!userId) {
        console.error('[GET /api/profile/me] Error: User ID not found in token');
        res.status(401).json({ message: 'User ID not found in token' });
        return; // Return void
    }

    try {
        console.log(`[GET /api/profile/me] Finding user with ID: ${userId}`);
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'email',
                'name',
                'nickname',
                'gender',
                'age',
                'height',
                'mbti',
                'occupation',
                'profileImageUrls',
                'businessCardImageUrl',
                'status',
                'rejectionReason',
                'city',
                'credit'
                // Exclude passwordHash, googleId, etc.
            ]
        });

        if (!user) {
            console.error(`[GET /api/profile/me] User not found for ID: ${userId}`);
            
            // 모든 사용자 ID 목록 확인 (디버깅용)
            try {
                const allUsers = await User.findAll({
                    attributes: ['id', 'email'],
                    limit: 10
                });
                console.log(`[GET /api/profile/me] Available users (first 10):`, 
                    allUsers.map((u: any) => ({ id: u.id, email: u.email })));
            } catch (err) {
                console.error('[GET /api/profile/me] Error fetching all users:', err);
            }
            
            res.status(404).json({ 
                message: 'User not found', 
                details: `User with ID ${userId} does not exist in the database. Please check your account or contact support.` 
            });
            return; // Return void
        }
        
        console.log('[GET /api/profile/me] Found user data:', JSON.stringify(user.toJSON())); // Log found user data
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
        const allowedUpdates = ['name', 'gender', 'height', 'mbti', 'occupation', 'city', 'nickname']; // Removed fields
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

        // --- START: Hard Delete Logic ---
        console.log(`[User Delete] User ${userId} requested permanent deletion.`);
        const uploadsBaseDir = path.join(__dirname, '..', '..', 'uploads'); // Define base path

        // --- 1. Delete Associated Files ---
        const filesToDelete: string[] = [];
        if (user.profileImageUrls && Array.isArray(user.profileImageUrls)) {
            user.profileImageUrls.forEach((relativeUrl: string) => {
                if (relativeUrl && typeof relativeUrl === 'string') {
                    const filePathPart = relativeUrl.startsWith('/uploads/') ? relativeUrl.substring('/uploads/'.length) : relativeUrl;
                    filesToDelete.push(path.join(uploadsBaseDir, filePathPart));
                }
            });
        }
        if (user.businessCardImageUrl && typeof user.businessCardImageUrl === 'string') {
            const filePathPart = user.businessCardImageUrl.startsWith('/uploads/') ? user.businessCardImageUrl.substring('/uploads/'.length) : user.businessCardImageUrl;
            filesToDelete.push(path.join(uploadsBaseDir, filePathPart));
        }
        // Also delete old single profile picture if exists
        if (user.profilePictureUrl && typeof user.profilePictureUrl === 'string') {
             const filePathPart = user.profilePictureUrl.startsWith('/uploads/') ? user.profilePictureUrl.substring('/uploads/'.length) : user.profilePictureUrl;
             filesToDelete.push(path.join(uploadsBaseDir, filePathPart));
        }

        console.log(`[User Delete] Attempting to delete files for user ${userId}:`, filesToDelete);
        filesToDelete.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[User Delete] Successfully deleted file: ${filePath}`);
                } catch (unlinkError) {
                    console.error(`[User Delete] Error deleting file ${filePath}:`, unlinkError);
                    // Decide if this error should stop the whole process
                }
            } else {
                console.warn(`[User Delete] File not found, skipping deletion: ${filePath}`);
            }
        });
        // --- End File Deletion ---

        // --- 2. Delete Associated Matches ---
        console.log(`[User Delete] Deleting matches associated with user ${userId}.`);
        try {
            const deletedMatchesCount = await Match.destroy({
                where: {
                    [Op.or]: [
                        { user1Id: userId },
                        { user2Id: userId }
                    ]
                }
            });
            console.log(`[User Delete] Deleted ${deletedMatchesCount} matches associated with user ${userId}.`);
        } catch (matchError) {
            console.error(`[User Delete] Error deleting matches for user ${userId}:`, matchError);
            // Decide if you want to stop the user deletion process if match deletion fails
            // Maybe wrap steps 2, 3, 4 in a transaction? For now, log and continue.
        }
        // --- End Match Deletion ---

        // --- 3. Remove from MatchingWaitList if present ---
         try {
             await MatchingWaitList.destroy({ where: { userId: userId } });
             console.log(`[User Delete] Removed user ${userId} from MatchingWaitList (if existed).`);
         } catch (waitlistError) {
             console.error(`[User Delete] Error removing user ${userId} from MatchingWaitList:`, waitlistError);
         }
         // -------------------------------------------

        // --- 4. Hard delete the user record ---
        await user.destroy({ force: true }); // Use force: true to bypass paranoid mode
        console.log(`User ${userId} permanently deleted from database.`);
        // --- END: Hard Delete Logic ---

        // Respond with success (No Content)
        return res.status(204).send();

    } catch (error) {
        console.error(`Error deleting user profile for ID ${ (req as any).user?.userId } :`, error);
        next(error);
    }
}) as RequestHandler);

// --- Multer Configuration (메모리 저장소 사용) ---
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Invalid file type, only images are allowed!') as any);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 4 } });
// --- End Multer Configuration ---

// --- ★ NEW Endpoint for Regular Signup Profile Completion (or Update) ★ ---
/**
 * @swagger
 * /api/profile/complete-regular:
 *   post:
 *     summary: Complete or Update profile after regular signup (with file uploads)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               age: { type: integer }
 *               height: { type: integer }
 *               mbti: { type: string, maxLength: 4 }
 *               gender: { type: string, enum: ['male', 'female'] }
 *               nickname: { type: string }
 *               city: { type: string }
 *               profilePictures: { type: array, items: { type: string, format: binary }, maxItems: 3, description: "(Optional for update) Profile pictures (min 1 on first completion)" }
 *               businessCard: { type: string, format: binary, description: "(Optional for update) Business card image" }
 *     responses:
 *       200: { description: 'Profile completed/updated successfully', content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       400: { description: 'Validation errors or missing required files on first completion' }
 *       401: { description: 'Unauthorized' }
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
        const files = (req as any).files as { 
            profilePictures?: Express.Multer.File[];
            businessCard?: Express.Multer.File[];
        };

        console.log(`[POST /api/profile/complete-regular] Processing request for user ID: ${userId}, Type: ${typeof userId}`);

        if (!userId) {
            console.error('[complete-regular] Error: userId missing after authenticateToken.');
            res.status(401).json({ message: 'Authentication failed: User ID not found.' });
            return;
        }

        try {
            console.log(`[complete-regular] Finding user with ID: ${userId}`);
            const user = await User.findByPk(userId);
            if (!user) {
                console.error(`[complete-regular] Error: User not found for ID: ${userId}`);
                
                // 디버깅: 토큰과 사용자 불일치 원인 파악
                try {
                    const userCount = await User.count();
                    console.log(`[complete-regular] Total users in database: ${userCount}`);
                    
                    if (userCount > 0) {
                        const lastUser = await User.findOne({ order: [['id', 'DESC']] });
                        console.log(`[complete-regular] Last user in database:`, lastUser?.toJSON());
                    }
                } catch (err) {
                    console.error('[complete-regular] Error checking users:', err);
                }
                
                res.status(404).json({ 
                    message: 'User associated with this token not found.',
                    details: `User ID ${userId} from token not found in database. Your account may have been deleted or there might be a database synchronization issue.`
                });
                return;
            }

            const isFirstCompletion = user.status === 'pending_profile';
            console.log(`[complete-regular] Is first completion for user ${userId}? ${isFirstCompletion}`);

            // --- Validation ---
            const errors = validateProfileUpdate(req.body, files, isFirstCompletion);
            
            if (errors.length > 0) {
                 console.warn(`[complete-regular] Validation failed for user ${userId}:`, errors);
                 res.status(400).json({ message: 'Validation failed', errors });
                 return;
            }
            // --- End Validation ---
            
            // ----- File Upload Processing ----- 
            let uploadedProfileUrls = user.profileImageUrls || []; // Keep existing if no new files
            let uploadedBusinessCardUrl = user.businessCardImageUrl || null; // Keep existing

            // Process Profile Images
            if (files?.profilePictures && files.profilePictures.length > 0) {
                uploadedProfileUrls = await processProfileImages(
                    userId,
                    files.profilePictures,
                    user.profileImageUrls,
                    true // Keep existing images
                );
            }

            // Process Business Card
            if (files?.businessCard && files.businessCard.length > 0) {
                uploadedBusinessCardUrl = await processBusinessCard(
                    userId,
                    files.businessCard[0],
                    user.businessCardImageUrl
                );
            }
            // ----- End File Upload Processing -----

            // --- Prepare update data --- 
            const updates = prepareProfileUpdates({
                ...req.body,
                profileImageUrls: files?.profilePictures ? uploadedProfileUrls : undefined,
                businessCardImageUrl: files?.businessCard ? uploadedBusinessCardUrl : undefined
            });
            
            // --- Update user record --- 
            await user.update(updates);
            console.log(`[complete-regular] User ${userId} updated successfully. Status set to pending_approval.`);
            // ---------------------------

            // --- Generate NEW token with pending_approval status --- 
            const token = generateTokenAfterProfileUpdate(user, updates);
            // --------------------------------------------------------------

            // Prepare user response
            const userResponse = prepareUserResponse(user, updates);

            // Send success response
            res.status(200).json({ 
                message: isFirstCompletion ? 'Profile completed successfully. Waiting for approval.' : 'Profile updated successfully. Waiting for approval.',
                token: token,
                user: userResponse
            });

        } catch (error: any) {
            console.error(`[POST /api/profile/complete-regular] Error processing request for user ${userId}:`, error);
            // Don't cleanup files on error here, as Supabase doesn't rollback
            if (error.name === 'SequelizeValidationError') {
                res.status(400).json({ message: 'Database validation failed.', errors: error.errors?.map((e:any) => e.message) });
            } else if (error.name === 'SequelizeDatabaseError') {
                 res.status(500).json({ message: 'Database error during user update.' });
            } else {
                 // Handle specific Supabase upload errors or general errors
                 res.status(500).json({ message: error.message || 'An unexpected error occurred during profile update.' });
            }
        }
    }
);

/**
 * @swagger
 * /api/profile/update:
 *   post:
 *     summary: Update existing user profile with file upload support
 *     tags: [User Profile]
 *     description: Updates user profile information including profile images and business card
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nickname: { type: string, description: "User's nickname" }
 *               gender: { type: string, enum: [male, female], description: "User's gender" }
 *               city: { type: string, enum: [seoul, busan, jeju], description: "User's city" }
 *               age: { type: string, description: "User's age" }
 *               height: { type: string, description: "User's height in cm" }
 *               mbti: { type: string, description: "User's MBTI personality type" }
 *               profilePictures: { type: array, items: { type: string, format: binary }, maxItems: 3, description: "Profile pictures (up to 3)" }
 *               businessCard: { type: string, format: binary, description: "Business card image" }
 *     responses:
 *       200: { description: 'Profile updated successfully', content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       400: { description: 'Validation errors' }
 *       401: { description: 'Unauthorized' }
 *       404: { description: 'User not found' }
 *       500: { description: 'Server error' }
 */
// @ts-ignore // Ignore overload error for this handler
router.post(
    '/update',
    authenticateToken as express.RequestHandler, 
    upload.fields([ // Apply multer AFTER auth
        { name: 'profilePictures', maxCount: 3 },
        { name: 'businessCard', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userId = (req as any).user?.userId;
        const files = (req as any).files as { 
            profilePictures?: Express.Multer.File[];
            businessCard?: Express.Multer.File[];
        };

        console.log(`[POST /api/profile/update] Processing request for user ID: ${userId}`);

        if (!userId) {
            console.error('[update] Error: userId missing after authenticateToken.');
            res.status(401).json({ message: 'Authentication failed: User ID not found.' });
            return;
        }

        try {
            const user = await User.findByPk(userId);
            if (!user) {
                console.error(`[update] Error: User not found for ID: ${userId}`);
                res.status(404).json({ message: 'User associated with this token not found.' });
                return;
            }

            // --- Validation ---
            const errors = validateProfileUpdate(req.body, files, false);
            
            if (errors.length > 0) {
                 console.warn(`[update] Validation failed for user ${userId}:`, errors);
                 res.status(400).json({ message: 'Validation failed', errors });
                 return;
            }
            // --- End Validation ---
            
            // ----- File Upload Processing ----- 
            let uploadedProfileUrls = user.profileImageUrls || []; // 기본값
            let uploadedBusinessCardUrl = user.businessCardImageUrl || null; // 기본값

            // Process Profile Images (모두 교체)
            if (files?.profilePictures && files.profilePictures.length > 0) {
                uploadedProfileUrls = await processProfileImages(
                    userId,
                    files.profilePictures,
                    user.profileImageUrls,
                    false // 기존 이미지 삭제
                );
            }

            // Process Business Card
            if (files?.businessCard && files.businessCard.length > 0) {
                uploadedBusinessCardUrl = await processBusinessCard(
                    userId,
                    files.businessCard[0],
                    user.businessCardImageUrl
                );
            }
            // ----- End File Upload Processing -----

            // --- Prepare update data --- 
            const updates = prepareProfileUpdates({
                ...req.body,
                profileImageUrls: files?.profilePictures ? uploadedProfileUrls : undefined,
                businessCardImageUrl: files?.businessCard ? uploadedBusinessCardUrl : undefined
            });
            
            // --- Update user record --- 
            await user.update(updates);
            console.log(`[update] User ${userId} updated successfully. Status set to pending_approval.`);
            // ---------------------------

            // --- Generate NEW token with pending_approval status --- 
            const token = generateTokenAfterProfileUpdate(user, updates);
            // --------------------------------------------------------------

            // Prepare user response
            const userResponse = prepareUserResponse(user, updates);

            // Send success response
            res.status(200).json({ 
                message: 'Profile updated successfully. Waiting for approval.',
                token: token,
                user: userResponse
            });

        } catch (error: any) {
            console.error(`[POST /api/profile/update] Error processing request for user ${userId}:`, error);
            // Don't cleanup files on error here, as Supabase doesn't rollback
            if (error.name === 'SequelizeValidationError') {
                res.status(400).json({ message: 'Database validation failed.', errors: error.errors?.map((e:any) => e.message) });
            } else if (error.name === 'SequelizeDatabaseError') {
                 res.status(500).json({ message: 'Database error during user update.' });
            } else {
                 // Handle specific Supabase upload errors or general errors
                 res.status(500).json({ message: error.message || 'An unexpected error occurred during profile update.' });
            }
        }
    }
); 

// Credit 구매 API 엔드포인트 추가
router.post('/buy-credit', authenticateToken, (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        
        const amount = req.body.amount || 10; // 기본값 10
        
        // 사용자 찾기
        const user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        
        // 현재 credit 가져오기 (없으면 0으로 초기화)
        const currentCredit = user.credit || 0;
        
        // credit 업데이트
        await user.update({ credit: currentCredit + amount });
        
        // 업데이트된 사용자 정보 응답
        res.status(200).json({ 
            message: `${amount} credits added successfully`,
            credit: currentCredit + amount
        });
    } catch (error) {
        console.error('Error buying credit:', error);
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
 *         age: { type: integer, readOnly: true }
 *         height: { type: integer, nullable: true }
 *         gender: { type: string, nullable: true }
 *         city: { type: string, nullable: true }
 *         mbti: { type: string, nullable: true }
 *         nickname: { type: string, nullable: true }
 *         occupation: { type: string, nullable: true }
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