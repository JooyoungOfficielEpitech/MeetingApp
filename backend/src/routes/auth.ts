import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize'; // Import Op for OR query
import multer, { FileFilterCallback } from 'multer'; // Import multer and FileFilterCallback
import path from 'path';     // Import path
import fs from 'fs';         // Import fs
import { v4 as uuidv4 } from 'uuid'; // UUID 생성
import supabaseAdmin from '../utils/supabaseClient'; // Supabase 클라이언트 가져오기
// --- Augment Express Session Type --- 
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    pendingSocialProfile?: {
      provider: 'google' | 'kakao'; // ★ 명시적으로 provider 추가
      id: string; // Google ID or Kakao ID (string)
      email: string;
      name?: string;
      gender?: string; // Kakao는 성별 정보를 줄 수 있음
    } | null; // Allow null when cleared
  }
}
// ------------------------------------
import { authenticateToken } from '../middleware/authMiddleware'; // Import authentication middleware
import passport from 'passport'; // Import passport for Google auth
import { JWT_SECRET } from '../config/jwt'; // Import JWT_SECRET from config
// Import Sequelize model (adjust path/import method if needed)
const db = require('../../models'); // Adjust if models/index.js provides types
const User = db.User;
const Match = db.Match; // Import Match model
const MatchingWaitList = db.MatchingWaitList; // MatchingWaitList 모델 import

const router = express.Router();

// 파일 상단에 프론트엔드 URL을 위한 환경 변수 추가
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// --- Moved Route for Social Login Profile Completion --- 

/**
 * @swagger
 * /api/auth/session/profile-data:
 *   get:
 *     summary: Get pending social profile data from session
 *     tags: [Authentication]
 *     description: Retrieves temporary profile data stored in session during social sign-up flow.
 *     responses:
 *       200:
 *         description: Pending profile data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email: { type: string, format: email }
 *                 name: { type: string }
 *       401:
 *         description: Unauthorized (no session or pending profile).
 *       500:
 *         description: Server error.
 */
router.get('/session/profile-data', (req: any, res: Response) => {
    console.log('[GET /session/profile-data] Session check:', req.session?.pendingSocialProfile);
    if (req.session && req.session.pendingSocialProfile) {
        // Only return non-sensitive data needed for the form pre-fill
        const { email, name, gender } = req.session.pendingSocialProfile;
        res.status(200).json({ email, name, gender });
    } else {
        // If no pending data, maybe the user came here directly or session expired
        res.status(401).json({ message: 'No pending profile data found in session.' });
    }
});
// --- End Moved Route ---

// --- Remove Mock User Data Store ---
// interface User {...}
// const users: User[] = [];
// ------------------------------------

// --- Multer Configuration for File Uploads (메모리 저장소로 변경) ---

// Multer 메모리 저장소 설정 (디스크 대신 메모리에 임시 저장)
const storage = multer.memoryStorage();

// 파일 필터 (이미지 파일만 허용)
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        console.log(`[Multer] Accepting image file: ${file.originalname} (${file.mimetype})`);
        cb(null, true);
    } else {
         console.warn(`[Multer] Rejecting non-image file: ${file.originalname} (${file.mimetype})`);
         cb(new Error('Invalid file type, only images (JPEG, PNG, GIF) are allowed!'));
    }
};

// Multer 업로드 인스턴스 (메모리 저장소 사용)
const upload = multer({
    storage: storage, // 메모리 저장소 사용
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 4 // Max 3 profile pics + 1 business card = 4 total files
    }
});
// --- End Multer Configuration ---

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User signup and login
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - gender
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User's password (min 6 characters)
 *               name:
 *                  type: string
 *                  description: User's name
 *               gender:
 *                  type: string
 *                  enum: ['male', 'female', 'other']
 *                  description: User's gender
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: Invalid input (validation error) or email already exists
 *       500:
 *         description: Server error
 */
