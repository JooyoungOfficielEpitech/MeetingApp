import express, { Request, Response, NextFunction } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware'; // Import authentication middleware
import { isAdmin } from '../middleware/adminMiddleware'; // Import admin check middleware
import jwt from 'jsonwebtoken';
import fs from 'fs';     // Import fs for file deletion
import path from 'path'; // Import path for file paths
// Import the exported io instance from server.ts
// import { io } from '../server'; // Adjust path as needed -- Incorrect path
import { io } from '../socket'; // Correct: Import from socket module
const db = require('../../models'); // Adjust path if needed
const User = db.User;
const Match = db.Match; // Import Match model
const MatchingWaitList = db.MatchingWaitList; // Make sure this is imported
// Import connectedUsers map from server (adjust path/export method if needed)
// This assumes connectedUsers is exported from server.ts or a shared module
// For simplicity, let's assume it's accessible. In a real app, use dependency injection or a shared service.
// import { connectedUsers } from '../server'; // Placeholder - Adjust import based on actual export -- Incorrect path
import { connectedUsers } from '../socket/state'; // Correct: Import from socket state module
import { JWT_SECRET } from '../config/jwt'; // Import JWT_SECRET from config
const Message = db.Message; // ★ Add Message model ★

const router = express.Router();

// Apply authentication and admin check to all routes in this file
router.use(authenticateToken as express.RequestHandler);
router.use(isAdmin as express.RequestHandler);

/**
 * @swagger
 * /api/admin/stats/dashboard:
 *   get:
 *     summary: Get dashboard statistics (admin only)
 *     tags: [Admin, Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers: 
 *                   type: integer
 *                   description: Total number of registered users (excluding deleted)
 *                 newSignupsToday: 
 *                   type: integer
 *                   description: Number of users who signed up today
 *                 pendingApprovalCount:
 *                   type: integer
 *                   description: Number of users pending administrator approval
 *       401:
 *         description: Authentication token required
 *       403:
 *         description: Forbidden (not an admin or invalid token)
 *       500:
 *         description: Server error
 */
router.get('/stats/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[GET /api/admin/stats/dashboard] Request received.');
    try {
        // 1. Get total number of users (excluding soft-deleted)
        const totalUsers = await User.count({
             where: { deletedAt: null } // Exclude soft-deleted users if paranoid is true
         });
        console.log(`[Admin Stats] Total users: ${totalUsers}`);

        // 2. Get number of new signups today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // Set to beginning of today

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999); // Set to end of today

        // Ensure correct timezone handling if necessary, consider UTC
        // Example using Sequelize literal for date comparison (adjust based on DB dialect)
        const newSignupsToday = await User.count({
            where: {
                createdAt: {
                    [Op.gte]: todayStart,
                    [Op.lte]: todayEnd
                },
                deletedAt: null // Also exclude soft-deleted users here
            }
        });
        console.log(`[Admin Stats] New signups today: ${newSignupsToday}`);

        // 3. Get number of users pending approval
        const pendingApprovalCount = await User.count({
            where: {
                status: 'pending_approval',
                deletedAt: null
            }
        });
        console.log(`[Admin Stats] Pending approval count: ${pendingApprovalCount}`);

        res.status(200).json({
            totalUsers,       // Renamed from activeUsers for clarity, as it's total for now
            newSignupsToday,
            pendingApprovalCount
        });

    } catch (error) {
        console.error('[GET /api/admin/stats/dashboard] Error fetching dashboard stats:', error);
        next(error); // Pass error to the global error handler
    }
});

/**
 * @swagger
 * /api/admin/matches/recent:
 *   get:
 *     summary: Get recent match records (admin only)
 *     tags: [Admin, Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of recent matches to retrieve
 *     responses:
 *       200:
 *         description: Recent matches retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   matchId:
 *                     type: string 
 *                   user1:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       # Add tier later if needed
 *                   user2:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       # Add tier later if needed
 *                   status: { type: string, enum: ['active', 'inactive', 'pending', 'completed', 'cancelled'] } # Example statuses
 *                   createdAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication token required
 *       403:
 *         description: Forbidden (not an admin or invalid token)
 *       500:
 *         description: Server error
 */
