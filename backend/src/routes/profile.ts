import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt';
import { v4 as uuidv4 } from 'uuid';
import supabaseAdmin from '../utils/supabaseClient';
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
                'nickname',
                'gender',
                'dob',
                'age',
                'height',
                'mbti',
                'occupation',
                'profileImageUrls',
                'businessCardImageUrl',
                'status',
                'rejectionReason',
                'city'
                // Exclude passwordHash, googleId, etc.
            ]
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
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

        console.log(`[POST /api/profile/complete-regular] Processing request for user ID: ${userId}`);

        if (!userId) {
            console.error('[complete-regular] Error: userId missing after authenticateToken.');
            res.status(401).json({ message: 'Authentication failed: User ID not found.' });
            return;
        }

        try {
            const user = await User.findByPk(userId);
            if (!user) {
                console.error(`[complete-regular] Error: User not found for ID: ${userId}`);
                res.status(404).json({ message: 'User associated with this token not found.' });
                return;
            }

            const isFirstCompletion = user.status === 'pending_profile';
            console.log(`[complete-regular] Is first completion for user ${userId}? ${isFirstCompletion}`);

            // --- Validation ---
            const { age, height, mbti, gender, city, nickname } = req.body;
            const errors: string[] = [];
            
            // Validate required fields based on whether it's the first completion or an update
            if (isFirstCompletion) {
                if (!nickname || nickname.trim() === '') errors.push('Nickname is required.');
                if (!age || isNaN(parseInt(age)) || parseInt(age) < 19) errors.push('Valid age (19+) is required.');
                if (!height || isNaN(parseInt(height)) || parseInt(height) < 100) errors.push('Valid height (>= 100cm) is required.');
                if (!mbti || !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('Valid MBTI (4 letters) is required.');
                if (!gender || !['male', 'female'].includes(gender.toLowerCase())) errors.push('Valid gender (male/female) is required.');
                if (!city || !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('Valid city (seoul/busan/jeju) is required.');
                if (!files?.profilePictures || files.profilePictures.length === 0) errors.push('At least one profile picture required.');
                if (!files?.businessCard || files.businessCard.length === 0) errors.push('Business card image required.');
            } else {
                // For updates, validate only fields that are present in the request
                if (nickname !== undefined && nickname.trim() === '') errors.push('Nickname cannot be empty if provided.');
                if (age !== undefined && (isNaN(parseInt(age)) || parseInt(age) < 19)) errors.push('Age must be a valid number (19+) if provided.');
                if (height !== undefined && (isNaN(parseInt(height)) || parseInt(height) < 100)) errors.push('Height must be a valid number (>= 100cm) if provided.');
                if (mbti !== undefined && !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('MBTI must be 4 valid letters if provided.');
                if (gender !== undefined && !['male', 'female'].includes(gender.toLowerCase())) errors.push('Gender must be male or female if provided.');
                if (city !== undefined && !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('City must be seoul, busan, or jeju if provided.');
                // No validation for files on update, they are optional
            }
            
            // Common file validation (max count)
            if (files?.profilePictures && files.profilePictures.length > 3) {
                 errors.push('Maximum 3 profile pictures allowed.');
            }
            if (files?.businessCard && files.businessCard.length > 1) {
                 errors.push('Only one business card image allowed.');
            }

            if (errors.length > 0) {
                 console.warn(`[complete-regular] Validation failed for user ${userId}:`, errors);
                 res.status(400).json({ message: 'Validation failed', errors });
                 return;
            }
            // --- End Validation ---
            
            // ----- Supabase Upload and Deletion Logic ----- 
            let uploadedProfileUrls: string[] = user.profileImageUrls || []; // Keep existing if no new files
            let uploadedBusinessCardUrl: string | null = user.businessCardImageUrl || null; // Keep existing
            const profileImageFolder = `profiles/${userId}`;
            const businessCardFolder = `business_cards/${userId}`;
            
            // -- Function to delete old files from Supabase --
            const deleteSupabaseFile = async (filePath: string) => {
                 if (!filePath) return;
                 // Extract the path after the bucket name from the public URL
                 const urlParts = filePath.split('/profile-images/');
                 if (urlParts.length < 2) {
                     console.warn(`[Supabase Delete] Could not parse file path from URL: ${filePath}`);
                     return;
                 }
                 const supabasePath = urlParts[1];
                 console.log(`[Supabase Delete] Deleting old file: ${supabasePath}`);
                 try {
                     const { error: deleteError } = await supabaseAdmin.storage
                         .from('profile-images')
                         .remove([supabasePath]);
                     if (deleteError) {
                         console.error(`[Supabase Delete] Error deleting file ${supabasePath}:`, deleteError);
                         // Log error but continue, don't block the update
                     }
                 } catch (e) {
                      console.error(`[Supabase Delete] Exception deleting file ${supabasePath}:`, e);
                 }
            };
            // ----------------------------------------------

            // Upload NEW Profile Pictures (if provided)
            if (files?.profilePictures && files.profilePictures.length > 0) {
                 console.log(`[Supabase Upload] Processing profile pictures for user ${userId}...`);
                 // 기존 이미지 유지
                 if (!user.profileImageUrls || !Array.isArray(user.profileImageUrls)) {
                     uploadedProfileUrls = [];  // 기존 이미지가 없으면 빈 배열에서 시작
                 }
                 
                 for (const file of files.profilePictures) {
                     const fileName = `${uuidv4()}-${file.originalname}`;
                     const filePath = `${profileImageFolder}/${fileName}`;
                     console.log(`[Supabase Upload] Uploading new profile picture: ${filePath}`);
                     try {
                         console.log(`[Supabase Upload Debug] 업로드 시작 - 버퍼 크기: ${file.buffer.length} 바이트, MIME 타입: ${file.mimetype}`);
                         
                         const { data: uploadResult, error: uploadError } = await supabaseAdmin.storage
                             .from('profile-images')
                             .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
                         
                         console.log(`[Supabase Upload Debug] 업로드 응답 - 성공: ${!uploadError}, 데이터: ${JSON.stringify(uploadResult || {})}`);
                         
                         if (uploadError) {
                             console.error(`[Supabase Upload Error] 세부정보:`, { 
                                 message: uploadError.message,
                                 statusCode: uploadError.statusCode, 
                                 details: uploadError.details,
                                 name: uploadError.name,
                                 status: uploadError.status
                             });
                             throw new Error(`Failed to upload profile picture: ${uploadError.message}`);
                         }
                         
                         console.log(`[Supabase URL] Public URL 요청 시작 - 경로: ${filePath}`);
                         const { data: urlData, error: urlError } = supabaseAdmin.storage.from('profile-images').getPublicUrl(filePath);
                         console.log(`[Supabase URL] Public URL 응답 - 성공: ${!urlError}, URL: ${urlData?.publicUrl || '없음'}`);
                         
                         if (!urlData || !urlData.publicUrl) {
                             console.error(`[Supabase URL Error] Public URL을 가져올 수 없음:`, urlError || '알 수 없는 오류');
                             throw new Error(`Failed to get public URL for profile picture.`);
                         }
                         uploadedProfileUrls.push(urlData.publicUrl);
                         console.log(`[Supabase Upload] New profile picture uploaded: ${urlData.publicUrl}`);
                     } catch (e: any) {
                         console.error(`[Supabase Exception] 업로드 중 예외 발생:`, e.message, e.stack);
                         throw e;
                     }
                 }
            }

            // Upload NEW Business Card (if provided)
            if (files?.businessCard && files.businessCard.length > 0) {
                 console.log(`[Supabase Upload] Deleting old business card for user ${userId}...`);
                 // Delete old business card before uploading new one
                 await deleteSupabaseFile(user.businessCardImageUrl);

                 const businessCardFile = files.businessCard[0];
                 const businessCardFileName = `${uuidv4()}-${businessCardFile.originalname}`;
                 const businessCardFilePath = `${businessCardFolder}/${businessCardFileName}`;
                 console.log(`[Supabase Upload] Uploading new business card: ${businessCardFilePath}`);
                 const { error: cardUploadError } = await supabaseAdmin.storage
                     .from('profile-images')
                     .upload(businessCardFilePath, businessCardFile.buffer, { contentType: businessCardFile.mimetype, upsert: false });

                 if (cardUploadError) throw new Error(`Failed to upload business card: ${cardUploadError.message}`);

                 const { data: cardUrlData } = supabaseAdmin.storage.from('profile-images').getPublicUrl(businessCardFilePath);
                 if (!cardUrlData || !cardUrlData.publicUrl) throw new Error(`Failed to get public URL for business card.`);
                 uploadedBusinessCardUrl = cardUrlData.publicUrl;
                 console.log(`[Supabase Upload] New business card uploaded: ${uploadedBusinessCardUrl}`);
            }
            // ----- End Supabase Upload Logic -----

            // --- Prepare update data --- 
            const updates: any = {};
            if (nickname !== undefined) updates.nickname = nickname;
            if (age !== undefined) updates.age = parseInt(age);
            if (height !== undefined) updates.height = parseInt(height);
            if (mbti !== undefined) updates.mbti = mbti.toUpperCase();
            if (gender !== undefined) updates.gender = gender.toLowerCase();
            if (city !== undefined) updates.city = city.toLowerCase();
            // Only update URLs if new ones were uploaded
            if (files?.profilePictures && files.profilePictures.length > 0) updates.profileImageUrls = uploadedProfileUrls;
            if (files?.businessCard && files.businessCard.length > 0) updates.businessCardImageUrl = uploadedBusinessCardUrl;
            
            // Always set status to pending_approval on completion/update
            updates.status = 'pending_approval';
            updates.rejectionReason = null; // Clear rejection reason on update

            // --- Update user record --- 
            await user.update(updates);
            console.log(`[complete-regular] User ${userId} updated successfully. Status set to pending_approval.`);
            // ---------------------------

            // --- Generate NEW token with pending_approval status --- 
            const payload = {
                userId: user.id, 
                email: user.email,
                status: 'pending_approval', 
                gender: updates.gender || user.gender // Use updated or existing gender
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            // --------------------------------------------------------------

            // Prepare user response (refetch might be better but use updated data for now)
            const updatedUserData = { ...user.toJSON(), ...updates };
            const userResponse = {
                 id: updatedUserData.id, email: updatedUserData.email, name: updatedUserData.name, 
                 nickname: updatedUserData.nickname, gender: updatedUserData.gender, 
                 age: updatedUserData.age, height: updatedUserData.height, mbti: updatedUserData.mbti,
                 profileImageUrls: updatedUserData.profileImageUrls,
                 businessCardImageUrl: updatedUserData.businessCardImageUrl, 
                 status: updatedUserData.status, city: updatedUserData.city
            };

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
            const { age, height, mbti, gender, city, nickname } = req.body;
            const errors: string[] = [];
            
            // For updates, validate only fields that are present in the request
            if (nickname !== undefined && nickname.trim() === '') errors.push('Nickname cannot be empty if provided.');
            if (age !== undefined && (isNaN(parseInt(age)) || parseInt(age) < 19)) errors.push('Age must be a valid number (19+) if provided.');
            if (height !== undefined && (isNaN(parseInt(height)) || parseInt(height) < 100)) errors.push('Height must be a valid number (>= 100cm) if provided.');
            if (mbti !== undefined && !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('MBTI must be 4 valid letters if provided.');
            if (gender !== undefined && !['male', 'female'].includes(gender.toLowerCase())) errors.push('Gender must be male or female if provided.');
            if (city !== undefined && !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('City must be seoul, busan, or jeju if provided.');
            
            // Common file validation (max count)
            if (files?.profilePictures && files.profilePictures.length > 3) {
                 errors.push('Maximum 3 profile pictures allowed.');
            }
            if (files?.businessCard && files.businessCard.length > 1) {
                 errors.push('Only one business card image allowed.');
            }

            if (errors.length > 0) {
                 console.warn(`[update] Validation failed for user ${userId}:`, errors);
                 res.status(400).json({ message: 'Validation failed', errors });
                 return;
            }
            // --- End Validation ---
            
            // ----- Supabase Upload and Deletion Logic ----- 
            let uploadedProfileUrls: string[] = user.profileImageUrls || []; // Keep existing if no new files
            let uploadedBusinessCardUrl: string | null = user.businessCardImageUrl || null; // Keep existing
            const profileImageFolder = `profiles/${userId}`;
            const businessCardFolder = `business_cards/${userId}`;
            
            // -- Function to delete old files from Supabase --
            const deleteSupabaseFile = async (filePath: string) => {
                 if (!filePath) return;
                 // Extract the path after the bucket name from the public URL
                 const urlParts = filePath.split('/profile-images/');
                 if (urlParts.length < 2) {
                     console.warn(`[Supabase Delete] Could not parse file path from URL: ${filePath}`);
                     return;
                 }
                 const supabasePath = urlParts[1];
                 console.log(`[Supabase Delete] Deleting old file: ${supabasePath}`);
                 try {
                     const { error: deleteError } = await supabaseAdmin.storage
                         .from('profile-images')
                         .remove([supabasePath]);
                     if (deleteError) {
                         console.error(`[Supabase Delete] Error deleting file ${supabasePath}:`, deleteError);
                         // Log error but continue, don't block the update
                     }
                 } catch (e) {
                      console.error(`[Supabase Delete] Exception deleting file ${supabasePath}:`, e);
                 }
            };
            // ----------------------------------------------

            // Upload NEW Profile Pictures (if provided)
            if (files?.profilePictures && files.profilePictures.length > 0) {
                 console.log(`[Supabase Upload] Processing profile pictures for user ${userId}...`);
                 // 기존 이미지 삭제
                 if (user.profileImageUrls && Array.isArray(user.profileImageUrls)) {
                     for (const url of user.profileImageUrls) {
                         await deleteSupabaseFile(url);
                     }
                 }
                 
                 // 새 이미지 업로드
                 uploadedProfileUrls = [];  // 기존 이미지 전부 교체
                 
                 for (const file of files.profilePictures) {
                     const fileName = `${uuidv4()}-${file.originalname}`;
                     const filePath = `${profileImageFolder}/${fileName}`;
                     console.log(`[Supabase Upload] Uploading new profile picture: ${filePath}`);
                     try {
                         console.log(`[Supabase Upload Debug] 업로드 시작 - 버퍼 크기: ${file.buffer.length} 바이트, MIME 타입: ${file.mimetype}`);
                         
                         const { data: uploadResult, error: uploadError } = await supabaseAdmin.storage
                             .from('profile-images')
                             .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
                         
                         console.log(`[Supabase Upload Debug] 업로드 응답 - 성공: ${!uploadError}, 데이터: ${JSON.stringify(uploadResult || {})}`);
                         
                         if (uploadError) {
                             console.error(`[Supabase Upload Error] 세부정보:`, { 
                                 message: uploadError.message,
                                 statusCode: uploadError.statusCode, 
                                 details: uploadError.details,
                                 name: uploadError.name,
                                 status: uploadError.status
                             });
                             throw new Error(`Failed to upload profile picture: ${uploadError.message}`);
                         }
                         
                         console.log(`[Supabase URL] Public URL 요청 시작 - 경로: ${filePath}`);
                         const { data: urlData, error: urlError } = supabaseAdmin.storage.from('profile-images').getPublicUrl(filePath);
                         console.log(`[Supabase URL] Public URL 응답 - 성공: ${!urlError}, URL: ${urlData?.publicUrl || '없음'}`);
                         
                         if (!urlData || !urlData.publicUrl) {
                             console.error(`[Supabase URL Error] Public URL을 가져올 수 없음:`, urlError || '알 수 없는 오류');
                             throw new Error(`Failed to get public URL for profile picture.`);
                         }
                         uploadedProfileUrls.push(urlData.publicUrl);
                         console.log(`[Supabase Upload] New profile picture uploaded: ${urlData.publicUrl}`);
                     } catch (e: any) {
                         console.error(`[Supabase Exception] 업로드 중 예외 발생:`, e.message, e.stack);
                         throw e;
                     }
                 }
            }

            // Upload NEW Business Card (if provided)
            if (files?.businessCard && files.businessCard.length > 0) {
                 console.log(`[Supabase Upload] Deleting old business card for user ${userId}...`);
                 // Delete old business card before uploading new one
                 await deleteSupabaseFile(user.businessCardImageUrl);

                 const businessCardFile = files.businessCard[0];
                 const businessCardFileName = `${uuidv4()}-${businessCardFile.originalname}`;
                 const businessCardFilePath = `${businessCardFolder}/${businessCardFileName}`;
                 console.log(`[Supabase Upload] Uploading new business card: ${businessCardFilePath}`);
                 const { error: cardUploadError } = await supabaseAdmin.storage
                     .from('profile-images')
                     .upload(businessCardFilePath, businessCardFile.buffer, { contentType: businessCardFile.mimetype, upsert: false });

                 if (cardUploadError) throw new Error(`Failed to upload business card: ${cardUploadError.message}`);

                 const { data: cardUrlData } = supabaseAdmin.storage.from('profile-images').getPublicUrl(businessCardFilePath);
                 if (!cardUrlData || !cardUrlData.publicUrl) throw new Error(`Failed to get public URL for business card.`);
                 uploadedBusinessCardUrl = cardUrlData.publicUrl;
                 console.log(`[Supabase Upload] New business card uploaded: ${uploadedBusinessCardUrl}`);
            }
            // ----- End Supabase Upload Logic -----

            // --- Prepare update data --- 
            const updates: any = {};
            if (nickname !== undefined) updates.nickname = nickname;
            if (age !== undefined) updates.age = parseInt(age);
            if (height !== undefined) updates.height = parseInt(height);
            if (mbti !== undefined) updates.mbti = mbti.toUpperCase();
            if (gender !== undefined) updates.gender = gender.toLowerCase();
            if (city !== undefined) updates.city = city.toLowerCase();
            // Only update URLs if new ones were uploaded
            if (files?.profilePictures && files.profilePictures.length > 0) updates.profileImageUrls = uploadedProfileUrls;
            if (files?.businessCard && files.businessCard.length > 0) updates.businessCardImageUrl = uploadedBusinessCardUrl;
            
            // Always set status to pending_approval on update
            updates.status = 'pending_approval';
            updates.rejectionReason = null; // Clear rejection reason on update

            // --- Update user record --- 
            await user.update(updates);
            console.log(`[update] User ${userId} updated successfully. Status set to pending_approval.`);
            // ---------------------------

            // --- Generate NEW token with pending_approval status --- 
            const payload = {
                userId: user.id, 
                email: user.email,
                status: 'pending_approval', 
                gender: updates.gender || user.gender // Use updated or existing gender
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            // --------------------------------------------------------------

            // Prepare user response (refetch might be better but use updated data for now)
            const updatedUserData = { ...user.toJSON(), ...updates };
            const userResponse = {
                 id: updatedUserData.id, email: updatedUserData.email, name: updatedUserData.name, 
                 nickname: updatedUserData.nickname, gender: updatedUserData.gender, 
                 age: updatedUserData.age, height: updatedUserData.height, mbti: updatedUserData.mbti,
                 profileImageUrls: updatedUserData.profileImageUrls,
                 businessCardImageUrl: updatedUserData.businessCardImageUrl, 
                 status: updatedUserData.status, city: updatedUserData.city
            };

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