router.post('/signup',
    // Input validation rules
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'), // Added normalizeEmail
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password } = req.body;

            // Check if user already exists (using Sequelize)
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                res.status(400).json({ message: 'Email already in use' });
                return;
            }

            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Create new user (using Sequelize)
            const newUser = await User.create({
                email,
                passwordHash,
                occupation: false, // Explicitly set occupation to false on signup
                status: 'pending_profile', // Set status to pending_profile for completing profile
            });
            console.log('New user created (signup):', newUser.toJSON());

            // --- Generate JWT for the new pending user --- 
            const payload = { 
                userId: newUser.id, 
                email: newUser.email,
                status: newUser.status // Should be 'pending_profile'
            };
            console.log('Generating JWT for new pending user with payload:', payload); 
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Use imported JWT_SECRET
            // ---------------------------------------------
            
            // --- Prepare limited user response (optional, but consistent) ---
            const userResponse = { 
                 id: newUser.id,
                 email: newUser.email,
                 status: newUser.status
             };
            // ------------------------------------------------------------

            // Respond with success message, token, and user info
            res.status(201).json({ 
                message: 'Signup successful. Please complete your profile.', // Updated message
                token: token,       // Return the token
                user: userResponse  // Return basic user info
            });

        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ message: 'Server error during signup' });
        }
    }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                      id:
 *                          type: string
 *                      email:
 *                          type: string
 *                      name:
 *                          type: string
 *       400:
 *         description: Invalid credentials or validation error
 *       500:
 *         description: Server error
 */
