import { Request, Response, NextFunction } from 'express';
import { io } from '../socket'; // Import the initialized io instance

export const attachIo = (req: Request, res: Response, next: NextFunction) => {
    // Type assertion to allow adding io property
    (req as any).io = io;
    next();
}; 