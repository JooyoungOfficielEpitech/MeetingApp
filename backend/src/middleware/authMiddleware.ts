import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt'; // Import from config

// Extend Express Request type to include user property
interface AuthenticatedRequest extends Request {
    user?: { userId: number; email: string; status?: string; [key: string]: any }; // Define structure for req.user
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        console.warn('[AuthMiddleware] No token provided');
        res.status(401).json({ message: 'Authentication token required' });
        return; // Explicitly return void
    }

    console.log('[AuthMiddleware] Received token:', token);
    console.log('[AuthMiddleware] Using JWT_SECRET:', JWT_SECRET ? 'Exists' : 'Not Found!');

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            console.error('[AuthMiddleware] JWT Verification Error:', err);
            let status = 403;
            let message = 'Invalid or expired token';
            if (err.name === 'TokenExpiredError') {
                status = 401; // Use 401 for expired tokens to prompt re-login
                message = 'Token expired';
            }
            res.status(status).json({ message }); // Send response
            return; // Explicitly return void
        }

        // Token is valid, attach payload to request object
        console.log('[AuthMiddleware] Token verified. Payload:', user);
        req.user = user as { userId: number; email: string; status?: string }; // Type assertion
        next(); // pass the execution to the next handler/middleware
    });
}; 