router.post('/login',
    // Input validation rules
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password } = req.body;

            // Find user (using Sequelize)
            const user = await User.findOne({ where: { email } });
            if (!user) {
                res.status(400).json({ message: 'Invalid credentials' }); // Keep generic message
                return;
            }

            // --- Check if user has a password hash --- 
            if (!user.passwordHash) {
                // User exists but likely signed up via social login
                res.status(400).json({ 
                    message: 'This account was created using social login. Please use the corresponding social login button.' 
                });
                return;
            }
            // -------------------------------------------

            // Compare password
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                res.status(400).json({ message: 'Invalid credentials' });
                return;
            }

            // --- Check User Status --- 
            if (user.status === 'pending_approval') {
                console.warn(`Login attempt failed: User ${user.id} is pending approval.`);
                res.status(403).json({ message: 'Your account is pending administrator approval.' });
                return;
            } else if (user.status === 'rejected' || user.status === 'suspended') { // Handle rejected/suspended
                 console.warn(`Login attempt failed: User ${user.id} status is ${user.status}.`);
                 res.status(403).json({ message: `Your account access has been restricted (${user.status}). Please contact support.` });
                 return;
            } else if (user.status !== 'active') {
                 // Catch any other unexpected statuses
                 console.error(`Login attempt failed: User ${user.id} has unexpected status ${user.status}.`);
                 res.status(500).json({ message: 'An unexpected error occurred with your account status.' });
                 return;
            }
            // --- User is active, proceed with login --- 

            // --- Add male user to waitlist if not occupied --- 
            if (user.gender === 'male' && user.occupation === false) {
                try {
                    const [waitlistEntry, created] = await MatchingWaitList.findOrCreate({
                        where: { userId: user.id },
                        defaults: { userId: user.id, gender: 'male' } // Add gender: 'male' here
                    });
                    if (created) {
                        console.log(`Male user ${user.id} added to MatchingWaitList on login (gender: male).`);
                    } else {
                        console.log(`Male user ${user.id} already in MatchingWaitList (login check).`);
                    }
                } catch (waitlistError) {
                    console.error(`Error ensuring user ${user.id} in MatchingWaitList during login:`, waitlistError);
                }
            }
            // --------------------------------------------------

            // --- Check for active match for this user --- 
            let activeMatchId: string | null = null;
            try {
                 const activeMatch = await Match.findOne({
                     where: {
                         [Op.or]: [
                             { user1Id: user.id },
                             { user2Id: user.id }
                         ],
                         isActive: true
                     },
                     order: [['createdAt', 'DESC']] // Get the most recent active match
                 });
                 if (activeMatch) {
                     activeMatchId = activeMatch.matchId;
                     console.log(`User ${user.id} has an active match: ${activeMatchId}`);
                 }
            } catch (matchError) {
                 console.error(`Error checking for active match for user ${user.id}:`, matchError);
                 // Proceed without active match info in case of error
            }
            // -------------------------------------------

            // --- Login Successful --- 
            const payload = { 
                userId: user.id, 
                email: user.email,
                status: user.status // Include user status in JWT payload
            };
            console.log('JWT Payload:', payload); // Log the payload
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            // Respond with token, user info, and active match ID (if found)
            const userResponse = { // Explicitly create response object
                 id: user.id,
                 email: user.email,
                 name: user.name,
                 // Add other non-sensitive fields if needed
            };
            res.json({ 
                token, 
                user: userResponse, 
                activeMatchId: activeMatchId // Include activeMatchId (null if none found)
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

// --- Routes for Social Login Profile Completion --- 

/**
 * @swagger
 * /api/auth/social/complete:
 *   post:
 *     summary: Complete social sign-up with additional profile info
 *     tags: [Authentication]
 *     description: Creates a new user using temporary session data and additional info provided by the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - age
 *               - height
 *               - gender
 *               - mbti
 *             properties:
 *               age: { type: integer, minimum: 1 }
 *               height: { type: integer, minimum: 1 }
 *               gender: { type: string, enum: ['male', 'female', 'other'] } # Adjust enum as needed
 *               mbti: { type: string, maxLength: 4 } # Example validation
 *     responses:
 *       201:
 *         description: User created successfully, JWT token returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse' # Assuming you have a schema for token response
 *       400:
 *         description: Invalid input data or missing session data.
 *       401:
 *         description: Unauthorized (no session or pending profile).
 *       409:
 *         description: Conflict (User with this email or social ID already exists).
 *       500:
 *         description: Server error.
 */
router.post('/social/complete',
    // Input validation rules
    body('age').isInt({ min: 1 }).withMessage('Age must be a positive integer'),
    body('height').isInt({ min: 1 }).withMessage('Height must be a positive integer'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender value'), // Adjust allowed values
    body('mbti').isString().isLength({ min: 4, max: 4 }).withMessage('MBTI must be 4 characters'), // Example MBTI validation
    // Add type casting for the async handler
    (async (req: any, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // No explicit return needed for void promise, but okay
                return res.status(400).json({ errors: errors.array() }); 
            }

            if (!req.session || !req.session.pendingSocialProfile) {
                return res.status(401).json({ message: 'Unauthorized: No pending social profile data found.' }); 
            }

            // --- Correctly destructure session data --- 
            // Get 'id' from session and rename it to 'googleId' for use in this scope
            const { id: googleId, email, name } = req.session.pendingSocialProfile; 
            // -------------------------------------------
            const { age, height, gender, mbti } = req.body; 

            // --- Add check if googleId was actually retrieved --- 
            if (!googleId) {
                 console.error('Google ID missing from session data even though pending profile exists.');
                 req.session.pendingSocialProfile = null; // Clear potentially corrupt session data
                 req.session.save();
                 return res.status(400).json({ message: 'Session data is incomplete. Please try logging in again.' });
            }
            // ---------------------------------------------------

            // Double-check if user already exists
            const existingUser = await User.findOne({ where: { [db.Sequelize.Op.or]: [{ email }, { googleId }] } });
            if (existingUser) {
                req.session.pendingSocialProfile = null;
                return res.status(409).json({ message: 'User with this email or social ID already exists.' }); 
            }

            // Create the new user with all data
            const newUser = await User.create({
                googleId, 
                email,    
                name,     
                age,      
                height,   
                gender,   
                mbti,     
                occupation: false, // Explicitly set occupation to false
                status: 'pending_approval' // Explicitly set status
            });
            console.log('New user created via social completion:', newUser.toJSON());

            req.session.pendingSocialProfile = null; 
            req.session.save((err: any) => {
                 if (err) {
                    console.error("Session save error after completing profile:", err);
                 }
                 // Generate JWT for the new user
                 const payload = { 
                     userId: newUser.id, 
                     email: newUser.email,
                     status: 'active' // User created via this route is implicitly active (already approved implicitly)
                 };
                 const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
                 res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } }); 
            });

        } catch (error) {
            console.error('Social profile completion error:', error);
            if (req.session && req.session.pendingSocialProfile) {
                req.session.pendingSocialProfile = null;
                req.session.save(); // Fire and forget save
            }
            next(error); 
        }
    }) as RequestHandler
);

