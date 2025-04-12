import express, { Request, Response, NextFunction } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware'; // Import authentication middleware
import { isAdmin } from '../middleware/adminMiddleware'; // Import admin check middleware
import jwt from 'jsonwebtoken';
const db = require('../../models'); // Adjust path if needed
const User = db.User;
const Match = db.Match; // Import Match model
const MatchingWaitList = db.MatchingWaitList; // Make sure this is imported
// Import connectedUsers map from server (adjust path/export method if needed)
// This assumes connectedUsers is exported from server.ts or a shared module
// For simplicity, let's assume it's accessible. In a real app, use dependency injection or a shared service.
import { connectedUsers } from '../server'; // Placeholder - Adjust import based on actual export

// Import JWT_SECRET (assuming it's defined similarly to auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME';

const router = express.Router();

// Apply authentication and admin check to all routes in this file
router.use(authenticateToken);
router.use(isAdmin);

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

        res.status(200).json({
            totalUsers,       // Renamed from activeUsers for clarity, as it's total for now
            newSignupsToday
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
            order: [['createdAt', 'DESC']], // Get the most recent matches
            include: [
                {
                    model: User, // Include User model for user1
                    as: 'User1', // Use the alias defined in the association
                    attributes: ['id', 'name'] // Select only necessary fields
                },
                {
                    model: User, // Include User model for user2
                    as: 'User2', // Use the alias defined in the association
                    attributes: ['id', 'name'] // Select only necessary fields
                }
            ],
            attributes: ['matchId', 'status', 'createdAt'] // Select Match fields
        });

        console.log(`[Admin Matches] Found ${recentMatches.length} recent matches.`);

        // Format the response (optional, but good practice)
        const formattedMatches = recentMatches.map((match: any) => ({
            matchId: match.matchId,
            user1: match.User1 ? { id: match.User1.id, name: match.User1.name } : null,
            user2: match.User2 ? { id: match.User2.id, name: match.User2.name } : null,
            status: match.status, // Assuming Match model has a 'status' field
            createdAt: match.createdAt
        }));

        res.status(200).json(formattedMatches);

    } catch (error) {
        console.error('[GET /api/admin/matches/recent] Error fetching recent matches:', error);
        next(error); // Pass error to the global error handler
    }
});

/**
 * @swagger
 * /api/admin/users/pending:
 *   get:
 *     summary: Get list of users pending approval (admin only)
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
 *     responses:
 *       200:
 *         description: List of pending users retrieved successfully
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
router.get('/users/pending', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[GET /api/admin/users/pending] Request received.');
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search as string || '';

    const whereClause: any = {
        status: 'pending_approval',
        deletedAt: null // Exclude soft-deleted users
    };

    if (searchTerm) {
        whereClause[Op.or] = [
            { name: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } }
        ];
    }

    try {
        const { count, rows } = await User.findAndCountAll({
            where: whereClause,
            limit: limit,
            offset: offset,
            order: [['createdAt', 'ASC']], // Show oldest pending users first
            attributes: { exclude: ['passwordHash'] } // Exclude sensitive info
        });

        const totalPages = Math.ceil(count / limit);
        console.log(`[Admin Pending Users] Found ${count} pending users. Page ${page}/${totalPages}.`);

        res.status(200).json({
            users: rows,
            totalPages,
            currentPage: page,
            totalCount: count
        });

    } catch (error) {
        console.error('[GET /api/admin/users/pending] Error fetching pending users:', error);
        next(error);
    }
});

/**
 * @swagger
 * /api/admin/users/{userId}/approve:
 *   patch:
 *     summary: Approve a pending user (admin only)
 *     tags: [Admin, Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: ID of the user to approve
 *     responses:
 *       200: { description: 'User approved successfully' }
 *       400: { description: 'User is not pending approval or already approved' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin or user not found)' }
 *       500: { description: 'Server error' }
 */
