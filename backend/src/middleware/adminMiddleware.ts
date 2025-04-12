import { Request, Response, NextFunction } from 'express';
const db = require('../../models'); // Adjust path if needed
const User = db.User;

export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('[isAdmin Middleware] Checking admin status...');
    // Ensure authenticateToken middleware ran successfully and attached user
    if (!(req as any).user || !(req as any).user.userId) {
        console.error('[isAdmin Middleware] Error: req.user or req.user.userId is missing. Ensure authenticateToken runs first.');
        res.status(401).json({ message: 'Authentication required' }); // Or 500 Internal Server Error
        return;
    }

    const userId = (req as any).user.userId;
    console.log(`[isAdmin Middleware] Checking admin status for user ID: ${userId}`);

    try {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'isAdmin'] // Only select necessary attributes
        });

        if (!user) {
            console.warn(`[isAdmin Middleware] User not found for ID: ${userId}`);
            res.status(403).json({ message: 'Forbidden: User not found' });
            return;
        }

        if (!user.isAdmin) {
            console.warn(`[isAdmin Middleware] User ${userId} is not an admin.`);
            res.status(403).json({ message: 'Forbidden: Administrator access required' });
            return;
        }

        console.log(`[isAdmin Middleware] User ${userId} is an admin. Proceeding...`);
        next(); // User is admin, proceed to the next middleware/handler

    } catch (error) {
        console.error('[isAdmin Middleware] Error checking admin status:', error);
        res.status(500).json({ message: 'Internal server error during authorization check' });
    }
}; 