// Define the handler function separately with RequestHandler type and explicit Promise<void> return type
const completeSocialProfileHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('[/api/auth/complete-social POST] Received request.');
    // @ts-ignore 
    const pendingProfile = req.session?.pendingSocialProfile;
    const { name, gender /* other fields */ } = req.body;
    
    console.log('Session pendingProfile:', pendingProfile);
    console.log('Request body:', req.body);

    if (!pendingProfile || !pendingProfile.id || !pendingProfile.provider || !pendingProfile.email) {
         console.error('Invalid or missing pending social profile in session.');
         // @ts-ignore
         delete req.session.pendingSocialProfile;
         res.status(400).json({ message: 'Session expired or invalid. Please try social login again.' }); // Remove return
         return; // Explicitly return void
    }

    try {
        const existingUser = await User.findOne({ 
            where: { 
                email: pendingProfile.email,
                googleId: { [Op.is]: null } 
            }
        });
        if (existingUser) {
            console.warn(`Email ${pendingProfile.email} already exists for a local account.`);
             // @ts-ignore
             delete req.session.pendingSocialProfile;
             res.status(409).json({ message: 'This email is already registered. Please log in using your password.'}); // Remove return
             return; // Explicitly return void
        }

        const newUser = await User.create({
            googleId: pendingProfile.id,
            email: pendingProfile.email,
            name: name, 
            gender: gender, 
            occupation: false, // Explicitly set occupation to false
            status: 'pending_approval' // Explicitly set status
        });
        console.log('New user created from social profile:', newUser.toJSON());

         if (newUser.gender === 'male') {
             try {
                 await MatchingWaitList.create({ userId: newUser.id });
                 console.log(`Male user ${newUser.id} added to MatchingWaitList (social signup).`);
             } catch (waitlistError: any) {
                 if (waitlistError.name === 'SequelizeUniqueConstraintError') {
                     console.warn(`User ${newUser.id} already in MatchingWaitList (social signup).`);
                 } else {
                     console.error(`Error adding user ${newUser.id} to MatchingWaitList:`, waitlistError);
                     // Decide if this error should prevent login or just be logged
                 }
             }
         }

        // @ts-ignore
        delete req.session.pendingSocialProfile;

        // Generate JWT for the new user
        const payload = { 
            userId: newUser.id, 
            email: newUser.email,
            status: 'active' // User created via this route is implicitly active (already approved implicitly)
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

         const userResponse = { 
             id: newUser.id,
             email: newUser.email,
             name: newUser.name,
             gender: newUser.gender,
         };

        res.status(200).json({ token, user: userResponse }); 
        // No return needed here, implicitly returns void

    } catch (error) {
        console.error('Error completing social profile:', error);
        // @ts-ignore
        delete req.session.pendingSocialProfile;
        next(error); // Pass error to middleware, which implicitly returns void
    }
};

// Apply validation middleware first, then the handler
// router.post('/complete-social', 
//     body('name').trim().notEmpty().withMessage('Name is required'),
//     body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender value'),
//     completeSocialProfileHandler // Apply the separated handler
// );

// --- NEW Profile Completion Route Handler (Replaces old /social/complete or similar) ---
// Define type for uploaded files in request for clarity
// interface AuthenticatedRequest extends Request {
//     user?: { userId: number; [key: string]: any }; // Define structure for req.user
//     files?: { // Define structure for req.files from multer.fields
//         profilePictures?: Express.Multer.File[];
//         businessCard?: Express.Multer.File[];
//     };
// }

/**
 * @swagger
 * /api/auth/complete-social:
 *   post:
 *     summary: Complete user profile after signup/social login (with file uploads)
 *     tags: [Authentication, User Profile]
 *     security:
 *       - bearerAuth: [] # Requires JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - age
 *               - height
 *               - mbti
 *               - gender
 *               - profilePictures
 *               - businessCard
 *             properties:
 *               age:
 *                 type: integer
 *                 description: User's age
 *               height:
 *                 type: integer
 *                 description: User's height in cm
 *               mbti:
 *                 type: string
 *                 maxLength: 4
 *                 pattern: '^[EI][SN][TF][JP]$'
 *                 description: User's MBTI type (e.g., INFP)
 *               gender:
 *                  type: string
 *                  enum: ['male', 'female'] # Adjusted enum
 *                  description: User's selected gender
 *               profilePictures:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 3
 *                 description: Profile pictures (min 1, max 3)
 *               businessCard:
 *                 type: string
 *                 format: binary
 *                 description: Business card/proof of occupation image
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: New JWT token with updated user status/info
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile' # Reference a schema if defined
 *       400:
 *         description: Validation errors or missing files
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User not found for the token's userId
 *       500:
 *         description: Server error during profile update or file handling
 */