router.get('/matches/recent', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[GET /api/admin/matches/recent] Request received.');
    const limit = parseInt(req.query.limit as string || '5', 10);

    try {
        const recentMatches = await Match.findAll({
            limit: limit,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'User1',
                    attributes: ['id', 'name', 'gender']
                },
                {
                    model: User,
                    as: 'User2',
                    attributes: ['id', 'name', 'gender']
                }
            ],
            attributes: ['matchId', 'status', 'createdAt']
        });

        console.log(`[Admin Matches] Found ${recentMatches.length} recent matches.`);

        const formattedMatches = recentMatches.map((match: any) => ({
            matchId: match.matchId,
            user1: match.User1 ? { id: match.User1.id, name: match.User1.name, gender: match.User1.gender } : null,
            user2: match.User2 ? { id: match.User2.id, name: match.User2.name, gender: match.User2.gender } : null,
            status: match.status,
            createdAt: match.createdAt
        }));

        res.status(200).json(formattedMatches);

    } catch (error) {
        console.error('[GET /api/admin/matches/recent] Error fetching recent matches:', error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get list of users (admin only)
 *     tags: [Admin, Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Optional search term for user name or email
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, pending_approval, rejected] }
 *         description: Optional filter by user status
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items: {$ref: '#/components/schemas/User'} # Assuming you have a User schema defined
 *                 totalPages: { type: integer }
 *                 currentPage: { type: integer }
 *                 totalCount: { type: integer }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin)' }
 *       500: { description: 'Server error' }
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[GET /api/admin/users] Request received.');
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search as string || '';
    const statusFilter = req.query.status as string; // e.g., 'pending_approval', 'active'

    const whereClause: any = {
        deletedAt: null // Always exclude soft-deleted users
    };

    // Apply status filter if provided
    if (statusFilter && ['active', 'pending_approval', 'rejected'].includes(statusFilter)) {
        whereClause.status = statusFilter;
        console.log(`[Admin Users] Filtering by status: ${statusFilter}`);
    } else {
        // Default: Fetch users who are NOT rejected
        whereClause.status = { [Op.notIn]: ['rejected'] };
        console.log(`[Admin Users] Fetching non-rejected users.`);
    }

    // Apply search term if provided
    if (searchTerm) {
        whereClause[Op.or] = [
            { name: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } }
        ];
        console.log(`[Admin Users] Searching for: ${searchTerm}`);
    }

    try {
        const { count, rows } = await User.findAndCountAll({
            where: whereClause,
            limit: limit,
            offset: offset,
            order: [['createdAt', 'DESC']], // Show newest users first by default
            attributes: { exclude: ['passwordHash'] } // Exclude sensitive info
        });

        const totalPages = Math.ceil(count / limit);
        console.log(`[Admin Users] Found ${count} users matching criteria. Page ${page}/${totalPages}.`);

        res.status(200).json({
            users: rows,
            totalPages,
            currentPage: page,
            totalCount: count
        });

    } catch (error) {
        console.error('[GET /api/admin/users] Error fetching users:', error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/users/{userId}/approve:
 *   patch:
 *     summary: Approve a user (admin only)
 *     tags: [Admin, Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The ID of the user to approve
 *     responses:
 *       200: { description: 'User approved successfully' }
 *       400: { description: 'Invalid user ID or user already active' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin)' }
 *       404: { description: 'User not found' }
 *       500: { description: 'Server error' }
 */
router.patch('/users/:userId/approve', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.userId;
    const ioInstance = io; // Use the imported io instance

    console.log(`[PATCH /api/admin/users/${userId}/approve] Request received.`);

    if (isNaN(parseInt(userId))) {
        res.status(400).json({ message: 'Invalid user ID format.' });
        return;
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (user.status === 'active') {
             res.status(400).json({ message: 'User is already active.' });
             return;
        }

        // Update status to active
        user.status = 'active';
        user.occupation = false; // Ensure occupation is false upon approval
        user.rejectionReason = null; // ★ Clear any previous rejection reason
        await user.save();
        console.log(`[Admin Approve] User ${userId} status updated to 'active'.`);

        // --- Add male user to waitlist UPON APPROVAL --- 
        if (user.gender === 'male') {
            try {
                // Use findOrCreate to prevent duplicates if approval is somehow triggered multiple times
                const [waitlistEntry, created] = await MatchingWaitList.findOrCreate({
                    where: { userId: user.id },
                    defaults: { userId: user.id }
                });
                if (created) {
                    console.log(`[Admin Approve] Male user ${userId} added to MatchingWaitList.`);
                } else {
                    console.log(`[Admin Approve] Male user ${userId} was already in MatchingWaitList.`);
                }
            } catch (waitlistError: any) {
                console.error(`[Admin Approve] Error adding user ${userId} to MatchingWaitList:`, waitlistError);
                // Decide if the approval should fail if waitlist add fails
                // For now, log and continue
            }
        }
        // -------------------------------------------

        // --- Generate NEW JWT with ACTIVE status --- 
        const newPayload = {
            userId: user.id,
            email: user.email,
            status: user.status, // Now 'active'
            gender: user.gender
        };
        // Use the imported JWT_SECRET
        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });
        // -------------------------------------------

        // --- Emit WebSocket event with the NEW token --- 
        let userSocketId: string | null = null;
        if (connectedUsers && connectedUsers instanceof Map) {
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                 if (connectedUser.userId === parseInt(userId, 10)) {
                    userSocketId = socketId;
                    break;
                }
            }
        } else {
             console.warn('[Admin Approve] connectedUsers map is not available or not a Map.');
        }

        if (userSocketId && ioInstance) {
            console.log(`[Admin Approve] Emitting 'userApproved' event with new token to socket ${userSocketId} for user ${userId}`);
            ioInstance.to(userSocketId).emit('userApproved', {
                message: '계정이 승인되었습니다! 메인 페이지로 이동합니다.',
                token: newToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    status: user.status
                }
            });
        } else {
            if (!userSocketId) console.log(`[Admin Approve] Socket not found for approved user ${userId}. Cannot send real-time update.`);
            if (!ioInstance) console.log(`[Admin Approve] Socket.IO instance unavailable. Cannot send real-time update.`);
        }
        // ---------------------------------------------------

        res.status(200).json({ message: 'User approved successfully' });

    } catch (error) {
        console.error(`[PATCH /api/admin/users/${userId}/approve] Error approving user:`, error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/users/{userId}/reject:
 *   patch:
 *     summary: Reject a pending user (admin only)
 *     tags: [Admin, Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: ID of the user to reject
 *     responses:
 *       200: { description: 'User rejected successfully.' }
 *       400: { description: 'User is not pending approval' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin or user not found)' }
 *       500: { description: 'Server error' }
 */
router.patch('/users/:userId/reject', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = parseInt(req.params.userId, 10);
    const { reason } = req.body; // Get reason from request body
    const ioInstance = io; // Use imported io instance

    console.log(`[PATCH /api/admin/users/${userId}/reject] Request received. Reason: ${reason}`);

     if (isNaN(userId)) {
        res.status(400).json({ message: 'Invalid user ID' });
        return; 
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) { // Validate reason
         res.status(400).json({ message: 'Rejection reason is required.' });
         return;
    }

    try {
        // Find user who is specifically 'pending_approval'
        const user = await User.findOne({
            where: {
                id: userId,
                status: 'pending_approval', // Only allow rejecting pending users
                deletedAt: null
            }
        });

        if (!user) {
             console.warn(`[Admin Reject] User ${userId} not found or not in pending_approval status.`);
             res.status(404).json({ message: 'User not found or cannot be rejected.' });
             return; 
        }

        // --- Update status to rejected and record reason --- 
        await user.update({ 
            status: 'rejected', // ★ Change status to rejected ★
            rejectionReason: reason.trim() 
        });
        console.log(`[Admin Reject] User ${userId} status updated to 'rejected'. Reason: ${reason.trim()}`);
        // ------------------------------------------------------

        // --- Emit WebSocket event to the rejected user --- 
        // Still useful to notify the user their profile was reviewed and rejected
        if (ioInstance && connectedUsers) {
            let userSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === userId) {
                    userSocketId = socketId;
                    break;
                }
            }

            if (userSocketId) {
                console.log(`[Admin Reject] Emitting 'profileRejected' event to socket ${userSocketId} for user ${userId}`);
                // Emit 'profileRejected' with the reason 
                ioInstance.to(userSocketId).emit('profileRejected', {
                    reason: reason.trim(),
                    message: 'Your profile submission was rejected. Please review the reason and update your profile.'
                });
            } else {
                console.log(`[Admin Reject] Socket not found for user ${userId}. Cannot send real-time update.`);
            }
        } else {
             console.warn('[Admin Reject] Socket.IO instance or connectedUsers map not available. Cannot send real-time update.');
        }
        // ---------------------------------------------------

        // Respond with success, indicating user was rejected
        res.status(200).json({ message: 'User rejected successfully.' }); // ★ Updated response message ★

    } catch (error) {
        console.error(`[PATCH /api/admin/users/${userId}/reject] Error processing rejection:`, error);
        next(error); 
    }
});

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Get details of a specific user (admin only)
 *     tags: [Admin, Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The ID of the user to retrieve
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema: {$ref: '#/components/schemas/UserProfile'} # Reference detailed user profile schema
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin)' }
 *       404: { description: 'User not found' }
 *       500: { description: 'Server error' }
 */
