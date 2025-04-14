import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt'; // Import from config

// req 타입을 표준 Request로 변경
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
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

        // req.user 할당 시 타입 단언 불필요 (Express.User가 증강됨)
        console.log('[AuthMiddleware] Token verified. Payload:', user);
        // Ensure payload matches the augmented Express.User structure
        if (user && typeof user.userId === 'number' && typeof user.email === 'string') {
            req.user = user; // Directly assign if structure is correct
        } else {
            console.error('[AuthMiddleware] Invalid JWT payload structure for req.user.');
            // Handle error appropriately, maybe return 403
            res.status(403).json({ message: 'Invalid token payload' });
            return;
        }
        next(); // pass the execution to the next handler/middleware
    });
}; 