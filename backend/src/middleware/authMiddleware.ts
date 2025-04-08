import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME'; // Use the same secret

// Define a custom interface for Request object to include user property
interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string }; // Add properties from JWT payload
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Get token from Authorization header (Bearer TOKEN)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // If no token, return 401 Unauthorized
        return res.status(401).json({ message: 'Authentication token required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            // If token is invalid or expired, return 403 Forbidden
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        // If token is valid, attach user payload to the request object
        req.user = user as { userId: string; email: string }; // Type assertion
        next(); // Proceed to the next middleware or route handler
    });
}; 