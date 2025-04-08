import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// Import Sequelize model (adjust path/import method if needed)
const db = require('../../models'); // Adjust if models/index.js provides types
const User = db.User;

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
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password, name } = req.body;

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
                // Add default/null values for other User model fields if necessary
                // dob: null, age: null, etc. based on your model definition
            });
            console.log('New user created:', newUser.toJSON());

            // Respond
            res.status(201).json({ message: 'User registered successfully' });

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

            // Compare password
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                res.status(400).json({ message: 'Invalid credentials' }); // Keep generic message
                return;
            }

            // Generate JWT
            const payload = { userId: user.id, email: user.email }; // Use ID from DB user object
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

            // Respond with token and basic user info (exclude password hash)
            const userResponse = { // Explicitly create response object
                 id: user.id,
                 email: user.email,
                 name: user.name,
                 // Add other non-sensitive fields if needed
            };
            res.json({ token, user: userResponse });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

export default router; 