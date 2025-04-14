import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize'; // Import Op for OR query
import multer, { FileFilterCallback } from 'multer'; // Import multer and FileFilterCallback
import path from 'path';     // Import path
import fs from 'fs';         // Import fs
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

// --- Multer Configuration for File Uploads ---

// Ensure upload directories exist (create if they don't)
// Adjust the path relative to the current file (routes/auth.ts)
const uploadsBaseDir = path.join(__dirname, '..', '..', 'uploads'); // Base uploads directory
const profileUploadDir = path.join(uploadsBaseDir, 'profiles');
const cardUploadDir = path.join(uploadsBaseDir, 'business_cards');
fs.mkdirSync(profileUploadDir, { recursive: true });
fs.mkdirSync(cardUploadDir, { recursive: true });
console.log(`[Multer] Ensured upload directories exist: ${profileUploadDir} and ${cardUploadDir}`);

// Define types for multer callbacks for clarity
type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;

// Multer disk storage configuration
const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: DestinationCallback) => {
        let uploadPath = '';
        if (file.fieldname === 'profilePictures') {
            uploadPath = profileUploadDir;
        } else if (file.fieldname === 'businessCard') {
            uploadPath = cardUploadDir;
        } else {
             return cb(new Error('Invalid field name for file upload'), '');
        }
         // Check if directory exists before calling cb
         if (!fs.existsSync(uploadPath)) {
             try {
                 fs.mkdirSync(uploadPath, { recursive: true });
             } catch (mkdirErr) {
                 console.error(`[Multer] Error creating directory ${uploadPath}:`, mkdirErr);
                 return cb(mkdirErr instanceof Error ? mkdirErr : new Error('Failed to create upload directory'), '');
             }
         }
        cb(null, uploadPath);
    },
    filename: (req: any, file: Express.Multer.File, cb: FileNameCallback) => {
        // Use identifier from session instead of req.user.userId
        // Ensure session middleware runs before multer for this route
        const identifier = req.session?.pendingSocialProfile?.id || req.session?.pendingSocialProfile?.email || 'unknown-social-user';
        const safeIdentifier = String(identifier).replace(/[^a-zA-Z0-9_\-]/g, '_'); // Sanitize identifier
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        // Include fieldname for clarity
        const filename = `${safeIdentifier}-${file.fieldname}-${uniqueSuffix}${extension}`;
        console.log(`[Multer] Generating filename: ${filename} for social user: ${identifier}`);
        cb(null, filename);
    }
});

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        console.log(`[Multer] Accepting image file: ${file.originalname} (${file.mimetype})`);
        cb(null, true); // Accept file
    } else {
         console.warn(`[Multer] Rejecting non-image file: ${file.originalname} (${file.mimetype})`);
         // Reject file - pass an error message (optional)
        cb(new Error('Invalid file type, only images (JPEG, PNG, GIF) are allowed!'));
        // Or just reject without error: cb(null, false);
    }
};

