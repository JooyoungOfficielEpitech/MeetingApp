import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME'; // Use the same secret

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    // Get token from Authorization header (Bearer TOKEN)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('[AuthMiddleware] Received token:', token); // Log received token
    console.log('[AuthMiddleware] Using JWT_SECRET:', JWT_SECRET ? 'Exists' : 'MISSING!'); // Check if secret exists

    if (token == null) {
        console.log('[AuthMiddleware] Token is null.');
        // If no token, send 401 Unauthorized and stop processing
        res.status(401).json({ message: 'Authentication token required' });
        return; // Use simple return instead of returning the response object
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            // Log the specific JWT verification error
            console.error('[AuthMiddleware] JWT Verification Error:', err);
            // If token is invalid or expired, send 403 Forbidden and stop processing
            res.status(403).json({ message: 'Invalid or expired token', error: err.message }); // Send specific error message back
            return; // Use simple return instead of returning the response object
        }

        // Log successful verification and user payload
        console.log('[AuthMiddleware] JWT Verified Successfully. User payload:', user);
        // If token is valid, attach user payload and proceed
        (req as any).user = user;
        next();
    });
}; 