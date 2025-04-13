import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize'; // Import Op for OR query
import multer, { FileFilterCallback } from 'multer'; // Import multer and FileFilterCallback
import path from 'path';     // Import path
import fs from 'fs';         // Import fs
import { authenticateToken } from '../middleware/authMiddleware'; // Import authentication middleware
// Import Sequelize model (adjust path/import method if needed)
const db = require('../../models'); // Adjust if models/index.js provides types
const User = db.User;
const Match = db.Match; // Import Match model
const MatchingWaitList = db.MatchingWaitList; // MatchingWaitList 모델 import

const router = express.Router();

// --- Remove Mock User Data Store ---
// interface User {...}
// const users: User[] = [];
// ------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME'; // !! CHANGE THIS !!

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
    filename: (req: Request, file: Express.Multer.File, cb: FileNameCallback) => {
        // Use userId (from token), fieldname, timestamp, and original extension for unique filename
        // Ensure req.user exists via authenticateToken middleware before this runs
        const userId = (req as any).user?.userId || 'unknown'; // Get userId from authenticated request
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const filename = `${userId}-${file.fieldname}-${uniqueSuffix}${extension}`;
        console.log(`[Multer] Generating filename: ${filename} for user: ${userId}`);
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

            // --- Add male user to waitlist (Keep this logic) --- 
            if (newUser.gender === 'male') {
                try {
                    await MatchingWaitList.create({ userId: newUser.id });
                    console.log(`Male user ${newUser.id} added to MatchingWaitList.`);
                } catch (waitlistError: any) {
                    if (waitlistError.name === 'SequelizeUniqueConstraintError') {
                        console.warn(`User ${newUser.id} already in MatchingWaitList (signup).`);
                    } else {
                        console.error(`Error adding user ${newUser.id} to MatchingWaitList:`, waitlistError);
                    }
                }
            }
            // ------------------------------------

            // --- Generate JWT for the new pending user --- 
            const payload = { 
                userId: newUser.id, 
                email: newUser.email,
                status: newUser.status // Should be 'pending_approval' from create
            };
            console.log('Generating JWT for new pending user with payload:', payload); 
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Use a reasonable expiration
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
                        defaults: { userId: user.id } // Create if not found
                    });
                    if (created) {
                        console.log(`Male user ${user.id} added to MatchingWaitList on login.`);
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
interface AuthenticatedRequest extends Request {
    user?: { userId: number; [key: string]: any }; // Define structure for req.user
    files?: { // Define structure for req.files from multer.fields
        profilePictures?: Express.Multer.File[];
        businessCard?: Express.Multer.File[];
    };
}

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
    authenticateToken,
    (req: Request, res: Response, next: NextFunction) => { // Use standard Request type here
        console.log(`[complete-social] Authenticated user ID: ${(req as AuthenticatedRequest).user?.userId}`);
        next();
    },
    upload.fields([ // multer middleware
        { name: 'profilePictures', maxCount: 3 },
        { name: 'businessCard', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => { // Use standard Request type here
        // Use the AuthenticatedRequest interface for type safety within the handler
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.userId;
        const files = authReq.files;

        console.log(`[POST /api/auth/complete-social] Processing request for user ID: ${userId}`);
        console.log('Body:', authReq.body);

        if (!userId) {
            console.error('[complete-social] Error: userId missing after authenticateToken.');
            res.status(401).json({ message: 'Authentication failed: User ID not found.' });
            return;
        }

        const cleanupFiles = () => {
            console.warn(`[complete-social] Cleaning up uploaded files for failed request (User ID: ${userId}).`);
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

        // --- Validation ---
        const { age, height, mbti, gender } = authReq.body;
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
             console.warn(`[complete-social] Validation failed for user ${userId}:`, errors);
             cleanupFiles();
             res.status(400).json({ message: 'Validation failed', errors });
             return;
        }
        // --- End Validation ---

        try {
            const user = await User.findByPk(userId);

            if (!user) {
                console.error(`[complete-social] Error: User not found for ID: ${userId}`);
                cleanupFiles();
                res.status(404).json({ message: 'User associated with this token not found.' });
                return;
            }

            // Allow profile update even if already active
            if (user.status === 'active') {
                 console.log(`[complete-social] User ${userId} profile already active, proceeding with update...`);
            }

            // Prepare file paths (ensure they are web-accessible, e.g., /uploads/...)
            // Add checks to satisfy TypeScript, even though validation should guarantee existence here
        if (!files || !files.profilePictures || files.profilePictures.length === 0 || !files.businessCard || files.businessCard.length === 0) {
                 // This block should technically not be reached due to the validation checks above
                 console.error('[complete-social] Internal Server Error: File objects are missing after validation passed.');
                 cleanupFiles(); // Clean up any potentially partially uploaded files
                 res.status(500).json({ message: 'Internal server error processing uploaded files.' });
                 return; // Add explicit return; after sending response
            }

            // Now TypeScript knows files, files.profilePictures, and files.businessCard exist and are not empty
            const profileImageUrls = files.profilePictures.map(file =>
                `/uploads/profiles/${path.basename(file.path)}`
            );
            const businessCardImageUrl = `/uploads/business_cards/${path.basename(files.businessCard[0].path)}`;

            // Update user record
            user.age = parseInt(age);
            user.height = parseInt(height);
            user.mbti = mbti.toUpperCase();
            user.gender = gender.toLowerCase();
            user.profileImageUrls = profileImageUrls;
            user.businessCardImageUrl = businessCardImageUrl;
            // --- Set status to pending approval ---
            user.status = 'pending_approval'; // Require admin approval after profile completion
            user.occupation = false; // Set occupation to false until approved
            // -------------------------------------

            await user.save();
            console.log(`[complete-social] User ${userId} profile completed, status set to pending_approval.`);

            // --- Generate NEW token with pending_approval status ---
            const payload = {
                userId: user.id,
                email: user.email,
                status: user.status, // Should be 'pending_approval'
                gender: user.gender
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            // --------------------------------------------------------------

            // Prepare user response (include the pending status)
            const userResponse = {
                 id: user.id,
                 email: user.email,
                 name: user.name,
                 gender: user.gender,
                 age: user.age,
                 height: user.height,
                 mbti: user.mbti,
                 profileImageUrls: user.profileImageUrls,
                 businessCardImageUrl: user.businessCardImageUrl,
                 status: user.status // Send 'pending_approval' status
            };

            // Send success response
            res.status(200).json({
                message: 'Profile information submitted successfully. Waiting for administrator approval.', // Update message
                token: token,
                user: userResponse
            });

        } catch (error: any) {
             console.error(`[POST /api/auth/complete-social] Error processing profile completion for user ${userId}:`, error);
             cleanupFiles();

            if (error.name === 'SequelizeValidationError') {
                res.status(400).json({ message: 'Database validation failed.', errors: error.errors?.map((e:any) => e.message) });
            } else if (error.name === 'SequelizeDatabaseError') {
                 res.status(500).json({ message: 'Database error during profile update.' });
            } else {
                 next(error);
            }
        }
    }
);

// ... (Keep other routes like /verify-token, etc. if they exist) ...

export default router; 