// Multer upload instance configuration
const upload = multer({
    storage: storage,
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
    body('name').trim().notEmpty().withMessage('Name is required'), // Added trim
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender value'), // Added gender validation
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password, name, gender } = req.body;

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
                name,
                gender,
                occupation: false, // Explicitly set occupation to false on signup
                status: 'pending_approval', // Explicitly set status
                // Add default/null values for other User model fields if necessary
                // dob: null, age: null, etc. based on your model definition
            });
            console.log('New user created (signup):', newUser.toJSON());

            // --- Generate JWT for the new pending user --- 
            const payload = { 
                userId: newUser.id, 
                email: newUser.email,
                status: newUser.status // Should be 'pending_approval' from create
            };
            console.log('Generating JWT for new pending user with payload:', payload); 
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Use imported JWT_SECRET
            // ---------------------------------------------
            
            // --- Prepare limited user response (optional, but consistent) ---
            const userResponse = { 
                 id: newUser.id,
                 email: newUser.email,
                 name: newUser.name,
                 gender: newUser.gender,
                 status: newUser.status
             };
            // ------------------------------------------------------------

            // Respond with success message, token, and user info
            res.status(201).json({ 
                message: 'Signup successful. Please wait for administrator approval.', // Keep message
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
    // Middleware to check if session exists before multer tries to access it
    (req: Request, res: Response, next: NextFunction) => { // Use standard Request type
        if (!req.session || !req.session.pendingSocialProfile) {
             console.error('[complete-social Pre-Multer Check] Error: Session or pendingSocialProfile missing.');
             res.status(401).json({ message: 'Session expired or invalid. Please try social login again.' });
             return; // ★ Add explicit return here
         }
        console.log(`[complete-social Pre-Multer Check] Session found for social profile completion.`);
        next(); // Proceed to multer
    },
    upload.fields([ // Apply multer AFTER session check
        { name: 'profilePictures', maxCount: 3 },
        { name: 'businessCard', maxCount: 1 }
    ]),
    // Cast req to reuse AuthenticatedRequest type for file structure, but user field won't exist
    async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Use standard Request type
        // const socialReq = req as AuthenticatedRequest; // Remove cast
        const files = (req as any).files as { // Use type assertion for files
            profilePictures?: Express.Multer.File[];
            businessCard?: Express.Multer.File[];
        }; 
        
        // --- Get data from SESSION, not req.user ---
        const pendingProfile = req.session?.pendingSocialProfile;
        if (!pendingProfile || !pendingProfile.id || !pendingProfile.email) { // Check essential session data
             console.error('[complete-social Handler] Error: Session or essential pending profile data missing after multer.');
             // Clean up any files multer might have saved
             // cleanupFiles(); // Define or call cleanup logic if needed
             res.status(401).json({ message: 'Session expired or invalid after file upload. Please try social login again.' });
             return;
        }
        const { id: googleId, email: sessionEmail, name: sessionName, provider } = pendingProfile;
        console.log(`[POST /api/auth/complete-social] Processing request for social user: ${sessionEmail} (Google ID: ${googleId})`);
        // ----------------------------------------------

        // --- Define cleanup function locally or import it ---
        const cleanupFiles = () => {
            console.warn(`[complete-social] Cleaning up uploaded files for failed request (Social User: ${sessionEmail}).`);
             if (files?.profilePictures) {
                 files.profilePictures.forEach(f => {
                     try { fs.unlinkSync(f.path); console.log(`Deleted: ${f.path}`); } catch (e) { console.error(`Error deleting ${f.path}:`, e); }
                 });
             }
             if (files?.businessCard) {
                 files.businessCard.forEach(f => {
                     try { fs.unlinkSync(f.path); console.log(`Deleted: ${f.path}`); } catch (e) { console.error(`Error deleting ${f.path}:`, e); }
                 });
             }
        };
        // ---------------------------------------------------

        // --- Validation (use body data) ---
        const { age, height, mbti, gender } = (req as any).body;
        const errors: string[] = [];
        if (!age || isNaN(parseInt(age)) || parseInt(age) < 19) errors.push('Valid age (19+) is required.');
        if (!height || isNaN(parseInt(height)) || parseInt(height) < 100) errors.push('Valid height (>= 100cm) is required.');
        if (!mbti || !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('Valid MBTI (4 letters, e.g., INFP) is required.');
        if (!gender || !['male', 'female'].includes(gender.toLowerCase())) errors.push('Valid gender (male/female) is required.');

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
             cleanupFiles();
             res.status(400).json({ message: 'Validation failed', errors });
             return;
        }
        // --- End Validation ---

        try {
            // Prepare file paths
            if (!files || !files.profilePictures || files.profilePictures.length === 0 || !files.businessCard || files.businessCard.length === 0) {
                 console.error('[complete-social] Internal Server Error: File objects missing after validation.');
                 cleanupFiles();
                 res.status(500).json({ message: 'Internal server error processing uploaded files.' });
                 return;
            }
            const profileImageUrls = files.profilePictures.map(file =>
                `/uploads/profiles/${path.basename(file.path)}`
            );
            const businessCardImageUrl = `/uploads/business_cards/${path.basename(files.businessCard[0].path)}`;

            // --- Create NEW user record (using sessionEmail which might be nickname) --- 
            const newUser = await User.create({
                googleId: provider === 'google' ? googleId : null, // Store googleId if provider is google
                kakaoId: provider === 'kakao' ? googleId : null,   // Store kakaoId if provider is kakao
                email: sessionEmail, // This might be the nickname for Kakao users
                name: sessionName, // Use name from session
                age: parseInt(age),
                height: parseInt(height),
                mbti: mbti.toUpperCase(),
                gender: gender.toLowerCase(),
                profileImageUrls: profileImageUrls,
                businessCardImageUrl: businessCardImageUrl,
                status: 'pending_approval', 
                occupation: false, 
            });
            console.log(`[complete-social] New user ${newUser.id} created via ${provider} completion, status set to pending_approval. Email/Identifier: ${sessionEmail}`);
            // -------------------------------

            // --- Clear pending profile from session --- 
            if (req.session) {
                 req.session.pendingSocialProfile = null;
                 // Save session explicitly if needed, although often handled by middleware
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
                 id: newUser.id, email: newUser.email, name: newUser.name,
                 gender: newUser.gender, age: newUser.age, height: newUser.height,
                 mbti: newUser.mbti, profileImageUrls: newUser.profileImageUrls,
                 businessCardImageUrl: newUser.businessCardImageUrl, status: newUser.status
            };

            // Send success response
            res.status(200).json({ // Use 200 OK as user is created but pending
                message: 'Profile information submitted successfully. Waiting for administrator approval.',
                token: token,
                user: userResponse
            });

        } catch (error: any) {
             console.error(`[POST /api/auth/complete-social] Error processing profile completion for social user ${sessionEmail}:`, error);
             cleanupFiles(); 
              // Clear session on error too?
              if(req.session) req.session.pendingSocialProfile = null;

            if (error.name === 'SequelizeValidationError') {
                res.status(400).json({ message: 'Database validation failed.', errors: error.errors?.map((e:any) => e.message) });
            } else if (error.name === 'SequelizeDatabaseError') {
                 res.status(500).json({ message: 'Database error during user creation.' });
            } else {
                 next(error);
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
 *           - `http://localhost:3000/auth/callback?token=<jwt>` on successful login (profile complete).
 *           - `http://localhost:3000/signup/complete-profile` for new users or incomplete profiles.
 *           - `http://localhost:3000/?error=<error_message>` on authentication failure.
 */
router.get('/google/callback',
    (req: any, res, next) => { // Logging middleware (optional but helpful)
        console.log('\n--- Entering /auth/google/callback route ---');
        console.log('Session ID:', req.sessionID);
        console.log('Session Data BEFORE authenticate:', JSON.stringify(req.session, null, 2));
        next();
    },
    (req: any, res, next) => { // Custom authentication callback handler
        passport.authenticate('google', { failureRedirect: 'http://localhost:3000/?error=google_auth_failed' }, // Basic failure redirect
            async (err: any, user: any, info: any) => {
                console.log('\n--- Inside /auth/google/callback passport.authenticate ---');
                console.log('Error:', err);
                console.log('User object (from strategy done()):', user ? user.toJSON() : user);
                console.log('Info:', info);
                console.log('Session Data IN callback:', JSON.stringify(req.session, null, 2));

                if (err) {
                    console.error('Authentication Error from Google strategy:', err);
                    // Redirect with a generic error, or use err.message if available and safe
                    return res.redirect(`http://localhost:3000/?error=google_auth_error`);
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
                        return res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
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
                                return res.redirect('http://localhost:3000/?error=session_save_error');
                            }
                            console.log('Session saved for incomplete existing user. Redirecting...');
                            return res.redirect(`http://localhost:3000/signup/complete-profile`); // Redirect without token
                        });
                    }
                } else if (req.session && req.session.pendingSocialProfile && req.session.pendingSocialProfile.provider === 'google') {
                    // --- New User via Google (strategy called done(null, false)) --- 
                    console.log('Google Callback: New user identified by session. Redirecting to complete profile.');
                    // Session already has the data, just redirect
                    // NOTE: Session *should* have been saved by the strategy before calling done(null, false)
                    // If not, the strategy needs adjustment, or save it here.
                    // Assuming strategy handles saving:
                    return res.redirect('http://localhost:3000/signup/complete-profile');
                } else {
                    // --- Authentication Failed or Unexpected State ---
                    console.error('Google Callback: Unexpected state or user denied access. User:', user, 'Session:', req.session);
                    const failureMsg = info?.message || 'authentication_failed_unexpected';
                    return res.redirect(`http://localhost:3000/?error=${encodeURIComponent(failureMsg)}`);
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
 *           - `http://localhost:3000/auth/callback?token=<jwt>` on successful login (profile complete).
 *           - `http://localhost:3000/signup/complete-profile` for new users or incomplete profiles.
 *           - `http://localhost:3000/?error=<error_message>` on authentication failure.
 */
router.get('/kakao/callback',
    (req: any, res, next) => { // Logging middleware (optional)
        console.log('\n--- Entering /auth/kakao/callback route ---');
        console.log('Session Data BEFORE authenticate:', JSON.stringify(req.session, null, 2));
        next();
    },
    (req: any, res, next) => { // Custom authentication callback handler
        passport.authenticate('kakao', { failureRedirect: 'http://localhost:3000/?error=kakao_auth_failed' },
            async (err: any, user: any, info: any) => {
                console.log('\n--- Inside /auth/kakao/callback passport.authenticate ---');
                console.log('Error:', err);
                // User from strategy comes as a Sequelize model instance
                console.log('User object (from strategy done()):', user ? user.toJSON() : user); 
                console.log('Info:', info);
                console.log('Session Data IN callback:', JSON.stringify(req.session, null, 2));

                if (err) {
                    console.error('Authentication Error from Kakao strategy:', err);
                    return res.redirect(`http://localhost:3000/?error=kakao_auth_error`);
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
                         return res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
                    } else {
                         // Profile incomplete: Session should have been set by strategy, redirect to complete
                         console.log('Kakao Callback: Existing user profile incomplete. Redirecting to complete profile.');
                         // Ensure session was saved by strategy before redirecting
                         return res.redirect(`http://localhost:3000/signup/complete-profile`);
                    }
                } else if (req.session && req.session.pendingSocialProfile && req.session.pendingSocialProfile.provider === 'kakao') {
                    // --- New User via Kakao (strategy called done(null, false)) --- 
                    console.log('Kakao Callback: New user identified by session. Redirecting to complete profile.');
                    // Session already has data, just redirect
                    return res.redirect('http://localhost:3000/signup/complete-profile');
                } else {
                    // --- Authentication Failed or Unexpected State ---
                    console.error('Kakao Callback: Unexpected state or user denied access. User:', user, 'Info:', info, 'Session:', req.session);
                    const failureMsg = info?.message || 'kakao_authentication_failed';
                    return res.redirect(`http://localhost:3000/?error=${encodeURIComponent(failureMsg)}`);
                }
            })(req, res, next); // Invoke the middleware
    }
);
// --- End Kakao Authentication Routes ---

// ... (Keep other routes like /verify-token, etc. if they exist) ...

export default router; 