router.patch('/users/:userId/approve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = parseInt(req.params.userId, 10);
    const io = (req as any).io; // Correctly get io from req
    console.log(`[PATCH /api/admin/users/${userId}/approve] Request received.`);

    if (isNaN(userId)) {
        res.status(400).json({ message: 'Invalid user ID' });
        return;
    }

    try {
        const user = await User.findOne({ where: { id: userId, status: 'pending_approval' } });

        if (!user) {
            console.warn(`[Admin Approve] User ${userId} not found or not pending approval.`);
            const existingUser = await User.findByPk(userId);
            if (existingUser && existingUser.status === 'active') {
                 res.status(400).json({ message: 'User is already active.'});
                 return; // Return void
            }
            res.status(404).json({ message: 'User not found or not pending approval.'});
            return; // Return void
        }

        user.status = 'active';
        await user.save();
        console.log(`[Admin Approve] User ${userId} approved successfully.`);

        if (user.gender === 'male') {
            try {
                const [waitlistEntry, created] = await MatchingWaitList.findOrCreate({
                    where: { userId: user.id },
                    defaults: { userId: user.id }
                });
                if (created) {
                    console.log(`Approved male user ${user.id} added to MatchingWaitList.`);
                } else {
                    console.log(`Approved male user ${user.id} was already in MatchingWaitList.`);
                }
            } catch (waitlistError) {
                console.error(`Error adding approved user ${user.id} to MatchingWaitList:`, waitlistError);
            }
        }

        // --- Generate NEW JWT with ACTIVE status --- 
        const newPayload = { userId: user.id, email: user.email, status: 'active' };
        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' }); // Use imported JWT_SECRET
        // -------------------------------------------

        // --- Emit WebSocket event with the NEW token --- 
        if (io && connectedUsers) { // Use io instance from req
            let userSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === userId) {
                    userSocketId = socketId;
                    break;
                }
            }

            if (userSocketId) {
                console.log(`[Admin Approve] Emitting 'userApproved' event with new token to socket ${userSocketId} for user ${userId}`);
                io.to(userSocketId).emit('userApproved', { 
                    message: 'Your account has been approved!', 
                    token: newToken // Send the new token
                });
            } else {
                console.log(`[Admin Approve] Socket not found for approved user ${userId}. Cannot send real-time update.`);
            }
        } else {
            console.warn('[Admin Approve] Socket.IO instance or connectedUsers map not available. Cannot send real-time update.');
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
 *       200: { description: 'User rejected successfully' }
 *       400: { description: 'User is not pending approval' }
 *       401: { description: 'Authentication token required' }
 *       403: { description: 'Forbidden (not an admin or user not found)' }
 *       500: { description: 'Server error' }
 */
router.patch('/users/:userId/reject', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = parseInt(req.params.userId, 10);
    const io = (req as any).io; // Get io instance from req
    console.log(`[PATCH /api/admin/users/${userId}/reject] Request received.`);

     if (isNaN(userId)) {
        res.status(400).json({ message: 'Invalid user ID' });
        return; // Return void
    }

    try {
        const user = await User.findOne({ where: { id: userId, status: 'pending_approval' } });

        if (!user) {
             console.warn(`[Admin Reject] User ${userId} not found or not pending approval.`);
             const existingUser = await User.findByPk(userId);
             if (existingUser && existingUser.status !== 'pending_approval') {
                  res.status(400).json({ message: `User status is already '${existingUser.status}'.`});
                  return; // Return void
             }
             res.status(404).json({ message: 'User not found or not pending approval.'});
             return; // Return void
        }

        // Update status to 'rejected'
        user.status = 'rejected';
        // Optionally: Set deletion timestamp if using soft delete
        // user.deletedAt = new Date(); 
        await user.save();
        console.log(`[Admin Reject] User ${userId} status updated to 'rejected'.`);

        // --- Emit WebSocket event to the rejected user --- 
        if (io && connectedUsers) {
            let userSocketId: string | null = null;
            for (const [socketId, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === userId) {
                    userSocketId = socketId;
                    break;
                }
            }

            if (userSocketId) {
                console.log(`[Admin Reject] Emitting 'userRejected' event to socket ${userSocketId} for user ${userId}`);
                io.to(userSocketId).emit('userRejected', { 
                    message: 'Your account registration was rejected and will be deleted. Please contact support if you believe this is an error.'
                });
                 // Optionally disconnect the socket after sending the message
                 // io.sockets.sockets.get(userSocketId)?.disconnect();
            } else {
                console.log(`[Admin Reject] Socket not found for rejected user ${userId}. Cannot send real-time update.`);
            }
        } else {
             console.warn('[Admin Reject] Socket.IO instance or connectedUsers map not available. Cannot send real-time update.');
        }
        // ---------------------------------------------------

        res.status(200).json({ message: 'User rejected successfully' });

    } catch (error) {
        console.error(`[PATCH /api/admin/users/${userId}/reject] Error rejecting user:`, error);
        next(error); // Pass error to middleware
    }
});


// --- Placeholder for other admin routes ---
// Example: GET /api/admin/users
// router.get('/users', async (req, res, next) => { ... });
// -----------------------------------------

export default router; 