router.post(
    '/complete-social',
    // Middleware to check if session exists
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.session || !req.session.pendingSocialProfile) {
             console.error('[complete-social Pre-Multer Check] Error: Session or pendingSocialProfile missing.');
             res.status(401).json({ message: 'Session expired or invalid. Please try social login again.' });
             return;
         }
        console.log(`[complete-social Pre-Multer Check] Session found for social profile completion.`);
        next();
    },
    upload.fields([ // Apply multer
        { name: 'profilePictures', maxCount: 3 },
        { name: 'businessCard', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const files = (req as any).files as { 
            profilePictures?: Express.Multer.File[];
            businessCard?: Express.Multer.File[];
        };
        const pendingProfile = req.session?.pendingSocialProfile;

        if (!pendingProfile || !pendingProfile.id || !pendingProfile.email) {
             console.error('[complete-social Handler] Error: Session or essential pending profile data missing after multer.');
             res.status(401).json({ message: 'Session expired or invalid after file upload. Please try social login again.' });
             return;
        }
        const { id: socialId, email: sessionEmail, name: sessionName, provider } = pendingProfile;
        console.log(`[POST /api/auth/complete-social] Processing request for social user: ${sessionEmail} (${provider} ID: ${socialId})`);

        // --- Validation ---
        const { age, height, mbti, gender, city, nickname } = (req as any).body;
        const errors: string[] = [];
        if (!nickname || nickname.trim() === '') errors.push('Nickname is required.');
        if (!age || isNaN(parseInt(age)) || parseInt(age) < 19) errors.push('Valid age (19+) is required.');
        if (!height || isNaN(parseInt(height)) || parseInt(height) < 100) errors.push('Valid height (>= 100cm) is required.');
        if (!mbti || !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('Valid MBTI (4 letters, e.g., INFP) is required.');
        if (!gender || !['male', 'female'].includes(gender.toLowerCase())) errors.push('Valid gender (male/female) is required.');
        if (!city || !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('Valid city (seoul/busan/jeju) is required.');
        
        if (!files?.profilePictures || files.profilePictures.length === 0) {
            errors.push('At least one profile picture is required.');
        } else if (files.profilePictures.length > 3) {
            errors.push('Maximum 3 profile pictures allowed.');
        }
        if (!files?.businessCard || files.businessCard.length === 0) {
            errors.push('Business card image is required.');
        } else if (files.businessCard.length > 1) {
             errors.push('Only one business card image allowed.');
        }

        if (errors.length > 0) {
             console.warn(`[complete-social] Validation failed for social user ${sessionEmail}:`, errors);
             res.status(400).json({ message: 'Validation failed', errors });
             return;
        }
        // --- End Validation ---

        // ----- Supabase Upload Logic ----- 
        let uploadedProfileUrls: string[] = [];
        let uploadedBusinessCardUrl: string | null = null;
        const userIdForPath = socialId.toString(); // Use social ID for path initially
        const profileImageFolder = `profiles/${userIdForPath}`;
        const businessCardFolder = `business_cards/${userIdForPath}`;

        try {
            // Check required files again before proceeding
            if (!files || !files.profilePictures || files.profilePictures.length === 0 || !files.businessCard || files.businessCard.length === 0) {
                throw new Error('File objects missing after validation.');
            }

            // Upload Profile Pictures
            for (const file of files.profilePictures) {
                const fileName = `${uuidv4()}-${file.originalname}`;
                const filePath = `${profileImageFolder}/${fileName}`;
                console.log(`[Supabase Upload] Uploading profile picture: ${filePath}`);
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('profile-images') // 버킷 이름
                    .upload(filePath, file.buffer, { // 메모리 버퍼 사용
                        contentType: file.mimetype,
                        upsert: false, // 동일 파일명 덮어쓰기 방지
                    });

                if (uploadError) {
                    console.error(`[Supabase Upload] Error uploading profile picture ${fileName}:`, uploadError);
                    throw new Error(`Failed to upload profile picture: ${uploadError.message}`);
                }
                
                // Get public URL
                const { data: urlData } = supabaseAdmin.storage
                    .from('profile-images')
                    .getPublicUrl(filePath);
                    
                if (!urlData || !urlData.publicUrl) {
                     console.error(`[Supabase Upload] Failed to get public URL for ${filePath}`);
                     throw new Error(`Failed to get public URL for profile picture.`);
                }
                uploadedProfileUrls.push(urlData.publicUrl);
                console.log(`[Supabase Upload] Profile picture uploaded: ${urlData.publicUrl}`);
            }

            // Upload Business Card
            const businessCardFile = files.businessCard[0];
            const businessCardFileName = `${uuidv4()}-${businessCardFile.originalname}`;
            const businessCardFilePath = `${businessCardFolder}/${businessCardFileName}`;
            console.log(`[Supabase Upload] Uploading business card: ${businessCardFilePath}`);
            const { data: cardUploadData, error: cardUploadError } = await supabaseAdmin.storage
                .from('profile-images') // 동일 버킷 사용 (또는 다른 버킷 지정 가능)
                .upload(businessCardFilePath, businessCardFile.buffer, {
                    contentType: businessCardFile.mimetype,
                    upsert: false,
                });

            if (cardUploadError) {
                console.error(`[Supabase Upload] Error uploading business card ${businessCardFileName}:`, cardUploadError);
                throw new Error(`Failed to upload business card: ${cardUploadError.message}`);
            }

            const { data: cardUrlData } = supabaseAdmin.storage
                .from('profile-images')
                .getPublicUrl(businessCardFilePath);
                
            if (!cardUrlData || !cardUrlData.publicUrl) {
                 console.error(`[Supabase Upload] Failed to get public URL for ${businessCardFilePath}`);
                 throw new Error(`Failed to get public URL for business card.`);
            }
            uploadedBusinessCardUrl = cardUrlData.publicUrl;
            console.log(`[Supabase Upload] Business card uploaded: ${uploadedBusinessCardUrl}`);
            
            // ----- End Supabase Upload Logic -----

            // --- Create NEW user record (using sessionEmail) --- 
            const newUser = await User.create({
                // Assign social ID based on provider
                googleId: provider === 'google' ? socialId : null,
                kakaoId: provider === 'kakao' ? socialId : null,
                email: sessionEmail, // Use email from session
                name: sessionName, // Use name from session
                nickname: nickname, // Use nickname from form
                age: parseInt(age),
                height: parseInt(height),
                mbti: mbti.toUpperCase(),
                gender: gender.toLowerCase(),
                city: city.toLowerCase(),
                profileImageUrls: uploadedProfileUrls, // Supabase URLs 저장
                businessCardImageUrl: uploadedBusinessCardUrl, // Supabase URL 저장
                status: 'pending_approval', 
                occupation: false, // 기본값 false 설정
            });
            console.log(`[complete-social] New user ${newUser.id} created via ${provider} completion. Supabase URLs saved. Status set to pending_approval.`);
            // -------------------------------

            // --- Clear pending profile from session --- 
            if (req.session) {
                 req.session.pendingSocialProfile = null;
                 req.session.save(saveErr => {
                      if (saveErr) console.error('[complete-social] Error saving session after clearing pending profile:', saveErr);
                 });
            }
            // ------------------------------------------

            // --- Generate NEW token with pending_approval status --- 
            const payload = {
                userId: newUser.id, 
                email: newUser.email,
                status: newUser.status, // Should be 'pending_approval'
                gender: newUser.gender
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            // --------------------------------------------------------------

            // Prepare user response
            const userResponse = {
                 id: newUser.id, email: newUser.email, name: newUser.name, nickname: newUser.nickname,
                 gender: newUser.gender, age: newUser.age, height: newUser.height,
                 mbti: newUser.mbti, profileImageUrls: newUser.profileImageUrls,
                 businessCardImageUrl: newUser.businessCardImageUrl, status: newUser.status,
                 city: newUser.city
            };

            // Send success response
            res.status(200).json({ 
                message: 'Profile information submitted successfully. Waiting for administrator approval.',
                token: token,
                user: userResponse
            });

        } catch (error: any) {
            console.error(`[POST /api/auth/complete-social] Error processing profile completion for social user ${sessionEmail}:`, error);
            // If upload failed partially, Supabase doesn't have automatic rollback
            // We might need manual cleanup logic here based on uploaded URLs if needed
            // Currently, we just log the error.
             if(req.session) req.session.pendingSocialProfile = null;

            if (error.name === 'SequelizeValidationError') {
                res.status(400).json({ message: 'Database validation failed.', errors: error.errors?.map((e:any) => e.message) });
            } else if (error.name === 'SequelizeDatabaseError') {
                 res.status(500).json({ message: 'Database error during user creation.' });
            } else {
                 // Handle specific Supabase upload errors or general errors
                 res.status(500).json({ message: error.message || 'An unexpected error occurred during profile completion.' });
            }
        }
    }
);

// --- Google Authentication Routes ---

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth 2.0 login flow
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to Google for authentication.
 */
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth 2.0 callback URL
 *     tags: [Authentication]
 *     description: >
 *       Handles the redirect from Google after user authentication.
 *       If successful and profile complete, redirects to frontend auth callback with JWT.
 *       If new user or profile incomplete, redirects to frontend profile completion page.
 *       On failure, redirects to frontend home page with an error query parameter.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code from Google.
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *         required: true
 *         description: Scopes granted by the user.
 *     responses:
 *       302:
 *         description: >
 *           Redirects to frontend:
 *           - `${FRONTEND_URL}/auth/callback?token=<jwt>` on successful login (profile complete).
 *           - `${FRONTEND_URL}/signup/complete-profile` for new users or incomplete profiles.
 *           - `${FRONTEND_URL}/?error=<error_message>` on authentication failure.
 */
router.get('/google/callback',
    (req: any, res, next) => { // Logging middleware (optional but helpful)
        console.log('\n--- Entering /auth/google/callback route ---');
        console.log('Session ID:', req.sessionID);
        console.log('Session Data BEFORE authenticate:', JSON.stringify(req.session, null, 2));
        next();
    },
    (req: any, res, next) => { // Custom authentication callback handler
        passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/?error=google_auth_failed` }, // Basic failure redirect
            async (err: any, user: any, info: any) => {
                console.log('\n--- Inside /auth/google/callback passport.authenticate ---');
                console.log('Error:', err);
                console.log('User object (from strategy done()):', user ? user.toJSON() : user);
                console.log('Info:', info);
                console.log('Session Data IN callback:', JSON.stringify(req.session, null, 2));

                if (err) {
                    console.error('Authentication Error from Google strategy:', err);
                    // Redirect with a generic error, or use err.message if available and safe
                    return res.redirect(`${FRONTEND_URL}/?error=google_auth_error`);
                }

                if (user) {
                    // --- Existing User Authenticated by Strategy --- 
                    console.log('Google Callback: Existing user authenticated.', user.toJSON());

                    // Check if essential profile info is missing
                    // Adjust this check based on what defines a "complete" profile in your app
                    const isProfileComplete = user.gender && ['male', 'female', 'other'].includes(user.gender);

                    if (isProfileComplete) {
                        // Profile complete: Generate JWT, include status, redirect to frontend auth callback
                        const payload = {
                            userId: user.id,
                            email: user.email,
                            status: user.status // Include status
                        };
                        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
                        console.log('Profile complete. Redirecting to /auth/callback with token containing status:', payload.status);
                        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
                    } else {
                        // Profile incomplete: Redirect to complete profile page (use session)
                        console.log('Profile incomplete. Storing pending info and redirecting to /signup/complete-profile.');
                        // Ensure pendingSocialProfile is set correctly (strategy should have done this)
                        if (!req.session.pendingSocialProfile) {
                            req.session.pendingSocialProfile = {
                                provider: 'google', // or user.provider if available
                                id: user.googleId, // Assuming googleId field exists
                                email: user.email,
                                name: user.name, // Include existing name if available
                            };
                        }
                        // Save session before redirecting
                        req.session.save((saveErr: any) => {
                            if (saveErr) {
                                console.error("Session save error before redirecting incomplete existing user:", saveErr);
                                return res.redirect(`${FRONTEND_URL}/?error=session_save_error`);
                            }
                            console.log('Session saved for incomplete existing user. Redirecting...');
                            return res.redirect(`${FRONTEND_URL}/signup/complete-profile?isNewUser=true`); // 파라미터 추가
                        });
                    }
                } else if (req.session && req.session.pendingSocialProfile && req.session.pendingSocialProfile.provider === 'google') {
                    // --- New User via Google (strategy called done(null, false)) --- 
                    console.log('Google Callback: New user identified by session. Redirecting to complete profile.');
                    // Session already has the data, just redirect
                    // NOTE: Session *should* have been saved by the strategy before calling done(null, false)
                    // If not, the strategy needs adjustment, or save it here.
                    // Assuming strategy handles saving:
                    return res.redirect(`${FRONTEND_URL}/signup/complete-profile?isNewUser=true`); // 파라미터 추가
                } else {
                    // --- Authentication Failed or Unexpected State ---
                    console.error('Google Callback: Unexpected state or user denied access. User:', user, 'Session:', req.session);
                    const failureMsg = info?.message || 'authentication_failed_unexpected';
                    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(failureMsg)}`);
                }
            })(req, res, next); // *** Important: Invoke the middleware returned by passport.authenticate ***
    }
);
// --- End Google Authentication Routes ---

