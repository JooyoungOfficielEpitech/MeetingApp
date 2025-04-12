import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize'; // Import Op for OR query
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
    if (req.session && req.session.pendingSocialProfile) {
        const { email, name } = req.session.pendingSocialProfile;
        res.json({ email, name });
    } else {
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
router.post('/complete-social', 
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender value'),
    completeSocialProfileHandler // Apply the separated handler
);

export default router; 