router.get('/users/:userId', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.userId;
    console.log(`[GET /api/admin/users/${userId}] Request received.`);

    // Validate userId is a number
    if (isNaN(parseInt(userId))) {
        res.status(400).json({ message: 'Invalid user ID format.' });
        return; // Add explicit return
    }

    try {
        // Find user by primary key, exclude password hash
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['passwordHash'] }
        });

        if (!user) {
            console.warn(`[Admin User Detail] User not found with ID: ${userId}`);
            res.status(404).json({ message: 'User not found' });
            return; // Add explicit return
        }

        console.log(`[Admin User Detail] Found user ${userId}:`, user.toJSON());
        res.status(200).json(user); // Return the full user object (excluding passwordHash)
        // No return needed here as it's the end of the try block

    } catch (error) {
        console.error(`[GET /api/admin/users/${userId}] Error fetching user details:`, error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Permanently delete a user and their files (admin only)
 *     tags: [Admin, Users]
 *     description: This action permanently deletes the user record and associated files (profile pics, business card).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: The ID of the user to delete permanently
 *     responses:
 *       200: { description: 'User and files deleted successfully' }
 *       400: { description: 'Invalid user ID' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin)' }
 *       404: { description: 'User not found' }
 *       500: { description: 'Server error during deletion' }
 */
router.delete('/users/:userId', async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.userId;
    console.log(`[DELETE /api/admin/users/${userId}] Request received for permanent deletion.`);
    const uploadsBaseDir = path.join(__dirname, '..', '..', 'uploads'); // Re-define or import base path

    if (isNaN(parseInt(userId))) {
        res.status(400).json({ message: 'Invalid user ID format.' });
        return;
    }

    try {
        // Find the user INCLUDING potential file URLs
        const user = await User.findByPk(userId);

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        console.log(`[Admin Delete] Found user ${userId}. Proceeding with file and DB deletion.`);

        // --- Delete Associated Files --- 
        const filesToDelete: string[] = [];
        if (user.profileImageUrls && Array.isArray(user.profileImageUrls)) {
            user.profileImageUrls.forEach((relativeUrl: string) => {
                // Construct absolute path relative to project root (assuming uploadsBaseDir is correct)
                if (relativeUrl && typeof relativeUrl === 'string') { // Added type check
                     // Extract the path part after /uploads/
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


        console.log(`[Admin Delete] Attempting to delete files:`, filesToDelete);
        filesToDelete.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[Admin Delete] Successfully deleted file: ${filePath}`);
                } catch (unlinkError) {
                    console.error(`[Admin Delete] Error deleting file ${filePath}:`, unlinkError);
                }
            } else {
                 console.warn(`[Admin Delete] File not found, skipping deletion: ${filePath}`);
            }
        });
        // --- End File Deletion ---

        // --- Delete Associated Matches ---
        console.log(`[Admin Delete] Deleting matches associated with user ${userId}.`);
        try {
            const deletedMatchesCount = await Match.destroy({
                where: {
                    [Op.or]: [
                        { user1Id: userId },
                        { user2Id: userId }
                    ]
                }
            });
            console.log(`[Admin Delete] Deleted ${deletedMatchesCount} matches associated with user ${userId}.`);
        } catch (matchError) {
            console.error(`[Admin Delete] Error deleting matches for user ${userId}:`, matchError);
            // Decide if you want to stop the user deletion process if match deletion fails
            // For now, we'll log the error and continue, but you might want to throw or return
            // throw new Error('Failed to delete associated matches'); // Example: Stop deletion
        }
        // --- End Match Deletion ---

        // --- Delete User Record Permanently --- 
        await user.destroy({ force: true }); // Use force: true to bypass paranoid mode
        console.log(`[Admin Delete] User ${userId} permanently deleted from database.`);
        // ---------------------------------------

        // --- Remove from MatchingWaitList if present --- 
         try {
             await MatchingWaitList.destroy({ where: { userId: userId } });
             console.log(`[Admin Delete] Removed user ${userId} from MatchingWaitList (if existed).`);
         } catch (waitlistError) {
             console.error(`[Admin Delete] Error removing user ${userId} from MatchingWaitList:`, waitlistError);
         }
         // -------------------------------------------

        res.status(200).json({ message: 'User and associated files deleted successfully' });

    } catch (error) {
        console.error(`[DELETE /api/admin/users/${userId}] Error deleting user:`, error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/chats/{matchId}/messages:
 *   get:
 *     summary: Get all messages for a specific match (admin only)
 *     tags: [Admin, Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *         description: The ID of the match (e.g., match-1-2-123456789)
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatMessage' # Assuming a ChatMessage schema exists
 *       400: { description: 'Invalid match ID format' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin)' }
 *       404: { description: 'Match not found or no messages found' }
 *       500: { description: 'Server error' }
 */
router.get('/chats/:matchId/messages', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
    const matchId = req.params.matchId;
    console.log(`[GET /api/admin/chats/${matchId}/messages] Request received.`);

    if (!matchId || !matchId.startsWith('match-')) {
        res.status(400).json({ message: 'Invalid match ID format.' });
        return; // ★ Add return to fix lint error ★
    }

    try {
        const messages = await Message.findAll({
            where: { matchId: matchId },
            order: [['createdAt', 'ASC']],
            include: [
                {
                    model: User,
                    as: 'Sender',
                    attributes: ['id', 'name', 'gender']
                }
            ],
        });

        if (!messages || messages.length === 0) {
            const matchExists = await Match.findOne({ where: { matchId: matchId }});
            if (!matchExists) {
                console.log(`[Admin Chat] Match not found: ${matchId}`);
                 res.status(404).json({ message: 'Match not found.' });
                 return; // ★ Add return ★
            }
            console.log(`[Admin Chat] No messages found for match: ${matchId}`);
            res.status(200).json([]); 
            return; // ★ Add return ★
        }

        console.log(`[Admin Chat] Retrieved ${messages.length} messages for match: ${matchId}`);
        res.status(200).json(messages);
        return; // ★ Add return ★

    } catch (error) {
        console.error(`[GET /api/admin/chats/${matchId}/messages] Error fetching messages:`, error);
        next(error);
    }
});

// --- Placeholder for other admin routes ---
// Example: GET /api/admin/users
// router.get('/users', async (req, res, next) => { ... });
// -----------------------------------------

export default router; 