// --- Kakao Authentication Routes ---

/**
 * @swagger
 * /api/auth/kakao:
 *   get:
 *     summary: Initiate Kakao OAuth 2.0 login flow
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to Kakao for authentication.
 */
router.get('/kakao',
    passport.authenticate('kakao') // Only need email scope by default
);

/**
 * @swagger
 * /api/auth/kakao/callback:
 *   get:
 *     summary: Kakao OAuth 2.0 callback URL
 *     tags: [Authentication]
 *     description: >
 *       Handles the redirect from Kakao after user authentication.
 *       If successful and profile complete, redirects to frontend auth callback with JWT.
 *       If new user or profile incomplete, redirects to frontend profile completion page.
 *       On failure, redirects to frontend home page with an error query parameter.
 *     responses:
 *       302:
 *         description: >
 *           Redirects to frontend:
 *           - `${FRONTEND_URL}/auth/callback?token=<jwt>` on successful login (profile complete).
 *           - `${FRONTEND_URL}/signup/complete-profile` for new users or incomplete profiles.
 *           - `${FRONTEND_URL}/?error=<error_message>` on authentication failure.
 */
router.get('/kakao/callback',
    (req: any, res, next) => { // Logging middleware (optional)
        console.log('\n--- Entering /auth/kakao/callback route ---');
        console.log('Session Data BEFORE authenticate:', JSON.stringify(req.session, null, 2));
        next();
    },
    (req: any, res, next) => { // Custom authentication callback handler
        passport.authenticate('kakao', { failureRedirect: `${FRONTEND_URL}/?error=kakao_auth_failed` },
            async (err: any, user: any, info: any) => {
                console.log('\n--- Inside /auth/kakao/callback passport.authenticate ---');
                console.log('Error:', err);
                // User from strategy comes as a Sequelize model instance
                console.log('User object (from strategy done()):', user ? user.toJSON() : user); 
                console.log('Info:', info);
                console.log('Session Data IN callback:', JSON.stringify(req.session, null, 2));

                if (err) {
                    console.error('Authentication Error from Kakao strategy:', err);
                    return res.redirect(`${FRONTEND_URL}/?error=kakao_auth_error`);
                }

                if (user) {
                    // --- Existing User Authenticated by Strategy --- 
                    console.log('Kakao Callback: Existing user authenticated.', user.toJSON());
                    const isProfileComplete = user.gender && ['male', 'female'].includes(user.gender);

                    if (isProfileComplete || user.status !== 'pending_profile_completion') { // Check profile or status
                         console.log('Kakao Callback: Profile complete or status ok. Generating token.');
                         // Profile complete: Generate JWT and redirect to frontend callback
                         const payload = { userId: user.id, email: user.email, status: user.status };
                         const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
                         console.log('Redirecting to /auth/callback with token.');
                         return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
                    } else {
                         // Profile incomplete: Session should have been set by strategy, redirect to complete
                         console.log('Kakao Callback: Existing user profile incomplete. Redirecting to complete profile.');
                         // Ensure session was saved by strategy before redirecting
                         return res.redirect(`${FRONTEND_URL}/signup/complete-profile?isNewUser=true`);
                    }
                } else if (req.session && req.session.pendingSocialProfile && req.session.pendingSocialProfile.provider === 'kakao') {
                    // --- New User via Kakao (strategy called done(null, false)) --- 
                    console.log('Kakao Callback: New user identified by session. Redirecting to complete profile.');
                    // Session already has data, just redirect
                    return res.redirect(`${FRONTEND_URL}/signup/complete-profile?isNewUser=true`);
                } else {
                    // --- Authentication Failed or Unexpected State ---
                    console.error('Kakao Callback: Unexpected state or user denied access. User:', user, 'Info:', info, 'Session:', req.session);
                    const failureMsg = info?.message || 'kakao_authentication_failed';
                    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(failureMsg)}`);
                }
            })(req, res, next); // Invoke the middleware
    }
);
// --- End Kakao Authentication Routes ---

// ... (Keep other routes like /verify-token, etc. if they exist) ...

export default router; 